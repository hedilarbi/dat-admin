'use client';

import { useState } from 'react';
import { apiRequest } from '../../api';

interface AdminNoteCardProps {
  userId: string;
  initialText: string;
  updatedAt: string | null;
}

/**
 * Note interne sur un compte. Elle n'est jamais envoyée au titulaire : le serveur l'exclut de toute
 * lecture ordinaire, seules les routes admin la renvoient.
 */
export default function AdminNoteCard({ userId, initialText, updatedAt }: AdminNoteCardProps) {
  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = text !== savedText;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiRequest(`/admin/users/${userId}/note`, { method: 'PUT', body: JSON.stringify({ text }) });
      setSavedText(text);
      setSavedAt(res.adminNote?.updatedAt || new Date().toISOString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer la note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-7 rounded-[12px] border border-[#e5e1d7] bg-[#fffdf5] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-[0.06em] text-[#4c5058]">Note interne</div>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={5000}
        rows={4}
        placeholder="Ajoutez une note sur ce compte (jamais visible par l’utilisateur)…"
        className="mt-3 w-full resize-y rounded-[9px] border border-[#dcd7cb] bg-white p-3 text-[13px] leading-6 text-[#13243c] focus:border-[#13243c] focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-[#7a756a]">
          {savedAt ? `Dernière modification le ${new Date(savedAt).toLocaleString('fr-FR')}` : 'Aucune note enregistrée'}
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-[11px] font-semibold text-red-600">{error}</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="h-9 rounded-[8px] bg-[#13243c] px-4 text-[11px] font-bold uppercase text-white transition hover:bg-[#1a3050] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la note'}
          </button>
        </div>
      </div>
    </section>
  );
}
