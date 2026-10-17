import { describe, expect, it } from 'vitest';
import { installChannel } from '../admin/usage-stats.js';
import { createBazaarMonitor, parseBazaarAnswer } from '../admin/bazaar-monitor.js';

describe('installChannel', () => {
  it('names the channel of a device row', () => {
    expect(installChannel('android', false, 'bazaar')).toBe('bazaar');
    expect(installChannel('android', false, 'myket')).toBe('myket');
    expect(installChannel('android', false, 'bale')).toBe('bale');
    expect(installChannel('android', false, null)).toBe('direct_android');
    expect(installChannel('android', false, '')).toBe('direct_android');
    expect(installChannel('ios', false, null)).toBe('ios');
    expect(installChannel('web', true, null)).toBe('pwa');
    expect(installChannel('web', false, null)).toBe('web');
  });
});

describe('Bazaar Pishkhan monitor', () => {
  const published = { type: 'success', release: { creation_date: '2026-10-01T10:00:00', packages: [{ version_code: 7, version_name: '1.2.0', apk_size: 1234, api_level: 24, target_api_level: 35, upload_date: '2026-10-01', cpu_architectures: '' }], auto_publish: false, staged_rollout_percentage: 100, changelog_fa: 'تازه', changelog_en: '' } };

  it('reads a release and the not-exists / error answers', () => {
    const r = parseBazaarAnswer(200, published);
    expect(r.release?.packages[0]).toMatchObject({ versionCode: 7, versionName: '1.2.0', targetApiLevel: 35 });
    expect(r.release?.stagedRolloutPercentage).toBe(100);
    expect(parseBazaarAnswer(200, { type: 'not-exists' })).toEqual({ release: null, error: null });
    expect(parseBazaarAnswer(403, { type: 'access_forbidden' }).error).toMatch(/توکن/);
    expect(parseBazaarAnswer(429, {}).error).toBeTruthy();
    expect(parseBazaarAnswer(200, 'junk')).toEqual({ release: null, error: null });
  });

  it('asks only the three read endpoints with the token, and caches the answer', async () => {
    const calls: { url: string; secret: string | undefined }[] = [];
    const fetchImpl = (async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, secret: init.headers['CAFEBAZAAR-PISHKHAN-API-SECRET'] });
      return new Response(JSON.stringify(published), { status: 200 });
    }) as unknown as typeof fetch;
    let t = 1000;
    const monitor = createBazaarMonitor({ token: 'tok', fetchImpl, now: () => t, ttlMs: 60_000 });
    const s = await monitor.status();
    expect(s.configured).toBe(true);
    expect(calls.map((c) => c.url.split('/releases/')[1]).sort()).toEqual(['last-committed/', 'last-published/', 'last-uncommitted/']);
    expect(calls.every((c) => c.secret === 'tok')).toBe(true);
    await monitor.status();
    expect(calls).toHaveLength(3);
    t += 61_000;
    await monitor.status();
    expect(calls).toHaveLength(6);
  });

  it('is simply unconfigured without a token and never calls out', async () => {
    const fetchImpl = (async () => { throw new Error('no call expected'); }) as unknown as typeof fetch;
    expect(await createBazaarMonitor({ token: undefined, fetchImpl }).status()).toMatchObject({ configured: false });
  });
});
