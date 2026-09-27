import React from 'react';
import type { DossierPhoto } from '../../lib/vehicleDossier';

interface PhotoTileProps {
  photo: DossierPhoto;
  index: number;
  total: number;
  onEditBlur: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

export default function PhotoTile({ photo, index, total, onEditBlur, onMove, onRemove }: PhotoTileProps) {
  const displayUrl = photo.processedUrl || photo.originalUrl;

  return (
    <div className="relative rounded-[10px] border border-[#eceadf] bg-white overflow-hidden">
      <div className="relative aspect-[4/3] bg-[#13243c]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={displayUrl} alt="" className="w-full h-full object-cover" />
        {photo.processedUrl && (
          <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide bg-[#d9704f] text-white px-2 py-1 rounded-full">
            Flou appliqué
          </span>
        )}
      </div>

      <div className="p-2 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onEditBlur}
          className="w-full h-8 text-[11px] font-semibold border border-[#dcd7cb] rounded-[7px] hover:bg-gray-50 transition"
        >
          Flouter
        </button>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Déplacer vers la gauche" className="h-8 w-9 rounded-[7px] border border-[#dcd7cb] hover:bg-gray-50 disabled:opacity-30">←</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Déplacer vers la droite" className="h-8 w-9 rounded-[7px] border border-[#dcd7cb] hover:bg-gray-50 disabled:opacity-30">→</button>
          <button type="button" onClick={onRemove} className="h-8 flex-1 rounded-[7px] border border-red-200 text-[11px] font-semibold text-[#b3261e] hover:bg-red-50">Supprimer</button>
        </div>
      </div>
    </div>
  );
}
