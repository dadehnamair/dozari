import { isGatewayDown } from './http';

/** Waits before the 1st and 2nd retry of a start that hit a downed gateway (a restarting server is usually back within seconds). */
export const START_RETRY_DELAYS_MS: readonly number[] = [1000, 2500];

/** Runs a game start again after a bare gateway 502/503/504: the request never reached the app, so nothing was created. Other failures pass straight through. */
export async function withGatewayRetry<T>(run: () => Promise<T>, delays: readonly number[] = START_RETRY_DELAYS_MS, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const wait = delays[attempt];
      if (wait === undefined || !isGatewayDown(err)) throw err;
      await sleep(wait);
    }
  }
}
