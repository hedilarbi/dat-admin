'use client';

import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function AdminSessionsPage() {
  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-10 font-sans text-black bg-[#fbfaf7]">
      <PageHeader eyebrow="Gestion & Supervision des Enchères" title="Sessions de Ventes" />
      <EmptyState
        title="Supervision des sessions d'enchères B2B en temps réel"
        description="Cette interface permet de planifier, surveiller, suspendre ou clôturer les sessions quotidiennes et hebdomadaires d'appels d'offres pour les acheteurs professionnels."
      />
    </div>
  );
}
