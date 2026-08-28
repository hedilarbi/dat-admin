import React from 'react';

export interface BadgeStyle {
  label: string;
  color: string;
  bg: string;
}

/** Statut d'une inscription (acheteur/vendeur) en cours de validation. */
export function getInscriptionStatusBadge(status: string): BadgeStyle {
  switch (status) {
    case 'soumis':
    case 'en_attente_validation':
      return { label: 'En attente', color: '#ffffff', bg: '#2563eb' };
    case 'valide':
      return { label: 'Validé', color: '#ffffff', bg: '#16a34a' };
    case 'correction_demandee':
      return { label: 'Correction demandée', color: '#ffffff', bg: '#f97316' };
    case 'refuse':
      return { label: 'Refusée', color: '#ffffff', bg: '#dc2626' };
    case 'bloque':
    case 'suspendu':
      return { label: 'Suspendu / Bloqué', color: '#ffffff', bg: '#991b1b' };
    default:
      return { label: status, color: '#ffffff', bg: '#6b7280' };
  }
}

/** Statut d'un ticket de support. */
export function getTicketStatusBadge(status: string): BadgeStyle {
  switch (status) {
    case 'en_attente_admin':
    case 'ouverte':
      return { label: 'En attente admin', color: '#b3893f', bg: '#faf1e4' };
    case 'en_attente_utilisateur':
      return { label: 'En attente client', color: '#d9704f', bg: '#fdece4' };
    case 'en_cours':
      return { label: 'En cours', color: '#13243c', bg: '#eef1f5' };
    case 'cloturee':
      return { label: 'Clôturé', color: '#5a5e66', bg: '#f1efe8' };
    default:
      return { label: status, color: '#13243c', bg: '#eef1f5' };
  }
}

/** Statut d'un dossier véhicule. */
export function getVehicleDossierStatusBadge(status: string): BadgeStyle {
  switch (status) {
    case 'brouillon':
      return { label: 'Brouillon', color: '#8a8270', bg: '#f1efe8' };
    case 'soumis':
    case 'en_attente_validation':
      return { label: 'En attente', color: '#ffffff', bg: '#2563eb' };
    case 'correction_demandee':
      return { label: 'Correction demandée', color: '#ffffff', bg: '#f97316' };
    case 'refuse':
      return { label: 'Refusé', color: '#ffffff', bg: '#dc2626' };
    case 'valide':
      return { label: 'Validé', color: '#ffffff', bg: '#16a34a' };
    case 'annule_vendeur':
      return { label: 'Annulé', color: '#8a8270', bg: '#f1efe8' };
    default:
      return { label: status, color: '#13243c', bg: '#eef1f5' };
  }
}

interface BadgeProps {
  style: BadgeStyle;
  className?: string;
}

export function Badge({ style, className = '' }: BadgeProps) {
  const safeStyle = style || { label: '—', color: '#ffffff', bg: '#6b7280' };
  return (
    <span
      className={`font-semibold text-[11px] px-3 py-1 rounded-full inline-block ${className}`}
      style={{ background: safeStyle.bg, color: safeStyle.color }}
    >
      {safeStyle.label}
    </span>
  );
}
