const CATEGORY_LABELS: Record<string, string> = {
  general: 'Question générale',
  inscription: 'Inscription',
  document: 'Justificatif / Document',
  vehicule: 'Véhicule',
  offre: 'Offre',
  commission: 'Commission',
  paiement: 'Problème de paiement',
  technique: 'Problème technique / Bug',
  'enlèvement': "Problème d'enlèvement",
  litige: 'Litige',
  autre: 'Autre',
};

export const getCategoryLabel = (category: string) => CATEGORY_LABELS[category] || category;
