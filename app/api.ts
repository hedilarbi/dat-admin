const API_BASE_URL = '/api';

/**
 * Custom fetch wrapper that handles credentials (cookies) for admin site
 */
export async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;
  
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Crucial for sending/receiving JWT cookies
  };

  const response = await fetch(url, fetchOptions);
  
  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = { message: 'Failed to parse JSON response' };
  }

  if (!response.ok) {
    // Une session invalide/expirée (401) ou une session valide mais pour un compte non-admin
    // (403 renvoyé par le middleware adminOnly — typique d'un cookie partagé avec le site client
    // en local) doit renvoyer vers la connexion immédiatement, quelle que soit la page qui a
    // déclenché l'appel — sans ça, seul un rechargement complet le détectait (UserProvider ne
    // revalide la session qu'une fois, au premier chargement).
    if (
      (response.status === 401 || response.status === 403) &&
      path !== '/auth/me' &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login' &&
      window.location.pathname !== '/'
    ) {
      window.location.href = '/login';
    }

    const error = new Error(data.message || 'Une erreur est survenue.');
    (error as any).code = data.error || 'api.error';
    (error as any).status = response.status;
    (error as any).details = data;
    throw error;
  }

  return data;
}
