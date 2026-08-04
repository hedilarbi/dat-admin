'use client';

import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import Alert from '../Alert';
import Spinner from '../Spinner';
import type { BlurZone, PdfPage } from '../../lib/vehicleDossier';

const MIN_ZONE_FRACTION = 0.01;

interface BlurZoneEditorProps {
  imageUrl: string;
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
      .catch((err) => { if (!cancelled) setPagesError(err.message || "Impossible de charger les pages du PDF."); })
      .finally(() => { if (!cancelled) setLoadingPages(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPdf, imageUrl]);

  const displaySrc = isPdf ? pdfPages?.[currentPageIndex]?.dataUrl : imageUrl;
  const currentPdfPage = isPdf ? pdfPages?.[currentPageIndex] : null;
  const displayRatio = currentPdfPage ? currentPdfPage.width / currentPdfPage.height : 4 / 3;

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
    <div className="fixed inset-0 z-[300] bg-black/75 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-[16px] w-full max-w-[860px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-[#efece3] bg-white z-10">
          <div>
            <h3 className="text-[18px] font-bold font-heading uppercase text-[#13243c]">
              Éditeur de zones de flou
            </h3>
            <p className="text-[12px] text-[#4c5058] mt-0.5">
              Tracé libre : cliquez et glissez sur l'image pour ajouter des rectangles d'anonymisation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4c5058] hover:text-[#13243c] text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#fbfaf7]">
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
              style={{ aspectRatio: displayRatio }}
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
                      aria-label="Supprimer la zone"
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

        {/* Always-Visible Fixed Footer */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-[#efece3] bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-10">
          <div className="text-[12px] text-[#4c5058] font-medium hidden sm:block">
            {pageZoneEntries.length > 0
              ? `${pageZoneEntries.length} zone(s) de flou configurée(s)`
              : 'Tracé libre : cliquez et glissez sur l\'image pour créer une zone floue.'}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 border border-[#dcd7cb] rounded-[9px] text-[#13243c] font-semibold text-[13px] hover:bg-gray-50 transition"
            >
              {pageZoneEntries.length > 0 ? 'Annuler' : 'Passer (sans flou)'}
            </button>

            <button
              type="button"
              onClick={onValidate}
              disabled={validating || (isPdf && loadingPages)}
              className="h-11 px-6 bg-[#13243c] hover:bg-slate-800 text-white font-bold text-[13px] rounded-[9px] uppercase tracking-[0.03em] transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {validating && <Spinner />}
              {validating ? 'Application...' : pageZoneEntries.length > 0 ? 'Valider le floutage' : 'Valider'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
