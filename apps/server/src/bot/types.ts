/** A price the bot found. Never trusted: it only becomes a candidate that a human approves. */
export interface RawCandidate {
  productNameFa: string;
  unitFa?: string | null;
  categoryGuess?: string | null;
  /** Solar Hijri year (rule 3). */
  year: number;
  month?: number | null;
  /** Integer rials (rule 2). */
  priceRials: bigint;
  /** The line / row the numbers came from, shown to the reviewer. */
  excerpt: string;
}

export interface AdapterInput {
  /** Fetched body of the source URL. */
  body: string;
  options: Readonly<Record<string, string>>;
}

export type Adapter = (input: AdapterInput) => RawCandidate[];
