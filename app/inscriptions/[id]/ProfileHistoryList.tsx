'use client';

import { DOCUMENT_FIELDS, LABELS } from './ProfileChangesPanel';

export interface ProfileHistoryEntry {
  requestedAt?: string;
  decidedAt: string;
  decision: 'valide' | 'refuse';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  requestedChanges?: Record<string, unknown>;
  reasons?: string[];
  comment?: string;
}

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());

/** Aplatit un profil (ou un extrait) en « champ → valeur » : address.city, bankInfo.iban… */
const flatten = (value: unknown, prefix = '', out: Record<string, string> = {}) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, next] of Object.entries(value as Record<string, unknown>)) flatten(next, `${prefix}${key}${next && typeof next === 'object' ? '.' : ''}`, out);
  } else if (prefix) {
    out[prefix] = text(value);
  }
  return out;
};

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('fr-FR') : '—');

const showValue = (field: string, value: string) => {
  if (!value) return <span className="text-[#a3987f]">—</span>;
  if (DOCUMENT_FIELDS.has(field)) return <a href={value} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#13243c] underline">Voir le document</a>;
  return <span className="break-words font-semibold text-[#13243c]">{value}</span>;
};

const SnapshotView = ({ title, snapshot }: { title: string; snapshot?: Record<string, unknown> }) => {
  if (!snapshot) return null;
  const rows = Object.entries(flatten(snapshot));
  return (
    <details className="rounded-[9px] border border-[#eceadf] bg-white">
      <summary className="cursor-pointer select-none px-3.5 py-2.5 text-[12px] font-bold uppercase tracking-[0.05em] text-[#13243c]">{title}</summary>
      <dl className="divide-y divide-[#f1efe8] border-t border-[#f1efe8]">
        {rows.map(([field, value]) => (
          <div key={field} className="grid gap-1 px-3.5 py-2 text-[13px] sm:grid-cols-[190px_1fr] sm:gap-3">
            <dt className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#5a5e66]">{LABELS[field] || field}</dt>
            <dd>{showValue(field, value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
};

/**
 * Demandes de modification de profil déjà traitées, de la plus récente à la plus ancienne. Pour
 * chacune : ce qui a changé, et la copie complète du profil avant et après la validation — elles
 * ne sont jamais écrasées ni supprimées.
 */
export default function ProfileHistoryList({ entries }: { entries: ProfileHistoryEntry[] }) {
  if (entries.length === 0) {
    return <div className="rounded-[10px] border bg-white p-4 text-xs italic text-gray-400">Aucune modification de profil traitée pour ce compte.</div>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {entries.map((entry, index) => {
        const before = flatten(entry.before);
        const target = entry.decision === 'valide' ? flatten(entry.after) : flatten(entry.requestedChanges);
        const fields = entry.decision === 'valide'
          ? Object.keys(target).filter((field) => target[field] !== (before[field] ?? ''))
          : Object.keys(target);
        return (
          <li key={`${entry.decidedAt}-${index}`} className="rounded-[12px] border border-[#eceadf] bg-[#fbfaf7] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white ${entry.decision === 'valide' ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`}>
                {entry.decision === 'valide' ? 'Modifications validées' : 'Modifications refusées'}
              </span>
              <span className="text-[11px] text-[#5a5e66]">
                Demande du {formatDateTime(entry.requestedAt)} · décision du {formatDateTime(entry.decidedAt)}
              </span>
            </div>

            <ul className="mt-3 divide-y divide-[#f1efe8] overflow-hidden rounded-[9px] border border-[#eceadf] bg-white">
              {fields.map((field) => (
                <li key={field} className="grid gap-1 px-3.5 py-2.5 text-[13px] sm:grid-cols-[170px_1fr_1fr] sm:gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#5a5e66]">{LABELS[field] || field}</div>
                  <div><span className="mr-1.5 text-[10px] font-bold uppercase text-[#9a3b2f]">Avant</span>{showValue(field, before[field] ?? '')}</div>
                  <div><span className={`mr-1.5 text-[10px] font-bold uppercase ${entry.decision === 'valide' ? 'text-[#2f6f4f]' : 'text-[#8a8270]'}`}>{entry.decision === 'valide' ? 'Après' : 'Demandé'}</span>{showValue(field, target[field])}</div>
                </li>
              ))}
            </ul>

            {entry.decision === 'refuse' && (entry.reasons?.length || entry.comment) && (
              <p className="mt-3 rounded-[8px] bg-[#fdece4] p-2.5 text-[12px] text-[#9a3b2f]">
                {entry.reasons?.length ? <>Motifs : {entry.reasons.join(', ')}. </> : null}
                {entry.comment ? <em>« {entry.comment} »</em> : null}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2">
              <SnapshotView title="Copie du profil avant" snapshot={entry.before} />
              {entry.decision === 'valide' && <SnapshotView title="Copie du profil après validation" snapshot={entry.after} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
