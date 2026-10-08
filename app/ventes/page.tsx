'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import StatCard from '../components/StatCard';
import SkeletonRows from '../components/SkeletonRows';
import type { DossierSeller } from '../lib/vehicleDossier';
import { stepDisplayNumber } from '../lib/saleSteps';
import { Badge } from '../components/StatusBadge';
import { Download } from 'lucide-react';

/** Statuts d'une vente (Sale.status côté serveur) : tous sont listés, aucun n'est masqué. */
type SaleStatus = 'en_cours' | 'suspendue' | 'cloturee' | 'sans_gagnant' | 'annulee';

const SALE_STATUS_BADGES: Record<SaleStatus, { label: string; color: string; bg: string }> = {
  en_cours: { label: 'En cours', color: '#ffffff', bg: '#f97316' },
  suspendue: { label: 'Décision vendeur requise', color: '#ffffff', bg: '#b45309' },
  cloturee: { label: 'Clôturée', color: '#ffffff', bg: '#16a34a' },
  sans_gagnant: { label: 'Sans gagnant', color: '#ffffff', bg: '#6b7280' },
  annulee: { label: 'Annulée', color: '#ffffff', bg: '#b91c1c' },
};

const SALE_STATUSES = Object.keys(SALE_STATUS_BADGES) as SaleStatus[];

interface SaleRow {
  _id: string;
  status: SaleStatus;
  currentStep: number;
  amount?: number | null;
  reservePrice?: number;
  createdAt: string;
  vehicle: { _id: string; brand?: string; model?: string; registrationNumber?: string; coverPhotoUrl?: string | null } | null;
  session?: { _id: string; name: string; status: string } | null;
  seller?: DossierSeller | null;
  winner?: DossierSeller | null;
}

type ColumnKey = 'coverPhoto' | 'brand' | 'model' | 'registrationNumber' | 'seller' | 'winner' | 'session' | 'amount' | 'currentStep' | 'createdAt' | 'status';

interface TableColumn {
  key: ColumnKey;
  label: string;
  width: number;
}

const TABLE_COLUMNS: TableColumn[] = [
  { key: 'coverPhoto', label: 'Photo', width: 120 },
  { key: 'brand', label: 'Marque', width: 150 },
  { key: 'model', label: 'Modèle', width: 160 },
  { key: 'registrationNumber', label: 'Immat.', width: 130 },
  { key: 'seller', label: 'Vendeur', width: 170 },
  { key: 'winner', label: 'Acheteur', width: 170 },
  { key: 'session', label: 'Session', width: 160 },
  { key: 'amount', label: 'Montant vente', width: 145 },
  { key: 'currentStep', label: 'Étape', width: 120 },
  { key: 'createdAt', label: 'Créée le', width: 140 },
  { key: 'status', label: 'Statut', width: 200 },
];

// Le montant est calculé et la photo n'est pas une donnée : aucun filtre n'a de sens dessus.
const NON_FILTERABLE: ColumnKey[] = ['coverPhoto', 'amount'];

const formatEuros = (value?: number | null) =>
  value == null ? '—' : `${value.toLocaleString('fr-FR')} €`;

const personName = (person?: DossierSeller | null) =>
  person?.companyName || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '—';

// L'étape n'a de sens que pour une vente dont la procédure d'achat est en cours.
const stepLabel = (row: SaleRow) => (row.status === 'en_cours' ? stepDisplayNumber(row.currentStep) : '—');

type StatusCounts = Record<SaleStatus, number>;

export default function AdminVentesPage() {
  const router = useRouter();

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({ en_cours: 0, suspendue: 0, cloturee: 0, sans_gagnant: 0, annulee: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [draftFilters, setDraftFilters] = useState<Partial<Record<ColumnKey, string>>>({});
  const [appliedFilters, setAppliedFilters] = useState<Partial<Record<ColumnKey, string>>>({});

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);

  const tableMinWidth = TABLE_COLUMNS.reduce((sum, column) => sum + column.width, 0) + 130;

  const renderCell = (row: SaleRow, key: ColumnKey) => {
    switch (key) {
      case 'coverPhoto': return row.vehicle?.coverPhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.vehicle.coverPhotoUrl} alt={`${row.vehicle.brand || ''} ${row.vehicle.model || ''}`.trim() || 'Véhicule'} className="h-14 w-20 rounded-[7px] border border-[#e5e1d7] object-cover" />
      ) : <div className="flex h-14 w-20 items-center justify-center rounded-[7px] bg-[#f1efe9] text-[10px] text-[#8a8270]">Aucune photo</div>;
      case 'brand': return row.vehicle?.brand || '—';
      case 'model': return row.vehicle?.model || '—';
      case 'registrationNumber': return row.vehicle?.registrationNumber || '—';
      case 'seller': return personName(row.seller);
      case 'winner': return personName(row.winner);
      case 'session': return row.session?.name || '—';
      case 'amount': return formatEuros(row.amount);
      case 'currentStep': return stepLabel(row);
      case 'createdAt': return new Date(row.createdAt).toLocaleDateString('fr-FR');
      case 'status': return <Badge style={SALE_STATUS_BADGES[row.status]} className="py-1.5" />;
    }
  };

  const exportCellValue = (row: SaleRow, key: ColumnKey): string => {
    switch (key) {
      case 'coverPhoto': return row.vehicle?.coverPhotoUrl || '';
      case 'amount': return row.amount?.toString() || '';
      case 'currentStep': return row.status === 'en_cours' ? stepDisplayNumber(row.currentStep) : '';
      case 'createdAt': return new Date(row.createdAt).toLocaleDateString('fr-FR');
      case 'status': return SALE_STATUS_BADGES[row.status]?.label || row.status;
      case 'seller': return personName(row.seller);
      case 'winner': return row.winner ? personName(row.winner) : '';
      case 'session': return row.session?.name || '';
      default: return (row.vehicle?.[key as 'brand' | 'model' | 'registrationNumber'] as string) || '';
    }
  };

  const buildParams = (targetPage: number, targetLimit: number) => {
    const params = new URLSearchParams({ page: String(targetPage), limit: String(targetLimit) });
    if (Object.keys(appliedFilters).length > 0) params.set('columnFilters', JSON.stringify(appliedFilters));
    return params;
  };

  const exportCsv = async () => {
    if (exportingCsv) return;
    setExportingCsv(true);
    setError('');
    try {
      const firstResponse = await apiRequest(`/admin/sales?${buildParams(1, 100).toString()}`);
      const remainingResponses = firstResponse.totalPages > 1
        ? await Promise.all(Array.from({ length: firstResponse.totalPages - 1 }, (_, index) => apiRequest(`/admin/sales?${buildParams(index + 2, 100).toString()}`)))
        : [];
      const allRows: SaleRow[] = [firstResponse, ...remainingResponses].flatMap((response) => response.sales || []);
      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
      const lines = [
        TABLE_COLUMNS.map((column) => escapeCsv(column.label)).join(';'),
        ...allRows.map((row) => TABLE_COLUMNS.map((column) => escapeCsv(exportCellValue(row, column.key))).join(';')),
      ];
      const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ventes-${new Date().toISOString().slice(0, 10)}.csv`;
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
    if (NON_FILTERABLE.includes(column.key)) return <div className="mt-2 h-9" aria-hidden="true" />;

    const value = draftFilters[column.key] || '';
    const className = "mt-2 h-9 w-full rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-[12px] font-normal normal-case tracking-normal text-[#13243c] focus:border-[#13243c] focus:outline-none";
    if (column.key === 'status') return (
      <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}>
        <option value="">Tous</option>
        {SALE_STATUSES.map((status) => <option key={status} value={status}>{SALE_STATUS_BADGES[status].label}</option>)}
      </select>
    );
    if (column.key === 'currentStep') return (
      <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} className={className}>
        <option value="">Toutes</option>
        {[1, 2, 3, 4, 5].map((step) => <option key={step} value={step}>{stepDisplayNumber(step)}</option>)}
      </select>
    );
    const type = column.key === 'createdAt' ? 'date' : 'text';
    return <input aria-label={`Filtrer par ${column.label}`} type={type} value={value} onChange={(event) => updateDraftFilter(column.key, event.target.value)} placeholder={type === 'text' ? 'Filtrer…' : undefined} className={className} />;
  };

  useEffect(() => {
    const fetchSales = async () => {
      setFetching(true);
      try {
        const res = await apiRequest(`/admin/sales?${buildParams(page, 20).toString()}`);
        setSales(res.sales || []);
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

    fetchSales();
    // buildParams ne dépend que des filtres appliqués et de la page, déjà listés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            Ventes
          </h1>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" onClick={exportCsv} disabled={exportingCsv} className="btn btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={16} /> {exportingCsv ? 'Export…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="En cours" value={counts.en_cours} bg="#ea580c" labelColor="#fed7aa" valueColor="#ffffff" />
        <StatCard label="Décision vendeur requise" value={counts.suspendue} bg="#b45309" labelColor="#fef3c7" valueColor="#ffffff" />
        <StatCard label="Clôturées" value={counts.cloturee} bg="#16a34a" labelColor="#bbf7d0" valueColor="#ffffff" />
        <StatCard label="Sans gagnant" value={counts.sans_gagnant} bg="#6b7280" labelColor="#e5e7eb" valueColor="#ffffff" />
        <StatCard label="Annulées" value={counts.annulee} bg="#b91c1c" labelColor="#fecaca" valueColor="#ffffff" />
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className={`w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-[12px] border border-[#eceadf] bg-white shadow-xs transition-opacity ${fetching ? 'opacity-60' : ''}`}>
        <table className="admin-striped-table w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
          <colgroup>{TABLE_COLUMNS.map((column) => <col key={column.key} style={{ width: column.width }} />)}<col style={{ width: 130 }} /></colgroup>
          <thead><tr className="border-b border-[#efece3] bg-[#f8f7f2] text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4c5058] align-top">
            {TABLE_COLUMNS.map((column) => <th key={column.key} className="px-3 py-[14px]"><div className="h-4 whitespace-nowrap">{column.label}</div>{renderFilterInput(column)}</th>)}
            <th className="px-3 py-[14px] text-right">
              <div className="h-4" aria-hidden="true" />
              <div className="mt-2 flex w-full flex-col items-stretch gap-1.5">
                <button type="button" onClick={applyTableFilters} className="btn btn-primary w-full whitespace-nowrap">Rechercher</button>
                {hasAppliedFilters && <button type="button" onClick={resetTableFilters} className="btn btn-secondary">Réinitialiser</button>}
              </div>
            </th>
          </tr></thead>
          <tbody>
            {sales.length === 0 ? (
              <tr><td colSpan={TABLE_COLUMNS.length + 1} className="p-10 text-center text-sm font-medium text-[#5a5e66]">Aucune vente trouvée.</td></tr>
            ) : sales.map((row) => (
              <tr key={row._id} onClick={() => router.push(`/ventes/${row._id}`)} className="cursor-pointer border-t border-[#efece3] text-[13px] font-medium leading-snug text-[#1a2230] transition first:border-t-0 hover:bg-[#fcfbf9]">
                {TABLE_COLUMNS.map((column) => <td key={column.key} className={`px-5 py-4 ${column.key === 'registrationNumber' ? 'font-mono' : ''}`}><div className="truncate">{renderCell(row, column.key)}</div></td>)}
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
    </div>
  );
}
