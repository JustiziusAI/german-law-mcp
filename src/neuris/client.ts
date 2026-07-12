import { AppError } from "../errors";
import type { Env } from "../types";
import type { NeurisCollection, NeurisLaw } from "./types";

const DEFAULT_BASE_URL = "https://testphase.rechtsinformationen.bund.de";
const MAX_ATTEMPTS = 3;

export class NeurisClient {
  readonly baseUrl: string;

  constructor(private readonly env: Env) {
    this.baseUrl = (env.NEURIS_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  async getJson<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(12_000),
        });
        if (response.ok) return (await response.json()) as T;
        if (response.status === 404) throw new AppError("No official NeuRIS result was found.", 404, "not_found");
        if (![429, 500, 502, 503, 504].includes(response.status)) {
          throw new AppError(`NeuRIS returned HTTP ${response.status}.`, 502, "upstream_error");
        }
        lastError = new Error(`Upstream HTTP ${response.status}`);
      } catch (error) {
        if (error instanceof AppError) throw error;
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
    }
    throw new AppError("NeuRIS is temporarily unavailable. Please retry shortly.", 503, "upstream_unavailable", String(lastError));
  }

  listLegislation(query: Record<string, string | number | undefined>): Promise<NeurisCollection> {
    return this.getJson<NeurisCollection>("/v1/legislation", query);
  }

  getLaw(id: string): Promise<NeurisLaw> {
    const path = id.startsWith("/") ? id : `/v1/legislation/${id}`;
    return this.getJson<NeurisLaw>(path);
  }

  async getHtml(path: string): Promise<string> {
    const response = await fetch(new URL(path, this.baseUrl), {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new AppError(`NeuRIS returned HTTP ${response.status}.`, 502, "upstream_error");
    return response.text();
  }
}
