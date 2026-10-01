import type { SettingsService } from '../settings/service.js';
import type { BaleClient } from './client.js';
import type { NotifyService } from './service.js';

export interface RunnerHandle {
  stop(): void;
}

/**
 * Background loops of the Bale integration: long-poll the bot for messages, flush the outbox every few seconds and
 * announce ready daily rewards once a minute. Polling needs no public URL (a webhook would). Every loop survives errors.
 */
export function startNotifyRunner(opts: { service: NotifyService; client: BaleClient; settings?: SettingsService; log: (msg: string, err?: unknown) => void }): RunnerHandle {
  let stopped = false;
  const timers: ReturnType<typeof setInterval>[] = [];

  void (async () => {
    let offset = 0;
    while (!stopped) {
      try {
        const updates = await opts.client.getUpdates(offset, 25);
        for (const u of updates) {
          offset = Math.max(offset, u.update_id + 1);
          await opts.service.handleUpdate(u).catch((err) => opts.log('bale: update failed', err));
        }
      } catch (err) {
        opts.log('bale: polling failed', err);
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  })();

  timers.push(setInterval(() => void opts.service.flush().catch((err) => opts.log('bale: flush failed', err)), 5_000));
  timers.push(
    setInterval(() => {
      void (async () => {
        if (opts.settings && (await opts.settings.num('notify.daily_ready')) !== 1) return;
        const hours = opts.settings ? await opts.settings.num('economy.daily_cooldown_hours') : 20;
        await opts.service.announceDaily(hours * 3_600_000);
      })().catch((err) => opts.log('bale: daily announce failed', err));
    }, 60_000),
  );
  return {
    stop() {
      stopped = true;
      timers.forEach(clearInterval);
    },
  };
}
