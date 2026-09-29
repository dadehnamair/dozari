import { describe, expect, it } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { pricePoints, products } from '../schema.js';

describe('schema', () => {
  it('names tables per data-model.md', () => {
    expect(getTableName(products)).toBe('products');
    expect(getTableName(pricePoints)).toBe('price_points');
  });
});
