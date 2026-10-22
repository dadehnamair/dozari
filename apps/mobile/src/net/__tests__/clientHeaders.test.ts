import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientHeaders } from '../clientHeaders';

describe('clientHeaders link source', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the bot-group source the mini-app bridge kept, and nothing for a malformed one', () => {
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'dozari_src' ? 'gk3f9x2m' : null) });
    expect(clientHeaders()['x-client-src']).toBe('gk3f9x2m');
    vi.stubGlobal('localStorage', { getItem: () => '<script>' });
    expect(clientHeaders()['x-client-src']).toBe('');
  });

  it('survives storage that throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); } });
    expect(clientHeaders()['x-client-src']).toBe('');
  });
});
