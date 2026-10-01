import { View } from 'react-native';
import type { DimensionValue } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  Polygon,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { fonts } from '../theme/colors';
import { mascotLook } from '../theme/mascot';
import { monthSkin } from '../theme/month';
import { MonthAccessory } from './MonthAccessory';
import type { MascotCrop, MascotPose } from '../theme/mascot';

const INK = '#2B1240';
const HALO = '#FFF6E8';

interface Props {
  pose?: MascotPose;
  skin?: number;
  crop?: MascotCrop;
  width?: DimensionValue;
  height?: DimensionValue;
  /** Solar Hijri month 1..12: adds that month's costume and, unless `skin` is given, its colour. */
  month?: number;
  /** Cream outline under the dark limbs so they stay visible on dark screens (default on). */
  halo?: boolean;
}

/** The coin mascot (docs/design/Mascot.dc.html). `crop="face"` is the avatar crop. */
export function Mascot({
  pose = 'idle',
  skin,
  month,
  crop = 'full',
  width = '100%',
  height = '100%',
  halo = true,
}: Props) {
  const m = mascotLook(pose, skin ?? (month ? monthSkin(month) : 0), crop);
  const gid = `mg${m.skinIndex}`;
  return (
    <View
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={m.viewBox} style={{ overflow: 'visible' }}>
        <Defs>
          <RadialGradient id={gid} cx="34%" cy="28%" r="78%">
            <Stop offset="0" stopColor={m.skin.hi} />
            <Stop offset="0.55" stopColor={m.skin.base} />
            <Stop offset="1" stopColor={m.skin.rim} />
          </RadialGradient>
        </Defs>
        {m.full ? (
          <G>
            <Ellipse cx={100} cy={206} rx={48} ry={7} fill="#000" opacity={0.2} />
            {halo ? (
              <G>
                <Path
                  d="M86 166 L84 194 M114 166 L116 194"
                  stroke={HALO}
                  strokeWidth={13}
                  strokeLinecap="round"
                  fill="none"
                />
                <Ellipse cx={80} cy={198} rx={16} ry={10} fill={HALO} />
                <Ellipse cx={120} cy={198} rx={16} ry={10} fill={HALO} />
                <Path d={m.armL} stroke={HALO} strokeWidth={13} fill="none" strokeLinecap="round" />
                <Path d={m.armR} stroke={HALO} strokeWidth={13} fill="none" strokeLinecap="round" />
              </G>
            ) : null}
            <Path
              d="M86 166 L84 194 M114 166 L116 194"
              stroke={INK}
              strokeWidth={7}
              strokeLinecap="round"
              fill="none"
            />
            <Ellipse cx={80} cy={198} rx={13} ry={7} fill={INK} />
            <Ellipse cx={120} cy={198} rx={13} ry={7} fill={INK} />
            <Path d={m.armL} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />
            <Path d={m.armR} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />
          </G>
        ) : null}
        <Circle cx={100} cy={108} r={72} fill={m.skin.rim} stroke={INK} strokeWidth={5} />
        <Circle cx={100} cy={100} r={72} fill={`url(#${gid})`} stroke={INK} strokeWidth={5} />
        <Circle
          cx={100}
          cy={100}
          r={60}
          fill="none"
          stroke={m.skin.rim}
          strokeWidth={3}
          strokeDasharray="1 7"
          strokeLinecap="round"
          opacity={0.7}
        />
        <Ellipse
          cx={68}
          cy={56}
          rx={22}
          ry={9}
          fill="#fff"
          opacity={0.6}
          transform="rotate(-32 68 56)"
        />
        <Ellipse cx={58} cy={120} rx={11} ry={6} fill="#FF4D8D" opacity={0.45} />
        <Ellipse cx={142} cy={120} rx={11} ry={6} fill="#FF4D8D" opacity={0.45} />
        {m.eyes === 'open' ? (
          <G>
            <Ellipse
              cx={76}
              cy={m.ey}
              rx={14}
              ry={m.ery}
              fill="#fff"
              stroke={INK}
              strokeWidth={4}
            />
            <Ellipse
              cx={124}
              cy={m.ey}
              rx={14}
              ry={m.ery}
              fill="#fff"
              stroke={INK}
              strokeWidth={4}
            />
            <Circle cx={m.pupilLeftX} cy={m.pupilY} r={7.5} fill={INK} />
            <Circle cx={m.pupilRightX} cy={m.pupilY} r={7.5} fill={INK} />
            <Circle cx={m.glintLeftX} cy={m.glintY} r={2.6} fill="#fff" />
            <Circle cx={m.glintRightX} cy={m.glintY} r={2.6} fill="#fff" />
          </G>
        ) : null}
        {m.eyes === 'happy' ? (
          <Path
            d="M62 96 Q76 80 90 96 M110 96 Q124 80 138 96"
            stroke={INK}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        {m.eyes === 'closed' ? (
          <Path
            d="M62 92 Q76 102 90 92 M110 92 Q124 102 138 92"
            stroke={INK}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        {m.brow ? (
          <Path d={m.brow} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
        ) : null}
        <Path
          d={m.mouth}
          fill={m.mf}
          stroke={INK}
          strokeWidth={5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {m.tear ? (
          <Path
            d="M146 104 q-7 11 0 15 q7 -4 0 -15z"
            fill="#3FC1F0"
            stroke={INK}
            strokeWidth={2.5}
          />
        ) : null}
        {month ? <MonthAccessory month={month} /> : null}
        {m.crown ? (
          <G>
            <Polygon
              points="68,40 76,8 92,28 100,0 108,28 124,8 132,40"
              fill="#FFC93C"
              stroke={INK}
              strokeWidth={5}
              strokeLinejoin="round"
            />
            <Circle cx={100} cy={30} r={5} fill="#FF4D8D" />
          </G>
        ) : null}
        {m.full ? (
          <G>
            <Circle cx={m.gl[0]} cy={m.gl[1]} r={12} fill="#fff" stroke={INK} strokeWidth={4} />
            <Circle cx={m.gr[0]} cy={m.gr[1]} r={12} fill="#fff" stroke={INK} strokeWidth={4} />
            {m.x ? (
              <SvgText
                x={m.xx}
                y={m.xy}
                fontFamily={fonts.display}
                fontSize={46}
                fill={m.xc}
                stroke={INK}
                strokeWidth={6}
                strokeLinejoin="round"
              >
                {m.x}
              </SvgText>
            ) : null}
          </G>
        ) : null}
      </Svg>
    </View>
  );
}
