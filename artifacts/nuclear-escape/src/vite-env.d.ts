/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin (`https://api.example.com`). Omit for same-origin `/api/*` (Vite dev proxy or combined hosting). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
