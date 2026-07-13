'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api';
import PageHeader from '../../components/PageHeader';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import FilterPills from '../../components/FilterPills';

type Translations = { fr: string; en: string; };

interface ReasonMessage {
  key: string;
  label: Translations;
  message: Translations;
  type: 'inscription' | 'document' | 'vehicule';
}

const LANGUAGES: Array<{ code: keyof Translations; label: string; }> = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

const EMPTY_TRANSLATIONS: Translations = { fr: '', en: '' };

const TYPE_LABELS: Record<string, string> = {
  inscription: 'Inscription',
  document: 'Document',
  vehicule: 'Véhicule',
};

export default function MessagesConfigurationPage() {
  const [messages, setMessages] = useState<ReasonMessage[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'inscription' | 'document' | 'vehicule'>('all');

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formType, setFormType] = useState<'inscription' | 'document' | 'vehicule'>('inscription');
  const [formLabel, setFormLabel] = useState<Translations>(EMPTY_TRANSLATIONS);
  const [formMessage, setFormMessage] = useState<Translations>(EMPTY_TRANSLATIONS);
  const [formOpen, setFormOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMessages = async () => {
    try {
      const res = await apiRequest('/admin/messages');
      setMessages(res.messages || []);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement des messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const resetForm = () => {
    setEditingKey(null);
    setFormKey('');
    setFormType('inscription');
    setFormLabel(EMPTY_TRANSLATIONS);
    setFormMessage(EMPTY_TRANSLATIONS);
  };

  const startCreate = () => {
    resetForm();
    setFormOpen(true);
    setError('');
    setSuccess('');
  };

  const startEdit = (item: ReasonMessage) => {
    setEditingKey(item.key);
    setFormKey(item.key);
    setFormType(item.type);
    setFormLabel(item.label);
    setFormMessage(item.message);
    setFormOpen(true);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      if (editingKey) {
        await apiRequest(`/admin/messages/${editingKey}`, {
          method: 'PUT',
          body: JSON.stringify({ label: formLabel, message: formMessage, type: formType }),
        });
        setSuccess('Message mis à jour.');
      } else {
        if (!formKey.trim()) {
          setError('La clé est obligatoire.');
          setSaving(false);
          return;
        }
        await apiRequest('/admin/messages', {
          method: 'POST',
          body: JSON.stringify({ key: formKey.trim(), label: formLabel, message: formMessage, type: formType }),
        });
        setSuccess('Message créé.');
      }
      setFormOpen(false);
      resetForm();
      await fetchMessages();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Supprimer définitivement le message "${key}" ?`)) return;
    setError('');
    try {
      await apiRequest(`/admin/messages/${key}`, { method: 'DELETE' });
      await fetchMessages();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredMessages = messages.filter(m => typeFilter === 'all' || m.type === typeFilter);

  if (loading) {
    return <LoadingSpinner />;
  }

  const typeFilterOptions = (['all', 'inscription', 'document', 'vehicule'] as const).map(t => ({
    value: t,
    label: t === 'all' ? 'Tous les types' : TYPE_LABELS[t],
  }));

  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-8 sm:p-10 font-sans text-black bg-[#fbfaf7]">
      <PageHeader
        eyebrow="Configuration"
        title="Messages de refus & correction"
        description="Ces messages sont proposés à l'administrateur lors d'une décision de refus ou de demande de correction sur une soumission, et sont envoyés à l'utilisateur dans sa langue."
        action={
          <button
            type="button"
            onClick={startCreate}
            className="h-11 px-5 bg-[#13243c] hover:bg-slate-800 text-white font-bold rounded-[9px] text-xs uppercase tracking-[0.03em] transition cursor-pointer"
          >
            + Nouveau message
          </button>
        }
      />

      <div className="mb-6">
        <FilterPills options={typeFilterOptions} value={typeFilter} onChange={setTypeFilter} />
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      {formOpen && (
        <form onSubmit={handleSubmit} className="border border-[#eceadf] bg-white rounded-[12px] p-6 mb-7 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-[#13243c] uppercase tracking-wide">
              {editingKey ? `Modifier "${editingKey}"` : 'Nouveau message'}
            </h2>
            <button type="button" onClick={() => { setFormOpen(false); resetForm(); }} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
              Annuler
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Clé (identifiant unique)</label>
              <input
                required
                disabled={!!editingKey}
                type="text"
                placeholder="ex: kbis_expire"
                value={formKey}
                onChange={e => setFormKey(e.target.value)}
                className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm text-black bg-white disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as any)}
                className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm text-black bg-white"
              >
                <option value="inscription">Inscription</option>
                <option value="document">Document</option>
                <option value="vehicule">Véhicule</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="font-bold text-xs text-[#13243c] uppercase tracking-wide mb-3">Libellé (affiché à l&apos;admin)</div>
              <div className="space-y-3">
                {LANGUAGES.map(lang => (
                  <div key={lang.code}>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">{lang.label}</label>
                    <input
                      required
                      type="text"
                      value={formLabel[lang.code]}
                      onChange={e => setFormLabel({ ...formLabel, [lang.code]: e.target.value })}
                      className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm text-black bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="font-bold text-xs text-[#13243c] uppercase tracking-wide mb-3">Message envoyé à l&apos;utilisateur</div>
              <div className="space-y-3">
                {LANGUAGES.map(lang => (
                  <div key={lang.code}>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">{lang.label}</label>
                    <textarea
                      required
                      rows={2}
                      value={formMessage[lang.code]}
                      onChange={e => setFormMessage({ ...formMessage, [lang.code]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-black bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="h-11 px-6 bg-[#2f6f4f] hover:bg-emerald-800 text-white font-bold rounded-[9px] text-xs uppercase tracking-[0.03em] transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Enregistrement...' : editingKey ? 'Mettre à jour' : 'Créer le message'}
            </button>
          </div>
        </form>
      )}

      <div className="border border-[#eceadf] bg-white rounded-[12px] overflow-hidden shadow-sm">
        {filteredMessages.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm italic">
            Aucun message configuré pour le moment.
          </div>
        ) : (
          filteredMessages.map(item => (
            <div key={item.key} className="p-[16px_20px] border-b border-[#efece3] last:border-b-0 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-[#13243c]">{item.label.fr}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded">{TYPE_LABELS[item.type]}</span>
                  <span className="text-[10px] text-gray-400 font-mono">{item.key}</span>
                </div>
                <p className="text-xs text-gray-500">{item.message.fr}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(item)} className="text-xs font-bold text-[#13243c] hover:underline cursor-pointer">Modifier</button>
                <button onClick={() => handleDelete(item.key)} className="text-xs font-bold text-red-600 hover:underline cursor-pointer">Supprimer</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
