export type CommissionType = 'percentage' | 'fixed';

export interface CommissionTier {
  _id?: string;
  minAmount: number;
  maxAmount: number | null;
  type: CommissionType;
  value: number;
  label?: string;
  active: boolean;
}

/** Configuration de commission attachée à une session. */
export interface SessionCommission {
  /** true : la session suit la configuration globale ; false : elle a ses propres tranches. */
  useDefault: boolean;
  /** Tranches réellement applicables, telles que résolues par le serveur. */
  tiers: CommissionTier[];
}

/** Ligne de tranche telle que saisie dans un formulaire (champs en texte libre). */
export interface CommissionTierDraft {
  key: string;
  minAmount: string;
  maxAmount: string;
  type: CommissionType;
  value: string;
  label: string;
}

export const formatAmount = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amount);

export const formatRange = (tier: Pick<CommissionTier, 'minAmount' | 'maxAmount'>) =>
  tier.maxAmount === null || tier.maxAmount === undefined
    ? `À partir de ${formatAmount(tier.minAmount)}`
    : `De ${formatAmount(tier.minAmount)} à ${formatAmount(tier.maxAmount)}`;

export const formatCommission = (tier: Pick<CommissionTier, 'type' | 'value'>) =>
  tier.type === 'percentage' ? `${tier.value} %` : formatAmount(tier.value);

let draftKeySeed = 0;
const nextDraftKey = () => `tier-${++draftKeySeed}`;

export const emptyTierDraft = (minAmount = ''): CommissionTierDraft => ({
  key: nextDraftKey(),
  minAmount,
  maxAmount: '',
  type: 'percentage',
  value: '',
  label: '',
});

export const tierToDraft = (tier: CommissionTier): CommissionTierDraft => ({
  key: nextDraftKey(),
  minAmount: String(tier.minAmount),
  maxAmount: tier.maxAmount === null || tier.maxAmount === undefined ? '' : String(tier.maxAmount),
  type: tier.type,
  value: String(tier.value),
  label: tier.label || '',
});

export const draftToTier = (draft: CommissionTierDraft) => ({
  minAmount: Number(draft.minAmount),
  maxAmount: draft.maxAmount === '' ? null : Number(draft.maxAmount),
  type: draft.type,
  value: Number(draft.value),
  label: draft.label,
  active: true,
});

/**
 * Contrôle de saisie côté client, en miroir des règles appliquées par le serveur.
 * Retourne le premier problème rencontré, ou null si la liste est valide.
 */
export const validateDrafts = (drafts: CommissionTierDraft[]): string | null => {
  if (drafts.length === 0) return 'Ajoutez au moins une tranche de commission.';

  const parsed: Array<{ min: number; max: number }> = [];

  for (const draft of drafts) {
    const min = Number(draft.minAmount);
    if (draft.minAmount === '' || !Number.isFinite(min) || min < 0) {
      return 'Chaque tranche doit avoir un montant minimum positif.';
    }

    const max = draft.maxAmount === '' ? Infinity : Number(draft.maxAmount);
    if (draft.maxAmount !== '' && (!Number.isFinite(max) || max < 0)) {
      return 'Le montant maximum doit être un nombre positif, ou vide pour une tranche non bornée.';
    }
    if (max < min) {
      return 'Le montant maximum doit être supérieur ou égal au montant minimum.';
    }

    const value = Number(draft.value);
    if (draft.value === '' || !Number.isFinite(value) || value < 0) {
      return 'Chaque tranche doit avoir une valeur de commission positive.';
    }
    if (draft.type === 'percentage' && value > 100) {
      return 'Un pourcentage de commission ne peut pas dépasser 100 %.';
    }

    if (parsed.some((other) => min <= other.max && other.min <= max)) {
      return 'Deux tranches se chevauchent : un même montant ne peut pas avoir deux commissions.';
    }
    parsed.push({ min, max });
  }

  return null;
};

/**
 * Montants qu'aucune tranche active ne couvre — signalés à l'admin sans bloquer
 * l'enregistrement (aucune commission n'y sera calculée).
 */
export const findCoverageGaps = (tiers: CommissionTier[]): string[] => {
  const activeTiers = tiers.filter((tier) => tier.active).sort((a, b) => a.minAmount - b.minAmount);
  const gaps: string[] = [];
  // Les montants de vente commencent à 1 € : inutile de signaler un trou sous ce seuil.
  let expectedNext = 1;

  for (const tier of activeTiers) {
    if (tier.minAmount > expectedNext) {
      gaps.push(`de ${formatAmount(expectedNext)} à ${formatAmount(tier.minAmount - 1)}`);
    }
    if (tier.maxAmount === null || tier.maxAmount === undefined) return gaps;
    expectedNext = Math.max(expectedNext, tier.maxAmount + 1);
  }

  if (activeTiers.length > 0) {
    gaps.push(`à partir de ${formatAmount(expectedNext)}`);
  }
  return gaps;
};

/** Commission applicable à un montant, selon les mêmes règles que le serveur. */
export const computeCommission = (tiers: CommissionTier[], amount: number) => {
  const tier = tiers
    .filter((item) => item.active && item.minAmount <= amount && (item.maxAmount === null || item.maxAmount === undefined || item.maxAmount >= amount))
    .sort((a, b) => b.minAmount - a.minAmount)[0];

  if (!tier) return { tier: null, commission: 0 };

  const commission = tier.type === 'percentage' ? (amount * tier.value) / 100 : tier.value;
  return { tier, commission: Math.round(commission * 100) / 100 };
};
