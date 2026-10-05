import { describe, expect, it } from 'vitest';
import { createClientRecorder, parseClientInfo } from '../clients/info.js';
import type { ClientInfo } from '../clients/info.js';

describe('client info', () => {
  it('parses the app headers and ignores junk', () => {
    expect(parseClientInfo({ 'x-client-platform': 'android', 'x-client-os': '14', 'x-client-build': '27', 'x-client-store': 'myket' })).toEqual({ platform: 'android', osVersion: '14', appBuild: 27, store: 'myket' });
    expect(parseClientInfo({ 'x-client-platform': 'web', 'x-client-store': 'evil', 'x-client-build': 'abc', 'x-client-os': '<script>' })).toEqual({ platform: 'web', osVersion: null, appBuild: null, store: null });
    expect(parseClientInfo({})).toBeNull();
    expect(parseClientInfo({ 'x-client-platform': 'toaster' })).toBeNull();
  });

  it('writes once per half hour unless something changed', async () => {
    const writes: ClientInfo[] = [];
    let t = 0;
    const rec = createClientRecorder({ record: async (_id, i) => void writes.push(i) }, () => t);
    const a: ClientInfo = { platform: 'android', osVersion: '14', appBuild: 1, store: null };
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
