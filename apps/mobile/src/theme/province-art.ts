/**
 * Landmark drawings of the province badges, ported verbatim from `docs/design/Dozari - 18 Provinces` (`SH`), on a
 * 120×120 canvas clipped to a circle (r 50). Each part is one path with its fill; `none` draws only the ink stroke.
 * `globe` is ours: the generic «خارج از کشور» badge the design does not have.
 */
export interface Part {
  d: string;
  f: string;
}

const CR = '#FFF6E8', ST = '#E8D8B8', DK = '#4A2A5A', W = '#fff';
const E = (x: number, y: number, rx: number, ry: number): string =>`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0Z`;
const tree = (x: number, s: number, c: string): Part[] =>[{d:`M${x-1.5} 92 v-${6*s} h3 v${6*s}Z`,f:'#8E5A2A'},{d:`M${x} ${92-30*s} L${x+10*s} ${92-6*s} H${x-10*s}Z`,f:c}];
const palm = (x: number, h: number): Part[] =>[{d:`M${x} 92 C${x-2} ${92-h*.5} ${x+2} ${92-h*.8} ${x+6} ${92-h}`,f:'none'},{d:`M${x+6} ${92-h} q-14 -2 -18 8 q10 -8 18 -8 q-6 -12 -16 -10 q12 0 16 10 q4 -12 16 -12 q-12 4 -16 12 q14 -4 18 6 q-10 -6 -18 -6Z`,f:'#5FB84A'}];
export const SHAPES: Record<string, (c: string) => Part[]> = {
 azadi: (c) => [{d:'M36 92 L48 44 Q60 26 72 44 L84 92 H70 Q60 64 50 92Z',f:CR},{d:'M50 44 h20 v-8 h-20Z',f:CR},{d:'M54 36 Q60 26 66 36Z',f:c},{d:'M56 70 h8 M54 54 h12',f:'none'}],
 needle: (c) => [{d:'M56 92 L58 34 h4 L64 92Z',f:CR},{d:E(60,44,12,7),f:c},{d:'M60 34 V12',f:'none'},{d:'M30 92 v-14 h10 v14 M76 92 v-20 h12 v20',f:ST}],
 dome: (c) => [{d:'M34 92 V64 H86 V92Z',f:CR},{d:'M40 64 C40 34 80 34 80 64Z',f:c},{d:'M60 40 V30',f:'none'},{d:E(60,29,2.5,2.5),f:'#FFC93C'},{d:'M22 92 V46 h7 V92Z M91 92 V46 h7 V92Z',f:CR},{d:'M22 46 l3.5 -8 l3.5 8Z M91 46 l3.5 -8 l3.5 8Z',f:c},{d:'M52 92 V78 Q60 68 68 78 V92Z',f:DK}],
 gold: (_c) => [{d:'M30 92 V66 H90 V92Z',f:'#3FB8C8'},{d:'M38 66 C38 32 82 32 82 66Z',f:'#FFC93C'},{d:'M60 38 V26',f:'none'},{d:'M20 92 V50 h8 V92Z M92 92 V50 h8 V92Z',f:'#FFC93C'},{d:'M52 92 V78 Q60 68 68 78 V92Z',f:DK}],
 pillars: (_c) => [{d:'M22 92 V86 H98 V92Z',f:ST},{d:'M30 86 V50 h7 V86Z M46 86 V50 h7 V86Z M62 86 V50 h7 V86Z M78 86 V50 h7 V86Z',f:CR},{d:'M24 50 h72 v-8 h-72Z',f:ST},{d:'M40 42 q8 -10 16 0 M64 42 q8 -10 16 0',f:'none'}],
 castle: (c) => [{d:'M16 92 V62 h8 v-6 h6 v6 h8 V48 h8 v-6 h6 v6 h8 v-6 h6 v6 h8 V62 h8 v-6 h6 v6 h8 V92Z',f:c},{d:'M54 92 V80 Q60 72 66 80 V92Z',f:DK},{d:'M26 72 h4 M90 72 h4 M50 58 h4 M66 58 h4',f:'none'}],
 wind: (c) => [{d:'M20 92 V62 H56 V92Z',f:c},{d:'M24 62 C24 48 52 48 52 62Z',f:c},{d:'M62 92 V36 H84 V92Z',f:c},{d:'M66 42 v12 M71 42 v12 M76 42 v12 M80 42 v12',f:'none'},{d:'M88 92 V58 H104 V92Z',f:ST}],
 mount: (c) => [{d:'M0 92 L34 44 L52 66 L74 26 L120 92Z',f:c},{d:'M64 44 L74 26 L86 46 L80 42 L74 50 L68 42Z',f:W},{d:'M28 54 L34 44 L40 54 L36 51 L32 56Z',f:W}],
 forest: (c) => [{d:'M0 92 Q30 70 60 80 Q90 68 120 84 V92Z',f:'#5FB84A'},...tree(24,1,c),...tree(46,1.3,c),...tree(72,1.1,c),...tree(94,1.4,c)],
 seaforest: (c) => [{d:'M0 88 Q15 82 30 88 T60 88 T90 88 T120 88 V120 H0Z',f:'#3FC1F0'},...tree(34,1.2,c),...tree(56,1.5,c),...tree(80,1.1,c)],
 sea: (_c) => [{d:'M0 86 Q15 80 30 86 T60 86 T90 86 T120 86 V120 H0Z',f:'#3FC1F0'},{d:'M14 86 L30 70 L46 86Z',f:ST},...palm(82,44)],
 bay: (c) => [{d:'M0 86 Q15 80 30 86 T60 86 T90 86 T120 86 V120 H0Z',f:'#3FC1F0'},{d:'M20 86 V64 H40 V86Z',f:c},{d:'M24 64 V54 h12 V64',f:c},{d:'M27 56 v6 M33 56 v6',f:'none'},...palm(80,40)],
 bridge: (c) => [{d:'M0 84 H120 V120 H0Z',f:'#3FC1F0'},{d:'M6 60 H114 V84 H6Z',f:c},{d:'M14 84 V74 Q20 66 26 74 V84Z M36 84 V74 Q42 66 48 74 V84Z M58 84 V74 Q64 66 70 74 V84Z M80 84 V74 Q86 66 92 74 V84Z M100 84 V74 Q106 66 112 74 V84Z',f:DK},{d:'M14 68 h4 M36 68 h4 M58 68 h4 M80 68 h4 M100 68 h4',f:'none'}],
 river: (c) => [{d:'M0 90 Q40 82 60 88 T120 86 V120 H0Z',f:'#3FC1F0'},{d:'M16 90 V60 h14 V90Z',f:c},{d:'M86 90 V60 h14 V90Z',f:c},{d:'M30 64 H86',f:'none'},{d:'M30 64 Q58 84 86 64',f:'none'},...palm(58,30)],
 rock: (c) => [{d:'M6 92 C10 54 36 30 66 32 C98 34 114 60 114 92Z',f:c},{d:'M44 92 V64 Q60 46 76 64 V92Z',f:DK},{d:'M52 92 V70 Q60 60 68 70 V92Z',f:ST}],
 cone: (c) => [{d:'M0 92 Q60 78 120 92Z',f:'#7ED957'},{d:'M50 92 V44 H70 V92Z',f:c},{d:'M47 44 L60 14 L73 44Z',f:c},{d:'M55 92 V50 M65 92 V50',f:'none'}],
 fall: (c) => [{d:'M0 92 V40 Q20 30 44 36 V92Z',f:c},{d:'M120 92 V44 Q100 34 76 40 V92Z',f:c},{d:'M44 36 Q60 32 76 40 V92 H44Z',f:'#BFEFFF'},{d:'M52 44 V88 M60 40 V90 M68 44 V88',f:'none'},...tree(18,.9,'#3FA36B'),...tree(102,.9,'#3FA36B')],
 desert: (c) => [{d:'M0 92 Q30 72 64 86 Q90 74 120 88 V92Z',f:'#FFC93C'},{d:'M70 86 V64 h22 v22',f:c},{d:'M68 64 h26 l-4 -6 h-18Z',f:c},{d:'M78 86 V76 h6 V86',f:DK},...palm(32,30)],
 clock: (c) => [{d:'M50 92 V36 H70 V92Z',f:ST},{d:'M50 36 L60 14 L70 36Z',f:c},{d:E(60,48,7,7),f:CR},{d:'M60 48 v-4 M60 48 l3 2',f:'none'},{d:'M14 92 V70 H50 V92Z M70 92 V74 H106 V92Z',f:ST}],
 eiffel: (c) => [{d:'M38 92 Q54 62 57 18 h6 Q66 62 82 92 H72 Q60 74 48 92Z',f:c},{d:'M46 70 H74 M52 50 H68',f:'none'},{d:'M60 18 V8',f:'none'}],
 gate: (c) => [{d:'M18 92 V50 H102 V92Z',f:ST},{d:'M14 50 H106 V40 H14Z',f:c},{d:'M30 92 V58 h10 V92Z M55 92 V58 h10 V92Z M80 92 V58 h10 V92Z',f:DK},{d:'M54 40 v-10 h12 v10',f:c}],
 burj: (_c) => [{d:'M50 92 V54 h4 V36 h4 V18 L60 6 L62 18 V36 h4 V54 h4 V92Z',f:'#DDE4EF'},{d:'M20 92 V70 h12 V92Z M86 92 V64 h12 V92Z',f:ST}],
 hills: (c) => [{d:'M0 92 Q30 58 64 80 Q90 62 120 78 V92Z',f:c},...palm(34,46),...palm(86,36)],
 cn: (c) => [{d:'M57 92 L59 28 h2 L63 92Z',f:CR},{d:E(60,48,10,5),f:c},{d:'M60 28 V10',f:'none'},{d:'M18 92 V62 h14 V92Z M84 92 V56 h16 V92Z',f:'#8FDCFA'}],
 mosqueBlue: (c) => [{d:'M24 92 V66 H96 V92Z',f:ST},{d:'M36 66 C36 38 84 38 84 66Z',f:c},{d:'M28 66 C28 56 40 56 40 66 M80 66 C80 56 92 56 92 66',f:c},{d:'M12 92 V36 h6 V92Z M102 92 V36 h6 V92Z',f:ST},{d:'M12 36 l3 -12 l3 12Z M102 36 l3 -12 l3 12Z',f:c}],
 globe: () => [{ d: E(60, 64, 26, 26), f: '#3FC1F0' }, { d: 'M34 64 H86 M60 38 V90 M40 48 Q60 56 80 48 M40 80 Q60 72 80 80', f: 'none' }, { d: 'M50 50 q6 -4 10 2 q-2 8 -8 6Z M64 66 q8 -2 10 6 q-6 6 -12 0Z', f: '#7ED957' }, { d: 'M14 34 l10 4 l-10 4 l3 -4Z', f: W }, { d: 'M24 38 H40', f: 'none' }],
};
