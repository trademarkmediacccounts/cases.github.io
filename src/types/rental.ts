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
  labelWidth: 100,
  labelHeight: 150,
  accentColor: 'amber',
};

/**
 * Resolves an order's items into cases.
 * Items with productCategory 'case' become containers;
 * all other items are distributed as contents.
 */
export function resolveOrderCases(order: RentalOrder): ResolvedCase[] {
  const caseItems = order.items.filter(
    (item) => item.productCategory?.toLowerCase() === 'case'
  );
  const contentItems = order.items.filter(
    (item) => item.productCategory?.toLowerCase() !== 'case'
  );

  // If no case items found, create a single virtual case
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

  // Distribute content items evenly across cases
  return caseItems.map((caseItem, index) => {
    // For single case, all contents go in it. For multiple, distribute round-robin.
    const assignedContents =
      caseItems.length === 1
        ? contentItems
        : contentItems.filter((_, i) => i % caseItems.length === index);

    const contentsWeight = assignedContents.reduce(
      (sum, item) => sum + (item.weight ?? 0) * item.quantity,
      0
    );
    const caseWeight = (caseItem.weight ?? 0) * 1; // case itself
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
