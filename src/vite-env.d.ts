/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISPATCH_API_URL?: string;
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
  readonly VITE_REFRESH_INTERVAL_S?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
