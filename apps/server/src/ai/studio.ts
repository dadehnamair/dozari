import { AI_LIMITS } from '@dozari/shared';
import type { AiKind } from '@dozari/shared';
import type { LessonStore } from '../lessons/service.js';
import type { PuzzleAdmin } from '../puzzles/admin.js';
import type { ProductAdmin } from '../admin/products.js';
import type { LandingService } from '../landing/service.js';
import { slugify } from '../landing/service.js';
import { AiError, chat, resolveProviders } from './providers.js';
import type { Env, FetchLike, ResolvedProvider } from './providers.js';
import { buildPrompt, nameKey, parseDrafts } from './content.js';
import type { GenerateRequest, PromptContext, SaveRequest } from './content.js';

export interface AiDeps {
  env: Env;
  lessons?: LessonStore;
  puzzles?: PuzzleAdmin;
  products?: ProductAdmin;
  landing?: LandingService;
  /** The catalog as it is now, to keep suggestions from repeating existing products. */
  catalog?: () => Promise<{ slug: string; nameFa: string }[]>;
  fetch?: FetchLike;
  now?: () => number;
}

export interface GenerateResult {
  kind: AiKind;
  provider: string;
  model: string;
  drafts: unknown[];
  dropped: number;
  /** Context the editor needs next to the drafts (the puzzle's groups, the kid items). */
  context: PromptContext;
}

export interface SaveOutcome {
  label: string;
  ok: boolean;
  error?: string;
}

/**
 * The admin «AI studio»: builds the prompt for a content kind from a few options, calls the chosen provider and returns validated drafts.
 * Drafts are only ever saved as drafts / inactive / unapproved by `save` (docs/logic/ai-studio.md).
 */
export class AiStudio {
  private readonly providers: ResolvedProvider[];
  private readonly calls: number[] = [];

  constructor(private readonly deps: AiDeps) {
    this.providers = resolveProviders(deps.env);
  }

  /** For the UI: providers that have a key (never the key itself), the default model of each and which kinds this server can save. */
  describe() {
    return {
      providers: this.providers.map((p) => ({ id: p.id, label: p.label, defaultModel: p.defaultModel })),
      kinds: { products: !!this.deps.products, kid_lessons: !!this.deps.lessons, puzzle_titles: !!this.deps.puzzles, blog: !!this.deps.landing },
      maxCallsPerHour: AI_LIMITS.maxCallsPerHour,
    };
  }

  private takeSlot(): void {
    const now = (this.deps.now ?? Date.now)();
    while (this.calls.length > 0 && now - (this.calls[0] as number) > 3_600_000) this.calls.shift();
    if (this.calls.length >= AI_LIMITS.maxCallsPerHour) throw new AiError('ai_rate_limited');
    this.calls.push(now);
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (this.providers.length === 0) throw new AiError('ai_not_configured');
    const provider = this.providers.find((p) => p.id === req.provider);
    if (!provider) throw new AiError('ai_unknown_provider');
    const ctx: PromptContext = {};
    if (req.kind === 'kid_lessons') {
      if (!this.deps.lessons) throw new AiError('ai_not_found');
      ctx.kidItems = (await this.deps.lessons.listKidItems('missing')).slice(0, req.count).map((i) => ({ productId: i.productId, nameFa: i.nameFa }));
      if (ctx.kidItems.length === 0) throw new AiError('ai_not_found');
    }
    if (req.kind === 'products' && this.deps.catalog) ctx.existing = await this.deps.catalog();
    if (req.kind === 'puzzle_titles') {
      const row = (await this.deps.puzzles?.list(500))?.find((p) => p.id === req.puzzleId);
      if (!row) throw new AiError('ai_not_found');
      ctx.puzzleGroups = row.groups;
    }
    this.takeSlot();
    const prompt = buildPrompt(req, ctx);
    const model = req.model?.trim() || provider.defaultModel;
    const text = await chat(provider, { ...prompt, model, maxTokens: AI_LIMITS.maxTokens[req.kind] }, this.deps.fetch);
    const parsed = parseDrafts(req.kind, text, ctx, req.kind === 'products' ? req.ageTrack : 'adult');
    if (!parsed) throw new AiError('ai_bad_output');
    return { kind: req.kind, provider: provider.id, model, drafts: parsed.drafts, dropped: parsed.dropped, context: ctx };
  }

  /** Saves reviewed drafts through the normal services: products inactive, lessons as draft, blog posts as draft, puzzle titles on the puzzle. */
  async save(req: SaveRequest): Promise<SaveOutcome[]> {
    const d = this.deps;
    switch (req.kind) {
      case 'products': {
        if (!d.products) throw new AiError('ai_not_found');
        const out: SaveOutcome[] = [];
        const known = new Set((await d.catalog?.() ?? []).flatMap((e) => [nameKey(e.nameFa), nameKey(e.slug)]));
        for (const p of req.drafts) {
          if (known.has(nameKey(p.nameFa)) || known.has(nameKey(p.slug))) {
            out.push({ label: p.nameFa, ok: false, error: 'duplicate' });
            continue;
          }
          known.add(nameKey(p.nameFa));
          known.add(nameKey(p.slug));
          let made: Awaited<ReturnType<ProductAdmin['create']>> = 'duplicate';
          for (const slug of [p.slug, `${p.slug}-2`, `${p.slug}-3`]) {
            made = await d.products.create({ slug, nameFa: p.nameFa, category: p.category, unitFa: p.unitFa, ageTrack: p.ageTrack });
            if (made !== 'duplicate') break;
          }
          if (typeof made === 'string') {
            out.push({ label: p.nameFa, ok: false, error: made });
            continue;
          }
          // Hidden until an editor has checked it and added approved prices.
          await d.products.update(made.id, { isActive: false, ...(p.storyFa ? { storyFa: p.storyFa } : {}) });
          // Prices land as `pending`, low confidence, flagged as AI-suggested; they never reach players before an editor approves them.
          const seenYears = new Set<number>();
          let priced = 0;
          for (const pr of p.prices) {
            if (seenYears.has(pr.year)) continue;
            seenYears.add(pr.year);
            const added = await d.products.addPrice({ productId: made.id, year: pr.year, month: null, priceRials: BigInt(pr.priceToman) * 10n, sourceType: 'other', sourceNote: 'AI-suggested, unverified', confidence: 1 });
            if (typeof added !== 'string') priced++;
          }
          out.push({ label: priced ? `${p.nameFa} (${priced})` : p.nameFa, ok: true });
        }
        return out;
      }
      case 'kid_lessons': {
        if (!d.lessons) throw new AiError('ai_not_found');
        const out: SaveOutcome[] = [];
        for (const l of req.drafts) {
          const ok = await d.lessons.save(l.productId, { wordFa: l.wordFa, storyFa: l.storyFa, syllablesFa: l.syllablesFa || null });
          out.push({ label: l.wordFa, ok, ...(ok ? {} : { error: 'not_found' }) });
        }
        return out;
      }
      case 'puzzle_titles': {
        if (!d.puzzles) throw new AiError('ai_not_found');
        const res = await d.puzzles.setTitles(req.puzzleId, req.drafts);
        return [{ label: req.puzzleId, ok: res === 'ok', ...(res === 'ok' ? {} : { error: res }) }];
      }
      case 'blog': {
        if (!d.landing) throw new AiError('ai_not_found');
        const out: SaveOutcome[] = [];
        for (const [i, p] of req.drafts.entries()) {
          const base = slugify(p.titleFa) || `post-${(d.now ?? Date.now)().toString(36)}-${i}`;
          let res = await d.landing.savePost({ ...p, status: 'draft' });
          for (const n of [2, 3]) {
            if (res.ok || res.error !== 'slug_taken') break;
            res = await d.landing.savePost({ ...p, slug: `${base}-${n}`, status: 'draft' });
          }
          out.push({ label: p.titleFa, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
        }
        return out;
      }
    }
  }
}
