'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  CommissionTier,
  CommissionTierDraft,
  CommissionType,
  emptyTierDraft,
  formatCommission,
  formatRange,
} from '../lib/commission';

interface CommissionTiersEditorProps {
  /** false = la session utilise ses propres tranches, true = elle suit la configuration globale */
  useDefault: boolean;
  onUseDefaultChange: (useDefault: boolean) => void;
  /** Tranches de la configuration globale, affichées en lecture seule en mode « par défaut » */
  defaultTiers: CommissionTier[];
  /** Tranches propres à la session, éditables en mode « personnalisé » */
  drafts: CommissionTierDraft[];
  onDraftsChange: (drafts: CommissionTierDraft[]) => void;
  disabled?: boolean;
}

const TYPE_OPTIONS: Array<{ value: CommissionType; label: string }> = [
  { value: 'percentage', label: '%' },
  { value: 'fixed', label: '€' },
];

export default function CommissionTiersEditor({
  useDefault,
  onUseDefaultChange,
  defaultTiers,
  drafts,
  onDraftsChange,
  disabled = false,
}: CommissionTiersEditorProps) {
  const updateDraft = (key: string, patch: Partial<CommissionTierDraft>) => {
    onDraftsChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  };

  const removeDraft = (key: string) => {
    onDraftsChange(drafts.filter((draft) => draft.key !== key));
  };

  const addDraft = () => {
    // Enchaîner sur la tranche la plus haute déjà saisie pour éviter les chevauchements
    const highest = drafts.reduce<number | null>((acc, draft) => {
      const max = draft.maxAmount === '' ? null : Number(draft.maxAmount);
      if (max === null || !Number.isFinite(max)) return acc;
      return acc === null || max > acc ? max : acc;
    }, null);
    onDraftsChange([...drafts, emptyTierDraft(highest === null ? '' : String(highest + 1))]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onUseDefaultChange(true)}
          className={`h-9 px-3.5 rounded-[8px] border text-[11px] font-bold uppercase tracking-[0.03em] transition cursor-pointer disabled:opacity-50 ${
            useDefault ? 'bg-[#13243c] border-[#13243c] text-white' : 'bg-white border-[#dcd7cb] text-[#4c5058] hover:border-[#13243c]'
          }`}
        >
          Configuration par défaut
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onUseDefaultChange(false)}
          className={`h-9 px-3.5 rounded-[8px] border text-[11px] font-bold uppercase tracking-[0.03em] transition cursor-pointer disabled:opacity-50 ${
            useDefault ? 'bg-white border-[#dcd7cb] text-[#4c5058] hover:border-[#13243c]' : 'bg-[#b3893f] border-[#b3893f] text-white'
          }`}
        >
          Personnaliser pour cette session
        </button>
      </div>

      {useDefault ? (
        <div className="rounded-[10px] border border-[#dcd7cb] bg-white overflow-hidden">
          <div className="px-3 py-2 bg-[#f8f7f2] border-b border-[#efece3] text-[11px] font-semibold text-[#5a5e66]">
            Cette session suit la configuration globale. Toute modification des commissions par défaut s’y appliquera.
          </div>
          {defaultTiers.length === 0 ? (
            <div className="px-3 py-4 text-[12px] italic text-[#5a5e66]">
              Aucune tranche par défaut n’est configurée (Configuration &gt; Commissions).
            </div>
          ) : (
            <ul className="divide-y divide-[#f1efe8]">
              {defaultTiers.map((tier, index) => (
                <li key={tier._id || index} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className={`text-[12px] font-semibold text-[#13243c] ${tier.active ? '' : 'line-through opacity-60'}`}>
                    {formatRange(tier)}
                  </span>
                  <span className="text-[12px] font-bold text-[#13243c] shrink-0">{formatCommission(tier)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.length === 0 && (
            <div className="rounded-[10px] border border-dashed border-[#dcd7cb] px-3 py-4 text-[12px] italic text-[#5a5e66]">
              Aucune tranche. Ajoutez-en au moins une pour cette session.
            </div>
          )}

          {drafts.map((draft) => (
            <div key={draft.key} className="grid grid-cols-2 gap-2 rounded-[10px] border border-[#dcd7cb] bg-white p-2.5 sm:grid-cols-[1fr_1fr_auto_1fr_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5a5e66]">De (€)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={disabled}
                  value={draft.minAmount}
                  onChange={(event) => updateDraft(draft.key, { minAmount: event.target.value })}
                  className="h-9 w-full rounded-[8px] border border-[#dcd7cb] px-2 text-[13px] text-[#1a2230] focus:border-[#13243c] focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5a5e66]">À (€)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="et plus"
                  disabled={disabled}
                  value={draft.maxAmount}
                  onChange={(event) => updateDraft(draft.key, { maxAmount: event.target.value })}
                  className="h-9 w-full rounded-[8px] border border-[#dcd7cb] px-2 text-[13px] text-[#1a2230] focus:border-[#13243c] focus:outline-none"
                />
              </label>

              <div className="flex gap-1">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => updateDraft(draft.key, { type: option.value })}
                    title={option.value === 'percentage' ? 'Pourcentage du montant' : 'Montant fixe'}
                    className={`h-9 w-9 rounded-[8px] border text-[12px] font-bold transition cursor-pointer disabled:opacity-50 ${
                      draft.type === option.value
                        ? 'bg-[#13243c] border-[#13243c] text-white'
                        : 'bg-white border-[#dcd7cb] text-[#4c5058] hover:border-[#13243c]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5a5e66]">
                  {draft.type === 'percentage' ? 'Commission (%)' : 'Commission (€)'}
                </span>
                <input
                  type="number"
                  min={0}
                  max={draft.type === 'percentage' ? 100 : undefined}
                  step="0.01"
                  disabled={disabled}
                  value={draft.value}
                  onChange={(event) => updateDraft(draft.key, { value: event.target.value })}
                  className="h-9 w-full rounded-[8px] border border-[#dcd7cb] px-2 text-[13px] text-[#1a2230] focus:border-[#13243c] focus:outline-none"
                />
              </label>

              <button
                type="button"
                disabled={disabled}
                onClick={() => removeDraft(draft.key)}
                title="Supprimer la tranche"
                className="h-9 w-9 rounded-[8px] border border-[#f0c9bd] flex items-center justify-center text-[#d9704f] transition hover:bg-orange-50 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <button
            type="button"
            disabled={disabled}
            onClick={addDraft}
            className="h-9 w-full rounded-[8px] border border-dashed border-[#b3893f] text-[11px] font-bold uppercase tracking-[0.03em] text-[#b3893f] transition hover:bg-[#faf1e4] disabled:opacity-50 cursor-pointer"
          >
            + Ajouter une tranche
          </button>
        </div>
      )}
    </div>
  );
}
