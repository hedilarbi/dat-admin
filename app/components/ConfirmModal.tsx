'use client';

import React from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Contenu optionnel inséré sous le message : options à cocher, précisions, etc. */
  children?: React.ReactNode;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={onCancel}>
      <div
        className="w-full max-w-[420px] bg-white rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.24)] p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-[#13243c] mb-2">{title}</h3>
        <p className={`text-sm text-[#5a5e66] ${children ? 'mb-2' : 'mb-6'}`}>{message}</p>
        {children && <div className="mb-6">{children}</div>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-white font-bold rounded-[8px] text-xs uppercase cursor-pointer transition ${danger ? 'bg-[#9a3b2f] hover:bg-red-800' : 'bg-[#2f6f4f] hover:bg-emerald-800'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
