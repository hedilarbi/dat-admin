'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import SkeletonRows from '../components/SkeletonRows';
import StatCard from '../components/StatCard';
import FilterPills from '../components/FilterPills';
import { Badge, getVehicleDossierStatusBadge } from '../components/StatusBadge';
import type { VehicleDossier } from '../lib/vehicleDossier';

interface DossierCounts {
  enAttente: number;
  correction: number;
  valide: number;
  refuse: number;
}

const EMPTY_COUNTS: DossierCounts = { enAttente: 0, correction: 0, valide: 0, refuse: 0 };

const STATUS_FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'soumis', label: 'En attente' },
  { value: 'correction_demandee', label: 'Correction demandée' },
  { value: 'valide', label: 'Validés' },
  { value: 'refuse', label: 'Refusés' },
];

const PAGE_LIMIT = 20;

export default function AdminDossiersPage() {
  const router = useRouter();

  const [dossiers, setDossiers] = useState<VehicleDossier[]>([]);
  const [counts, setCounts] = useState<DossierCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  useEffect(() => {
    const fetchDossiers = async () => {
      setFetching(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (debouncedSearch) params.set('search', debouncedSearch);
        params.set('page', String(page));
        params.set('limit', String(PAGE_LIMIT));

        const res = await apiRequest(`/admin/vehicle-dossiers?${params.toString()}`);
        setDossiers(res.dossiers);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setCounts(res.counts);
      } catch (err: any) {
        setError(err.message || 'Erreur de chargement des dossiers.');
      } finally {
        setLoading(false);
        setFetching(false);
      }
    };

    fetchDossiers();
  }, [statusFilter, debouncedSearch, page]);

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
        eyebrow="Validation & Inspection des publications"
        title="Dossiers Véhicules (VHU / Occasions)"
        action={
          <input
            type="text"
            placeholder="Rechercher marque, modèle, VIN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-[280px] h-[42px] border border-[#dcd7cb] rounded-[9px] px-4 text-xs text-[#1a2230] bg-white focus:outline-none focus:ring-1 focus:ring-[#13243c]"
          />
        }
      />

      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-7">
        <StatCard label="En attente" value={counts.enAttente} bg="#faf1e4" labelColor="#b3893f" />
        <StatCard label="Correction demandée" value={counts.correction} bg="#fdece4" labelColor="#d9704f" />
        <StatCard label="Validés" value={counts.valide} bg="#e9f4ee" labelColor="#2f6f4f" />
        <StatCard label="Refusés" value={counts.refuse} bg="#fbeae7" labelColor="#9a3b2f" />
      </div>

      <div className="mb-5">
        <FilterPills
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={handleStatusFilterChange}
          baseClassName="font-bold text-xs px-4 py-2 rounded-full transition"
          activeClassName="bg-[#d9704f] text-white"
          inactiveClassName="bg-white border border-[#e2ddd1] text-[#4c5058] hover:bg-gray-50"
        />
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className={`border border-[#eceadf] bg-white rounded-[12px] overflow-hidden shadow-sm transition-opacity ${fetching ? 'opacity-60' : ''}`}>
        <div className="hidden md:grid grid-cols-6 gap-4 p-[14px_20px] bg-[#f8f7f2] font-semibold text-[11px] uppercase tracking-[0.05em] text-[#8a8270] border-b border-[#efece3]">
          <div className="col-span-2">Véhicule / Vendeur</div>
          <div>VIN</div>
          <div>Prix de réserve</div>
          <div>Soumis le</div>
          <div className="text-right">Statut</div>
        </div>

        {dossiers.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm italic">
            Aucun dossier véhicule ne correspond aux critères.
          </div>
        ) : (
          dossiers.map((dossier) => {
            const cover = dossier.photos.find((p) => p.isCover) || dossier.photos[0];
            const label = [dossier.brand, dossier.model].filter(Boolean).join(' ') || 'Sans nom';

            return (
              <div
                key={dossier._id}
                onClick={() => router.push(`/dossiers/${dossier._id}`)}
                className="grid grid-cols-1 md:grid-cols-6 gap-3 md:gap-4 p-[16px_20px] border-b border-[#efece3] items-center font-medium text-[13px] text-[#1a2230] hover:bg-[#fcfbf9] cursor-pointer transition"
              >
                <div className="col-span-2 flex items-center gap-3">
                  <div className="w-[52px] h-[40px] rounded-[7px] bg-[#13243c] shrink-0 overflow-hidden">
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.processedUrl || cover.originalUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#13243c]">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{dossier.seller?.companyName || 'Vendeur inconnu'}</div>
                  </div>
                </div>

                <div className="text-gray-600 font-mono text-xs">{dossier.vin || '—'}</div>

                <div className="text-gray-600">{dossier.reservePrice ? `${dossier.reservePrice} €` : '—'}</div>

                <div className="text-xs text-gray-500">
                  {dossier.submittedAt ? new Date(dossier.submittedAt).toLocaleDateString('fr-FR') : '—'}
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3">
                  <Badge style={getVehicleDossierStatusBadge(dossier.status)} />
                  <span className="font-bold text-xs text-[#d9704f] hover:underline">Voir →</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between mt-5 text-xs text-[#8a8270]">
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
