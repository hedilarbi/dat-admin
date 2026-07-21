'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../api';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';
import SkeletonRows from '../components/SkeletonRows';
import FilterPills from '../components/FilterPills';
import { Badge, getTicketStatusBadge } from '../components/StatusBadge';
import { getCategoryLabel } from '../lib/categoryLabels';
import { compressImageIfNeeded, MAX_UPLOAD_BYTES } from '../lib/imageCompression';

interface TicketMessage {
  _id: string;
  sender: { firstName: string; lastName: string; role: string; companyName: string; };
  senderRole: 'admin' | 'vendeur' | 'acheteur';
  content: string;
  attachments?: string[];
  createdAt: string;
}

interface Ticket {
  _id: string;
  user: { firstName: string; lastName: string; companyName: string; email: string; role: string; };
  title: string;
  category: string;
  priority: string;
  status: 'ouverte' | 'en_attente_admin' | 'en_attente_utilisateur' | 'en_cours' | 'cloturee' | 'reouverte';
  messages: TicketMessage[];
  internalNotes?: Array<{ admin: { firstName: string; lastName: string; }; content: string; createdAt: string; }>;
  createdAt: string;
  updatedAt: string;
}

export default function AdminSupportPage() {
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');

  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState('');
  const [replyFileName, setReplyFileName] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [internalNoteText, setInternalNoteText] = useState('');
  const [internalNoteTicketId, setInternalNoteTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Un ticket n'a qu'une seule note interne : pré-remplir le champ avec son contenu
  // à chaque changement de ticket sélectionné (ajustement d'état pendant le rendu).
  if (selectedTicket && selectedTicket._id !== internalNoteTicketId) {
    setInternalNoteTicketId(selectedTicket._id);
    setInternalNoteText(selectedTicket.internalNotes?.[0]?.content || '');
  }

  const fetchTickets = async () => {
    try {
      const res = await apiRequest('/tickets');
      setTickets(res.tickets || []);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement des tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const res = await apiRequest(`/tickets/${ticketId}`);
      setSelectedTicket(res.ticket);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setError('');
    setMessage('');
    setSendingReply(true);
    try {
      const attachments = replyFile ? [replyFile] : [];
      const res = await apiRequest(`/tickets/${selectedTicket._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText, attachments })
      });
      setSelectedTicket(res.ticket);
      setReplyText('');
      setReplyFile('');
      setReplyFileName('');
      setMessage('Réponse envoyée au client.');
      await fetchTickets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setError('');

    const file = await compressImageIfNeeded(rawFile);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Fichier trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo). Taille maximale : ${MAX_UPLOAD_BYTES / (1024 * 1024)} Mo.`);
      e.target.value = '';
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const responseText = await res.text();
      let data: any = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error("Échec de l'envoi de la pièce jointe.");
        }
      }

      if (!res.ok || !data.url) {
        throw new Error(data.message || "Échec de l'envoi de la pièce jointe.");
      }

      setReplyFile(data.url);
      setReplyFileName(file.name);
    } catch (err: any) {
      setError(err.message || "Échec de l'envoi de la pièce jointe.");
      setReplyFile('');
      setReplyFileName('');
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleUpdateTicketStatus = async (status: string) => {
    if (!selectedTicket) return;
    try {
      const res = await apiRequest(`/tickets/${selectedTicket._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      setSelectedTicket(res.ticket);
      setMessage(`Statut mis à jour (${status}).`);
      await fetchTickets();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !internalNoteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await apiRequest(`/tickets/${selectedTicket._id}/internal-notes`, {
        method: 'POST',
        body: JSON.stringify({ content: internalNoteText })
      });
      setSelectedTicket(res.ticket);
      setMessage('Note interne enregistrée.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingNote(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.user?.companyName?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.category?.toLowerCase().includes(ticketSearch.toLowerCase());
    const matchesStatus = ticketStatusFilter === 'all' ||
      (ticketStatusFilter === 'attente' && t.status === 'en_attente_admin') ||
      (ticketStatusFilter === 'attente_user' && t.status === 'en_attente_utilisateur') ||
      (ticketStatusFilter === 'cloturee' && t.status === 'cloturee');
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 bg-white font-sans">
        <div className="w-full lg:w-[400px] max-lg:h-full border-r border-[#eceadf] shrink-0 min-h-0 bg-white">
          <SkeletonRows count={8} />
        </div>
        <div className="hidden lg:block flex-1 bg-[#fbfaf7]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 bg-white font-sans text-black">
      {/* Column 1: Tickets List — hidden on mobile once a ticket is open, so its detail pane can take the full screen instead of both panes stacking and the empty-state placeholder swallowing most of the viewport */}
      <div className={`${selectedTicket ? 'hidden lg:flex' : 'flex'} w-full lg:w-[400px] max-lg:h-full border-r border-[#eceadf] flex-col shrink-0 min-h-0 select-none bg-white`}>
        <div className="p-[22px_20px_14px]">
          <div className="font-semibold text-[11px] tracking-[0.2em] uppercase text-[#a3987f] mb-1">
            Messagerie & Réclamations
          </div>
          <h1 className="text-[26px] font-bold font-heading uppercase text-[#13243c] mb-[14px]">
            Support Client
          </h1>
          <input
            type="text"
            placeholder="Rechercher société, sujet, catégorie…"
            value={ticketSearch}
            onChange={e => setTicketSearch(e.target.value)}
            className="w-full h-[42px] border border-[#dcd7cb] rounded-[9px] px-4 text-[13px] text-[#1a2230] placeholder-[#9a917d] mb-[12px] focus:outline-none focus:ring-1 focus:ring-[#13243c]"
          />

          <FilterPills
            options={[
              { value: 'all', label: `Tous (${tickets.length})`, activeClassName: 'bg-[#13243c] text-white' },
              { value: 'attente', label: 'Attente admin', activeClassName: 'bg-[#b3893f] text-white' },
              { value: 'attente_user', label: 'Attente client', activeClassName: 'bg-[#d9704f] text-white' },
              { value: 'cloturee', label: 'Clôturés', activeClassName: 'bg-[#5a5e66] text-white' },
            ]}
            value={ticketStatusFilter}
            onChange={setTicketStatusFilter}
            baseClassName="text-[11px] font-bold px-3 py-1.5 rounded-full transition"
            inactiveClassName="bg-white border text-[#4c5058] hover:bg-gray-50"
          />
        </div>

        <div className="flex-1 overflow-y-auto border-t border-[#efece3]">
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 italic">Aucun ticket trouvé.</div>
          ) : (
            filteredTickets.map(t => {
              const isSelected = selectedTicket?._id === t._id;
              const meta = getTicketStatusBadge(t.status);
              const isPendingAdmin = t.status === 'en_attente_admin';
              let rowBg = isSelected ? '#f5f7fa' : isPendingAdmin ? '#fdf6ee' : '#fff';
              let rowBorder = isSelected ? '#13243c' : isPendingAdmin ? '#b3893f' : 'transparent';

              return (
                <div
                  key={t._id}
                  onClick={() => fetchTicketDetails(t._id)}
                  style={{ background: rowBg, borderLeft: `4px solid ${rowBorder}` }}
                  className="p-[16px_20px] border-b border-[#efece3] cursor-pointer flex flex-col transition hover:bg-gray-50"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[13px] text-[#13243c] truncate max-w-[210px]">{t.user?.companyName || 'Société'}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">{t.user?.role}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#8a8270] uppercase tracking-[0.03em] mb-1">{getCategoryLabel(t.category)}</div>
                  <div className="text-[13px] font-semibold text-[#13243c] leading-[1.3] mb-2 truncate">{t.title}</div>
                  <div className="flex justify-between items-center">
                    <Badge style={meta} className="px-2.5 py-0.5" />
                    <span className="text-[11px] text-gray-400">{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column 2: Selected Ticket Thread & Actions — hidden on mobile until a ticket is selected */}
      <div className={`${selectedTicket ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-w-0 max-lg:h-full bg-[#fbfaf7]`}>
        {selectedTicket ? (
          <>
            {/* Header */}
            <div className="p-4 sm:p-[20px_24px] border-b border-[#eceadf] bg-white flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="lg:hidden text-[13px] font-bold text-[#d9704f] underline hover:text-[#c26040] mb-3 block"
                >
                  ← Retour à la liste
                </button>
                <div className="text-xs font-semibold text-[#8a8270] uppercase">
                  {getCategoryLabel(selectedTicket.category)} · Priorité {selectedTicket.priority}
                </div>
                <h2 className="text-[20px] font-bold font-heading uppercase text-[#13243c] leading-tight mt-0.5">
                  {selectedTicket.title}
                </h2>
                <div className="text-xs text-gray-500 mt-1">
                  Demandeur : <strong>{selectedTicket.user?.companyName}</strong> ({selectedTicket.user?.email})
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedTicket.status}
                  onChange={e => handleUpdateTicketStatus(e.target.value)}
                  className="h-9 px-3 border border-[#dcd7cb] rounded-[8px] text-xs font-bold bg-[#faf1e4] text-[#b3893f] cursor-pointer"
                >
                  <option value="en_attente_admin">En attente admin</option>
                  <option value="en_attente_utilisateur">En attente utilisateur</option>
                  <option value="en_cours">En cours</option>
                  <option value="cloturee">Clôturée</option>
                </select>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {error && <Alert variant="error">{error}</Alert>}
              {message && <Alert variant="success">{message}</Alert>}

              {selectedTicket.messages.map(m => {
                const isAdmin = m.senderRole === 'admin';
                return (
                  <div key={m._id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[92%] sm:max-w-[75%] rounded-[12px] p-3 sm:p-4 ${isAdmin ? 'bg-[#13243c] text-white' : 'bg-white border border-[#eceadf] text-[#1a2230] shadow-sm'}`}>
                      <div className="flex justify-between items-center gap-4 mb-2 border-b border-opacity-10 pb-1">
                        <span className={`font-bold text-xs ${isAdmin ? 'text-[#b3893f]' : 'text-[#d9704f]'}`}>
                          {isAdmin ? '🛡️ Administration Auto Connect' : `${m.sender?.companyName || 'Client'} (${m.senderRole})`}
                        </span>
                        <span className={`text-[10px] ${isAdmin ? 'text-gray-400' : 'text-gray-400'}`}>
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className={`mt-2 pt-1.5 border-t border-dashed ${isAdmin ? 'border-white/20' : 'border-gray-300'}`}>
                          {m.attachments.map((url, uidx) => (
                            <a
                              key={uidx}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className={`text-[11px] font-bold underline block truncate hover:opacity-80 ${isAdmin ? 'text-white' : 'text-[#13243c]'}`}
                            >
                              📎 Pièce jointe {uidx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply & Internal Notes forms */}
            <div className="border-t border-[#eceadf] bg-white p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
              {/* Client Reply */}
              <form onSubmit={handleSendAdminReply} className="flex flex-col gap-2">
                <div className="font-bold text-xs text-[#13243c] uppercase">✉️ Réponse au client ({selectedTicket.user?.companyName})</div>
                <textarea
                  required
                  rows={3}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Écrivez une réponse officielle au professionnel..."
                  className="w-full border border-[#dcd7cb] rounded-[9px] p-3 text-xs text-[#1a2230] focus:outline-none focus:ring-1 focus:ring-[#13243c]"
                />
                <div className="flex justify-between items-center gap-2">
                  <label className={`h-9 border rounded-[8px] px-3 flex items-center gap-2 max-w-[180px] transition cursor-pointer text-xs shrink-0 ${replyFile ? 'border-[#bcd8c8] bg-[#f2f8f4] text-[#2f6f4f]' : 'border-[#dcd7cb] bg-gray-50 hover:bg-gray-100 text-[#4c5058]'}`}>
                    {uploadingAttachment ? <Spinner /> : (replyFile ? '✓' : '📎')}
                    {replyFile && !uploadingAttachment && <span className="truncate font-semibold">{replyFileName}</span>}
                    {!replyFile && !uploadingAttachment && <span className="font-semibold">Joindre un fichier</span>}
                    <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploadingAttachment} />
                  </label>
                  <button type="submit" disabled={sendingReply || uploadingAttachment} className="px-5 py-2 bg-[#13243c] hover:bg-slate-800 text-white font-bold rounded-[8px] text-xs uppercase transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0">
                    {sendingReply && <Spinner />}
                    Envoyer au client
                  </button>
                </div>
              </form>

              {/* Internal Note */}
              <form onSubmit={handleAddInternalNote} className="flex flex-col gap-2 bg-[#faf1e4] p-3.5 rounded-[10px] border border-[#e8dfcf]">
                <div className="font-bold text-xs text-[#b3893f] uppercase">Note interne</div>
                <textarea
                  required
                  rows={2}
                  value={internalNoteText}
                  onChange={e => setInternalNoteText(e.target.value)}
                  placeholder="Ajouter une note de suivi interne..."
                  className="w-full border border-[#dcd7cb] rounded-[9px] p-2.5 text-xs text-[#1a2230] bg-white focus:outline-none"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">
                    {selectedTicket.internalNotes?.[0]
                      ? `Modifiée par ${selectedTicket.internalNotes[0].admin?.firstName || ''} ${selectedTicket.internalNotes[0].admin?.lastName || ''} le ${new Date(selectedTicket.internalNotes[0].createdAt).toLocaleString('fr-FR')}`
                      : 'Aucune note pour ce dossier'}
                  </span>
                  <button type="submit" disabled={savingNote} className="px-4 py-1.5 bg-[#b3893f] hover:bg-[#9a7332] text-white font-bold rounded-[8px] text-xs uppercase cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingNote && <Spinner />}
                    {selectedTicket.internalNotes?.[0] ? 'Modifier la note' : '+ Ajouter la note'}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-[#9a917d] select-none text-sm font-medium p-8 text-center">
            ← Sélectionnez un ticket dans la liste de gauche pour en lire le fil de conversation et y répondre.
          </div>
        )}
      </div>
    </div>
  );
}
