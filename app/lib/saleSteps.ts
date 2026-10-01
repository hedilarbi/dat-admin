// Procédure d'achat (PURCHASE_STEPS côté serveur). Les étapes 3 à 5 forment l'étape
// « Documents administratifs », présentée en 3.1, 3.2 et 3.3.
const DISPLAYED_NUMBERS = ['1', '2', '3.1', '3.2', '3.3'];

/** Numéro affiché d'une étape (1, 2, 3.1, 3.2, 3.3). */
export const stepDisplayNumber = (step: number) => DISPLAYED_NUMBERS[step - 1] ?? String(step);

/** Nombre d'étapes annoncé (« Étape 3.2 sur 3 »). */
export const DISPLAYED_STEP_COUNT = 3;
