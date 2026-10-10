import { AI_LIMITS, AI_PUZZLE_CATALOG_MAX, trackRank } from '@dozari/shared';
import type { AiKind } from '@dozari/shared';
import type { LessonStore } from '../lessons/service.js';
import type { PuzzleAdmin } from '../puzzles/admin.js';
import type { ProductAdmin } from '../admin/products.js';
import type { LandingService } from '../landing/service.js';
import { slugify } from '../landing/service.js';
import { AiError, chat, listModels, resolveProviders } from './providers.js';
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
  catalog?: () => Promise<{ id: string; slug: string; nameFa: string }[]>;
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
      kinds: { products: !!this.deps.products, kid_lessons: !!this.deps.lessons, puzzle_titles: !!this.deps.puzzles, puzzle_groups: !!(this.deps.puzzles && this.deps.catalog && this.deps.products), blog: !!this.deps.landing },
      maxCallsPerHour: AI_LIMITS.maxCallsPerHour,
    };
  }

  private readonly modelCache = new Map<string, { at: number; ids: string[] }>();

  /** Model names of one provider for the panel's picker; cached for ten minutes. */
  async models(providerId: string): Promise<string[]> {
    const provider = this.providers.find((p) => p.id === providerId);
    if (!provider) throw new AiError('ai_unknown_provider');
    const now = (this.deps.now ?? Date.now)();
    const hit = this.modelCache.get(providerId);
    if (hit && now - hit.at < 600_000) return hit.ids;
    const ids = await listModels(provider, this.deps.fetch);
    if (ids.length > 0) this.modelCache.set(providerId, { at: now, ids });
    return ids;
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
    if (req.kind === 'puzzle_groups') {
      if (!this.deps.puzzles || !this.deps.catalog || !this.deps.products) throw new AiError('ai_not_found');
      const [all, details] = await Promise.all([this.deps.catalog(), this.deps.products.details()]);
      const usable = all.filter((p) => details[p.id]?.isActive && trackRank(details[p.id]!.ageTrack) <= trackRank(req.ageTrack));
      // A random sample so repeated runs do not always see the same slice of a big catalog.
      for (let i = usable.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [usable[i], usable[j]] = [usable[j]!, usable[i]!];
      }
      if (req.tierId) {
        const tier = (await this.deps.puzzles.tiers()).find((t) => t.id === req.tierId);
        if (!tier) throw new AiError('ai_not_found');
        ctx.tier = { nameFa: tier.nameFa, minLevel: tier.minLevel, maxLevel: tier.maxLevel };
      }
      ctx.pool = usable.slice(0, AI_PUZZLE_CATALOG_MAX).map((p) => ({ productId: p.id, nameFa: p.nameFa, category: details[p.id]?.category }));
      if (ctx.pool.length < 16) throw new AiError('ai_not_found');
      // Puzzles that already exist are sent too, so the model does not rebuild them; repeats are also dropped on parse.
      const names = new Map(all.map((p) => [p.id, p.nameFa]));
      const have = await this.deps.puzzles.list(AI_LIMITS.maxExistingPuzzles);
      ctx.existingPuzzles = have.map((p) => ({ titles: p.groups.map((g) => g.titleFa).filter((t): t is string => !!t), groups: p.groups.map((g) => g.items.map((i) => names.get(i) ?? i)) }));
    }
    if (req.kind === 'puzzle_titles') {
      const row = (await this.deps.puzzles?.list(500))?.find((p) => p.id === req.puzzleId);
      if (!row) throw new AiError('ai_not_found');
      ctx.puzzleGroups = row.groups;
    }
    this.takeSlot();
    const prompt = buildPrompt(req, ctx);
    const model = req.model?.trim() || provider.defaultModel;
    const text = await chat(provider, { ...prompt, model, maxTokens: AI_LIMITS.maxTokens[req.kind] }, this.deps.fetch);
    const parsed = parseDrafts(req.kind, text, ctx, req.kind === 'products' || req.kind === 'puzzle_groups' ? req.ageTrack : 'adult');
    if (!parsed) throw new AiError('ai_bad_output', undefined, `جواب مدل JSON قابل‌خواندن نبود: «${text.replace(/\s+/g, ' ').slice(0, 160)}»`);
    return { kind: req.kind, provider: provider.id, model, drafts: parsed.drafts, dropped: parsed.dropped, context: ctx, ...(req.kind === 'puzzle_groups' && req.tierId ? { tierId: req.tierId } : {}) };
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
      case 'puzzle_groups': {
        if (!d.puzzles) throw new AiError('ai_not_found');
        const out: SaveOutcome[] = [];
        for (const [i, p] of req.drafts.entries()) {
          const res = await d.puzzles.create(p.groups.map((g) => ({ level: g.level, titleFa: g.titleFa, explanationFa: g.explanationFa, productIds: g.items.map((x) => x.productId) })), req.tierId ?? null, p.ageTrack, 'draft');
          out.push({ label: `پازل ${i + 1}`, ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
        }
        return out;
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
