/** Configuration publique (variables VITE_*), sans aucun secret. */

const env = import.meta.env;

const trimSlash = (s: string) => s.replace(/\/+$/, '');

export const config = {
  /** URL de la passerelle serveur ; vide = mode démonstration. */
  apiBaseUrl: env.VITE_DISPATCH_API_URL ? trimSlash(String(env.VITE_DISPATCH_API_URL)) : '',
  // Fond clair et sobre (CARTO Positron) : les camions ressortent mieux que sur le rendu OSM standard.
  mapTileUrl: String(env.VITE_MAP_TILE_URL || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'),
  mapAttribution: String(
    env.VITE_MAP_ATTRIBUTION || '&copy; contributeurs OpenStreetMap &copy; CARTO',
  ),
  /** Intervalle d'actualisation automatique (s) ; 0 = désactivé, minimum 30 s. */
  refreshIntervalS: (() => {
    const n = Number(env.VITE_REFRESH_INTERVAL_S ?? 60);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.max(30, Math.round(n));
  })(),
};
