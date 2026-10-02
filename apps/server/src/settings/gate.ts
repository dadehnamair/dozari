import type { SettingsService } from './service.js';

export interface GateVerdict {
  error: 'maintenance' | 'feature_off';
  message?: string;
}

/** Paths that keep working in maintenance mode: health checks, the client config, the admin panel and static images. */
const ALWAYS_OPEN = ['/health', '/config', '/admin', '/images'];

const FEATURE_OF: [prefix: string, setting: string][] = [
  ['/lookup', 'feature.lookup'],
  ['/friends', 'feature.friends'],
  ['/players', 'feature.friends'],
  ['/inbox', 'feature.inbox'],
  ['/bale', 'feature.bale'],
  ['/shop', 'feature.shop'],
  ['/chat', 'feature.chat'],
  ['/transfers', 'feature.friends'],
  ['/loans', 'feature.friends'],
];

/** Admin kill switches (maintenance mode, feature flags) applied to an HTTP path; null = let it through. */
export async function gateForPath(settings: SettingsService, path: string): Promise<GateVerdict | null> {
  if (ALWAYS_OPEN.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  if ((await settings.num('app.maintenance_on')) === 1) return { error: 'maintenance', message: await settings.text('app.maintenance_message') };
  const feature = /^\/solo\/[^/]+\/hints?$/.test(path) ? (['', 'feature.shop'] as [string, string]) : FEATURE_OF.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (feature && (await settings.num(feature[1])) !== 1) return { error: 'feature_off' };
  return null;
}

/** Same switches for the live duel queue. */
export async function gateForDuel(settings: SettingsService): Promise<'MAINTENANCE' | 'FEATURE_OFF' | null> {
  if ((await settings.num('app.maintenance_on')) === 1) return 'MAINTENANCE';
  return (await settings.num('feature.duel')) === 1 ? null : 'FEATURE_OFF';
}
