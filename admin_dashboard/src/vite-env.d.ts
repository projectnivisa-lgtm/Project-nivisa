/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute API root for a build that cannot proxy /api. Unset — the normal
   * case — requests are relative and same-origin. See src/lib/api.ts.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
