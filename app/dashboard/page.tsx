'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '../api';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import SkeletonRows from '../components/SkeletonRows';
import { Badge } from '../components/StatusBadge';
import { AlertTriangle } from 'lucide-react';
import type { DossierSeller } from '../lib/vehicleDossier';

type SaleState = 'en_attente' | 'en_enchere' | 'en_cours_vente' | 'vendu';

const SALE_STATE_BADGES: Record<SaleState, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#ffffff', bg: '#6b7280' },
  en_enchere: { label: 'En enchère', color: '#ffffff', bg: '#2563eb' },
  en_cours_vente: { label: 'En cours de vente', color: '#ffffff', bg: '#f97316' },
  vendu: { label: 'Vendu', color: '#ffffff', bg: '#16a34a' },
};

interface MaxedOutVehicle {
  _id: string;
  brand?: string;
  model?: string;
  registrationNumber?: string;
  year?: number;
  mileage?: number;
  reservePrice?: number;
  listingCount: number;
  lotNumber?: number | null;
  seller?: DossierSeller;
  saleState: SaleState;
  session: { _id: string; name: string; status: string } | null;
}

const personName = (person?: DossierSeller) =>
  person?.companyName || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '—';

export default function AdminDashboardPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState<MaxedOutVehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMaxedOut = async () => {
      try {
        const res = await apiRequest('/admin/vehicle-dossiers/tentatives-max?limit=20');
        setVehicles(res.vehicles || []);
        setTotal(res.total || 0);
        setThreshold(res.threshold || 0);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement des véhicules.');
      } finally {
        setLoading(false);
      }
    };

    fetchMaxedOut();
  }, []);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 font-sans text-black bg-[#fbfaf7]">
      <PageHeader eyebrow="Vue d'ensemble" title="Tableau de bord" />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <section className="rounded-[12px] border border-[#eceadf] bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-[#efece3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#faf1e4] text-[#b3893f]">
              <AlertTriangle size={17} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[#13243c]">Tentatives de mise en vente épuisées</h2>
              <p className="mt-0.5 text-[12px] leading-snug text-[#5a5e66]">
                {threshold > 0
                  ? <>Véhicules publiés <strong>{threshold} fois ou plus</strong> sans être vendus. La limite n&apos;empêche pas de les republier : elle signale qu&apos;une décision est attendue.</>
                  : 'Véhicules ayant atteint la limite de mises en vente.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
            <div className="rounded-[9px] bg-[#f8f7f2] px-4 py-2 text-center">
              <div className="text-[20px] font-bold leading-none text-[#13243c]">{loading ? '—' : total}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8a8270]">véhicule{total > 1 ? 's' : ''}</div>
            </div>
            <Link href="/configuration/general" className="text-[11px] font-bold uppercase text-[#d9704f] hover:underline">
              Régler la limite
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="p-5"><SkeletonRows /></div>
        ) : vehicles.length === 0 ? (
          <div className="p-10 text-center text-sm font-medium text-[#5a5e66]">
            Aucun véhicule n&apos;a atteint la limite de {threshold} mise{threshold > 1 ? 's' : ''} en vente.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 880 }}>
              <thead>
                <tr className="border-b border-[#efece3] bg-[#f8f7f2] text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4c5058]">
                  <th className="px-5 py-3">Véhicule</th>
                  <th className="px-5 py-3">Immat.</th>
                  <th className="px-5 py-3">Vendeur</th>
                  <th className="px-5 py-3">Prix de réserve</th>
                  <th className="px-5 py-3">État</th>
                  <th className="px-5 py-3 text-center">Tentatives</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((row) => (
                  <tr
                    key={row._id}
                    onClick={() => router.push(`/dossiers/${row._id}`)}
                    className="cursor-pointer border-t border-[#efece3] text-[13px] font-medium text-[#1a2230] transition first:border-t-0 hover:bg-[#fcfbf9]"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[#13243c]">
                        {[row.brand, row.model].filter(Boolean).join(' ') || '—'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#5a5e66]">
                        {[row.year, row.mileage != null ? `${row.mileage.toLocaleString('fr-FR')} km` : null]
                          .filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono">{row.registrationNumber || '—'}</td>
                    <td className="px-5 py-4">{personName(row.seller)}</td>
                    <td className="px-5 py-4">{row.reservePrice != null ? `${row.reservePrice.toLocaleString('fr-FR')} €` : '—'}</td>
                    <td className="px-5 py-4"><Badge style={SALE_STATE_BADGES[row.saleState]} className="py-1.5" /></td>
                    <td className="px-5 py-4 text-center">
                      {/* Au-delà du seuil, le dépassement mérite d'être vu au premier coup d'œil */}
                      <span className={`inline-flex min-w-[34px] justify-center rounded-full px-2.5 py-1 text-[12px] font-bold ${
                        row.listingCount > threshold ? 'bg-[#fdece4] text-[#b91c1c]' : 'bg-[#faf1e4] text-[#b3893f]'
                      }`}>
                        {row.listingCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-[12px] font-semibold whitespace-nowrap text-[#d9704f] hover:underline">Voir →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > vehicles.length && (
          <div className="border-t border-[#efece3] px-5 py-3 text-center text-[12px] text-[#5a5e66]">
            {vehicles.length} véhicule(s) affiché(s) sur {total} —{' '}
            <Link href="/ventes" className="font-semibold text-[#d9704f] hover:underline">voir toutes les ventes</Link>
          </div>
        )}
      </section>
    </div>
  );
}
