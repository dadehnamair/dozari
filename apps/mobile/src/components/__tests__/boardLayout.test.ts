import { describe, expect, it } from 'vitest';
import { cellWidth } from '../boardLayout.js';

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
