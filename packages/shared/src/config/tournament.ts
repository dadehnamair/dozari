/** Tournament limits (docs/logic/tournaments.md, D60 single elimination). Entry cost, level gate, size and prizes are set per tournament in the admin builder. */
export const TOURNAMENT_SIZES = [4, 8, 16, 32] as const;
export const TOURNAMENT_MAX_ENTRY_COINS = 10_000;
export const TOURNAMENT_MAX_ENTRY_GEMS = 1_000;
export const TOURNAMENT_MAX_PRIZE_GEMS = 500;
export const TOURNAMENT_MAX_PRIZE_COINS = 100_000;
/** How often the server looks at tournaments to start rounds, retry busy players and close finished ones. */
export const TOURNAMENT_TICK_SECONDS = 20;
/** Scheduled rounds (D225): a new tournament plays one round per `gap`; players have `grace` minutes after a match opens to show up. */
export const TOURNAMENT_DEFAULT_ROUND_GAP_MINUTES = 24 * 60;
export const TOURNAMENT_DEFAULT_GRACE_MINUTES = 15;
export const TOURNAMENT_MAX_ROUND_GAP_MINUTES = 14 * 24 * 60;
export const TOURNAMENT_MIN_GRACE_MINUTES = 1;
export const TOURNAMENT_MAX_GRACE_MINUTES = 120;
/** Players are reminded this many minutes before their tournament starts or their match opens. */
export const TOURNAMENT_REMIND_MINUTES = 30;
