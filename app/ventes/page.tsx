'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import StatCard from '../components/StatCard';
import SkeletonRows from '../components/SkeletonRows';
import type { DossierSeller } from '../lib/vehicleDossier';
import { Badge } from '../components/StatusBadge';
import { Columns3, Download, Eye, X } from 'lucide-react';

/** États commerciaux calculés par le serveur (cf. adminVehicleSales.service.js). */
type SaleState = 'en_attente' | 'en_enchere' | 'en_cours_vente' | 'vendu';

const SALE_STATE_BADGES: Record<SaleState, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#ffffff', bg: '#6b7280' },
  en_enchere: { label: 'En enchère', color: '#ffffff', bg: '#2563eb' },
  en_cours_vente: { label: 'En cours de vente', color: '#ffffff', bg: '#f97316' },
  vendu: { label: 'Vendu', color: '#ffffff', bg: '#16a34a' },
};

interface VehicleSaleRow {
  _id: string;
  coverPhotoUrl?: string | null;
  brand?: string;
  model?: string;
  registrationNumber?: string;
  procedure?: string;
  submittedAt?: string;
  year?: number;
  co2?: string;
  energyLabel?: string;
  fuelType?: string;
  vehicleGenre?: string;
  fiscalPower?: string;
  bodyType?: string;
  vin?: string;
  gearbox?: string;
  color?: string;
  mileage?: number;
  vrade?: string;
  registrationCardAvailable?: boolean;
  registrationCardMissingReasons?: string[];
  identificationSheetAvailable?: boolean;
  policeBookNumber?: string;
  engine?: string;
  firstRegistrationDate?: string;
  registrationCountry?: string;
  passengerCount?: string;
  doorCount?: string;
  description?: string;
  conditionDetails?: string;
  vehicleAddress?: string;
  vehicleAddressDetails?: { street?: string; postalCode?: string; city?: string; country?: string };
  photoCount?: number;
  hasExpertReport?: boolean;
  updatedAt?: string;
  reservePrice?: number;
  offerCount?: number;
  listingCount?: number;
  lotNumber?: number | null;
  seller?: DossierSeller;
  saleState: SaleState;
  session: { _id: string; name: string; status: string; endDate?: string } | null;
  sale: { _id: string; status: string; amount?: number; currentStep?: number; winner?: DossierSeller } | null;
}

interface VehicleOffer {
  _id: string;
  amount: number;
  status: 'active' | 'annulee';
  createdAt: string;
  updatedAt: string;
  revisions?: Array<unknown>;
  buyer?: DossierSeller & { phone?: string; role?: string };
}

interface OffersModalData {
  vehicle: { _id: string; brand?: string; model?: string; registrationNumber?: string; reservePrice?: number; session?: { name?: string } };
  offers: VehicleOffer[];
}

type ColumnKey =
  | 'coverPhoto' | 'brand' | 'model' | 'registrationNumber' | 'seller' | 'saleState' | 'session'
  | 'amount' | 'winner' | 'reservePrice' | 'offerCount' | 'listingCount' | 'procedure' | 'submittedAt'
  | 'year' | 'co2' | 'energyLabel' | 'vehicleGenre' | 'fiscalPower' | 'bodyType'
  | 'vin' | 'gearbox' | 'color' | 'mileage' | 'vrade' | 'registrationCardAvailable'
  | 'engine' | 'fuelType' | 'firstRegistrationDate' | 'registrationCountry'
  | 'passengerCount' | 'doorCount' | 'identificationSheetAvailable'
  | 'registrationCardMissingReasons' | 'policeBookNumber' | 'vehicleAddress'
  | 'vehicleCity' | 'vehiclePostalCode' | 'description' | 'conditionDetails'
  | 'photoCount' | 'hasExpertReport' | 'updatedAt' | 'lotNumber';

interface TableColumn {
  key: ColumnKey;
  label: string;
  width: number;
}

const TABLE_COLUMNS: TableColumn[] = [
  { key: 'coverPhoto', label: 'Photo', width: 120 },
  { key: 'lotNumber', label: 'Lot', width: 110 },
  { key: 'brand', label: 'Marque', width: 150 },
  { key: 'model', label: 'Modèle', width: 160 },
  { key: 'registrationNumber', label: 'Immat.', width: 130 },
  { key: 'seller', label: 'Vendeur', width: 170 },
  { key: 'session', label: 'Session', width: 160 },
  { key: 'amount', label: 'Montant vente', width: 145 },
  { key: 'winner', label: 'Acheteur', width: 170 },
  { key: 'reservePrice', label: 'Prix de réserve', width: 150 },
  { key: 'offerCount', label: "Nombre d'offres", width: 145 },
  { key: 'listingCount', label: 'Tentatives', width: 115 },
  { key: 'procedure', label: 'Procédure', width: 120 },
  { key: 'submittedAt', label: 'Soumis le', width: 130 },
  { key: 'year', label: 'Année', width: 100 },
  { key: 'co2', label: 'CO₂', width: 110 },
  { key: 'energyLabel', label: 'Énergie', width: 140 },
  { key: 'vehicleGenre', label: 'Genre', width: 130 },
  { key: 'fiscalPower', label: 'Puissance fiscale', width: 155 },
  { key: 'bodyType', label: 'Carrosserie', width: 145 },
  { key: 'vin', label: 'VIN', width: 190 },
  { key: 'gearbox', label: 'Boîte de vitesse', width: 150 },
  { key: 'color', label: 'Couleur', width: 120 },
  { key: 'mileage', label: 'Kilométrage', width: 140 },
  { key: 'vrade', label: 'VRADE', width: 130 },
  { key: 'registrationCardAvailable', label: 'Carte grise disponible', width: 190 },
  { key: 'registrationCardMissingReasons', label: 'Motif absence carte grise', width: 210 },
  { key: 'engine', label: 'Moteur', width: 150 },
  { key: 'fuelType', label: 'Carburant', width: 130 },
  { key: 'firstRegistrationDate', label: '1re immatriculation', width: 165 },
  { key: 'registrationCountry', label: "Pays d'immatriculation", width: 180 },
  { key: 'passengerCount', label: 'Places', width: 100 },
  { key: 'doorCount', label: 'Portes', width: 100 },
  { key: 'identificationSheetAvailable', label: "Fiche d'identification", width: 185 },
  { key: 'policeBookNumber', label: 'N° livre de police', width: 165 },
  { key: 'vehicleAddress', label: 'Adresse du véhicule', width: 240 },
  { key: 'vehicleCity', label: 'Ville du véhicule', width: 160 },
  { key: 'vehiclePostalCode', label: 'Code postal véhicule', width: 175 },
  { key: 'description', label: 'Description', width: 260 },
  { key: 'conditionDetails', label: 'État / détails', width: 240 },
  { key: 'photoCount', label: 'Photos', width: 100 },
  { key: 'hasExpertReport', label: "Rapport d'expert", width: 155 },
  { key: 'updatedAt', label: 'Dernière mise à jour', width: 175 },
  { key: 'saleState', label: 'État', width: 175 },
];

const CARD_MISSING_REASON_LABELS: Record<string, string> = {
  declaration_perte: 'Déclaration de perte',
  declaration_vol: 'Déclaration de vol',
  autre: 'Autre',
};

const yesNo = (value?: boolean) => (value === undefined ? '—' : value ? 'Oui' : 'Non');

const DEFAULT_COLUMNS: ColumnKey[] = ['coverPhoto', 'lotNumber', 'brand', 'model', 'registrationNumber', 'seller', 'session', 'offerCount', 'amount', 'saleState'];
const COLUMN_STORAGE_KEY = 'dealsautopro.admin.ventes.columns.v2';

// Colonnes calculées côté serveur : elles n'existent pas sur le dossier véhicule et ne
// peuvent donc pas être filtrées par la même mécanique que les champs du document.
const NON_FILTERABLE: ColumnKey[] = ['coverPhoto', 'amount', 'winner', 'offerCount', 'photoCount', 'hasExpertReport', 'updatedAt'];

type StateCounts = Record<SaleState, number>;

const formatEuros = (value?: number) =>
  value == null ? '—' : `${value.toLocaleString('fr-FR')} €`;

const personName = (person?: DossierSeller) =>
  person?.companyName || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '—';

export default function AdminVentesPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<VehicleSaleRow[]>([]);
  const [counts, setCounts] = useState<StateCounts>({ en_attente: 0, en_enchere: 0, en_cours_vente: 0, vendu: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [draftFilters, setDraftFilters] = useState<Partial<Record<ColumnKey, string>>>({});
  const [appliedFilters, setAppliedFilters] = useState<Partial<Record<ColumnKey, string>>>({});

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [columnsModalOpen, setColumnsModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [offersModal, setOffersModal] = useState<OffersModalData | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');

  const openOffersModal = async (vehicleId: string) => {
    setOffersLoading(true);
    setOffersError('');
    try {
      const response = await apiRequest(`/admin/vehicle-dossiers/${vehicleId}/offers`);
      setOffersModal({ vehicle: response.vehicle, offers: response.offers || [] });
    } catch (error: unknown) {
      setOffersError(error instanceof Error ? error.message : 'Impossible de charger les offres.');
      setOffersModal({ vehicle: { _id: vehicleId }, offers: [] });
    } finally {
      setOffersLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedValue = window.localStorage.getItem(COLUMN_STORAGE_KEY);
        if (storedValue === null) return;
        const storedColumns: unknown = JSON.parse(storedValue);
        if (!Array.isArray(storedColumns)) return;
        const validColumns = TABLE_COLUMNS
          .map((column) => column.key)
          .filter((key) => storedColumns.includes(key));
        setVisibleColumns(validColumns);
      } catch {
        window.localStorage.removeItem(COLUMN_STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((current) => {
      const next = current.includes(key) ? current.filter((column) => column !== key) : [...current, key];
      const ordered = TABLE_COLUMNS.map((column) => column.key).filter((column) => next.includes(column));
      window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(ordered));
      return ordered;
    });
  };

  const resetColumns = () => {
    setVisibleColumns(DEFAULT_COLUMNS);
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(DEFAULT_COLUMNS));
  };

  const selectedColumns = TABLE_COLUMNS.filter((column) => visibleColumns.includes(column.key));
  const tableMinWidth = selectedColumns.reduce((sum, column) => sum + column.width, 0) + 130;

  const renderCell = (row: VehicleSaleRow, key: ColumnKey) => {
    switch (key) {
      case 'coverPhoto': return row.coverPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.coverPhotoUrl} alt={`${row.brand || ''} ${row.model || ''}`.trim() || 'Véhicule'} className="h-14 w-20 rounded-[7px] border border-[#e5e1d7] object-cover" />
      ) : <div className="flex h-14 w-20 items-center justify-center rounded-[7px] bg-[#f1efe9] text-[10px] text-[#8a8270]">Aucune photo</div>;
      case 'brand': return row.brand || '—';
      case 'model': return row.model || '—';
      case 'registrationNumber': return row.registrationNumber || '—';
      case 'seller': return personName(row.seller);
      case 'lotNumber': return row.lotNumber ? `#${row.lotNumber}` : '—';
      case 'saleState': return <Badge style={SALE_STATE_BADGES[row.saleState]} className="py-1.5" />;
      case 'session': return row.session?.name || '—';
      case 'amount': return formatEuros(row.sale?.amount);
      case 'winner': return row.sale?.winner ? personName(row.sale.winner) : '—';
      case 'reservePrice': return formatEuros(row.reservePrice);
      case 'offerCount': return row.saleState === 'en_enchere' ? (row.offerCount ?? 0) : '—';
      case 'listingCount': return row.listingCount ?? 0;
      case 'procedure': return row.procedure || '—';
      case 'submittedAt': return row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('fr-FR') : '—';
      case 'year': return row.year || '—';
      case 'co2': return row.co2 ? `${row.co2} g/km` : '—';
      case 'energyLabel': return row.energyLabel || row.fuelType || '—';
      case 'vehicleGenre': return row.vehicleGenre || '—';
      case 'fiscalPower': return row.fiscalPower || '—';
      case 'bodyType': return row.bodyType || '—';
      case 'vin': return row.vin || '—';
      case 'gearbox': return row.gearbox === 'M' ? 'Manuelle' : row.gearbox === 'A' ? 'Automatique' : row.gearbox || '—';
      case 'color': return row.color || '—';
      case 'mileage': return row.mileage != null ? `${row.mileage.toLocaleString('fr-FR')} km` : '—';
      case 'vrade': return row.vrade || '—';
      case 'registrationCardAvailable': return yesNo(row.registrationCardAvailable);
      case 'registrationCardMissingReasons': return (row.registrationCardMissingReasons || []).map((reason) => CARD_MISSING_REASON_LABELS[reason] || reason).join(', ') || '—';
      case 'engine': return row.engine || '—';
      case 'fuelType': return row.fuelType || '—';
      case 'firstRegistrationDate': return row.firstRegistrationDate || '—';
      case 'registrationCountry': return row.registrationCountry || '—';
      case 'passengerCount': return row.passengerCount || '—';
      case 'doorCount': return row.doorCount || '—';
      case 'identificationSheetAvailable': return yesNo(row.identificationSheetAvailable);
      case 'policeBookNumber': return row.policeBookNumber || '—';
      case 'vehicleAddress': return row.vehicleAddress || '—';
      case 'vehicleCity': return row.vehicleAddressDetails?.city || '—';
      case 'vehiclePostalCode': return row.vehicleAddressDetails?.postalCode || '—';
      case 'description': return row.description || '—';
      case 'conditionDetails': return row.conditionDetails || '—';
      case 'photoCount': return row.photoCount ?? 0;
      case 'hasExpertReport': return yesNo(row.hasExpertReport);
      case 'updatedAt': return row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('fr-FR') : '—';
    }
  };

  const exportCellValue = (row: VehicleSaleRow, key: ColumnKey): string => {
    switch (key) {
      case 'coverPhoto': return row.coverPhotoUrl || '';
      case 'lotNumber': return row.lotNumber ? String(row.lotNumber) : '';
      case 'saleState': return SALE_STATE_BADGES[row.saleState].label;
      case 'session': return row.session?.name || '';
      case 'amount': return row.sale?.amount?.toString() || '';
      case 'winner': return row.sale?.winner ? personName(row.sale.winner) : '';
      case 'reservePrice': return row.reservePrice?.toString() || '';
      case 'offerCount': return row.saleState === 'en_enchere' ? String(row.offerCount ?? 0) : '';
      case 'listingCount': return String(row.listingCount ?? 0);
      case 'seller': return personName(row.seller);
      case 'submittedAt': return row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('fr-FR') : '';
      case 'mileage': return row.mileage?.toString() || '';
      case 'year': return row.year?.toString() || '';
      case 'gearbox': return row.gearbox === 'M' ? 'Manuelle' : row.gearbox === 'A' ? 'Automatique' : row.gearbox || '';
      case 'registrationCardAvailable': return row.registrationCardAvailable === undefined ? '' : row.registrationCardAvailable ? 'Oui' : 'Non';
      case 'co2': return row.co2 || '';
      case 'energyLabel': return row.energyLabel || row.fuelType || '';
      case 'registrationCardMissingReasons': return (row.registrationCardMissingReasons || []).map((reason) => CARD_MISSING_REASON_LABELS[reason] || reason).join(' / ');
      case 'identificationSheetAvailable': return row.identificationSheetAvailable === undefined ? '' : row.identificationSheetAvailable ? 'Oui' : 'Non';
      case 'hasExpertReport': return row.hasExpertReport ? 'Oui' : 'Non';
      case 'photoCount': return String(row.photoCount ?? 0);
      case 'vehicleCity': return row.vehicleAddressDetails?.city || '';
      case 'vehiclePostalCode': return row.vehicleAddressDetails?.postalCode || '';
      case 'updatedAt': return row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('fr-FR') : '';
      default: return (row[key as keyof VehicleSaleRow] as string) || '';
    }
  };

  const buildParams = (targetPage: number, targetLimit: number) => {
    const params = new URLSearchParams({ page: String(targetPage), limit: String(targetLimit) });
    if (Object.keys(appliedFilters).length > 0) params.set('columnFilters', JSON.stringify(appliedFilters));
    return params;
  };

  const exportCsv = async () => {
    if (selectedColumns.length === 0 || exportingCsv) return;
    setExportingCsv(true);
    setError('');
    try {
      const firstResponse = await apiRequest(`/admin/vehicle-dossiers/ventes?${buildParams(1, 100).toString()}`);
      const remainingResponses = firstResponse.totalPages > 1
        ? await Promise.all(Array.from({ length: firstResponse.totalPages - 1 }, (_, index) => apiRequest(`/admin/vehicle-dossiers/ventes?${buildParams(index + 2, 100).toString()}`)))
        : [];
      const allRows: VehicleSaleRow[] = [firstResponse, ...remainingResponses].flatMap((response) => response.vehicles || []);
      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const lines = [
        selectedColumns.map((column) => escapeCsv(column.label)).join(';'),
        ...allRows.map((row) => selectedColumns.map((column) => escapeCsv(exportCellValue(row, column.key))).join(';')),
      ];
      const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ventes-vehicules-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible d'exporter les ventes.");
    } finally {
      setExportingCsv(false);
    }
  };

  const updateDraftFilter = (key: ColumnKey, value: string) => setDraftFilters((current) => ({ ...current, [key]: value }));
  const hasAppliedFilters = Object.values(appliedFilters).some(Boolean);

  const applyTableFilters = () => {
    const cleaned = Object.fromEntries(Object.entries(draftFilters).filter(([, value]) => value?.trim())) as Partial<Record<ColumnKey, string>>;
    setAppliedFilters(cleaned);
    setPage(1);
  };

  const resetTableFilters = () => {
    setDraftFilters({});
    setAppliedFilters({});
    setPage(1);
  };

  const renderFilterInput = (column: TableColumn) => {
    // L'état se pilote par les pastilles du haut : un second filtre dans l'en-tête
    // dupliquerait la commande et pourrait la contredire.
    if (NON_FILTERABLE.includes(column.key)) return <div className="mt-2 h-9" aria-hidden="true" />;

    const value = draftFilters[column.key] || '';
    const className = "mt-2 h-9 w-full rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-[#13243c] focus:border-[#13243c] focus:outline-none";
    if (column.key === 'saleState') return <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}><option value="">Tous</option><option value="en_attente">En attente</option><option value="en_enchere">En enchère</option><option value="en_cours_vente">En cours de vente</option><option value="vendu">Vendu</option></select>;
    if (column.key === 'registrationCardAvailable' || column.key === 'identificationSheetAvailable') return <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}><option value="">Toutes</option><option value="true">Oui</option><option value="false">Non</option></select>;
    if (column.key === 'registrationCardMissingReasons') return <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}><option value="">Tous</option>{Object.entries(CARD_MISSING_REASON_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>;
    if (column.key === 'procedure') return <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}><option value="">Toutes</option>{['VEI', 'VE', 'TNR', 'RIV / VE', 'RIV'].map((procedure) => <option key={procedure} value={procedure}>{procedure}</option>)}</select>;
    const type = column.key === 'submittedAt' ? 'date' : ['year', 'mileage', 'reservePrice', 'listingCount', 'lotNumber'].includes(column.key) ? 'number' : 'text';
    return <input aria-label={`Filtrer par ${column.label}`} type={type} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} placeholder={type === 'text' ? 'Filtrer…' : undefined} className={className} />;
  };

  useEffect(() => {
    const fetchVehicles = async () => {
      setFetching(true);
      try {
        const params = new URLSearchParams();
            if (Object.keys(appliedFilters).length > 0) params.set('columnFilters', JSON.stringify(appliedFilters));
        params.set('page', String(page));
        params.set('limit', '20');

        const res = await apiRequest(`/admin/vehicle-dossiers/ventes?${params.toString()}`);
        setVehicles(res.vehicles || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        if (res.counts) setCounts(res.counts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement des ventes.');
      } finally {
        setLoading(false);
        setFetching(false);
      }
    };

    fetchVehicles();
  }, [appliedFilters, page]);

  if (loading) {
    return (
      <div className="flex-1 w-full px-6 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-20 lg:px-10 lg:pt-10 lg:pb-24 font-sans text-black bg-white">
        <SkeletonRows />
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 max-w-full overflow-x-hidden px-6 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-20 lg:px-10 lg:pt-10 lg:pb-24 font-sans text-black bg-white min-h-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
            Suivi commercial
          </div>
          <h1 className="m-0 font-bold text-[36px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
            Ventes véhicules
          </h1>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={() => setColumnsModalOpen(true)} className="flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#dcd7cb] bg-white px-4 text-[12px] font-bold uppercase text-[#13243c] transition hover:bg-[#f8f7f2]">
            <Columns3 size={16} /> Colonnes
          </button>
          <button type="button" onClick={exportCsv} disabled={exportingCsv || selectedColumns.length === 0} className="btn btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={16} /> {exportingCsv ? 'Export…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="En attente" value={counts.en_attente} bg="#2563eb" labelColor="#bfdbfe" valueColor="#ffffff" />
        <StatCard label="En enchère" value={counts.en_enchere} bg="#16a34a" labelColor="#bbf7d0" valueColor="#ffffff" />
        <StatCard label="En cours de vente" value={counts.en_cours_vente} bg="#ea580c" labelColor="#fed7aa" valueColor="#ffffff" />
        <StatCard label="Vendus" value={counts.vendu} bg="#9333ea" labelColor="#e9d5ff" valueColor="#ffffff" />
      </div>


      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className={`w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-[12px] border border-[#eceadf] bg-white shadow-xs transition-opacity ${fetching ? 'opacity-60' : ''}`}>
        <table className="admin-striped-table w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
          <colgroup>{selectedColumns.map((column) => <col key={column.key} style={{ width: column.width }} />)}<col style={{ width: 190 }} /></colgroup>
          <thead><tr className="border-b border-[#efece3] bg-[#f8f7f2] text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4c5058] align-top">
            {selectedColumns.map((column) => <th key={column.key} className="px-3 py-[14px]"><div className="h-4 whitespace-nowrap">{column.label}</div>{renderFilterInput(column)}</th>)}
            <th className="px-3 py-[14px] text-right">
              <div className="h-4" aria-hidden="true" />
              <div className="mt-2 flex w-full flex-col items-stretch gap-1.5">
                <button type="button" onClick={applyTableFilters} className="btn btn-primary w-full whitespace-nowrap">Rechercher</button>
                {hasAppliedFilters && <button type="button" onClick={resetTableFilters} className="btn btn-secondary">Réinitialiser</button>}
              </div>
            </th>
          </tr></thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr><td colSpan={selectedColumns.length + 1} className="p-10 text-center text-sm font-medium text-[#5a5e66]">Aucun véhicule trouvé.</td></tr>
            ) : vehicles.map((row) => (
              <tr key={row._id} onClick={() => router.push(row.sale ? `/ventes/${row.sale._id}` : `/dossiers/${row._id}`)} className="cursor-pointer border-t border-[#efece3] text-[13px] font-medium leading-snug text-[#1a2230] transition first:border-t-0 hover:bg-[#fcfbf9]">
                {selectedColumns.map((column) => <td key={column.key} className={`px-5 py-4 ${['registrationNumber', 'vin'].includes(column.key) ? 'font-mono' : ''}`}><div className="truncate">{renderCell(row, column.key)}</div></td>)}
                <td className="px-5 py-4 text-right text-[12px] font-semibold whitespace-nowrap">
                  {row.saleState === 'en_enchere' ? (
                    <button type="button" onClick={(event) => { event.stopPropagation(); openOffersModal(row._id); }} className="inline-flex items-center gap-1.5 rounded-[7px] border border-[#d9704f] px-3 py-2 text-[#d9704f] hover:bg-[#fff7f1]">
                      <Eye size={14} /> Voir les offres
                    </button>
                  ) : <span className="text-[#d9704f] hover:underline">{row.sale ? 'Vente →' : 'Dossier →'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between mt-5 text-xs text-[#4c5058]">
          <div>
            {total} résultat{total > 1 ? 's' : ''} — page {page} / {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-[7px] border border-[#dcd7cb] bg-white font-semibold text-[#13243c] hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Précédent
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-[7px] border border-[#dcd7cb] bg-white font-semibold text-[#13243c] hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      {(offersModal || offersLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13243c]/55 p-4 backdrop-blur-sm" onClick={() => { if (!offersLoading) setOffersModal(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="offers-modal-title" className="w-full max-w-[860px] overflow-hidden rounded-[16px] bg-white shadow-[0_26px_70px_rgba(0,0,0,0.3)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#efece3] px-6 py-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3987f]">Offres de la session</div>
                <h2 id="offers-modal-title" className="mt-1 text-2xl font-bold uppercase text-[#13243c]">
                  {offersModal ? [offersModal.vehicle.brand, offersModal.vehicle.model].filter(Boolean).join(' ') || 'Véhicule' : 'Chargement…'}
                </h2>
                {offersModal?.vehicle.session?.name && <p className="mt-1 text-xs text-[#5a5e66]">{offersModal.vehicle.session.name} · Prix de réserve : {formatEuros(offersModal.vehicle.reservePrice)}</p>}
              </div>
              <button type="button" disabled={offersLoading} onClick={() => setOffersModal(null)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dcd7cb] text-[#5a5e66] hover:bg-gray-50 disabled:opacity-40" aria-label="Fermer"><X size={17} /></button>
            </div>
            <div className="max-h-[65vh] overflow-auto">
              {offersLoading ? <div className="p-12 text-center text-sm text-[#5a5e66]">Chargement des offres…</div>
                : offersError ? <div className="m-5 rounded-[9px] bg-red-50 p-4 text-sm text-red-700">{offersError}</div>
                : offersModal?.offers.length === 0 ? <div className="p-12 text-center text-sm text-[#5a5e66]">Aucune offre déposée sur ce véhicule.</div>
                : <table className="w-full min-w-[680px] border-collapse text-left">
                    <thead><tr className="bg-[#f8f7f2] text-[11px] font-bold uppercase text-[#5a5e66]"><th className="px-5 py-3">Acheteur</th><th className="px-5 py-3">Montant</th><th className="px-5 py-3">Dépôt / modification</th><th className="px-5 py-3">Statut</th></tr></thead>
                    <tbody>{offersModal?.offers.map((offer) => <tr key={offer._id} className="border-t border-[#efece3] text-[13px]"><td className="px-5 py-4"><div className="font-bold text-[#13243c]">{personName(offer.buyer)}</div><div className="text-[11px] text-[#5a5e66]">{offer.buyer?.email || '—'}</div></td><td className="px-5 py-4 text-base font-bold text-[#13243c]">{formatEuros(offer.amount)}</td><td className="px-5 py-4 text-[#5a5e66]">{new Date(offer.updatedAt || offer.createdAt).toLocaleString('fr-FR')}{offer.revisions?.length ? ` · ${offer.revisions.length} modification(s)` : ''}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${offer.status === 'active' ? 'bg-[#e9f4ee] text-[#2f6f4f]' : 'bg-[#fdece4] text-[#b91c1c]'}`}>{offer.status === 'active' ? 'Active' : 'Annulée'}</span></td></tr>)}</tbody>
                  </table>}
            </div>
          </div>
        </div>
      )}

      {columnsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13243c]/45 p-4 backdrop-blur-sm" onClick={() => setColumnsModalOpen(false)}>
          <div className="w-full max-w-[680px] overflow-hidden rounded-[16px] bg-white shadow-[0_26px_60px_rgba(0,0,0,0.28)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#efece3] px-6 py-5">
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a3987f]">Personnalisation du tableau</div>
                <h2 className="text-[24px] font-bold uppercase leading-none text-[#13243c] font-['Saira_Condensed',sans-serif]">Choisir les colonnes</h2>
                <p className="mt-2 text-xs text-[#5a5e66]">Sélectionnez les informations à afficher. Votre configuration sera conservée après rechargement.</p>
              </div>
              <button type="button" onClick={() => setColumnsModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#dcd7cb] text-[#5a5e66] hover:bg-gray-50" aria-label="Fermer"><X size={17} /></button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {TABLE_COLUMNS.map((column) => {
                  const selected = visibleColumns.includes(column.key);
                  return (
                    <label key={column.key} className={`flex cursor-pointer items-center gap-3 rounded-[9px] border px-3.5 py-3 text-sm font-semibold transition ${selected ? 'border-[#13243c] bg-[#eef1f5] text-[#13243c]' : 'border-[#e5e1d7] bg-white text-[#5a5e66] hover:bg-[#fbfaf7]'}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleColumn(column.key)} className="h-4 w-4 accent-[#13243c]" />
                      {column.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#efece3] bg-[#fbfaf7] px-6 py-4">
              <span className="text-xs font-semibold text-[#5a5e66]">{visibleColumns.length} colonne{visibleColumns.length > 1 ? 's' : ''} sélectionnée{visibleColumns.length > 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                <button type="button" onClick={resetColumns} className="btn btn-secondary">Valeurs par défaut</button>
                <button type="button" onClick={() => setColumnsModalOpen(false)} className="h-10 rounded-[8px] bg-[#13243c] px-5 text-xs font-bold uppercase text-white hover:bg-[#1a3050]">Terminer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
