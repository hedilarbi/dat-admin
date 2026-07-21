'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import Alert from '../Alert';
import Spinner from '../Spinner';
import type { BlurZone, PdfPage } from '../../lib/vehicleDossier';

const MIN_ZONE_FRACTION = 0.01; // ~1% de la dimension de l'image : filtre les clics accidentels

interface BlurZoneEditorProps {
  imageUrl: string;
  /** 'application/pdf' bascule l'éditeur en mode multi-page (rendu + zones par page). */
  mimeType?: string;
  zones: BlurZone[];
  onZonesChange: (zones: BlurZone[]) => void;
  onValidate: () => Promise<void>;
  validating: boolean;
  onClose: () => void;
}

export default function BlurZoneEditor({ imageUrl, mimeType, zones, onZonesChange, onValidate, validating, onClose }: BlurZoneEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ startX: number; startY: number; zone: BlurZone } | null>(null);

  const isPdf = mimeType === 'application/pdf';
  const [pdfPages, setPdfPages] = useState<PdfPage[] | null>(null);
  const [loadingPages, setLoadingPages] = useState(isPdf);
  const [pagesError, setPagesError] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    setLoadingPages(true);
    setPagesError('');
    apiRequest('/vehicle-dossiers/media/pdf-pages', { method: 'POST', body: JSON.stringify({ pdfUrl: imageUrl }) })
      .then((res) => { if (!cancelled) setPdfPages(res.pages); })
      .catch((err: any) => { if (!cancelled) setPagesError(err.message || 'Impossible de charger les pages de ce document.'); })
      .finally(() => { if (!cancelled) setLoadingPages(false); });
    return () => { cancelled = true; };
  }, [isPdf, imageUrl]);

  const displaySrc = isPdf ? pdfPages?.[currentPageIndex]?.dataUrl : imageUrl;

  // Zones de la page courante, avec leur index dans le tableau complet (pour suppression/édition
  // correctes) — en mode image, toutes les zones appartiennent à la "page" implicite 0.
  const pageZoneEntries = zones
    .map((zone, index) => ({ zone, index }))
    .filter(({ zone }) => (zone.page ?? 0) === currentPageIndex);

  const pointToRatio = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (isPdf && !displaySrc) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = pointToRatio(e.clientX, e.clientY);
    setDraft({ startX: x, startY: y, zone: { x, y, width: 0, height: 0, ...(isPdf ? { page: currentPageIndex } : {}) } });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    const { x: curX, y: curY } = pointToRatio(e.clientX, e.clientY);
    const zone: BlurZone = {
      ...draft.zone,
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

  const displayedZoneEntries = draft
    ? [...pageZoneEntries, { zone: draft.zone, index: -1 }]
    : pageZoneEntries;

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
          {isPdf && pdfPages && pdfPages.length > 1 && (
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => setCurrentPageIndex((p) => Math.max(0, p - 1))}
                disabled={currentPageIndex === 0}
                className="h-9 px-3 border border-[#dcd7cb] rounded-[7px] text-[#13243c] font-semibold text-[13px] hover:bg-gray-50 disabled:opacity-40 transition"
              >
                ← Page précédente
              </button>
              <span className="text-[13px] font-semibold text-[#13243c]">
                Page {currentPageIndex + 1} / {pdfPages.length}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPageIndex((p) => Math.min(pdfPages.length - 1, p + 1))}
                disabled={currentPageIndex === pdfPages.length - 1}
                className="h-9 px-3 border border-[#dcd7cb] rounded-[7px] text-[#13243c] font-semibold text-[13px] hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Page suivante →
              </button>
            </div>
          )}

          {pagesError && <Alert variant="error" className="mb-4">{pagesError}</Alert>}

          {isPdf && loadingPages ? (
            <div className="w-full aspect-4/3 bg-[#13243c] rounded-[9px] flex items-center justify-center">
              <Spinner className="w-6 h-6 text-white" />
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative select-none touch-none w-full bg-[#13243c] rounded-[9px] overflow-hidden cursor-crosshair"
              style={{ aspectRatio: '4 / 3' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => setDraft(null)}
            >
              {displaySrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displaySrc} alt="" draggable={false} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
              )}
              {displayedZoneEntries.map(({ zone, index }, i) => (
                <div
                  key={index >= 0 ? index : `draft-${i}`}
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
                  {index >= 0 && (
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
          )}

          {pageZoneEntries.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {pageZoneEntries.map(({}, i) => (
                <span key={i} className="text-[11px] font-semibold bg-[#f1efe8] text-[#5a5e66] px-3 py-1 rounded-full">
                  Zone {i + 1}
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
            disabled={validating || (isPdf && loadingPages)}
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
