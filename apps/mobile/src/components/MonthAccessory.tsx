import { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';
import { solarMonthKey } from '@dozari/shared';

const INK = '#2B1240';
const SW = 4;

/** Month costume drawn over the mascot's head (200-wide grid, head circle centre 100,100 radius 72). */
export function MonthAccessory({ month }: { month: number }) {
  switch (solarMonthKey(month)) {
    case 'farvardin': // spring blossoms
      return (
        <G>
          {[
            [66, 40, '#FFC9DC'],
            [96, 30, '#FFFFFF'],
            [128, 40, '#FFC9DC'],
          ].map(([x, y, c]) => (
            <G key={String(x)}>
              <Circle cx={Number(x)} cy={Number(y)} r={11} fill={String(c)} stroke={INK} strokeWidth={3} />
              <Circle cx={Number(x)} cy={Number(y)} r={4} fill="#FFC93C" />
            </G>
          ))}
          <Path d="M82 38 q6 -10 14 -6 q-4 10 -14 6z M112 34 q8 -4 14 4 q-8 6 -14 -4z" fill="#7ED957" stroke={INK} strokeWidth={2.5} />
        </G>
      );
    case 'ordibehesht': // rose
      return (
        <G>
          <Path d="M140 44 q18 -2 22 14 q-14 6 -22 -14z" fill="#7ED957" stroke={INK} strokeWidth={3} />
          <Circle cx={138} cy={38} r={15} fill="#FF4D8D" stroke={INK} strokeWidth={SW} />
          <Path d="M130 38 q8 -10 16 0 M132 44 q6 -6 12 0" stroke="#B8235A" strokeWidth={3} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'khordad': // straw hat
      return (
        <G>
          <Path d="M58 50 Q60 14 100 14 Q140 14 142 50 Z" fill="#F2D27A" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <Path d="M58 40 L142 40" stroke="#FF7A3D" strokeWidth={7} />
          <Ellipse cx={100} cy={52} rx={74} ry={11} fill="#F2D27A" stroke={INK} strokeWidth={SW} />
        </G>
      );
    case 'tir': // sunglasses
      return (
        <G>
          <Rect x={54} y={78} width={42} height={30} rx={13} fill={INK} />
          <Rect x={104} y={78} width={42} height={30} rx={13} fill={INK} />
          <Path d="M96 90 L104 90 M54 88 L40 82 M146 88 L160 82" stroke={INK} strokeWidth={SW} />
          <Path d="M62 84 L72 84 M112 84 L122 84" stroke="#fff" strokeWidth={3} opacity={0.7} strokeLinecap="round" />
        </G>
      );
    case 'mordad': // cooling towel band + sweat drop
      return (
        <G>
          <Path d="M32 62 Q100 22 168 62 L164 78 Q100 40 36 78 Z" fill="#3FC1F0" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <Path d="M60 48 L66 70 M96 38 L98 62 M132 46 L128 68" stroke="#fff" strokeWidth={4} opacity={0.8} strokeLinecap="round" />
          <Path d="M158 96 q-7 11 0 15 q7 -4 0 -15z" fill="#8FDCFA" stroke={INK} strokeWidth={2.5} />
        </G>
      );
    case 'shahrivar': // pencil behind the ear, school is near
      return (
        <G transform="rotate(28 150 50)">
          <Rect x={140} y={14} width={16} height={56} rx={3} fill="#FFC93C" stroke={INK} strokeWidth={3} />
          <Rect x={140} y={14} width={16} height={9} rx={3} fill="#FF4D8D" stroke={INK} strokeWidth={3} />
          <Polygon points="140,70 156,70 148,84" fill="#FFE48A" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </G>
      );
    case 'mehr': // school beret
      return (
        <G>
          <Path d="M46 52 Q50 14 104 16 Q150 18 154 50 Q100 40 46 52Z" fill="#6B35B8" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <Circle cx={104} cy={14} r={6} fill="#FFC93C" stroke={INK} strokeWidth={3} />
          <Path d="M148 44 q18 2 18 16 q-14 0 -18 -16z" fill="#FF7A3D" stroke={INK} strokeWidth={3} />
        </G>
      );
    case 'aban': // autumn leaf crown
      return (
        <G>
          {[
            [60, 44, -30, '#FF7A3D'],
            [100, 30, 0, '#FFC93C'],
            [140, 44, 30, '#B9481A'],
          ].map(([x, y, r, c]) => (
            <G key={String(x)} transform={`rotate(${Number(r)} ${Number(x)} ${Number(y)})`}>
              <Path d={`M${Number(x)} ${Number(y) - 18} Q${Number(x) + 16} ${Number(y)} ${Number(x)} ${Number(y) + 14} Q${Number(x) - 16} ${Number(y)} ${Number(x)} ${Number(y) - 18}Z`} fill={String(c)} stroke={INK} strokeWidth={3} />
              <Path d={`M${Number(x)} ${Number(y) - 12} L${Number(x)} ${Number(y) + 12}`} stroke={INK} strokeWidth={2} />
            </G>
          ))}
        </G>
      );
    case 'azar': // pomegranate hat (Yalda)
      return (
        <G>
          <Circle cx={100} cy={34} r={22} fill="#D6213F" stroke={INK} strokeWidth={SW} />
          <Polygon points="88,18 92,6 100,14 108,6 112,18" fill="#B01530" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M88 34 q4 -8 10 -2 M104 40 q6 -8 10 0" stroke="#FF8FA0" strokeWidth={3} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'dey': // snow beanie
      return (
        <G>
          <Path d="M44 58 Q48 12 100 12 Q152 12 156 58 Z" fill="#3FC1F0" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <Rect x={40} y={50} width={120} height={16} rx={8} fill="#FFFFFF" stroke={INK} strokeWidth={SW} />
          <Circle cx={100} cy={10} r={9} fill="#fff" stroke={INK} strokeWidth={3} />
          <Circle cx={170} cy={30} r={3} fill="#fff" />
          <Circle cx={30} cy={24} r={3} fill="#fff" />
        </G>
      );
    case 'bahman': // earmuffs
      return (
        <G>
          <Path d="M34 100 Q34 20 100 20 Q166 20 166 100" stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
          <Path d="M34 100 Q34 20 100 20 Q166 20 166 100" stroke="#C9A3FF" strokeWidth={4} fill="none" strokeLinecap="round" />
          <Circle cx={32} cy={106} r={17} fill="#A66BF0" stroke={INK} strokeWidth={SW} />
          <Circle cx={168} cy={106} r={17} fill="#A66BF0" stroke={INK} strokeWidth={SW} />
        </G>
      );
    default: // esfand: a sprout of sabzeh on top, spring is coming
      return (
        <G>
          <Path d="M100 32 L100 52" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <Path d="M100 32 L100 52" stroke="#3F8F1F" strokeWidth={4} strokeLinecap="round" />
          <Path d="M100 36 Q74 34 70 12 Q96 10 100 36Z" fill="#7ED957" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Path d="M100 36 Q126 34 130 12 Q104 10 100 36Z" fill="#B8F08F" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </G>
      );
  }
}
