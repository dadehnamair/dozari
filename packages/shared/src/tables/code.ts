/** No 0/O/1/I/L so a code read aloud or from a screenshot is not mixed up. */
export const TABLE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TABLE_CODE_LENGTH = 5;
/** A table that did not start within this many minutes is closed (admin setting `table.idle_minutes`). */
export const TABLE_IDLE_MINUTES = 15;
export const TABLE_NAME_MAX = 30;
/** Table badges come from the item icon pack (never free emoji): keys of `ITEMS`. */
export const TABLE_ICONS = ['samovar', 'teaGlass', 'dice', 'crown', 'trophy', 'pomegranate', 'watermelon', 'lantern', 'kite', 'marbles', 'cassette', 'radio', 'rug', 'balloons', 'fireworks', 'star'] as const;
export type TableIcon = (typeof TABLE_ICONS)[number];
export const DEFAULT_TABLE_ICON: TableIcon = 'samovar';
/** Seats of a 1v1 table. */
export const TABLE_SEATS = 2;
/** Seats of a 2v2 table (two per side). */
export const TABLE_SEATS_TEAM = 4;
export const TABLE_FORMATS = ['1v1', '2v2'] as const;
export type TableFormat = (typeof TABLE_FORMATS)[number];
export const seatsOfFormat = (f: TableFormat): number => (f === '2v2' ? TABLE_SEATS_TEAM : TABLE_SEATS);

export function makeTableCode(rng: () => number): string {
  let out = '';
  for (let i = 0; i < TABLE_CODE_LENGTH; i++) out += TABLE_CODE_ALPHABET[Math.floor(rng() * TABLE_CODE_ALPHABET.length)];
  return out;
}

/** Upper-cases and strips spaces/dashes; null when the result cannot be a code. */
export function normalizeTableCode(raw: string): string | null {
  const c = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  return c.length === TABLE_CODE_LENGTH && [...c].every((ch) => TABLE_CODE_ALPHABET.includes(ch)) ? c : null;
}
