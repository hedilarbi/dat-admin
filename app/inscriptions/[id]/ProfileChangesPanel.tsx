'use client';

interface PanelUser {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  activityType?: string;
  phone?: string;
  siret?: string;
  kbisUrl?: string;
  cinRectoUrl?: string;
  cinVersoUrl?: string;
  vhuNumber?: string;
  stampUrl?: string;
  address?: { street?: string; postalCode?: string; city?: string; country?: string };
  bankInfo?: { bankName?: string; accountHolder?: string; iban?: string; bic?: string; ribUrl?: string };
  pendingProfile?: { changes?: Record<string, unknown>; submittedAt?: string };
}

const LABELS: Record<string, string> = {
  firstName: 'Prénom', lastName: 'Nom', companyName: 'Raison sociale', activityType: 'Type d’activité',
  phone: 'Téléphone', siret: 'SIRET', vhuNumber: 'N° agrément VHU',
  kbisUrl: 'K-bis', cinRectoUrl: 'Pièce d’identité (recto)', cinVersoUrl: 'Pièce d’identité (verso)', stampUrl: 'Tampon',
  'address.street': 'Adresse : rue', 'address.postalCode': 'Adresse : code postal', 'address.city': 'Adresse : ville', 'address.country': 'Adresse : pays',
  'bankInfo.bankName': 'Banque', 'bankInfo.accountHolder': 'Titulaire du compte', 'bankInfo.iban': 'IBAN', 'bankInfo.bic': 'BIC', 'bankInfo.ribUrl': 'RIB (document)',
};
const DOCUMENT_FIELDS = new Set(['kbisUrl', 'cinRectoUrl', 'cinVersoUrl', 'stampUrl', 'bankInfo.ribUrl']);

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());

interface ChangeRow { field: string; before: string; after: string }

/** Champs modifiés, avec leur valeur actuelle (en vigueur) et la valeur demandée. */
const buildRows = (user: PanelUser): ChangeRow[] => {
  const changes = (user.pendingProfile?.changes || {}) as Record<string, unknown>;
  const rows: ChangeRow[] = [];
  for (const [field, value] of Object.entries(changes)) {
    if (field === 'address' || field === 'bankInfo') {
      const current = (user[field] || {}) as Record<string, unknown>;
      for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
        if (text(next) !== text(current[key])) rows.push({ field: `${field}.${key}`, before: text(current[key]), after: text(next) });
      }
    } else {
      rows.push({ field, before: text((user as unknown as Record<string, unknown>)[field]), after: text(value) });
    }
  }
  return rows;
};

/**
 * Demande de modification d'un compte déjà validé. Le profil affiché sur la page reste celui en
 * vigueur : rien n'est intégré tant que l'admin n'a pas approuvé. Ce panneau montre, champ par
 * champ, ce qui change.
 */
export default function ProfileChangesPanel({ user }: { user: PanelUser }) {
  const rows = buildRows(user);
  const submittedAt = user.pendingProfile?.submittedAt;

  return (
    <section className="mb-7 rounded-[12px] border-2 border-[#e2a175] bg-[#fdf3ec] p-4 sm:p-5">
      <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#8a4b24]">Modifications demandées</div>
      <p className="mt-1 text-[12px] leading-5 text-[#8a4b24]">
        Le profil affiché sur cette page est celui en vigueur. Ces modifications ne s’appliqueront qu’une fois validées
        {submittedAt ? ` · demande du ${new Date(submittedAt).toLocaleString('fr-FR')}` : ''}.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-[#5a5e66]">Aucune différence avec le profil actuel.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#f0dcc9] overflow-hidden rounded-[9px] border border-[#f0dcc9] bg-white">
          {rows.map((row) => {
            const isDocument = DOCUMENT_FIELDS.has(row.field);
            const show = (value: string) => (!value ? <span className="text-[#a3987f]">—</span> : isDocument
              ? <a href={value} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#13243c] underline">Voir le document</a>
              : <span className="break-words font-semibold text-[#13243c]">{value}</span>);
            return (
              <li key={row.field} className="grid gap-1 px-3.5 py-3 text-[13px] sm:grid-cols-[170px_1fr_1fr] sm:items-start sm:gap-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#5a5e66]">{LABELS[row.field] || row.field}</div>
                <div><span className="mr-1.5 text-[10px] font-bold uppercase text-[#9a3b2f]">Actuel</span>{show(row.before)}</div>
                <div><span className="mr-1.5 text-[10px] font-bold uppercase text-[#2f6f4f]">Demandé</span>{show(row.after)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
