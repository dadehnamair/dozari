/** Tournament limits (docs/logic/tournaments.md, D60 single elimination). Entry cost, level gate, size and prizes are set per tournament in the admin builder. */
export const TOURNAMENT_SIZES = [4, 8, 16, 32] as const;
export const TOURNAMENT_MAX_ENTRY_COINS = 10_000;
export const TOURNAMENT_MAX_PRIZE_COINS = 100_000;
/** How often the server looks at tournaments to start rounds, retry busy players and close finished ones. */
export const TOURNAMENT_TICK_SECONDS = 20;
