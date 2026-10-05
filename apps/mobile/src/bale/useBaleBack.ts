import { useEffect } from 'react';
import { canGoBack, runBack, subscribeBack } from '../nav/backStack';
import { baleWebApp } from './miniapp';

/**
 * Bale's header back button (mini-app only): visible while some screen or sheet can go back, and it does exactly what the phone's
 * back button does (`backStack`). On the home screen nothing is registered, so the button hides and Bale's own close stays.
 * The game never touches the browser history, so Bale's advice to use in-memory routing is already met.
 */
export function useBaleBack(): void {
  useEffect(() => {
    const button = baleWebApp()?.BackButton;
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
