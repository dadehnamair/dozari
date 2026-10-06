import { describe, expect, it } from 'vitest';
import { SHOWCASE_MAX } from '@dozari/shared';
import type { KeepsakeView } from '@dozari/shared';
import { actionOf, pinnedIds, priceOf, sections, togglePin } from '../model';

const view = (o: Partial<KeepsakeView>): KeepsakeView => ({
  id: '00000000-0000-4000-8000-000000000001', titleFa: 'x', storyFa: 's', eraYear: null, rarity: 'common', pieces: 4, owned: [], complete: false, level: 0, artKey: null, iconKey: null, setId: null, piecePrice: 60, upgradePrice: null, rewardGems: 3, showcaseSlot: null, ...o,
});
const S1 = '00000000-0000-4000-8000-0000000000a1';

describe('keepsake model', () => {
  it('groups by set and keeps the loose ones last; empty sets vanish', () => {
    const items = [view({ id: 'a', setId: S1 }), view({ id: 'b' }), view({ id: 'c', setId: S1, complete: true })];
    const sets = [{ id: S1, titleFa: 'زنگ تفریح', total: 2, completed: 1, rewardGems: 10 }, { id: '00000000-0000-4000-8000-0000000000a2', titleFa: 'خالی', total: 0, completed: 0, rewardGems: 5 }];
    const s = sections({ items, sets }, 'متفرقه');
    expect(s.map((x) => [x.title, x.items.map((i) => i.id)])).toEqual([['زنگ تفریح', ['a', 'c']], ['متفرقه', ['b']]]);
    expect(s[0]).toMatchObject({ completed: 1, total: 2 });
  });
  it('picks the button action and its price', () => {
    expect(actionOf(view({}))).toBe('buy');
    expect(priceOf(view({ piecePrice: 240 }))).toBe(240);
    expect(actionOf(view({ complete: true, upgradePrice: 150 }))).toBe('upgrade');
    expect(priceOf(view({ complete: true, piecePrice: 0, upgradePrice: 150 }))).toBe(150);
    expect(actionOf(view({ complete: true, upgradePrice: null }))).toBe('max');
  });
  it('pins in order, unpins, and stops at the maximum', () => {
    expect(togglePin(['a'], 'b')).toEqual(['a', 'b']);
    expect(togglePin(['a', 'b'], 'a')).toEqual(['b']);
    const full = Array.from({ length: SHOWCASE_MAX }, (_, i) => `k${i}`);
    expect(togglePin(full, 'new')).toEqual(full);
  });
  it('reads the showcase order from the slots', () => {
    expect(pinnedIds([view({ id: 'a', showcaseSlot: 2 }), view({ id: 'b', showcaseSlot: 1 }), view({ id: 'c' })])).toEqual(['b', 'a']);
  });
});
