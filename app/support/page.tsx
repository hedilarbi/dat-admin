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
      const res = await apiRequest(`/tickets/${selectedTicket._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText })
      });
      setSelectedTicket(res.ticket);
      setReplyText('');
      setMessage('Réponse envoyée au client.');
      await fetchTickets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingReply(false);
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
        <div className="w-full lg:w-[400px] border-r border-[#eceadf] shrink-0 min-h-0 bg-white">
          <SkeletonRows count={8} />
        </div>
        <div className="flex-1 bg-[#fbfaf7]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 bg-white font-sans text-black">
      {/* Column 1: Tickets List */}
      <div className="w-full lg:w-[400px] border-r border-[#eceadf] flex flex-col shrink-0 min-h-0 select-none bg-white">
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

      {/* Column 2: Selected Ticket Thread & Actions */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#fbfaf7]">
        {selectedTicket ? (
          <>
            {/* Header */}
            <div className="p-[20px_24px] border-b border-[#eceadf] bg-white flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
              <div>
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && <Alert variant="error">{error}</Alert>}
              {message && <Alert variant="success">{message}</Alert>}

              {selectedTicket.messages.map(m => {
                const isAdmin = m.senderRole === 'admin';
                return (
                  <div key={m._id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[75%] rounded-[12px] p-4 ${isAdmin ? 'bg-[#13243c] text-white' : 'bg-white border border-[#eceadf] text-[#1a2230] shadow-sm'}`}>
                      <div className="flex justify-between items-center gap-4 mb-2 border-b border-opacity-10 pb-1">
                        <span className={`font-bold text-xs ${isAdmin ? 'text-[#b3893f]' : 'text-[#d9704f]'}`}>
                          {isAdmin ? '🛡️ Administration Auto Connect' : `${m.sender?.companyName || 'Client'} (${m.senderRole})`}
                        </span>
                        <span className={`text-[10px] ${isAdmin ? 'text-gray-400' : 'text-gray-400'}`}>
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
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
                <button type="submit" disabled={sendingReply} className="self-end px-5 py-2 bg-[#13243c] hover:bg-slate-800 text-white font-bold rounded-[8px] text-xs uppercase transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {sendingReply && <Spinner />}
                  Envoyer au client
                </button>
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
