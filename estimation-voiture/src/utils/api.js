// ============================================================
// [B4] URL centralisée — changer ici pour le déploiement
// [B3] Gestion d'erreur réseau
// [B8] Intercepteur 401 (token expiré)
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Wrapper autour de fetch() qui :
 * - Préfixe l'URL avec API_BASE
 * - Ajoute le token JWT si disponible
 * - Gère les erreurs réseau proprement
 * - Détecte les 401 et déclenche un logout automatique
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    // [B3] Erreur réseau (serveur éteint, pas de connexion, etc.)
    throw new Error(
      'Impossible de contacter le serveur. Vérifiez que l\'API est démarrée et votre connexion internet.'
    );
  }

  // [B8] Token expiré → déclencher un événement pour le logout
  if (res.status === 401 && token) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  return res;
}

export { API_BASE };
