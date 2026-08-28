'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '../../api';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';
import BlurZoneEditor from '../../components/vehicleDossier/BlurZoneEditor';
import PhotoTile from '../../components/vehicleDossier/PhotoTile';
import type { BlurZone, DossierDocument, DossierPhoto, VehicleDossier } from '../../lib/vehicleDossier';
import { ArrowLeft, Pencil, Save, X } from 'lucide-react';

interface RefusalReason {
  key: string;
  label: { fr: string; en: string };
  message: { fr: string; en: string };
  type: 'inscription' | 'document' | 'vehicule';
}

type EditingTarget = { kind: 'photo'; index: number } | { kind: 'expertReport' } | { kind: 'document'; index: number } | null;

const FALLBACK_VEHICLE_REASONS: RefusalReason[] = [
  {
    key: 'photo_compteur_manquante',
    label: { fr: 'Photo du compteur manquante', en: 'Odometer photo missing' },
    message: {
      fr: 'La photo du compteur kilométrique est absente ou non lisible. Veuillez ajouter une photo nette du compteur.',
      en: 'The odometer photo is missing or unreadable. Please provide a clear photo of the dashboard mileage.',
    },
    type: 'vehicule',
  },
  {
    key: 'rapport_expertise_illisible',
    label: { fr: "Rapport d'expertise illisible", en: 'Expert report unreadable' },
    message: {
      fr: "Le rapport d'expertise sinistre téléversé n'est pas lisible ou incomplet. Merci de téléverser un fichier PDF original.",
      en: 'The uploaded expert report is unreadable or incomplete. Please upload an original PDF file.',
    },
    type: 'vehicule',
  },
  {
    key: 'carte_grise_manquante',
    label: { fr: 'Carte grise manquante ou illisible', en: 'Registration document missing' },
    message: {
      fr: 'La carte grise (recto/verso) est manquante ou floue. Merci de fournir un scan lisible.',
      en: 'The registration document is missing or blurry. Please upload a clear scan.',
    },
    type: 'vehicule',
  },
  {
    key: 'prix_reserve_incoherent',
    label: { fr: 'Prix de réserve incohérent', en: 'Inconsistent reserve price' },
    message: {
      fr: 'Le prix de réserve indiqué semble incohérent au vu de l\'état et du marché du véhicule.',
      en: 'The indicated reserve price appears inconsistent given the vehicle condition.',
    },
    type: 'vehicule',
  },
];

const renderFormattedText = (text: string) =>
  text.split(/(\*\*.*?\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  );

const isDocumentBlurrable = (document: DossierDocument) => {
  const mime = document.mimeType?.toLowerCase() || '';
  const url = document.originalUrl.toLowerCase().split('?')[0];
  return mime === 'application/pdf' || mime.startsWith('image/') || /\.(pdf|png|jpe?g|webp)$/.test(url);
};

function DocumentRow({ document, title, onEditBlur }: { document: DossierDocument; title: string; onEditBlur: () => void }) {
  const zonesCount = document.blurZones?.length || 0;
  const displayUrl = document.processedUrl || document.originalUrl;
  const fileType = document.mimeType === 'application/pdf' || document.originalUrl.toLowerCase().includes('.pdf') ? 'PDF' : 'IMAGE';

  return (
    <div className="border border-[#eceadf] rounded-[12px] p-3.5 sm:p-4.5 flex flex-wrap items-center gap-3 sm:gap-4 bg-white">
      <div className="w-10 h-10 rounded-[9px] bg-[#f1efe8] shrink-0 flex items-center justify-center font-semibold text-[10px] leading-none text-[#a3987f]">
        {fileType}
      </div>
      <div className="flex-1 min-w-[180px]">
        <div className="font-semibold text-[14px] leading-snug text-[#13243c] truncate">{title}</div>
        <div className="font-normal text-[12px] leading-relaxed text-[#5a5e66] mt-0.5">
          {document.processedUrl ? 'Version floutée disponible' : fileType}
          {zonesCount > 0 ? ` · ${zonesCount} zone(s) de flou` : ''}
        </div>
      </div>
      <a href={displayUrl} target="_blank" rel="noreferrer" className="font-semibold text-[12px] text-[#13243c] underline hover:opacity-80 shrink-0">
        {document.processedUrl ? 'Voir le document flouté' : 'Consulter'}
      </a>
      {isDocumentBlurrable(document) && (
        <button type="button" onClick={onEditBlur} className="btn btn-primary shrink-0">
          {zonesCount > 0 ? 'Modifier le flou' : 'Ajouter un flou'}
        </button>
      )}
    </div>
  );
}

export default function AdminDossierVehiculeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [dossier, setDossier] = useState<VehicleDossier | null>(null);
  const [refusalReasons, setRefusalReasons] = useState<RefusalReason[]>([]);

  const [photos, setPhotos] = useState<DossierPhoto[]>([]);
  const [expertReport, setExpertReport] = useState<DossierDocument | undefined>(undefined);
  const [additionalDocuments, setAdditionalDocuments] = useState<DossierDocument[]>([]);
  const [mediaDirty, setMediaDirty] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);

  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const [applyingBlur, setApplyingBlur] = useState(false);

  // Decision state
  const [decision, setDecision] = useState<'valider' | 'correction' | 'rejeter'>('correction');
  const [causesOpen, setCausesOpen] = useState(true);
  const [selectedCauses, setSelectedCauses] = useState<string[]>([]);
  const [customComment, setCustomComment] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [editingDossier, setEditingDossier] = useState(false);
  const [editForm, setEditForm] = useState<VehicleDossier | null>(null);
  const [savingDossier, setSavingDossier] = useState(false);

  const applyDossier = (d: VehicleDossier) => {
    setDossier(d);
    setPhotos(d.photos || []);
    setExpertReport(d.expertReport);
    setAdditionalDocuments(d.additionalDocuments || []);
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
      const list: RefusalReason[] = res.messages && res.messages.length > 0 ? res.messages : FALLBACK_VEHICLE_REASONS;
      setRefusalReasons(list);
    } catch (err) {
      setRefusalReasons(FALLBACK_VEHICLE_REASONS);
    }
  };

  useEffect(() => {
    Promise.all([fetchDossier(), fetchRefusalReasons()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const toggleCause = (reason: RefusalReason) => {
    const isChecked = selectedCauses.includes(reason.key);
    let nextSelected: string[];

    if (isChecked) {
      nextSelected = selectedCauses.filter((k) => k !== reason.key);
      if (reason.message?.fr && customComment.includes(reason.message.fr)) {
        const updated = customComment
          .replace(reason.message.fr, '')
          .replace(/\n\n+/g, '\n')
          .trim();
        setCustomComment(updated);
      }
    } else {
      nextSelected = [...selectedCauses, reason.key];
      if (reason.message?.fr && !customComment.includes(reason.message.fr)) {
        const updated = customComment
          ? `${customComment}\n${reason.message.fr}`
          : reason.message.fr;
        setCustomComment(updated);
      }
    }

    setSelectedCauses(nextSelected);
  };

  const handleDecisionSubmit = async () => {
    if (!dossier) return;

    if (decision !== 'valider' && selectedCauses.length === 0) {
      setError('Veuillez sélectionner au moins un motif de décision.');
      return;
    }

    setError('');
    setMessage('');
    setActionLoading(true);

    try {
      if (decision === 'valider') {
        await apiRequest(`/admin/vehicle-dossiers/${dossier._id}/validate`, { method: 'POST' });
        setMessage('Dossier validé avec succès.');
      } else if (decision === 'correction') {
        await apiRequest(`/admin/vehicle-dossiers/${dossier._id}/request-correction`, {
          method: 'POST',
          body: JSON.stringify({ motifs: selectedCauses, comment: customComment }),
        });
        setMessage('Demande de correction envoyée au vendeur.');
      } else if (decision === 'rejeter') {
        await apiRequest(`/admin/vehicle-dossiers/${dossier._id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ motifs: selectedCauses, comment: customComment }),
        });
        setMessage('Dossier refusé.');
      }

      setTimeout(() => {
        router.push('/dossiers');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement de la décision.');
    } finally {
      setActionLoading(false);
    }
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

  const startEditingDossier = () => {
    if (!dossier) return;
    setEditForm({ ...dossier, registrationCardMissingReasons: [...(dossier.registrationCardMissingReasons || [])] });
    setEditingDossier(true);
    setError('');
    setMessage('');
  };

  const updateEditField = <K extends keyof VehicleDossier>(key: K, value: VehicleDossier[K]) => {
    setEditForm((current) => current ? { ...current, [key]: value } : current);
  };

  const handleSaveDossier = async () => {
    if (!dossier || !editForm) return;
    setSavingDossier(true);
    setError('');
    setMessage('');
    try {
      const res = await apiRequest(`/admin/vehicle-dossiers/${dossier._id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      applyDossier(res.dossier);
      setEditForm(null);
      setEditingDossier(false);
      setMessage('Informations du dossier mises à jour.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement du dossier.");
    } finally {
      setSavingDossier(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!dossier) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white text-[#13243c] p-10">
        <p className="font-semibold text-sm">Dossier introuvable.</p>
        <Link href="/dossiers" className="inline-flex items-center gap-2 text-xs font-bold text-[#d9704f] hover:underline"><ArrowLeft size={15} /> Retour aux dossiers</Link>
      </div>
    );
  }

  const vehicleLabel = [dossier.brand, dossier.model].filter(Boolean).join(' ') || 'Sans nom';
  const sellerName = dossier.seller?.companyName || (dossier.seller?.firstName ? `${dossier.seller.firstName} ${dossier.seller.lastName || ''}` : 'Vendeur');
  const plate = dossier.registrationNumber || dossier.vin || '—';
  const reservePriceStr = dossier.reservePrice ? `${dossier.reservePrice.toLocaleString('fr-FR')} €` : 'Non renseigné';
  const sessionVis = dossier.session ? `#${dossier.session}` : 'Non affectée';
  const missingReasonLabels: Record<string, string> = {
    declaration_perte: 'Déclaration de perte',
    declaration_vol: 'Déclaration de vol',
    autre: 'Autre',
  };
  const displayedDossier = editingDossier && editForm ? editForm : dossier;
  const vehicleInformation: Array<{ key: keyof VehicleDossier; label: string; type?: 'number' | 'procedure' | 'gearbox' | 'fuel' }> = [
    { key: 'registrationNumber', label: 'Immatriculation' }, { key: 'registrationCountry', label: 'Pays' },
    { key: 'brand', label: 'Marque' }, { key: 'model', label: 'Modèle' }, { key: 'year', label: 'Année', type: 'number' },
    { key: 'firstRegistrationDate', label: 'Date de première circulation' }, { key: 'co2', label: 'CO₂' },
    { key: 'energyLabel', label: 'Énergie' }, { key: 'fuelType', label: 'Type d’énergie', type: 'fuel' },
    { key: 'vehicleGenre', label: 'Genre' }, { key: 'fiscalPower', label: 'Puissance fiscale' },
    { key: 'bodyType', label: 'Carrosserie' }, { key: 'vin', label: 'N° de série (VIN)' },
    { key: 'gearbox', label: 'Boîte de vitesse', type: 'gearbox' }, { key: 'passengerCount', label: 'Nombre de passagers' },
    { key: 'doorCount', label: 'Nombre de portes' }, { key: 'color', label: 'Couleur' },
    { key: 'mileage', label: 'Kilométrage', type: 'number' }, { key: 'vrade', label: 'VRADE' },
    { key: 'procedure', label: 'Procédure', type: 'procedure' }, { key: 'engine', label: 'Moteur' },
  ];

  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'soumis':
      case 'en_attente_validation':
        return { label: 'En attente de validation', color: '#b3893f', bg: '#faf1e4' };
      case 'valide':
        return { label: 'Validé', color: '#2f6f4f', bg: '#e9f4ee' };
      case 'refuse':
        return { label: 'Rejeté', color: '#9a3b2f', bg: '#fbeae7' };
      case 'correction_demandee':
        return { label: 'Correction demandée', color: '#d9704f', bg: '#fdece4' };
      default:
        return { label: status, color: '#5a5e66', bg: '#eef1f5' };
    }
  };

  const statusMeta = getStatusMeta(dossier.status);
  const isPendingDecision = dossier.status === 'soumis' || dossier.status === 'en_attente_validation';
  const showDecisionHistory =
    (dossier.status === 'refuse' || dossier.status === 'correction_demandee') &&
    dossier.refusals?.length > 0;

  return (
    <div className="flex-1 w-full bg-white text-black font-sans min-h-full px-6 pt-6 pb-24 sm:px-8 sm:pt-8 sm:pb-28 lg:px-10 lg:pt-10 lg:pb-32 flex flex-col xl:flex-row gap-8">
      {/* Left Main Content */}
      <div className="flex-1 min-w-0 pb-24 sm:pb-28 lg:pb-32">
        {/* Breadcrumb */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href="/dossiers" className="btn btn-secondary gap-2">
            <ArrowLeft size={16} /> Retour aux dossiers
          </Link>
          <span className="font-semibold text-[12px] text-[#4c5058]">{vehicleLabel} · {plate}</span>
        </div>

        {/* Title Header */}
        <div className="flex justify-between items-start gap-4 mb-6">
          <div className="min-w-0">
            <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
              {sellerName}{dossier.procedure ? ` · ${dossier.procedure}` : ''}
            </div>
            <h1 className="m-0 font-bold text-[32px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
              {vehicleLabel}
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {editingDossier ? <>
              <button type="button" onClick={() => { setEditingDossier(false); setEditForm(null); }} disabled={savingDossier} className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#dcd7cb] bg-white px-4 text-[11px] font-bold uppercase text-[#13243c] hover:bg-gray-50 disabled:opacity-50"><X size={15} /> Annuler</button>
              <button type="button" onClick={handleSaveDossier} disabled={savingDossier} className="btn btn-primary gap-2 disabled:opacity-50">{savingDossier ? <Spinner /> : <Save size={15} />} Enregistrer</button>
            </> : <button type="button" onClick={startEditingDossier} className="btn btn-accent gap-2"><Pencil size={15} /> Modifier</button>}
            <span className="font-semibold text-[11px] leading-none px-3.5 py-2 rounded-full whitespace-nowrap" style={{ background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>
          </div>
        </div>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {message && <Alert variant="success" className="mb-4">{message}</Alert>}

        {showDecisionHistory && (
          <div className="mb-7">
            <div className="font-bold text-[12px] leading-none uppercase tracking-[0.06em] text-[#d9704f] mb-3">
              Historique des motifs
            </div>
            <div className="flex flex-col gap-3">
              {[...dossier.refusals].reverse().map((refusal, index) => {
                const reasons = refusal.motifsLabels?.length ? refusal.motifsLabels : refusal.motifs;

                return (
                  <div
                    key={`${refusal.date}-${index}`}
                    className="rounded-[12px] border border-[#e7c9c1] bg-[#fff8f6] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold text-[#6b3129]">
                      <span>
                        Décision du {new Date(refusal.date).toLocaleDateString('fr-FR')}
                      </span>
                      {refusal.resubmittedAt && (
                        <span className="text-[#4c5058]">
                          Dossier soumis à nouveau le{' '}
                          {new Date(refusal.resubmittedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>

                    {reasons?.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] font-medium leading-relaxed text-[#3f302d]">
                        {reasons.map((reason, reasonIndex) => (
                          <li key={`${reason}-${reasonIndex}`}>{reason}</li>
                        ))}
                      </ul>
                    )}

                    {refusal.comment && (
                      <p className="mt-3 whitespace-pre-wrap rounded-[8px] bg-white px-3 py-2 text-[13px] leading-relaxed text-[#3f302d]">
                        {refusal.comment}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="font-bold text-[12px] leading-none uppercase tracking-[0.06em] text-[#d9704f] mb-3">
          Informations du vendeur
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4 mb-7">
          <div className="border border-[#eceadf] rounded-[10px] p-3.5 sm:p-4">
            <div className="font-medium text-[11px] leading-none text-[#5a5e66] uppercase tracking-[0.04em] mb-1.5">Société</div>
            <div className="font-semibold text-[14px] leading-tight text-[#13243c] break-words">{dossier.seller?.companyName || 'Non renseignée'}</div>
          </div>
          <div className="border border-[#eceadf] rounded-[10px] p-3.5 sm:p-4">
            <div className="font-medium text-[11px] leading-none text-[#5a5e66] uppercase tracking-[0.04em] mb-1.5">Responsable</div>
            <div className="font-semibold text-[14px] leading-tight text-[#13243c] break-words">{[dossier.seller?.firstName, dossier.seller?.lastName].filter(Boolean).join(' ') || 'Non renseigné'}</div>
          </div>
          <div className="border border-[#eceadf] rounded-[10px] p-3.5 sm:p-4">
            <div className="font-medium text-[11px] leading-none text-[#5a5e66] uppercase tracking-[0.04em] mb-1.5">E-mail</div>
            <div className="font-semibold text-[14px] leading-tight text-[#13243c] break-all">{dossier.seller?.email || 'Non renseigné'}</div>
          </div>
          <div className="border border-[#eceadf] rounded-[10px] p-3.5 sm:p-4">
            <div className="font-medium text-[11px] leading-none text-[#5a5e66] uppercase tracking-[0.04em] mb-1.5">Téléphone</div>
            <div className="font-semibold text-[14px] leading-tight text-[#13243c] break-words">{dossier.seller?.phone || 'Non renseigné'}</div>
          </div>
        </div>

        {/* Informations Véhicule Grid */}
        <div className="font-bold text-[12px] leading-none uppercase tracking-[0.06em] text-[#d9704f] mb-3">
          Informations véhicule
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-7">
          {vehicleInformation.map(({ key, label, type }) => {
            const rawValue = displayedDossier[key];
            const displayValue = key === 'mileage' && typeof rawValue === 'number' ? `${rawValue.toLocaleString('fr-FR')} km` : key === 'co2' && rawValue ? `${rawValue} g/km` : String(rawValue ?? '');
            return <div key={key} className="border border-[#eceadf] rounded-[10px] p-3.5 sm:p-4">
              <div className="font-medium text-[11px] leading-none text-[#5a5e66] uppercase tracking-[0.04em] mb-1.5">
                {label}
              </div>
              {editingDossier ? (
                type === 'procedure' ? <select value={String(rawValue ?? '')} onChange={(event) => updateEditField('procedure', (event.target.value || undefined) as VehicleDossier['procedure'])} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-sm"><option value="">Sélectionner</option>{['VEI', 'VE', 'TNR', 'RIV / VE', 'RIV'].map((item) => <option key={item}>{item}</option>)}</select>
                : type === 'gearbox' ? <select value={String(rawValue ?? '')} onChange={(event) => updateEditField('gearbox', event.target.value)} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-sm"><option value="">Sélectionner</option><option value="M">Manuelle</option><option value="A">Automatique</option></select>
                : type === 'fuel' ? <select value={String(rawValue ?? '')} onChange={(event) => updateEditField('fuelType', (event.target.value || undefined) as VehicleDossier['fuelType'])} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-sm"><option value="">Sélectionner</option>{[['essence', 'Essence'], ['diesel', 'Diesel'], ['hybride', 'Hybride'], ['electrique', 'Électrique'], ['gpl', 'GPL'], ['autre', 'Autre']].map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
                : <input type={type === 'number' ? 'number' : 'text'} min={type === 'number' ? 0 : undefined} value={String(rawValue ?? '')} onChange={(event) => updateEditField(key, (type === 'number' ? (event.target.value === '' ? undefined : Number(event.target.value)) : event.target.value) as never)} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] px-2 text-sm text-[#13243c] focus:border-[#13243c] focus:outline-none" />
              ) : <div className="font-semibold text-[14px] leading-tight text-[#13243c] break-words">{displayValue || 'Non renseigné'}</div>}
            </div>;
          })}
        </div>

        <div className="font-bold text-[12px] leading-none uppercase tracking-[0.06em] text-[#d9704f] mb-3">
          Informations complémentaires
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-7">
          <div className="border border-[#eceadf] rounded-[10px] p-4 sm:col-span-2">
            <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-1.5">Adresse de la voiture</div>
            {editingDossier ? <input value={editForm?.vehicleAddress || ''} onChange={(event) => updateEditField('vehicleAddress', event.target.value)} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] px-3 text-sm" /> : <div className="font-semibold text-[14px] text-[#13243c]">{dossier.vehicleAddress || 'Non renseignée'}</div>}
          </div>
          <div className="border border-[#eceadf] rounded-[10px] p-4">
            <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-1.5">Carte grise disponible</div>
            {editingDossier ? <select value={String(editForm?.registrationCardAvailable ?? '')} onChange={(event) => updateEditField('registrationCardAvailable', event.target.value === 'true')} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-sm"><option value="true">Oui</option><option value="false">Non</option></select> : <div className="font-semibold text-[14px] text-[#13243c]">{dossier.registrationCardAvailable === true ? 'Oui' : dossier.registrationCardAvailable === false ? 'Non' : 'Non renseigné'}</div>}
          </div>
          <div className="border border-[#eceadf] rounded-[10px] p-4">
            <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-1.5">Prix de réserve / Session</div>
            {editingDossier ? <div className="flex items-center gap-2"><input type="number" min="0" value={editForm?.reservePrice ?? ''} onChange={(event) => updateEditField('reservePrice', event.target.value === '' ? undefined : Number(event.target.value))} className="h-10 min-w-0 flex-1 rounded-[7px] border border-[#dcd7cb] px-2 text-sm" /><span className="text-xs text-[#5a5e66]">€ · {sessionVis}</span></div> : <div className="font-semibold text-[14px] text-[#13243c]">{reservePriceStr} · {sessionVis}</div>}
          </div>
          {displayedDossier.registrationCardAvailable === false && (
            <>
              <div className="border border-[#eceadf] rounded-[10px] p-4">
                <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-1.5">Motif d’absence de carte grise</div>
                <div className="font-semibold text-[14px] text-[#13243c]">
                  {editingDossier ? <div className="flex flex-wrap gap-3">{(['declaration_perte', 'declaration_vol', 'autre'] as const).map((reason) => <label key={reason} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(editForm?.registrationCardMissingReasons || []).includes(reason)} onChange={() => updateEditField('registrationCardMissingReasons', (editForm?.registrationCardMissingReasons || []).includes(reason) ? (editForm?.registrationCardMissingReasons || []).filter((item) => item !== reason) : [...(editForm?.registrationCardMissingReasons || []), reason])} />{missingReasonLabels[reason]}</label>)}</div> : dossier.registrationCardMissingReasons?.length ? dossier.registrationCardMissingReasons.map((reason) => missingReasonLabels[reason] || reason).join(', ') : 'Non renseigné'}
                </div>
              </div>
              <div className="border border-[#eceadf] rounded-[10px] p-4">
                <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-1.5">Fiche d’identification disponible</div>
                {editingDossier ? <select value={String(editForm?.identificationSheetAvailable ?? false)} onChange={(event) => updateEditField('identificationSheetAvailable', event.target.value === 'true')} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] bg-white px-2 text-sm"><option value="true">Oui</option><option value="false">Non</option></select> : <div className="font-semibold text-[14px] text-[#13243c]">{dossier.identificationSheetAvailable ? 'Oui' : 'Non'}</div>}
              </div>
              <div className="border border-[#eceadf] rounded-[10px] p-4 sm:col-span-2">
                <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-1.5">Numéro du livre de police</div>
                {editingDossier ? <input value={editForm?.policeBookNumber || ''} onChange={(event) => updateEditField('policeBookNumber', event.target.value)} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] px-3 text-sm" /> : <div className="font-semibold text-[14px] text-[#13243c]">{dossier.policeBookNumber || 'Non renseigné'}</div>}
              </div>
            </>
          )}
          {displayedDossier.registrationCardAvailable === true && (
            <div className="border border-[#eceadf] rounded-[10px] p-4 sm:col-span-2">
              <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-1.5">Numéro du livre de police</div>
              {editingDossier ? <input value={editForm?.policeBookNumber || ''} onChange={(event) => updateEditField('policeBookNumber', event.target.value)} className="h-10 w-full rounded-[7px] border border-[#dcd7cb] px-3 text-sm" /> : <div className="font-semibold text-[14px] text-[#13243c]">{dossier.policeBookNumber || 'Non renseigné'}</div>}
            </div>
          )}
          <div className="border border-[#eceadf] rounded-[10px] p-4 sm:col-span-2">
            <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-2">Description du choc</div>
            {editingDossier ? <textarea rows={5} value={editForm?.description || ''} onChange={(event) => updateEditField('description', event.target.value)} className="w-full rounded-[7px] border border-[#dcd7cb] p-3 text-sm" /> : <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#13243c]">{dossier.description ? renderFormattedText(dossier.description) : 'Non renseignée'}</div>}
          </div>
          <div className="border border-[#eceadf] rounded-[10px] p-4 sm:col-span-2">
            <div className="font-medium text-[11px] uppercase tracking-[0.04em] text-[#5a5e66] mb-2">Détails de l’état</div>
            {editingDossier ? <textarea rows={4} value={editForm?.conditionDetails || ''} onChange={(event) => updateEditField('conditionDetails', event.target.value)} className="w-full rounded-[7px] border border-[#dcd7cb] p-3 text-sm" /> : <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#13243c]">{dossier.conditionDetails || 'Non renseigné'}</div>}
          </div>
        </div>

        {/* Photos Section */}
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-[12px] leading-none uppercase tracking-[0.06em] text-[#d9704f]">
            Photos
          </div>
          {mediaDirty && (
            <button
              type="button"
              onClick={handleSaveMedia}
              disabled={savingMedia}
              className="btn btn-primary disabled:opacity-50 gap-1.5"
            >
              {savingMedia && <Spinner />}
              Enregistrer modifications
            </button>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="text-xs text-gray-400 italic p-4 bg-white border border-[#eceadf] rounded-[10px] mb-7">
            Aucune photo enregistrée.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 mb-7">
            {photos.map((photo, index) => (
              <PhotoTile
                key={photo._id || index}
                photo={photo}
                onEditBlur={() => setEditingTarget({ kind: 'photo', index })}
              />
            ))}
          </div>
        )}

        {/* Documents fournis */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-bold text-[12px] leading-none uppercase tracking-[0.06em] text-[#d9704f]">
            Documents fournis
          </div>
          {mediaDirty && (
            <button type="button" onClick={handleSaveMedia} disabled={savingMedia} className="btn btn-primary disabled:opacity-50 gap-1.5">
              {savingMedia && <Spinner />}
              Enregistrer les floutages
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 mb-7">
          {expertReport ? (
            <DocumentRow document={expertReport} title={expertReport.label || "Rapport d'expertise sinistre"} onEditBlur={() => setEditingTarget({ kind: 'expertReport' })} />
          ) : (
            <div className="border border-dashed border-[#dcd7cb] rounded-[12px] p-4 bg-[#fbfaf7] text-[13px] text-[#4c5058]">
              Aucun rapport d’expert fourni — document optionnel, fortement recommandé.
            </div>
          )}
          {additionalDocuments.map((document, index) => (
            <DocumentRow key={document._id || `${document.originalUrl}-${index}`} document={document} title={document.label || `Document complémentaire ${index + 1}`} onEditBlur={() => setEditingTarget({ kind: 'document', index })} />
          ))}
        </div>
      </div>

      {/* Right Decision Panel */}
      {isPendingDecision && (
        <div className="w-full xl:w-[360px] shrink-0 pb-24 sm:pb-28 lg:pb-32">
          <div className="border border-[#eceadf] rounded-[14px] p-6 bg-white sticky top-6 shadow-xs">
          <div className="font-bold text-[12px] leading-none uppercase tracking-[0.06em] text-[#d9704f] mb-4">
            Décision administrateur
          </div>

          {/* 3 Action Selector Buttons */}
          <div className="flex gap-2 mb-4.5">
            <button
              type="button"
              onClick={() => setDecision('valider')}
              className={`flex-1 py-2.5 rounded-[9px] font-bold text-[12px] leading-none uppercase tracking-[0.02em] transition-all cursor-pointer text-center border-2 ${
                decision === 'valider'
                  ? 'border-[#2f6f4f] bg-[#2f6f4f] text-white'
                  : 'border-[#2f6f4f] bg-white text-[#2f6f4f] hover:bg-emerald-50'
              }`}
            >
              Valider
            </button>

            <button
              type="button"
              onClick={() => setDecision('correction')}
              className={`flex-1 py-2.5 rounded-[9px] font-bold text-[12px] leading-none uppercase tracking-[0.02em] transition-all cursor-pointer text-center border-2 ${
                decision === 'correction'
                  ? 'border-[#d9704f] bg-[#d9704f] text-white'
                  : 'border-[#d9704f] bg-white text-[#d9704f] hover:bg-orange-50'
              }`}
            >
              Correction
            </button>

            <button
              type="button"
              onClick={() => setDecision('rejeter')}
              className={`flex-1 py-2.5 rounded-[9px] font-bold text-[12px] leading-none uppercase tracking-[0.02em] transition-all cursor-pointer text-center border-2 ${
                decision === 'rejeter'
                  ? 'border-[#9a3b2f] bg-[#9a3b2f] text-white'
                  : 'border-[#9a3b2f] bg-white text-[#9a3b2f] hover:bg-red-50'
              }`}
            >
              Rejeter
            </button>
          </div>

          {/* If Correction or Rejeter selected, show reasons list configured in Configuration -> Messages */}
          {decision !== 'valider' && (
            <>
              <div className="mb-4">
                <div className="font-semibold text-[12px] leading-none text-[#4c5058] mb-2">
                  Motif(s) de {decision === 'correction' ? 'correction' : 'rejet'} (Configuration)
                </div>

                <div className="border border-[#dcd7cb] rounded-[9px] overflow-hidden bg-white">
                  <div
                    onClick={() => setCausesOpen(!causesOpen)}
                    className="h-[46px] px-3.5 flex items-center justify-between cursor-pointer bg-[#fbfaf7]"
                  >
                    <span className="font-medium text-[13px] leading-none text-[#1a2230]">
                      {selectedCauses.length} motif(s) sélectionné(s)
                    </span>
                    <span className="font-semibold text-[12px] leading-none text-[#5a5e66]">
                      {causesOpen ? '▲' : '▼'}
                    </span>
                  </div>

                  {causesOpen && (
                    <div className="border-t border-[#efece3] py-1 max-h-[260px] overflow-y-auto divide-y divide-[#f1efe8]">
                      {refusalReasons.map((item) => {
                        const checked = selectedCauses.includes(item.key);
                        return (
                          <div
                            key={item.key}
                            onClick={() => toggleCause(item)}
                            className="flex items-start gap-2.5 px-3.5 py-3 cursor-pointer hover:bg-[#fcfbf9] transition-colors"
                          >
                            <div
                              className={`w-4 h-4 mt-0.5 rounded-[4px] border-2 shrink-0 flex items-center justify-center text-[10px] font-bold ${
                                checked ? 'border-[#d9704f] bg-[#d9704f] text-white' : 'border-[#dcd7cb] bg-white'
                              }`}
                            >
                              {checked ? '✓' : ''}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[13px] leading-snug text-[#13243c]">
                                {item.label?.fr || item.key}
                              </div>
                              <div className="font-normal text-[11px] leading-snug text-[#4c5058] mt-0.5">
                                {item.message?.fr}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4.5">
                <div className="font-semibold text-[12px] leading-none text-[#4c5058] mb-2">
                  Commentaire explicatif pour le vendeur
                </div>
                <textarea
                  rows={3}
                  value={customComment}
                  onChange={(e) => setCustomComment(e.target.value)}
                  placeholder="Détails complémentaires..."
                  className="w-full min-h-[80px] border border-[#dcd7cb] rounded-[9px] p-3 font-normal text-[13px] leading-relaxed text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c] transition resize-y"
                />
              </div>
            </>
          )}

          {/* Submit Action Button */}
          <button
            type="button"
            onClick={handleDecisionSubmit}
            disabled={actionLoading}
            className="w-full h-[48px] rounded-[9px] bg-[#13243c] hover:bg-[#1a3050] text-white font-bold text-[13px] leading-[48px] uppercase tracking-[0.03em] text-center transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mb-2.5 shadow-xs"
          >
            {actionLoading && <Spinner />}
            {decision === 'valider'
              ? 'Valider le dossier'
              : decision === 'rejeter'
              ? 'Confirmer le rejet'
              : 'Envoyer la demande de correction'}
          </button>

          <div className="font-normal text-[11px] leading-relaxed text-[#5a5e66] text-center">
            Le vendeur reçoit une notification et un email avec les motifs sélectionnés.
          </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmApprove}
        title="Valider ce dossier"
        message="Valider définitivement ce dossier véhicule ? Il pourra ensuite être programmé dans une session d'appel d'offres."
        confirmLabel="Valider"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => { setConfirmApprove(false); setDecision('valider'); handleDecisionSubmit(); }}
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
