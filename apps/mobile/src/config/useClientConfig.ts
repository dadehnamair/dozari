import { useEffect, useState } from 'react';
import { callJson } from '../net/http';
import { installAnalytics } from './analytics';
import { setChartRules } from './chartRules';
import { OPEN_CONFIG, parseClientConfig } from './gate';
import type { ClientConfig } from './gate';

const REFRESH_MS = 5 * 60_000;

/** Loads the admin-editable public config at start and every few minutes; a failure keeps the last known (initially open) config. */
export function useClientConfig(): ClientConfig {
  const [cfg, setCfg] = useState<ClientConfig>(OPEN_CONFIG);
  useEffect(() => {
    let live = true;
    const load = () =>
      callJson('/config', 'GET').then(
        (body) => {
          const settings = (body as { settings?: Record<string, unknown> }).settings ?? {};
          setChartRules(settings);
          installAnalytics(settings);
          if (live) setCfg(parseClientConfig(settings, (body as { phoneLogin?: unknown }).phoneLogin === true));
        },
        () => undefined,
      );
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return cfg;
}
