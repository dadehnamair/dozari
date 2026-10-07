import { Platform } from 'react-native';
import type { ClientErrorKind } from '@dozari/shared';
import { session } from '../auth';
import { APP_BUILD, APP_STORE } from '../config/build';
import { BASE_URL } from '../net/http';
import { clientHeaders } from '../net/clientHeaders';
import { crumbs, currentScreen } from './breadcrumbs';
import { captureScreen } from './screenshot';

export interface ErrorReport {
  kind: ClientErrorKind;
  message: string;
  detail?: string;
  /** What the player wrote (manual reports). */
  note?: string;
  /** Overrides the screen name the app last announced. */
  screen?: string;
  /** A screenshot taken earlier (a crash is photographed before its screen goes away); otherwise one is taken now. */
  screenshot?: string | null;
}

/** The facts about the device that help to reproduce a problem, on one line. */
function context(): string {
  const nav = (globalThis as { navigator?: { userAgent?: string; onLine?: boolean; language?: string } }).navigator;
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = '';
  }
  return [`${Platform.OS} ${String(Platform.Version ?? '')}`, `build ${APP_BUILD}${APP_STORE ? ` ${APP_STORE}` : ''}`, nav?.onLine === false ? 'offline' : 'online', tz, nav?.language ?? '', nav?.userAgent ?? '', `api ${BASE_URL}`].filter(Boolean).join(' | ').slice(0, 1500);
}

/** A token when one is already at hand; the report goes without one rather than waiting for a login (the server may be the very thing that is down). */
async function quietToken(): Promise<string | null> {
  try {
    return await Promise.race([session.token(), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
  } catch {
    return null;
  }
}

/** Sends the report with a screenshot and the recent trail; true when the server took it. Never throws. */
export async function sendErrorReport(r: ErrorReport): Promise<boolean> {
  try {
    const screenshot = r.screenshot === undefined ? await captureScreen() : r.screenshot;
    const token = await quietToken();
    const body = {
      kind: r.kind,
      screen: (r.screen ?? currentScreen()).slice(0, 64),
      message: r.message.slice(0, 500),
      detail: [r.detail ?? '', '--- trail ---', ...crumbs()].join('\n').slice(0, 6000),
      context: context(),
      note: (r.note ?? '').slice(0, 500),
      ...(screenshot ? { screenshot } : {}),
    };
    const res = await fetch(`${BASE_URL}/client-errors`, {
      method: 'POST',
      headers: { ...clientHeaders(), 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}
