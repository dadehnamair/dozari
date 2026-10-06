# Landing site `mrdozari.ir` (item 8, D173/D174)

A separate app in this repo (`apps/landing`, its own container `landing`, no database) that shows the game to the world: home page, blog, cast, FAQ.

## Content (managed in the game's admin panel, group «سایت معرفی»)

Blog posts (Markdown, draft/published, own Google title/description, cover, author), cast, FAQ, and the `landing.*` settings (name, tagline, hero title and text, contact e-mail). Stored in `landing_posts`, `landing_slug_redirects`, `landing_cast`, `landing_faq` (migration 0050) and served read-only by the game server at `GET /public/landing`, `/public/posts?page&pageSize`, `/public/posts/:slug` (open even in maintenance mode; drafts and hidden rows never leave). A renamed post's old slug answers `{redirectTo}` and the landing app turns it into a **301**.

Starter content lives in `packages/db/seed/landing/{posts,cast,faq}.json` and is loaded by `pnpm --filter @dozari/db seed` (also on every production `seed` run, even with `--if-empty`) or alone with `seed --landing-only`. It is insert-only: posts match by slug, cast by name, FAQ by question, and rows that already exist (e.g. edited in the admin panel) are never overwritten.

## Pages and technical SEO/GEO

Server-rendered HTML (all content is in the markup, no scripts needed): `/`, `/about`, `/download`, `/contact` (FAQ + e-mail, no form), `/blog` (`?page=N`, own canonical per page), `/blog/:slug`, `/cast`, `/terms`, `/privacy`; `/sitemap.xml` (every indexable URL with real `lastmod` and `hreflang` alternates), `/robots.txt` (named AI crawlers allowed), `/llms.txt` and `/llms-full.txt`; a missing page is a real **404** (noindex), an unreachable game server a **503**.

Rules built into `src/seo.ts` / `pages.ts`, the only places markup is made: exactly one `h1`; `<title>`, description, canonical, `og:*`, `twitter:*`, `robots`, `hreflang fa-IR / x-default`; one JSON-LD `@graph` per page with a single `Organization` and `WebSite` (only real facts — no invented ratings or addresses), page nodes (`WebPage`, `CollectionPage` + `ItemList`, `AboutPage`, `BlogPosting` with real dates, `HowTo`, `FAQPage`) and a `BreadcrumbList` on inner pages; every page is linked from the header, footer or a list; headings carry anchor ids (citable sections); post body is escaped Markdown (raw HTML never passes, unsafe links dropped). Tests: `apps/landing/src/__tests__`.

Visual design follows `docs/design/Dozari Site - *.dc.html` + `SiteNav`/`SiteFooter` (beside the shared `Character`/`Item` components: `support.js` resolves components only from the page's own folder) (sticky pill nav, coloured bands, thick-bordered cards, 4-column footer), adapted to the real product (price nostalgia, not a word game); no web fonts are loaded (rule 8) — headings use Vazirmatn 900 / system Persian fonts, or the self-hosted `landing.font_url`. Download shows only real links (`link.*`); no invented store listings, team members or version notes.

## SEO fields in the admin panel (D180)

Admin panel → settings → group «سئو و سایت معرفی» (`seo`): the `landing.*` texts, plus `landing.seo_title`, `landing.seo_description`
(home `<title>` / description; empty = built from name, tagline and hero text), `landing.keywords` (JSON-LD `keywords` of the WebSite),
`landing.og_image` + `landing.og_image_alt` (every page's `og:image`; empty = the generated card at `/og.svg`), `landing.same_as`
(more official profile URLs for `sameAs`, http(s) only), `landing.font_url` (a self-hosted woff2 → `@font-face` + preload; no Google
fonts), `landing.indexable` (off = every page `noindex`, `robots.txt` closes the site, the sitemap lists no posts) and the
site-verification codes `seo.verify_google|bing|yandex|enamad` (enamad defaults to the owner's code; letters, digits, `-`, `_` only; emitted as the matching `<meta>`).
They reach `apps/landing` through `site.seo` of `GET /public/landing`. Links and domains (`link.*`, `domain.*`) are in the group «مدیریت اپ».

## Waiting for the owner

The owner's Laravel SEO/GEO spreadsheet (page copy, keywords, schema choices) — it will refine copy and may add pages; DNS and the reverse-proxy forward for `mrdozari.ir` (`docs/deploy.md`); the values of the fields above (a raster `og:image`, the font file URL, the verification codes) — all are set in the admin panel, no code change.

Characters and icons: the designed SVG cast (`docs/design/Character.dc.html`, `Item.dc.html`) is rendered once into `apps/landing/assets/{characters,items}` and served at `/characters/*` and `/items/*`. A cast row's `image` is a character key (`khale`) or a picture URL; otherwise the character is paired by name. Posts without a cover get a character picked from the slug. The download page draws a real QR code (`qrcode-generator`) of `/download`; the contact form opens the visitor's mail program (`mailto:`) because the landing has no database or mail service; stores without a real link show «به‌زودی».

Fonts are self-hosted from `apps/landing/assets/fonts` (Lalezar for display/headings per D58, Vazirmatn for text; both OFL, licences alongside) and served at `/fonts/*`; no external font requests (rule 8).

## Banners, icons and motion (home page)

The eight promo banners of `docs/design/banner` are resized to 1600px webp in `apps/landing/assets/banners` (`/banners/bannerN.webp`; `og.jpg` = the 1200x630 social card, now the default `og:image`). The home page shows them as an auto-playing, swipeable carousel (CSS scroll-snap, so it works without scripts) and as tilted frames in alternating colour bands (puzzle, price guess, duel, 31 provinces, daily wheel), then animated counters, a playable sample puzzle (plain words, with a red herring) and a banner call-to-action. Favicon, apple-touch icon and `/site.webmanifest` come from the app icon (`assets/icons`, linked in every `<head>` by `seo.ts`). Motion = CSS animations + one small inline script (scroll reveal via `.rv`, progress bar, carousel, counters, sample puzzle); everything is visible without scripts and all animation stops under `prefers-reduced-motion`. Copy shows only real facts (16 items, 4 groups, 31 provinces, modes, daily wheel).

## Try-it puzzle (home page)

`GET /public/landing-demo` (game server) returns one approved, adult, non-daily puzzle whose 16 products all have an `icon_key`: four groups (`level`, `title`) of four items (`name`, `svg` from shared `itemSvg`, `image` = the product's primary absolute photo URL or null; the page shows the photo when there is one, else the icon). The pick is stable per day. The landing home page draws the tiles with those icons; it falls back to the built-in word puzzle when the endpoint answers 404 or fails. The solution is in the page by nature of a client-side demo, hence daily puzzles are excluded.
