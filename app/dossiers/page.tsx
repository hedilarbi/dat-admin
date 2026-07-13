'use client';

import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function AdminDossiersPage() {
  return (
    <div className="flex-1 min-w-0 overflow-y-auto p-8 sm:p-10 font-sans text-black bg-[#fbfaf7]">
      <PageHeader eyebrow="Validation & Inspection des publications" title="Dossiers Véhicules (VHU / Occasions)" />
      <EmptyState
        title="Interface de supervision des dossiers véhicules"
        description="Les fiches véhicules soumises par les centres VHU et vendeurs (photos, OCR carte grise, descriptifs techniques) apparaîtront ici pour contrôle administrateur avant diffusion ou mise aux enchères."
      />
    </div>
  );
}
