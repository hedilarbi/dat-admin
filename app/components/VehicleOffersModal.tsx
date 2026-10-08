'use client';

import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { apiRequest } from '../api';
import type { DossierSeller } from '../lib/vehicleDossier';

type HistoryEventType = 'depot' | 'modification' | 'annulation';

interface OfferHistoryEvent {
  type: HistoryEventType;
  amount: number;
  at: string;
}

interface VehicleOffer {
  _id: string;
  amount: number;
  status: 'active' | 'annulee';
  createdAt: string;
  updatedAt: string;
  amountUpdatedAt?: string;
  buyer?: DossierSeller & { phone?: string; role?: string; status?: string };
  rank?: number | null;
  attributionStatus?: string | null;
  discardReason?: string | null;
  isWinningOffer?: boolean;
  isCurrentWinner?: boolean;
  history?: OfferHistoryEvent[];
  hasHistory?: boolean;
}

interface OffersData {
  vehicle: { _id: string; brand?: string; model?: string; registrationNumber?: string; reservePrice?: number; session?: { name?: string } };
  offers: VehicleOffer[];
}

const DISCARD_REASON_LABELS: Record<string, string> = {
  commission_delai_depasse: 'Commission non réglée dans le délai',
  virement_carte_grise_delai_depasse: 'Virement non effectué dans le délai',
  annulation_volontaire: 'Achat annulé par l’acheteur',
  annulation_forcee_admin: 'Vente arrêtée par l’administration',
  compte_suspendu: 'Compte suspendu',
  suspension_admin: 'Suspension administrative',
};

const HISTORY_EVENT_LABELS: Record<HistoryEventType, { label: string; className: string }> = {
  depot: { label: 'Dépôt', className: 'bg-[#e9f4ee] text-[#2f6f4f]' },
  modification: { label: 'Modification', className: 'bg-[#fff1e8] text-[#c65f37]' },
  annulation: { label: 'Annulation', className: 'bg-[#fdece4] text-[#b91c1c]' },
};

const formatEuros = (value?: number) => (value == null ? '—' : `${value.toLocaleString('fr-FR')} €`);
const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('fr-FR') : '—');

const personName = (person?: DossierSeller) =>
  person?.companyName || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '—';

const offerOutcome = (offer: VehicleOffer) => {
  if (offer.isCurrentWinner) return { label: 'Acheteur retenu', className: 'bg-[#e9f4ee] text-[#2f6f4f]' };
  if (offer.discardReason) return { label: DISCARD_REASON_LABELS[offer.discardReason] || offer.discardReason.replaceAll('_', ' '), className: 'bg-[#fdece4] text-[#b91c1c]' };
  if (offer.attributionStatus === 'ecarte') return { label: 'Écartée', className: 'bg-[#fdece4] text-[#b91c1c]' };
  if (offer.isWinningOffer || offer.attributionStatus === 'gagnant') return { label: 'Déjà attribuée', className: 'bg-[#fff1e8] text-[#c65f37]' };
  return { label: offer.status === 'active' ? 'Disponible' : 'Annulée', className: offer.status === 'active' ? 'bg-[#eef1f5] text-[#13243c]' : 'bg-[#fdece4] text-[#b91c1c]' };
};

interface VehicleOffersModalProps {
  vehicleId: string;
  /** Session dont on veut les offres ; à défaut, la session courante ou la dernière vente du véhicule. */
  sessionId?: string;
  onClose: () => void;
}

/**
 * Toutes les offres déposées sur un véhicule pendant une session. Pour un acheteur qui a
 * modifié ou annulé son offre, un bouton ouvre l'historique complet de ses versions
 * (montant et date) — information réservée à l'administration.
 */
export default function VehicleOffersModal({ vehicleId, sessionId, onClose }: VehicleOffersModalProps) {
  const [data, setData] = useState<OffersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyOffer, setHistoryOffer] = useState<VehicleOffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const query = sessionId ? `?session=${encodeURIComponent(sessionId)}` : '';
        const response = await apiRequest(`/admin/vehicle-dossiers/${vehicleId}/offers${query}`);
        if (!cancelled) setData({ vehicle: response.vehicle, offers: response.offers || [] });
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Impossible de charger les offres.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [vehicleId, sessionId]);

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#13243c]/55 p-4 backdrop-blur-sm" onClick={() => { if (!loading) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="offers-modal-title" className="w-full max-w-[920px] overflow-hidden rounded-[16px] bg-white shadow-[0_26px_70px_rgba(0,0,0,0.3)]" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-[#efece3] px-6 py-5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3987f]">Offres de la session</div>
              <h2 id="offers-modal-title" className="mt-1 text-2xl font-bold uppercase text-[#13243c]">
                {data ? [data.vehicle.brand, data.vehicle.model].filter(Boolean).join(' ') || 'Véhicule' : 'Chargement…'}
              </h2>
              {data?.vehicle.session?.name && <p className="mt-1 text-xs text-[#5a5e66]">{data.vehicle.session.name} · Prix de réserve : {formatEuros(data.vehicle.reservePrice)}</p>}
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dcd7cb] text-[#5a5e66] hover:bg-gray-50" aria-label="Fermer"><X size={17} /></button>
          </div>
          <div className="max-h-[65vh] overflow-auto">
            {loading ? <div className="p-12 text-center text-sm text-[#5a5e66]">Chargement des offres…</div>
              : error ? <div className="m-5 rounded-[9px] bg-red-50 p-4 text-sm text-red-700">{error}</div>
              : !data || data.offers.length === 0 ? <div className="p-12 text-center text-sm text-[#5a5e66]">Aucune offre déposée sur ce véhicule.</div>
              : <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead><tr className="bg-[#f8f7f2] text-[11px] font-bold uppercase text-[#5a5e66]"><th className="px-5 py-3">Rang</th><th className="px-5 py-3">Acheteur</th><th className="px-5 py-3">Montant</th><th className="px-5 py-3">Compte</th><th className="px-5 py-3">État de l’offre</th><th className="px-5 py-3">Dernière version</th><th className="px-5 py-3 text-right">Historique</th></tr></thead>
                  <tbody>{data.offers.map((offer, index) => {
                    const outcome = offerOutcome(offer);
                    const accountSuspended = ['suspendu', 'bloque'].includes(offer.buyer?.status || '');
                    return <tr key={offer._id} className="border-t border-[#efece3] text-[13px]">
                      <td className="px-5 py-4 font-mono font-bold text-[#13243c]">#{offer.rank || index + 1}</td>
                      <td className="px-5 py-4"><div className="font-bold text-[#13243c]">{personName(offer.buyer)}</div><div className="text-[11px] text-[#5a5e66]">{offer.buyer?.email || '—'}</div></td>
                      <td className="px-5 py-4 text-base font-bold text-[#13243c]">{formatEuros(offer.amount)}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${accountSuspended ? 'bg-[#fdece4] text-[#b91c1c]' : 'bg-[#e9f4ee] text-[#2f6f4f]'}`}>{accountSuspended ? offer.buyer?.status : 'Actif'}</span></td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${outcome.className}`}>{outcome.label}</span></td>
                      <td className="px-5 py-4 text-[#5a5e66]">{formatDateTime(offer.amountUpdatedAt || offer.updatedAt || offer.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        {offer.hasHistory ? (
                          <button type="button" onClick={() => setHistoryOffer(offer)} className="inline-flex items-center gap-1.5 rounded-[7px] border border-[#d9704f] px-3 py-1.5 text-[12px] font-semibold text-[#d9704f] hover:bg-[#fff7f1]">
                            <History size={14} /> Historique ({offer.history?.length})
                          </button>
                        ) : <span className="text-[#a3987f]">—</span>}
                      </td>
                    </tr>;
                  })}</tbody>
                </table>}
          </div>
        </div>
      </div>

      {historyOffer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#13243c]/55 p-4 backdrop-blur-sm" onClick={() => setHistoryOffer(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="offer-history-title" className="w-full max-w-[520px] overflow-hidden rounded-[16px] bg-white shadow-[0_26px_70px_rgba(0,0,0,0.3)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-[#efece3] px-6 py-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3987f]">Historique des offres</div>
                <h2 id="offer-history-title" className="mt-1 text-xl font-bold uppercase text-[#13243c]">{personName(historyOffer.buyer)}</h2>
                <p className="mt-1 text-xs text-[#5a5e66]">Du plus ancien au plus récent, pour ce véhicule dans cette session.</p>
              </div>
              <button type="button" onClick={() => setHistoryOffer(null)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#dcd7cb] text-[#5a5e66] hover:bg-gray-50" aria-label="Fermer l’historique"><X size={17} /></button>
            </div>
            <ol className="max-h-[60vh] divide-y divide-[#efece3] overflow-auto">
              {(historyOffer.history || []).map((event, index) => {
                const meta = HISTORY_EVENT_LABELS[event.type];
                return (
                  <li key={`${event.at}-${index}`} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
                      <div className="mt-1.5 text-xs text-[#5a5e66]">{formatDateTime(event.at)}</div>
                    </div>
                    <div className="font-mono text-lg font-bold text-[#13243c]">{formatEuros(event.amount)}</div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
