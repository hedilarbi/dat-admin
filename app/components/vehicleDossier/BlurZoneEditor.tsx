'use client';

import React, { useRef, useState } from 'react';
import Spinner from '../Spinner';
import type { BlurZone } from '../../lib/vehicleDossier';

const MIN_ZONE_FRACTION = 0.01; // ~1% de la dimension de l'image : filtre les clics accidentels

interface BlurZoneEditorProps {
  imageUrl: string;
  zones: BlurZone[];
  onZonesChange: (zones: BlurZone[]) => void;
  onValidate: () => Promise<void>;
  validating: boolean;
  onClose: () => void;
}

export default function BlurZoneEditor({ imageUrl, zones, onZonesChange, onValidate, validating, onClose }: BlurZoneEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ startX: number; startY: number; zone: BlurZone } | null>(null);

  const pointToRatio = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = pointToRatio(e.clientX, e.clientY);
    setDraft({ startX: x, startY: y, zone: { x, y, width: 0, height: 0 } });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    const { x: curX, y: curY } = pointToRatio(e.clientX, e.clientY);
    const zone: BlurZone = {
      x: Math.min(draft.startX, curX),
      y: Math.min(draft.startY, curY),
      width: Math.abs(curX - draft.startX),
      height: Math.abs(curY - draft.startY),
    };
    setDraft({ ...draft, zone });
  };

  const handlePointerUp = () => {
    if (!draft) return;
    const { zone } = draft;
    setDraft(null);
    if (zone.width < MIN_ZONE_FRACTION || zone.height < MIN_ZONE_FRACTION) return;
    onZonesChange([...zones, zone]);
  };

  const removeZone = (index: number) => {
    onZonesChange(zones.filter((_, i) => i !== index));
  };

  const displayedZones = draft ? [...zones, draft.zone] : zones;

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      <div
        className="bg-white rounded-[12px] w-full max-w-[860px] max-h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#efece3]">
          <div>
            <h3 className="text-[18px] font-bold text-[#13243c] uppercase">Flouter des zones sensibles</h3>
            <p className="text-[12px] text-[#8a8270] mt-1">Cliquez et glissez sur l&apos;image pour dessiner une zone à flouter (plaque, enseigne, VIN...).</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8a8270] hover:text-[#13243c] text-2xl leading-none px-2">×</button>
        </div>

        <div className="p-4 sm:p-6">
          <div
            ref={containerRef}
            className="relative select-none touch-none w-full bg-[#13243c] rounded-[9px] overflow-hidden cursor-crosshair"
            style={{ aspectRatio: '4 / 3' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDraft(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            {displayedZones.map((zone, index) => (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: `${zone.x * 100}%`,
                  top: `${zone.y * 100}%`,
                  width: `${zone.width * 100}%`,
                  height: `${zone.height * 100}%`,
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px dashed #d9704f',
                }}
              >
                {index < zones.length && (
                  <button
                    type="button"
                    onClick={() => removeZone(index)}
                    className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-[#d9704f] text-white text-[13px] font-bold flex items-center justify-center shadow"
                    aria-label="Retirer cette zone"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {zones.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {zones.map((_, index) => (
                <span key={index} className="text-[11px] font-semibold bg-[#f1efe8] text-[#5a5e66] px-3 py-1 rounded-full">
                  Zone {index + 1}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-[#efece3] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-6 border border-[#dcd7cb] rounded-[9px] text-[#13243c] font-semibold hover:bg-gray-50 transition"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={onValidate}
            disabled={validating}
            className="h-11 px-6 bg-[#13243c] hover:bg-slate-800 text-white font-bold rounded-[9px] uppercase tracking-[0.03em] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {validating && <Spinner />}
            {validating ? 'Floutage en cours...' : 'Valider le flou'}
          </button>
        </div>
      </div>
    </div>
  );
}
