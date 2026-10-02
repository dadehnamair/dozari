import { useEffect } from 'react';
import { Linking } from 'react-native';
import { friendByLink } from './api';
import { parseInviteLink } from './inviteLink';

/** When the app is opened from a friend's invite link, tells the server; a new account becomes that friend at once. Errors are ignored. */
export function useInviteLink(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const handle = (url: string | null) => {
      const id = parseInviteLink(url);
      if (id) void friendByLink(id).catch(() => undefined);
    };
    void Linking.getInitialURL().then(handle, () => undefined);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [enabled]);
}
