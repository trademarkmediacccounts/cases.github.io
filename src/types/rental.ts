export interface CaseItem {
  name: string;
  quantity: number;
  serialNumber?: string;
  weight?: number; // kg per unit
  productCategory?: string;
}

export interface RentalOrder {
  id: string;
  orderRef: string;
  customerName: string;
  jobName: string;
  jobDate: string;
  returnDate: string;
  venue: string;
  caseAssetCode: string;
  status: 'confirmed' | 'in_progress' | 'returned';
  items: CaseItem[]; // all items in the order
  notes?: string;
}

/** A resolved case with its contents derived from order items */
export interface ResolvedCase {
  orderId: string;
  orderRef: string;
  customerName: string;
  jobName: string;
  jobDate: string;
  returnDate: string;
  venue: string;
  status: RentalOrder['status'];
  caseItem: CaseItem;
  caseAssetCode: string;
  contents: CaseItem[];
  totalWeight: number; // kg
  notes?: string;
}

// ── Label Sizing ───────────────────────────────────────────────────

export type LabelPreset = 'flightcase-small' | 'flightcase-large' | 'thermal-4x6' | 'thermal-receipt' | 'custom';
export type LabelOrientation = 'portrait' | 'landscape';
export type LabelMode = 'label' | 'thermal-receipt';

export interface LabelPresetDef {
  name: string;
  width: number; // mm
  height: number; // mm
  thermal?: boolean;
}

export const LABEL_PRESETS: Record<Exclude<LabelPreset, 'custom'>, LabelPresetDef> = {
  'flightcase-small': { name: 'Flightcase 127×178mm', width: 127, height: 178 },
  'flightcase-large': { name: 'Flightcase 150×210mm', width: 150, height: 210 },
  'thermal-4x6': { name: 'Thermal 4″×6″', width: 102, height: 152, thermal: true },
  'thermal-receipt': { name: 'Thermal Receipt', width: 80, height: 0, thermal: true }, // height = auto
};

export interface LabelSettings {
  showLogo: boolean;
  companyName: string;
  showBarcode: boolean;
  showContents: boolean;
  showDates: boolean;
  showNotes: boolean;
  showVenue: boolean;
  showWeight: boolean;
  fontSize: 'small' | 'medium' | 'large';
  labelWidth: number;
  labelHeight: number;
  accentColor: string;
  labelPreset: LabelPreset;
  orientation: LabelOrientation;
  labelMode: LabelMode;
  thermalReceiptWidth: number; // mm
}

export const defaultLabelSettings: LabelSettings = {
  showLogo: true,
  companyName: 'RENTAL CO.',
  showBarcode: true,
  showContents: true,
  showDates: true,
  showNotes: true,
  showVenue: true,
  showWeight: true,
  fontSize: 'medium',
  labelWidth: 127,
  labelHeight: 178,
  accentColor: 'amber',
  labelPreset: 'flightcase-small',
  orientation: 'portrait',
  labelMode: 'label',
  thermalReceiptWidth: 80,
};

/** Get effective dimensions based on preset + orientation */
export function getEffectiveDimensions(settings: LabelSettings): { width: number; height: number } {
  let w = settings.labelWidth ?? 127;
  let h = settings.labelHeight ?? 178;

  const presetKey = settings.labelPreset ?? 'custom';
  if (presetKey !== 'custom') {
    const preset = LABEL_PRESETS[presetKey];
    if (preset) {
      w = preset.width;
      h = preset.height;
    }
  }

  if (settings.orientation === 'landscape' && h > 0) {
    return { width: h, height: w };
  }
  return { width: w, height: h };
}

/**
 * Resolves an order's items into cases.
 */
export function resolveOrderCases(order: RentalOrder): ResolvedCase[] {
  const caseItems = order.items.filter(
    (item) => item.productCategory?.toLowerCase() === 'case'
  );
  const contentItems = order.items.filter(
    (item) => item.productCategory?.toLowerCase() !== 'case'
  );

  if (caseItems.length === 0) {
    const totalWeight = contentItems.reduce(
      (sum, item) => sum + (item.weight ?? 0) * item.quantity,
      0
    );
    return [
      {
        orderId: order.id,
        orderRef: order.orderRef,
        customerName: order.customerName,
        jobName: order.jobName,
        jobDate: order.jobDate,
        returnDate: order.returnDate,
        venue: order.venue,
        status: order.status,
        caseItem: { name: 'Unassigned', quantity: 1, productCategory: 'case' },
        caseAssetCode: order.caseAssetCode,
        contents: contentItems,
        totalWeight,
        notes: order.notes,
      },
    ];
  }

  return caseItems.map((caseItem, index) => {
    const assignedContents =
      caseItems.length === 1
        ? contentItems
        : contentItems.filter((_, i) => i % caseItems.length === index);

    const contentsWeight = assignedContents.reduce(
      (sum, item) => sum + (item.weight ?? 0) * item.quantity,
      0
    );
    const caseWeight = (caseItem.weight ?? 0) * 1;
    const totalWeight = contentsWeight + caseWeight;

    return {
      orderId: order.id,
      orderRef: order.orderRef,
      customerName: order.customerName,
      jobName: order.jobName,
      jobDate: order.jobDate,
      returnDate: order.returnDate,
      venue: order.venue,
      status: order.status,
      caseItem,
      caseAssetCode: caseItem.serialNumber ?? order.caseAssetCode,
      contents: assignedContents,
      totalWeight: Math.round(totalWeight * 100) / 100,
      notes: order.notes,
    };
  });
}
