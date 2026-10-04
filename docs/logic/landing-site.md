# Landing site `mrdozari.ir` (item 8, D173/D174)

A separate app in this repo (`apps/landing`, its own container `landing`, no database) that shows the game to the world: home page, blog, cast, FAQ.

## Content (managed in the game's admin panel, group «سایت معرفی»)

Blog posts (Markdown, draft/published, own Google title/description, cover, author), cast, FAQ, and the `landing.*` settings (name, tagline, hero title and text, contact e-mail). Stored in `landing_posts`, `landing_slug_redirects`, `landing_cast`, `landing_faq` (migration 0050) and served read-only by the game server at `GET /public/landing`, `/public/posts?page&pageSize`, `/public/posts/:slug` (open even in maintenance mode; drafts and hidden rows never leave). A renamed post's old slug answers `{redirectTo}` and the landing app turns it into a **301**.

## Pages and technical SEO/GEO

Server-rendered HTML (all content is in the markup, no scripts needed): `/`, `/blog` (`?page=N`, own canonical per page), `/blog/:slug`, `/cast`; `/sitemap.xml` (every indexable URL with real `lastmod` and `hreflang` alternates), `/robots.txt` (named AI crawlers allowed), `/llms.txt` and `/llms-full.txt`; a missing page is a real **404** (noindex), an unreachable game server a **503**.

Rules built into `src/seo.ts` / `pages.ts`, the only places markup is made: exactly one `h1`; `<title>`, description, canonical, `og:*`, `twitter:*`, `robots`, `hreflang fa-IR / x-default`; one JSON-LD `@graph` per page with a single `Organization` and `WebSite` (only real facts — no invented ratings or addresses), page nodes (`WebPage`, `CollectionPage` + `ItemList`, `AboutPage`, `BlogPosting` with real dates, `HowTo`, `FAQPage`) and a `BreadcrumbList` on inner pages; every page is linked from the header, footer or a list; headings carry anchor ids (citable sections); post body is escaped Markdown (raw HTML never passes, unsafe links dropped). Tests: `apps/landing/src/__tests__`.

## SEO fields in the admin panel (D180)

Admin panel → settings → group «سئو و سایت معرفی» (`seo`): the `landing.*` texts, plus `landing.seo_title`, `landing.seo_description`
(home `<title>` / description; empty = built from name, tagline and hero text), `landing.keywords` (JSON-LD `keywords` of the WebSite),
`landing.og_image` + `landing.og_image_alt` (every page's `og:image`; empty = the generated card at `/og.svg`), `landing.same_as`
(more official profile URLs for `sameAs`, http(s) only), `landing.font_url` (a self-hosted woff2 → `@font-face` + preload; no Google
fonts), `landing.indexable` (off = every page `noindex`, `robots.txt` closes the site, the sitemap lists no posts) and the
site-verification codes `seo.verify_google|bing|yandex` (letters, digits, `-`, `_` only; emitted as the matching `<meta>`).
They reach `apps/landing` through `site.seo` of `GET /public/landing`. Links and domains (`link.*`, `domain.*`) are in the group «مدیریت اپ».

## Waiting for the owner

The owner's Laravel SEO/GEO spreadsheet (page copy, keywords, schema choices) — it will refine copy and may add pages; DNS and the reverse-proxy forward for `mrdozari.ir` (`docs/deploy.md`); the values of the fields above (a raster `og:image`, the font file URL, the verification codes) — all are set in the admin panel, no code change.
