import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { deviceStore } from '../auth/storage';
import { installBannerDue, installModeOf, isIosAgent, launchOf } from './logic';
import type { InstallMode, LaunchTarget } from './logic';

/** What `public/index.html` keeps on `window` (it runs before the app, so no browser event is missed). */
interface PwaGlobal {
  install: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null;
  waiting: { postMessage: (m: unknown) => void } | null;
  updating?: boolean;
}

/** The few browser APIs used here (the project compiles without the DOM lib). */
interface Win {
  __dozariPwa?: PwaGlobal;
  matchMedia?: (q: string) => { matches: boolean };
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
  location: { search: string; pathname: string; hash: string };
  history: { replaceState: (data: null, unused: string, url: string) => void };
}
interface Nav {
  userAgent: string;
  maxTouchPoints?: number;
  onLine?: boolean;
  standalone?: boolean;
  storage?: { persist?: () => Promise<boolean> };
}

const g = globalThis as unknown as { window?: Win; navigator?: Nav };
const WEB = Platform.OS === 'web' && g.window !== undefined;
const win = g.window as Win;
const nav = g.navigator as Nav;
const DISMISS_KEY = 'dozari.installDismissedAt';
const glob = (): PwaGlobal | null => (WEB ? win.__dozariPwa ?? null : null);

const standalone = (): boolean =>
  WEB && (win.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true);

const currentMode = (): InstallMode =>
  installModeOf({ web: WEB, standalone: standalone(), hasPrompt: glob()?.install != null, ios: WEB && isIosAgent(nav.userAgent, nav.maxTouchPoints ?? 0) });

let persistAsked = false;
/** Asks the browser to keep our storage (the login token lives in localStorage) when it runs short of space. */
function askPersist(): void {
  if (!WEB || persistAsked) return;
  persistAsked = true;
  void nav.storage?.persist?.().catch(() => false);
}

/**
 * Web-only PWA state (D102): how to install, whether a new version waits, whether we are offline. On native every
 * field is inert. `applyUpdate` activates the waiting service worker; the page reloads when it takes over.
 */
export function usePwa() {
  const [mode, setMode] = useState<InstallMode>(currentMode);
  const [update, setUpdate] = useState(() => glob()?.waiting != null);
  const [online, setOnline] = useState(() => !WEB || nav.onLine !== false);
  const [bannerDue, setBannerDue] = useState(false);

  useEffect(() => {
    if (!WEB) return;
    askPersist();
    const sync = () => (setMode(currentMode()), setUpdate(glob()?.waiting != null));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    win.addEventListener('dozari-pwa', sync);
    win.addEventListener('online', on);
    win.addEventListener('offline', off);
    void deviceStore.get(DISMISS_KEY).then((v) => setBannerDue(installBannerDue(v ? Number(v) : null, Date.now())));
    sync();
    return () => {
      win.removeEventListener('dozari-pwa', sync);
      win.removeEventListener('online', on);
      win.removeEventListener('offline', off);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'shown' | 'ios'> => {
    const g = glob();
    if (!g?.install) return 'ios';
    const ev = g.install;
    g.install = null;
    await ev.prompt().catch(() => undefined);
    await ev.userChoice.catch(() => undefined);
    setMode(currentMode());
    return 'shown';
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDue(false);
    void deviceStore.set(DISMISS_KEY, String(Date.now()));
  }, []);

  const applyUpdate = useCallback(() => {
    const g = glob();
    if (!g?.waiting) return;
    g.updating = true;
    g.waiting.postMessage('skip-waiting');
  }, []);

  return { installMode: mode, installBanner: mode !== 'none' && bannerDue, update, online, promptInstall, dismissBanner, applyUpdate };
}

/** The screen a home-screen shortcut asked for (`?go=`), read once; the parameter is removed from the address bar. */
export function takeLaunchTarget(): LaunchTarget | null {
  if (!WEB) return null;
  const { target, rest } = launchOf(win.location.search);
  if (win.location.search !== rest) win.history.replaceState(null, '', win.location.pathname + rest + win.location.hash);
  return target;
}
