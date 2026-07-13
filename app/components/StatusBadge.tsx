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
      return { label: 'En attente', color: '#b3893f', bg: '#faf1e4' };
    case 'valide':
      return { label: 'Validé', color: '#2f6f4f', bg: '#e9f4ee' };
    case 'correction_demandee':
      return { label: 'Correction demandée', color: '#d9704f', bg: '#fdece4' };
    case 'refuse':
      return { label: 'Refusée', color: '#9a3b2f', bg: '#fbeae7' };
    case 'bloque':
    case 'suspendu':
      return { label: 'Suspendu / Bloqué', color: '#9a3b2f', bg: '#fbeae7' };
    default:
      return { label: status, color: '#8a8270', bg: '#f1efe8' };
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

interface BadgeProps {
  style: BadgeStyle;
  className?: string;
}

export function Badge({ style, className = '' }: BadgeProps) {
  return (
    <span
      className={`font-semibold text-[11px] px-3 py-1 rounded-full inline-block ${className}`}
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}
