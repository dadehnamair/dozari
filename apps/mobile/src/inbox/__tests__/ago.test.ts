import { describe, expect, it } from 'vitest';
import { agoText } from '../ago';

describe('agoText', () => {
  const now = 10 * 86_400_000;
  it('words the age of a message', () => {
    expect(agoText(now - 5_000, now)).toBe('همین الان');
    expect(agoText(now + 5_000, now)).toBe('همین الان');
    expect(agoText(now - 2 * 60_000, now)).toBe('۲ دقیقه');
    expect(agoText(now - 3 * 3_600_000, now)).toBe('۳ ساعت');
    expect(agoText(now - 30 * 3_600_000, now)).toBe('دیروز');
    expect(agoText(now - 3 * 86_400_000, now)).toBe('۳ روز');
  });
});
