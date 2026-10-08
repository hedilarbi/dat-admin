import Link from 'next/link';
import type { ReactNode } from 'react';

export type VehiclesTab = 'dossiers' | 'vehicules';

const TABS: { key: VehiclesTab; href: string; label: string }[] = [
  { key: 'dossiers', href: '/dossiers', label: 'Dossiers véhicules' },
  { key: 'vehicules', href: '/vehicules', label: 'Véhicules' },
];

interface VehiclesHeaderProps {
  active: VehiclesTab;
  /** Boutons propres à l'onglet (colonnes, export…), alignés à droite du titre. */
  actions?: ReactNode;
}

/**
 * En-tête commun aux deux onglets de « Véhicules » :
 * - Dossiers véhicules : les dossiers pas encore validés (en attente, correction, refusés…) ;
 * - Véhicules : les véhicules dont le dossier est validé, avec leur situation commerciale.
 * Les ventes ont leur propre page (/ventes).
 */
export default function VehiclesHeader({ active, actions }: VehiclesHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <div className="font-semibold text-[11px] leading-none tracking-[0.2em] uppercase text-[#a3987f] mb-2.5 font-sans">
            Gestion des véhicules
          </div>
          <h1 className="m-0 font-bold text-[36px] leading-none uppercase text-[#13243c] font-['Saira_Condensed',sans-serif]">
            Véhicules
          </h1>
        </div>
        {actions && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">{actions}</div>}
      </div>

      <nav aria-label="Sections véhicules" className="flex gap-6 border-b border-[#eceadf]">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`-mb-px border-b-2 pb-3 text-[13px] font-bold uppercase tracking-[0.05em] transition ${isActive ? 'border-[#d9704f] text-[#13243c]' : 'border-transparent text-[#8a8270] hover:text-[#13243c]'}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
