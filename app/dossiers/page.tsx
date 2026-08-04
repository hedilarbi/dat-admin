'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import SkeletonRows from '../components/SkeletonRows';
import type { VehicleDossier } from '../lib/vehicleDossier';
import { Badge, getVehicleDossierStatusBadge } from '../components/StatusBadge';

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
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  const statusFilters = [
    { value: 'all', label: `Tous ${counts.enAttente + counts.correction + counts.valide + counts.refuse}` },
    { value: 'soumis', label: `En attente ${counts.enAttente}` },
    { value: 'correction_demandee', label: `Correction demandée ${counts.correction}` },
    { value: 'valide', label: `Validés ${counts.valide}` },
    { value: 'refuse', label: `Rejetés ${counts.refuse}` },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const fetchDossiers = async () => {
      setFetching(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (debouncedSearch) params.set('search', debouncedSearch);
        params.set('page', String(page));
        params.set('limit', '20');

        const res = await apiRequest(`/admin/vehicle-dossiers?${params.toString()}`);
        setDossiers(res.dossiers || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        if (res.counts) setCounts(res.counts);
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
      <div className="flex-1 w-full p-6 sm:p-8 lg:p-10 font-sans text-black bg-white">
        <SkeletonRows />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full p-6 sm:p-8 lg:p-10 font-sans text-black bg-white min-h-full">
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

        <input
          type="text"
          placeholder="Rechercher marque, immat, vendeur…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-[280px] h-[42px] border border-[#dcd7cb] rounded-[9px] px-3.5 font-normal text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c] placeholder-[#9a917d] transition"
        />
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
      <div className={`border border-[#eceadf] rounded-[12px] overflow-hidden bg-white shadow-xs transition-opacity ${fetching ? 'opacity-60' : ''}`}>
        <div className="grid grid-cols-[2fr_1fr_1.1fr_1fr_1fr_1fr_80px] p-[14px_20px] bg-[#f8f7f2] font-semibold text-[11px] uppercase tracking-[0.05em] text-[#4c5058] border-b border-[#efece3]">
          <div>Véhicule</div>
          <div>Immat.</div>
          <div>Vendeur</div>
          <div>Type</div>
          <div>Soumis le</div>
          <div>Statut</div>
          <div></div>
        </div>

        {dossiers.length === 0 ? (
          <div className="p-10 text-center text-[#5a5e66] font-medium text-sm">
            Aucun dossier véhicule trouvé.
          </div>
        ) : (
          dossiers.map((row) => {
            const vehicleName = [row.brand, row.model].filter(Boolean).join(' ') || 'Sans nom';
            const plate = row.registrationNumber || row.vin || '—';
            const sellerName = row.seller?.companyName || (row.seller?.firstName ? `${row.seller.firstName} ${row.seller.lastName || ''}` : 'Vendeur');
            const dateStr = row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('fr-FR') : '—';
            const meta = getVehicleDossierStatusBadge(row.status);

            return (
              <div
                key={row._id}
                onClick={() => router.push(`/dossiers/${row._id}`)}
                className="grid grid-cols-[2fr_1fr_1.1fr_1fr_1fr_1fr_80px] p-[16px_20px] border-t border-[#efece3] first:border-t-0 items-center font-medium text-[13px] leading-snug text-[#1a2230] hover:bg-[#fcfbf9] cursor-pointer transition"
              >
                <div className="font-semibold text-[14px] text-[#13243c] truncate">
                  {vehicleName}
                </div>
                <div className="text-[#5a5e66] font-mono text-[13px] truncate">
                  {plate}
                </div>
                <div className="text-[#5a5e66] truncate">
                  {sellerName}
                </div>
                <div className="text-[#5a5e66] truncate">
                  {row.dossierType || 'Sinistré'}
                </div>
                <div className="text-[#5a5e66] truncate">
                  {dateStr}
                </div>
                <div>
                  <Badge style={meta} className="py-1.5" />
                </div>
                <div className="font-semibold text-[12px] text-[#d9704f] hover:underline text-right">
                  Voir →
                </div>
              </div>
            );
          })
        )}
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
