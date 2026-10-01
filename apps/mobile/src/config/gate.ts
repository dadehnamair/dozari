/** What the server's public config (`GET /config`, admin-editable) means for this client. Pure so it can be tested. */
export interface ClientConfig {
  maintenance: { on: boolean; message: string };
  minBuild: number;
  updateUrl: string;
  features: { lookup: boolean; duel: boolean; friends: boolean; inbox: boolean; bale: boolean; shop: boolean };
  /** All public settings as sent, for features that read their own keys (e.g. the review prompt). */
  raw: Record<string, unknown>;
}

/** Everything open: used until the config arrives and whenever it cannot be fetched (a network error never locks players out). */
export const OPEN_CONFIG: ClientConfig = {
  maintenance: { on: false, message: '' },
  minBuild: 0,
  updateUrl: '',
  features: { lookup: true, duel: true, friends: true, inbox: true, bale: true, shop: true },
  raw: {},
};

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const flag = (v: unknown, fallback: boolean) => (typeof v === 'number' ? v === 1 : fallback);

export function parseClientConfig(settings: Record<string, unknown>): ClientConfig {
  return {
    maintenance: { on: flag(settings['app.maintenance_on'], false), message: str(settings['app.maintenance_message']) },
    minBuild: num(settings['app.min_build'], 0),
    updateUrl: str(settings['app.update_url']),
    features: {
      lookup: flag(settings['feature.lookup'], true),
      duel: flag(settings['feature.duel'], true),
      friends: flag(settings['feature.friends'], true),
      inbox: flag(settings['feature.inbox'], true),
      bale: flag(settings['feature.bale'], true),
      shop: flag(settings['feature.shop'], true),
    },
    raw: settings,
  };
}

export type GateState = 'ok' | 'maintenance' | 'update';

/** Maintenance wins over a forced update (nobody can update the server's mood). */
export function gateState(cfg: ClientConfig, build: number): GateState {
  if (cfg.maintenance.on) return 'maintenance';
  return build < cfg.minBuild ? 'update' : 'ok';
}
