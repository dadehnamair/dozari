import { formatJalaliYear, rialsToTomanString } from '@dozari/shared';

/** Fills `{year}` in the question template with a Persian-digit year. */
export const questionText = (template: string, year: number): string => template.replace('{year}', formatJalaliYear(year));

/** Real price for display, from the wire's decimal rials string. */
export const priceText = (rials: string): string => rialsToTomanString(BigInt(rials));

export const totalPoints = (results: readonly { points: number }[]): number => results.reduce((sum, r) => sum + r.points, 0);
