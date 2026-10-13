'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface ClosureResult {
  saleId: string;
  status: 'en_cours' | 'suspendue' | 'cloturee' | 'sans_gagnant' | 'annulee';
  amount: number | null;
  winnerName: string | null;
  sellerDecisionDueAt: string | null;
  vehicleState: 'en_attente' | 'dans_cette_session' | 'remis_en_session';
  otherSessionName: string | null;
  canRelist: boolean;
  offerCount: number;
  topOffers: Array<{ amount: number; buyerName: string }>;
  vehicle: { _id: string; brand: string; model: string; registrationNumber: string; lotNumber: number | null; reservePrice: number | null; listingCount: number; photoUrl: string | null } | null;
}

export interface RelistTarget {
  _id: string;
  name: string;
}

const euros = (value: number | null | undefined) => (value == null ? '—' : `${value.toLocaleString('fr-FR')} €`);

/** Libellé et couleur du résultat de la clôture pour un véhicule. */
const outcomeOf = (result: ClosureResult) => {
  if (result.status === 'cloturee') return { label: 'Vendu', className: 'bg-[#e9f4ee] text-[#2f6f4f]' };
  if (result.status === 'en_cours') return { label: 'Acheteur trouvé · vente en cours', className: 'bg-[#fff1e8] text-[#c65f37]' };
  if (result.status === 'suspendue') return { label: 'Décision du vendeur', className: 'bg-[#fdf3ec] text-[#b45309]' };
  if (result.status === 'annulee') return { label: 'Vente annulée', className: 'bg-[#fdece4] text-[#b91c1c]' };
  return { label: 'Invendu', className: 'bg-[#fdece4] text-[#b91c1c]' };
};

const currentState = (result: ClosureResult) => {
  if (result.status === 'cloturee' || result.status === 'en_cours') return null;
  if (result.vehicleState === 'remis_en_session') return `Remis en session${result.otherSessionName ? ` : ${result.otherSessionName}` : ''}`;
  if (result.vehicleState === 'dans_cette_session') {
    const due = result.sellerDecisionDueAt ? ` · décision avant le ${new Date(result.sellerDecisionDueAt).toLocaleString('fr-FR')}` : '';
    return `Rattaché à cette session, en attente du vendeur${due}`;
  }
  return 'Retourné en attente de session';
};

interface ClosureResultsProps {
  results: ClosureResult[];
  targets: RelistTarget[];
  onRelist: (vehicleId: string, targetSessionId: string) => Promise<void>;
}

/**
 * Résultat d'une session clôturée, véhicule par véhicule. La session ne liste plus que les
 * véhicules vendus : les invendus, revenus en attente, n'y apparaîtraient plus. Ce bloc permet de
 * les retrouver et de les remettre en session directement.
 */
export default function ClosureResults({ results, targets, onRelist }: ClosureResultsProps) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const unsold = results.filter((result) => result.status === 'sans_gagnant' || result.status === 'suspendue').length;

  const relist = async (vehicleId: string) => {
    const target = selected[vehicleId];
    if (!target) return;
    setBusy(vehicleId);
    setError('');
    try {
      await onRelist(vehicleId, target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de remettre ce véhicule en session.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="border-b border-[#efece3] bg-[#fbfaf7]">
      <div className="px-4 pt-4 sm:px-[26px]">
        <div className="text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-[#4c5058]">
          Résultat de la clôture ({results.length} véhicule{results.length > 1 ? 's' : ''})
        </div>
        <p className="mt-1.5 text-[12px] text-[#5a5e66]">
          {unsold > 0 ? `${unsold} véhicule${unsold > 1 ? 's' : ''} sans acheteur à suivre.` : 'Tous les véhicules ont trouvé un acheteur.'}
        </p>
        {error && <p className="mt-2 rounded-[8px] bg-red-50 p-2 text-[12px] text-red-700">{error}</p>}
      </div>

      <ul className="max-h-[42vh] divide-y divide-[#efece3] overflow-y-auto px-4 py-2 sm:px-[26px]">
        {results.map((result) => {
          const outcome = outcomeOf(result);
          const state = currentState(result);
          const vehicle = result.vehicle;
          return (
            <li key={result.saleId} className="py-3">
              <div className="flex items-start gap-3">
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[7px] bg-[#eef1f5]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {vehicle?.photoUrl ? <img src={vehicle.photoUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {vehicle ? (
                      <Link href={`/dossiers/${vehicle._id}`} target="_blank" className="truncate text-[13px] font-semibold text-[#13243c] hover:underline">
                        {[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Véhicule'}
                      </Link>
                    ) : <span className="text-[13px] font-semibold text-[#13243c]">Véhicule supprimé</span>}
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${outcome.className}`}>{outcome.label}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[#5a5e66]">
                    {vehicle?.lotNumber ? `Lot #${vehicle.lotNumber} · ` : ''}{vehicle?.registrationNumber || '—'} · Réserve {euros(vehicle?.reservePrice)} · {vehicle?.listingCount ?? 0} mise{(vehicle?.listingCount ?? 0) > 1 ? 's' : ''} en vente
                  </div>
                  {result.amount != null && result.status !== 'sans_gagnant' && (
                    <div className="mt-0.5 text-[12px] font-semibold text-[#13243c]">{euros(result.amount)}{result.winnerName ? ` · ${result.winnerName}` : ''}</div>
                  )}
                  {state && <div className="mt-1 text-[11px] font-semibold text-[#b45309]">{state}</div>}
                  {(result.status === 'sans_gagnant' || result.status === 'suspendue') && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#5a5e66]">
                      {result.offerCount === 0 ? <span>Aucune offre</span> : (
                        <>
                          <span className="font-semibold">Meilleures offres :</span>
                          {result.topOffers.map((offer, index) => (
                            <span key={index} title={offer.buyerName} className="rounded-full bg-[#eef1f5] px-2 py-0.5 font-mono font-semibold text-[#13243c]">#{index + 1} {euros(offer.amount)}</span>
                          ))}
                          <span>({result.offerCount} offre{result.offerCount > 1 ? 's' : ''}, sous le prix de réserve)</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {result.canRelist && vehicle && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-[76px]">
                  <select
                    aria-label="Session de remise en vente"
                    value={selected[vehicle._id] || ''}
                    onChange={(event) => setSelected((current) => ({ ...current, [vehicle._id]: event.target.value }))}
                    className="h-9 min-w-[180px] flex-1 rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-[12px] text-[#13243c]"
                  >
                    <option value="">{targets.length ? 'Choisir une session…' : 'Aucune session à venir'}</option>
                    {targets.map((target) => <option key={target._id} value={target._id}>{target.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => relist(vehicle._id)}
                    disabled={!selected[vehicle._id] || busy === vehicle._id}
                    className="h-9 rounded-[7px] bg-[#13243c] px-3 text-[11px] font-bold uppercase text-white transition hover:bg-[#1a3050] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === vehicle._id ? 'Ajout…' : 'Remettre en session'}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
