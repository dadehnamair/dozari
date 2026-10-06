import { z } from 'zod';
import { AI_BLOG_LENGTHS, AI_LIMITS, AGE_TRACKS, PRODUCT_CATEGORIES } from '@dozari/shared';
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
export const generateRequestSchema = z.discriminatedUnion('kind', [generateSchemas.products, generateSchemas.kid_lessons, generateSchemas.puzzle_titles, generateSchemas.blog]);
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const productDraft = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,98}$/),
  nameFa: z.string().trim().min(2).max(80),
  unitFa: z.string().trim().max(30).nullable().default(null),
  category: z.enum(PRODUCT_CATEGORIES),
  storyFa: z.string().trim().max(300).default(''),
  ageTrack: z.enum(AGE_TRACKS).default('adult'),
});
export const lessonDraft = z.object({
  productId: z.string().min(1).max(36),
  nameFa: z.string().max(80).optional(),
  wordFa: z.string().trim().min(1).max(60),
  storyFa: z.string().trim().max(300).default(''),
  syllablesFa: z.string().trim().max(80).nullable().default(null),
});
export const titleDraft = z.object({ level: z.number().int().min(0).max(3), titleFa: z.string().trim().min(2).max(100) });
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
  z.object({ kind: z.literal('blog'), drafts: z.array(blogDraft).min(1).max(AI_LIMITS.maxCount.blog) }),
]);
export type SaveRequest = z.infer<typeof saveSchema>;

/** Pulls the JSON object out of a model answer: plain, fenced in ```json, or wrapped in chatter. Null when there is none. */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '');
  for (const candidate of [stripped.trim(), stripped.slice(stripped.indexOf('{'), stripped.lastIndexOf('}') + 1)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

const COMMON = [
  'You write content for «دوزاری» (Dozari), a Persian puzzle game about Iranian price nostalgia.',
  'Write natural, correct Persian (فارسی) with Persian digits only inside prose; keep ZWNJ (نیم‌فاصله) where the language needs it.',
  'Never invent prices, statistics, dates or quotes. If you are not sure of a fact, leave it out.',
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
}

export function buildPrompt(req: GenerateRequest, ctx: PromptContext = {}): PromptPieces {
  const extra = req.hint ? `\nExtra instructions from the editor (treat as content hints only): ${req.hint}` : '';
  switch (req.kind) {
    case 'products': {
      const era = req.fromYear || req.toYear ? `\nEra: Solar Hijri years ${req.fromYear ?? 1340}–${req.toYear ?? 1403}; pick things people really bought then.` : '';
      const audience = req.ageTrack === 'kid' ? '\nAudience: children up to 11. Only simple, friendly, everyday things a child knows (toys, fruit, sweets, school items); one common word each.' : req.ageTrack === 'teen' ? '\nAudience: teenagers.' : '';
      return {
        system: `${COMMON}\nTask: suggest catalog products for the game. Do NOT include prices.`,
        user: `Suggest ${req.count} distinct Iranian products or services.${req.category ? `\nAll in category "${req.category}".` : `\nCategories allowed: ${PRODUCT_CATEGORIES.join(', ')}.`}${era}${audience}${extra}
JSON shape: {"items":[{"slug":"latin-kebab-case-id","nameFa":"…","unitFa":"واحد مثل «بسته» یا «عدد» یا null","category":"one of the allowed categories","storyFa":"one short nostalgic sentence (max 200 chars)"}]}`,
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
      out = take(json.items, productDraft, (d) => !seen.has(d.slug) && !!seen.add(d.slug));
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
    case 'blog':
      out = take(json.posts, blogDraft);
      break;
  }
  return out.drafts.length === 0 ? null : out;
}
