export type FuelType = 'essence' | 'diesel' | 'hybride' | 'electrique' | 'gpl' | 'autre';

export type DossierStatus =
  | 'brouillon'
  | 'soumis'
  | 'en_attente_validation'
  | 'correction_demandee'
  | 'refuse'
  | 'valide'
  | 'annule_vendeur';

export interface BlurZone {
  /** Index de page (0-based) pour un document PDF multi-page ; absent/0 pour une photo ou un document image. */
  page?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  _id?: string;
}

export interface PdfPage {
  index: number;
  width: number;
  height: number;
  dataUrl: string;
}

export interface DossierPhoto {
  _id?: string;
  originalUrl: string;
  processedUrl?: string;
  blurZones: BlurZone[];
  isCover: boolean;
  order: number;
}

export type DocumentType = 'rapport_expert' | 'complementaire';

export interface DossierDocument {
  _id?: string;
  type: DocumentType;
  originalUrl: string;
  processedUrl?: string;
  mimeType?: string;
  blurZones: BlurZone[];
  label?: string;
}

export interface DossierRefusal {
  date: string;
  motifs: string[];
  motifsLabels: string[];
  comment?: string;
  resubmittedAt?: string;
}

export interface DossierSeller {
  _id: string;
  companyName: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface VehicleDossier {
  _id: string;
  seller: DossierSeller;
  brand?: string;
  model?: string;
  year?: number;
  mileage?: number;
  engine?: string;
  fuelType?: FuelType;
  vin?: string;
  description?: string;
  vehicleCondition?: string;
  photos: DossierPhoto[];
  expertReport?: DossierDocument;
  additionalDocuments: DossierDocument[];
  reservePrice?: number;
  conditionDetails?: string;
  status: DossierStatus;
  submittedAt?: string;
  refusals: DossierRefusal[];
  createdAt: string;
  updatedAt: string;
}

export const FUEL_LABELS: Record<FuelType, string> = {
  essence: 'Essence',
  diesel: 'Diesel',
  hybride: 'Hybride',
  electrique: 'Électrique',
  gpl: 'GPL',
  autre: 'Autre',
};
