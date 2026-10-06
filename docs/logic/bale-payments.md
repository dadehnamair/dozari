# Bale wallet payments («کیف‌پول الکترونیکی بله»)

Source: the owner pasted Bale's developer docs on 2026-10-02 (the docs host is not reachable from the build container). This file keeps the
parts we need; wording is a summary, field names and limits are as published. Bale's bot API mirrors Telegram's: `POST {base}/bot{token}/{method}`
with a JSON body (`https://tapi.bale.ai` by default, see `notify/client.ts`).

## What it is

Wallets come in three kinds (personal, business, organisational). For small payments it beats card-to-card: no card number or second password
per purchase. For developers it offers: all bank cards supported, transaction inquiry, reversals, automatic receipts, instant deposit and
withdrawal, and split settlement. A bot (or mini-app) sends a payment request as an invoice and receives the payment.

## Methods

**sendInvoice** — sends a payment request into a chat; returns the sent message.

| Param | Type | Required | Notes |
|---|---|---|---|
| `chat_id` | String/Integer | yes | target chat or `@channelusername` |
| `title` | String | yes | product name, 1–32 chars |
| `description` | String | yes | 1–255 chars |
| `payload` | String | yes | our own id, 1–128 **bytes**, never shown to the user; comes back in `SuccessfulPayment` — use it to tell requests apart |
| `provider_token` | String | yes | wallet payment token from @botfather |
| `prices` | LabeledPrice[] | yes | JSON-serialised list; their sum is the total |
| `photo_url` | String | no | product image |
| `reply_to_message_id` | Integer | no | |

**createInvoiceLink** — same fields minus `chat_id`/`photo_url`/`reply_to_message_id`; returns a payment-link string for mini-apps (`openInvoice`).

**LabeledPrice** `{ label: String, amount: Integer }` — **amount in rials** (integer).

**answerPreCheckoutQuery** `{ pre_checkout_query_id, ok: Boolean, error_message? }` — after the user confirms and just before finalising, the bot
gets an update with `pre_checkout_query`. It **must answer within 10 seconds or the payment is cancelled**. `ok: true` = details right, goods
available; `ok: false` needs `error_message` (shown to the user).

**PreCheckoutQuery** `{ id, from: User, currency: "IRR", total_amount, invoice_payload }`. Receiving it does **not** mean the payment happened;
only a message carrying `SuccessfulPayment` does.

**SuccessfulPayment** `{ currency: "IRR", total_amount, invoice_payload, telegram_payment_charge_id, provider_payment_charge_id }` —
`telegram_payment_charge_id` is the unique payment id (equals `PreCheckoutQuery.id` for wallet payments); `provider_payment_charge_id` is the
tracking number when paid from the Bale wallet.

**inquireTransaction** `{ transaction_id }` → `Transaction { id, status, userID, amount, createdAt }`, `status` ∈ `pending | paid | failed |
rejected`. Not in the standard Telegram libraries: call the HTTP endpoint directly.

## How Dozari uses it (D129)

Coin packages (`coin_packages`, switch `feature.coin_packages`, see `economy.md` §Real-money coin purchases) are sold through the Bale bot:

1. `POST /coin-packages/:id/bale-invoice` (player must be linked to Bale, the package active and unlocked by level) → `sendInvoice` to their
   linked chat; `payload = cp:<packageId>:<userId>`, one price line `{label: package title, amount: price in rials}`, `provider_token` from
   `BALE_PROVIDER_TOKEN` (unset → `503 payments_unavailable`).
2. `pre_checkout_query` → answered `ok` only when the payload's player is the one linked to the paying Bale user, the package is still active,
   their level allows it and `total_amount` equals the package price in rials (always within 10 s: no I/O beyond two DB reads).
3. `successful_payment` → credit the package's coins through the ledger (`purchase`), idempotent on store `bale` + `telegram_payment_charge_id`,
   then tell the player in the chat. A replayed update credits nothing twice.

Money stays integer rials (rule 2); nothing is credited from `pre_checkout_query`.


Mini-app: `createInvoiceLink` + `openInvoice` and the unlinked-payer rule are in `miniapp.md` §Payments.
