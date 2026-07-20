'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import SkeletonRows from '../components/SkeletonRows';
import StatCard from '../components/StatCard';
import FilterPills from '../components/FilterPills';
import { Badge, getInscriptionStatusBadge } from '../components/StatusBadge';

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
}

const EMPTY_COUNTS: UserCounts = { all: 0, acheteur: 0, vendeur: 0, enAttente: 0, correction: 0, valide: 0, refuse: 0 };

const ROLE_FILTERS: Array<{ value: 'all' | 'acheteur' | 'vendeur'; label: string; }> = [
  { value: 'all', label: 'Tous les rôles' },
  { value: 'acheteur', label: 'Acheteurs' },
  { value: 'vendeur', label: 'Vendeurs' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'attente', label: 'En attente' },
  { value: 'correction', label: 'Correction demandée' },
  { value: 'valide', label: 'Validées' },
  { value: 'refuse', label: 'Refusées' },
];

const PAGE_LIMIT = 20;

export default function InscriptionsPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [counts, setCounts] = useState<UserCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'acheteur' | 'vendeur'>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  // Debounce the free-text search before it hits the API, resetting back to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(userSearch.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleRoleFilterChange = (value: 'all' | 'acheteur' | 'vendeur') => {
    setUserRoleFilter(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setUserStatusFilter(value);
    setPage(1);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      setFetching(true);
      try {
        const params = new URLSearchParams();
        if (userRoleFilter !== 'all') params.set('role', userRoleFilter);
        if (userStatusFilter !== 'all') params.set('status', userStatusFilter);
        if (debouncedSearch) params.set('search', debouncedSearch);
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
  }, [userRoleFilter, userStatusFilter, debouncedSearch, page, router]);

  if (loading) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 font-sans bg-[#fbfaf7]">
        <div className="border border-[#eceadf] bg-white rounded-[12px] overflow-hidden shadow-sm">
          <SkeletonRows />
        </div>
      </div>
    );
  }

  const roleFilterOptions = ROLE_FILTERS.map(opt => ({
    ...opt,
    label: `${opt.label} (${opt.value === 'all' ? counts.all : counts[opt.value]})`,
  }));

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 font-sans text-black bg-[#fbfaf7]">
      <PageHeader
        eyebrow="Validation des comptes professionnels"
        title={`Inscriptions ${userRoleFilter === 'all' ? 'acheteurs & vendeurs' : userRoleFilter + 's'}`}
        action={
          <input
            type="text"
            placeholder="Rechercher société, email, responsable…"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="w-full sm:w-[280px] h-[42px] border border-[#dcd7cb] rounded-[9px] px-4 text-xs text-[#1a2230] bg-white focus:outline-none focus:ring-1 focus:ring-[#13243c]"
          />
        }
      />

      <div className="mb-6">
        <FilterPills options={roleFilterOptions} value={userRoleFilter} onChange={handleRoleFilterChange} />
      </div>

      {/* Counter Stats Grid */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <StatCard label="En attente" value={counts.enAttente} bg="#faf1e4" labelColor="#b3893f" />
        <StatCard label="Correction demandée" value={counts.correction} bg="#fdece4" labelColor="#d9704f" />
        <StatCard label="Validées total" value={counts.valide} bg="#e9f4ee" labelColor="#2f6f4f" />
        <StatCard label="Refusées / Suspendus" value={counts.refuse} bg="#fbeae7" labelColor="#9a3b2f" />
      </div>

      <div className="mb-5">
        <FilterPills
          options={STATUS_FILTERS}
          value={userStatusFilter}
          onChange={handleStatusFilterChange}
          baseClassName="font-bold text-xs px-4 py-2 rounded-full transition"
          activeClassName="bg-[#d9704f] text-white"
          inactiveClassName="bg-white border border-[#e2ddd1] text-[#4c5058] hover:bg-gray-50"
        />
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {/* Table Box */}
      <div className={`border border-[#eceadf] bg-white rounded-[12px] overflow-hidden shadow-sm transition-opacity ${fetching ? 'opacity-60' : ''}`}>
        <div className="hidden md:grid grid-cols-6 gap-4 p-[14px_20px] bg-[#f8f7f2] font-semibold text-[11px] uppercase tracking-[0.05em] text-[#8a8270] border-b border-[#efece3]">
          <div className="col-span-2">Société / Rôle</div>
          <div>Activité / Ville</div>
          <div>Contact</div>
          <div>Soumis le</div>
          <div className="text-right">Statut</div>
        </div>

        {users.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm italic">
            Aucun dossier d&apos;inscription ne correspond aux critères.
          </div>
        ) : (
          users.map(row => (
            <div
              key={row._id}
              onClick={() => router.push(`/inscriptions/${row._id}`)}
              className="grid grid-cols-1 md:grid-cols-6 gap-3 md:gap-4 p-[16px_20px] border-b border-[#efece3] items-center font-medium text-[13px] text-[#1a2230] hover:bg-[#fcfbf9] cursor-pointer transition"
            >
              <div className="col-span-2">
                <div className="font-bold text-sm text-[#13243c] flex items-center gap-2">
                  {row.companyName || 'Sans nom'}
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">
                    {row.role}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{row.firstName} {row.lastName}</div>
              </div>

              <div className="text-gray-600">
                <div className="font-medium">{row.activityType || 'Non spécifié'}</div>
                <div className="text-xs text-gray-400">{row.address?.city || 'Ville inconnue'}</div>
              </div>

              <div className="text-xs text-gray-600 truncate">
                <div>{row.email}</div>
                <div className="text-gray-400">{row.phone}</div>
              </div>

              <div className="text-xs text-gray-500">
                {new Date(row.createdAt).toLocaleDateString('fr-FR')}
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3">
                <Badge style={getInscriptionStatusBadge(row.status)} />
                <span className="font-bold text-xs text-[#d9704f] hover:underline">Voir →</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-5 text-xs text-[#8a8270]">
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
