import { describe, expect, it } from 'vitest';
import { TABLE_MIN_ROUNDS_DEFAULT, TABLE_ROUNDS_MAX } from '@dozari/shared';
import { setTableRules, tableMinRounds } from '../tableRules';

describe('tableMinRounds', () => {
  it('starts at the default, follows the setting and ignores nonsense', () => {
    expect(tableMinRounds()).toBe(TABLE_MIN_ROUNDS_DEFAULT);
    setTableRules({ 'table.min_rounds': 1 });
    expect(tableMinRounds()).toBe(1);
    setTableRules({ 'table.min_rounds': 99 });
    expect(tableMinRounds()).toBe(TABLE_ROUNDS_MAX);
    setTableRules({ 'table.min_rounds': 'x' });
    expect(tableMinRounds()).toBe(TABLE_MIN_ROUNDS_DEFAULT);
  });
});
