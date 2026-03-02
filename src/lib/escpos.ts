/**
 * ESC/POS thermal receipt printing via WebUSB
 */

import { ResolvedCase, LabelSettings } from '@/types/rental';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Text formatting commands
const CMD = {
  INIT: [ESC, 0x40],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_BOTH: [ESC, 0x21, 0x30],
  NORMAL: [ESC, 0x21, 0x00],
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  CUT: [GS, 0x56, 0x00],
  PARTIAL_CUT: [GS, 0x56, 0x01],
  FEED_LINES: (n: number) => [ESC, 0x64, n],
  LINE_SPACING: (n: number) => [ESC, 0x33, n],
};

function encode(text: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
}

function line(text: string): number[] {
  return [...encode(text), LF];
}

function separator(width: number): number[] {
  const chars = width <= 58 ? 32 : 48;
  return line('─'.repeat(Math.floor(chars / 3))); // ─ is 3 bytes in UTF-8
}

function padRow(left: string, right: string, cols: number): string {
  const gap = cols - left.length - right.length;
  return left + ' '.repeat(Math.max(1, gap)) + right;
}

export function buildReceiptData(
  cases: ResolvedCase[],
  settings: LabelSettings
): Uint8Array {
  const cols = settings.thermalReceiptWidth <= 58 ? 32 : 48;
  const buf: number[] = [];

  buf.push(...CMD.INIT);
  buf.push(...CMD.LINE_SPACING(60));

  // Header
  buf.push(...CMD.ALIGN_CENTER);
  buf.push(...CMD.DOUBLE_BOTH);
  buf.push(...line(settings.companyName || 'RENTAL CO.'));
  buf.push(...CMD.NORMAL);
  buf.push(LF);

  // Group by order
  const orderMap = new Map<string, ResolvedCase[]>();
  cases.forEach((c) => {
    const list = orderMap.get(c.orderId) || [];
    list.push(c);
    orderMap.set(c.orderId, list);
  });

  for (const [, orderCases] of orderMap) {
    const first = orderCases[0];

    buf.push(...CMD.ALIGN_LEFT);
    buf.push(...separator(settings.thermalReceiptWidth));

    // Job info
    buf.push(...CMD.BOLD_ON);
    buf.push(...line(first.jobName));
    buf.push(...CMD.BOLD_OFF);
    buf.push(...line(first.customerName));

    if (settings.showVenue) {
      buf.push(...line(first.venue));
    }

    if (settings.showDates) {
      const out = new Date(first.jobDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const ret = new Date(first.returnDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      buf.push(...line(`Out: ${out}  Return: ${ret}`));
    }

    buf.push(...line(`Ref: ${first.orderRef}`));
    buf.push(LF);

    // Each case
    for (const rc of orderCases) {
      buf.push(...CMD.BOLD_ON);
      buf.push(...line(`[${rc.caseItem.name}]`));
      buf.push(...CMD.BOLD_OFF);

      if (rc.caseAssetCode) {
        buf.push(...line(`Asset: ${rc.caseAssetCode}`));
      }

      if (settings.showContents && rc.contents.length > 0) {
        for (const item of rc.contents) {
          const left = ` ${item.name}`;
          const right = `x${item.quantity}`;
          buf.push(...line(padRow(left, right, cols)));
        }
      }

      if (settings.showWeight) {
        buf.push(...CMD.ALIGN_RIGHT);
        buf.push(...CMD.BOLD_ON);
        buf.push(...line(`${rc.totalWeight.toFixed(1)} kg`));
        buf.push(...CMD.BOLD_OFF);
        buf.push(...CMD.ALIGN_LEFT);
      }

      buf.push(LF);
    }

    if (first.notes && settings.showNotes) {
      buf.push(...line(`Notes: ${first.notes}`));
    }
  }

  buf.push(...separator(settings.thermalReceiptWidth));
  buf.push(...CMD.ALIGN_CENTER);
  buf.push(...line(new Date().toLocaleString('en-GB')));
  buf.push(...CMD.FEED_LINES(4));
  buf.push(...CMD.PARTIAL_CUT);

  return new Uint8Array(buf);
}

export async function connectAndPrint(data: Uint8Array): Promise<void> {
  if (!('usb' in navigator)) {
    throw new Error('WebUSB is not supported in this browser. Use Chrome or Edge.');
  }

  const device = await (navigator as any).usb.requestDevice({
    filters: [
      // Common thermal printer vendor IDs
      { vendorId: 0x0416 }, // Winbond (many POS printers)
      { vendorId: 0x0483 }, // STMicroelectronics
      { vendorId: 0x04b8 }, // Epson
      { vendorId: 0x0519 }, // Star Micronics
      { vendorId: 0x0dd4 }, // Custom
      { vendorId: 0x0fe6 }, // ICS
      { vendorId: 0x1504 }, // SNBC
      { vendorId: 0x1a86 }, // QinHeng (CH340 based)
      { vendorId: 0x1fc9 }, // NXP
      { vendorId: 0x2730 }, // Citizen
      { vendorId: 0x28e9 }, // GD32
    ],
  });

  await device.open();

  // Select configuration and claim interface
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  const iface = device.configuration.interfaces[0];
  await device.claimInterface(iface.interfaceNumber);

  // Find bulk OUT endpoint
  const endpoint = iface.alternate.endpoints.find(
    (ep: any) => ep.direction === 'out' && ep.type === 'bulk'
  );

  if (!endpoint) {
    throw new Error('No bulk OUT endpoint found on the printer.');
  }

  // Send data in chunks (some printers have buffer limits)
  const CHUNK = 512;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    await device.transferOut(endpoint.endpointNumber, chunk);
  }

  await device.close();
}
