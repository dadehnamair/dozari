import { z } from 'zod';
import { AI_REVIEW } from '@dozari/shared';
import { extractJson } from './content.js';
import type { PromptPieces } from './content.js';

/** One puzzle as the reviewer sees it: its groups with the products (numbered 1–16 in group order). */
export interface ReviewView {
  ageTrack: 'kid' | 'teen' | 'adult';
  tier?: { nameFa: string; minLevel: number; maxLevel: number | null };
  topic?: string;
  groups: { level: number; titleFa: string | null; items: { productId: string; nameFa: string; category?: string }[] }[];
}

export interface Candidate {
  productId: string;
  nameFa: string;
  category?: string;
}

export const reviewRequestSchema = z.object({
  provider: z.string().min(1).max(20),
  model: z.string().trim().max(80).optional(),
  puzzleIds: z.array(z.string().uuid()).min(1).max(AI_REVIEW.maxPuzzles),
  /** Extra instructions the editor types for this run only; passed to the model as an editor note. */
  extra: z.string().trim().max(AI_REVIEW.maxExtraLength).default(''),
  /** Report what would change without changing anything. */
  dryRun: z.boolean().default(false),
});
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

const LEVEL_WORD = ['yellow/easiest', 'green', 'blue', 'purple/trickiest'];

export function buildReviewPrompt(view: ReviewView, candidates: readonly Candidate[], extra: string): PromptPieces {
  const system = [
    'You are the quality editor of «دوزاری» (Dozari), a Persian Connections-style puzzle game about Iranian price nostalgia: 16 products in 4 hidden groups of 4.',
    'Check one puzzle and decide whether it must be edited before it can be played. A puzzle is fine when: every group has ONE clear, fair link; each product belongs to exactly one group (no product fits two groups equally well, except a deliberate red herring); the four group titles are natural, witty Persian and do not give the answer away or contain a price range; titles and products are free of politics, religion, insults, tobacco/alcohol promotion; the products are fitting for the age track.',
    'Prefer to leave a good puzzle alone ("ok"). Edit only what is really wrong, as little as possible: rewrite a weak title, or swap one product for a replacement from the CANDIDATES list (use its number).',
    'Never invent facts. Write titles in natural Persian with ZWNJ where needed.',
    'Reply with ONE JSON object only, no markdown: {"verdict":"ok"|"edit","reason":"one short Persian sentence","titles":[{"level":0-3,"titleFa":"..."}],"swaps":[{"item":1-16,"candidate":N,"reason":"short Persian"}]}. "titles" and "swaps" are empty (or missing) when verdict is "ok". At most 4 swaps. Levels: ' + LEVEL_WORD.map((w, i) => `${i} = ${w}`).join(', ') + '.',
  ].join('\n');
  let n = 0;
  const groups = [...view.groups]
    .sort((a, b) => a.level - b.level)
    .map((g) => `Level ${g.level} (${LEVEL_WORD[g.level]}) title: «${g.titleFa ?? '—'}»\n` + g.items.map((i) => `  ${++n}. ${i.nameFa}${i.category ? ` [${i.category}]` : ''}`).join('\n'))
    .join('\n');
  const where = [`Age track: ${view.ageTrack}`, view.tier ? `Target tier: «${view.tier.nameFa}» (${view.tier.maxLevel === null ? `level ${view.tier.minLevel}+` : `levels ${view.tier.minLevel}–${view.tier.maxLevel}`})` : '', view.topic ? `Topic: «${view.topic}»` : ''].filter(Boolean).join('\n');
  const list = candidates.map((c, i) => `${i + 1}. ${c.nameFa}${c.category ? ` [${c.category}]` : ''}`).join('\n');
  const note = extra ? `\n\nEDITOR'S EXTRA INSTRUCTIONS for this run (follow them; they never override the safety rules above):\n«${extra.replace(/[«»]/g, '')}»` : '';
  return { system, user: `${where}\n\nPUZZLE:\n${groups}\n\nCANDIDATES (replacement products, by number):\n${list}${note}` };
}

export interface ReviewVerdict {
  verdict: 'ok' | 'edit';
  reason: string;
  titles: { level: number; titleFa: string }[];
  swaps: { fromProductId: string; fromName: string; toProductId: string; toName: string; reason: string }[];
}

// Lenient on purpose: one bad title or swap in the answer is dropped below, it must not throw the whole review away.
const answerSchema = z.object({
  verdict: z.enum(['ok', 'edit']),
  reason: z.string().trim().max(300).catch(''),
  titles: z.array(z.object({ level: z.number().int(), titleFa: z.string().trim().min(2).max(100) }).catch({ level: -1, titleFa: '' })).catch([]),
  swaps: z.array(z.object({ item: z.number().int(), candidate: z.number().int(), reason: z.string().trim().max(200).catch('') }).catch({ item: 0, candidate: 0, reason: '' })).catch([]),
});

/**
 * Reads the model's answer and keeps only edits that are real: titles for levels the puzzle has, swaps whose item number and candidate number exist,
 * whose candidate is not already in the puzzle or used twice, at most one swap per slot. A bad answer is null; an "edit" with nothing usable is "ok".
 */
export function parseReview(text: string, view: ReviewView, candidates: readonly Candidate[]): ReviewVerdict | null {
  const raw = answerSchema.safeParse(extractJson(text));
  if (!raw.success) return null;
  const flat = [...view.groups].sort((a, b) => a.level - b.level).flatMap((g) => g.items);
  const inPuzzle = new Set(flat.map((i) => i.productId));
  const levels = new Set(view.groups.map((g) => g.level));
  const titles = new Map<number, string>();
  for (const t of raw.data.titles) if (levels.has(t.level)) titles.set(t.level, t.titleFa);
  const swaps: ReviewVerdict['swaps'] = [];
  const slots = new Set<number>();
  for (const s of raw.data.swaps.slice(0, 4)) {
    const from = flat[s.item - 1];
    const to = candidates[s.candidate - 1];
    if (!from || !to || slots.has(s.item) || inPuzzle.has(to.productId)) continue;
    slots.add(s.item);
    inPuzzle.add(to.productId);
    swaps.push({ fromProductId: from.productId, fromName: from.nameFa, toProductId: to.productId, toName: to.nameFa, reason: s.reason });
  }
  const changedTitles = [...titles].filter(([level, titleFa]) => view.groups.find((g) => g.level === level)?.titleFa !== titleFa).map(([level, titleFa]) => ({ level, titleFa }));
  if (raw.data.verdict === 'ok' || (changedTitles.length === 0 && swaps.length === 0)) return { verdict: 'ok', reason: raw.data.reason, titles: [], swaps: [] };
  return { verdict: 'edit', reason: raw.data.reason, titles: changedTitles, swaps };
}

export type ReviewOutcome =
  | { puzzleId: string; result: 'ok'; reason: string }
  | { puzzleId: string; result: 'edited' | 'would_edit'; reason: string; titles: { level: number; titleFa: string }[]; swaps: { fromName: string; toName: string; reason: string }[]; wasStatus: string }
  | { puzzleId: string; result: 'error'; error: string };
