/** Mascot look data from docs/design/Mascot.dc.html: 7 skins x 10 poses, drawn on a 200x~220 grid. */
export const MASCOT_POSES = ['idle', 'wave', 'cheer', 'sad', 'win', 'thinking', 'shocked', 'sleeping', 'pointing', 'blink'] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

export const MASCOT_SKINS = [
  { hi: '#FFF4B0', base: '#FFC93C', rim: '#D98A0B' },
  { hi: '#FFC9DC', base: '#FF4D8D', rim: '#B8235A' },
  { hi: '#FFD6BC', base: '#FF7A3D', rim: '#B9481A' },
  { hi: '#D2F3FF', base: '#3FC1F0', rim: '#1478A8' },
  { hi: '#E6D3FF', base: '#A66BF0', rim: '#6634B0' },
  { hi: '#E2F8CF', base: '#7ED957', rim: '#3F8F1F' },
  { hi: '#FFFFFF', base: '#C9D3E6', rim: '#7D8AA6' },
] as const;

type Eyes = 'open' | 'happy' | 'closed';

interface PoseSpec {
  armL: string;
  gl: readonly [number, number];
  armR: string;
  gr: readonly [number, number];
  eyes: Eyes;
  ey: number;
  ery: number;
  px: number;
  py: number;
  mouth: string;
  mf: string;
  brow: string;
  crown: boolean;
  tear: boolean;
  x: string;
  xx: number;
  xy: number;
  xc: string;
}

const BASE: PoseSpec = {
  armL: 'M34 110 Q16 128 22 150', gl: [22, 152], armR: 'M166 110 Q184 128 178 150', gr: [178, 152],
  eyes: 'open', ey: 92, ery: 16, px: 0, py: 0, mouth: 'M82 120 Q100 138 118 120', mf: 'none', brow: '',
  crown: false, tear: false, x: '', xx: 0, xy: 0, xc: '#fff',
};
const OPEN = 'M80 118 Q100 152 120 118 Z';
const MOUTH_FILL = '#7A1F3D';

const POSES: Record<MascotPose, Partial<PoseSpec>> = {
  idle: {},
  wave: { armR: 'M166 104 Q190 86 184 56', gr: [184, 50], mouth: OPEN, mf: MOUTH_FILL },
  cheer: { armL: 'M36 102 Q12 80 20 50', gl: [20, 44], armR: 'M164 102 Q188 80 180 50', gr: [180, 44], eyes: 'happy', mouth: 'M76 116 Q100 158 124 116 Z', mf: MOUTH_FILL },
  sad: { mouth: 'M84 134 Q100 120 116 134', py: 5, brow: 'M62 80 L88 72 M138 80 L112 72', tear: true },
  win: { eyes: 'happy', crown: true, mouth: OPEN, mf: MOUTH_FILL, armR: 'M166 104 Q190 86 184 56', gr: [184, 50] },
  thinking: { armR: 'M166 114 Q152 150 128 136', gr: [126, 134], mouth: 'M90 128 Q102 123 112 128', px: 5, py: -5, brow: 'M64 70 L88 76', x: '؟', xx: 156, xy: 44, xc: '#3FC1F0' },
  shocked: { ery: 20, mouth: 'M90 128 a10 13 0 1 0 20 0 a10 13 0 1 0 -20 0', mf: MOUTH_FILL, armL: 'M34 104 Q14 96 10 74', gl: [10, 68], armR: 'M166 104 Q186 96 190 74', gr: [190, 68], x: '!', xx: 168, xy: 38, xc: '#FF4D8D' },
  sleeping: { eyes: 'closed', mouth: 'M94 126 a6 5 0 1 0 12 0 a6 5 0 1 0 -12 0', mf: MOUTH_FILL, x: 'zZ', xx: 146, xy: 40, xc: '#B0C4EF' },
  pointing: { armR: 'M166 106 L196 96', gr: [200, 94], px: 6 },
  blink: { eyes: 'closed' },
};

export type MascotCrop = 'full' | 'face';

export interface MascotLook extends PoseSpec {
  viewBox: string;
  full: boolean;
  skin: (typeof MASCOT_SKINS)[number];
  skinIndex: number;
  pupilLeftX: number;
  pupilRightX: number;
  pupilY: number;
  glintLeftX: number;
  glintRightX: number;
  glintY: number;
}

/** Everything the renderer needs for one pose/skin/crop; unknown skins are clamped into 0..6. */
export function mascotLook(pose: MascotPose = 'idle', skin = 0, crop: MascotCrop = 'full'): MascotLook {
  const skinIndex = Math.max(0, Math.min(MASCOT_SKINS.length - 1, Math.trunc(skin) || 0));
  const q: PoseSpec = { ...BASE, ...POSES[pose] };
  const full = crop !== 'face';
  return {
    ...q,
    viewBox: full ? '-12 -8 224 226' : '24 18 152 152',
    full,
    skin: MASCOT_SKINS[skinIndex] ?? MASCOT_SKINS[0],
    skinIndex,
    pupilLeftX: 76 + q.px,
    pupilRightX: 124 + q.px,
    pupilY: q.ey + q.py,
    glintLeftX: 79 + q.px,
    glintRightX: 127 + q.px,
    glintY: q.ey + q.py - 3,
  };
}
