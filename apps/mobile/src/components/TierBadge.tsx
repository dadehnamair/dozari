import Svg, { Defs, LinearGradient, Polygon, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { fa } from '../i18n/fa';
import { toPersianDigits } from '@dozari/shared';
import type { TierSpec } from '../kit/data';
import { fonts } from '../theme/colors';

const SHIELD = '50,0 100,15 100,62 50,100 0,62 0,15';
const GLOSS = '50,1 99,15.5 99,46 1,46 1,15.5';

/** Hexagonal rank shield with a glossy top and the tier number (docs/design kit, section I). */
export function TierBadge({ tier, size = 112 }: { tier: TierSpec; size?: number }) {
  const id = `tier${tier.tier}`;
  const name = fa.kit.tiers[tier.tier - 1] ?? '';
  return (
    <Svg width={size} height={size * 1.143} viewBox="-6 -4 112 114" accessibilityLabel={name}>
      <Defs>
        <RadialGradient id={id} cx="35%" cy="25%" r="85%">
          <Stop offset="0" stopColor={tier.light} />
          <Stop offset="0.55" stopColor={tier.base} />
          <Stop offset="1" stopColor={tier.dark} />
        </RadialGradient>
        <LinearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.45} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polygon points={SHIELD} fill="#000" opacity={0.3} transform="translate(0 6)" />
      <Polygon points={SHIELD} fill="#2B1240" stroke="#2B1240" strokeWidth={8} strokeLinejoin="round" />
      <Polygon points={SHIELD} fill={`url(#${id})`} />
      <Polygon points={GLOSS} fill={`url(#${id}g)`} />
      <SvgText x={50} y={66} textAnchor="middle" fontFamily={fonts.display} fontSize={54} fill={tier.dark} transform="translate(0 3)">
        {toPersianDigits(String(tier.tier))}
      </SvgText>
      <SvgText x={50} y={66} textAnchor="middle" fontFamily={fonts.display} fontSize={54} fill="#fff" stroke="#2B1240" strokeWidth={1} strokeLinejoin="round">
        {toPersianDigits(String(tier.tier))}
      </SvgText>
    </Svg>
  );
}
