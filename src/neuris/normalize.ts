import type { NeurisLaw, NeurisPart } from "./types";

export const today = () => new Date().toISOString().slice(0, 10);

export function normalizeText(value: string): string {
  return value.toLocaleLowerCase("de-DE").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}

export function parseCoverage(value?: string | null): { valid_from: string | null; valid_to: string | null } {
  if (!value) return { valid_from: null, valid_to: null };
  const [from = "", to = ""] = value.split("/");
  return {
    valid_from: from && from !== ".." && from !== "1001-01-01" ? from : null,
    valid_to: to && to !== ".." && to !== "9999-12-31" ? to : null,
  };
}

export function isCurrent(coverage: string | null | undefined, asOf: string): boolean | null {
  if (!coverage) return null;
  const { valid_from, valid_to } = parseCoverage(coverage);
  return (!valid_from || valid_from <= asOf) && (!valid_to || asOf <= valid_to);
}

export function sourceUrl(law: NeurisLaw): string {
  return `https://testphase.rechtsinformationen.bund.de${law["@id"]}`;
}

export function lawSummary(law: NeurisLaw, asOf: string) {
  const validity = parseCoverage(law.temporalCoverage);
  return {
    title: law.name,
    abbreviation: law.abbreviation ?? null,
    alternate_title: law.alternateName ?? null,
    legal_force: law.legislationLegalForce ?? null,
    current: law.legislationLegalForce === "InForce" && isCurrent(law.temporalCoverage, asOf) !== false,
    valid_from: validity.valid_from,
    valid_to: validity.valid_to,
    legislation_date: law.exampleOfWork?.legislationDate ?? null,
    date_published: law.exampleOfWork?.datePublished ?? null,
    publication: law.exampleOfWork?.isPartOf?.name ?? null,
    source_url: sourceUrl(law),
  };
}

export interface FlatPart {
  name: string;
  headline: string | null;
  eId: string | null;
  temporalCoverage: string | null;
  path: string[];
  isNorm: boolean;
}

export function flattenParts(parts: NeurisPart[] = [], parent: string[] = []): FlatPart[] {
  return parts.flatMap((part) => {
    const name = part.name ?? "Untitled part";
    const current = { name, headline: part.headline ?? null, eId: part.eId ?? null, temporalCoverage: part.temporalCoverage ?? null, path: parent, isNorm: /^(§|Art\.|Artikel|Anlage)/i.test(name) };
    return [current, ...flattenParts(part.hasPart ?? [], [...parent, name])];
  });
}

export function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/(p|section|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function stripMark(value: string): string {
  return cleanHtml(value.replace(/<\/?mark>/gi, ""));
}
