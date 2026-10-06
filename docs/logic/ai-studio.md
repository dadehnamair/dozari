# AI studio (admin, D204 — proposed, built)

Admin tab **«استودیوی هوش مصنوعی»** (`#/catalog/ai`, section محتوا و قیمت‌ها). The editor picks a content kind, sets a few options, presses «تولید»; the server asks a chat model and returns
**drafts**. The editor edits/ticks them and saves. Code: `apps/server/src/ai/` (`providers.ts`, `content.ts`, `studio.ts`, `routes.ts`), UI `admin/ui/views2/ai.ts`, limits `packages/shared/src/config/ai.ts`.

## Providers

Anything that speaks the OpenAI `POST {base}/chat/completions` dialect. Presets: ChatGPT (`openai`), DeepSeek (`deepseek`), GapGPT (`gapgpt`), AvalAI (`avalai`), plus one `custom` gateway.
A provider shows in the panel only when its key exists in the server environment:

| env | meaning |
|---|---|
| `AI_OPENAI_API_KEY`, `AI_DEEPSEEK_API_KEY`, `AI_GAPGPT_API_KEY`, `AI_AVALAI_API_KEY` | key per preset |
| `AI_<ID>_BASE_URL` | override a preset's base URL (the Iranian gateway URLs are best-effort defaults: check the provider's docs) |
| `AI_CUSTOM_BASE_URL`, `AI_CUSTOM_API_KEY`, `AI_CUSTOM_NAME`, `AI_CUSTOM_MODEL` | any other OpenAI-compatible gateway |

Keys are never stored in the DB, sent to the browser or written to the audit log. Base URLs come from env only (never from the admin UI), so an admin cannot point the server at an internal address.
The model name may be typed per request (letters, digits, `. _ - : /`); empty = the preset default.

## Kinds

| kind | options | output → saved as |
|---|---|---|
| `products` | count ≤20, category, age band, from/to Solar year, free hint | name, latin slug, unit, category, one nostalgic sentence → **inactive** product (`ProductAdmin.create`, then `isActive=false`); duplicate slug retries `-2`, `-3`. **No prices** are ever requested or stored. |
| `kid_lessons` | count ≤20 (kid items that have no lesson yet) | word, one-sentence story, syllables → `item_lessons` **draft** (an editor approves in «کلمه‌آموزی کودک») |
| `puzzle_titles` | one puzzle, style witty/plain | one title per group level → `PuzzleAdmin.setTitles` (editor reviews the titles in the same page before saving) |
| `blog` | topic, count ≤3, length short/medium/long, tone, keywords | title, summary, markdown body, SEO title/description → blog post **draft** (`LandingService.savePost`, `status: draft`) |

## Safety rules

- Output is JSON validated with zod twice (after the model, and again on save); invalid items are dropped and counted. Lesson drafts must match the requested items; title drafts must match real levels.
- Nothing is published, approved or activated by the model. A human reads every draft (the UI says so).
- Prompts forbid invented prices/statistics/quotes, politics, religion, insults, tobacco/alcohol promotion; kid prompts ask for simple, safe words. Hints typed by the editor are passed as content hints only.
- Cost bound: `AI_LIMITS.maxCallsPerHour` (30, whole server, in memory), `timeoutSeconds` (90), max output tokens per kind.
- Permission: `content` (editor and owner); audited as `ai.generate` / `ai.save` (kind, provider/model, counts — never the key or the text).
- The result of a failed call maps to `ai_*` errors with a Persian explanation in the UI (not configured, rate limited, timeout, unreachable, provider HTTP error, unusable output).

## Not built / ideas

Whole puzzles from scratch (needs the catalog's prices and `validatePuzzle`; today only titles), image generation, streaming, per-admin quotas, a saved prompt history.
