import { deviceStore } from '../auth/storage';

const KEY = 'dozari.tutorialSeen';

const LOGIN_KEY = 'dozari.loginSeen';

/** Has the first-run sign-in screen been dealt with (signed in, or chose to play as a guest)? */
export async function loginSeen(): Promise<boolean> {
  return (await deviceStore.get(LOGIN_KEY)) === '1';
}

export async function markLoginSeen(): Promise<void> {
  await deviceStore.set(LOGIN_KEY, '1');
}

export async function tutorialSeen(): Promise<boolean> {
  return (await deviceStore.get(KEY)) === '1';
}

export async function markTutorialSeen(): Promise<void> {
  await deviceStore.set(KEY, '1');
}
