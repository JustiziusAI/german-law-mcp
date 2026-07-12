export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  NEURIS_BASE_URL?: string;
  AUTH_SECRET?: string;
  INVITE_CODE?: string;
  REGISTRATION_OPEN?: string;
}

export type JsonRecord = Record<string, unknown>;
