'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import SkeletonRows from '../components/SkeletonRows';
import type { VehicleDossier } from '../lib/vehicleDossier';
import { Badge, getVehicleDossierStatusBadge } from '../components/StatusBadge';
import { Columns3, Download, X } from 'lucide-react';

type ColumnKey =
  | 'brand' | 'model' | 'registrationNumber' | 'seller' | 'submittedAt' | 'status'
  | 'year' | 'co2' | 'energyLabel' | 'vehicleGenre' | 'fiscalPower' | 'bodyType'
  | 'vin' | 'gearbox' | 'color' | 'mileage' | 'vrade' | 'procedure' | 'registrationCardAvailable';

interface TableColumn {
  key: ColumnKey;
  label: string;
  width: number;
}

const TABLE_COLUMNS: TableColumn[] = [
  { key: 'brand', label: 'Marque', width: 150 },
  { key: 'model', label: 'Modèle', width: 160 },
  { key: 'registrationNumber', label: 'Immat.', width: 130 },
  { key: 'seller', label: 'Vendeur', width: 170 },
  { key: 'procedure', label: 'Procédure', width: 120 },
  { key: 'submittedAt', label: 'Soumis le', width: 130 },
  { key: 'status', label: 'Statut', width: 165 },
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
];

const DEFAULT_COLUMNS: ColumnKey[] = ['brand', 'model', 'registrationNumber', 'seller', 'procedure', 'submittedAt', 'status'];
const COLUMN_STORAGE_KEY = 'dealsautopro.admin.dossiers.columns';

interface DossierCounts {
  enAttente: number;
  correction: number;
  valide: number;
  refuse: number;
}

export default function AdminDossiersPage() {
  const router = useRouter();

  const [dossiers, setDossiers] = useState<VehicleDossier[]>([]);
  const [counts, setCounts] = useState<DossierCounts>({ enAttente: 0, correction: 0, valide: 0, refuse: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [draftFilters, setDraftFilters] = useState<Partial<Record<ColumnKey, string>>>({});
  const [appliedFilters, setAppliedFilters] = useState<Partial<Record<ColumnKey, string>>>({});

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [columnsModalOpen, setColumnsModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [exportingCsv, setExportingCsv] = useState(false);

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

  const statusFilters = [
    { value: 'all', label: `Tous ${counts.enAttente + counts.correction + counts.valide + counts.refuse}` },
    { value: 'soumis', label: `En attente ${counts.enAttente}` },
    { value: 'correction_demandee', label: `Correction demandée ${counts.correction}` },
    { value: 'valide', label: `Validés ${counts.valide}` },
    { value: 'refuse', label: `Rejetés ${counts.refuse}` },
  ];

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

  const renderCell = (row: VehicleDossier, key: ColumnKey) => {
    const sellerName = row.seller?.companyName || (row.seller?.firstName ? `${row.seller.firstName} ${row.seller.lastName || ''}` : 'Vendeur');
    switch (key) {
      case 'brand': return row.brand || '—';
      case 'model': return row.model || '—';
      case 'registrationNumber': return row.registrationNumber || '—';
      case 'seller': return sellerName;
      case 'procedure': return row.procedure || '—';
      case 'submittedAt': return row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('fr-FR') : '—';
      case 'status': return <Badge style={getVehicleDossierStatusBadge(row.status)} className="py-1.5" />;
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
      case 'registrationCardAvailable': return row.registrationCardAvailable === undefined ? '—' : row.registrationCardAvailable ? 'Oui' : 'Non';
    }
  };

  const exportCellValue = (row: VehicleDossier, key: ColumnKey): string => {
    const sellerName = row.seller?.companyName || [row.seller?.firstName, row.seller?.lastName].filter(Boolean).join(' ') || 'Vendeur';
    switch (key) {
      case 'brand': return row.brand || '';
      case 'model': return row.model || '';
      case 'registrationNumber': return row.registrationNumber || '';
      case 'seller': return sellerName;
      case 'procedure': return row.procedure || '';
      case 'submittedAt': return row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('fr-FR') : '';
      case 'status': return getVehicleDossierStatusBadge(row.status).label;
      case 'year': return row.year?.toString() || '';
      case 'co2': return row.co2 || '';
      case 'energyLabel': return row.energyLabel || row.fuelType || '';
      case 'vehicleGenre': return row.vehicleGenre || '';
      case 'fiscalPower': return row.fiscalPower || '';
      case 'bodyType': return row.bodyType || '';
      case 'vin': return row.vin || '';
      case 'gearbox': return row.gearbox === 'M' ? 'Manuelle' : row.gearbox === 'A' ? 'Automatique' : row.gearbox || '';
      case 'color': return row.color || '';
      case 'mileage': return row.mileage?.toString() || '';
      case 'vrade': return row.vrade || '';
      case 'registrationCardAvailable': return row.registrationCardAvailable === undefined ? '' : row.registrationCardAvailable ? 'Oui' : 'Non';
    }
  };

  const exportCsv = async () => {
    if (selectedColumns.length === 0 || exportingCsv) return;
    setExportingCsv(true);
    setError('');
    try {
      const buildParams = (exportPage: number) => {
        const params = new URLSearchParams({ page: String(exportPage), limit: '100' });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (Object.keys(appliedFilters).length > 0) params.set('columnFilters', JSON.stringify(appliedFilters));
        return params;
      };
      const firstResponse = await apiRequest(`/admin/vehicle-dossiers?${buildParams(1).toString()}`);
      const remainingResponses = firstResponse.totalPages > 1
        ? await Promise.all(Array.from({ length: firstResponse.totalPages - 1 }, (_, index) => apiRequest(`/admin/vehicle-dossiers?${buildParams(index + 2).toString()}`)))
        : [];
      const allDossiers: VehicleDossier[] = [firstResponse, ...remainingResponses].flatMap((response) => response.dossiers || []);
      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const lines = [
        selectedColumns.map((column) => escapeCsv(column.label)).join(';'),
        ...allDossiers.map((dossier) => selectedColumns.map((column) => escapeCsv(exportCellValue(dossier, column.key))).join(';')),
      ];
      const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dossiers-vehicules-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible d'exporter les dossiers.");
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
    const value = draftFilters[column.key] || '';
    const className = "mt-2 h-9 w-full rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-[#13243c] focus:border-[#13243c] focus:outline-none";
    if (column.key === 'status') return <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}><option value="">Tous</option><option value="soumis">En attente</option><option value="correction_demandee">Correction demandée</option><option value="valide">Validé</option><option value="refuse">Rejeté</option></select>;
    if (column.key === 'registrationCardAvailable') return <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}><option value="">Toutes</option><option value="true">Oui</option><option value="false">Non</option></select>;
    if (column.key === 'procedure') return <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}><option value="">Toutes</option>{['VEI', 'VE', 'TNR', 'RIV / VE', 'RIV'].map((procedure) => <option key={procedure} value={procedure}>{procedure}</option>)}</select>;
    const type = column.key === 'submittedAt' ? 'date' : ['year', 'mileage'].includes(column.key) ? 'number' : 'text';
    return <input aria-label={`Filtrer par ${column.label}`} type={type} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} placeholder={type === 'text' ? 'Filtrer…' : undefined} className={className} />;
  };

  useEffect(() => {
    const fetchDossiers = async () => {
      setFetching(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (Object.keys(appliedFilters).length > 0) params.set('columnFilters', JSON.stringify(appliedFilters));
        params.set('page', String(page));
        params.set('limit', '20');

        const res = await apiRequest(`/admin/vehicle-dossiers?${params.toString()}`);
        setDossiers(res.dossiers || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        if (res.counts) setCounts(res.counts);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement des dossiers.');
      } finally {
        setLoading(false);
        setFetching(false);
      }
    };

    fetchDossiers();
  }, [statusFilter, appliedFilters, page]);

  if (loading) {
    return (
      <div className="flex-1 w-full px-6 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-20 lg:px-10 lg:pt-10 lg:pb-24 font-sans text-black bg-white">
        <SkeletonRows />
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 max-w-full overflow-x-hidden px-6 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-20 lg:px-10 lg:pt-10 lg:pb-24 font-sans text-black bg-white min-h-full">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
            Validation des annonces
          </div>
          <h1 className="m-0 font-bold text-[36px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
            Dossiers véhicules
          </h1>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={() => setColumnsModalOpen(true)} className="flex h-[42px] items-center justify-center gap-2 rounded-[9px] border border-[#dcd7cb] bg-white px-4 text-[12px] font-bold uppercase text-[#13243c] transition hover:bg-[#f8f7f2]">
            <Columns3 size={16} /> Colonnes
          </button>
          <button type="button" onClick={exportCsv} disabled={exportingCsv || selectedColumns.length === 0} className="flex h-[42px] items-center justify-center gap-2 rounded-[9px] bg-[#13243c] px-4 text-[12px] font-bold uppercase text-white transition hover:bg-[#1a3050] disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={16} /> {exportingCsv ? 'Export…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2.5 mb-4.5 overflow-x-auto pb-1">
        {statusFilters.map((f) => {
          const isActive = statusFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`px-4 py-2 rounded-full font-semibold text-[12px] leading-none transition-all ${
                isActive
                  ? 'bg-[#d9704f] text-white font-bold'
                  : 'bg-white border border-[#e2ddd1] text-[#4c5058] hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {/* Table */}
      <div className={`w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-[12px] border border-[#eceadf] bg-white shadow-xs transition-opacity ${fetching ? 'opacity-60' : ''}`}>
        <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
          <colgroup>{selectedColumns.map((column) => <col key={column.key} style={{ width: column.width }} />)}<col style={{ width: 130 }} /></colgroup>
          <thead><tr className="border-b border-[#efece3] bg-[#f8f7f2] text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4c5058] align-top">
            {selectedColumns.map((column) => <th key={column.key} className="px-3 py-[14px]"><div className="h-4 whitespace-nowrap">{column.label}</div>{renderFilterInput(column)}</th>)}
            <th className="px-3 py-[14px] text-right">
              <div className="h-4" aria-hidden="true" />
              <div className="mt-2 flex w-full flex-col items-stretch gap-1.5">
                <button type="button" onClick={applyTableFilters} className="h-9 w-full whitespace-nowrap rounded-[7px] bg-[#13243c] px-2 text-[10px] font-bold uppercase tracking-normal text-white hover:bg-[#1a3050]">Rechercher</button>
                {hasAppliedFilters && <button type="button" onClick={resetTableFilters} className="h-8 rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-[9px] font-bold uppercase tracking-normal text-[#13243c] hover:bg-gray-50">Réinitialiser</button>}
              </div>
            </th>
          </tr></thead>
          <tbody>
            {dossiers.length === 0 ? (
              <tr><td colSpan={selectedColumns.length + 1} className="p-10 text-center text-sm font-medium text-[#5a5e66]">Aucun dossier véhicule trouvé.</td></tr>
            ) : dossiers.map((row) => (
              <tr key={row._id} onClick={() => router.push(`/dossiers/${row._id}`)} className="cursor-pointer border-t border-[#efece3] text-[13px] font-medium leading-snug text-[#1a2230] transition first:border-t-0 hover:bg-[#fcfbf9]">
                {selectedColumns.map((column) => <td key={column.key} className={`px-5 py-4 ${['registrationNumber', 'vin'].includes(column.key) ? 'font-mono' : ''}`}><div className="truncate">{renderCell(row, column.key)}</div></td>)}
                <td className="px-5 py-4 text-right text-[12px] font-semibold text-[#d9704f] whitespace-nowrap hover:underline">Voir →</td>
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
                <button type="button" onClick={resetColumns} className="h-10 rounded-[8px] border border-[#dcd7cb] bg-white px-4 text-xs font-bold uppercase text-[#13243c] hover:bg-gray-50">Valeurs par défaut</button>
                <button type="button" onClick={() => setColumnsModalOpen(false)} className="h-10 rounded-[8px] bg-[#13243c] px-5 text-xs font-bold uppercase text-white hover:bg-[#1a3050]">Terminer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
