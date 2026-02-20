export interface CaseItem {
  name: string;
  quantity: number;
  serialNumber?: string;
}

export interface RentalOrder {
  id: string;
  orderRef: string;
  customerName: string;
  jobName: string;
  jobDate: string;
  returnDate: string;
  venue: string;
  caseNumber: string;
  caseAssetCode: string;
  caseType: string;
  contents: CaseItem[];
  notes?: string;
  status: 'confirmed' | 'in_progress' | 'returned';
}

export interface LabelSettings {
  showLogo: boolean;
  companyName: string;
  showBarcode: boolean;
  showContents: boolean;
  showDates: boolean;
  showNotes: boolean;
  showVenue: boolean;
  fontSize: 'small' | 'medium' | 'large';
  labelWidth: number; // mm
  labelHeight: number; // mm
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
  fontSize: 'medium',
  labelWidth: 100,
  labelHeight: 150,
  accentColor: 'amber',
};
