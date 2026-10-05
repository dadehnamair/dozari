import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';
import { useGuardianGate } from '../agetrack/GuardianGate';
import { friendByLink } from './api';
import { parseInviteLink } from './inviteLink';

/**
 * When the app is opened from a friend's invite link, tells the server; a new account becomes that friend at once. Errors are ignored,
 * except a kid/teen with no guardian yet, who gets the one-step guardian screen (render the returned `gate` once, at the app root).
 */
export function useInviteLink(enabled: boolean): ReactNode {
  const { gate, intercept } = useGuardianGate();
  useEffect(() => {
    if (!enabled) return;
    const handle = (url: string | null) => {
      const id = parseInviteLink(url);
      if (id) void friendByLink(id).catch((e) => void intercept(e));
    };
    void Linking.getInitialURL().then(handle, () => undefined);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [enabled, intercept]);
  return gate;
}
