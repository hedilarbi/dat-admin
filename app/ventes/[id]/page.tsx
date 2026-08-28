'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiRequest } from '../../api';
import Alert from '../../components/Alert';
import ConfirmModal from '../../components/ConfirmModal';
import DocumentReceivedCard from '../../components/DocumentReceivedCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Badge } from '../../components/StatusBadge';
import VerticalStep from '../../components/VerticalStep';
import { ArrowLeft, Car, CheckCircle2, Circle, Clock, Pause, Play, TimerReset, UserCheck, X, XCircle } from 'lucide-react';
import type { VehicleDossier } from '../../lib/vehicleDossier';

interface Party {
  _id: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  siret?: string;
  status?: string;
  vhuNumber?: string;
  address?: { street?: string; postalCode?: string; city?: string; country?: string };
  bankInfo?: { bankName?: string; accountHolder?: string; iban?: string; bic?: string; ribUrl?: string };
}

interface CertificateRejection {
  url?: string;
  reason: string;
  comment?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  createdAt: string;
}

interface Sale {
  _id: string;
  status: 'en_cours' | 'cloturee' | 'sans_gagnant' | 'annulee' | 'en_attente_confirmation';
  currentStep: number;
  currentStepStartedAt: string | null;
  currentStepDueAt: string | null;
  timerPaused: boolean;
  amount: number;
  reservePrice?: number;
  wonAt?: string;
  closedAt?: string;
  steps: string[];
  stepCount: number;
  commissionPaidAt: string | null;
  documentsDelivery: 'main_propre' | 'poste' | null;
  commissionPayment?: { provider?: string; mode?: string; status?: string; amount?: number; currency?: string; paymentIntentId?: string; checkoutSessionId?: string; initiatedAt?: string };
  transferConfirmedAt: string | null;
  certificate?: { url?: string; generatedAt?: string; sellerSignedUrl?: string; sellerSignedAt?: string; signedUrl?: string; signedAt?: string; validatedAt?: string; buyerValidatedAt?: string; rejections?: CertificateRejection[] };
  handover?: { declarationUrl?: string; generatedAt?: string; otpAttempts?: number; confirmedAt?: string };
  vehicle: VehicleDossier & { lotNumber?: number | null };
  winner: Party | null;
  seller: Party | null;
  session: { _id: string; name: string; endDate?: string; status?: string } | null;
  waitingList?: Array<{ buyer: Party | null; amount: number; rank: number; status: string; offeredAt?: string }>;
}

const SALE_STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  en_cours: { label: 'En cours', color: '#ffffff', bg: '#f97316' },
  en_attente_confirmation: { label: 'En attente confirmation', color: '#ffffff', bg: '#d9704f' },
  cloturee: { label: 'Clôturée', color: '#ffffff', bg: '#16a34a' },
  sans_gagnant: { label: 'Sans gagnant', color: '#ffffff', bg: '#6b7280' },
  annulee: { label: 'Annulée', color: '#ffffff', bg: '#b91c1c' },
};

const STEP_LABELS: Record<string, string> = {
  commission: 'Paiement de la commission',
  virement: 'Virement du prix au vendeur',
  certificat_vendeur: 'Certificat signé par le vendeur',
  validation_acheteur: "Validation par l'acheteur",
  certificat_acheteur: "Certificat signé par l'acheteur",
  validation_vendeur: 'Validation par le vendeur',
  enlevement: 'Enlèvement et clôture',
};

const REJECTION_LABELS: Record<string, string> = {
  tampon_manquant: 'Tampon manquant',
  document_illisible: 'Document illisible',
  signature_manquante: 'Signature manquante',
  document_incomplet: 'Document incomplet',
  mauvais_document: 'Mauvais document',
  autre: 'Autre',
};

const DELIVERY_LABELS: Record<string, string> = {
  main_propre: 'Remise en main propre',
  poste: 'Envoi par la poste',
};

const formatEuros = (value?: number | null) =>
  value == null ? '—' : `${value.toLocaleString('fr-FR')} €`;

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : null;

const personName = (p?: Party | null) =>
  p?.companyName || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || '—';

/** Compte à rebours lisible ; négatif quand l'échéance est dépassée. */
const timeLeft = (due?: string | null) => {
  if (!due) return null;
  const diff = new Date(due).getTime() - Date.now();
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 3600000);
  const minutes = Math.floor((abs % 3600000) / 60000);
  const text = hours >= 24 ? `${Math.floor(hours / 24)} j ${hours % 24} h` : `${hours} h ${minutes} min`;
  return { overdue: diff < 0, text };
};

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const saleId = params.id as string;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewedStepIndex, setViewedStepIndex] = useState<number | null>(null);

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendHours, setExtendHours] = useState(24);

  const [suspendBuyer, setSuspendBuyer] = useState(false);
  const [suspendSeller, setSuspendSeller] = useState(false);
  const [promoteNext, setPromoteNext] = useState(true);

  const fetchSale = useCallback(async () => {
    try {
      const res = await apiRequest(`/admin/sales/${saleId}`);
      setSale(res.data);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de charger la vente.');
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => { fetchSale(); }, [fetchSale]);

  /** Toute action admin suit le même cycle : verrouiller, appeler, recharger, annoncer. */
  const runAction = async (call: () => Promise<{ message?: string }>, fallbackMessage: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await call();
      await fetchSale();
      setMessage(res?.message || fallbackMessage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "L'action a échoué.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error && !sale) {
    return (
      <div className="flex-1 p-6 sm:p-10 bg-[#fbfaf7]">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }
  if (!sale) return null;

  const isOngoing = sale.status === 'en_cours';
  const canExtend = isOngoing && [1, 2].includes(sale.currentStep);
  const countdown = timeLeft(sale.currentStepDueAt);
  const vehicleTitle = [sale.vehicle?.brand, sale.vehicle?.model].filter(Boolean).join(' ') || 'Véhicule';

  const lastBuyerRejection = (sale.certificate?.rejections || [])
    .filter(r => r.rejectedBy === 'buyer')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const lastSellerRejection = (sale.certificate?.rejections || [])
    .filter(r => r.rejectedBy === 'seller')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  // Ce qui s'est passé à chaque étape, dans l'ordre du modèle serveur.
  const stepDetails: Record<string, {
    done: boolean;
    facts: Array<{ label: string; value: string }>;
    docs: Array<{ title: string; description: string; url: string; type: 'PDF' | 'IMG' }>;
    rejection?: { title: string; reason: string; comment?: string } | null;
  }> = {
    commission: {
      done: Boolean(sale.commissionPaidAt),
      facts: [
        { label: 'Commission réglée le', value: formatDateTime(sale.commissionPaidAt) || '—' },
        { label: 'Paiement', value: sale.commissionPayment?.status
          ? `${sale.commissionPayment.status} · ${sale.commissionPayment.amount != null ? `${(sale.commissionPayment.amount / 100).toLocaleString('fr-FR')} €` : '—'} · ${sale.commissionPayment.mode || '—'}`
          : '—' },
        { label: 'Référence', value: sale.commissionPayment?.paymentIntentId || sale.commissionPayment?.checkoutSessionId || '—' },
        { label: 'Remise des papiers', value: sale.documentsDelivery ? DELIVERY_LABELS[sale.documentsDelivery] : '—' },
      ],
      docs: [],
    },
    virement: {
      done: Boolean(sale.transferConfirmedAt),
      facts: [
        { label: 'Réception confirmée par le vendeur le', value: formatDateTime(sale.transferConfirmedAt) || '—' },
        { label: 'Montant dû au vendeur', value: formatEuros(sale.amount) },
      ],
      docs: [],
    },
    certificat_vendeur: {
      done: Boolean(sale.certificate?.sellerSignedAt),
      facts: [
        { label: 'Certificat généré le', value: formatDateTime(sale.certificate?.generatedAt) || '—' },
        { label: 'Déposé signé le', value: formatDateTime(sale.certificate?.sellerSignedAt) || '—' },
      ],
      docs: [
        ...(sale.certificate?.url ? [{ title: 'Certificat de cession généré', description: 'Document pré-rempli par la plateforme', url: sale.certificate.url, type: 'PDF' as const }] : []),
        ...(sale.certificate?.sellerSignedUrl ? [{ title: 'Certificat signé par le vendeur', description: "Déposé par le vendeur", url: sale.certificate.sellerSignedUrl, type: 'PDF' as const }] : []),
      ],
      rejection: lastBuyerRejection ? {
        title: "Certificat signalé par l'acheteur",
        reason: REJECTION_LABELS[lastBuyerRejection.reason] || lastBuyerRejection.reason,
        comment: lastBuyerRejection.comment,
      } : null
    },
    validation_acheteur: {
      done: Boolean(sale.certificate?.buyerValidatedAt),
      facts: [
        { label: "Validé par l'acheteur le", value: formatDateTime(sale.certificate?.buyerValidatedAt) || '—' },
        { label: 'Refus enregistrés', value: String(sale.certificate?.rejections?.filter(r => r.rejectedBy === 'buyer').length || 0) },
      ],
      docs: (sale.certificate?.rejections || [])
        .filter((r) => r.rejectedBy === 'buyer' && r.url)
        .map((r, i) => ({
          title: `Document refusé n°${i + 1} — ${REJECTION_LABELS[r.reason] || r.reason}`,
          description: [formatDateTime(r.createdAt), r.comment].filter(Boolean).join(' · ') || "Refusé par l'acheteur",
          url: r.url as string,
          type: 'PDF' as const,
        })),
      rejection: lastBuyerRejection ? {
        title: "Certificat signalé par l'acheteur",
        reason: REJECTION_LABELS[lastBuyerRejection.reason] || lastBuyerRejection.reason,
        comment: lastBuyerRejection.comment,
      } : null
    },
    certificat_acheteur: {
      done: Boolean(sale.certificate?.signedAt),
      facts: [
        { label: 'Déposé signé le', value: formatDateTime(sale.certificate?.signedAt) || '—' },
      ],
      docs: [
        ...(sale.certificate?.signedUrl ? [{ title: 'Certificat signé et tamponné', description: "Déposé par l'acheteur", url: sale.certificate.signedUrl, type: 'PDF' as const }] : []),
      ],
      rejection: lastSellerRejection ? {
        title: "Certificat de l'acheteur refusé par le vendeur",
        reason: REJECTION_LABELS[lastSellerRejection.reason] || lastSellerRejection.reason,
        comment: lastSellerRejection.comment,
      } : null
    },
    validation_vendeur: {
      done: Boolean(sale.certificate?.validatedAt),
      facts: [
        { label: 'Validé par le vendeur le', value: formatDateTime(sale.certificate?.validatedAt) || '—' },
        { label: 'Refus enregistrés', value: String(sale.certificate?.rejections?.filter(r => r.rejectedBy === 'seller').length || 0) },
      ],
      docs: (sale.certificate?.rejections || [])
        .filter((r) => r.rejectedBy === 'seller' && r.url)
        .map((r, i) => ({
          title: `Document refusé n°${i + 1} — ${REJECTION_LABELS[r.reason] || r.reason}`,
          description: [formatDateTime(r.createdAt), r.comment].filter(Boolean).join(' · ') || 'Refusé par le vendeur',
          url: r.url as string,
          type: 'PDF' as const,
        })),
      rejection: lastSellerRejection ? {
        title: "Certificat de l'acheteur refusé par le vendeur",
        reason: REJECTION_LABELS[lastSellerRejection.reason] || lastSellerRejection.reason,
        comment: lastSellerRejection.comment,
      } : null
    },
    enlevement: {
      done: Boolean(sale.handover?.confirmedAt),
      facts: [
        { label: 'Déclaration générée le', value: formatDateTime(sale.handover?.generatedAt) || '—' },
        { label: 'Enlèvement confirmé le', value: formatDateTime(sale.handover?.confirmedAt) || '—' },
        { label: 'Tentatives de code', value: String(sale.handover?.otpAttempts || 0) },
      ],
      docs: sale.handover?.declarationUrl
        ? [{ title: "Déclaration d'achat", description: 'Générée par la plateforme', url: sale.handover.declarationUrl, type: 'PDF' as const }]
        : [],
    },
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 font-sans text-black bg-[#fbfaf7]">
      <button onClick={() => router.back()} className="mb-5 flex items-center gap-2 text-[12px] font-bold uppercase text-[#5a5e66] transition hover:text-[#13243c]">
        <ArrowLeft size={15} /> Retour
      </button>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {message && <Alert variant="success" className="mb-4">{message}</Alert>}

      {/* En-tête */}
      <section className="mb-5 rounded-[12px] border border-[#eceadf] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge style={SALE_STATUS_BADGES[sale.status]} className="py-1.5" />
              {sale.vehicle?.lotNumber ? (
                <span className="rounded-[5px] bg-[#faf1e4] px-2 py-1 font-mono text-[11px] font-bold text-[#b3893f]">Lot #{sale.vehicle.lotNumber}</span>
              ) : null}
              {sale.session && <span className="text-[12px] font-semibold text-[#5a5e66]">{sale.session.name}</span>}
            </div>
            <h1 className="m-0 font-['Saira_Condensed',sans-serif] text-[32px] font-bold uppercase leading-none text-[#13243c]">
              {vehicleTitle}
            </h1>
            <div className="mt-2 text-[13px] text-[#5a5e66]">
              {sale.vehicle?.registrationNumber || '—'} · Adjugé {formatEuros(sale.amount)}
              {sale.reservePrice != null && <> · Réserve {formatEuros(sale.reservePrice)}</>}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <button
              type="button"
              onClick={() => setVehicleModalOpen(true)}
              className="flex h-[42px] items-center gap-2 rounded-[9px] border border-[#dcd7cb] bg-white px-4 text-[12px] font-bold uppercase text-[#13243c] transition hover:bg-[#f8f7f2]"
            >
              <Car size={16} /> Détails du véhicule
            </button>
            {isOngoing && countdown && (
              <div className={`rounded-[9px] px-4 py-2 text-center ${countdown.overdue ? 'bg-[#fdece4]' : 'bg-[#f8f7f2]'}`}>
                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#8a8270]">
                  {countdown.overdue ? 'Délai dépassé de' : 'Temps restant'}
                </div>
                <div className={`font-mono text-[15px] font-bold ${countdown.overdue ? 'text-[#b91c1c]' : 'text-[#13243c]'}`}>
                  {countdown.text}{sale.timerPaused && ' (en pause)'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions réservées à l'administration */}
        {isOngoing && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[#efece3] pt-5">
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(
                () => apiRequest(`/admin/sales/${saleId}/timer`, { method: 'PUT', body: JSON.stringify({ pause: !sale.timerPaused }) }),
                sale.timerPaused ? 'Compte à rebours relancé.' : 'Compte à rebours mis en pause.',
              )}
              className="flex h-[42px] items-center gap-2 rounded-[9px] border border-[#dcd7cb] bg-white px-4 text-[12px] font-bold uppercase text-[#13243c] transition hover:bg-[#f8f7f2] disabled:opacity-50"
            >
              {sale.timerPaused ? <Play size={15} /> : <Pause size={15} />}
              {sale.timerPaused ? 'Reprendre le délai' : 'Mettre le délai en pause'}
            </button>

            <button
              type="button"
              disabled={busy || !canExtend}
              onClick={() => setExtendModalOpen(true)}
              title={canExtend ? undefined : "Seules les étapes 1 et 2 ont un délai prolongeable"}
              className="flex h-[42px] items-center gap-2 rounded-[9px] border border-[#e6d8bd] bg-white px-4 text-[12px] font-bold uppercase text-[#b3893f] transition hover:bg-[#faf1e4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <TimerReset size={15} /> Prolonger le délai
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setPromoteModalOpen(true)}
              className="flex h-[42px] items-center gap-2 rounded-[9px] border border-[#cbd5e1] bg-white px-4 text-[12px] font-bold uppercase text-[#13243c] transition hover:bg-slate-50 disabled:opacity-50"
            >
              <UserCheck size={15} /> Passer au candidat suivant
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setEndModalOpen(true)}
              className="flex h-[42px] items-center gap-2 rounded-[9px] border border-[#efb7b7] bg-white px-4 text-[12px] font-bold uppercase text-[#b91c1c] transition hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={15} /> Arrêter la vente
            </button>
          </div>
        )}
      </section>

      {/* Parties */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PartyCard title="Acheteur" party={sale.winner} accent="#2563eb" />
        <PartyCard title="Vendeur" party={sale.seller} accent="#2f6f4f" showBank />
      </div>

      {/* Avancement */}
      <section className="mb-5 rounded-[12px] border border-[#eceadf] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#4c5058]">Avancement de la vente</h2>
          <span className="text-[12px] font-semibold text-[#13243c]">
            Étape {sale.currentStep} sur {sale.stepCount}
          </span>
        </div>
        
        {sale.wonAt && <p className="mb-4 text-[12px] text-[#5a5e66]">Attribuée le {formatDateTime(sale.wonAt)}</p>}
        {sale.closedAt && <p className="mb-4 text-[12px] text-[#5a5e66]">Clôturée le {formatDateTime(sale.closedAt)}</p>}

        <div className="mt-6 flex flex-col">
          {sale.steps.map((key, index) => {
            const number = index + 1;
            const detail = stepDetails[key];
            const isOngoing = sale.status === 'en_cours' || sale.status === 'en_attente_confirmation';
            const isCurrent = isOngoing && number === sale.currentStep;
            const isCompleted = number < sale.currentStep || sale.status === 'cloturee';
            const isActive = viewedStepIndex !== null ? viewedStepIndex === index : (sale.status === 'cloturee' ? false : number === sale.currentStep);
            const isLast = index === sale.steps.length - 1;

            return (
              <VerticalStep
                key={key}
                stepNumber={number}
                title={STEP_LABELS[key] || key}
                isActive={isActive}
                isCompleted={isCompleted}
                isLast={isLast}
                onClick={() => setViewedStepIndex(isActive ? (sale.status === 'cloturee' ? null : sale.currentStep - 1) : index)}
              >
                <div className="mt-2 text-sm text-[#5a5e66]">
                  {(isCompleted || isCurrent || detail?.done || detail?.rejection) && detail ? (
                    <>
                      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                        {detail.facts.map((fact) => (
                          <div key={fact.label} className="flex flex-wrap gap-1.5 text-[12px]">
                            <dt className="text-[#8a8270]">{fact.label} :</dt>
                            <dd className="font-semibold text-[#1a2230]">{fact.value}</dd>
                          </div>
                        ))}
                      </dl>

                      {detail.docs.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                          {detail.docs.map((doc) => (
                            <DocumentReceivedCard key={doc.url} fileType={doc.type} title={doc.title} description={doc.description} url={doc.url} />
                          ))}
                        </div>
                      )}

                      {detail.rejection && (
                        <div className="mt-3 p-3.5 bg-red-50 border border-red-200 rounded-[10px] text-red-700 text-xs">
                          <div className="font-bold flex items-center gap-1.5 text-[13px]">
                            <XCircle size={14} className="shrink-0" />
                            {detail.rejection.title}
                          </div>
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            <div>
                              <strong>Motif :</strong> {detail.rejection.reason}
                            </div>
                            {detail.rejection.comment && (
                              <div>
                                <strong>Commentaire :</strong> {detail.rejection.comment}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="italic text-[#8a8270]">Étape à venir...</p>
                  )}
                </div>
              </VerticalStep>
            );
          })}
        </div>
      </section>

      {/* Liste d'attente */}
      {sale.waitingList && sale.waitingList.length > 0 && (
        <section className="rounded-[12px] border border-[#eceadf] bg-white">
          <div className="border-b border-[#efece3] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#13243c]">Liste d&apos;attente ({sale.waitingList.length})</h2>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f8f7f2] text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4c5058]">
                <th className="px-5 py-3">Rang</th>
                <th className="px-5 py-3">Acheteur</th>
                <th className="px-5 py-3">Offre</th>
                <th className="px-5 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sale.waitingList.map((entry) => (
                <tr key={`${entry.rank}-${entry.buyer?._id}`} className="border-t border-[#efece3] text-[13px]">
                  <td className="px-5 py-3 font-mono font-bold">{entry.rank}</td>
                  <td className="px-5 py-3">
                    <div className="font-semibold text-[#13243c]">{personName(entry.buyer)}</div>
                    <div className="text-[11px] text-[#5a5e66]">{entry.buyer?.email || '—'}</div>
                  </td>
                  <td className="px-5 py-3 font-semibold">{formatEuros(entry.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      entry.status === 'gagnant' ? 'bg-[#e9f4ee] text-[#2f6f4f]'
                        : entry.status === 'ecarte' ? 'bg-[#fdece4] text-[#b91c1c]'
                        : 'bg-[#f1efe8] text-[#8a8270]'
                    }`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Fiche véhicule en modale */}
      {vehicleModalOpen && (
        <VehicleModal vehicle={sale.vehicle} onClose={() => setVehicleModalOpen(false)} />
      )}

      <ConfirmModal
        open={extendModalOpen}
        title="Prolonger le délai"
        message={`Étape ${sale.currentStep} — ${STEP_LABELS[sale.steps[sale.currentStep - 1]] || ''}. De combien d'heures repousser l'échéance ?`}
        confirmLabel={busy ? 'Prolongation…' : 'Prolonger'}
        onCancel={() => { if (!busy) setExtendModalOpen(false); }}
        onConfirm={() => runAction(
          () => apiRequest(`/admin/sales/${saleId}/extend-deadline`, { method: 'PUT', body: JSON.stringify({ hours: extendHours }) }),
          'Délai prolongé.',
        ).then(() => setExtendModalOpen(false))}
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={720}
            value={extendHours}
            onChange={(e) => setExtendHours(Number(e.target.value))}
            className="h-[42px] w-28 rounded-[9px] border border-[#dcd7cb] px-3 font-mono text-[14px] font-semibold text-[#13243c] focus:border-[#13243c] focus:outline-none"
          />
          <span className="text-sm text-[#5a5e66]">heures</span>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={promoteModalOpen}
        title="Passer au candidat suivant"
        message="L'acheteur actuel sera écarté et la vente proposée au candidat suivant de la liste d'attente. S'il n'y en a plus, la vente sera close sans gagnant."
        confirmLabel={busy ? 'En cours…' : 'Confirmer'}
        onCancel={() => { if (!busy) setPromoteModalOpen(false); }}
        onConfirm={() => runAction(
          () => apiRequest(`/admin/sales/${saleId}/promote-next`, { method: 'POST' }),
          'Vente transmise au candidat suivant.',
        ).then(() => setPromoteModalOpen(false))}
      />

      <ConfirmModal
        open={endModalOpen}
        title="Arrêter la vente"
        message="Voulez-vous forcer la fin de cette vente ? Cette action est irréversible."
        confirmLabel={busy ? 'En cours…' : 'Confirmer'}
        danger
        onCancel={() => { if (!busy) setEndModalOpen(false); }}
        onConfirm={() => runAction(
          () => apiRequest(`/admin/sales/${saleId}/force-end`, {
            method: 'PUT',
            body: JSON.stringify({ suspendBuyer, suspendSeller, promoteNext }),
          }),
          'Vente arrêtée.',
        ).then(() => setEndModalOpen(false))}
      >
        <div className="space-y-2 text-left">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={suspendBuyer} onChange={(e) => setSuspendBuyer(e.target.checked)} className="mt-1 accent-[#13243c]" />
            <span className="text-sm text-[#1a2230]">Suspendre le compte de l&apos;acheteur ({personName(sale.winner)})</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={suspendSeller} onChange={(e) => setSuspendSeller(e.target.checked)} className="mt-1 accent-[#13243c]" />
            <span className="text-sm text-[#1a2230]">Suspendre le compte du vendeur ({personName(sale.seller)})</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={promoteNext} onChange={(e) => setPromoteNext(e.target.checked)} className="mt-1 accent-[#13243c]" />
            <span className="text-sm text-[#1a2230]">Attribuer au candidat suivant (sinon la vente est annulée)</span>
          </label>
        </div>
      </ConfirmModal>
    </div>
  );
}

function PartyCard({ title, party, accent, showBank = false }: { title: string; party: Party | null; accent: string; showBank?: boolean }) {
  if (!party) {
    return (
      <section className="rounded-[12px] border border-[#eceadf] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#13243c]">{title}</h2>
        <p className="mt-2 text-[13px] italic text-[#8a8270]">Aucun {title.toLowerCase()} rattaché à cette vente.</p>
      </section>
    );
  }

  const address = [party.address?.street, [party.address?.postalCode, party.address?.city].filter(Boolean).join(' '), party.address?.country]
    .filter(Boolean).join(', ');

  return (
    <section className="rounded-[12px] border border-[#eceadf] bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
        <h2 className="text-[15px] font-bold text-[#13243c]">{title}</h2>
        {party.status && party.status !== 'valide' && (
          <span className="rounded-full bg-[#fdece4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#b91c1c]">{party.status}</span>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-y-1.5 text-[13px]">
        <Row label="Raison sociale" value={party.companyName} />
        <Row label="Contact" value={[party.firstName, party.lastName].filter(Boolean).join(' ')} />
        <Row label="E-mail" value={party.email} />
        <Row label="Téléphone" value={party.phone} />
        <Row label="SIRET" value={party.siret} mono />
        <Row label="Adresse" value={address} />
        {party.vhuNumber && <Row label="N° agrément VHU" value={party.vhuNumber} mono />}
      </dl>

      {showBank && party.bankInfo && (
        <div className="mt-4 rounded-[9px] bg-[#f8f7f2] p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a8270]">Coordonnées bancaires</div>
          <dl className="grid grid-cols-1 gap-y-1.5 text-[13px]">
            <Row label="Banque" value={party.bankInfo.bankName} />
            <Row label="Titulaire" value={party.bankInfo.accountHolder} />
            <Row label="IBAN" value={party.bankInfo.iban} mono />
            <Row label="BIC" value={party.bankInfo.bic} mono />
          </dl>
        </div>
      )}
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-[#8a8270]">{label} :</dt>
      <dd className={`font-semibold text-[#1a2230] ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  );
}

/** Fiche véhicule complète, ouverte par-dessus la vente pour ne pas perdre le contexte. */
function VehicleModal({ vehicle, onClose }: { vehicle: Sale['vehicle']; onClose: () => void }) {
  const specs: Array<{ label: string; value?: string | number | null }> = [
    { label: 'Marque', value: vehicle?.brand },
    { label: 'Modèle', value: vehicle?.model },
    { label: 'Année', value: vehicle?.year },
    { label: 'Kilométrage', value: vehicle?.mileage != null ? `${vehicle.mileage.toLocaleString('fr-FR')} km` : null },
    { label: 'Immatriculation', value: vehicle?.registrationNumber },
    { label: 'VIN', value: vehicle?.vin },
    { label: 'Moteur', value: vehicle?.engine },
    { label: 'Carburant', value: vehicle?.fuelType },
    { label: 'Énergie', value: vehicle?.energyLabel },
    { label: 'CO₂', value: vehicle?.co2 },
    { label: 'Genre', value: vehicle?.vehicleGenre },
    { label: 'Puissance fiscale', value: vehicle?.fiscalPower },
    { label: 'Carrosserie', value: vehicle?.bodyType },
    { label: 'Boîte', value: vehicle?.gearbox === 'M' ? 'Manuelle' : vehicle?.gearbox === 'A' ? 'Automatique' : vehicle?.gearbox },
    { label: 'Couleur', value: vehicle?.color },
    { label: 'Procédure', value: vehicle?.procedure },
    { label: 'VRADE', value: vehicle?.vrade },
    { label: 'Prix de réserve', value: vehicle?.reservePrice != null ? `${vehicle.reservePrice.toLocaleString('fr-FR')} €` : null },
    { label: 'Carte grise', value: vehicle?.registrationCardAvailable === undefined ? null : vehicle.registrationCardAvailable ? 'Oui' : 'Non' },
    { label: 'Mises en vente', value: vehicle?.listingCount },
  ].filter((s) => s.value !== null && s.value !== undefined && s.value !== '');

  const photos = (vehicle?.photos || []).map((p) => p.processedUrl || p.originalUrl).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13243c]/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_26px_60px_rgba(0,0,0,0.28)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#efece3] px-6 py-5">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a3987f]">Dossier véhicule</div>
            <h2 className="font-['Saira_Condensed',sans-serif] text-[24px] font-bold uppercase leading-none text-[#13243c]">
              {[vehicle?.brand, vehicle?.model].filter(Boolean).join(' ') || 'Véhicule'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#dcd7cb] text-[#5a5e66] hover:bg-gray-50" aria-label="Fermer">
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {photos.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url as string} alt="" className="aspect-4/3 w-full rounded-[9px] object-cover" />
              ))}
            </div>
          )}

          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {specs.map((spec) => (
              <div key={spec.label} className="rounded-[9px] bg-[#f8f7f2] p-3">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-[#7a756a]">{spec.label}</dt>
                <dd className="mt-0.5 text-[13px] font-semibold text-[#1a2230]">{String(spec.value)}</dd>
              </div>
            ))}
          </dl>

          {vehicle?.description && (
            <div className="mt-5">
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#4c5058]">Description du choc</h3>
              <p className="whitespace-pre-wrap rounded-[9px] bg-[#f8f7f2] p-3 text-[13px] leading-6 text-[#1a2230]">{vehicle.description}</p>
            </div>
          )}
          {vehicle?.conditionDetails && (
            <div className="mt-4">
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#4c5058]">État du véhicule</h3>
              <p className="whitespace-pre-wrap rounded-[9px] bg-[#f8f7f2] p-3 text-[13px] leading-6 text-[#1a2230]">{vehicle.conditionDetails}</p>
            </div>
          )}
        </div>

        <div className="border-t border-[#efece3] bg-[#fbfaf7] px-6 py-4 text-right">
          <button type="button" onClick={onClose} className="h-10 rounded-[8px] bg-[#13243c] px-5 text-xs font-bold uppercase text-white hover:bg-[#1a3050]">Fermer</button>
        </div>
      </div>
    </div>
  );
}
