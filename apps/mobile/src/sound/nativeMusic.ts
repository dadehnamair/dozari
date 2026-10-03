import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { renderMusic, wavDataUri } from './musicRender';
import type { Mood } from './musicPattern';

/**
 * Native background music: the loop is rendered once per mood (musicRender.ts, a second or so of JS, deferred a tick so a
 * screen change is never blocked), cached, and played on repeat with expo-audio. Never throws.
 */

const uris = new Map<Mood, string>();
let player: AudioPlayer | null = null;
let playing: Mood | null = null;
let wanted: Mood | null = null;
let modeSet = false;

function stop() {
  try {
    player?.pause();
    player?.release();
  } catch {
    /* music is a nicety */
  }
  player = null;
  playing = null;
}

/** Plays `mood` on a loop; null = silence. Safe to call on every screen change. */
export function setNativeMusic(mood: Mood | null): void {
  wanted = mood;
  if (mood === playing) return;
  stop();
  if (!mood) return;
  setTimeout(() => {
    if (wanted !== mood || playing === mood) return; // changed again while waiting
    try {
      if (!modeSet) {
        modeSet = true;
        void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => undefined);
      }
      let uri = uris.get(mood);
      if (!uri) {
        uri = wavDataUri(renderMusic(mood));
        uris.set(mood, uri);
      }
      if (wanted !== mood) return;
      player = createAudioPlayer({ uri });
      player.loop = true;
      player.volume = 0.8;
      player.play();
      playing = mood;
    } catch {
      player = null;
      playing = null;
    }
  }, 0);
}
