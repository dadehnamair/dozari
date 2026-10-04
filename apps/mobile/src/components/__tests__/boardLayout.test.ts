import { describe, expect, it } from 'vitest';
import { CARD_PAD, NAME_FLOOR, cardMetrics, cellWidth } from '../boardLayout.js';

describe('cellWidth', () => {
  it('fits four cards and three gaps into the board', () => {
    const w = cellWidth(358, 8, 4);
    expect(w * 4 + 8 * 3).toBeLessThanOrEqual(358);
    expect(w * 4 + 8 * 3).toBeGreaterThan(358 - 4);
  });
  it('is 0 before the board is measured', () => {
    expect(cellWidth(0, 8, 4)).toBe(0);
  });
});

describe('cardMetrics', () => {
  it.each([[76], [82], [90], [100], [120]])('keeps icon, name and unit inside a %ipx card', (w) => {
    const m = cardMetrics(w);
    const content = m.icon + Math.ceil(m.nameSize * 1.4) * 2 + Math.ceil(m.unitSize * 1.4);
    expect(content).toBeLessThanOrEqual(m.height - CARD_PAD);
    expect(m.nameSize).toBeGreaterThanOrEqual(NAME_FLOOR);
    expect(m.nameSize).toBeLessThanOrEqual(14);
  });
  it('never drops the icon below its floor', () => {
    expect(cardMetrics(40).icon).toBeGreaterThanOrEqual(22);
  });
});
