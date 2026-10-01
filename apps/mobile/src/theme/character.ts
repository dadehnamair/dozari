import {
  ACC,
  ARMS,
  BROW,
  CAST,
  HATS,
  HEAD,
  LID,
  MONTH,
  MOUTH,
  MUST,
  NONE,
  NOSE,
  ORDER,
  POSE,
} from './character-data';
import type { AccPart, HatSpec, MouthSpec, NoseSpec } from './character-data';

export const CHARACTERS = [
  'dozari',
  'mashti',
  'khale',
  'pahlevan',
  'baqal',
  'mirza',
  'goli',
] as const;
export type CharacterId = (typeof CHARACTERS)[number];
export const CHARACTER_POSES = [
  'idle',
  'coin',
  'wave',
  'cheer',
  'win',
  'sad',
  'thinking',
  'shocked',
  'sleeping',
  'pointing',
  'blink',
  'angry',
] as const;
export type CharacterPose = (typeof CHARACTER_POSES)[number];
export type CharacterCrop = 'full' | 'face';

const BEARD =
  'M60 104C54 116 58 128 66 132C62 144 72 154 82 152C84 164 98 168 106 160C116 168 130 160 128 150C140 152 146 140 140 130C148 124 148 110 140 104C124 122 76 122 60 104Z';
const CURLS = 'M74 138q4 5 9 1M94 152q4 5 9 1M114 146q4 5 9 1M128 128q4 5 9 1';
const BRAIDS = 'M56 92C48 118 50 146 56 168M144 92C152 118 150 146 144 168';
const FRECKLES = 'M70 97h.1M76 100h.1M71 104h.1M124 100h.1M130 97h.1M129 104h.1';

export interface CharacterLook {
  viewBox: string;
  full: boolean;
  seed: number;
  headD: string;
  hatY: number;
  hatRot: number;
  hat: HatSpec;
  nose: NoseSpec;
  noseY: number;
  mouth: MouthSpec & { teeth: string };
  mouthY: number;
  eye: {
    open: boolean;
    rx: number;
    ry: number;
    pr: number;
    plx: number;
    prx: number;
    py: number;
    hlx: number;
    hrx: number;
    hly: number;
    lid: string;
    lines: string;
    brow: string;
  };
  arm: {
    backD: string;
    backHand: [number, number];
    frontD: string;
    frontHand: [number, number];
    coin: boolean;
  };
  cloth: string;
  skin: string;
  pattern: { stripeW: number; dotR: number; rot: number; color: string };
  belt: string;
  beltD: string;
  beard: { d: string; color: string; curl: string };
  mustache: { d: string; color: string };
  hairBack: string;
  hatColor: string;
  browColor: string;
  hero: boolean;
  scarf: string;
  scarfLight: string;
  freckles: string;
  glasses: boolean;
  acc: { d: string; fill: string; stroke: string; width: number }[];
  extras: { q: boolean; z: boolean; sweat: boolean; tear: boolean; spark: boolean };
}

/** Port of `renderVals` of docs/design/Character.dc.html. Month 1..12 only applies to the hero «dozari». */
export function characterLook(opts: {
  who?: CharacterId | string;
  pose?: CharacterPose;
  month?: number;
  skin?: number;
  crop?: CharacterCrop;
}): CharacterLook {
  const sk = Math.trunc(opts.skin ?? 0) || 0;
  const key = opts.who && CAST[opts.who] ? opts.who : (ORDER[((sk % 7) + 7) % 7] as string);
  const base = CAST[key] ?? CAST.dozari!;
  const mo = key === 'dozari' ? (MONTH[Math.trunc(opts.month ?? 0)] ?? null) : null;
  const c0 = mo ? { ...base, cloth: mo[0], patC: mo[1], hatC: mo[2] } : base;
  const scarf = mo ? mo[3] : '#E84A3C';
  const P = POSE[opts.pose ?? 'idle'] ?? POSE.idle!;
  const head = HEAD[c0.head] ?? HEAD.round!;
  const hatFn = HATS[c0.hat];
  const hat = hatFn ? hatFn(c0.hatC ?? 'none') : NONE;
  const long = c0.nose === 'long' ? 8 : 0;
  const must = Boolean(c0.mustache);
  const back = ARMS[P.b]!;
  const front = ARMS[P.f]!;
  const px = P.px ?? 0;
  const py = P.py ?? 0;
  const hero = key === 'dozari';
  const mouth: MouthSpec =
    hero && P.mouth === 'smile'
      ? {
          d: 'M86 127 Q102 142 117 122 Q102 131 86 127Z',
          f: '#8A2A2A',
          teeth: 'M99 130 L106 129 L105.5 134 L99.5 134.5Z',
        }
      : (MOUTH[P.mouth] ?? MOUTH.smile!);
  const face = opts.crop === 'face';
  const accParts: AccPart[] = mo ? (ACC[mo[4]] ?? []) : [];
  return {
    viewBox: face ? '26 -4 148 148' : '-20 -18 240 276',
    full: !face,
    seed: c0.seed,
    headD: head.d,
    hatY: head.top - 34,
    hatRot: hero ? -9 : 0,
    hat,
    nose: NOSE[c0.nose] ?? NOSE.potato!,
    noseY: long,
    mouth: { ...mouth, teeth: mouth.teeth ?? '' },
    mouthY: long + (must ? 5 : 0),
    eye: {
      open: P.eye === 'open',
      rx: P.big ? 13 : 11,
      ry: P.big ? 16 : 13,
      pr: P.big ? 2.6 : 3.8,
      plx: 88 + px,
      prx: 112 + px,
      py: 76 + py,
      hlx: 89.6 + px,
      hrx: 113.6 + px,
      hly: 74.2 + py,
      lid: (P.lid && LID[P.lid]) || '',
      lines:
        P.eye === 'happy'
          ? 'M78 78 Q88 64 98 78 M102 78 Q112 64 122 78'
          : P.eye === 'closed'
            ? 'M78 74 Q88 82 98 74 M102 74 Q112 82 122 74'
            : '',
      brow: BROW[P.brow] ?? '',
    },
    arm: {
      backD: back[0],
      backHand: [back[1], back[2]],
      frontD: front[0],
      frontHand: [front[1], front[2]],
      coin: Boolean(P.coin),
    },
    cloth: c0.cloth,
    skin: c0.skin,
    pattern: {
      stripeW: c0.pat === 'dot' ? 0 : 4.5,
      dotR: c0.pat === 'dot' ? 2 : 0,
      rot: c0.pat === 'hstripe' ? 90 : c0.pat === 'dot' ? 45 : 0,
      color: c0.patC,
    },
    belt: c0.belt ?? 'none',
    beltD: c0.belt ? 'M63 190 Q100 200 137 190 L138 201 Q100 211 62 201Z' : '',
    beard: {
      d: c0.beard ? BEARD : '',
      color: c0.beard === 'white' ? '#FFFDF5' : '#2E1E18',
      curl: c0.beard === 'white' ? CURLS : '',
    },
    mustache: {
      d: must && c0.mustache ? (MUST[c0.mustache] ?? '') : '',
      color: c0.mustache === 'thin' ? '#3A2418' : '#2E1E18',
    },
    hairBack: c0.hat === 'girlhair' ? BRAIDS : '',
    hatColor: c0.hatC ?? 'none',
    browColor: c0.brow ?? '#3A2418',
    hero,
    scarf,
    scarfLight: scarf === '#FFF3E0' || scarf === '#FFFFFF' ? '#E84A3C' : '#FFF3E0',
    freckles: c0.freckles ? FRECKLES : '',
    glasses: Boolean(c0.glasses),
    acc: accParts.map(([d, fill, stroke, width]) => ({
      d,
      fill,
      stroke: stroke ?? '#3A2418',
      width: width ?? 2.4,
    })),
    extras: {
      q: Boolean(P.q),
      z: Boolean(P.z),
      sweat: Boolean(P.sweat),
      tear: Boolean(P.tear),
      spark: Boolean(P.spark),
    },
  };
}
