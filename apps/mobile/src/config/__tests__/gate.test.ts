import { describe, expect, it } from 'vitest';
import { OPEN_CONFIG, gateState, parseClientConfig } from '../gate';

describe('client config gate', () => {
  it('is open for an empty or broken config', () => {
    expect(parseClientConfig({})).toEqual(OPEN_CONFIG);
    expect({ ...parseClientConfig({ 'app.min_build': 'x', 'feature.duel': 'yes' }), raw: {} }).toEqual(OPEN_CONFIG);
    expect(gateState(OPEN_CONFIG, 1)).toBe('ok');
  });

  it('reads maintenance, minimum build, update link and feature flags', () => {
    const cfg = parseClientConfig({ 'app.maintenance_on': 1, 'app.maintenance_message': 'تعمیر', 'app.min_build': 5, 'app.update_url': 'https://x.ir', 'feature.lookup': 0, 'feature.duel': 1 });
    expect(cfg.maintenance).toEqual({ on: true, message: 'تعمیر' });
    expect(cfg.minBuild).toBe(5);
    expect(cfg.updateUrl).toBe('https://x.ir');
    expect(cfg.features).toMatchObject({ lookup: false, duel: true, friends: true });
  });

  it('maintenance beats the forced update; an old build is told to update', () => {
    expect(gateState(parseClientConfig({ 'app.maintenance_on': 1, 'app.min_build': 9 }), 1)).toBe('maintenance');
    expect(gateState(parseClientConfig({ 'app.min_build': 9 }), 8)).toBe('update');
    expect(gateState(parseClientConfig({ 'app.min_build': 9 }), 9)).toBe('ok');
  });
});
