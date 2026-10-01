import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { RateLimiter } from '../security/rate-limit.js';
import { assertPublicHttpUrl, isHttpUrl, isPrivateAddress } from '../security/url-guard.js';
import { checkProductionConfig } from '../security/config.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import { httpFetcher } from '../bot/service.js';

const TOKEN = 'secret-admin-token-0123456789';
const admin = { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' as const }, token: TOKEN };

describe('RateLimiter', () => {
  it('allows max hits per window, then blocks until the window ends', () => {
    let t = 0;
    const rl = new RateLimiter(3, 1000, () => t);
    expect([rl.take('a'), rl.take('a'), rl.take('a'), rl.take('a')]).toEqual([true, true, true, false]);
    expect(rl.blocked('a')).toBe(true);
    expect(rl.retryAfterSec('a')).toBe(1);
    expect(rl.take('b')).toBe(true);
    t = 1001;
    expect(rl.blocked('a')).toBe(false);
    expect(rl.take('a')).toBe(true);
  });
});

describe('url guard (SSRF)', () => {
  it('knows private and public addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it('accepts public http(s) hosts and rejects the rest', async () => {
    const resolve = async (h: string) => (h === 'internal.example' ? ['10.0.0.5'] : h === 'mixed.example' ? ['8.8.8.8', '127.0.0.1'] : h === 'gone.example' ? [] : ['93.184.216.34']);
    await expect(assertPublicHttpUrl('https://example.com/prices', resolve)).resolves.toBeInstanceOf(URL);
    for (const bad of ['file:///etc/passwd', 'ftp://example.com', 'http://127.0.0.1/', 'http://[::1]/', 'http://internal.example/', 'http://mixed.example/', 'http://gone.example/', 'https://user:pw@example.com/', 'not a url']) {
      await expect(assertPublicHttpUrl(bad, resolve), bad).rejects.toThrow();
    }
  });
  it('httpFetcher refuses loopback before any request is made', async () => {
    await expect(httpFetcher('http://127.0.0.1:9/')).rejects.toThrow('private address');
  });
  it('isHttpUrl blocks javascript: and data: links', () => {
    expect(isHttpUrl('https://a.ir/x')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,x')).toBe(false);
  });
});

describe('production config check', () => {
  it('is silent outside production', () => expect(checkProductionConfig({ ADMIN_TOKEN: 'dev-admin' })).toEqual({ fatal: [], warn: [] }));
  it('refuses weak secrets in production and warns about open CORS', () => {
    const bad = checkProductionConfig({ NODE_ENV: 'production', JWT_SECRET: 'short', ADMIN_TOKEN: 'dev-admin', CORS_ORIGIN: '*' });
    expect(bad.fatal).toHaveLength(2);
    expect(bad.warn.join()).toContain('CORS_ORIGIN');
    const ok = checkProductionConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), ADMIN_TOKEN: 'y'.repeat(30), DATABASE_URL: 'mysql://x' });
    expect(ok).toEqual({ fatal: [], warn: [] });
  });
});

describe('HTTP hardening', () => {
  it('sends security headers and a nonce-based CSP on the admin page', async () => {
    const app = buildServer({ admin });
    const res = await app.inject({ method: 'GET', url: '/admin' });
    const csp = String(res.headers['content-security-policy']);
    const nonce = /nonce-([A-Za-z0-9+/=]+)/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
    expect(res.body).toContain(`<script nonce="${nonce}">`);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['cache-control']).toBe('no-store');
    const again = await app.inject({ method: 'GET', url: '/admin' });
    expect(String(again.headers['content-security-policy'])).not.toContain(nonce!); // fresh nonce each time
    const json = await app.inject({ method: 'GET', url: '/health' });
    expect(json.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('locks the admin API after 10 wrong tokens', async () => {
    const app = buildServer({ admin });
    for (let i = 0; i < 10; i++) expect((await app.inject({ method: 'GET', url: '/admin/catalog', headers: { 'x-admin-token': 'wrong' } })).statusCode).toBe(401);
    const locked = await app.inject({ method: 'GET', url: '/admin/catalog', headers: { 'x-admin-token': TOKEN } });
    expect(locked.statusCode).toBe(429);
    expect(locked.headers['retry-after']).toBeTruthy();
  });

  it('rate limits account creation per IP', async () => {
    const { AuthService } = await import('../auth/service.js');
    const { createTokenSigner } = await import('../auth/tokens.js');
    const repo = { findByDeviceId: async () => null, findById: async () => null, createGuest: async (d: string, i: { nickname: string; avatarKey: string }) => ({ id: d, ...i, isBanned: false }), touch: async () => {} };
    const app = buildServer({ auth: new AuthService(repo, createTokenSigner('a-test-secret-that-is-long-enough')) });
    const codes: number[] = [];
    for (let i = 0; i < 22; i++) codes.push((await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `0f8fad5b-d9cb-469f-a165-7086772895${String(i).padStart(2, '0')}` } })).statusCode);
    expect(codes.slice(0, 20).every((c) => c === 200)).toBe(true);
    expect(codes.slice(20)).toEqual([429, 429]);
  });

  it('rejects oversized bodies and hides internal errors', async () => {
    const app = buildServer({ admin, adminModules: { audit: createMemoryAuditLog() } });
    const big = await app.inject({ method: 'POST', url: '/admin/words', headers: { 'x-admin-token': TOKEN, 'content-type': 'application/json' }, payload: JSON.stringify({ text: 'x'.repeat(70_000) }) });
    expect(big.statusCode).toBe(413);
    expect(big.json()).toEqual({ error: 'payload_too_large' });
    const boom = buildServer({ admin: { ...admin, repo: { listCatalog: async () => { throw new Error('secret db detail'); }, setPriceStatus: async () => 'ok' as const } } });
    const res = await boom.inject({ method: 'GET', url: '/admin/catalog', headers: { 'x-admin-token': TOKEN } });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret db detail');
    expect(res.json()).toEqual({ error: 'internal' });
  });

  it('refuses javascript: links as price sources and bot source urls', async () => {
    const products = { details: async () => ({}), update: async () => 'ok' as const, create: async () => ({ id: 'x' }), addPrice: async () => ({ id: 'x' }) };
    const app = buildServer({ admin, adminModules: { products } });
    const price = { productId: '0190a000-0000-7000-8000-000000000001', year: 1375, priceRials: '1000', sourceType: 'other', confidence: 2 };
    const h = { 'x-admin-token': TOKEN };
    expect((await app.inject({ method: 'POST', url: '/admin/prices', headers: h, payload: { ...price, sourceUrl: 'javascript:alert(1)' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/admin/prices', headers: h, payload: { ...price, sourceUrl: 'https://example.com/a' } })).statusCode).toBe(201);
  });
});
