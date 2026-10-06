import { useEffect } from 'react';
import { canGoBack, runBack, subscribeBack } from '../nav/backStack';
import { miniAppHost } from './host';

/**
 * The mini-app header's back button: visible while some screen or sheet can go back, and it does exactly what the phone's back
 * button does (`backStack`). On the home screen nothing is registered, so the button hides and the host's own close stays.
 * The game never touches the browser history, so the hosts' advice to use in-memory routing is already met.
 */
export function useMiniAppBack(): void {
  useEffect(() => {
    const button = miniAppHost()?.sdk.BackButton;
    if (!button) return undefined;
    const sync = () => (canGoBack() ? button.show() : button.hide());
    button.onClick(runBack);
    sync();
    const off = subscribeBack(sync);
    return () => {
      off();
      button.offClick(runBack);
      button.hide();
    };
  }, []);
}

/** While mounted, closing the mini-app asks «are you sure?» (the host's own dialog). For a live match. */
export function useClosingConfirmation(): void {
  useEffect(() => {
    const sdk = miniAppHost()?.sdk;
    sdk?.enableClosingConfirmation?.();
    return () => sdk?.disableClosingConfirmation?.();
  }, []);
}
