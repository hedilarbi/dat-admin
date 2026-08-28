'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import Spinner from '../components/Spinner';
import ConfirmModal from '../components/ConfirmModal';
import CommissionTiersEditor from '../components/CommissionTiersEditor';
import type { VehicleDossier } from '../lib/vehicleDossier';
import {
  CommissionTier,
  CommissionTierDraft,
  SessionCommission,
  draftToTier,
  tierToDraft,
  validateDrafts,
} from '../lib/commission';
import { Gavel, Search, Trash2 } from 'lucide-react';

interface SessionData {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  durationHours: number;
  isManual: boolean;
  status: 'open' | 'upcoming' | 'closed' | 'annulee' | 'programmee' | 'active' | 'cloturee';
  vehicleCount: number;
  vehicles?: VehicleDossier[];
  commission?: SessionCommission;
  date?: string;
}

interface SessionConfigData {
  daysOfWeek: number[];
  startTime: string;
  durationHours: number;
  autoGenerateWeeks: number;
}

const WEEKDAY_NAMES = [
  { id: 1, label: 'Lundi' },
  { id: 2, label: 'Mardi' },
  { id: 3, label: 'Mercredi' },
  { id: 4, label: 'Jeudi' },
  { id: 5, label: 'Vendredi' },
  { id: 6, label: 'Samedi' },
  { id: 0, label: 'Dimanche' },
];

const CALENDAR_WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function VehicleCover({ vehicle }: { vehicle: VehicleDossier }) {
  const cover = vehicle.photos?.find((photo) => photo.isCover) || vehicle.photos?.[0];
  const imageUrl = cover?.processedUrl || cover?.originalUrl;
  return imageUrl ? (
    <div className="h-[72px] w-[104px] shrink-0 overflow-hidden rounded-[10px] bg-[#eef1f5]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`${vehicle.brand || ''} ${vehicle.model || ''}`.trim()} className="h-full w-full object-cover" />
    </div>
  ) : (
    <div className="h-[72px] w-[104px] shrink-0 rounded-[10px] bg-[#eef1f5] flex items-center justify-center font-bold text-[11px] text-[#8ea0bd]">
      {(vehicle.brand || 'VEH').slice(0, 3).toUpperCase()}
    </div>
  );
}

/**
 * Compteur de mises en vente d'un véhicule, mis en regard du nombre de tentatives prévu
 * dans la configuration générale. Purement informatif : l'admin peut affecter au-delà.
 */
function ListingAttemptsBadge({ count }: { count: number }) {
  let bgColor = '';
  let textColor = '';
  
  if (count <= 1) {
    bgColor = 'bg-[#e9f4ee]';
    textColor = 'text-[#2f6f4f]'; // Green
  } else if (count === 2) {
    bgColor = 'bg-[#fff5cc]';
    textColor = 'text-[#8a6d00]'; // Yellow
  } else {
    bgColor = 'bg-[#fdece4]';
    textColor = 'text-[#b04a2c]'; // Red
  }

  return (
    <span
      title={`Ce véhicule a déjà été mis en vente ${count} fois.`}
      className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${bgColor} ${textColor}`}
    >
      {`${count} tentative${count > 1 ? 's' : ''}`}
    </span>
  );
}

function VehicleField({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="rounded-[10px] bg-[#f8f7f2] p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-[#7a756a]">{label}</div><div className="mt-1 text-sm font-semibold text-[#13243c]">{value || '—'}</div></div>;
}

export default function AdminSessionsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [listDateFrom, setListDateFrom] = useState('');
  const [listDateTo, setListDateTo] = useState('');
  const [listStatus, setListStatus] = useState<'all' | 'scheduled' | 'ongoing' | 'finished'>('all');

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<VehicleDossier[]>([]);
  const [config, setConfig] = useState<SessionConfigData>({
    daysOfWeek: [1, 3, 5],
    startTime: '10:00',
    durationHours: 48,
    autoGenerateWeeks: 4,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Modals
  const [panelSessionId, setPanelSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [searchAvailable, setSearchAvailable] = useState('');
  const [availableBrand, setAvailableBrand] = useState('all');
  const [availableProcedure, setAvailableProcedure] = useState('all');
  const [detailVehicle, setDetailVehicle] = useState<VehicleDossier | null>(null);
  const [initialVehicleIds, setInitialVehicleIds] = useState<string[]>([]);
  const [initialSessionName, setInitialSessionName] = useState('');
  const [sessionDirty, setSessionDirty] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closingSession, setClosingSession] = useState(false);

  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createDuration, setCreateDuration] = useState(48);
  const [creating, setCreating] = useState(false);

  // Repère indicatif : nombre de mises en vente prévu par la configuration générale.
  // Il n'empêche pas d'affecter un véhicule au-delà, il signale seulement le dépassement.
  const [listingAttemptLimit, setListingAttemptLimit] = useState<number | null>(null);

  // Commissions : configuration globale + configuration propre à la session créée/éditée
  const [defaultTiers, setDefaultTiers] = useState<CommissionTier[]>([]);
  const [createUseDefaultCommission, setCreateUseDefaultCommission] = useState(true);
  const [createCommissionDrafts, setCreateCommissionDrafts] = useState<CommissionTierDraft[]>([]);
  const [panelCommissionOpen, setPanelCommissionOpen] = useState(false);
  const [panelUseDefaultCommission, setPanelUseDefaultCommission] = useState(true);
  const [panelCommissionDrafts, setPanelCommissionDrafts] = useState<CommissionTierDraft[]>([]);
  const [initialCommission, setInitialCommission] = useState('');

  const fetchSessions = async () => {
    try {
      const res = await apiRequest('/sessions');
      setSessions(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement des sessions.');
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await apiRequest('/sessions/config');
      if (res) {
        setConfig({
          daysOfWeek: res.daysOfWeek || [1, 3, 5],
          startTime: res.startTime || '10:00',
          durationHours: res.durationHours ?? 48,
          autoGenerateWeeks: res.autoGenerateWeeks ?? 4,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDefaultTiers = async () => {
    try {
      const res = await apiRequest('/admin/commissions');
      setDefaultTiers(res.tiers || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchListingAttemptLimit = async () => {
    try {
      const res = await apiRequest('/admin/general-config');
      setListingAttemptLimit(res.config?.vehicleListingAttempts ?? null);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAvailableVehicles = async () => {
    try {
      const res = await apiRequest('/admin/vehicle-dossiers?status=valide&limit=100');
      const allValide: VehicleDossier[] = res.dossiers || [];
      // Filtrer ceux qui n'ont pas encore de session
      setAvailableVehicles(allValide.filter((v) => !v.session));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([
      fetchSessions(), fetchConfig(), fetchAvailableVehicles(), fetchDefaultTiers(), fetchListingAttemptLimit(),
    ]).finally(() => setLoading(false));
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const statusMeta = (status: string) => {
    switch (status) {
      case 'open':
      case 'active':
        return { color: '#166534', label: 'Session ouverte', bg: '#dcfce7' };
      case 'upcoming':
      case 'programmee':
        return { color: '#1d4ed8', label: 'Session à venir', bg: '#dbeafe' };
      case 'closed':
      case 'cloturee':
        return { color: '#475569', label: 'Session clôturée', bg: '#e2e8f0' };
      case 'annulee':
        return { color: '#b91c1c', label: 'Session annulée', bg: '#fee2e2' };
      default:
        return { color: '#5a5e66', label: 'Session', bg: '#eef1f5' };
    }
  };

  // Calendar Grid calculation for current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayObj = new Date(year, month, 1);
  const firstDayWeekday = (firstDayObj.getDay() + 6) % 7; // Monday=0, Sunday=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells: Array<{ dayNum?: number; dateObj?: Date; session?: SessionData } | null> = [];
  for (let i = 0; i < firstDayWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dObj = new Date(year, month, d);
    // Find session for this date
    const sessionMatch = sessions.find((s) => {
      const sDate = new Date(s.startDate || s.date || Date.now());
      return sDate.getFullYear() === year && sDate.getMonth() === month && sDate.getDate() === d;
    });
    calendarCells.push({ dayNum: d, dateObj: dObj, session: sessionMatch });
  }
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  // Corps envoyé au serveur pour la configuration de commission d'une session
  const buildCommissionPayload = (useDefault: boolean, drafts: CommissionTierDraft[]) =>
    (useDefault ? { useDefault: true } : { useDefault: false, tiers: drafts.map(draftToTier) });

  // Empreinte comparable, pour savoir si l'admin a touché à la configuration
  const commissionSignature = (useDefault: boolean, drafts: CommissionTierDraft[]) =>
    JSON.stringify(buildCommissionPayload(useDefault, drafts));

  // Passer en mode personnalisé prérenseigne les tranches avec la configuration par défaut,
  // que l'admin n'a plus qu'à ajuster pour cette session.
  const seedDraftsFromDefault = () => defaultTiers.filter((tier) => tier.active).map(tierToDraft);

  // Le tiroir enregistre trois choses à la fois (nom, véhicules, commissions) : le bouton
  // « Enregistrer » doit rester actif dès que l'une d'elles diverge de l'état initial.
  const computeSessionDirty = (
    overrides: { name?: string; useDefault?: boolean; drafts?: CommissionTierDraft[] } = {},
  ) => {
    if (!selectedSession) return false;
    const name = overrides.name ?? selectedSession.name;
    const useDefault = overrides.useDefault ?? panelUseDefaultCommission;
    const drafts = overrides.drafts ?? panelCommissionDrafts;
    const vehicleIds = (selectedSession.vehicles || []).map((vehicle) => vehicle._id);

    return (
      name.trim() !== initialSessionName.trim()
      || vehicleIds.some((id) => !initialVehicleIds.includes(id))
      || initialVehicleIds.some((id) => !vehicleIds.includes(id))
      || commissionSignature(useDefault, drafts) !== initialCommission
    );
  };

  const applySessionCommission = (commission?: SessionCommission) => {
    const useDefault = commission?.useDefault !== false;
    setPanelUseDefaultCommission(useDefault);
    const drafts = useDefault ? [] : (commission?.tiers || []).map(tierToDraft);
    setPanelCommissionDrafts(drafts);
    setInitialCommission(commissionSignature(useDefault, drafts));
  };

  // Open Session Detail Side Drawer
  const openSessionDetail = async (session: SessionData) => {
    setPanelSessionId(session._id);
    setSelectedSession(session);
    setInitialSessionName(session.name);
    setInitialVehicleIds([]);
    setSessionDirty(false);
    applySessionCommission(session.commission);
    try {
      const detail = await apiRequest(`/sessions/${session._id}`);
      setSelectedSession(detail);
      setInitialSessionName(detail.name);
      setInitialVehicleIds((detail.vehicles || []).map((vehicle: VehicleDossier) => vehicle._id));
      applySessionCommission(detail.commission);
    } catch (err) {
      console.error(err);
    }
  };

  const closeSessionDetail = () => {
    setPanelSessionId(null);
    setSelectedSession(null);
    setInitialVehicleIds([]);
    setInitialSessionName('');
    setSessionDirty(false);
    setPanelUseDefaultCommission(true);
    setPanelCommissionDrafts([]);
    setInitialCommission('');
    setSearchAvailable('');
    setAvailableBrand('all');
    setAvailableProcedure('all');
    setDetailVehicle(null);
    fetchAvailableVehicles();
  };

  const openVehicleDetail = async (vehicle: VehicleDossier) => {
    setDetailVehicle(vehicle);
    try {
      const response = await apiRequest(`/admin/vehicle-dossiers/${vehicle._id}`);
      if (response.dossier) setDetailVehicle(response.dossier);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddVehicleToSession = (vehicleId: string) => {
    if (!selectedSession) return;
    const vehicle = availableVehicles.find((item) => item._id === vehicleId);
    if (!vehicle) return;
    setSelectedSession({
      ...selectedSession,
      vehicles: [...(selectedSession.vehicles || []), vehicle],
    });
    setAvailableVehicles((items) => items.filter((item) => item._id !== vehicleId));
    setSessionDirty(true);
  };

  const handleRemoveVehicleFromSession = (vehicleId: string) => {
    if (!selectedSession) return;
    const vehicle = selectedSession.vehicles?.find((item) => item._id === vehicleId);
    if (!vehicle) return;
    setSelectedSession({
      ...selectedSession,
      vehicles: (selectedSession.vehicles || []).filter((item) => item._id !== vehicleId),
    });
    setAvailableVehicles((items) => [...items, vehicle]);
    setSessionDirty(true);
  };

  const handleSaveSession = async () => {
    if (!selectedSession) return;
    const currentVehicleIds = (selectedSession.vehicles || []).map((vehicle) => vehicle._id);
    const addedIds = currentVehicleIds.filter((id) => !initialVehicleIds.includes(id));
    const removedIds = initialVehicleIds.filter((id) => !currentVehicleIds.includes(id));

    if (!panelUseDefaultCommission) {
      const commissionError = validateDrafts(panelCommissionDrafts);
      if (commissionError) {
        setError(commissionError);
        return;
      }
    }

    const nameChanged = selectedSession.name.trim() !== initialSessionName.trim();
    const commissionChanged = commissionSignature(panelUseDefaultCommission, panelCommissionDrafts) !== initialCommission;

    setSavingSession(true);
    setError('');
    setMessage('');
    try {
      await Promise.all([
        ...(nameChanged || commissionChanged ? [apiRequest(`/sessions/${selectedSession._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: selectedSession.name.trim(),
            commission: buildCommissionPayload(panelUseDefaultCommission, panelCommissionDrafts),
          }),
        })] : []),
        ...addedIds.map((vehicleId) => apiRequest(`/sessions/${selectedSession._id}/add-vehicle`, {
          method: 'POST',
          body: JSON.stringify({ vehicleId }),
        })),
        ...removedIds.map((vehicleId) => apiRequest(`/sessions/${selectedSession._id}/remove-vehicle`, {
          method: 'POST',
          body: JSON.stringify({ vehicleId }),
        })),
      ]);
      await Promise.all([fetchSessions(), fetchAvailableVehicles()]);
      setMessage(commissionChanged ? 'Session enregistrée, commissions comprises.' : 'Affectation des véhicules enregistrée avec succès.');
      setPanelSessionId(null);
      setSelectedSession(null);
      setInitialVehicleIds([]);
      setInitialSessionName('');
      setSessionDirty(false);
      setPanelUseDefaultCommission(true);
      setPanelCommissionDrafts([]);
      setInitialCommission('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement de la session.');
    } finally {
      setSavingSession(false);
    }
  };

  /**
   * Termine la session avant l'heure. Le serveur rejoue l'attribution des gagnants par le
   * même code que la clôture par le temps : rien n'est raccourci ici.
   */
  const handleCloseSession = async () => {
    if (!selectedSession || closingSession) return;
    setClosingSession(true);
    setError('');
    setMessage('');
    try {
      const res = await apiRequest(`/sessions/${selectedSession._id}/close`, { method: 'POST' });
      setCloseConfirmOpen(false);
      setPanelSessionId(null);
      setSelectedSession(null);
      await Promise.all([fetchSessions(), fetchAvailableVehicles()]);
      setMessage(res.message || 'Session clôturée.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la clôture de la session.');
    } finally {
      setClosingSession(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession || deletingSession) return;
    setDeletingSession(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/sessions/${selectedSession._id}`, { method: 'DELETE' });
      setDeleteConfirmOpen(false);
      setPanelSessionId(null);
      setSelectedSession(null);
      setInitialVehicleIds([]);
      setInitialSessionName('');
      setSessionDirty(false);
      setPanelUseDefaultCommission(true);
      setPanelCommissionDrafts([]);
      setInitialCommission('');
      await Promise.all([fetchSessions(), fetchAvailableVehicles()]);
      setMessage('Session supprimée. Les véhicules associés sont de nouveau disponibles.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression de la session.');
    } finally {
      setDeletingSession(false);
    }
  };

  // Save Recurrence Configuration
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/sessions/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      setMessage('Configuration des sessions mise à jour et calendrier régénéré.');
      setConfigOpen(false);
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || 'Erreur d\'enregistrement de la configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Create Manual Session
  const handleCreateManualSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDate) {
      setError('Veuillez sélectionner une date.');
      return;
    }
    if (!createUseDefaultCommission) {
      const commissionError = validateDrafts(createCommissionDrafts);
      if (commissionError) {
        setError(commissionError);
        return;
      }
    }
    setCreating(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name: createName.trim() || undefined,
          startDate: createDate,
          durationHours: createDuration,
          commission: buildCommissionPayload(createUseDefaultCommission, createCommissionDrafts),
        }),
      });
      setMessage(createUseDefaultCommission
        ? 'Session créée avec la configuration de commission par défaut.'
        : 'Session créée avec une configuration de commission personnalisée.');
      setCreateOpen(false);
      setCreateName('');
      setCreateDate('');
      setCreateUseDefaultCommission(true);
      setCreateCommissionDrafts([]);
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || 'Erreur de création de la session.');
    } finally {
      setCreating(false);
    }
  };

  const monthLabel = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const sessionState = (status: SessionData['status']) => {
    if (['open', 'active'].includes(status)) return 'ongoing';
    if (['closed', 'cloturee'].includes(status)) return 'finished';
    if (status === 'annulee') return 'cancelled';
    return 'scheduled';
  };

  const listStateMeta = (status: SessionData['status']) => {
    const state = sessionState(status);
    if (state === 'ongoing') return { label: 'En cours', color: '#166534', bg: '#dcfce7' };
    if (state === 'finished') return { label: 'Terminée', color: '#475569', bg: '#e2e8f0' };
    if (state === 'cancelled') return { label: 'Annulée', color: '#b91c1c', bg: '#fee2e2' };
    return { label: 'Programmée', color: '#1d4ed8', bg: '#dbeafe' };
  };

  const availableBrands = Array.from(new Set(availableVehicles.map((vehicle) => vehicle.brand).filter(Boolean) as string[])).sort();
  const availableProcedures = Array.from(new Set(availableVehicles.map((vehicle) => vehicle.procedure).filter(Boolean) as string[])).sort();
  const filteredAvailableVehicles = availableVehicles.filter((vehicle) => {
    const query = searchAvailable.trim().toLowerCase();
    const searchable = [vehicle.brand, vehicle.model, vehicle.registrationNumber, vehicle.vin, vehicle.seller?.companyName, vehicle.seller?.firstName, vehicle.seller?.lastName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return (!query || searchable.includes(query))
      && (availableBrand === 'all' || vehicle.brand === availableBrand)
      && (availableProcedure === 'all' || vehicle.procedure === availableProcedure);
  });

  const filteredSessions = sessions
    .filter((session) => {
      const start = new Date(session.startDate || session.date || 0);
      if (listDateFrom) {
        const from = new Date(`${listDateFrom}T00:00:00`);
        if (start < from) return false;
      }
      if (listDateTo) {
        const to = new Date(`${listDateTo}T23:59:59.999`);
        if (start > to) return false;
      }
      return listStatus === 'all' || sessionState(session.status) === listStatus;
    })
    .sort((a, b) => new Date(b.startDate || b.date || 0).getTime() - new Date(a.startDate || a.date || 0).getTime());

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-full shrink-0 w-full px-6 pt-6 pb-16 sm:px-8 sm:pt-8 sm:pb-20 lg:px-10 lg:pt-10 lg:pb-24 font-sans text-black bg-white flex flex-col relative">
      {/* Header Section */}
      <div className="flex flex-wrap gap-4 justify-between items-end mb-6.5">
        <div>
          <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
            Gestion des enchères
          </div>
          <h1 className="m-0 font-bold text-[36px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
            Sessions
          </h1>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex rounded-[9px] border border-[#dcd7cb] bg-[#f8f7f2] p-1">
            <button type="button" onClick={() => setViewMode('calendar')} className={`h-8 rounded-[7px] px-3 text-[12px] font-bold transition ${viewMode === 'calendar' ? 'bg-[#13243c] text-white shadow-sm' : 'text-[#4c5058] hover:bg-white'}`}>
              Calendrier
            </button>
            <button type="button" onClick={() => setViewMode('list')} className={`h-8 rounded-[7px] px-3 text-[12px] font-bold transition ${viewMode === 'list' ? 'bg-[#13243c] text-white shadow-sm' : 'text-[#4c5058] hover:bg-white'}`}>
              Liste
            </button>
          </div>
          {viewMode === 'calendar' && <>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-[34px] h-[34px] rounded-[8px] border border-[#dcd7cb] flex items-center justify-center font-bold text-[15px] text-[#13243c] hover:bg-gray-50 transition cursor-pointer"
          >
            ‹
          </button>
          <div className="font-bold text-[18px] leading-none uppercase text-[#13243c] min-w-[170px] text-center font-['Saira_Condensed',sans-serif]">
            {monthLabel}
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            className="w-[34px] h-[34px] rounded-[8px] border border-[#dcd7cb] flex items-center justify-center font-bold text-[15px] text-[#13243c] hover:bg-gray-50 transition cursor-pointer"
          >
            ›
          </button>
          </>}

          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="h-[34px] px-4 rounded-[8px] border border-[#dcd7cb] text-[#13243c] font-bold text-[12px] leading-[34px] uppercase tracking-[0.03em] hover:bg-gray-50 transition cursor-pointer"
          >
            Configurer les sessions
          </button>

          <button
            type="button"
            onClick={() => {
              setCreateDate(new Date().toISOString().slice(0, 16));
              setCreateOpen(true);
            }}
            className="h-[34px] px-4 rounded-[8px] bg-[#13243c] hover:bg-[#1a3050] text-white font-bold text-[12px] leading-[34px] uppercase tracking-[0.03em] transition cursor-pointer shadow-xs"
          >
            + Nouvelle session
          </button>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}
      {message && <Alert variant="success" className="mb-5">{message}</Alert>}

      {viewMode === 'calendar' ? <>
      {/* Weekdays Header */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {CALENDAR_WEEKDAY_HEADERS.map((wd) => (
          <div key={wd} className="text-center font-semibold text-[11px] leading-none uppercase tracking-[0.05em] text-[#5a5e66] pb-1.5">
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 mb-[22px]">
        {calendarCells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="min-h-[104px] rounded-[10px] bg-transparent" />;
          }

          const { dayNum, dateObj, session } = cell;
          const meta = session ? statusMeta(session.status) : null;
          const isSelected = selectedSession && session && selectedSession._id === session._id;

          return (
            <div
              key={idx}
              style={session && meta ? { backgroundColor: meta.bg, borderColor: meta.color } : undefined}
              onClick={() => {
                if (session) {
                  openSessionDetail(session);
                } else if (dateObj) {
                  // Prefill new manual session date
                  const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  setCreateDate(localIso);
                  setCreateOpen(true);
                }
              }}
              className={`min-h-[104px] rounded-[10px] p-2.5 sm:p-3 flex flex-col transition-all cursor-pointer ${
                session ? 'bg-white' : 'bg-[#fbfaf7] hover:bg-gray-100/80'
              } border-[1.5px] ${
                isSelected
                  ? 'border-[#13243c] ring-2 ring-[#13243c]/10'
                  : session
                  ? 'border-[#eceadf] hover:border-[#dcd7cb]'
                  : 'border-[#f1efe8]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-[14px] leading-none text-[#13243c]">
                  {dayNum}
                </div>
                {!session && (
                  <span className="text-[11px] font-bold text-gray-300 group-hover:text-[#13243c] transition-colors">+</span>
                )}
              </div>

              {session && (
                <div className="mt-auto">
                  <div className="font-bold text-[12px] leading-tight truncate" style={{ color: meta?.color }}>
                    {session.name}
                  </div>
                  <div className="font-semibold text-[11px] leading-tight text-[#5a5e66] mt-0.5">
                    {session.vehicleCount || 0} véhicule{(session.vehicleCount || 0) > 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center gap-[22px] border-t border-[#efece3] pt-4 pb-8 sm:pb-10">
        <div className="flex items-center gap-2">
          <div className="w-[11px] h-[11px] rounded-[3px] bg-[#16a34a]" />
          <span className="font-medium text-[12px] leading-none text-[#5a5e66]">Session ouverte</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[11px] h-[11px] rounded-[3px] bg-[#2563eb]" />
          <span className="font-medium text-[12px] leading-none text-[#5a5e66]">Session à venir</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[11px] h-[11px] rounded-[3px] bg-[#64748b]" />
          <span className="font-medium text-[12px] leading-none text-[#5a5e66]">Session clôturée</span>
        </div>
      </div>
      </> : (
        <div className="flex flex-col gap-5">
          <div className="rounded-[12px] border border-[#eceadf] bg-[#fbfaf7] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#4c5058]">Date de début</span>
                <input type="date" value={listDateFrom} onChange={(event) => setListDateFrom(event.target.value)} className="h-11 w-full rounded-[8px] border border-[#dcd7cb] bg-white px-3 text-sm text-[#13243c] focus:outline-none focus:ring-1 focus:ring-[#13243c]" />
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#4c5058]">Date de fin</span>
                <input type="date" value={listDateTo} onChange={(event) => setListDateTo(event.target.value)} className="h-11 w-full rounded-[8px] border border-[#dcd7cb] bg-white px-3 text-sm text-[#13243c] focus:outline-none focus:ring-1 focus:ring-[#13243c]" />
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.05em] text-[#4c5058]">État</span>
                <select value={listStatus} onChange={(event) => setListStatus(event.target.value as typeof listStatus)} className="h-11 w-full rounded-[8px] border border-[#dcd7cb] bg-white px-3 text-sm text-[#13243c] focus:outline-none focus:ring-1 focus:ring-[#13243c]">
                  <option value="all">Tous les états</option>
                  <option value="scheduled">Programmée</option>
                  <option value="ongoing">En cours</option>
                  <option value="finished">Terminée</option>
                </select>
              </label>
              <button type="button" onClick={() => { setListDateFrom(''); setListDateTo(''); setListStatus('all'); }} className="h-11 rounded-[8px] border border-[#dcd7cb] bg-white px-4 text-xs font-bold uppercase text-[#13243c] hover:bg-gray-50">Réinitialiser</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-[#eceadf] bg-white shadow-sm">
            <div className="hidden grid-cols-[1.3fr_1.4fr_1.4fr_.8fr_.8fr] gap-4 border-b border-[#efece3] bg-[#f8f7f2] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.05em] text-[#4c5058] md:grid">
              <span>Session</span><span>Début</span><span>Fin</span><span>État</span><span className="text-right">Véhicules</span>
            </div>
            {filteredSessions.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm font-medium text-[#5a5e66]">Aucune session ne correspond aux filtres sélectionnés.</div>
            ) : filteredSessions.map((session) => {
              const meta = listStateMeta(session.status);
              return (
                <button key={session._id} type="button" onClick={() => openSessionDetail(session)} className="grid w-full grid-cols-1 gap-2 border-b border-[#efece3] px-5 py-4 text-left transition last:border-b-0 hover:bg-[#fcfbf9] md:grid-cols-[1.3fr_1.4fr_1.4fr_.8fr_.8fr] md:items-center md:gap-4">
                  <span className="flex items-center gap-2 font-bold text-[#13243c]">
                    {session.name}
                    {session.commission?.useDefault === false && (
                      <span className="rounded-full bg-[#faf1e4] px-2 py-0.5 text-[10px] font-bold uppercase text-[#b3893f]" title="Cette session applique ses propres tranches de commission">
                        Commission perso.
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-[#4c5058]">{new Date(session.startDate || session.date || 0).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className="text-sm text-[#4c5058]">{new Date(session.endDate).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span className="w-fit rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>
                  <span className="font-bold text-[#13243c] md:text-right">{session.vehicleCount || 0} véhicule{(session.vehicleCount || 0) > 1 ? 's' : ''} →</span>
                </button>
              );
            })}
          </div>
          <div className="text-xs font-semibold text-[#5a5e66]">{filteredSessions.length} session{filteredSessions.length > 1 ? 's' : ''}</div>
        </div>
      )}

      {/* MODAL 1: Session Detail Side Drawer */}
      {panelSessionId && selectedSession && (
        <div
          className="fixed inset-0 bg-[#13243c]/40 backdrop-blur-xs flex items-center justify-center z-50"
          onClick={closeSessionDetail}
        >
          <div
            className="h-full w-full bg-white shadow-[0_26px_60px_rgba(0,0,0,0.28)] flex flex-col overflow-hidden animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 sm:p-[26px_32px_20px] border-b border-[#efece3] flex justify-between items-start">
              <div>
                <div className="font-semibold text-[11px] leading-none tracking-[0.16em] uppercase text-[#a3987f] mb-2">
                  Du {new Date(selectedSession.startDate || selectedSession.date || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} au {new Date(selectedSession.endDate || (new Date(selectedSession.startDate || selectedSession.date || Date.now()).getTime() + (selectedSession.durationHours || 48) * 3600000)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
                <label className="block max-w-[520px]">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#5a5e66]">Nom de la session</span>
                  <input
                    value={selectedSession.name}
                    onChange={(event) => {
                      setSelectedSession({ ...selectedSession, name: event.target.value });
                      setSessionDirty(computeSessionDirty({ name: event.target.value }));
                    }}
                    className="h-11 w-full rounded-[9px] border border-[#dcd7cb] bg-white px-3 text-[18px] font-bold uppercase text-[#13243c] focus:border-[#13243c] focus:outline-none"
                  />
                </label>
                <div className="font-semibold text-[12px] leading-none mt-1.5" style={{ color: statusMeta(selectedSession.status).color }}>
                  {statusMeta(selectedSession.status).label} · {selectedSession.vehicles?.length || selectedSession.vehicleCount || 0} véhicule(s) inscrit(s)
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {selectedSession.status !== 'closed' && selectedSession.status !== 'cloturee' && selectedSession.status !== 'annulee' && (
                  <button type="button" onClick={() => setCloseConfirmOpen(true)} className="flex h-9 items-center gap-2 rounded-[8px] border border-[#e6d8bd] bg-white px-3 text-[11px] font-bold uppercase text-[#b3893f] transition hover:bg-[#faf1e4]">
                    <Gavel size={15} /> Terminer la session
                  </button>
                )}
                <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="flex h-9 items-center gap-2 rounded-[8px] border border-[#efb7b7] bg-white px-3 text-[11px] font-bold uppercase text-[#b91c1c] transition hover:bg-red-50">
                  <Trash2 size={15} /> Supprimer
                </button>
                <button type="button" onClick={closeSessionDetail} className="w-9 h-9 rounded-[8px] border border-[#dcd7cb] flex items-center justify-center font-semibold text-[15px] text-[#5a5e66] hover:bg-gray-50 transition cursor-pointer shrink-0">×</button>
              </div>
            </div>

            {/* Commission configuration for this session */}
            <div className="shrink-0 border-b border-[#efece3] bg-[#fbfaf7]">
              <button
                type="button"
                onClick={() => setPanelCommissionOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 px-6 py-3 text-left sm:px-8 cursor-pointer hover:bg-[#f5f3ec] transition"
              >
                <div className="min-w-0">
                  <div className="font-bold text-[11px] uppercase tracking-[0.06em] text-[#4c5058]">
                    Commissions de la session
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-[#5a5e66]">
                    {panelUseDefaultCommission
                      ? `Configuration par défaut · ${defaultTiers.filter((tier) => tier.active).length} tranche(s)`
                      : `Personnalisée · ${panelCommissionDrafts.length} tranche(s)`}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${panelUseDefaultCommission ? 'bg-[#e2e8f0] text-[#475569]' : 'bg-[#faf1e4] text-[#b3893f]'}`}>
                  {panelUseDefaultCommission ? 'Par défaut' : 'Personnalisée'}
                </span>
              </button>

              {panelCommissionOpen && (
                <div className="max-h-[42vh] overflow-y-auto px-6 pb-4 sm:px-8">
                  <CommissionTiersEditor
                    useDefault={panelUseDefaultCommission}
                    onUseDefaultChange={(next) => {
                      const drafts = !next && panelCommissionDrafts.length === 0 ? seedDraftsFromDefault() : panelCommissionDrafts;
                      setPanelUseDefaultCommission(next);
                      setPanelCommissionDrafts(drafts);
                      setSessionDirty(computeSessionDirty({ useDefault: next, drafts }));
                    }}
                    defaultTiers={defaultTiers}
                    drafts={panelCommissionDrafts}
                    onDraftsChange={(drafts) => {
                      setPanelCommissionDrafts(drafts);
                      setSessionDirty(computeSessionDirty({ drafts }));
                    }}
                    disabled={savingSession}
                  />
                </div>
              )}
            </div>

            {/* Split Content: Available vs Assigned */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Column: Available Validated Vehicles */}
              <div className="flex-1 min-w-0 flex flex-col border-b md:border-b-0 md:border-r border-[#efece3]">
                <div className="p-4 sm:p-[18px_26px_12px]">
                  <div className="font-bold text-[11px] leading-none tracking-[0.06em] uppercase text-[#4c5058] mb-2.5">
                    Véhicules validés disponibles ({availableVehicles.length})
                  </div>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                    <input type="text" placeholder="Marque, immat., vendeur…" value={searchAvailable} onChange={(e) => setSearchAvailable(e.target.value)} className="h-10 border border-[#dcd7cb] rounded-[9px] px-3 font-normal text-[13px] text-[#1a2230] focus:outline-none focus:border-[#13243c] bg-white transition" />
                    <select value={availableBrand} onChange={(e) => setAvailableBrand(e.target.value)} className="h-10 rounded-[9px] border border-[#dcd7cb] bg-white px-3 text-[12px] text-[#13243c]"><option value="all">Toutes les marques</option>{availableBrands.map((brand) => <option key={brand}>{brand}</option>)}</select>
                    <select value={availableProcedure} onChange={(e) => setAvailableProcedure(e.target.value)} className="h-10 rounded-[9px] border border-[#dcd7cb] bg-white px-3 text-[12px] text-[#13243c]"><option value="all">Toutes les procédures</option>{availableProcedures.map((procedure) => <option key={procedure}>{procedure}</option>)}</select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-[4px_26px_20px] divide-y divide-[#f1efe8]">
                  {filteredAvailableVehicles.length === 0 ? (
                    <div className="py-8 text-center font-medium text-[13px] leading-relaxed text-[#5a5e66]">
                      Aucun véhicule validé disponible sans session.
                    </div>
                  ) : (
                    filteredAvailableVehicles
                      .map((v) => (
                        <div key={v._id} className="flex items-center gap-3 py-3">
                          <VehicleCover vehicle={v} />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[13px] leading-snug text-[#13243c] truncate">
                              {[v.brand, v.model].filter(Boolean).join(' ') || 'Sans nom'}
                            </div>
                            <div className="font-normal text-[11px] leading-snug text-[#5a5e66] mt-0.5 truncate">
                              {v.registrationNumber || v.vin || '—'} · {v.seller?.companyName || 'Vendeur'}
                            </div>
                            <ListingAttemptsBadge count={v.listingCount || 0} />
                          </div>
                          <button type="button" onClick={() => openVehicleDetail(v)} className="w-9 h-9 rounded-[8px] border border-[#cbd5e1] flex items-center justify-center text-[#13243c] hover:bg-slate-50" title="Voir la fiche du véhicule"><Search size={16} /></button>
                          <button
                            type="button"
                            onClick={() => handleAddVehicleToSession(v._id)}
                            className="w-8 h-8 rounded-[8px] border border-[#bcd8c8] flex items-center justify-center font-semibold text-[15px] text-[#2f6f4f] hover:bg-emerald-50 transition cursor-pointer shrink-0"
                            title="Ajouter à la session"
                          >
                            +
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Right Column: Assigned Vehicles */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="p-4 sm:p-[18px_26px_12px]">
                  <div className="font-bold text-[11px] leading-none tracking-[0.06em] uppercase text-[#4c5058]">
                    Véhicules affectés à cette session ({selectedSession.vehicles?.length || 0})
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-[4px_26px_20px] divide-y divide-[#f1efe8]">
                  {!selectedSession.vehicles || selectedSession.vehicles.length === 0 ? (
                    <div className="py-8 text-center font-medium text-[13px] leading-relaxed text-[#5a5e66]">
                      Aucun véhicule dans cette session.
                    </div>
                  ) : (
                    selectedSession.vehicles.map((v) => (
                      <div key={v._id} className="flex items-center gap-3 py-3">
                        <VehicleCover vehicle={v} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13px] leading-snug text-[#13243c] truncate">
                            {[v.brand, v.model].filter(Boolean).join(' ') || 'Sans nom'}
                          </div>
                          <div className="font-normal text-[11px] leading-snug text-[#5a5e66] mt-0.5 truncate">
                            {v.lotNumber ? <span className="font-mono font-semibold text-[#b3893f]">Lot #{v.lotNumber}</span> : null}
                            {v.lotNumber ? ' · ' : ''}{v.registrationNumber || v.vin || '—'} · {v.seller?.companyName || 'Vendeur'}
                          </div>
                            <ListingAttemptsBadge count={v.listingCount || 0} />
                          </div>
                        <div className="font-semibold text-[12px] leading-none font-mono text-[#13243c] shrink-0">
                          {v.reservePrice ? `${v.reservePrice.toLocaleString('fr-FR')} €` : '—'}
                        </div>
                        <button type="button" onClick={() => openVehicleDetail(v)} className="w-9 h-9 rounded-[8px] border border-[#cbd5e1] flex items-center justify-center text-[#13243c] hover:bg-slate-50" title="Voir la fiche du véhicule"><Search size={16} /></button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVehicleFromSession(v._id)}
                          className="w-8 h-8 rounded-[8px] border border-[#f0c9bd] flex items-center justify-center font-semibold text-[15px] text-[#d9704f] hover:bg-orange-50 transition cursor-pointer shrink-0"
                          title="Retirer de la session"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#efece3] bg-[#fbfaf7] px-6 py-4 sm:px-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-[#4c5058]">
                {sessionDirty ? 'Des modifications sont en attente d’enregistrement.' : 'Aucune modification en attente.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeSessionDetail}
                  disabled={savingSession}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveSession}
                  disabled={!sessionDirty || savingSession || !selectedSession.name.trim()}
                  className="btn btn-primary min-w-[150px] disabled:cursor-not-allowed disabled:opacity-50 gap-2"
                >
                  {savingSession && <Spinner />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailVehicle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#13243c]/60 p-4 backdrop-blur-sm" onClick={() => setDetailVehicle(null)}>
          <div className="max-h-[92vh] w-full max-w-[980px] overflow-y-auto rounded-[16px] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#efece3] bg-white px-6 py-5">
              <div><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3987f]">Fiche véhicule</div><h2 className="mt-1 text-2xl font-bold uppercase text-[#13243c]">{[detailVehicle.brand, detailVehicle.model].filter(Boolean).join(' ') || 'Véhicule'}</h2></div>
              <button type="button" onClick={() => setDetailVehicle(null)} className="h-9 w-9 rounded-[8px] border border-[#dcd7cb] text-lg text-[#5a5e66]">×</button>
            </div>
            <div className="space-y-6 p-6">
              {detailVehicle.photos?.length > 0 && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{detailVehicle.photos.map((photo, index) => <div key={photo._id || index} className="aspect-[4/3] overflow-hidden rounded-[10px] bg-[#eef1f5]">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo.processedUrl || photo.originalUrl} alt="" className="h-full w-full object-cover" /></div>)}</div>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <VehicleField label="Immatriculation" value={detailVehicle.registrationNumber} />
                <VehicleField label="VIN" value={detailVehicle.vin} />
                <VehicleField label="Année" value={detailVehicle.year} />
                <VehicleField label="Kilométrage" value={detailVehicle.mileage != null ? `${detailVehicle.mileage.toLocaleString('fr-FR')} km` : undefined} />
                <VehicleField label="Énergie" value={detailVehicle.energyLabel || detailVehicle.fuelType} />
                <VehicleField label="Boîte de vitesse" value={detailVehicle.gearbox} />
                <VehicleField label="Couleur" value={detailVehicle.color} />
                <VehicleField label="Carrosserie" value={detailVehicle.bodyType} />
                <VehicleField label="Procédure" value={detailVehicle.procedure} />
                <VehicleField label="VRADE" value={detailVehicle.vrade} />
                <VehicleField label="Prix de réserve" value={detailVehicle.reservePrice != null ? `${detailVehicle.reservePrice.toLocaleString('fr-FR')} €` : undefined} />
                <VehicleField label="Carte grise disponible" value={detailVehicle.registrationCardAvailable === undefined ? undefined : detailVehicle.registrationCardAvailable ? 'Oui' : 'Non'} />
                <VehicleField label="Vendeur" value={detailVehicle.seller?.companyName || `${detailVehicle.seller?.firstName || ''} ${detailVehicle.seller?.lastName || ''}`.trim()} />
                <VehicleField label="Téléphone vendeur" value={detailVehicle.seller?.phone} />
                <VehicleField label="Adresse actuelle" value={detailVehicle.vehicleAddress} />
                <VehicleField label="Livre de police" value={detailVehicle.policeBookNumber} />
              </div>
              <div><div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#4c5058]">Description du choc</div><div className="whitespace-pre-wrap rounded-[10px] bg-[#f8f7f2] p-4 text-sm leading-6 text-[#13243c]">{detailVehicle.description || '—'}</div></div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Recurrence Config Modal */}
      {configOpen && (
        <div
          className="fixed inset-0 bg-[#13243c]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setConfigOpen(false)}
        >
          <div
            className="w-full max-w-[500px] bg-white rounded-[16px] shadow-[0_26px_60px_rgba(0,0,0,0.28)] p-6 sm:p-[30px_32px] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-5 border-b border-[#efece3] pb-3">
              <div>
                <div className="font-semibold text-[11px] leading-none tracking-[0.16em] uppercase text-[#a3987f] mb-1.5">
                  Planification récurrente
                </div>
                <div className="font-bold text-[24px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
                  Configuration des sessions
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="w-8 h-8 rounded-[8px] border border-[#dcd7cb] flex items-center justify-center font-semibold text-[15px] text-[#5a5e66] hover:bg-gray-50 transition cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>

            {/* Jours récurrents */}
            <div className="mb-5">
              <label className="block font-semibold text-[12px] leading-none text-[#4c5058] mb-2.5">
                Jours d'ouverture hebdomadaires
              </label>
              <div className="grid grid-cols-3 gap-2">
                {WEEKDAY_NAMES.map((day) => {
                  const isChecked = config.daysOfWeek.includes(day.id);
                  return (
                    <div
                      key={day.id}
                      onClick={() => {
                        const nextDays = isChecked
                          ? config.daysOfWeek.filter((d) => d !== day.id)
                          : [...config.daysOfWeek, day.id];
                        setConfig({ ...config, daysOfWeek: nextDays });
                      }}
                      className={`p-2.5 rounded-[9px] border text-center font-semibold text-[13px] cursor-pointer transition select-none ${
                        isChecked
                          ? 'border-[#13243c] bg-[#13243c] text-white'
                          : 'border-[#dcd7cb] bg-white text-[#4c5058] hover:bg-gray-50'
                      }`}
                    >
                      {day.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Heure et durée */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block font-semibold text-[12px] leading-none text-[#4c5058] mb-1.5">
                  Heure d'ouverture
                </label>
                <input
                  type="time"
                  value={config.startTime}
                  onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
                  className="w-full h-[44px] border border-[#dcd7cb] rounded-[9px] px-3 font-mono font-semibold text-[14px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[12px] leading-none text-[#4c5058] mb-1.5">
                  Durée de session
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    value={config.durationHours}
                    onChange={(e) => setConfig({ ...config, durationHours: Number(e.target.value) })}
                    className="w-full h-[44px] border border-[#dcd7cb] rounded-[9px] px-3 pr-14 font-mono font-semibold text-[14px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-[12px] text-[#4c5058]">
                    heures
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[12px] leading-none text-[#4c5058] mb-1.5">
                  Générer à l&apos;avance
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={config.autoGenerateWeeks}
                    onChange={(e) => setConfig({ ...config, autoGenerateWeeks: Number(e.target.value) })}
                    className="w-full h-[44px] border border-[#dcd7cb] rounded-[9px] px-3 pr-16 font-mono font-semibold text-[14px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-[12px] text-[#4c5058]">
                    semaines
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-[#8a8270]">
                  {config.autoGenerateWeeks === 0
                    ? 'À 0, aucune session n\u2019est générée automatiquement.'
                    : `Environ ${config.daysOfWeek.length * config.autoGenerateWeeks} session(s) seront créées à l\u2019enregistrement.`}
                </p>
              </div>
            </div>

            {/* La planification ne crée que le calendrier : le contenu reste à la main de l'admin */}
            <div className="mb-6.5 bg-[#fbfaf7] p-3.5 rounded-[9px] border border-[#eceadf]">
              <p className="text-[12px] leading-relaxed text-[#5a5e66]">
                Cette planification génère uniquement le calendrier des sessions. L&apos;affectation des véhicules
                à une session se fait manuellement, depuis le détail de chaque session.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="w-full h-[48px] rounded-[9px] bg-[#13243c] hover:bg-[#1a3050] text-white font-bold text-[13px] leading-[48px] uppercase tracking-[0.03em] text-center transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingConfig && <Spinner />}
              {savingConfig ? 'Enregistrement...' : 'Enregistrer la planification'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Manual Session Creation Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 bg-[#13243c]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setCreateOpen(false)}
        >
          <form
            onSubmit={handleCreateManualSession}
            className="w-full max-w-[560px] max-h-[92vh] overflow-y-auto bg-white rounded-[16px] shadow-[0_26px_60px_rgba(0,0,0,0.28)] p-6 sm:p-[30px_32px] animate-in fade-in zoom-in-95 duration-150 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-[#efece3] pb-3">
              <div>
                <div className="font-semibold text-[11px] leading-none tracking-[0.16em] uppercase text-[#a3987f] mb-1.5">
                  Session ponctuelle
                </div>
                <div className="font-bold text-[24px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
                  Créer une nouvelle session
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="w-8 h-8 rounded-[8px] border border-[#dcd7cb] flex items-center justify-center font-semibold text-[15px] text-[#5a5e66] hover:bg-gray-50 transition cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>

            <div>
              <label className="block font-semibold text-[12px] text-[#4c5058] mb-1.5">
                Nom de la session (Optionnel)
              </label>
              <input
                type="text"
                placeholder="ex. Session Spéciale #135"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full h-[44px] border border-[#dcd7cb] rounded-[9px] px-3 font-medium text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[12px] text-[#4c5058] mb-1.5">
                Date et heure de début
              </label>
              <input
                required
                type="datetime-local"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                className="w-full h-[44px] border border-[#dcd7cb] rounded-[9px] px-3 font-mono font-semibold text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[12px] text-[#4c5058] mb-1.5">
                Durée (heures)
              </label>
              <input
                type="number"
                min={1}
                value={createDuration}
                onChange={(e) => setCreateDuration(Number(e.target.value))}
                className="w-full h-[44px] border border-[#dcd7cb] rounded-[9px] px-3 font-mono font-semibold text-[14px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
              />
            </div>

            <div className="border-t border-[#efece3] pt-4">
              <div className="font-semibold text-[12px] text-[#4c5058] mb-1">
                Commissions de la session
              </div>
              <p className="text-[11px] text-[#5a5e66] mb-2.5">
                La session hérite de la configuration par défaut. Personnalisez-la si cette session doit appliquer ses propres tranches.
              </p>
              <CommissionTiersEditor
                useDefault={createUseDefaultCommission}
                onUseDefaultChange={(next) => {
                  setCreateUseDefaultCommission(next);
                  if (!next && createCommissionDrafts.length === 0) {
                    setCreateCommissionDrafts(seedDraftsFromDefault());
                  }
                }}
                defaultTiers={defaultTiers}
                drafts={createCommissionDrafts}
                onDraftsChange={setCreateCommissionDrafts}
                disabled={creating}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={creating}
                className="w-full h-[48px] rounded-[9px] bg-[#13243c] hover:bg-[#1a3050] text-white font-bold text-[13px] leading-[48px] uppercase tracking-[0.03em] text-center transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
              >
                {creating && <Spinner />}
                {creating ? 'Création...' : 'Créer la session'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={closeConfirmOpen}
        title="Terminer cette session"
        message={`Clôturer « ${selectedSession?.name || 'cette session'} » maintenant ? Les gagnants seront désignés immédiatement pour les ${selectedSession?.vehicles?.length || selectedSession?.vehicleCount || 0} véhicule(s), les e-mails partiront et la procédure d'achat démarrera. Cette action est irréversible.`}
        confirmLabel={closingSession ? 'Clôture…' : 'Terminer la session'}
        onCancel={() => { if (!closingSession) setCloseConfirmOpen(false); }}
        onConfirm={handleCloseSession}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        title="Supprimer cette session"
        message={`Voulez-vous vraiment supprimer « ${selectedSession?.name || 'cette session'} » ? Les ${selectedSession?.vehicles?.length || selectedSession?.vehicleCount || 0} véhicule(s) associé(s) seront retirés de la session et redeviendront disponibles.`}
        confirmLabel={deletingSession ? 'Suppression…' : 'Supprimer'}
        danger
        onCancel={() => { if (!deletingSession) setDeleteConfirmOpen(false); }}
        onConfirm={handleDeleteSession}
      />
    </div>
  );
}
