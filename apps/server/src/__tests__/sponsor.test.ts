import { describe, expect, it } from 'vitest';
import { accentColorSchema, isHttpsUrl } from '@dozari/shared';
import { createMemorySponsorStore } from '../sponsor/store.js';
import { TournamentService } from '../tournament/service.js';
import type { TournamentInput } from '../tournament/service.js';
import { createMemoryTournamentStore } from '../tournament/store.js';

const NOW = Date.UTC(2026, 9, 5, 12);
const sponsorInput = { nameFa: 'نان‌وایی ستاره', taglineFa: 'تازه‌ترین نان شهر', descriptionFa: 'از ۱۳۴۰ نان تازه می‌پزیم.', bannerUrl: 'https://cdn.example.ir/b.png', logoUrl: 'https://cdn.example.ir/l.png', linkUrl: 'https://example.ir', accent: '#FFAA7A', isActive: true };

function boot() {
  const sponsors = createMemorySponsorStore();
  const service = new TournamentService(createMemoryTournamentStore(), {
    levelOf: async () => 5,
    profileOf: async () => ({ nickname: 'x', avatarKey: 'avatar-01' }),
    startMatch: async () => true,
    inMatch: () => false,
    sponsorOf: (id) => sponsors.get(id),
    now: () => NOW,
  });
  const input = (over: Partial<TournamentInput> = {}): TournamentInput => ({ titleFa: 'جام مهر', descriptionFa: '', iconKey: 'trophy', size: 4, minPlayers: 2, entryCoins: 0, minLevel: 1, startsAt: NOW + 3_600_000, prizes: [], ...over });
  return { sponsors, service, input };
}

describe('tournament sponsors', () => {
  it('shows the sponsor in full on the page and in short on the list', async () => {
    const t = boot();
    const sp = await t.sponsors.create(sponsorInput);
    const made = await t.service.create(t.input({ sponsorId: sp.id }), true);
    if (!made.ok) throw new Error('create failed');
    const list = await t.service.list('u1');
    expect(list[0]!.sponsor).toEqual({ id: sp.id, nameFa: 'نان‌وایی ستاره', logoUrl: 'https://cdn.example.ir/l.png' });
    const detail = await t.service.detail('u1', made.id);
    expect(detail?.sponsor).toMatchObject({ id: sp.id, bannerUrl: 'https://cdn.example.ir/b.png', linkUrl: 'https://example.ir', accent: '#FFAA7A' });
    expect(detail?.sponsor).not.toHaveProperty('isActive');
  });

  it('rejects an unknown or switched-off sponsor when choosing one', async () => {
    const t = boot();
    expect((await t.service.create(t.input({ sponsorId: '00000000-0000-7000-c000-0000000000ff' }), true)).ok).toBe(false);
    const off = await t.sponsors.create({ ...sponsorInput, isActive: false });
    expect((await t.service.create(t.input({ sponsorId: off.id }), true)).ok).toBe(false);
  });

  it('hides a sponsor that was switched off later, and an update can clear or change it', async () => {
    const t = boot();
    const a = await t.sponsors.create(sponsorInput);
    const b = await t.sponsors.create({ ...sponsorInput, nameFa: 'عطاری گل‌سرخ' });
    const made = await t.service.create(t.input({ sponsorId: a.id }), true);
    if (!made.ok) throw new Error('create failed');
    await t.sponsors.update(a.id, { isActive: false });
    expect((await t.service.detail('u1', made.id))?.sponsor).toBeNull();
    expect((await t.service.update(made.id, { sponsorId: b.id })).ok).toBe(true);
    expect((await t.service.detail('u1', made.id))?.sponsor?.nameFa).toBe('عطاری گل‌سرخ');
    expect((await t.service.update(made.id, { sponsorId: null })).ok).toBe(true);
    expect((await t.service.detail('u1', made.id))?.sponsor).toBeNull();
  });

  it('a tournament without a sponsor has none', async () => {
    const t = boot();
    const made = await t.service.create(t.input(), true);
    if (!made.ok) throw new Error('create failed');
    expect((await t.service.detail('u1', made.id))?.sponsor).toBeNull();
  });
});

describe('sponsor field rules', () => {
  it('accepts only https links and #RRGGBB colours', () => {
    expect(isHttpsUrl('https://example.ir/a.png')).toBe(true);
    for (const bad of ['http://example.ir', 'javascript:alert(1)', 'ftp://x.ir', 'not a url', '']) expect(isHttpsUrl(bad)).toBe(false);
    expect(accentColorSchema.safeParse('#FFAA7A').success).toBe(true);
    expect(accentColorSchema.safeParse('red').success).toBe(false);
  });
});
