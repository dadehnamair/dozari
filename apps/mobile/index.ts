import { createElement, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { registerRootComponent } from 'expo';
import { loadBootTheme } from './src/theme/themeStore';

/**
 * The palette depends on the player's look (kid/teen candy or adult gold), so the remembered look is read before the app's modules load.
 * The root component itself is registered at once: on a phone the native side starts "main" as soon as the bundle runs, and the keychain
 * read is asynchronous, so registering after it crashed with «"main" has not been registered».
 */
function Boot() {
  const [App, setApp] = useState<ComponentType | null>(null);
  useEffect(() => {
    void loadBootTheme()
      .catch(() => undefined)
      .then(() => import('./App'))
      .then((m) => setApp(() => m.default));
  }, []);
  return App ? createElement(App) : null;
}

registerRootComponent(Boot);
