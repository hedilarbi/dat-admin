import React from 'react';
import type { DossierPhoto } from '../../lib/vehicleDossier';

interface PhotoTileProps {
  photo: DossierPhoto;
  onEditBlur: () => void;
}

export default function PhotoTile({ photo, onEditBlur }: PhotoTileProps) {
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

      <div className="p-2">
        <button
          type="button"
          onClick={onEditBlur}
          className="w-full h-8 text-[11px] font-semibold border border-[#dcd7cb] rounded-[7px] hover:bg-gray-50 transition"
        >
          Flouter
        </button>
      </div>
    </div>
  );
}
