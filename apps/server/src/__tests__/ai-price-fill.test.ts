import { describe, expect, it } from 'vitest';
import { buildPriceFillPrompt, parsePriceFill, priceFillRequestSchema } from '../ai/price-fill.js';

const req = priceFillRequestSchema.parse({ provider: 'openai', productId: 'p1' });

describe('price fill', () => {
  it('names the existing years and the default range in the prompt', () => {
    const p = buildPriceFillPrompt({ nameFa: 'نان سنگک', unitFa: 'عدد', years: [1375, 1390] }, req);
    expect(p.user).toContain('1375, 1390');
    expect(p.years).toEqual({ from: 1350, to: 1405 });
  });

  it('keeps only valid, new, in-range years, ascending, and counts the rest as dropped', () => {
    const text = '```json\n{"prices":[{"year":1380,"priceToman":50},{"year":1375,"priceToman":20},{"year":1380,"priceToman":60},{"year":1300,"priceToman":5},{"year":1385,"priceToman":1.5},{"year":1390,"priceToman":900}]}\n```';
    const out = parsePriceFill(text, [1390], { from: 1350, to: 1405 });
    expect(out?.prices).toEqual([{ year: 1375, priceToman: 20 }, { year: 1380, priceToman: 50 }]);
    expect(out?.dropped).toBe(4);
  });

  it('returns null for an unreadable answer', () => {
    expect(parsePriceFill('sorry', [], { from: 1350, to: 1405 })).toBeNull();
  });
});
