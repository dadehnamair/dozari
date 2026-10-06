# AI studio (admin, D204 — proposed, built)

Admin tab **«استودیوی هوش مصنوعی»** (`#/catalog/ai`, section محتوا و قیمت‌ها). The editor picks a content kind, sets a few options, presses «تولید»; the server asks a chat model and returns
**drafts**. The editor edits/ticks them and saves. Code: `apps/server/src/ai/` (`providers.ts`, `content.ts`, `studio.ts`, `routes.ts`), UI `admin/ui/views2/ai.ts`, limits `packages/shared/src/config/ai.ts`.

## Providers

Anything that speaks the OpenAI `POST {base}/chat/completions` dialect. Presets: ChatGPT (`openai`), DeepSeek (`deepseek`), GapGPT (`gapgpt`), AvalAI (`avalai`), ParsPack AI Studio (`parspack`, `https://ai.parspack.com/v1`, default model «Grok 4»; model names may contain spaces), Gemini (`gemini`, via Google's OpenAI-compatible endpoint), plus one `custom` gateway. Claude (`anthropic`) uses Anthropic's native `POST {base}/messages` (`x-api-key`, `anthropic-version`). Gemini/Claude are server-side admin-only calls, never a client dependency (CLAUDE.md rule 8 concerns the app).
A provider shows in the panel only when its key exists in the server environment:

| env | meaning |
|---|---|
| `AI_OPENAI_API_KEY`, `AI_DEEPSEEK_API_KEY`, `AI_GAPGPT_API_KEY`, `AI_AVALAI_API_KEY`, `AI_PARSPACK_API_KEY`, `AI_ANTHROPIC_API_KEY`, `AI_GEMINI_API_KEY` | key per preset |
| `AI_<ID>_BASE_URL` | override a preset's base URL (the Iranian gateway URLs are best-effort defaults: check the provider's docs) |
| `AI_CUSTOM_BASE_URL`, `AI_CUSTOM_API_KEY`, `AI_CUSTOM_NAME`, `AI_CUSTOM_MODEL` | any other OpenAI-compatible gateway |

Keys are never stored in the DB, sent to the browser or written to the audit log. Base URLs come from env only (never from the admin UI), so an admin cannot point the server at an internal address.
The model name may be typed per request (letters, digits, inner spaces, `. _ - : /`); empty = the preset default.

## Model picker and odd answers

The panel's «مدل» is a dropdown filled from the provider (`GET /admin/ai/models?provider=…` → the provider's `GET {base}/models`, cached 10 min; embedding/audio/image models hidden). The first, empty option means the preset default; an empty or failing list leaves only that option.
Answers are cleaned before parsing: `<think>…</think>` blocks removed, array-of-parts `content` joined, trailing commas tolerated. An empty answer or unreadable JSON gives `ai_bad_output` with a short reason (e.g. the output hit `max_tokens` because a reasoning model spent it thinking, or the first 160 characters of what came back); the same detail is logged server-side (`ai studio call failed`).

## Kinds

| kind | options | output → saved as |
|---|---|---|
| `products` | count ≤20, category, age band, from/to Solar year, free hint | name, latin slug, unit, category, one nostalgic sentence → **inactive** product (`ProductAdmin.create`, then `isActive=false`); duplicate slug retries `-2`, `-3`. Each draft may carry up to 8 nominal prices (year + toman, integer); they are saved as **`pending`** price points (×10 → rials, confidence 1, note «AI-suggested, unverified») and an editor approves them in the catalog like any other price. Products already in the catalog (name or slug, Persian-normalised) are sent to the model as a delimited «EXISTING PRODUCT LIST» (all of them, up to `AI_LIMITS.maxExistingNames` = 3000) and filtered out again on parse and on save; the result banner says how many were sent. |
| `kid_lessons` | count ≤20 (kid items that have no lesson yet) | word, one-sentence story, syllables → `item_lessons` **draft** (an editor approves in «کلمه‌آموزی کودک») |
| `puzzle_titles` | one puzzle, style witty/plain | one title per group level → `PuzzleAdmin.setTitles` (editor reviews the titles in the same page before saving) |
| `puzzle_groups` | count ≤3, age track, title style | **whole puzzles**: the model gets up to 300 active catalog products (numbered, filtered by age track) and returns 4 groups (levels 0–3) × 4 distinct products with a title and a plain rule sentence each → `PuzzleAdmin.create(…, 'draft')` (`source: curated`, **draft**: an editor approves it in «ساخت پازل»). Numbers outside the list, repeated products or wrong shapes drop the puzzle. **No repeats of existing puzzles:** up to `maxExistingPuzzles` (150) existing puzzles (group titles) go to the model as «EXISTING PUZZLES», and on parse a draft is dropped when one of its groups has the same four products as an existing/earlier group or 12+ of its 16 products are shared with one (`repeatsExisting`). **Review before saving:** each group shows the products the model attached to it (with category); the editor may swap any product (type a name from the catalog list), must tick «تأیید می‌کنم» on all four groups, and the puzzle cannot be saved with a product in two groups. |
| `blog` | topic, count ≤3, length short/medium/long, tone, keywords | title, summary, markdown body, SEO title/description → blog post **draft** (`LandingService.savePost`, `status: draft`) |

## Safety rules

- Output is JSON validated with zod twice (after the model, and again on save); invalid items are dropped and counted. Lesson drafts must match the requested items; title drafts must match real levels.
- Nothing is published, approved or activated by the model. A human reads every draft (the UI says so).
- Prompts forbid invented statistics/quotes (prices only as best-recollection nominal values, never served before approval), politics, religion, insults, tobacco/alcohol promotion; kid prompts ask for simple, safe words. Hints typed by the editor are passed as content hints only.
- Cost bound: `AI_LIMITS.maxCallsPerHour` (30, whole server, in memory), `timeoutSeconds` (90), max output tokens per kind.
- Permission: `content` (editor and owner); audited as `ai.generate` / `ai.save` (kind, provider/model, counts — never the key or the text).
- The result of a failed call maps to `ai_*` errors with a Persian explanation in the UI (not configured, rate limited, timeout, unreachable, provider HTTP error, unusable output).

## Not built / ideas

Whole puzzles from scratch (needs the catalog's prices and `validatePuzzle`; today only titles), image generation, streaming, per-admin quotas, a saved prompt history.
