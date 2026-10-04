# Finding friends: public ID, phone, contacts, invite link (owner backlog items 19, 20)

Owner (2026-10-01): friend search by phone or ID, contact access to find people, an invite link anyone can be sent so that "when they
arrive they become friends", and a link shortener the admin configures.

## Public ID

Every player has one `users.handle` (7 characters from the invite alphabet, made on first use, unique). It is shown in the app and is
searchable by **exact** match only — no prefix or nickname search, so the player list cannot be enumerated. Rate limit: 20 searches a
minute per player.

## Phone

Search by phone and the address-book lookup find only players whose number is **verified** (D81) and who allow it
(`users.findable_by_phone`, default **on**, a switch in «پیدا کردن دوست»; proposed default, owner may flip it). The number is never
returned. A hidden or unknown number gives the same empty answer. `POST /friends/find-contacts` takes up to 500 numbers, normalises them
(Iranian mobiles only), returns the matching players; 6 uploads per hour per player. The app side of reading the address book needs the
native contacts permission (a module not added yet): the server API is ready, the screen is the follow-up.

## Invite link

`GET /me/find` returns `inviteUrl = link.invite_base + handle` (default `dozari://i/`; set `https://<domain>/i/` once a domain exists) and
`shareUrl`, the same link through the admin's shortener. The shortener is a setting `link.shortener_url` containing `{url}`; it is called
with GET (host checked against private addresses, no redirects, 5 s), the answer is read as plain text or JSON (`short_url`, `shortUrl`,
`short`, `result_url`, `link`, `url`, `result`, also one level deep), remembered, and any failure falls back to the long link.
Opening the link calls `POST /friends/link {handle}`: an account younger than `friend.link_auto_hours` (24) becomes a friend **at once**
(capped by `friend.link_auto_per_day` = 20 per link owner per day); an older account sends an ordinary friend request.
Not verified: the web side of an `https://` link (a page or app link that opens the app) — only the `dozari://` scheme exists today.
