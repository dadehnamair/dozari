import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { Province } from '@dozari/shared';
import { colors } from '../theme/colors';
import { SHAPES } from '../theme/province-art';

const STROKE = '#3A2418';

/**
 * Round province badge of `docs/design/Dozari - 18 Provinces`: the ring colour, a sky, the sun, the ground and the
 * landmark drawing, clipped to a circle. `sunLeft` alternates the sun so a grid of badges looks less uniform.
 */
export function ProvinceBadge({ province, size = 96, sunLeft = false }: { province: Province; size?: number; sunLeft?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const parts = (SHAPES[province.shape] ?? SHAPES.globe!)(province.ring);
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <ClipPath id={`${uid}c`}>
            <Circle cx={60} cy={60} r={50} />
          </ClipPath>
          <LinearGradient id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={province.sky[0]} />
            <Stop offset="1" stopColor={province.sky[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={60} cy={60} r={57} fill={province.ring} stroke={colors.ink} strokeWidth={3.4} />
        <Circle cx={60} cy={60} r={57} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={2} strokeDasharray="2 6" />
        <G clipPath={`url(#${uid}c)`}>
          <Rect x={0} y={0} width={120} height={120} fill={`url(#${uid}g)`} />
          <Circle cx={sunLeft ? 32 : 88} cy={34} r={11} fill="#FFF4B0" opacity={0.9} />
          <Rect x={0} y={90} width={120} height={30} fill={province.ground} />
          <G stroke={STROKE} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round">
            {parts.map((p, i) => <Path key={i} d={p.d} fill={p.f} />)}
          </G>
        </G>
        <Circle cx={60} cy={60} r={50} fill="none" stroke={colors.ink} strokeWidth={3.4} />
      </Svg>
    </View>
  );
}
