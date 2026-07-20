'use client';

import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function AdminDashboardPage() {
  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 font-sans text-black bg-[#fbfaf7]">
      <PageHeader eyebrow="Vue d'ensemble" title="Tableau de bord" />
      <EmptyState
        title="Cette section est en cours de construction"
        description="Les statistiques et indicateurs clés de la plateforme (inscriptions, sessions, ventes) seront affichés ici prochainement."
      />
    </div>
  );
}
