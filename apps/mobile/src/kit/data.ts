import { candyTone } from '../theme/colors';
import type { IconName } from '../theme/icons';
import type { CharacterPose } from '../theme/character';

/** Asset catalogue from docs/design/Dozari Visual Assets.dc.html (sections G-J). Labels live in i18n/fa.ts. */

type Tone = (typeof candyTone)[keyof typeof candyTone];
export type CandyName = keyof typeof candyTone;
const TONE_ORDER: readonly CandyName[] = ['pink', 'orange', 'yellow', 'sky', 'grape', 'lime'];
const toneAt = (i: number): Tone => candyTone[TONE_ORDER[i % TONE_ORDER.length] as CandyName];

const AVATAR_POSES: readonly CharacterPose[] = ['idle', 'wave', 'cheer', 'thinking', 'shocked', 'blink', 'win', 'sleeping'];

export interface AvatarSpec {
  key: string;
  skin: number;
  pose: CharacterPose;
  light: string;
  base: string;
}

/** 24 avatars: mascot face crops over a candy backdrop (`avatar-01` .. `avatar-24`). */
export const AVATARS: readonly AvatarSpec[] = Array.from({ length: 24 }, (_, i) => {
  const tone = toneAt(i * 5 + 2);
  return {
    key: `avatar-${String(i + 1).padStart(2, '0')}`,
    skin: i % 7,
    pose: AVATAR_POSES[Math.floor(i / 3) % AVATAR_POSES.length] as CharacterPose,
    light: tone.light,
    base: tone.base,
  };
});

export interface TierSpec {
  tier: 1 | 2 | 3 | 4 | 5;
  light: string;
  base: string;
  dark: string;
}

/** Rank shields: copper, bronze, silver, gold, diamond. */
export const TIERS: readonly TierSpec[] = [
  { tier: 1, light: '#F2B48A', base: '#C46A3A', dark: '#7A3A1A' },
  { tier: 2, light: '#F2D49A', base: '#C7902F', dark: '#6A4410' },
  { tier: 3, light: '#FFFFFF', base: '#BFCBE0', dark: '#5E6C89' },
  { tier: 4, light: '#FFF4B0', base: '#FFC93C', dark: '#A86E00' },
  { tier: 5, light: '#D2F3FF', base: '#3FC1F0', dark: '#5A33C0' },
];

export type TagKey = 'chatty' | 'firstWin' | 'collector' | 'sharp' | 'streak' | 'champion' | 'dahe50' | 'dahe60' | 'dahe70' | 'dahe80' | 'dahe90' | 'dahe00';

export interface TagSpec {
  key: TagKey;
  icon: IconName;
  tone: CandyName;
}

export const TAGS: readonly TagSpec[] = [
  { key: 'chatty', icon: 'chat', tone: 'sky' },
  { key: 'firstWin', icon: 'flag', tone: 'lime' },
  { key: 'collector', icon: 'gift', tone: 'grape' },
  { key: 'sharp', icon: 'eye', tone: 'orange' },
  { key: 'streak', icon: 'flame', tone: 'pink' },
  { key: 'champion', icon: 'crown', tone: 'yellow' },
  { key: 'dahe50', icon: 'clock', tone: 'orange' },
  { key: 'dahe60', icon: 'clock', tone: 'pink' },
  { key: 'dahe70', icon: 'clock', tone: 'grape' },
  { key: 'dahe80', icon: 'clock', tone: 'sky' },
  { key: 'dahe90', icon: 'clock', tone: 'lime' },
  { key: 'dahe00', icon: 'clock', tone: 'yellow' },
];

export interface StampSpec {
  key: string;
  /** Decade digits as shown after «دهه», Latin so the label stays one formatting step away. */
  decade: '50' | '60' | '70' | '80' | '90' | '00';
  color: string;
  rotate: number;
}

export const STAMPS: readonly StampSpec[] = [
  { key: 'stamp-era-dahe50', decade: '50', color: '#B9481A', rotate: -8 },
  { key: 'stamp-era-dahe60', decade: '60', color: '#B8235A', rotate: 5 },
  { key: 'stamp-era-dahe70', decade: '70', color: '#6634B0', rotate: -4 },
  { key: 'stamp-era-dahe80', decade: '80', color: '#1478A8', rotate: 7 },
  { key: 'stamp-era-dahe90', decade: '90', color: '#3F8F1F', rotate: -6 },
  { key: 'stamp-era-dahe00', decade: '00', color: '#C48A0E', rotate: 3 },
];

export type EmptyKind = 'error' | 'searching' | 'noHistory' | 'noPuzzles' | 'noInternet';

export interface EmptySpec {
  kind: EmptyKind;
  key: string;
  pose: CharacterPose;
  skin: number;
  tone: CandyName;
  /** Whether the card carries an action button. */
  hasAction: boolean;
}

export const EMPTY_STATES: readonly EmptySpec[] = [
  { kind: 'error', key: 'empty-error', pose: 'shocked', skin: 1, tone: 'pink', hasAction: true },
  { kind: 'searching', key: 'empty-searching', pose: 'thinking', skin: 3, tone: 'sky', hasAction: false },
  { kind: 'noHistory', key: 'empty-no-history', pose: 'sleeping', skin: 4, tone: 'grape', hasAction: true },
  { kind: 'noPuzzles', key: 'empty-no-puzzles', pose: 'sad', skin: 0, tone: 'yellow', hasAction: true },
  { kind: 'noInternet', key: 'empty-no-internet', pose: 'blink', skin: 6, tone: 'orange', hasAction: true },
];

export type BannerKind = 'win' | 'lose' | 'draw';

export interface BannerSpec {
  kind: BannerKind;
  light: string;
  base: string;
  dark: string;
}

export const BANNERS: readonly BannerSpec[] = [
  { kind: 'win', light: '#FFE48A', base: '#FFC93C', dark: '#C48A0E' },
  { kind: 'lose', light: '#D4E0FA', base: '#B0C4EF', dark: '#6F88C4' },
  { kind: 'draw', light: '#D9B3E2', base: '#BA81C5', dark: '#8A4F98' },
];

export type PortalKey = 'solo' | 'duel' | 'team' | 'private' | 'daily' | 'ugcSuggest' | 'ugcVote' | 'leaderboard' | 'achievements' | 'wallet';

export interface PortalSpec {
  key: PortalKey;
  assetKey: string;
  icon: IconName;
  tone: CandyName;
}

/** The ten big hub entrances. */
export const PORTALS: readonly PortalSpec[] = [
  { key: 'solo', assetKey: 'portal-solo', icon: 'user', tone: 'grape' },
  { key: 'duel', assetKey: 'portal-duel', icon: 'bolt', tone: 'pink' },
  { key: 'team', assetKey: 'portal-team', icon: 'users', tone: 'sky' },
  { key: 'private', assetKey: 'portal-private', icon: 'lock', tone: 'orange' },
  { key: 'daily', assetKey: 'portal-daily', icon: 'calendar', tone: 'yellow' },
  { key: 'ugcSuggest', assetKey: 'portal-ugc-suggest', icon: 'edit', tone: 'lime' },
  { key: 'ugcVote', assetKey: 'portal-ugc-vote', icon: 'vote', tone: 'pink' },
  { key: 'leaderboard', assetKey: 'portal-leaderboard', icon: 'chart', tone: 'sky' },
  { key: 'achievements', assetKey: 'portal-achievements', icon: 'trophy', tone: 'yellow' },
  { key: 'wallet', assetKey: 'portal-wallet', icon: 'wallet', tone: 'grape' },
];
