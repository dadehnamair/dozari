import { TABLE_MIN_ROUNDS_DEFAULT, TABLE_ROUNDS_MAX, TABLE_ROUNDS_MIN } from '@dozari/shared';

let minRounds: number = TABLE_MIN_ROUNDS_DEFAULT;

/** Reads the smallest number of rounds a table may have from the public settings (`table.min_rounds`); anything unusable keeps the default. */
export function setTableRules(settings: Record<string, unknown>): void {
  const v = settings['table.min_rounds'];
  minRounds = typeof v === 'number' && Number.isInteger(v) ? Math.min(TABLE_ROUNDS_MAX, Math.max(TABLE_ROUNDS_MIN, v)) : TABLE_MIN_ROUNDS_DEFAULT;
}

/** The fewest rounds the table form offers (the server enforces the same number). */
export const tableMinRounds = (): number => minRounds;
