// La plateforme d'hébergement du serveur (fonctions serverless) impose une limite de taille de
// requête (~4,5 Mo) bien en dessous de la limite de 30 Mo configurée côté multer, et impossible
// à relever depuis le code de l'app. On recompresse donc côté client avant l'envoi.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const MAX_DIMENSION = 1920;
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.15;
const MAX_ATTEMPTS = 6;

function canCompress(file: File): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/svg+xml';
}

export async function compressImageIfNeeded(file: File, maxBytes: number = MAX_UPLOAD_BYTES): Promise<File> {
  if (!canCompress(file) || file.size <= maxBytes) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Format non décodable par le navigateur (ex: HEIC sur certains navigateurs) : on laisse
    // passer le fichier tel quel, le garde-fou de taille prendra le relais si besoin.
    return file;
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = INITIAL_QUALITY;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob || blob.size <= maxBytes || quality <= MIN_QUALITY) break;
      quality -= QUALITY_STEP;
    }

    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
