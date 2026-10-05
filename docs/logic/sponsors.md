# Sponsors (D203)

Owner (2026-10-05): a place to define sponsors (banner + info), shown on tournaments, plus a «want to sponsor?» invitation.

## Defining a sponsor (admin «اسپانسرها»)

`sponsors` table: name (≤60), short tagline (≤120), story (≤1000), **banner / logo / site links** (https only, validated by `isHttpsUrl`;
images are hosted by us — rule 8, nothing from Google), accent colour `#RRGGBB`, `is_active`. Create, edit, switch off. There is no delete: an
inactive sponsor is simply hidden everywhere. The admin has no image upload yet: put the image on our own storage and paste its https link.

## On a tournament

The tournament builder has a «اسپانسر» select (active sponsors only; `tournaments.sponsor_id`, nullable). Choosing an unknown or inactive sponsor is
rejected (`INVALID`); keeping an already-chosen one that was switched off later is allowed but it is hidden from players. The sponsor can be changed or
cleared at any time (not a structural field).

Players see it in two places: a «با حمایت X» line with the logo under the tournament in the list (`sponsor`: id, name, logo), and a sponsor card with
banner, name, tagline, story and a «دیدن صفحه‌ی اسپانسر» button on the tournament's own page (`sponsor`: full). `isActive` never leaves the server.

## «Want to sponsor?» invitation

Three public settings (group «app»): `sponsor.cta_title`, `sponsor.cta_body`, `sponsor.contact_url` (https link or `mailto:`). A dashed invitation card
with a contact button is shown at the end of the tournament list **only when `contact_url` is set**.

## Not built

Sponsor analytics (views/clicks), sponsored daily puzzles or price rounds, image upload in the panel, scheduling a sponsor's active window.
