import { describe, expect, it } from 'vitest';
import { DEFAULT_SIM, simulateEconomy } from '../simulate.js';

describe('simulateEconomy', () => {
  it('is repeatable for one seed', () => {
    expect(simulateEconomy({ ...DEFAULT_SIM, players: 200 })).toEqual(simulateEconomy({ ...DEFAULT_SIM, players: 200 }));
  });
  it('keeps launch defaults under the 2% stuck target', () => {
    expect(simulateEconomy().stuckPercent).toBeLessThan(2);
  });
  it('stucks more players when nobody wins', () => {
    const base = simulateEconomy({ ...DEFAULT_SIM, players: 500 });
    const worse = simulateEconomy({ ...DEFAULT_SIM, players: 500, winRate: 0, drawRate: 0 });
    expect(worse.median).toBeLessThan(base.median);
  });
});

describe('balance report', () => {
  it.runIf(process.env.PRINT_ECONOMY === '1')('prints the numbers for docs/logic/economy.md', () => {
    console.log(JSON.stringify(simulateEconomy()));
  });
});
