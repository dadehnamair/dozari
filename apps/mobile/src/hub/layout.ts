import type { Shape } from './buildings';

export type HubAction = 'solo' | 'daily' | 'duel' | 'tournament' | 'suggest';

export interface HubBuilding extends Shape {
  key: 'tower' | 'caravan' | 'shop' | 'zur' | 'chai' | 'maktab';
  /** What «ورود» does, or null for a mode that does not exist yet. */
  action: HubAction | null;
  host: 'mashti' | 'pahlevan' | 'baqal' | 'goli' | 'mirza';
  /** Colour of the mode chip over the plate. */
  chip: string;
}

/** The six buildings of screen-hub with the design's positions (a 318×714 map); sizes are the design's × 0.74. */
export const HUB_BUILDINGS: readonly HubBuilding[] = [
  { key: 'caravan', action: 'tournament', host: 'pahlevan', chip: '#A66BF0', x: 236, by: 250, w: 87, h: 38, type: 'crenel', body: '#E9A85C', roof: '#C98A4E' },
  { key: 'tower', action: 'daily', host: 'mashti', chip: '#FF7A3D', x: 82, by: 322, w: 34, h: 58, type: 'tower', body: '#F4CB8E', roof: '#3E93B8' },
  { key: 'shop', action: 'solo', host: 'baqal', chip: '#3E93B8', x: 236, by: 400, w: 75, h: 44, type: 'shop', body: '#EDB46A', roof: '#C98A4E', awn: '#E84A3C' },
  { key: 'zur', action: 'duel', host: 'pahlevan', chip: '#FF4D8D', x: 82, by: 476, w: 74, h: 41, type: 'dome', body: '#F0BE78', roof: '#E84A3C' },
  { key: 'chai', action: null, host: 'goli', chip: '#5DBB3C', x: 236, by: 552, w: 77, h: 43, type: 'badgir', body: '#E9A85C', roof: '#3FA36B', awn: '#3FA36B' },
  { key: 'maktab', action: 'suggest', host: 'mirza', chip: '#E85F22', x: 82, by: 628, w: 74, h: 40, type: 'dome', body: '#F4CB8E', roof: '#3E93B8' },
];

/** Buildings whose mode is switched off in the admin settings are shown but cannot be entered. */
export function canEnter(b: HubBuilding, on: { daily: boolean; duel: boolean; tournament: boolean }): boolean {
  if (b.action === null) return false;
  if (b.action === 'daily') return on.daily;
  if (b.action === 'duel') return on.duel;
  if (b.action === 'tournament') return on.tournament;
  return true;
}
