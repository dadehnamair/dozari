import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import backgroundSong from '../../assets/music/background.mp3';
import competitionSong from '../../assets/music/competition.mp3';
import { renderMusic, wavDataUri } from './musicRender';
import type { Mood } from './musicPattern';

/**
 * Background music with expo-audio on phones and on the web: the owner's two songs (assets/music, D189) loop — `background` under every
 * screen except a match, `competition` during one. If a song cannot be played, the synthesised loop of the same mood
 * (musicRender.ts, rendered once, deferred a tick so a screen change is never blocked) takes over. Never throws.
 */

/** The songs, by mood: calm = the background song, tense = the competition song. */
const SONGS: Record<Mood, { source: number; volume: number }> = {
  calm: { source: backgroundSong, volume: 0.55 },
  tense: { source: competitionSong, volume: 0.7 },
};

const uris = new Map<Mood, string>();
let player: AudioPlayer | null = null;
let playing: Mood | null = null;
let wanted: Mood | null = null;
let modeSet = false;
/** The player's volume setting (0..1), applied on top of each song's own level. */
let userVolume = 1;

/** Sets the player's music volume; takes effect on the song that is playing right now. */
export function setNativeMusicVolume(v: number): void {
  userVolume = Math.min(1, Math.max(0, v));
  try {
    if (player && playing) player.volume = SONGS[playing].volume * userVolume;
  } catch {
    /* music is a nicety */
  }
}

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
      try {
        player = createAudioPlayer(SONGS[mood].source);
        player.volume = SONGS[mood].volume * userVolume;
      } catch {
        player = null;
      }
      if (!player) {
        let uri = uris.get(mood);
        if (!uri) {
          uri = wavDataUri(renderMusic(mood));
          uris.set(mood, uri);
        }
        if (wanted !== mood) return;
        player = createAudioPlayer({ uri });
        player.volume = 0.8 * userVolume;
      }
      if (wanted !== mood) return;
      player.loop = true;
      startWhenAllowed(player);
      playing = mood;
    } catch {
      player = null;
      playing = null;
    }
  }, 0);
}

/** Browsers refuse sound before the first tap: try now, and if blocked, once more on the next touch or click. */
function startWhenAllowed(p: AudioPlayer): void {
  const doc = (globalThis as { document?: { addEventListener(t: string, f: () => void, o?: unknown): void; removeEventListener(t: string, f: () => void): void } }).document;
  const go = () => {
    try {
      if (player === p) p.play();
    } catch {
      /* blocked: retried below */
    }
  };
  go();
  if (!doc) return;
  const retry = () => {
    doc.removeEventListener('pointerdown', retry);
    go();
  };
  doc.addEventListener('pointerdown', retry);
}
