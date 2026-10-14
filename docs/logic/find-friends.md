# Finding friends: public ID, phone, contacts, invite link (owner backlog items 19, 20)

Owner (2026-10-01): friend search by phone or ID, contact access to find people, an invite link anyone can be sent so that "when they
arrive they become friends", and a link shortener the admin configures.

## Public ID

Every player has one `users.handle` (7 characters from the invite alphabet, made on first use, unique). It is shown in the app and is
searchable by **exact** match only — no prefix or nickname search, so the player list cannot be enumerated. Rate limit: 20 searches a
minute per player.

## Phone

Search by phone and the address-book lookup find only players whose number is **verified** (D81) and who allow it
(`users.findable_by_phone`, default **on**, a switch in «پیدا کردن دوست»; proposed default, owner may flip it). Search never returns the matched number; the address-book lookup returns it only as the caller's own private contact note (below). A hidden or unknown number gives the same empty answer. `POST /friends/find-contacts` takes up to 500 numbers, normalises them
(Iranian mobiles only), returns the matching players; 6 uploads per hour per player. The app reads the address book in `FindSheet` («پیدا کردن از مخاطبین»): native through `expo-contacts` SDK 57's class-based API (`Contact.getAllDetails`; the legacy `getContactsAsync` on the package root throws «deprecated» at runtime) (permission text in `app.json`, needs a new native build), web through the Contact Picker API (Android Chrome; the player ticks the people; other browsers get a «not supported» note). Only Iranian mobiles with the name saved for them (`09xxxxxxxxx`, `+98`, Persian digits handled) leave the phone, deduplicated and capped at 500 (`social/contactNumbers.ts`); nothing is stored on the device. All matches are listed as cards (avatar, nickname, saved name and number, add-friend button; tap opens the player sheet) inside a scroll box capped at about a third of the screen height, so a long list scrolls instead of pushing the sheet off screen. Adult look (`docs/design/adult/Dozari Adult - Friends`): the sheet is a dark panel with a gold frame, the list is a ledger (one gold-framed box, rows split by dashed lines, gold-ringed avatar, brass add button); play look keeps the cream cards.

**Contact notes (owner, 2026-10-13):** the matched players' address-book name and number are kept privately for the searcher in `friend_contacts` (`owner_id, friend_id, contact_name, phone`), only for players who matched — the rest of the address book is never stored. `GET /friends` returns them as `contactName`/`phone` on the owner's own friends, the friends page shows them and searches by them; the other player never sees them. An empty name never overwrites a name saved earlier; the saved number is refreshed on each lookup but not cleaned up if the friend later changes their number. `find-contacts` takes `{contacts:[{phone,name}]}` (the name-less `{phones}` form still works).

## Invite link

`GET /me/find` returns `inviteUrl = link.invite_base + handle` (default `dozari://i/`; set `https://<domain>/i/` once a domain exists) and
`shareUrl`, the same link through the admin's shortener. The shortener is a setting `link.shortener_url` containing `{url}`; it is called
with GET (host checked against private addresses, no redirects, 5 s), the answer is read as plain text or JSON (`short_url`, `shortUrl`,
`short`, `result_url`, `link`, `url`, `result`, also one level deep), remembered, and any failure falls back to the long link.
Opening the link calls `POST /friends/link {handle}`: an account younger than `friend.link_auto_hours` (24) becomes a friend **at once**
(capped by `friend.link_auto_per_day` = 20 per link owner per day); an older account sends an ordinary friend request.
Not verified: the web side of an `https://` link (a page or app link that opens the app) — only the `dozari://` scheme exists today.
