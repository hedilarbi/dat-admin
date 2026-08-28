'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import SkeletonRows from '../components/SkeletonRows';
import { Badge, getInscriptionStatusBadge } from '../components/StatusBadge';
import StatCard from '../components/StatCard';

interface UserProfile {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  activityType: string;
  phone: string;
  role: 'admin' | 'vendeur' | 'acheteur';
  status: 'brouillon' | 'soumis' | 'en_attente_validation' | 'refuse' | 'correction_demandee' | 'valide' | 'suspendu' | 'bloque';
  address?: { street: string; city: string; country: string; postalCode: string; };
  createdAt: string;
}

interface UserCounts {
  all: number;
  acheteur: number;
  vendeur: number;
  enAttente: number;
  correction: number;
  valide: number;
  refuse: number;
  roleTotal: number;
  newThisMonth: number;
}

const EMPTY_COUNTS: UserCounts = { all: 0, acheteur: 0, vendeur: 0, enAttente: 0, correction: 0, valide: 0, refuse: 0, roleTotal: 0, newThisMonth: 0 };

const PAGE_LIMIT = 20;

type ColumnKey = 'companyName' | 'activityType' | 'city' | 'email' | 'phone' | 'submittedAt' | 'status';

interface TableColumn {
  key: ColumnKey;
  label: string;
  width: number;
}

const TABLE_COLUMNS: TableColumn[] = [
  { key: 'companyName', label: 'Société', width: 180 },
  { key: 'activityType', label: 'Activité', width: 150 },
  { key: 'city', label: 'Ville', width: 130 },
  { key: 'email', label: 'Email', width: 200 },
  { key: 'phone', label: 'Téléphone', width: 130 },
  { key: 'submittedAt', label: 'Inscrit le', width: 130 },
  { key: 'status', label: 'Statut', width: 150 },
];

interface InscriptionsRoleListProps {
  role: 'acheteur' | 'vendeur';
  title: string;
}

export default function InscriptionsRoleList({ role, title }: InscriptionsRoleListProps) {
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [counts, setCounts] = useState<UserCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [draftFilters, setDraftFilters] = useState<Partial<Record<ColumnKey, string>>>({});
  const [appliedFilters, setAppliedFilters] = useState<Partial<Record<ColumnKey, string>>>({});

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPage(1);
    setDraftFilters({});
    setAppliedFilters({});
  }, [role]);

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
    if (column.key === 'status') {
      return (
        <select aria-label={`Filtrer par ${column.label}`} value={value} onChange={(e) => updateDraftFilter(column.key, e.target.value)} className={className}>
          <option value="">Tous</option>
          <option value="attente">En attente</option>
          <option value="correction">Correction demandée</option>
          <option value="valide">Validé</option>
          <option value="refuse">Refusé</option>
        </select>
      );
    }
    const type = column.key === 'submittedAt' ? 'date' : 'text';
    return (
      <input aria-label={`Filtrer par ${column.label}`} type={type} value={value} onChange={(e) => updateDraftFilter(column.key, e.target.value)} placeholder={type === 'text' ? 'Filtrer…' : undefined} className={className} />
    );
  };

  const renderCell = (row: UserProfile, key: ColumnKey) => {
    switch (key) {
      case 'companyName': return row.companyName || 'Sans nom';
      case 'activityType': return row.activityType || 'Non spécifié';
      case 'city': return row.address?.city || '—';
      case 'email': return row.email || '—';
      case 'phone': return row.phone || '—';
      case 'submittedAt': return new Date(row.createdAt).toLocaleDateString('fr-FR');
      case 'status': return <Badge style={getInscriptionStatusBadge(row.status)} className="py-1.5" />;
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      setFetching(true);
      try {
        const params = new URLSearchParams();
        params.set('role', role);
        if (Object.keys(appliedFilters).length > 0) params.set('columnFilters', JSON.stringify(appliedFilters));
        params.set('page', String(page));
        params.set('limit', String(PAGE_LIMIT));

        const res = await apiRequest(`/admin/users?${params.toString()}`);
        setUsers(res.users);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setCounts(res.counts);
      } catch (err: any) {
        setError(err.message || 'Erreur de chargement des utilisateurs.');
        router.push('/login');
      } finally {
        setLoading(false);
        setFetching(false);
      }
    };

    fetchUsers();
  }, [role, appliedFilters, page, router]);

  const tableMinWidth = TABLE_COLUMNS.reduce((sum, col) => sum + col.width, 0) + 130;

  if (loading) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 font-sans bg-[#fbfaf7]">
        <div className="border border-[#eceadf] bg-white rounded-[12px] overflow-hidden shadow-sm">
          <SkeletonRows />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 font-sans text-black bg-[#fbfaf7]">
      <PageHeader
        eyebrow="Validation des comptes professionnels"
        title={title}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Total utilisateurs" value={counts.roleTotal} bg="#2563eb" labelColor="#bfdbfe" valueColor="#ffffff" />
        <StatCard label="Nouveaux utilisateurs ce mois" value={counts.newThisMonth} bg="#16a34a" labelColor="#bbf7d0" valueColor="#ffffff" />
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className={`w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-[12px] border border-[#eceadf] bg-white shadow-sm transition-opacity ${fetching ? 'opacity-60' : ''}`}>
        <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMinWidth }}>
          <colgroup>
            {TABLE_COLUMNS.map((column) => <col key={column.key} style={{ width: column.width }} />)}
            <col style={{ width: 130 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-[#efece3] bg-[#f8f7f2] text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4c5058] align-top">
              {TABLE_COLUMNS.map((column) => (
                <th key={column.key} className="px-3 py-[14px]">
                  <div className="h-4 whitespace-nowrap">{column.label}</div>
                  {renderFilterInput(column)}
                </th>
              ))}
              <th className="px-3 py-[14px] text-right">
                <div className="h-4" aria-hidden="true" />
                <div className="mt-2 flex w-full flex-col items-stretch gap-1.5">
                  <button type="button" onClick={applyTableFilters} className="h-9 rounded-[7px] bg-[#13243c] px-3 text-[12px] font-bold uppercase text-white hover:bg-[#1a3050] transition">
                    Rechercher
                  </button>
                  {hasAppliedFilters && (
                    <button type="button" onClick={resetTableFilters} className="h-9 rounded-[7px] border border-[#dcd7cb] bg-white px-3 text-[12px] font-bold uppercase text-[#13243c] hover:bg-[#fbfaf7] transition">
                      Réinitialiser
                    </button>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={TABLE_COLUMNS.length + 1} className="p-10 text-center text-sm font-medium text-[#5a5e66]">
                  Aucun dossier d&apos;inscription ne correspond aux critères.
                </td>
              </tr>
            ) : users.map((row) => (
              <tr key={row._id} onClick={() => router.push(`/inscription/${role}/${row._id}`)} className="cursor-pointer border-t border-[#efece3] text-[13px] font-medium leading-snug text-[#1a2230] transition first:border-t-0 hover:bg-[#fcfbf9]">
                {TABLE_COLUMNS.map((column) => (
                  <td key={column.key} className="px-5 py-4">
                    <div className="truncate">{renderCell(row, column.key)}</div>
                  </td>
                ))}
                <td className="px-5 py-4 text-right text-[12px] font-semibold text-[#d9704f] whitespace-nowrap hover:underline">
                  Voir →
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-[7px] border border-[#dcd7cb] bg-white font-semibold text-[#13243c] hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Précédent
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
