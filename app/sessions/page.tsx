'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import Spinner from '../components/Spinner';
import type { VehicleDossier } from '../lib/vehicleDossier';

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
  date?: string;
}

interface SessionConfigData {
  daysOfWeek: number[];
  startTime: string;
  durationHours: number;
  autoGenerateWeeks: number;
  autoAssignVehicles: boolean;
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

export default function AdminSessionsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<VehicleDossier[]>([]);
  const [config, setConfig] = useState<SessionConfigData>({
    daysOfWeek: [1, 3, 5],
    startTime: '10:00',
    durationHours: 48,
    autoGenerateWeeks: 4,
    autoAssignVehicles: true,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Modals
  const [panelSessionId, setPanelSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [searchAvailable, setSearchAvailable] = useState('');

  const [configOpen, setConfigOpen] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createDuration, setCreateDuration] = useState(48);
  const [creating, setCreating] = useState(false);

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
          autoAssignVehicles: res.autoAssignVehicles ?? true,
        });
      }
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
    Promise.all([fetchSessions(), fetchConfig(), fetchAvailableVehicles()]).finally(() => setLoading(false));
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
        return { color: '#2f6f4f', label: 'Session ouverte', bg: '#e9f4ee' };
      case 'upcoming':
      case 'programmee':
        return { color: '#b3893f', label: 'Session à venir', bg: '#faf1e4' };
      case 'closed':
      case 'cloturee':
        return { color: '#9a917d', label: 'Session clôturée', bg: '#f1efe8' };
      case 'annulee':
        return { color: '#9a3b2f', label: 'Session annulée', bg: '#fbeae7' };
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

  // Open Session Detail Side Drawer
  const openSessionDetail = async (session: SessionData) => {
    setPanelSessionId(session._id);
    setSelectedSession(session);
    try {
      const detail = await apiRequest(`/sessions/${session._id}`);
      setSelectedSession(detail);
    } catch (err) {
      console.error(err);
    }
  };

  const closeSessionDetail = () => {
    setPanelSessionId(null);
    setSelectedSession(null);
  };

  const handleAddVehicleToSession = async (vehicleId: string) => {
    if (!selectedSession) return;
    try {
      await apiRequest(`/sessions/${selectedSession._id}/add-vehicle`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId }),
      });
      const updated = await apiRequest(`/sessions/${selectedSession._id}`);
      setSelectedSession(updated);
      await fetchSessions();
      await fetchAvailableVehicles();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout du véhicule.');
    }
  };

  const handleRemoveVehicleFromSession = async (vehicleId: string) => {
    if (!selectedSession) return;
    try {
      await apiRequest(`/sessions/${selectedSession._id}/remove-vehicle`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId }),
      });
      const updated = await apiRequest(`/sessions/${selectedSession._id}`);
      setSelectedSession(updated);
      await fetchSessions();
      await fetchAvailableVehicles();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du retrait du véhicule.');
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
        }),
      });
      setMessage('Session créée avec succès.');
      setCreateOpen(false);
      setCreateName('');
      setCreateDate('');
      await fetchSessions();
    } catch (err: any) {
      setError(err.message || 'Erreur de création de la session.');
    } finally {
      setCreating(false);
    }
  };

  const monthLabel = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="flex-1 w-full p-6 sm:p-8 lg:p-10 font-sans text-black bg-white min-h-full flex flex-col relative">
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

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {CALENDAR_WEEKDAY_HEADERS.map((wd) => (
          <div key={wd} className="text-center font-semibold text-[11px] leading-none uppercase tracking-[0.05em] text-[#9a917d] pb-1.5">
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
      <div className="flex items-center gap-[22px] border-t border-[#efece3] pt-4">
        <div className="flex items-center gap-2">
          <div className="w-[11px] h-[11px] rounded-[3px] bg-[#2f6f4f]" />
          <span className="font-medium text-[12px] leading-none text-[#5a5e66]">Session ouverte</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[11px] h-[11px] rounded-[3px] bg-[#b3893f]" />
          <span className="font-medium text-[12px] leading-none text-[#5a5e66]">Session à venir</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[11px] h-[11px] rounded-[3px] bg-[#9a917d]" />
          <span className="font-medium text-[12px] leading-none text-[#5a5e66]">Session clôturée</span>
        </div>
      </div>

      {/* MODAL 1: Session Detail Side Drawer */}
      {panelSessionId && selectedSession && (
        <div
          className="fixed inset-0 bg-[#13243c]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={closeSessionDetail}
        >
          <div
            className="w-full max-w-[1040px] max-h-[84vh] bg-white rounded-[16px] shadow-[0_26px_60px_rgba(0,0,0,0.28)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 sm:p-[26px_32px_20px] border-b border-[#efece3] flex justify-between items-start">
              <div>
                <div className="font-semibold text-[11px] leading-none tracking-[0.16em] uppercase text-[#a3987f] mb-2">
                  Du {new Date(selectedSession.startDate || selectedSession.date || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} au {new Date(selectedSession.endDate || (new Date(selectedSession.startDate || selectedSession.date || Date.now()).getTime() + (selectedSession.durationHours || 48) * 3600000)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="font-bold text-[26px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
                  {selectedSession.name}
                </div>
                <div className="font-semibold text-[12px] leading-none mt-1.5" style={{ color: statusMeta(selectedSession.status).color }}>
                  {statusMeta(selectedSession.status).label} · {selectedSession.vehicles?.length || selectedSession.vehicleCount || 0} véhicule(s) inscrit(s)
                </div>
              </div>

              <button
                type="button"
                onClick={closeSessionDetail}
                className="w-8 h-8 rounded-[8px] border border-[#dcd7cb] flex items-center justify-center font-semibold text-[15px] text-[#5a5e66] hover:bg-gray-50 transition cursor-pointer shrink-0"
              >
                ×
              </button>
            </div>

            {/* Split Content: Available vs Assigned */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left Column: Available Validated Vehicles */}
              <div className="flex-1 min-w-0 flex flex-col border-b md:border-b-0 md:border-r border-[#efece3]">
                <div className="p-4 sm:p-[18px_26px_12px]">
                  <div className="font-bold text-[11px] leading-none tracking-[0.06em] uppercase text-[#8a8270] mb-2.5">
                    Véhicules validés disponibles ({availableVehicles.length})
                  </div>
                  <input
                    type="text"
                    placeholder="Rechercher marque, immat, vendeur…"
                    value={searchAvailable}
                    onChange={(e) => setSearchAvailable(e.target.value)}
                    className="w-full h-10 border border-[#dcd7cb] rounded-[9px] px-3 font-normal text-[13px] text-[#1a2230] focus:outline-none focus:border-[#13243c] bg-white transition"
                  />
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-[4px_26px_20px] divide-y divide-[#f1efe8]">
                  {availableVehicles
                    .filter((v) => {
                      if (!searchAvailable) return true;
                      const q = searchAvailable.toLowerCase();
                      const label = [v.brand, v.model].join(' ').toLowerCase();
                      const plate = (v.registrationNumber || v.vin || '').toLowerCase();
                      return label.includes(q) || plate.includes(q);
                    })
                    .length === 0 ? (
                    <div className="py-8 text-center font-medium text-[13px] leading-relaxed text-[#9a917d]">
                      Aucun véhicule validé disponible sans session.
                    </div>
                  ) : (
                    availableVehicles
                      .filter((v) => {
                        if (!searchAvailable) return true;
                        const q = searchAvailable.toLowerCase();
                        const label = [v.brand, v.model].join(' ').toLowerCase();
                        const plate = (v.registrationNumber || v.vin || '').toLowerCase();
                        return label.includes(q) || plate.includes(q);
                      })
                      .map((v) => (
                        <div key={v._id} className="flex items-center gap-3 py-3">
                          <div className="w-[38px] h-[38px] rounded-[8px] bg-[#eef1f5] shrink-0 flex items-center justify-center font-bold text-[10px] leading-none text-[#8ea0bd]">
                            {(v.brand || 'VEH').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[13px] leading-snug text-[#13243c] truncate">
                              {[v.brand, v.model].filter(Boolean).join(' ') || 'Sans nom'}
                            </div>
                            <div className="font-normal text-[11px] leading-snug text-[#9a917d] mt-0.5 truncate">
                              {v.registrationNumber || v.vin || '—'} · {v.seller?.companyName || 'Vendeur'}
                            </div>
                          </div>
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
                  <div className="font-bold text-[11px] leading-none tracking-[0.06em] uppercase text-[#8a8270]">
                    Véhicules affectés à cette session ({selectedSession.vehicles?.length || 0})
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-[4px_26px_20px] divide-y divide-[#f1efe8]">
                  {!selectedSession.vehicles || selectedSession.vehicles.length === 0 ? (
                    <div className="py-8 text-center font-medium text-[13px] leading-relaxed text-[#9a917d]">
                      Aucun véhicule dans cette session.
                    </div>
                  ) : (
                    selectedSession.vehicles.map((v) => (
                      <div key={v._id} className="flex items-center gap-3 py-3">
                        <div className="w-[38px] h-[38px] rounded-[8px] bg-[#eef1f5] shrink-0 flex items-center justify-center font-bold text-[10px] leading-none text-[#8ea0bd]">
                          {(v.brand || 'VEH').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13px] leading-snug text-[#13243c] truncate">
                            {[v.brand, v.model].filter(Boolean).join(' ') || 'Sans nom'}
                          </div>
                          <div className="font-normal text-[11px] leading-snug text-[#9a917d] mt-0.5 truncate">
                            {v.registrationNumber || v.vin || '—'} · {v.seller?.companyName || 'Vendeur'}
                          </div>
                        </div>
                        <div className="font-semibold text-[12px] leading-none font-mono text-[#13243c] shrink-0">
                          {v.reservePrice ? `${v.reservePrice.toLocaleString('fr-FR')} €` : '—'}
                        </div>
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
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-[12px] text-[#8a8270]">
                    heures
                  </span>
                </div>
              </div>
            </div>

            {/* Affectation automatique */}
            <div className="mb-6.5 bg-[#fbfaf7] p-3.5 rounded-[9px] border border-[#eceadf]">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.autoAssignVehicles}
                  onChange={(e) => setConfig({ ...config, autoAssignVehicles: e.target.checked })}
                  className="w-4 h-4 rounded text-[#13243c] focus:ring-0 cursor-pointer"
                />
                <span className="font-semibold text-[13px] text-[#13243c]">
                  Affecter automatiquement les véhicules validés aux sessions à venir
                </span>
              </label>
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
            className="w-full max-w-[460px] bg-white rounded-[16px] shadow-[0_26px_60px_rgba(0,0,0,0.28)] p-6 sm:p-[30px_32px] animate-in fade-in zoom-in-95 duration-150 space-y-4"
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
    </div>
  );
}
