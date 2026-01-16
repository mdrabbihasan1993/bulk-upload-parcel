
export enum ParcelStatus {
  VALID = 'VALID',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  PENDING = 'PENDING'
}

export interface Parcel {
  id: string;
  invoiceId: string;
  recipientName: string;
  address: string;
  phone: string;
  weight: number; // in kg
  note: string;
  serviceType: 'Standard' | 'Express' | 'Overnight';
  status: ParcelStatus;
  statusMessage?: string;
}

export interface BulkUploadBatch {
  id: string;
  timestamp: Date;
  totalParcels: number;
  validParcels: number;
  errorParcels: number;
  parcels: Parcel[];
}

export interface AIAnalysisResult {
  summary: string;
  recommendations: string[];
  correctedParcels: Array<{
    id: string;
    suggestedAddress?: string;
    issue?: string;
  }>;
}
