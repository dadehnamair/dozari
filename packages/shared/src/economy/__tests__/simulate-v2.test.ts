import { describe, expect, it } from 'vitest';
import { BASELINE_SIM_V2, DEFAULT_SIM_V2, simulateEconomyV2 } from '../simulate-v2.js';

const small = { players: 400, days: 56 };

describe('simulateEconomyV2', () => {
  it('is repeatable for one seed', () => {
    expect(simulateEconomyV2({ ...DEFAULT_SIM_V2, ...small })).toEqual(simulateEconomyV2({ ...DEFAULT_SIM_V2, ...small }));
  });
  it('v2 sinks and cap pull the balance and the faucet/sink ratio below the old economy', () => {
    const old = simulateEconomyV2({ ...BASELINE_SIM_V2, ...small });
    const v2 = simulateEconomyV2({ ...DEFAULT_SIM_V2, ...small });
    expect(v2.median).toBeLessThan(old.median);
    expect(v2.ratio).toBeLessThan(old.ratio);
  });
  it('keeps nobody stuck', () => {
    expect(simulateEconomyV2({ ...DEFAULT_SIM_V2, ...small }).stuckPercent).toBeLessThan(2);
  });
});

describe('sensitivity v2', () => {
  it.runIf(process.env.PRINT_ECONOMY === '1')('prints how the plateau moves with spending appetite and the free payout', () => {
    const rows: Record<string, unknown>[] = [];
    for (const appetite of [1, 0.5, 0.25]) {
      for (const free of [50, 25, 0]) {
        const r = simulateEconomyV2({
          ...DEFAULT_SIM_V2,
          players: 1000,
          freePayoutPercent: free,
          shopAppetite: DEFAULT_SIM_V2.shopAppetite * appetite,
          pieceAppetite: DEFAULT_SIM_V2.pieceAppetite * appetite,
          shieldAppetite: DEFAULT_SIM_V2.shieldAppetite * appetite,
        });
        rows.push({ appetite, freePayout: free, median: r.median, wk4: r.medianByWeek[3], wk12: r.medianByWeek[11], ratio: r.ratio, stuck: +r.stuckPercent.toFixed(2) });
      }
    }
    console.table(rows);
  });
});

describe('balance report v2', () => {
  it.runIf(process.env.PRINT_ECONOMY === '1')('prints baseline and v2', () => {
    console.log(JSON.stringify({ baseline: simulateEconomyV2(BASELINE_SIM_V2), v2: simulateEconomyV2() }, null, 1));
  });
});
