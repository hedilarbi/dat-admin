'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api';
import Alert from '../../components/Alert';
import LoadingSpinner from '../../components/LoadingSpinner';
import Spinner from '../../components/Spinner';

type Translations = { fr: string; en: string };

interface ReasonMessage {
  key: string;
  label: Translations;
  message: Translations;
  type: 'inscription' | 'document' | 'vehicule';
}

const LANGUAGES: Array<{ code: keyof Translations; label: string }> = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

const EMPTY_TRANSLATIONS: Translations = { fr: '', en: '' };

const DEFAULT_VEHICLE_MESSAGES: Array<Omit<ReasonMessage, 'type'>> = [
  {
    key: 'photo_compteur_manquante',
    label: { fr: 'Photo du compteur manquante', en: 'Odometer photo missing' },
    message: {
      fr: 'La photo du compteur kilométrique est absente ou non lisible. Veuillez ajouter une photo nette du compteur.',
      en: 'The odometer photo is missing or unreadable. Please provide a clear photo of the dashboard mileage.',
    },
  },
  {
    key: 'rapport_expertise_illisible',
    label: { fr: "Rapport d'expertise illisible", en: 'Expert report unreadable' },
    message: {
      fr: "Le rapport d'expertise sinistre téléversé n'est pas lisible ou incomplet. Merci de téléverser un fichier PDF original.",
      en: 'The uploaded expert report is unreadable or incomplete. Please upload an original PDF file.',
    },
  },
  {
    key: 'carte_grise_manquante',
    label: { fr: 'Carte grise manquante ou illisible', en: 'Registration document missing or unreadable' },
    message: {
      fr: 'La carte grise (recto/verso) est manquante ou floue. Merci de fournir un scan lisible.',
      en: 'The registration document (front/back) is missing or blurry. Please provide a legible scan.',
    },
  },
  {
    key: 'prix_reserve_incoherent',
    label: { fr: 'Prix de réserve incohérent', en: 'Inconsistent reserve price' },
    message: {
      fr: 'Le prix de réserve indiqué semble incohérent au vu de l\'état et du marché du véhicule.',
      en: 'The indicated reserve price appears inconsistent given the vehicle condition and market value.',
    },
  },
];

export default function MessagesConfigurationPage() {
  const [messages, setMessages] = useState<ReasonMessage[]>([]);

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

  const startCreate = (defaultType: 'inscription' | 'vehicule' = 'inscription') => {
    resetForm();
    setFormType(defaultType);
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
        setSuccess('Message mis à jour avec succès.');
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
        setSuccess('Nouveau message créé.');
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
      setSuccess('Message supprimé.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const seedDefaultVehicleMessages = async () => {
    setSaving(true);
    setError('');
    try {
      for (const msg of DEFAULT_VEHICLE_MESSAGES) {
        const exists = messages.some((m) => m.key === msg.key);
        if (!exists) {
          await apiRequest('/admin/messages', {
            method: 'POST',
            body: JSON.stringify({ ...msg, type: 'vehicule' }),
          });
        }
      }
      await fetchMessages();
      setSuccess('Messages véhicules par défaut initialisés.');
    } catch (err: any) {
      setError(err.message || 'Erreur d\'initialisation.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Partition messages into 2 groups
  const inscriptionMessages = messages.filter((m) => m.type === 'inscription' || m.type === 'document');
  const vehicleMessages = messages.filter((m) => m.type === 'vehicule');

  return (
    <div className="flex-1 w-full p-6 sm:p-8 lg:p-10 font-sans text-black bg-white min-h-full">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
            Configuration système
          </div>
          <h1 className="m-0 font-bold text-[36px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
            Messages de refus & correction
          </h1>
          <p className="text-[13px] leading-relaxed text-[#5a5e66] mt-2 max-w-[720px]">
            Gérez les motifs et messages prédéfinis proposés lors de l'inspection des demandes d'inscription d'utilisateurs et des dossiers véhicules.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => startCreate('inscription')}
            className="h-10 px-4 bg-white border border-[#dcd7cb] hover:bg-gray-50 text-[#13243c] font-bold rounded-[8px] text-[12px] uppercase tracking-[0.03em] transition cursor-pointer"
          >
            + Message Inscription
          </button>
          <button
            type="button"
            onClick={() => startCreate('vehicule')}
            className="h-10 px-4 bg-[#13243c] hover:bg-[#1a3050] text-white font-bold rounded-[8px] text-[12px] uppercase tracking-[0.03em] transition cursor-pointer shadow-xs"
          >
            + Message Véhicule
          </button>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {success && <Alert variant="success" className="mb-6">{success}</Alert>}

      {/* Form Drawer / Box */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="border border-[#dcd7cb] bg-[#fbfaf7] rounded-[14px] p-5 sm:p-7 mb-8 shadow-md space-y-5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-[#efece3] pb-4">
            <h2 className="font-bold text-[16px] text-[#13243c] uppercase tracking-wide font-['Saira_Condensed',sans-serif]">
              {editingKey ? `Modifier le message "${editingKey}"` : 'Créer un nouveau message'}
            </h2>
            <button
              type="button"
              onClick={() => { setFormOpen(false); resetForm(); }}
              className="text-xs font-bold text-[#8a8270] hover:text-[#13243c] transition cursor-pointer"
            >
              × Annuler
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#8a8270] uppercase tracking-wide mb-1.5">
                Clé unique (Identifiant système)
              </label>
              <input
                required
                disabled={!!editingKey}
                type="text"
                placeholder="ex: photo_compteur_manquante"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                className="w-full h-10 border border-[#dcd7cb] rounded-[8px] px-3 font-mono text-[13px] text-[#1a2230] bg-white disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:border-[#13243c]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#8a8270] uppercase tracking-wide mb-1.5">
                Bloc / Catégorie
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as any)}
                className="w-full h-10 border border-[#dcd7cb] rounded-[8px] px-3 font-semibold text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
              >
                <option value="inscription">Inscriptions (Comptes & Utilisateurs)</option>
                <option value="document">Documents Utilisateur (KBIS, CNI)</option>
                <option value="vehicule">Dossiers Véhicules & Annonces</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div>
              <div className="font-bold text-[12px] text-[#13243c] uppercase tracking-wide mb-3">
                Libellé court (affiché dans le menu admin)
              </div>
              <div className="space-y-3">
                {LANGUAGES.map((lang) => (
                  <div key={lang.code}>
                    <label className="block text-[11px] font-semibold text-[#8a8270] mb-1">
                      {lang.label}
                    </label>
                    <input
                      required
                      type="text"
                      placeholder={`Libellé en ${lang.label}`}
                      value={formLabel[lang.code]}
                      onChange={(e) => setFormLabel({ ...formLabel, [lang.code]: e.target.value })}
                      className="w-full h-10 border border-[#dcd7cb] rounded-[8px] px-3 font-medium text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="font-bold text-[12px] text-[#13243c] uppercase tracking-wide mb-3">
                Message envoyé à l'utilisateur (e-mail & notification)
              </div>
              <div className="space-y-3">
                {LANGUAGES.map((lang) => (
                  <div key={lang.code}>
                    <label className="block text-[11px] font-semibold text-[#8a8270] mb-1">
                      {lang.label}
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder={`Texte explicatif envoyé au client en ${lang.label}`}
                      value={formMessage[lang.code]}
                      onChange={(e) => setFormMessage({ ...formMessage, [lang.code]: e.target.value })}
                      className="w-full border border-[#dcd7cb] rounded-[8px] p-3 font-normal text-[13px] text-[#1a2230] bg-white focus:outline-none focus:border-[#13243c]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setFormOpen(false); resetForm(); }}
              className="h-10 px-4 border border-[#dcd7cb] rounded-[8px] text-[#13243c] font-semibold text-[12px] hover:bg-gray-100 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-6 bg-[#13243c] hover:bg-[#1a3050] text-white font-bold rounded-[8px] text-[12px] uppercase tracking-[0.03em] transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {saving && <Spinner />}
              {saving ? 'Enregistrement...' : editingKey ? 'Mettre à jour' : 'Enregistrer le message'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-9">
        {/* BLOC 1: Messages pour les Inscriptions & Documents */}
        <section className="border border-[#eceadf] rounded-[14px] overflow-hidden bg-white shadow-xs">
          <div className="p-5 bg-[#faf1e4] border-b border-[#ebdcc9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[18px] uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
                  Messages — Inscriptions & Comptes Utilisateurs
                </span>
                <span className="font-bold text-[11px] px-2.5 py-0.5 rounded-full bg-[#b3893f] text-white uppercase">
                  {inscriptionMessages.length}
                </span>
              </div>
              <p className="text-[12px] text-[#8a6a2f] mt-0.5">
                Motifs de rejet et de demande de correction sur les pièces d'identité, KBIS et justificatifs vendeurs/acheteurs.
              </p>
            </div>

            <button
              type="button"
              onClick={() => startCreate('inscription')}
              className="h-8 px-3.5 bg-white border border-[#b3893f] text-[#b3893f] hover:bg-[#b3893f] hover:text-white font-bold rounded-[7px] text-[11px] uppercase tracking-[0.03em] transition cursor-pointer shrink-0 self-start sm:self-auto"
            >
              + Ajouter motif inscription
            </button>
          </div>

          <div className="divide-y divide-[#efece3]">
            {inscriptionMessages.length === 0 ? (
              <div className="p-8 text-center text-[#9a917d] text-xs font-medium italic">
                Aucun message configuré pour les inscriptions.
              </div>
            ) : (
              inscriptionMessages.map((item) => (
                <div key={item.key} className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-[#fcfbf9] transition">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-[14px] text-[#13243c]">
                        {item.label.fr}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#faf1e4] text-[#b3893f] rounded-full">
                        {item.type}
                      </span>
                      <span className="text-[11px] text-[#9a917d] font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.key}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#5a5e66] leading-relaxed">
                      {item.message.fr}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="font-bold text-[12px] text-[#13243c] hover:underline cursor-pointer"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.key)}
                      className="font-bold text-[12px] text-[#9a3b2f] hover:underline cursor-pointer"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* BLOC 2: Messages pour les Dossiers Véhicules */}
        <section className="border border-[#eceadf] rounded-[14px] overflow-hidden bg-white shadow-xs">
          <div className="p-5 bg-[#fdece4] border-b border-[#f5d5c7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[18px] uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
                  Messages — Dossiers Véhicules & Annonces
                </span>
                <span className="font-bold text-[11px] px-2.5 py-0.5 rounded-full bg-[#d9704f] text-white uppercase">
                  {vehicleMessages.length}
                </span>
              </div>
              <p className="text-[12px] text-[#b04a2c] mt-0.5">
                Motifs proposés lors du refus ou de la demande de correction d'une annonce (compteur, carte grise, rapport expert, prix...).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {vehicleMessages.length === 0 && (
                <button
                  type="button"
                  onClick={seedDefaultVehicleMessages}
                  disabled={saving}
                  className="h-8 px-3 bg-white border border-[#d9704f] text-[#d9704f] hover:bg-[#d9704f] hover:text-white font-bold rounded-[7px] text-[11px] uppercase tracking-[0.03em] transition cursor-pointer"
                >
                  Initialiser motifs par défaut
                </button>
              )}

              <button
                type="button"
                onClick={() => startCreate('vehicule')}
                className="h-8 px-3.5 bg-[#d9704f] hover:bg-[#c26040] text-white font-bold rounded-[7px] text-[11px] uppercase tracking-[0.03em] transition cursor-pointer"
              >
                + Ajouter motif véhicule
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#efece3]">
            {vehicleMessages.length === 0 ? (
              <div className="p-8 text-center text-[#9a917d] text-xs font-medium italic">
                Aucun message configuré pour les véhicules. Cliquez sur "+ Ajouter motif véhicule" ou "Initialiser motifs par défaut".
              </div>
            ) : (
              vehicleMessages.map((item) => (
                <div key={item.key} className="p-4 sm:p-5 flex items-start justify-between gap-4 hover:bg-[#fcfbf9] transition">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-[14px] text-[#13243c]">
                        {item.label.fr}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#fdece4] text-[#d9704f] rounded-full">
                        véhicule
                      </span>
                      <span className="text-[11px] text-[#9a917d] font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.key}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#5a5e66] leading-relaxed">
                      {item.message.fr}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="font-bold text-[12px] text-[#13243c] hover:underline cursor-pointer"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.key)}
                      className="font-bold text-[12px] text-[#9a3b2f] hover:underline cursor-pointer"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
