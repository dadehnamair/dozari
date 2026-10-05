import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import type { Sfx } from './engineNotes';
import { wavDataUri } from './musicRender';
import { renderSfx } from './sfxRender';

/**
 * Sound effects on phones: each effect is rendered once (sfxRender.ts, nothing to ship), kept as one expo-audio player, and
 * restarted from the top on every play so quick taps do not queue. Never throws; a failed player just stays silent.
 */
const players = new Map<Sfx, AudioPlayer | null>();

export function playNativeSfx(name: Sfx, volume = 0.9): void {
  try {
    let p = players.get(name);
    if (p === undefined) {
      try {
        p = createAudioPlayer({ uri: wavDataUri(renderSfx(name)) });
        p.volume = volume;
      } catch {
        p = null;
      }
      players.set(name, p);
    }
    if (!p) return;
    void p.seekTo(0).catch(() => undefined);
    p.play();
  } catch {
    /* sound is a nicety */
  }
}
