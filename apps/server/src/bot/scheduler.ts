import type { SettingsService } from '../settings/service.js';
import type { BotService } from './service.js';

export interface SchedulerHandle {
  stop(): void;
}

/**
 * In-process daily schedule: every `bot.check_minutes` (admin setting) look for sources whose interval has passed and run
 * them. A tick that throws is logged and the loop keeps going; turning `bot.enabled` off pauses it without a restart.
 */
export function startBotScheduler(opts: { bot: BotService; settings: SettingsService; log: (msg: string, err?: unknown) => void; setTimer?: typeof setTimeout }): SchedulerHandle {
  const setTimer = opts.setTimer ?? setTimeout;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    let minutes = 60;
    try {
      minutes = await opts.settings.num('bot.check_minutes');
      if ((await opts.settings.num('bot.enabled')) === 1) {
        const runs = await opts.bot.runDue(await opts.settings.num('bot.max_candidates_per_run'));
        if (runs.length > 0) opts.log(`bot: ran ${runs.length} source(s), ${runs.reduce((a, r) => a + r.added, 0)} new candidate(s)`);
      }
    } catch (err) {
      opts.log('bot: tick failed', err);
    }
    if (!stopped) timer = setTimer(() => void tick(), minutes * 60_000);
  };
  // First look shortly after boot, so a freshly deployed server does not wait a full interval.
  timer = setTimer(() => void tick(), 30_000);
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
