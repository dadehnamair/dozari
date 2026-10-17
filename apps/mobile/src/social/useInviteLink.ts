import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { useGuardianGate } from '../agetrack/GuardianGate';
import { friendByLink } from './api';
import { parseInviteLink } from './inviteLink';

/**
 * When the app is opened from a friend's invite link, tells the server; a new account becomes that friend at once. Errors are ignored,
 * except a kid/teen with no guardian yet, who gets the one-step guardian screen (render the returned `gate` once, at the app root).
 */
export function useInviteLink(enabled: boolean, webHandle: string | null = null): ReactNode {
  const { gate, intercept } = useGuardianGate();
  const webDone = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    // the web / mini-app link carries the ID in the address bar (`takeInviteHandle`), once
    if (webHandle && !webDone.current) {
      webDone.current = true;
      void friendByLink(webHandle).catch((e) => void intercept(e));
    }
    const handle = (url: string | null) => {
      const id = parseInviteLink(url);
      if (id) void friendByLink(id).catch((e) => void intercept(e));
    };
    void Linking.getInitialURL().then(handle, () => undefined);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [enabled, intercept, webHandle]);
  return gate;
}
