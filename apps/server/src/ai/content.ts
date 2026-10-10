import { z } from 'zod';
import { AI_BLOG_LENGTHS, AI_LIMITS, AGE_TRACKS, GROUP_COUNT, GROUP_SIZE, PRODUCT_CATEGORIES, THEMES, profileForLevel, representativeLevel } from '@dozari/shared';
import type { AiKind } from '@dozari/shared';

/**
 * What the AI studio asks of the model and how it checks the answer (docs/logic/ai-studio.md).
 * Pure: prompts in, drafts out. Every draft is validated here and again when saved, and nothing is ever published or approved by it.
 */

const hint = z.string().trim().max(AI_LIMITS.maxHintLength).optional();
const base = { provider: z.string().min(1).max(20), model: z.string().trim().max(80).optional(), hint };

export const generateSchemas = {
  products: z.object({
    ...base,
    kind: z.literal('products'),
    count: z.number().int().min(1).max(AI_LIMITS.maxCount.products),
    category: z.enum(PRODUCT_CATEGORIES).optional(),
    ageTrack: z.enum(AGE_TRACKS).default('adult'),
    fromYear: z.number().int().min(1300).max(1450).optional(),
    toYear: z.number().int().min(1300).max(1450).optional(),
  }),
  kid_lessons: z.object({ ...base, kind: z.literal('kid_lessons'), count: z.number().int().min(1).max(AI_LIMITS.maxCount.kid_lessons) }),
  puzzle_titles: z.object({ ...base, kind: z.literal('puzzle_titles'), puzzleId: z.string().min(1).max(36), style: z.enum(['witty', 'plain']).default('witty') }),
  puzzle_groups: z.object({
    ...base,
    kind: z.literal('puzzle_groups'),
    count: z.number().int().min(1).max(AI_LIMITS.maxCount.puzzle_groups),
    ageTrack: z.enum(AGE_TRACKS).default('adult'),
    style: z.enum(['witty', 'plain']).default('witty'),
    /** Puzzle tier (= player-level range) the puzzles are made for; null/omitted = a mixed, mid-level puzzle. */
    tierId: z.string().min(1).max(36).nullable().optional(),
  }),
  blog: z.object({
    ...base,
    kind: z.literal('blog'),
    topic: z.string().trim().min(3).max(AI_LIMITS.maxHintLength),
    count: z.number().int().min(1).max(AI_LIMITS.maxCount.blog),
    length: z.enum(['short', 'medium', 'long']).default('medium'),
    tone: z.enum(['friendly', 'nostalgic', 'informative']).default('friendly'),
    keywords: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  }),
};
export const generateRequestSchema = z.discriminatedUnion('kind', [generateSchemas.products, generateSchemas.kid_lessons, generateSchemas.puzzle_titles, generateSchemas.puzzle_groups, generateSchemas.blog]);
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const productDraft = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,98}$/),
  nameFa: z.string().trim().min(2).max(80),
  unitFa: z.string().trim().max(30).nullable().default(null),
  category: z.enum(PRODUCT_CATEGORIES),
  storyFa: z.string().trim().max(300).default(''),
  ageTrack: z.enum(AGE_TRACKS).default('adult'),
  /** Nominal prices in toman (integer), one per Solar Hijri year. Saved as `pending` points; an editor still approves them. */
  prices: z.array(z.object({ year: z.number().int().min(1300).max(1450), priceToman: z.number().int().min(1).max(100_000_000_000) })).max(8).default([]),
});
export const lessonDraft = z.object({
  productId: z.string().min(1).max(36),
  nameFa: z.string().max(80).optional(),
  wordFa: z.string().trim().min(1).max(60),
  storyFa: z.string().trim().max(300).default(''),
  syllablesFa: z.string().trim().max(80).nullable().default(null),
});
export const titleDraft = z.object({ level: z.number().int().min(0).max(3), titleFa: z.string().trim().min(2).max(100) });
/** A whole hand-style puzzle: 4 groups (levels 0–3 once each) × 4 distinct catalog products. Saved as a `draft` puzzle; an editor approves it. */
export const puzzleDraft = z.object({
  groups: z
    .array(z.object({
      level: z.number().int().min(0).max(GROUP_COUNT - 1),
      titleFa: z.string().trim().min(2).max(100),
      explanationFa: z.string().trim().min(2).max(300),
      items: z.array(z.object({ productId: z.string().min(1).max(36), nameFa: z.string().max(80).optional() })).length(GROUP_SIZE),
    }))
    .length(GROUP_COUNT)
    .refine((gs) => new Set(gs.map((g) => g.level)).size === GROUP_COUNT, 'levels')
    .refine((gs) => new Set(gs.flatMap((g) => g.items.map((i) => i.productId))).size === GROUP_COUNT * GROUP_SIZE, 'distinct'),
  ageTrack: z.enum(AGE_TRACKS).default('adult'),
});
export const blogDraft = z.object({
  titleFa: z.string().trim().min(2).max(160),
  summaryFa: z.string().trim().max(400).default(''),
  bodyMd: z.string().trim().min(20).max(100_000),
  metaTitle: z.string().trim().max(70).nullable().default(null),
  metaDescription: z.string().trim().max(200).nullable().default(null),
});

/** What `POST /admin/ai/save` takes: the (possibly hand-edited) drafts of one kind. */
export const saveSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('products'), drafts: z.array(productDraft).min(1).max(AI_LIMITS.maxCount.products) }),
  z.object({ kind: z.literal('kid_lessons'), drafts: z.array(lessonDraft).min(1).max(AI_LIMITS.maxCount.kid_lessons) }),
  z.object({ kind: z.literal('puzzle_titles'), puzzleId: z.string().min(1).max(36), drafts: z.array(titleDraft).min(1).max(4) }),
  z.object({ kind: z.literal('puzzle_groups'), drafts: z.array(puzzleDraft).min(1).max(AI_LIMITS.maxCount.puzzle_groups), tierId: z.string().min(1).max(36).nullable().optional() }),
  z.object({ kind: z.literal('blog'), drafts: z.array(blogDraft).min(1).max(AI_LIMITS.maxCount.blog) }),
]);
export type SaveRequest = z.infer<typeof saveSchema>;

/** A puzzle's groups as sets of name keys, for comparing with puzzles that already exist. */
const keySet = (names: string[]): Set<string> => new Set(names.map(nameKey));
const asKnown = (d: z.infer<typeof puzzleDraft>): { titles: string[]; groups: string[][] } => ({ titles: d.groups.map((g) => g.titleFa), groups: d.groups.map((g) => g.items.map((i) => i.nameFa ?? i.productId)) });

/** True when a draft puzzle repeats a known one: any group with the same four products, or 12+ of the 16 products in common. */
export function repeatsExisting(d: z.infer<typeof puzzleDraft>, known: { groups: string[][] }[]): boolean {
  const mine = asKnown(d).groups.map(keySet);
  const all = new Set(mine.flatMap((s) => [...s]));
  return known.some((k) => {
    const theirs = k.groups.map(keySet);
    const sameGroup = mine.some((m) => theirs.some((t) => t.size === m.size && [...m].every((x) => t.has(x))));
    const shared = new Set(theirs.flatMap((s) => [...s]).filter((x) => all.has(x))).size;
    return sameGroup || shared >= 12;
  });
}

/** Pulls the JSON object out of a model answer: plain, fenced in ```json, or wrapped in chatter. Null when there is none. */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '');
  for (const candidate of [stripped.trim(), stripped.slice(stripped.indexOf('{'), stripped.lastIndexOf('}') + 1)]) {
    for (const text of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
      try {
        return JSON.parse(text);
      } catch {
        /* try the next shape */
      }
    }
  }
  return null;
}

const COMMON = [
  'You write content for «دوزاری» (Dozari), a Persian puzzle game about Iranian price nostalgia.',
  'Write natural, correct Persian (فارسی) with Persian digits only inside prose; keep ZWNJ (نیم‌فاصله) where the language needs it.',
  'Never invent statistics, dates or quotes. If you are not sure of a fact, leave it out.',
  'No politics, religion, insults, tobacco/alcohol promotion or adult content.',
  'Reply with ONE JSON object only: no markdown fences, no commentary.',
].join('\n');

const LEVELS = 'level 0 = easiest (yellow), 1 = green, 2 = blue, 3 = hardest/trickiest (purple)';

export interface PromptPieces {
  system: string;
  user: string;
}

export interface PromptContext {
  /** Kid items still without a lesson (kid_lessons). */
  kidItems?: { productId: string; nameFa: string }[];
  /** The groups of the puzzle (puzzle_titles). */
  puzzleGroups?: { level: number; titleFa: string | null; items: string[] }[];
  /** Products already in the catalog (products): the model must not suggest them again. */
  existing?: { slug: string; nameFa: string }[];
  /** Puzzles already in the catalog (puzzle_groups): their group titles and the product names of each group, so the model does not repeat them. */
  existingPuzzles?: { titles: string[]; groups: string[][] }[];
  /** Catalog products the model may use in whole puzzles (puzzle_groups); the model refers to them by position. */
  pool?: { productId: string; nameFa: string; category?: string }[];
  /** The tier the puzzles are for (puzzle_groups): its name and player-level range. */
  tier?: { nameFa: string; minLevel: number; maxLevel: number | null };
}

/** What each skill stage should feel like, in words the model can follow (the stages are those of `profileForLevel`). */
const STAGE_GUIDE = [
  'BEGINNERS: the best-known everyday things; links anyone can see at once; at most one gentle red herring; the hardest group is still guessable by a newcomer.',
  'EASY: popular items and clear links; one or two friendly red herrings; the last group needs a little thought.',
  'INTERMEDIATE: a mix of well-known and less-known items; clear but not obvious links; two red herrings; the last group needs real nostalgia knowledge.',
  'HARD: less obvious items and links that need memory or lateral thinking; three red herrings where an item fits two groups at first glance.',
  'EXPERT: old or niche items, subtle links, several convincing red herrings; the last group is a real brain-teaser, but still fair and checkable.',
] as const;

/** Prompt lines for a tier: its name, level range and the matching difficulty guide. */
export function tierGuide(tier: NonNullable<PromptContext['tier']>): string {
  const stage = profileForLevel(representativeLevel(tier.minLevel, tier.maxLevel)).stage;
  const range = tier.maxLevel === null ? `level ${tier.minLevel} and up` : `levels ${tier.minLevel}–${tier.maxLevel}`;
  return `\nTarget players: tier «${tier.nameFa}» (${range}). Difficulty for them: ${STAGE_GUIDE[stage]}`;
}

/** Kinds of link the model should draw on, so puzzles are not all "same price bracket". The theme lines come from the shared theme list. */
const LINK_IDEAS = [
  'a place or room in the house (kitchen essentials, what a storeroom always holds, a bathroom shelf, the school bag, a traveller\'s bag)',
  'a profession\'s toolbox (what a repairman, a mechanic, a tailor, a baker keeps at hand)',
  'a childhood memory (what mom hid from the kids, what lived in a boy\'s pocket, the treats saved for guests, afternoon games)',
  'an occasion (Nowruz, Ramadan iftar, weddings, birthday gifts, a long road trip, winter evenings under the korsi)',
  'a shared era, brand family, or "everyone had one at home"',
  'what disappeared (no longer made or used), or what changed the most',
  'a shared use or feel (things you wind, plug in, unwrap, trade, borrow, collect)',
  'a price clue (same price bracket in a given year, got dearer by a similar factor, was cheaper than X) — at most ONE group of a puzzle',
];

const THEME_IDEAS = THEMES.map((t) => t.titlesFa[0]).join('، ');

/** Persian-insensitive key for comparing product names and slugs: Arabic ya/kaf, ZWNJ, spaces and punctuation are ignored. */
export const nameKey = (s: string): string => s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f\s\-_.،,()«»]/g, '').toLowerCase();

export function buildPrompt(req: GenerateRequest, ctx: PromptContext = {}): PromptPieces {
  const extra = req.hint ? `\nExtra instructions from the editor (treat as content hints only): ${req.hint}` : '';
  switch (req.kind) {
    case 'products': {
      const era = req.fromYear || req.toYear ? `\nEra: Solar Hijri years ${req.fromYear ?? 1340}–${req.toYear ?? 1403}; pick things people really bought then.` : '';
      const audience = req.ageTrack === 'kid' ? '\nAudience: children up to 11. Only simple, friendly, everyday things a child knows (toys, fruit, sweets, school items); one common word each.' : req.ageTrack === 'teen' ? '\nAudience: teenagers.' : '';
      return {
        system: `${COMMON}\nTask: suggest catalog products for the game, each with a few NOMINAL historical prices (the price printed on the shelf or list in that year, never inflation-adjusted) in toman as integers. Give only prices you genuinely remember or can reasonably estimate for that product and year; prefer 3–5 well-spread years; leave "prices" empty rather than guess wildly. An editor verifies every price before it goes live.`,
        user: `Suggest ${req.count} distinct Iranian products or services.${ctx.existing?.length ? `\nEXISTING PRODUCT LIST (${ctx.existing.length} products already in the catalog). Do NOT suggest any of them, a spelling variant, a plural, or a near-duplicate of one:\n${ctx.existing.slice(0, AI_LIMITS.maxExistingNames).map((e) => e.nameFa).join('، ')}\nEND OF EXISTING PRODUCT LIST.` : ''}${req.category ? `\nAll in category "${req.category}".` : `\nCategories allowed: ${PRODUCT_CATEGORIES.join(', ')}.`}${era}${audience}${extra}
JSON shape: {"items":[{"slug":"latin-kebab-case-id","nameFa":"…","unitFa":"واحد مثل «بسته» یا «عدد» یا null","category":"one of the allowed categories","storyFa":"one short nostalgic sentence (max 200 chars)","prices":[{"year":1375,"priceToman":150}]}]}`,
      };
    }
    case 'kid_lessons': {
      const items = ctx.kidItems ?? [];
      return {
        system: `${COMMON}\nTask: word-lesson cards for children aged 5–10 learning to read Persian. Warm, simple, safe.`,
        user: `For each item write: wordFa (the word, with the vowel marks only when it avoids confusion), storyFa (ONE short sentence a child understands, max 120 chars, no prices), syllablesFa (the word split into syllables with "-" such as «سی-ب», or null for one-syllable words).${extra}
Items (use the productId exactly):
${items.map((i) => `- ${i.productId}: ${i.nameFa}`).join('\n')}
JSON shape: {"items":[{"productId":"…","wordFa":"…","storyFa":"…","syllablesFa":"…"}]}`,
      };
    }
    case 'puzzle_titles': {
      const groups = ctx.puzzleGroups ?? [];
      return {
        system: `${COMMON}\nTask: titles for the four hidden groups of a Connections-style puzzle. A title names what the four items share without being a spoiler of the other groups.`,
        user: `Style: ${req.style === 'witty' ? 'witty, playful, a little cheeky, 2–6 words' : 'plain and clear, 2–5 words'}. Levels: ${LEVELS}.${extra}
Groups:
${groups.map((g) => `- level ${g.level}: ${g.items.join('، ')}${g.titleFa ? ` (current title: ${g.titleFa})` : ''}`).join('\n')}
JSON shape: {"titles":[{"level":0,"titleFa":"…"}]} with one entry per level above.`,
      };
    }
    case 'puzzle_groups': {
      const pool = ctx.pool ?? [];
      return {
        system: `${COMMON}\nTask: build complete, CREATIVE Connections-style puzzles from the numbered product list. Each puzzle has exactly ${GROUP_COUNT} groups; a group is ${GROUP_SIZE} products that share ONE clear idea a player can check with everyday knowledge. Use ONLY the numbers given; never invent products.
VARIETY IS THE POINT. The four groups of a puzzle must be four DIFFERENT kinds of link, and the puzzles of one request must differ from each other. Draw on ideas like:
${LINK_IDEAS.map((l) => `- ${l}`).join('\n')}
Example connections (titles, to inspire — do not copy blindly): ${THEME_IDEAS}.
Do NOT make every group "their price was X toman in year Y"; never put a price range in a title; price-based links are only a seasoning (one group at most). A product may fit several ideas — that is what makes good red herrings, as long as the puzzle still has exactly one valid solution.`,
        user: `Make ${req.count} puzzle(s). Levels: ${LEVELS}; every puzzle uses levels 0,1,2,3 once each. Style of titles: ${req.style === 'witty' ? 'witty, playful, 2–6 words' : 'plain and clear, 2–5 words'}.${ctx.tier ? tierGuide(ctx.tier) : ''} Order the levels by difficulty for those players (0 easiest link, 3 hardest). For each group also write explanationFa: one plain sentence that states the real rule. A product number may appear only ONCE per puzzle (16 different numbers per puzzle); try to add 1–2 red herrings (a product that looks like it fits another group).${extra}
${ctx.existingPuzzles?.length ? `\nEXISTING PUZZLES (${ctx.existingPuzzles.length}); do NOT repeat any of these groups, their themes or their titles:\n${ctx.existingPuzzles.map((p) => p.titles.join(' | ')).join('\n')}\nEND OF EXISTING PUZZLES.\n` : ''}
Products (number: name):
${pool.map((p, i) => `${i + 1}: ${p.nameFa}${p.category ? ` (${p.category})` : ''}`).join('\n')}
JSON shape: {"puzzles":[{"groups":[{"level":0,"titleFa":"…","explanationFa":"…","items":[12,5,88,3]}]}]}`,
      };
    }
    case 'blog':
      return {
        system: `${COMMON}\nTask: blog articles for the game's landing site. Markdown body: ## headings, short paragraphs, lists where useful, no raw HTML, no H1 (the title is separate). No claims that need a source.`,
        user: `Write ${req.count} different article(s) about: ${req.topic}.
Tone: ${req.tone}. Length: about ${AI_BLOG_LENGTHS[req.length]} Persian words each.${req.keywords.length ? ` Weave in these keywords naturally: ${req.keywords.join('، ')}.` : ''}${extra}
End each with a one-line invitation to play Dozari.
JSON shape: {"posts":[{"titleFa":"…","summaryFa":"1–2 sentences","bodyMd":"markdown","metaTitle":"≤60 chars","metaDescription":"≤150 chars"}]}`,
      };
  }
}

/** Validates the model's answer into drafts; items that fail are counted, not thrown. Null when the answer is not usable at all. */
export function parseDrafts(kind: AiKind, text: string, ctx: PromptContext = {}, ageTrack: 'kid' | 'teen' | 'adult' = 'adult'): { drafts: unknown[]; dropped: number } | null {
  const json = extractJson(text) as Record<string, unknown> | null;
  if (!json || typeof json !== 'object') return null;
  const take = <T>(rows: unknown, schema: z.ZodType<T>, accept: (d: T) => boolean = () => true): { drafts: T[]; dropped: number } => {
    const list = Array.isArray(rows) ? rows : [];
    const drafts: T[] = [];
    for (const r of list) {
      const ok = schema.safeParse(r);
      if (ok.success && accept(ok.data)) drafts.push(ok.data);
    }
    return { drafts, dropped: list.length - drafts.length };
  };
  let out: { drafts: unknown[]; dropped: number };
  switch (kind) {
    case 'products': {
      const seen = new Set<string>();
      for (const e of ctx.existing ?? []) [e.nameFa, e.slug].forEach((v) => seen.add(nameKey(v)));
      out = take(json.items, productDraft, (d) => {
        const keys = [nameKey(d.nameFa), nameKey(d.slug)];
        if (keys.some((k) => seen.has(k))) return false;
        keys.forEach((k) => seen.add(k));
        return true;
      });
      out.drafts = (out.drafts as z.infer<typeof productDraft>[]).map((d) => ({ ...d, ageTrack }));
      break;
    }
    case 'kid_lessons': {
      const names = new Map((ctx.kidItems ?? []).map((i) => [i.productId, i.nameFa]));
      out = take(json.items, lessonDraft, (d) => names.has(d.productId));
      out.drafts = (out.drafts as z.infer<typeof lessonDraft>[]).map((d) => ({ ...d, nameFa: names.get(d.productId) }));
      break;
    }
    case 'puzzle_titles': {
      const levels = new Set((ctx.puzzleGroups ?? []).map((g) => g.level));
      const seen = new Set<number>();
      out = take(json.titles, titleDraft, (d) => levels.has(d.level) && !seen.has(d.level) && !!seen.add(d.level));
      break;
    }
    case 'puzzle_groups': {
      const pool = ctx.pool ?? [];
      const rows = Array.isArray(json.puzzles) ? json.puzzles : [];
      const drafts: z.infer<typeof puzzleDraft>[] = [];
      for (const r of rows) {
        const groups = (Array.isArray((r as { groups?: unknown })?.groups) ? (r as { groups: unknown[] }).groups : []).map((g) => {
          const gg = g as { items?: unknown };
          const items = (Array.isArray(gg.items) ? gg.items : []).map((n) => pool[Number(n) - 1]).filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ productId: p.productId, nameFa: p.nameFa }));
          return { ...(g as object), items };
        });
        const ok = puzzleDraft.safeParse({ groups, ageTrack });
        if (ok.success && !repeatsExisting(ok.data, [...(ctx.existingPuzzles ?? []), ...drafts.map(asKnown)])) drafts.push(ok.data);
      }
      out = { drafts, dropped: rows.length - drafts.length };
      break;
    }
    case 'blog':
      out = take(json.posts, blogDraft);
      break;
  }
  return out.drafts.length === 0 ? null : out;
}
