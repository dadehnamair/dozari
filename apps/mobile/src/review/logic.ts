/** When to ask for a store review (admin-tunable, `review.*` settings). Pure: the clock and the stored counters come in as arguments. */
export type Store = 'myket' | 'bazaar' | 'bale';

export interface ReviewRules {
  enabled: boolean;
  afterDays: number;
  afterGames: number;
  repeatDays: number;
  maxPrompts: number;
  stores: Record<Store, boolean>;
  packageId: string;
  urls: Record<Store, string>;
  message: string;
}

export interface ReviewState {
  /** Epoch ms of the first app open on this device. */
  firstOpenAt: number;
  gamesFinished: number;
  lastPromptAt: number | null;
  prompts: number;
  /** The player reviewed or said "never": stop for good. */
  done: boolean;
}

const DAY = 86_400_000;
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const on = (v: unknown, fallback: boolean) => (typeof v === 'number' ? v === 1 : fallback);

export function parseReviewRules(s: Record<string, unknown>): ReviewRules {
  return {
    enabled: on(s['review.enabled'], false),
    afterDays: num(s['review.after_days'], 3),
    afterGames: num(s['review.after_games'], 3),
    repeatDays: num(s['review.repeat_days'], 30),
    maxPrompts: num(s['review.max_prompts'], 3),
    stores: { myket: on(s['review.myket'], true), bazaar: on(s['review.bazaar'], true), bale: on(s['review.bale'], true) },
    packageId: str(s['review.package_id']),
    urls: { myket: str(s['review.url_myket']), bazaar: str(s['review.url_bazaar']), bale: str(s['review.url_bale']) },
    message: str(s['review.message']),
  };
}

/** The store page to open: the admin's link, else a link built from the package id (Myket, Bazaar); Bale has no guessable pattern. */
export function reviewUrl(rules: ReviewRules, store: Store): string | null {
  const own = rules.urls[store].trim();
  if (/^https?:\/\//i.test(own)) return own;
  if (!rules.packageId) return null;
  if (store === 'myket') return `https://myket.ir/app/${rules.packageId}`;
  if (store === 'bazaar') return `https://cafebazaar.ir/app/${rules.packageId}?l=fa`;
  return null;
}

/** True when the review dialog should appear now. `store` is the market this build was shipped through (null = none, never ask). */
export function shouldPromptReview(state: ReviewState, rules: ReviewRules, store: Store | null, now: number): boolean {
  if (!rules.enabled || !store || !rules.stores[store] || state.done) return false;
  if (!reviewUrl(rules, store)) return false;
  if (state.prompts >= rules.maxPrompts) return false;
  if (now - state.firstOpenAt < rules.afterDays * DAY) return false;
  if (state.gamesFinished < rules.afterGames) return false;
  if (state.lastPromptAt !== null && now - state.lastPromptAt < rules.repeatDays * DAY) return false;
  return true;
}

export const FRESH_STATE = (now: number): ReviewState => ({ firstOpenAt: now, gamesFinished: 0, lastPromptAt: null, prompts: 0, done: false });

/** Reads the stored state (a plain "a,b,c,d,e" text, no JSON), falling back to a fresh one for anything odd. */
export function decodeState(raw: string | null, now: number): ReviewState {
  const p = raw?.split(',') ?? [];
  if (p.length !== 5) return FRESH_STATE(now);
  const [first, games, last, prompts, done] = p.map(Number) as [number, number, number, number, number];
  if ([first, games, last, prompts, done].some((n) => !Number.isFinite(n) || n < 0)) return FRESH_STATE(now);
  return { firstOpenAt: first, gamesFinished: games, lastPromptAt: last === 0 ? null : last, prompts, done: done === 1 };
}

export const encodeState = (s: ReviewState): string => [s.firstOpenAt, s.gamesFinished, s.lastPromptAt ?? 0, s.prompts, s.done ? 1 : 0].join(',');
