import { deviceStore } from '../auth/storage';

const KEY = 'dozari.tutorialSeen';

export async function tutorialSeen(): Promise<boolean> {
  return (await deviceStore.get(KEY)) === '1';
}

export async function markTutorialSeen(): Promise<void> {
  await deviceStore.set(KEY, '1');
}
