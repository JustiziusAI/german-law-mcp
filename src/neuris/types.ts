export interface NeurisEncoding {
  contentUrl: string;
  encodingFormat: string;
  inLanguage?: string;
}

export interface NeurisPart {
  eId?: string;
  name?: string;
  headline?: string;
  temporalCoverage?: string | null;
  hasPart?: NeurisPart[];
  encoding?: NeurisEncoding[];
}

export interface NeurisLaw {
  "@id": string;
  name: string;
  abbreviation?: string;
  alternateName?: string;
  legislationIdentifier: string;
  temporalCoverage?: string | null;
  legislationLegalForce?: "InForce" | "NotInForce" | "PartiallyInForce" | string;
  exampleOfWork?: {
    legislationIdentifier?: string;
    legislationDate?: string;
    datePublished?: string;
    isPartOf?: { name?: string };
  };
  hasPart?: NeurisPart[];
  encoding?: NeurisEncoding[];
}

export interface NeurisSearchResult {
  item: NeurisLaw;
  textMatches?: Array<{ name?: string; text?: string; location?: string | null }>;
}

export interface NeurisCollection {
  totalItems: number;
  member: NeurisSearchResult[];
  view?: { next?: string; previous?: string };
}
