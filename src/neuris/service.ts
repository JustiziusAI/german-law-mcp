import { AppError } from "../errors";
import type { Env } from "../types";
import { NeurisClient } from "./client";
import { cleanHtml, flattenParts, isCurrent, lawSummary, normalizeText, parseCoverage, stripMark, today } from "./normalize";
import type { NeurisLaw, NeurisPart } from "./types";

const MAX_LIMIT = 20;
const normalizeLawReference = (law: string) => normalizeText(law).replace(/^(der|die|das) /, "");

function rankLaw(query: string, law: NeurisLaw): number {
  const q = normalizeLawReference(query);
  const fields = [law.abbreviation, law.name, law.alternateName].filter(Boolean).map((value) => normalizeText(value!));
  if (fields.some((value) => value === q)) return 0;
  if (fields.some((value) => value.startsWith(q))) return 1;
  if (fields.some((value) => value.includes(q))) return 2;
  return 3;
}

function labelMatches(reference: string, part: { name: string }): boolean {
  const input = reference.replace(/^§\s*/, "").replace(/^Art\.?(ikel)?\s*/i, "").trim().toLocaleLowerCase("de-DE");
  const label = part.name.replace(/^§\s*/, "").replace(/^Art\.?(ikel)?\s*/i, "").trim().toLocaleLowerCase("de-DE");
  return label === input || label === `§ ${input}` || label === `art. ${input}` || label === `artikel ${input}`;
}

export class LegislationService {
  readonly client: NeurisClient;

  constructor(env: Env) {
    this.client = new NeurisClient(env);
  }

  private async searchRaw(query: string, asOf: string, size = 50) {
    return this.client.listLegislation({ searchTerm: query, mostRelevantOn: asOf, size });
  }

  async findLaws(query: string, asOf = today(), limit = 10) {
    const collection = await this.searchRaw(query, asOf, 100);
    return {
      query,
      as_of: asOf,
      total: collection.totalItems,
      results: collection.member
        .map((member) => member.item)
        .sort((a, b) => rankLaw(query, a) - rankLaw(query, b))
        .slice(0, Math.min(limit, MAX_LIMIT))
        .map((law) => lawSummary(law, asOf)),
      source: "NeuRIS preview API",
    };
  }

  async resolveLaw(reference: string, asOf: string): Promise<NeurisLaw> {
    const collection = await this.searchRaw(reference, asOf, 100);
    const ranked = collection.member.map((member) => member.item).sort((a, b) => rankLaw(reference, a) - rankLaw(reference, b));
    const top = ranked[0];
    if (!top || rankLaw(reference, top) > 1) {
      throw new AppError(`No sufficiently precise law match for “${reference}” was found in NeuRIS.`, 404, "law_not_found");
    }
    return this.client.getLaw(top["@id"]);
  }

  async getLaw(reference: string, asOf = today()) {
    const law = await this.resolveLaw(reference, asOf);
    return { as_of: asOf, ...lawSummary(law, asOf) };
  }

  async listNorms(reference: string, asOf = today()) {
    const law = await this.resolveLaw(reference, asOf);
    const norms = flattenParts(law.hasPart).filter((part) => part.isNorm).map((part) => {
      const validity = parseCoverage(part.temporalCoverage);
      return {
        norm: part.name,
        title: part.headline,
        current: isCurrent(part.temporalCoverage, asOf),
        valid_from: validity.valid_from,
        valid_to: validity.valid_to,
      };
    });
    return { as_of: asOf, law: lawSummary(law, asOf), norms };
  }

  async listLawStructure(reference: string, asOf = today()) {
    const law = await this.resolveLaw(reference, asOf);
    return {
      as_of: asOf,
      law: lawSummary(law, asOf),
      parts: flattenParts(law.hasPart).map((part) => {
        const validity = parseCoverage(part.temporalCoverage);
        return {
          path: part.path,
          label: part.name,
          title: part.headline,
          type: part.isNorm ? "norm" : "structure",
          current: isCurrent(part.temporalCoverage, asOf),
          valid_from: validity.valid_from,
          valid_to: validity.valid_to,
        };
      }),
    };
  }

  async getNorm(lawReference: string, normReference: string, asOf = today()) {
    const law = await this.resolveLaw(lawReference, asOf);
    const parts = flattenParts(law.hasPart);
    const norm = parts.find((part) => part.isNorm && labelMatches(normReference, part));
    if (!norm?.eId) throw new AppError(`No norm “${normReference}” exists in ${law.abbreviation ?? law.name}.`, 404, "norm_not_found");

    const encoding = law.encoding?.find((item) => item.encodingFormat === "text/html");
    if (!encoding) throw new AppError("NeuRIS provides no HTML text for this law version.", 502, "upstream_shape_changed");
    const articlePath = encoding.contentUrl.replace(/\.html$/, "") + `/${norm.eId}.html`;
    const text = cleanHtml(await this.client.getHtml(articlePath));
    const validity = parseCoverage(norm.temporalCoverage);

    return {
      as_of: asOf,
      law: lawSummary(law, asOf),
      norm: norm.name,
      title: norm.headline,
      text,
      current: isCurrent(norm.temporalCoverage, asOf),
      valid_from: validity.valid_from,
      valid_to: validity.valid_to,
      source_url: `${this.client.baseUrl}${articlePath}`,
    };
  }

  async searchText(query: string, lawReference?: string, asOf = today(), limit = 10) {
    const collection = await this.searchRaw(query, asOf, 100);
    let onlyLawId: string | undefined;
    let resolvedLaw: NeurisLaw | undefined;
    if (lawReference) {
      resolvedLaw = await this.resolveLaw(lawReference, asOf);
      onlyLawId = resolvedLaw["@id"];
    }
    const results = collection.member
      .filter((member) => !onlyLawId || member.item["@id"] === onlyLawId)
      .flatMap((member) => (member.textMatches ?? []).map((match) => ({ member, match })))
      .filter(({ match }) => match.location || match.name !== "name")
      .slice(0, Math.min(limit, MAX_LIMIT))
      .map(({ member, match }) => ({
        law: lawSummary(member.item, asOf),
        norm: match.name ?? null,
        snippet: match.text ? stripMark(match.text) : null,
        source_url: `${this.client.baseUrl}${member.item["@id"]}`,
      }));
    return {
      query,
      as_of: asOf,
      law: resolvedLaw ? lawSummary(resolvedLaw, asOf) : null,
      total: results.length,
      results,
      warning: lawReference && results.length === 0 ? "No matching text snippet was returned by NeuRIS for the selected law." : null,
    };
  }

  async getLawVersions(reference: string, limit = 20) {
    const currentLaw = await this.resolveLaw(reference, today());
    const workEli = currentLaw.exampleOfWork?.legislationIdentifier;
    if (!workEli) throw new AppError("NeuRIS did not provide a work identifier for this law.", 502, "upstream_shape_changed");
    const collection = await this.client.listLegislation({ eli: workEli, size: Math.min(limit, MAX_LIMIT) });
    const versions = collection.member.map((member) => {
      const law = member.item;
      const validity = parseCoverage(law.temporalCoverage);
      return {
        title: law.name,
        abbreviation: law.abbreviation ?? null,
        legal_force: law.legislationLegalForce ?? null,
        current: law.legislationLegalForce === "InForce",
        valid_from: validity.valid_from,
        valid_to: validity.valid_to,
        legislation_date: law.exampleOfWork?.legislationDate ?? null,
        date_published: law.exampleOfWork?.datePublished ?? null,
        source_url: `${this.client.baseUrl}${law["@id"]}`,
      };
    });
    return { law: lawSummary(currentLaw, today()), total: collection.totalItems, versions };
  }
}
