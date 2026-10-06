import { describe, expect, it } from 'vitest';
import type { ShopItem } from '@dozari/shared';
import { actionFor, cosmeticsOf, isTrying, previewWorn, shownIn, toggleTry } from '../tryOn';

let n = 0;
const item = (o: Partial<ShopItem>): ShopItem => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, titleFa: 'x', descriptionFa: '', effect: 'cosmetic', amount: 1, currency: 'coins', priceCoins: 100, priceGems: 0, priceToman: 0,
  minLevel: 1, iconKey: 'crown', slot: 'hat', owned: false, equipped: false, blocked: null, leftToday: null, rotating: false, ...o,
});

const crown = item({ iconKey: 'crown', slot: 'hat', owned: true, equipped: true });
const beanie = item({ iconKey: 'beanie', slot: 'hat' });
const round = item({ iconKey: 'glassesRound', slot: 'glasses', owned: true });
const hint = item({ effect: 'hint_token', slot: null, iconKey: 'magnifier' });
const all = [crown, beanie, round, hint];

describe('fitting room try-on', () => {
  it('only treats slotted cosmetics as character items', () => {
    expect(cosmeticsOf(all)).toEqual([crown, beanie, round]);
  });

  it('shows what is really worn until something is tried', () => {
    expect(previewWorn(all, {})).toEqual([{ slot: 'hat', iconKey: 'crown' }]);
  });

  it('tries an item on top of the worn one and takes it off on a second tap', () => {
    const t1 = toggleTry(all, {}, beanie);
    expect(shownIn(all, t1, 'hat')).toBe(beanie.id);
    expect(previewWorn(all, t1)).toEqual([{ slot: 'hat', iconKey: 'beanie' }]);
    const t2 = toggleTry(all, t1, beanie);
    expect(shownIn(all, t2, 'hat')).toBeNull();
    expect(previewWorn(all, t2)).toEqual([]);
    expect(isTrying(t2)).toBe(true);
    expect(isTrying({})).toBe(false);
  });

  it('a second tap on the worn item also bares the slot, other slots are untouched', () => {
    const t = toggleTry(all, toggleTry(all, {}, round), crown);
    expect(previewWorn(all, t)).toEqual([{ slot: 'glasses', iconKey: 'glassesRound' }]);
  });

  it('ignores items without a slot', () => {
    expect(toggleTry(all, {}, hint)).toEqual({});
  });

  it('picks the main button', () => {
    expect(actionFor(crown)).toBe('takeOff');
    expect(actionFor(round)).toBe('wear');
    expect(actionFor(beanie)).toBe('buy');
    expect(actionFor(item({ priceCoins: 0 }))).toBe('free');
    expect(actionFor(item({ currency: 'gems', priceGems: 12, priceCoins: 0 }))).toBe('buy');
    expect(actionFor(item({ blocked: 'LEVEL' }))).toBe('locked');
  });
});
