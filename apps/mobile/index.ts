import { registerRootComponent } from 'expo';
import { loadBootTheme } from './src/theme/themeStore';

// The palette depends on the player's look (kid/teen candy or adult gold), so it is read before any screen module loads.
void loadBootTheme()
  .catch(() => undefined)
  .then(() => import('./App'))
  .then(({ default: App }) => registerRootComponent(App));
