import React from 'react';
import type { DossierPhoto } from '../../lib/vehicleDossier';

interface PhotoTileProps {
  photo: DossierPhoto;
  index: number;
  total: number;
  onSetCover: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEditBlur: () => void;
}

export default function PhotoTile({ photo, index, total, onSetCover, onMoveUp, onMoveDown, onEditBlur }: PhotoTileProps) {
  const displayUrl = photo.processedUrl || photo.originalUrl;

  return (
    <div className="relative rounded-[10px] border border-[#eceadf] bg-white overflow-hidden">
      <div className="relative aspect-[4/3] bg-[#13243c]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={displayUrl} alt="" className="w-full h-full object-cover" />
        {photo.isCover && (
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide bg-[#2f6f4f] text-white px-2 py-1 rounded-full">
            Couverture
          </span>
        )}
        {photo.processedUrl && (
          <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide bg-[#d9704f] text-white px-2 py-1 rounded-full">
            Flou appliqué
          </span>
        )}
      </div>

      <div className="p-2 flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onEditBlur}
            className="flex-1 h-8 text-[11px] font-semibold border border-[#dcd7cb] rounded-[7px] hover:bg-gray-50 transition"
          >
            Flouter
          </button>
          <button
            type="button"
            onClick={onSetCover}
            disabled={photo.isCover}
            className="flex-1 h-8 text-[11px] font-semibold border border-[#dcd7cb] rounded-[7px] hover:bg-gray-50 transition disabled:opacity-50"
          >
            Couverture
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Monter"
            className="w-8 h-8 text-[13px] border border-[#dcd7cb] rounded-[7px] hover:bg-gray-50 transition disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Descendre"
            className="flex-1 h-8 text-[13px] border border-[#dcd7cb] rounded-[7px] hover:bg-gray-50 transition disabled:opacity-30"
          >
            ↓
          </button>
        </div>
      </div>
    </div>
  );
}
