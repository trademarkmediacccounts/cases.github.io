import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RentalOrder {
  id: string;
  orderRef: string;
  customerName: string;
  jobName: string;
  jobDate: string;
  returnDate: string;
  venue: string;
  caseAssetCode: string;
  status: "confirmed" | "in_progress" | "returned";
  items: {
    name: string;
    quantity: number;
    serialNumber?: string;
    weight?: number;
    productCategory?: string;
  }[];
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { data: credentials, error: credError } = await supabase
      .from("api_credentials")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (credError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({
          orders: [],
          message: "No API credentials configured. Go to Settings to add them.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allOrders: RentalOrder[] = [];
    const errors: string[] = [];

    for (const cred of credentials) {
      try {
        if (cred.platform === "odoo") {
          const orders = await fetchOdooOrders(cred);
          allOrders.push(...orders);
        } else if (cred.platform === "currentrms") {
          const orders = await fetchCurrentRMSOrders(cred);
          allOrders.push(...orders);
        }
      } catch (err: any) {
        errors.push(`${cred.platform}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ orders: allOrders, errors: errors.length ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Odoo JSON-RPC helper ───────────────────────────────────────────

async function odooRpc(url: string, params: any, id = 1): Promise<any> {
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params, id }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

// ── Odoo fetch ─────────────────────────────────────────────────────

async function fetchOdooOrders(cred: any): Promise<RentalOrder[]> {
  const url = cred.api_url.replace(/\/$/, "");

  // Authenticate
  const uid = await odooRpc(url, {
    service: "common",
    method: "authenticate",
    args: [cred.database_name, cred.username, cred.api_key, {}],
  });
  if (!uid) throw new Error("Odoo authentication failed");

  const rpcArgs = (model: string, method: string, args: any[], kwargs: any = {}) => ({
    service: "object",
    method: "execute_kw",
    args: [cred.database_name, uid, cred.api_key, model, method, args, kwargs],
  });

  // Search rental orders
  const rentalOrders = await odooRpc(url, rpcArgs(
    "sale.order", "search_read",
    [[["is_rental_order", "=", true]]],
    {
      fields: ["name", "partner_id", "rental_status", "date_order", "rental_return_date", "note", "order_line"],
      limit: 50,
      order: "date_order desc",
    }
  )) || [];

  const orders: RentalOrder[] = [];

  for (const ro of rentalOrders) {
    if (!ro.order_line?.length) {
      orders.push(buildOdooOrder(ro, []));
      continue;
    }

    // Fetch order lines — basic fields first
    let lines: any[] = [];
    try {
      lines = await odooRpc(url, rpcArgs(
        "sale.order.line", "read",
        [ro.order_line],
        { fields: ["product_id", "name", "product_uom_qty", "product_template_id"] }
      )) || [];
    } catch (e) {
      console.error(`Failed to read order lines for ${ro.name}:`, e);
      orders.push(buildOdooOrder(ro, []));
      continue;
    }

    // Collect unique product template IDs to fetch barcodes
    const templateIds = new Set<number>();
    for (const line of lines) {
      const tmplId = line.product_template_id?.[0];
      if (tmplId) templateIds.add(tmplId);
    }

    // Fetch barcodes from product.template
    const barcodeMap = new Map<number, string>();
    if (templateIds.size > 0) {
      try {
        const templates = await odooRpc(url, rpcArgs(
          "product.template", "read",
          [Array.from(templateIds)],
          { fields: ["barcode"] }
        )) || [];
        for (const tmpl of templates) {
          if (tmpl.barcode) {
            barcodeMap.set(tmpl.id, tmpl.barcode);
          }
        }
      } catch {
        // If product.template read fails, continue without barcodes
      }
    }

    // Also try to fetch lot/serial info (may fail on some Odoo setups)
    const lotMap = new Map<number, string>();
    try {
      const linesWithLots = await odooRpc(url, rpcArgs(
        "sale.order.line", "read",
        [ro.order_line],
        { fields: ["reserved_lot_ids", "pickedup_lot_ids"] }
      )) || [];

      const allLotIds = new Set<number>();
      for (const line of linesWithLots) {
        for (const id of (line.pickedup_lot_ids || [])) allLotIds.add(id);
        for (const id of (line.reserved_lot_ids || [])) allLotIds.add(id);
      }

      if (allLotIds.size > 0) {
        const lots = await odooRpc(url, rpcArgs(
          "stock.lot", "read",
          [Array.from(allLotIds)],
          { fields: ["name", "ref"] }
        )) || [];
        for (const lot of lots) {
          lotMap.set(lot.id, lot.ref || lot.name || "");
        }
      }

      // Merge lot serials into lines
      for (let i = 0; i < lines.length; i++) {
        const lotLine = linesWithLots[i];
        if (lotLine) {
          lines[i]._lotIds = (lotLine.pickedup_lot_ids?.length ? lotLine.pickedup_lot_ids : lotLine.reserved_lot_ids) || [];
        }
      }
    } catch {
      // Lot fields not available on this Odoo instance — that's fine
    }

    const mappedItems = lines.map((line: any) => {
      const tmplId = line.product_template_id?.[0];
      // Priority: product.template barcode > lot serial
      const barcode = tmplId ? barcodeMap.get(tmplId) : undefined;
      const lotSerial = (line._lotIds?.length > 0) ? lotMap.get(line._lotIds[0]) : undefined;
      const serialNumber = barcode || lotSerial || undefined;

      return {
        name: cleanOdooItemName(line.product_id?.[1] || line.name || "Product"),
        quantity: line.product_uom_qty || 1,
        serialNumber,
        productCategory: detectProductCategory(line.name || line.product_id?.[1] || ""),
      };
    });

    orders.push(buildOdooOrder(ro, mappedItems));
  }

  return orders;
}

function buildOdooOrder(ro: any, items: any[]): RentalOrder {
  const statusMap: Record<string, RentalOrder["status"]> = {
    confirmed: "confirmed",
    pickup: "confirmed",
    return: "in_progress",
    returned: "returned",
  };

  return {
    id: `odoo-${ro.id}`,
    orderRef: ro.name || `ODO-${ro.id}`,
    customerName: ro.partner_id?.[1] || "Unknown Customer",
    jobName: ro.name || "Rental Order",
    jobDate: ro.date_order?.split(" ")[0] || new Date().toISOString().split("T")[0],
    returnDate: ro.rental_return_date?.split(" ")[0] || "",
    venue: "",
    caseAssetCode: `ODO-${ro.id}`,
    status: statusMap[ro.rental_status] || "confirmed",
    items,
    notes: ro.note ? ro.note.replace(/<[^>]*>/g, "") : undefined,
  };
}

// ── Clean Odoo Item Names ──────────────────────────────────────────

function cleanOdooItemName(name: string): string {
  return name
    .replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}.*?-.*?\d{1,2}\/\d{1,2}\/\d{2,4}.*?\)\s*/g, "")
    .replace(/\s*\(\d{4}-\d{2}-\d{2}.*?-.*?\d{4}-\d{2}-\d{2}.*?\)\s*/g, "")
    .trim();
}

// ── Product Category Detection ─────────────────────────────────────

const CASE_KEYWORDS = [
  "case", "flight case", "road case", "rack case", "peli", "pelican",
  "skb", "gator", "transport case", "trunk", "flightcase", "hard case",
  "rolling case", "utility case", "equipment case",
];

function detectProductCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const keyword of CASE_KEYWORDS) {
    if (lower.includes(keyword)) return "case";
  }
  if (/\b(cable|xlr|dmx|sdi|hdmi|powercon|cat[56])\b/i.test(name)) return "cable";
  if (/\b(speaker|sub|amp|mixer|mic|monitor|iem|earphone|headphone|di box)\b/i.test(name)) return "audio";
  if (/\b(light|wash|spot|beam|par|strobe|hazer|haze|fog|dmx)\b/i.test(name)) return "lighting";
  if (/\b(projector|screen|camera|lens|tripod|switcher|recorder)\b/i.test(name)) return "video";
  if (/\b(clamp|coupler|truss|stand|rigging|safety|sling)\b/i.test(name)) return "rigging";
  return "general";
}

// ── currentRMS REST API ────────────────────────────────────────────

async function fetchCurrentRMSOrders(cred: any): Promise<RentalOrder[]> {
  const baseUrl = cred.api_url.replace(/\/$/, "");
  const subdomain = cred.subdomain;

  const res = await fetch(
    `${baseUrl}/opportunities?per_page=50&filtermode=active&include[]=opportunity_items`,
    {
      headers: {
        "X-SUBDOMAIN": subdomain,
        "X-AUTH-TOKEN": cred.api_key,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`currentRMS API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const opportunities = data.opportunities || [];

  return opportunities.map((opp: any) => {
    const items =
      opp.opportunity_items?.map((item: any) => ({
        name: item.name || item.product_name || "Item",
        quantity: item.quantity || 1,
        serialNumber: item.serial_number || undefined,
        weight: item.weight || undefined,
        productCategory: (item.product_group_name || "general").toLowerCase(),
      })) || [];

    const statusMap: Record<number, RentalOrder["status"]> = {
      1: "confirmed",
      2: "confirmed",
      3: "in_progress",
      4: "returned",
    };

    return {
      id: `crms-${opp.id}`,
      orderRef: opp.number || `CRMS-${opp.id}`,
      customerName: opp.member_name || opp.organisation_name || "Unknown",
      jobName: opp.subject || "Opportunity",
      jobDate: opp.starts_at?.split("T")[0] || "",
      returnDate: opp.ends_at?.split("T")[0] || "",
      venue: opp.venue || opp.destination || "",
      caseAssetCode: `CRMS-${opp.id}`,
      status: statusMap[opp.status] || "confirmed",
      items,
      notes: opp.description || undefined,
    };
  });
}
