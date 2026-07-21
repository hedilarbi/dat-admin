'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '../../api';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';
import { Badge, getVehicleDossierStatusBadge } from '../../components/StatusBadge';
import BlurZoneEditor from '../../components/vehicleDossier/BlurZoneEditor';
import PhotoTile from '../../components/vehicleDossier/PhotoTile';
import { FUEL_LABELS, type BlurZone, type DossierDocument, type DossierPhoto, type VehicleDossier } from '../../lib/vehicleDossier';

interface RefusalReason {
  key: string;
  label: { fr: string; en: string };
  message: { fr: string; en: string };
  type: 'inscription' | 'document' | 'vehicule';
}

type EditingTarget = { kind: 'photo'; index: number } | { kind: 'expertReport' } | { kind: 'document'; index: number } | null;

export default function DossierVehiculeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [dossier, setDossier] = useState<VehicleDossier | null>(null);
  const [refusalReasons, setRefusalReasons] = useState<RefusalReason[]>([]);

  // État local des médias (photos/documents) — modifiable indépendamment du statut du dossier,
  // sauvegardé séparément via /media (cahier des charges §10.5 : l'admin peut retoucher les
  // zones de flou avant validation, quel que soit le statut).
  const [photos, setPhotos] = useState<DossierPhoto[]>([]);
  const [expertReport, setExpertReport] = useState<DossierDocument | undefined>(undefined);
  const [additionalDocuments, setAdditionalDocuments] = useState<DossierDocument[]>([]);
  const [mediaDirty, setMediaDirty] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);

  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const [applyingBlur, setApplyingBlur] = useState(false);

  const [decisionMode, setDecisionMode] = useState<'correction' | 'refuser' | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customComment, setCustomComment] = useState('');
  const [causesOpen, setCausesOpen] = useState(true);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'approve' | 'decision' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);

  const applyDossier = (d: VehicleDossier) => {
    setDossier(d);
    setPhotos(d.photos);
    setExpertReport(d.expertReport);
    setAdditionalDocuments(d.additionalDocuments);
    setMediaDirty(false);
  };

  const fetchDossier = async () => {
    try {
      const res = await apiRequest(`/admin/vehicle-dossiers/${params.id}`);
      applyDossier(res.dossier);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement du dossier.');
    }
  };

  const fetchRefusalReasons = async () => {
    try {
      const res = await apiRequest('/admin/messages?type=vehicule');
      setRefusalReasons(res.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([fetchDossier(), fetchRefusalReasons()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleApprove = async () => {
    if (!dossier) return;
    setError('');
    setMessage('');
    setActionLoading('approve');
    try {
      await apiRequest(`/admin/vehicle-dossiers/${dossier._id}/validate`, { method: 'POST' });
      router.push('/dossiers');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la validation.');
      setActionLoading(null);
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dossier || !decisionMode) return;
    if (selectedReasons.length === 0) {
      setError('Veuillez sélectionner au moins un motif.');
      return;
    }

    setError('');
    setMessage('');
    setActionLoading('decision');
    try {
      const actionUrl = decisionMode === 'correction'
        ? `/admin/vehicle-dossiers/${dossier._id}/request-correction`
        : `/admin/vehicle-dossiers/${dossier._id}/reject`;

      await apiRequest(actionUrl, {
        method: 'POST',
        body: JSON.stringify({ motifs: selectedReasons, comment: customComment }),
      });

      router.push('/dossiers');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement de la décision.');
      setActionLoading(null);
    }
  };

  // --- Médias : couverture / réordonnancement / flou ---

  const setCoverPhoto = (index: number) => {
    setPhotos((prev) => prev.map((p, i) => ({ ...p, isCover: i === index })));
    setMediaDirty(true);
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    setPhotos((prev) => {
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
    setMediaDirty(true);
  };

  const editingItem: { originalUrl: string; blurZones: BlurZone[]; mimeType?: string } | null = (() => {
    if (!editingTarget) return null;
    if (editingTarget.kind === 'photo') return photos[editingTarget.index] || null;
    if (editingTarget.kind === 'expertReport') return expertReport || null;
    return additionalDocuments[editingTarget.index] || null;
  })();

  const isEditingPdf = editingItem?.mimeType === 'application/pdf';

  const groupZonesByPage = (zones: BlurZone[]) => {
    const byPage = new Map<number, BlurZone[]>();
    for (const zone of zones) {
      const page = zone.page ?? 0;
      if (!byPage.has(page)) byPage.set(page, []);
      byPage.get(page)!.push({ x: zone.x, y: zone.y, width: zone.width, height: zone.height } as BlurZone);
    }
    return Array.from(byPage.entries()).map(([page, zs]) => ({ page, zones: zs }));
  };

  const updateEditingZones = (zones: BlurZone[]) => {
    if (!editingTarget) return;
    if (editingTarget.kind === 'photo') {
      setPhotos((prev) => prev.map((p, i) => (i === editingTarget.index ? { ...p, blurZones: zones } : p)));
    } else if (editingTarget.kind === 'expertReport') {
      setExpertReport((prev) => (prev ? { ...prev, blurZones: zones } : prev));
    } else {
      setAdditionalDocuments((prev) => prev.map((d, i) => (i === editingTarget.index ? { ...d, blurZones: zones } : d)));
    }
  };

  const applyBlurToEditingItem = async () => {
    if (!editingTarget || !editingItem) return;
    setApplyingBlur(true);
    setError('');
    try {
      const res = isEditingPdf
        ? await apiRequest('/vehicle-dossiers/media/pdf-blur', {
            method: 'POST',
            body: JSON.stringify({ pdfUrl: editingItem.originalUrl, pagesZones: groupZonesByPage(editingItem.blurZones) }),
          })
        : await apiRequest('/vehicle-dossiers/media/blur', {
            method: 'POST',
            body: JSON.stringify({ imageUrl: editingItem.originalUrl, zones: editingItem.blurZones }),
          });
      if (editingTarget.kind === 'photo') {
        setPhotos((prev) => prev.map((p, i) => (i === editingTarget.index ? { ...p, processedUrl: res.url } : p)));
      } else if (editingTarget.kind === 'expertReport') {
        setExpertReport((prev) => (prev ? { ...prev, processedUrl: res.url } : prev));
      } else {
        setAdditionalDocuments((prev) => prev.map((d, i) => (i === editingTarget.index ? { ...d, processedUrl: res.url } : d)));
      }
      setMediaDirty(true);
      setEditingTarget(null);
    } catch (err: any) {
      setError(err.message || "Échec de l'application du flou.");
    } finally {
      setApplyingBlur(false);
    }
  };

  const handleSaveMedia = async () => {
    if (!dossier) return;
    setSavingMedia(true);
    setError('');
    setMessage('');
    try {
      const res = await apiRequest(`/admin/vehicle-dossiers/${dossier._id}/media`, {
        method: 'PUT',
        body: JSON.stringify({ photos, expertReport, additionalDocuments }),
      });
      applyDossier(res.dossier);
      setMessage('Modifications médias enregistrées.');
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement des médias.");
    } finally {
      setSavingMedia(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!dossier) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#fbfaf7] text-[#13243c]">
        <p className="font-semibold text-sm">Dossier introuvable.</p>
        <Link href="/dossiers" className="text-xs font-bold text-[#d9704f] hover:underline">← Retour aux dossiers</Link>
      </div>
    );
  }

  const badge = getVehicleDossierStatusBadge(dossier.status);
  const vehicleLabel = [dossier.brand, dossier.model].filter(Boolean).join(' ') || 'Sans nom';
  const canDecide = ['soumis', 'en_attente_validation'].includes(dossier.status);
  const lastRefusal = dossier.refusals[dossier.refusals.length - 1];

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 pb-20 sm:p-6 sm:pb-24 lg:p-10 lg:pb-24 font-sans text-black flex flex-col xl:flex-row gap-6 xl:gap-8 bg-[#fbfaf7]">
      {/* Left / Main Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-semibold text-xs text-[#8a8270] mb-4">
          <Link href="/dossiers" className="text-[#d9704f] hover:text-[#c26040] underline">
            ← Dossiers véhicules
          </Link>
          <span>/</span>
          <span className="text-[#13243c] font-bold">{vehicleLabel}</span>
        </div>

        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="font-semibold text-[11px] tracking-[0.2em] uppercase text-[#a3987f] mb-2">
              Vendeur : {dossier.seller?.companyName || 'Inconnu'}
            </div>
            <h1 className="m-0 font-bold text-[32px] font-heading uppercase text-[#13243c]">
              {vehicleLabel}
            </h1>
          </div>
          <Badge style={badge} className="px-3.5 py-2" />
        </div>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {message && <Alert variant="success" className="mb-4">{message}</Alert>}

        {lastRefusal && (
          <div className="mb-7 border border-[#f3d9ce] bg-[#fdf6f2] rounded-[10px] p-4">
            <div className="font-bold text-xs text-[#9a3b2f] uppercase tracking-wide mb-2">Dernière décision administrateur</div>
            <ul className="list-disc pl-4 text-xs text-[#1a2230] space-y-0.5 mb-2">
              {lastRefusal.motifsLabels.map((label, i) => <li key={i}>{label}</li>)}
            </ul>
            {lastRefusal.comment && <p className="text-xs italic text-[#5a5e66]">&quot;{lastRefusal.comment}&quot;</p>}
          </div>
        )}

        {/* Informations véhicule */}
        <div className="font-bold text-xs tracking-[0.06em] uppercase text-[#8a8270] mb-3">
          Informations véhicule
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-7">
          {[
            ['Marque', dossier.brand],
            ['Modèle', dossier.model],
            ['Année', dossier.year],
            ['Kilométrage', dossier.mileage ? `${dossier.mileage} km` : undefined],
            ['Motorisation', dossier.engine],
            ['Carburant', dossier.fuelType ? FUEL_LABELS[dossier.fuelType] : undefined],
            ['Numéro VIN / châssis', dossier.vin],
            ['État du véhicule', dossier.vehicleCondition],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px]">
              <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">{label}</div>
              <div className="font-semibold text-sm text-[#13243c] mt-1.5">{value ?? 'Non renseigné'}</div>
            </div>
          ))}
          <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px] sm:col-span-2">
            <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Description</div>
            <div className="font-semibold text-sm text-[#13243c] mt-1.5">{dossier.description || 'Non renseignée'}</div>
          </div>
          <div className="border border-[#eceadf] bg-white rounded-[10px] p-[14px_16px] sm:col-span-2">
            <div className="font-medium text-[11px] text-[#9a917d] uppercase tracking-[0.04em]">Prix de réserve confidentiel</div>
            <div className="font-semibold text-sm text-[#13243c] mt-1.5">{dossier.reservePrice ? `${dossier.reservePrice} €` : 'Non renseigné'}</div>
          </div>
        </div>

        {/* Photos */}
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-xs tracking-[0.06em] uppercase text-[#8a8270]">Photos du véhicule</div>
          {mediaDirty && (
            <button
              type="button"
              onClick={handleSaveMedia}
              disabled={savingMedia}
              className="h-9 px-4 bg-[#13243c] hover:bg-slate-800 text-white text-[11px] font-bold uppercase rounded-[7px] transition disabled:opacity-50 flex items-center gap-2"
            >
              {savingMedia && <Spinner />}
              Enregistrer les modifications médias
            </button>
          )}
        </div>
        {photos.length === 0 ? (
          <div className="text-xs text-gray-400 italic p-4 bg-white border rounded-[10px] mb-7">Aucune photo ajoutée.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-7">
            {photos.map((photo, index) => (
              <PhotoTile
                key={photo._id || index}
                photo={photo}
                index={index}
                total={photos.length}
                onSetCover={() => setCoverPhoto(index)}
                onMoveUp={() => movePhoto(index, -1)}
                onMoveDown={() => movePhoto(index, 1)}
                onEditBlur={() => setEditingTarget({ kind: 'photo', index })}
              />
            ))}
          </div>
        )}

        {/* Documents */}
        <div className="font-bold text-xs tracking-[0.06em] uppercase text-[#8a8270] mb-3">
          Documents
        </div>
        <div className="flex flex-col gap-3 mb-7">
          {expertReport ? (
            <div className="border border-[#eceadf] bg-white rounded-[12px] p-[14px_18px] flex items-center gap-4">
              <div className="w-10 h-10 rounded-[9px] bg-[#f1efe8] flex items-center justify-center font-semibold text-[10px] text-[#a3987f]">
                {expertReport.mimeType?.startsWith('image/') ? 'IMG' : 'PDF'}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-[#13243c]">Rapport expert</div>
                <div className="text-xs text-[#9a917d] mt-0.5">{expertReport.label || 'Document'}</div>
              </div>
              {expertReport.processedUrl && (
                <span className="font-semibold text-xs px-3 py-1 rounded-full bg-[#fdece4] text-[#d9704f]">Flou appliqué</span>
              )}
              {(expertReport.mimeType?.startsWith('image/') || expertReport.mimeType === 'application/pdf') && (
                <button
                  type="button"
                  onClick={() => setEditingTarget({ kind: 'expertReport' })}
                  className="font-semibold text-xs text-[#13243c] border border-[#dcd7cb] rounded-[7px] px-3 py-1.5 hover:bg-gray-50"
                >
                  Flouter
                </button>
              )}
              <a href={expertReport.originalUrl} target="_blank" rel="noreferrer" className="font-semibold text-xs text-[#13243c] underline hover:opacity-80">
                Consulter
              </a>
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic p-4 bg-white border rounded-[10px]">Aucun rapport expert ajouté.</div>
          )}

          {additionalDocuments.map((doc, index) => (
            <div key={doc._id || index} className="border border-[#eceadf] bg-white rounded-[12px] p-[14px_18px] flex items-center gap-4">
              <div className="w-10 h-10 rounded-[9px] bg-[#f1efe8] flex items-center justify-center font-semibold text-[10px] text-[#a3987f]">
                {doc.mimeType?.startsWith('image/') ? 'IMG' : 'PDF'}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-[#13243c]">{doc.label || 'Document complémentaire'}</div>
              </div>
              {doc.processedUrl && (
                <span className="font-semibold text-xs px-3 py-1 rounded-full bg-[#fdece4] text-[#d9704f]">Flou appliqué</span>
              )}
              {(doc.mimeType?.startsWith('image/') || doc.mimeType === 'application/pdf') && (
                <button
                  type="button"
                  onClick={() => setEditingTarget({ kind: 'document', index })}
                  className="font-semibold text-xs text-[#13243c] border border-[#dcd7cb] rounded-[7px] px-3 py-1.5 hover:bg-gray-50"
                >
                  Flouter
                </button>
              )}
              <a href={doc.originalUrl} target="_blank" rel="noreferrer" className="font-semibold text-xs text-[#13243c] underline hover:opacity-80">
                Consulter
              </a>
            </div>
          ))}
        </div>

        <div className="h-16" aria-hidden="true" />
      </div>

      {/* Right Sticky Decision Box */}
      <div className="w-full xl:w-[360px] shrink-0">
        <div className="border border-[#eceadf] bg-white rounded-[14px] p-6 sticky top-6 shadow-sm">
          <div className="font-bold text-xs tracking-[0.06em] uppercase text-[#8a8270] mb-4">
            Décision administrateur
          </div>

          {canDecide && (
            <div className="grid grid-cols-3 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setConfirmApprove(true)}
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

          {!canDecide && (
            <div className="text-xs text-[#9a917d] italic mb-2">
              Ce dossier est au statut &quot;{badge.label}&quot; — aucune action de décision n&apos;est disponible. Les zones de flou restent modifiables ci-contre.
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
                      {refusalReasons.length === 0 && (
                        <div className="px-3 py-3 text-[11px] text-gray-400 italic">
                          Aucun motif de type &quot;véhicule&quot; configuré. Ajoutez-en depuis Configuration → Messages.
                        </div>
                      )}
                      {refusalReasons.map((item) => {
                        const isChecked = selectedReasons.includes(item.key);
                        return (
                          <div
                            key={item.key}
                            onClick={() => {
                              if (isChecked) setSelectedReasons(selectedReasons.filter((k) => k !== item.key));
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
                  onChange={(e) => setCustomComment(e.target.value)}
                  placeholder="Détaillez les actions attendues du vendeur..."
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
        </div>
      </div>

      <ConfirmModal
        open={confirmApprove}
        title="Valider ce dossier"
        message="Valider définitivement ce dossier véhicule ? Il pourra ensuite être programmé dans une session d'appel d'offres."
        confirmLabel="Valider"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => { setConfirmApprove(false); handleApprove(); }}
      />

      {editingTarget && editingItem && (
        <BlurZoneEditor
          imageUrl={editingItem.originalUrl}
          mimeType={editingItem.mimeType}
          zones={editingItem.blurZones}
          onZonesChange={updateEditingZones}
          onValidate={applyBlurToEditingItem}
          validating={applyingBlur}
          onClose={() => setEditingTarget(null)}
        />
      )}
    </div>
  );
}
