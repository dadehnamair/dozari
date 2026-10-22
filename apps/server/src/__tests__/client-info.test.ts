import { describe, expect, it } from 'vitest';
import { createClientRecorder, parseClientInfo } from '../clients/info.js';
import type { ClientInfo } from '../clients/info.js';

describe('client info', () => {
  it('parses the app headers and ignores junk', () => {
    expect(parseClientInfo({ 'x-client-platform': 'android', 'x-client-os': '14', 'x-client-build': '27', 'x-client-store': 'myket' })).toEqual({ platform: 'android', osVersion: '14', appBuild: 27, store: 'myket', pwa: false, src: null });
    expect(parseClientInfo({ 'x-client-platform': 'web', 'x-client-store': 'evil', 'x-client-build': 'abc', 'x-client-os': '<script>' })).toEqual({ platform: 'web', osVersion: null, appBuild: null, store: null, pwa: false, src: null });
    expect(parseClientInfo({ 'x-client-platform': 'web', 'x-client-pwa': '1' })?.pwa).toBe(true);
    expect(parseClientInfo({ 'x-client-platform': 'android', 'x-client-pwa': '1' })?.pwa).toBe(false); // only the web build can be a PWA
    expect(parseClientInfo({})).toBeNull();
    expect(parseClientInfo({ 'x-client-platform': 'toaster' })).toBeNull();
  });

  it('reads a bot-group link source and ignores anything else', () => {
    expect(parseClientInfo({ 'x-client-platform': 'web', 'x-client-src': 'gk3f9x2' })?.src).toBe('gk3f9x2');
    expect(parseClientInfo({ 'x-client-platform': 'web', 'x-client-src': 'evil<script>' })?.src).toBeNull();
    expect(parseClientInfo({ 'x-client-platform': 'web', 'x-client-src': 'xk3f9x2' })?.src).toBeNull();
    expect(parseClientInfo({ 'x-client-platform': 'web' })?.src).toBeNull();
  });

  it('writes once per half hour unless something changed', async () => {
    const writes: ClientInfo[] = [];
    let t = 0;
    const rec = createClientRecorder({ record: async (_id, i) => void writes.push(i) }, () => t);
    const a: ClientInfo = { platform: 'android', osVersion: '14', appBuild: 1, store: null, pwa: false, src: null };
    await rec('u', a);
    await rec('u', a);
    expect(writes).toHaveLength(1);
    await rec('u', { ...a, appBuild: 2 });
    expect(writes).toHaveLength(2);
    t = 31 * 60_000;
    await rec('u', { ...a, appBuild: 2 });
    expect(writes).toHaveLength(3);
  });
});
