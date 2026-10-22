import { AI_LIMITS, AI_PUZZLE_CATALOG_MAX, AI_PUZZLE_THEMED_CATALOG_MAX, AI_REVIEW, trackRank } from '@dozari/shared';
import type { AiKind } from '@dozari/shared';
import type { LessonStore } from '../lessons/service.js';
import type { PuzzleAdmin } from '../puzzles/admin.js';
import type { TriviaStore } from '../trivia/store.js';
import type { ProductAdmin } from '../admin/products.js';
import type { LandingService } from '../landing/service.js';
import { slugify } from '../landing/service.js';
import { AiError, chat, listModels, resolveProviders } from './providers.js';
import type { Env, FetchLike, ResolvedProvider } from './providers.js';
import { buildPrompt, nameKey, parseDrafts } from './content.js';
import type { GenerateRequest, PromptContext, SaveRequest } from './content.js';
import { buildPriceFillPrompt, parsePriceFill } from './price-fill.js';
import type { PriceFillRequest, PriceSuggestion } from './price-fill.js';
import { buildReviewPrompt, parseReview } from './puzzle-review.js';
import type { Candidate, ReviewOutcome, ReviewRequest, ReviewView } from './puzzle-review.js';

export interface AiDeps {
  env: Env;
  lessons?: LessonStore;
  puzzles?: PuzzleAdmin;
  /** General four-choice questions: the studio writes drafts into it and reads a topic's questions to avoid repeats. */
  trivia?: TriviaStore;
  products?: ProductAdmin;
  landing?: LandingService;
  /** The catalog as it is now, to keep suggestions from repeating existing products. */
  catalog?: () => Promise<{ id: string; slug: string; nameFa: string; unitFa?: string | null; /** Solar years that already have a price point. */ years?: number[] }[]>;
  /** The product categories the admin has defined (active ones); the prompt offers them to the model. */
  categories?: { activeSlugs(): Promise<string[]> };
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
      priceFill: !!this.deps.catalog,
      puzzleReview: !!(this.deps.puzzles && this.deps.catalog && this.deps.products),
      kinds: { products: !!this.deps.products, kid_lessons: !!this.deps.lessons, puzzle_titles: !!this.deps.puzzles, puzzle_groups: !!(this.deps.puzzles && this.deps.catalog && this.deps.products), blog: !!this.deps.landing, trivia: !!(this.deps.trivia && this.deps.puzzles) },
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

  /** The topic (and the defined, active tags) a request names; an unknown one is an error, never silently dropped. */
  private async theme(topicId: string | undefined, tags: readonly string[] | undefined): Promise<Pick<PromptContext, 'topic' | 'tags'>> {
    if (!this.deps.puzzles) throw new AiError('ai_not_found');
    const out: Pick<PromptContext, 'topic' | 'tags'> = {};
    if (topicId) {
      const topic = (await this.deps.puzzles.topics()).find((t) => t.id === topicId && t.isActive);
      if (!topic) throw new AiError('ai_not_found');
      out.topic = { nameFa: topic.nameFa };
    }
    if (tags && tags.length > 0) {
      const defs = await this.deps.puzzles.tags();
      const names: string[] = [];
      for (const slug of tags) {
        const def = defs.find((d) => d.slug === slug && d.isActive);
        if (!def) throw new AiError('ai_not_found');
        names.push(def.nameFa);
      }
      out.tags = names;
    }
    return out;
  }

  /** Asks the model for nominal prices of ONE product in years it has none for; returns suggestions only, nothing is saved. */
  async suggestPrices(req: PriceFillRequest): Promise<{ provider: string; model: string; prices: PriceSuggestion[]; dropped: number }> {
    if (this.providers.length === 0) throw new AiError('ai_not_configured');
    const provider = this.providers.find((p) => p.id === req.provider);
    if (!provider) throw new AiError('ai_unknown_provider');
    const product = req.productId ? (await this.deps.catalog?.())?.find((p) => p.id === req.productId) : req.nameFa ? { nameFa: req.nameFa, unitFa: req.unitFa ?? null, years: [] as number[] } : undefined;
    if (!product) throw new AiError('ai_not_found');
    const years = product.years ?? [];
    this.takeSlot();
    const prompt = buildPriceFillPrompt({ nameFa: product.nameFa, unitFa: product.unitFa ?? null, years }, req);
    const model = req.model?.trim() || provider.defaultModel;
    const text = await chat(provider, { system: prompt.system, user: prompt.user, model, maxTokens: 1200 }, this.deps.fetch);
    const parsed = parsePriceFill(text, years, prompt.years);
    if (!parsed) throw new AiError('ai_bad_output');
    return { provider: provider.id, model, ...parsed };
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
    if (req.kind === 'products' && this.deps.categories) ctx.categories = await this.deps.categories.activeSlugs();
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
      Object.assign(ctx, await this.theme(req.topicId, req.tags));
      ctx.pool = usable.slice(0, ctx.topic || ctx.tags?.length ? AI_PUZZLE_THEMED_CATALOG_MAX : AI_PUZZLE_CATALOG_MAX).map((p) => ({ productId: p.id, nameFa: p.nameFa, category: details[p.id]?.category }));
      if (ctx.pool.length < 16) throw new AiError('ai_not_found');
      // Puzzles that already exist are sent too, so the model does not rebuild them; repeats are also dropped on parse.
      const names = new Map(all.map((p) => [p.id, p.nameFa]));
      const have = await this.deps.puzzles.list(AI_LIMITS.maxExistingPuzzles);
      ctx.existingPuzzles = have.map((p) => ({ titles: p.groups.map((g) => g.titleFa).filter((t): t is string => !!t), groups: p.groups.map((g) => g.items.map((i) => names.get(i) ?? i)) }));
    }
    if (req.kind === 'trivia') {
      if (!this.deps.trivia) throw new AiError('ai_not_found');
      Object.assign(ctx, await this.theme(req.topicId, undefined));
      ctx.existingQuestions = (await this.deps.trivia.list({ topicId: req.topicId, limit: AI_LIMITS.maxExistingQuestions })).map((q) => q.textFa);
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
    const parsed = parseDrafts(req.kind, text, ctx, req.kind === 'products' || req.kind === 'puzzle_groups' || req.kind === 'trivia' ? req.ageTrack : 'adult');
    // A themed run where the model found too few fitting products answers with no puzzles: say so instead of «unreadable».
    if (!parsed && req.kind === 'puzzle_groups' && (ctx.topic || ctx.tags?.length) && /"puzzles"\s*:\s*\[\s*\]/.test(text)) {
      throw new AiError('ai_not_found', undefined, `در کاتالوگ محصول کافیِ مرتبط با «${ctx.topic?.nameFa ?? ctx.tags?.join('، ')}» پیدا نشد؛ اول محصول‌های این موضوع را (از «محصول» در همین صفحه یا دستی) به کاتالوگ اضافه کن.`);
    }
    if (!parsed) throw new AiError('ai_bad_output', undefined, `جواب مدل JSON قابل‌خواندن نبود: «${text.replace(/\s+/g, ' ').slice(0, 160)}»`);
    return { kind: req.kind, provider: provider.id, model, drafts: parsed.drafts, dropped: parsed.dropped, context: ctx, ...(req.kind === 'puzzle_groups' && req.tierId ? { tierId: req.tierId } : {}), ...(req.kind === 'puzzle_groups' || req.kind === 'trivia' ? { topicId: req.topicId } : {}), ...(req.kind === 'puzzle_groups' ? { tags: req.tags } : {}) };
  }

  /**
   * The puzzle review assistant: for each chosen puzzle asks the model whether it needs editing and, unless `dryRun`, applies the edits
   * (new titles, product swaps) and moves an edited puzzle back to `draft`, so a human approves it again. One provider call per puzzle.
   */
  async reviewPuzzles(req: ReviewRequest): Promise<{ provider: string; model: string; dryRun: boolean; outcomes: ReviewOutcome[] }> {
    if (this.providers.length === 0) throw new AiError('ai_not_configured');
    const provider = this.providers.find((p) => p.id === req.provider);
    if (!provider) throw new AiError('ai_unknown_provider');
    const { puzzles, catalog, products } = this.deps;
    if (!puzzles || !catalog || !products) throw new AiError('ai_not_found');
    const model = req.model?.trim() || provider.defaultModel;
    const [all, details, tiers, topics, rows] = await Promise.all([catalog(), products.details(), puzzles.tiers(), puzzles.topics(), puzzles.list(1000)]);
    const names = new Map(all.map((p) => [p.id, p.nameFa]));
    const outcomes: ReviewOutcome[] = [];
    for (const puzzleId of req.puzzleIds) {
      const row = rows.find((r) => r.id === puzzleId);
      if (!row) {
        outcomes.push({ puzzleId, result: 'error', error: 'ai_not_found' });
        continue;
      }
      const view: ReviewView = {
        ageTrack: row.ageTrack,
        ...(row.tierId && tiers.find((t) => t.id === row.tierId) ? { tier: tiers.find((t) => t.id === row.tierId)! } : {}),
        ...(row.topicId && topics.find((t) => t.id === row.topicId) ? { topic: topics.find((t) => t.id === row.topicId)!.nameFa } : {}),
        groups: row.groups.map((g) => ({ level: g.level, titleFa: g.titleFa, items: g.productIds.map((productId) => ({ productId, nameFa: names.get(productId) ?? productId, category: details[productId]?.category })) })),
      };
      const inPuzzle = new Set(row.groups.flatMap((g) => g.productIds));
      const usable = all.filter((p) => !inPuzzle.has(p.id) && details[p.id]?.isActive && trackRank(details[p.id]!.ageTrack) <= trackRank(row.ageTrack));
      for (let i = usable.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [usable[i], usable[j]] = [usable[j]!, usable[i]!];
      }
      const candidates: Candidate[] = usable.slice(0, AI_REVIEW.candidates).map((p) => ({ productId: p.id, nameFa: p.nameFa, category: details[p.id]?.category }));
      try {
        this.takeSlot();
        const text = await chat(provider, { ...buildReviewPrompt(view, candidates, req.extra), model, maxTokens: AI_REVIEW.maxTokens }, this.deps.fetch);
        const verdict = parseReview(text, view, candidates);
        if (!verdict) throw new AiError('ai_bad_output');
        if (verdict.verdict === 'ok') {
          outcomes.push({ puzzleId, result: 'ok', reason: verdict.reason });
          continue;
        }
        const report = { puzzleId, reason: verdict.reason, titles: verdict.titles, swaps: verdict.swaps.map((s) => ({ fromName: s.fromName, toName: s.toName, reason: s.reason })), wasStatus: row.status };
        if (req.dryRun) {
          outcomes.push({ ...report, result: 'would_edit' });
          continue;
        }
        const done = { titles: verdict.titles, swaps: [] as typeof report.swaps };
        if (verdict.titles.length > 0) await puzzles.setTitles(puzzleId, verdict.titles);
        for (const s of verdict.swaps) if ((await puzzles.swapProduct(puzzleId, s.fromProductId, s.toProductId)).ok) done.swaps.push({ fromName: s.fromName, toName: s.toName, reason: s.reason });
        if (done.titles.length === 0 && done.swaps.length === 0) {
          outcomes.push({ puzzleId, result: 'ok', reason: verdict.reason });
          continue;
        }
        await puzzles.setStatus(puzzleId, 'draft');
        outcomes.push({ ...report, ...done, result: 'edited' });
      } catch (err) {
        const code = err instanceof AiError ? err.code : 'unexpected';
        outcomes.push({ puzzleId, result: 'error', error: code });
        if (code === 'ai_rate_limited') break;
      }
    }
    return { provider: provider.id, model, dryRun: req.dryRun, outcomes };
  }

  /** Saves reviewed drafts through the normal services: products inactive, lessons as draft, blog posts as draft, puzzle titles on the puzzle. */
  async save(req: SaveRequest): Promise<SaveOutcome[]> {
    const d = this.deps;
    switch (req.kind) {
      case 'products': {
        if (!d.products) throw new AiError('ai_not_found');
        const out: SaveOutcome[] = [];
        const known = new Set((await d.catalog?.() ?? []).flatMap((e) => [nameKey(e.nameFa), nameKey(e.slug)]));
        const allowed = d.categories ? new Set(await d.categories.activeSlugs()) : null;
        for (const p of req.drafts) {
          if (known.has(nameKey(p.nameFa)) || known.has(nameKey(p.slug))) {
            out.push({ label: p.nameFa, ok: false, error: 'duplicate' });
            continue;
          }
          known.add(nameKey(p.nameFa));
          known.add(nameKey(p.slug));
          let made: Awaited<ReturnType<ProductAdmin['create']>> = 'duplicate';
          for (const slug of [p.slug, `${p.slug}-2`, `${p.slug}-3`]) {
            made = await d.products.create({ slug, nameFa: p.nameFa, category: !allowed || allowed.has(p.category) ? p.category : 'other', unitFa: p.unitFa, ageTrack: p.ageTrack });
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
          // Filed under the topic and tagged right away; a failure here leaves the draft untagged but saved.
          const filed = res.ok && (req.topicId || req.tags?.length) ? await d.puzzles.setTopic(res.id, req.topicId ?? null, req.tags ?? []) : 'ok';
          out.push({ label: `پازل ${i + 1}`, ok: res.ok && filed === 'ok', ...(res.ok ? (filed === 'ok' ? {} : { error: filed }) : { error: res.error }) });
        }
        return out;
      }
      case 'trivia': {
        if (!d.trivia) throw new AiError('ai_not_found');
        const out: SaveOutcome[] = [];
        for (const q of req.drafts) {
          const res = await d.trivia.create({ ...q, topicId: req.topicId, difficulty: 2 }, 'draft');
          out.push({ label: q.textFa.slice(0, 40), ok: res.ok, ...(res.ok ? {} : { error: res.error }) });
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
