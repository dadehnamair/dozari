/** Private/public tables: rounds, entry fee, join requests (docs/logic/matchmaking.md §Tables). */

/** A table plays this many 16-card boards («دور»), 1 to 3. The same count applies to 1v1 and 2v2. */
export const TABLE_ROUNDS_MIN = 1;
export const TABLE_ROUNDS_MAX = 3;
/** Smallest entry fee (coins per player) is this much per round: more rounds, higher minimum. */
export const TABLE_ENTRY_PER_ROUND = 10;
/** The host may ask for more than the minimum, up to this. */
export const TABLE_ENTRY_MAX = 500;
/** Share of the pot the house keeps (a coin sink); the rest goes to the winning side. */
export const TABLE_HOUSE_CUT_PERCENT = 10;
/** A join request waits this long for the host, then lapses. */
export const TABLE_REQUEST_TTL_MS = 2 * 60_000;
/** A table's price-guess questions after the boards (1v1 only): 0 = none, up to one per group of the last board. */
export const TABLE_PRICE_ROUNDS_MAX = 4;
/** At most this many requests wait at one table. */
export const TABLE_REQUESTS_MAX = 6;
/** The open-tables list shows at most this many tables. */
export const TABLE_PUBLIC_LIST_MAX = 30;
/** Bot-hosted lobby tables ask an entry of this many coins per round at least (the table minimum) and never more than this. */
export const AMBIENT_TABLE_FEE_MAX = 100;
/** A cheer stays in the stands this long, at most this many show, and one watcher may send one every so often. */
export const TABLE_REACTION_TTL_MS = 20_000;
export const TABLE_REACTIONS_SHOWN = 8;
export const TABLE_REACTION_GAP_MS = 2_000;

