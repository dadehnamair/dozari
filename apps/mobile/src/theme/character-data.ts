/**
 * Data of the hand-drawn market characters, transcribed from docs/design/Character.dc.html (7 characters, 12 poses,
 * 12 month looks for the hero «dozari»). Shapes are in a 200 x ~260 grid; `Character.tsx` draws them.
 */
export interface HatSpec {
  d: string;
  fill: string;
  pat: string;
  patC: string;
  patW: number;
  acc: string;
  accC: string;
  hl: string;
}
export interface NoseSpec {
  d: string;
  tx: number;
  ty: number;
  rx: number;
  ry: number;
  hl: string;
}
export interface MouthSpec {
  d: string;
  f: string;
  teeth?: string;
}
export interface PoseSpec {
  b: string;
  f: string;
  eye: string;
  brow: string;
  mouth: string;
  lid?: string;
  px?: number;
  py?: number;
  coin?: number;
  big?: number;
  tear?: number;
  sweat?: number;
  z?: number;
  q?: number;
  spark?: number;
}
export interface CastSpec {
  head: string;
  skin: string;
  hat: string;
  hatC?: string;
  nose: string;
  cloth: string;
  patC: string;
  pat: string;
  belt?: string;
  freckles?: number;
  seed: number;
  beard?: string;
  glasses?: number;
  brow?: string;
  mustache?: string;
  fem?: number;
}
/** [path, fill, stroke?, strokeWidth?] */
export type AccPart = [string, string, string?, number?];
/** [cloth, pattern, hat, scarf, accessory key] */
export type MonthSpec = [string, string, string, string, string];

export const HEAD: Record<string, { d: string; top: number }> = {
  bean: {
    d: 'M66 62 C62 30 82 18 100 18 C118 18 138 30 134 62 C140 96 138 150 100 150 C62 150 60 96 66 62Z',
    top: 18,
  },
  round: {
    d: 'M100 34 C134 34 152 60 152 94 C152 128 130 150 100 150 C70 150 48 128 48 94 C48 60 66 34 100 34Z',
    top: 34,
  },
  egg: {
    d: 'M100 10 C126 10 140 50 140 92 C140 128 124 150 100 150 C76 150 60 128 60 92 C60 50 74 10 100 10Z',
    top: 10,
  },
};
export const NONE: HatSpec = {
  d: '',
  fill: 'none',
  pat: '',
  patC: 'none',
  patW: 0,
  acc: '',
  accC: 'none',
  hl: '',
};
export const HATS: Record<string, (c: string) => HatSpec> = {
  namadi: (c) => ({
    d: 'M64 56 C60 26 82 14 100 14 C118 14 140 26 136 56 C120 60 80 60 64 56Z',
    fill: c,
    pat: 'M66 50 Q100 57 134 50',
    patC: 'rgba(58,36,24,.35)',
    patW: 2.4,
    acc: '',
    accC: 'none',
    hl: 'M76 32 Q84 22 94 20',
  }),
  araqchin: (c) => ({
    d: 'M68 50 C70 28 130 28 132 50 Q100 44 68 50Z',
    fill: c,
    pat: 'M74 44 l5 -5 l5 5 l5 -5 l5 5 l5 -5 l5 5 l5 -5 l5 5 l5 -5 l5 5 l5 -5 l5 5',
    patC: '#FFC93C',
    patW: 2.2,
    acc: 'M100 28 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0',
    accC: '#FFC93C',
    hl: 'M80 38 Q88 32 98 32',
  }),
  turban: (c) => ({
    d: 'M56 58 C48 30 76 10 100 12 C124 10 152 30 144 58 C122 50 78 50 56 58Z',
    fill: c,
    pat: 'M62 44 Q100 26 140 44 M58 52 Q100 36 142 52 M70 30 Q100 18 128 30',
    patC: 'rgba(255,255,255,.5)',
    patW: 2.4,
    acc: 'M100 32 m-6 0 a6 7 0 1 0 12 0 a6 7 0 1 0 -12 0',
    accC: '#FFC93C',
    hl: 'M66 34 Q74 24 86 20',
  }),
  scarf: (c) => ({
    d: 'M48 100 C40 48 66 18 100 18 C134 18 160 48 152 100 C154 132 142 158 128 166 L120 140 C132 108 128 56 100 54 C72 56 68 108 80 140 L72 166 C58 158 46 132 48 100Z',
    fill: c,
    pat: 'M66 50 h.1 M90 32 h.1 M116 34 h.1 M138 56 h.1 M56 90 h.1 M146 92 h.1 M62 128 h.1 M140 126 h.1 M100 42 h.1',
    patC: '#FFE0EA',
    patW: 6,
    acc: 'M88 162 C88 150 112 150 112 162 C112 172 88 172 88 162Z',
    accC: c,
    hl: 'M60 70 Q66 46 84 34',
  }),
  headband: (c) => ({
    d: 'M62 54 Q100 42 138 54 L139 64 Q100 52 61 64Z',
    fill: c,
    pat: 'M84 26 q4 -10 10 -4 M100 22 q6 -10 12 0 M70 40 q-2 -10 6 -10',
    patC: '#3A2418',
    patW: 3,
    acc: 'M138 58 C150 54 162 60 160 72 C152 68 146 66 138 63Z',
    accC: c,
    hl: '',
  }),
  girlhair: (c) => ({
    d: 'M52 92 C46 50 70 30 100 30 C130 30 154 50 148 92 C140 66 120 54 100 60 C80 54 60 66 52 92Z',
    fill: c,
    pat: 'M78 42 Q88 50 94 58 M110 40 Q118 50 122 58',
    patC: 'rgba(255,255,255,.35)',
    patW: 2.4,
    acc: 'M126 38 L142 28 L142 48 Z M126 38 L110 28 L110 48 Z',
    accC: '#FF5C8A',
    hl: 'M66 56 Q74 42 88 38',
  }),
  topknot: (_c) => ({
    d: 'M92 38 C86 24 98 14 108 22 C114 30 108 40 100 38Z',
    fill: '#2E1E18',
    pat: '',
    patC: 'none',
    patW: 0,
    acc: '',
    accC: 'none',
    hl: 'M74 54 Q84 42 96 40',
  }),
};
export const NOSE: Record<string, NoseSpec> = {
  potato: {
    d: 'M100 80 C86 82 80 102 88 112 C94 118 112 118 116 108 C120 96 112 82 100 80Z',
    tx: 104,
    ty: 106,
    rx: 9,
    ry: 7,
    hl: 'M93 90 Q90 96 91 102',
  },
  long: {
    d: 'M99 78 C92 92 88 114 95 124 C101 129 111 122 109 110 C107 98 105 88 99 78Z',
    tx: 102,
    ty: 117,
    rx: 6,
    ry: 6,
    hl: 'M96 92 Q94 100 94 108',
  },
  button: {
    d: 'M100 90 C90 90 88 104 96 107 C102 110 112 106 110 97 C109 92 105 90 100 90Z',
    tx: 102,
    ty: 101,
    rx: 5,
    ry: 4,
    hl: 'M95 95 Q94 98 95 101',
  },
};
export const MOUTH: Record<string, MouthSpec> = {
  smile: { d: 'M88 128 Q100 138 112 128', f: 'none' },
  grin: {
    d: 'M84 126 Q100 150 116 126 Q100 132 84 126Z',
    f: '#8A2A2A',
    teeth: 'M93 129 L107 129 L106 135 L94 135Z',
  },
  sad: { d: 'M88 136 Q100 126 112 136', f: 'none' },
  O: { d: 'M94 132 a6 8 0 1 0 12 0 a6 8 0 1 0 -12 0', f: '#8A2A2A' },
  wavy: { d: 'M88 132 q6 -5 12 0 q6 5 12 0', f: 'none' },
  flat: { d: 'M89 133 L111 130', f: 'none' },
  smallO: { d: 'M97 131 a3 4 0 1 0 6 0 a3 4 0 1 0 -6 0', f: '#8A2A2A' },
};
export const MUST: Record<string, string> = {
  handle:
    'M100 116 C92 110 80 110 72 118 C66 124 60 120 62 114 C60 122 66 130 76 126 C86 122 94 120 100 122 C106 120 114 122 124 126 C134 130 140 122 138 114 C140 120 134 124 128 118 C120 110 108 110 100 116Z',
  bushy:
    'M78 120 C80 108 96 110 100 114 C104 110 120 108 122 120 C114 126 106 122 100 122 C94 122 86 126 78 120Z',
  thin: 'M84 121 Q100 112 116 121 Q100 117 84 121Z',
};
export const LID: Record<string, string> = {
  half: 'M77 74 C77 57 99 57 99 74 Q88 69 77 74Z M101 74 C101 57 123 57 123 74 Q112 69 101 74Z',
  angry: 'M77 67 C78 57 98 57 99 74 Q90 74 77 67Z M123 67 C122 57 102 57 101 74 Q110 74 123 67Z',
  sad: 'M77 74 C77 57 99 57 99 66 Q88 66 77 74Z M123 74 C123 57 101 57 101 66 Q112 66 123 74Z',
};
export const BROW: Record<string, string> = {
  idle: 'M80 55 Q88 51 96 55 M104 55 Q112 51 120 55',
  up: 'M80 49 Q88 44 96 49 M104 49 Q112 44 120 49',
  angry: 'M80 52 L97 60 M120 52 L103 60',
  sad: 'M80 58 L96 51 M120 58 L104 51',
  think: 'M80 55 Q88 51 96 55 M104 49 Q112 45 120 50',
};
export const HAPPY = 'M78 78 Q88 64 98 78 M102 78 Q112 64 122 78',
  CLOSED = 'M78 74 Q88 82 98 74 M102 74 Q112 82 122 74';
export const BEARD =
  'M60 104 C54 116 58 128 66 132 C62 144 72 154 82 152 C84 164 98 168 106 160 C116 168 130 160 128 150 C140 152 146 140 140 130 C148 124 148 110 140 104 C124 122 76 122 60 104Z';
export const CURLS = 'M74 138 q4 5 9 1 M94 152 q4 5 9 1 M114 146 q4 5 9 1 M128 128 q4 5 9 1';
export const BRAIDS = 'M56 92 C48 118 50 146 56 168 M144 92 C152 118 150 146 144 168';
export const ARMS: Record<string, [string, number, number]> = {
  idleL: ['M74 154 Q58 176 62 198', 62, 200],
  idleR: ['M126 154 Q142 176 138 198', 138, 200],
  upL: ['M74 154 Q50 134 48 106', 48, 102],
  upR: ['M126 154 Q150 134 152 106', 152, 102],
  outL: ['M74 154 Q52 146 44 124', 43, 120],
  outR: ['M126 154 Q148 146 156 124', 157, 120],
  sadL: ['M76 154 Q68 180 74 204', 74, 206],
  sadR: ['M124 154 Q132 180 126 204', 126, 206],
  chinR: ['M126 156 Q154 162 128 146', 125, 144],
  pointR: ['M126 156 Q150 152 172 146', 175, 145],
  coinR: ['M126 156 Q150 178 132 188', 130, 188],
};
export const POSE: Record<string, PoseSpec> = {
  idle: { b: 'idleL', f: 'idleR', eye: 'open', brow: 'idle', mouth: 'smile' },
  coin: { b: 'idleL', f: 'coinR', coin: 1, eye: 'open', brow: 'up', mouth: 'grin', px: 4 },
  wave: { b: 'idleL', f: 'upR', eye: 'open', brow: 'up', mouth: 'grin' },
  cheer: { b: 'upL', f: 'upR', eye: 'happy', brow: 'up', mouth: 'grin' },
  win: { b: 'upL', f: 'upR', eye: 'happy', brow: 'up', mouth: 'grin', spark: 1 },
  sad: { b: 'sadL', f: 'sadR', eye: 'open', lid: 'sad', brow: 'sad', mouth: 'sad', py: 3, tear: 1 },
  thinking: {
    b: 'idleL',
    f: 'chinR',
    eye: 'open',
    lid: 'half',
    brow: 'think',
    mouth: 'wavy',
    px: -4,
    py: -4,
    q: 1,
  },
  shocked: { b: 'outL', f: 'outR', eye: 'open', big: 1, brow: 'up', mouth: 'O', sweat: 1 },
  sleeping: { b: 'sadL', f: 'sadR', eye: 'closed', brow: 'idle', mouth: 'smallO', z: 1 },
  pointing: { b: 'idleL', f: 'pointR', eye: 'open', brow: 'idle', mouth: 'smile', px: 5 },
  blink: { b: 'idleL', f: 'idleR', eye: 'closed', brow: 'idle', mouth: 'smile' },
  angry: { b: 'idleL', f: 'idleR', eye: 'open', lid: 'angry', brow: 'angry', mouth: 'flat' },
};
export const CAST: Record<string, CastSpec> = {
  dozari: {
    head: 'bean',
    skin: '#F7C69A',
    hat: 'namadi',
    hatC: '#E8743B',
    nose: 'potato',
    cloth: '#33B3A6',
    patC: '#7FDCCF',
    pat: 'stripe',
    belt: '#3A2418',
    freckles: 1,
    seed: 3,
  },
  mashti: {
    head: 'round',
    skin: '#F3C29A',
    hat: 'araqchin',
    hatC: '#7A4BC4',
    nose: 'potato',
    cloth: '#8E5CD8',
    patC: '#B996F2',
    pat: 'stripe',
    belt: '#E8743B',
    beard: 'white',
    glasses: 1,
    brow: '#9A9084',
    seed: 11,
  },
  khale: {
    head: 'round',
    skin: '#F9D0AA',
    hat: 'scarf',
    hatC: '#FF5C8A',
    nose: 'button',
    cloth: '#FFB23F',
    patC: '#FFD98A',
    pat: 'dot',
    seed: 17,
  },
  pahlevan: {
    head: 'round',
    skin: '#E2A06E',
    hat: 'topknot',
    nose: 'potato',
    cloth: '#E84A3C',
    patC: '#FFF1DC',
    pat: 'hstripe',
    belt: '#3A2418',
    mustache: 'handle',
    seed: 23,
  },
  baqal: {
    head: 'bean',
    skin: '#ECB283',
    hat: 'headband',
    hatC: '#6CC04A',
    nose: 'potato',
    cloth: '#F1E4C8',
    patC: '#D8C49C',
    pat: 'stripe',
    belt: '#6CC04A',
    beard: 'black',
    mustache: 'bushy',
    seed: 29,
  },
  mirza: {
    head: 'egg',
    skin: '#F5CDA2',
    hat: 'turban',
    hatC: '#3B8FE8',
    nose: 'long',
    cloth: '#2F3D8F',
    patC: '#5E74D6',
    pat: 'dot',
    belt: '#FFC93C',
    mustache: 'thin',
    seed: 37,
  },
  dozariF: {
    head: 'bean', skin: '#F9CDA4', hat: 'namadi', hatC: '#E8743B', nose: 'button', cloth: '#FF7FAE', patC: '#FFC2D9', pat: 'stripe', belt: '#3A2418', freckles: 1, fem: 1, seed: 5,
  },
  goli: {
    head: 'round',
    skin: '#F8CEA6',
    hat: 'girlhair',
    hatC: '#5A3424',
    nose: 'button',
    cloth: '#7ED957',
    patC: '#C6F2A6',
    pat: 'dot',
    seed: 41,
  },
};
const O = (x: number, y: number, r: number) =>
  `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
const DROP = (x: number, y: number) => `M${x} ${y} q-6 9 0 12 q6 -3 0 -12z`;
const LEAF = (x: number, y: number, _r: number) =>
  `M${x} ${y} C${x + 12} ${y - 6} ${x + 22} ${y + 2} ${x + 18} ${y + 14} C${x + 8} ${y + 16} ${x} ${y + 10} ${x} ${y}Z`;
export const ACC: Record<string, AccPart[]> = {
  sabzeh: [
    ['M146 228 h28 l-4 22 h-20Z', '#C46A3A'],
    [
      'M150 228 l-2 -18 M155 228 l0 -22 M160 228 l1 -24 M165 228 l2 -20 M170 228 l3 -16',
      'none',
      '#3FA36B',
      3.4,
    ],
    ['M146 235 h28 v6 h-28Z', '#E84A3C'],
  ],
  flower: [
    [O(80, 16, 5) + O(72, 24, 5) + O(88, 24, 5) + O(75, 32, 5) + O(85, 32, 5), '#FF5C8A'],
    [O(80, 25, 4), '#FFC93C'],
  ],
  cherries: [
    ['M62 108 q-4 10 -10 16 M62 108 q2 10 -2 18', 'none', '#3FA36B', 2.4],
    [O(51, 128, 5.5) + O(60, 130, 5.5), '#D8282B'],
    ['M48 126 q1 -2 3 -2 M57 128 q1 -2 3 -2', 'none', '#fff', 1.6],
  ],
  sunglasses: [
    ['M75 66 h24 v9 q-12 9 -24 0Z M101 66 h24 v9 q-12 9 -24 0Z M99 68 h2', '#2A1A12'],
    ['M79 69 l6 0 M105 69 l6 0', 'none', '#fff', 2],
  ],
  watermelon: [
    ['M36 194 A26 26 0 0 0 88 194Z', '#FF5A5A', '#3FA36B', 4],
    ['M36 194 h52', 'none'],
    [O(54, 202, 1.5) + O(64, 206, 1.5) + O(72, 200, 1.5), '#2A1A12', 'none', 0],
  ],
  pencil: [
    ['M134 66 L152 94 L147 97 L129 69Z', '#FFC93C'],
    ['M152 94 L154 102 L147 97Z', '#F7C69A'],
    ['M129 69 L134 66 L131 62 L126 65Z', '#FF8FB6'],
  ],
  backpack: [
    ['M138 154 h16 q4 0 4 4 v40 q0 4 -4 4 h-16Z', '#E84A3C'],
    ['M80 148 L82 212 M120 148 L118 212', 'none', '#3A2418', 8],
    ['M80 148 L82 212 M120 148 L118 212', 'none', '#E84A3C', 4],
  ],
  rain: [
    [LEAF(112, 14, 1), '#FF7A3D'],
    [DROP(36, 56) + DROP(164, 108) + DROP(26, 138) + DROP(170, 170), '#8FDCFA', '#3A2418', 2],
  ],
  leaves: [
    [LEAF(30, 40, 1), '#E8743B'],
    [LEAF(158, 120, 1), '#FFB23F'],
    [LEAF(24, 150, 1), '#A8423A'],
  ],
  pomegranate: [
    [O(156, 192, 14), '#C4302B'],
    ['M150 180 l2 -7 l3 4 l2 -5 l2 5 l3 -4 l1 7Z', '#C4302B'],
    ['M148 186 q3 -4 7 -5', 'none', '#fff', 2],
  ],
  earmuffs: [
    ['M64 92 C58 18 142 18 136 92', 'none', '#3E93B8', 6],
    [O(60, 98, 12) + O(140, 98, 12), '#FFFFFF'],
    [O(28, 40, 0.1) + O(170, 60, 0.1) + O(22, 120, 0.1) + O(176, 140, 0.1), 'none', '#FFFFFF', 6],
  ],
  goldfish: [
    ['M144 212 C132 226 138 250 160 251 C182 250 188 226 176 212Z', '#BFE9FA'],
    ['M140 228 C150 222 170 222 180 228', 'none', '#3E93B8', 2],
    ['M152 236 C156 230 166 230 168 236 C166 242 156 242 152 236Z M168 236 l7 -5 v10Z', '#FF7A3D'],
  ],
};
export const MONTH: (MonthSpec | null)[] = [
  null,
  ['#3FA36B', '#8FDCA8', '#E84A3C', '#FFC93C', 'sabzeh'],
  ['#FF8FB6', '#FFD1DF', '#7ED957', '#FFF3E0', 'flower'],
  ['#9BD65A', '#D2F0A8', '#E84A3C', '#FF5C8A', 'cherries'],
  ['#3FC1F0', '#A8E6F8', '#FFC93C', '#FF7A3D', 'sunglasses'],
  ['#FF7A3D', '#FFC29E', '#3FA36B', '#E84A3C', 'watermelon'],
  ['#5E74D6', '#A9B8F2', '#E8743B', '#FFC93C', 'pencil'],
  ['#2F3D8F', '#5E74D6', '#E8743B', '#E84A3C', 'backpack'],
  ['#FFC93C', '#FFE48A', '#3FA36B', '#3E93B8', 'rain'],
  ['#A8423A', '#D97A5A', '#E8743B', '#FFB23F', 'leaves'],
  ['#C4302B', '#E86A5A', '#7A1F3D', '#FFF3E0', 'pomegranate'],
  ['#8FDCFA', '#FFFFFF', '#3E93B8', '#FFFFFF', 'earmuffs'],
  ['#A66BF0', '#D2B8FA', '#FF4D8D', '#FFC93C', 'goldfish'],
];
export const ORDER: string[] = ['dozari', 'dozariF', 'mashti', 'khale', 'pahlevan', 'baqal', 'mirza', 'goli'];
