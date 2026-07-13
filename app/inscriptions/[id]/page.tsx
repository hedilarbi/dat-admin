'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '../../api';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';
import { Badge, getInscriptionStatusBadge } from '../../components/StatusBadge';
import DocumentReceivedCard from '../../components/DocumentReceivedCard';

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
  kbisUrl?: string;
  cinRectoUrl?: string;
  cinVersoUrl?: string;
  vhuNumber?: string;
  address?: { street: string; city: string; country: string; postalCode: string; };
  bankInfo?: { bankName: string; accountHolder: string; iban: string; bic: string; ribUrl?: string; };
  createdAt: string;
}

interface RefusalReason {
  key: string;
  label: { fr: string; en: string; };
  message: { fr: string; en: string; };
  type: 'inscription' | 'document' | 'vehicule';
}

export default function InscriptionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [refusalReasons, setRefusalReasons] = useState<RefusalReason[]>([]);

  const [decisionMode, setDecisionMode] = useState<'correction' | 'refuser' | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customComment, setCustomComment] = useState('');
  const [causesOpen, setCausesOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'approve' | 'decision' | 'suspendu' | 'bloque' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' } | { type: 'status'; status: 'suspendu' | 'bloque' } | null>(null);

  const fetchUser = async () => {
    try {
      const res = await apiRequest('/admin/users');
      const found = (res.users || []).find((u: any) => u._id === params.id);
      setSelectedUser(found || null);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement du dossier.');
      router.push('/login');
    }
  };

  const fetchRefusalReasons = async () => {
    try {
      const res = await apiRequest('/admin/messages?type=inscription');
      setRefusalReasons(res.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([fetchUser(), fetchRefusalReasons()]).finally(() => {
      setLoading(false);
    });
  }, [params.id]);

  const handleApproveUser = async () => {
    if (!selectedUser) return;
    setError('');
    setMessage('');
    setActionLoading('approve');
    try {
      await apiRequest(`/admin/users/${selectedUser._id}/validate`, { method: 'POST' });
      router.push('/inscriptions');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la validation');
      setActionLoading(null);
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !decisionMode) return;
    if (selectedReasons.length === 0 && !customComment.trim()) {
      setError('Veuillez sélectionner au moins un motif ou saisir un commentaire.');
      return;
    }

    setError('');
    setMessage('');
    setActionLoading('decision');
    try {
      const actionUrl = decisionMode === 'correction'
        ? `/admin/users/${selectedUser._id}/request-correction`
        : `/admin/users/${selectedUser._id}/reject`;

      await apiRequest(actionUrl, {
        method: 'POST',
        body: JSON.stringify({
          motifs: selectedReasons,
          comment: customComment,
        }),
      });

      router.push('/inscriptions');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement de la décision');
      setActionLoading(null);
    }
  };

  const handleUpdateUserStatus = async (newStatus: 'suspendu' | 'bloque') => {
    if (!selectedUser) return;
    setError('');
    setActionLoading(newStatus);
    try {
      await apiRequest(`/admin/users/${selectedUser._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      setMessage('Statut mis à jour.');
      setSelectedUser({ ...selectedUser, status: newStatus as any });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#fbfaf7] text-[#13243c]">
        <p className="font-semibold text-sm">Dossier introuvable.</p>
        <Link href="/inscriptions" className="text-xs font-bold text-[#d9704f] hover:underline">← Retour aux inscriptions</Link>
      </div>
    );
  }

  const badge = getInscriptionStatusBadge(selectedUser.status);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto pt-8 sm:pt-10 pr-8 sm:pr-10 pl-8 sm:pl-10 pb-20 sm:pb-24 font-sans text-black flex flex-col xl:flex-row gap-8 bg-[#fbfaf7]">
      {/* Left / Main Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-semibold text-xs text-[#8a8270] mb-4">
          <Link href="/inscriptions" className="text-[#d9704f] hover:text-[#c26040] underline">
            ← Inscriptions
          </Link>
          <span>/</span>
          <span className="text-[#13243c] font-bold">{selectedUser.companyName}</span>
        </div>

        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="font-semibold text-[11px] tracking-[0.2em] uppercase text-[#a3987f] mb-2">
              Compte {selectedUser.role} · {selectedUser.activityType}
            </div>
            <h1 className="m-0 font-bold text-[32px] font-heading uppercase text-[#13243c]">
              {selectedUser.companyName}
            </h1>
          </div>
          <Badge style={badge} className="px-3.5 py-2" />
        </div>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {message && <Alert variant="success" className="mb-4">{message}</Alert>}

        {/* Informations société */}
        <div className="font-bold text-xs tracking-[0.06em] uppercase text-[#8a8270] mb-3">
          Informations société
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-7">
          <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
            <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Raison sociale</div>
            <div className="font-semibold text-sm text-[#13243c] mt-1.5">{selectedUser.companyName}</div>
          </div>
          <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
            <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Activité principale</div>
            <div className="font-semibold text-sm text-[#13243c] mt-1.5">{selectedUser.activityType}</div>
          </div>
          <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
            <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Adresse</div>
            <div className="font-semibold text-sm text-[#13243c] mt-1.5">
              {selectedUser.address ? `${selectedUser.address.street}, ${selectedUser.address.postalCode} ${selectedUser.address.city}, ${selectedUser.address.country}` : 'Non renseignée'}
            </div>
          </div>
          <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
            <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Responsable légal</div>
            <div className="font-semibold text-sm text-[#13243c] mt-1.5">{selectedUser.firstName} {selectedUser.lastName}</div>
          </div>
          <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
            <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Adresse e-mail</div>
            <div className="font-semibold text-sm text-[#13243c] mt-1.5">{selectedUser.email}</div>
          </div>
          <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
            <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Téléphone</div>
            <div className="font-semibold text-sm text-[#13243c] mt-1.5">{selectedUser.phone}</div>
          </div>
        </div>

        {/* Documents fournis */}
        <div className="font-bold text-xs tracking-[0.06em] uppercase text-[#8a8270] mb-3">
          Documents fournis
        </div>
        <div className="flex flex-col gap-3 mb-7">
          {selectedUser.kbisUrl && (
            <DocumentReceivedCard
              fileType="PDF"
              title="Extrait de K-bis / Avis de situation INSEE"
              description="Document officiel justifiant l'immatriculation"
              url={selectedUser.kbisUrl}
            />
          )}
          {selectedUser.cinRectoUrl && (
            <DocumentReceivedCard
              fileType="IMG"
              title="Pièce d'identité - Recto"
              description="Carte nationale d'identité ou passeport"
              url={selectedUser.cinRectoUrl}
            />
          )}
          {selectedUser.cinVersoUrl && (
            <DocumentReceivedCard
              fileType="IMG"
              title="Pièce d'identité - Verso"
              description="Dos de la carte d'identité"
              url={selectedUser.cinVersoUrl}
            />
          )}
          {selectedUser.role === 'vendeur' && selectedUser.bankInfo?.ribUrl && (
            <DocumentReceivedCard
              fileType="PDF"
              title="RIB / Attestation bancaire"
              description="Justificatif de compte bancaire du vendeur"
              url={selectedUser.bankInfo.ribUrl}
            />
          )}
          {!selectedUser.kbisUrl && !selectedUser.cinRectoUrl && !selectedUser.cinVersoUrl && !selectedUser.bankInfo?.ribUrl && (
            <div className="text-xs text-gray-400 italic p-4 bg-white border rounded-[10px]">Aucun document joint pour le moment.</div>
          )}
        </div>

        {/* Vendeur specific section */}
        {selectedUser.role === 'vendeur' && (
          <>
            <div className="font-bold text-xs tracking-[0.06em] uppercase text-[#8a8270] mb-3">
              Spécificités Vendeur (Agrément & Banque)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-7">
              <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
                <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Agrément Préfectoral VHU</div>
                <div className="font-semibold text-sm text-[#13243c] mt-1.5">{selectedUser.vhuNumber || 'Non requis / Non renseigné'}</div>
              </div>
              {selectedUser.bankInfo && (
                <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
                  <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Coordonnées bancaires (RIB)</div>
                  <div className="font-semibold text-xs text-[#13243c] mt-1.5 space-y-0.5">
                    <div><strong>Banque:</strong> {selectedUser.bankInfo.bankName}</div>
                    <div><strong>Titulaire:</strong> {selectedUser.bankInfo.accountHolder}</div>
                    <div><strong>IBAN:</strong> {selectedUser.bankInfo.iban}</div>
                    <div><strong>BIC:</strong> {selectedUser.bankInfo.bic}</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="h-16" aria-hidden="true" />
      </div>

      {/* Right Sticky Decision Box */}
      <div className="w-full xl:w-[360px] shrink-0">
        <div className="border border-[#eceadf] bg-white rounded-[14px] p-6 sticky top-6 shadow-sm">
          <div className="font-bold text-xs tracking-[0.06em] uppercase text-[#8a8270] mb-4">
            Décision administrateur
          </div>

          {selectedUser.status === 'soumis' && (
            <div className="grid grid-cols-3 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setConfirmAction({ type: 'approve' })}
                disabled={actionLoading !== null}
                className="py-2 rounded-[8px] bg-[#2f6f4f] hover:bg-emerald-800 text-white font-bold text-xs uppercase transition cursor-pointer select-none text-center disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'approve' && <Spinner />}
                Valider
              </button>
              <button
                type="button"
                onClick={() => { setDecisionMode('correction'); setError(''); setMessage(''); }}
                className={`py-2 rounded-[8px] font-bold text-xs uppercase transition cursor-pointer select-none text-center ${decisionMode === 'correction' ? 'bg-[#d9704f] text-white ring-2 ring-offset-1 ring-[#d9704f]' : 'bg-[#faf1e4] text-[#b3893f] hover:bg-[#f5e7d4]'}`}
              >
                Correction
              </button>
              <button
                type="button"
                onClick={() => { setDecisionMode('refuser'); setError(''); setMessage(''); }}
                className={`py-2 rounded-[8px] font-bold text-xs uppercase transition cursor-pointer select-none text-center ${decisionMode === 'refuser' ? 'bg-[#9a3b2f] text-white ring-2 ring-offset-1 ring-[#9a3b2f]' : 'bg-[#fbeae7] text-[#9a3b2f] hover:bg-[#f7dad3]'}`}
              >
                Refuser
              </button>
            </div>
          )}

          {selectedUser.status !== 'soumis' && selectedUser.status !== 'valide' && (
            <div className="text-xs text-[#9a917d] italic mb-2">
              Ce dossier a déjà été traité, aucune action de décision n'est disponible.
            </div>
          )}

          {decisionMode && (
            <form onSubmit={handleDecisionSubmit} className="space-y-4 border-t border-[#efece3] pt-4">
              <div>
                <div className="font-semibold text-xs text-[#4c5058] mb-2">
                  Motif(s) de {decisionMode === 'correction' ? 'correction' : 'refus'}
                </div>
                <div className="border border-[#dcd7cb] rounded-[9px] overflow-hidden bg-white">
                  <div
                    onClick={() => setCausesOpen(!causesOpen)}
                    className="h-[42px] px-3.5 flex items-center justify-between cursor-pointer bg-[#fbfaf7] text-xs font-medium"
                  >
                    <span className="text-[#1a2230] font-semibold">{selectedReasons.length} motif(s) sélectionné(s)</span>
                    <span className="text-[#9a917d]">{causesOpen ? '▲' : '▼'}</span>
                  </div>
                  {causesOpen && (
                    <div className="border-t border-[#efece3] py-1.5 max-h-[220px] overflow-y-auto space-y-1">
                      {refusalReasons.map(item => {
                        const isChecked = selectedReasons.includes(item.key);
                        return (
                          <div
                            key={item.key}
                            onClick={() => {
                              if (isChecked) setSelectedReasons(selectedReasons.filter(k => k !== item.key));
                              else setSelectedReasons([...selectedReasons, item.key]);
                            }}
                            className="flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer select-none"
                          >
                            <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center text-[10px] font-bold shrink-0 ${isChecked ? 'bg-[#13243c] border-[#13243c] text-white' : 'border-gray-300 bg-white'}`}>
                              {isChecked ? '✓' : ''}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-xs text-[#1a2230]">{item.label.fr}</div>
                              <div className="text-[11px] text-[#9a917d] mt-0.5">{item.message.fr}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="font-semibold text-xs text-[#4c5058] mb-2">Commentaire explicatif</div>
                <textarea
                  rows={3}
                  value={customComment}
                  onChange={e => setCustomComment(e.target.value)}
                  placeholder="Détaillez les actions attendues de l'utilisateur..."
                  className="w-full border border-[#dcd7cb] rounded-[9px] p-3 font-normal text-xs text-[#1a2230] bg-white focus:outline-none focus:ring-1 focus:ring-[#13243c]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className={`flex-1 py-2.5 rounded-[8px] text-white font-bold text-xs uppercase cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-2 ${decisionMode === 'correction' ? 'bg-[#d9704f] hover:bg-[#c26040]' : 'bg-[#9a3b2f] hover:bg-red-800'}`}
                >
                  {actionLoading === 'decision' && <Spinner />}
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setDecisionMode(null)}
                  disabled={actionLoading !== null}
                  className="px-3 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-[8px] text-xs uppercase cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {selectedUser.status === 'valide' && (
            <div className="border-t border-[#efece3] pt-4 space-y-2">
              <div className="text-xs text-gray-500 font-semibold mb-2">Actions de maintenance :</div>
              <button
                type="button"
                onClick={() => setConfirmAction({ type: 'status', status: 'suspendu' })}
                disabled={actionLoading !== null}
                className="w-full py-2 bg-[#d9704f] hover:bg-[#c26040] text-white font-bold rounded-[8px] text-xs uppercase cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'suspendu' && <Spinner />}
                ⏸ Suspendre le compte
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction({ type: 'status', status: 'bloque' })}
                disabled={actionLoading !== null}
                className="w-full py-2 bg-black hover:bg-gray-800 text-white font-bold rounded-[8px] text-xs uppercase cursor-pointer transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === 'bloque' && <Spinner />}
                🚫 Bloquer définitivement
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction?.type === 'approve' ? 'Valider ce compte' : 'Changer le statut du compte'}
        message={
          confirmAction?.type === 'approve'
            ? 'Valider définitivement ce compte professionnel ?'
            : `Changer le statut du compte en "${confirmAction?.status}" ?`
        }
        confirmLabel={confirmAction?.type === 'approve' ? 'Valider' : 'Confirmer'}
        danger={confirmAction?.type === 'status'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction?.type === 'approve') handleApproveUser();
          else if (confirmAction?.type === 'status') handleUpdateUserStatus(confirmAction.status);
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
