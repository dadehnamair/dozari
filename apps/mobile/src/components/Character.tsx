import { useId } from 'react';
import { Platform, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  FeDisplacementMap,
  FeTurbulence,
  Filter,
  G,
  Path,
  Pattern,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { fonts } from '../theme/colors';
import { characterLook } from '../theme/character';
import type { CharacterCrop, CharacterId, CharacterPose } from '../theme/character';

const INK = '#3A2418';

interface Props {
  who?: CharacterId;
  pose?: CharacterPose;
  /** Solar Hijri month 1..12: the hero «dozari» wears that month's look (docs/design/Character.dc.html). */
  month?: number;
  crop?: CharacterCrop;
  width?: DimensionValue;
  height?: DimensionValue;
  /** Pencil-wobble displacement filter of the design. On by default on the web; native filter support is unverified, so off there. */
  wobble?: boolean;
}

/** Hand-drawn market characters (docs/design/Dozari - 04 Characters.dc.html), ported to react-native-svg. */
export function Character({
  who = 'dozari',
  pose = 'idle',
  month,
  crop = 'full',
  width = '100%',
  height = '100%',
  wobble = Platform.OS === 'web',
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fid = `${uid}f`;
  const pid = `${uid}p`;
  const L = characterLook({ who, pose, month, crop });
  const body =
    'M70 146C62 170 60 196 62 216Q100 226 138 216C140 196 138 170 130 146Q100 138 70 146Z';
  const pat = L.pattern;
  return (
    <View
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={L.viewBox} style={{ overflow: 'visible' }}>
        <Defs>
          {wobble ? (
            <Filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
              <FeTurbulence
                type="fractalNoise"
                baseFrequency="0.03"
                numOctaves={2}
                seed={L.seed}
                result="n"
              />
              <FeDisplacementMap
                in="SourceGraphic"
                in2="n"
                scale={3.4}
                xChannelSelector="R"
                yChannelSelector="G"
                result="d"
              />
            </Filter>
          ) : null}
          <Pattern
            id={pid}
            width={10}
            height={10}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${pat.rot})`}
          >
            <Rect width={pat.stripeW} height={10} fill={pat.color} />
            <Circle cx={5} cy={5} r={pat.dotR} fill={pat.color} />
          </Pattern>
        </Defs>
        <G
          filter={wobble ? `url(#${fid})` : undefined}
          stroke={INK}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {L.full ? (
            <G>
              <Ellipse cx={100} cy={250} rx={44} ry={6} fill={INK} opacity={0.16} stroke="none" />
              <Path d="M89 214L87 244M111 214L113 244" strokeWidth={9} fill="none" />
              <Path
                d="M89 214L87 244M111 214L113 244"
                stroke="#CFC9D6"
                strokeWidth={4.4}
                fill="none"
              />
              <Path
                d="M73 250C71 242 85 240 91 246C93 253 77 255 73 250Z"
                fill="#5A3A2A"
                strokeWidth={2.6}
              />
              <Path
                d="M127 250C129 242 115 240 109 246C107 253 123 255 127 250Z"
                fill="#5A3A2A"
                strokeWidth={2.6}
              />
              <Path d={L.arm.backD} strokeWidth={12} fill="none" />
              <Path d={L.arm.backD} stroke={L.cloth} strokeWidth={6.6} fill="none" />
              <Circle
                cx={L.arm.backHand[0]}
                cy={L.arm.backHand[1]}
                r={6.6}
                fill={L.skin}
                strokeWidth={2.6}
              />
              <Path d={body} fill={L.cloth} stroke="none" />
              <Path d={body} fill={`url(#${pid})`} stroke="none" />
              {L.beltD ? <Path d={L.beltD} fill={L.belt} strokeWidth={2.4} /> : null}
              <Path d={body} fill="none" strokeWidth={3.2} />
              {L.hero ? (
                <G>
                  <Circle cx={100} cy={200} r={7} fill="#FFC93C" strokeWidth={2.2} />
                  <Path d="M97 197q2-2 5-2" stroke="#fff" strokeWidth={1.6} fill="none" />
                  <Path d="M116 160L128 190L115 194L106 164Z" fill={L.scarf} strokeWidth={2.6} />
                  <Path
                    d="M114 176l8-3M118 186l8-3"
                    stroke={L.scarfLight}
                    strokeWidth={2.4}
                    fill="none"
                  />
                  <Path
                    d="M66 146C80 160 120 160 134 146C136 154 132 160 128 162C112 170 88 170 72 162C68 160 64 154 66 146Z"
                    fill={L.scarf}
                    strokeWidth={2.8}
                  />
                  <Path
                    d="M80 158l2 8M94 161l1 8M108 161l-1 8M121 158l-2 8"
                    stroke={L.scarfLight}
                    strokeWidth={2.4}
                    fill="none"
                  />
                </G>
              ) : null}
              <Path
                d="M73 160Q67 178 67 196"
                stroke="#fff"
                strokeWidth={2.4}
                opacity={0.6}
                fill="none"
              />
              <Path
                d="M127 168l5-3M128 175l5-3M129 182l5-3"
                strokeWidth={1.6}
                opacity={0.45}
                fill="none"
              />
            </G>
          ) : null}
          {L.hairBack ? (
            <G>
              <Path d={L.hairBack} strokeWidth={12} fill="none" />
              <Path d={L.hairBack} stroke={L.hatColor} strokeWidth={7} fill="none" />
            </G>
          ) : null}
          {L.hero ? (
            <G>
              <Ellipse cx={62} cy={98} rx={9} ry={12} fill={L.skin} strokeWidth={3} />
              <Path d="M62 92q-4 6 0 12" fill="none" strokeWidth={2} opacity={0.6} />
              <Ellipse cx={138} cy={98} rx={9} ry={12} fill={L.skin} strokeWidth={3} />
              <Path d="M138 92q4 6 0 12" fill="none" strokeWidth={2} opacity={0.6} />
            </G>
          ) : null}
          <Path d={L.headD} fill={L.skin} strokeWidth={3.4} />
          {L.hero ? (
            <G>
              <Path
                d="M72 36C60 36 56 46 61 52C54 57 59 66 66 63C71 59 70 52 75 47ZM128 36C140 36 144 46 139 52C146 57 141 66 134 63C129 59 130 52 125 47Z"
                fill="#4A2A1A"
                strokeWidth={2.6}
              />
              <Path
                d="M90 38C84 48 94 56 99 49C101 57 112 53 108 42Z"
                fill="#4A2A1A"
                strokeWidth={2.6}
              />
            </G>
          ) : null}
          <G transform={`translate(0 ${L.hatY}) rotate(${L.hatRot} 100 40)`}>
            <Path d={L.hat.d} fill={L.hat.fill} strokeWidth={3.2} />
            {L.hat.pat ? (
              <Path d={L.hat.pat} fill="none" stroke={L.hat.patC} strokeWidth={L.hat.patW} />
            ) : null}
            {L.hat.acc ? <Path d={L.hat.acc} fill={L.hat.accC} strokeWidth={2.4} /> : null}
            {L.hat.hl ? (
              <Path d={L.hat.hl} fill="none" stroke="#fff" strokeWidth={2.6} opacity={0.65} />
            ) : null}
            {L.hero ? (
              <G>
                <Circle cx={122} cy={42} r={8} fill="#FFC93C" strokeWidth={2.4} />
                <SvgText
                  x={122}
                  y={46.5}
                  textAnchor="middle"
                  fontFamily={fonts.display}
                  fontSize={11}
                  fill="#7A4A00"
                  stroke="none"
                >
                  ۲
                </SvgText>
              </G>
            ) : null}
          </G>
          <Ellipse cx={75} cy={104} rx={9} ry={6} fill="#FF7C70" opacity={0.45} stroke="none" />
          <Ellipse cx={125} cy={104} rx={9} ry={6} fill="#FF7C70" opacity={0.45} stroke="none" />
          {L.freckles ? (
            <Path d={L.freckles} stroke="#B8643A" strokeWidth={2.4} fill="none" opacity={0.7} />
          ) : null}
          {L.eye.open ? (
            <G>
              <Ellipse cx={88} cy={74} rx={L.eye.rx} ry={L.eye.ry} fill="#fff" strokeWidth={2.8} />
              <Ellipse cx={112} cy={74} rx={L.eye.rx} ry={L.eye.ry} fill="#fff" strokeWidth={2.8} />
              <Circle cx={L.eye.plx} cy={L.eye.py} r={L.eye.pr} fill="#2A1A12" stroke="none" />
              <Circle cx={L.eye.prx} cy={L.eye.py} r={L.eye.pr} fill="#2A1A12" stroke="none" />
              <Circle cx={L.eye.hlx} cy={L.eye.hly} r={1.5} fill="#fff" stroke="none" />
              <Circle cx={L.eye.hrx} cy={L.eye.hly} r={1.5} fill="#fff" stroke="none" />
              {L.eye.lid ? <Path d={L.eye.lid} fill={L.skin} strokeWidth={2.8} /> : null}
            </G>
          ) : null}
          {L.eye.lines ? <Path d={L.eye.lines} fill="none" strokeWidth={3.4} /> : null}
          {L.beard.d ? <Path d={L.beard.d} fill={L.beard.color} strokeWidth={3} /> : null}
          {L.beard.curl ? (
            <Path d={L.beard.curl} fill="none" strokeWidth={1.6} opacity={0.55} />
          ) : null}
          <G transform={`translate(0 ${L.mouthY})`}>
            <Path d={L.mouth.d} fill={L.mouth.f} strokeWidth={3} />
            {L.mouth.teeth ? <Path d={L.mouth.teeth} fill="#fff" strokeWidth={1.6} /> : null}
          </G>
          {L.mustache.d ? (
            <G transform={`translate(0 ${L.noseY})`}>
              <Path d={L.mustache.d} fill={L.mustache.color} strokeWidth={2.6} />
            </G>
          ) : null}
          <Path d={L.nose.d} fill={L.skin} strokeWidth={3} />
          <Ellipse
            cx={L.nose.tx}
            cy={L.nose.ty}
            rx={L.nose.rx}
            ry={L.nose.ry}
            fill="#F26B5E"
            opacity={0.55}
            stroke="none"
          />
          <Path d={L.nose.hl} fill="none" stroke="#fff" strokeWidth={2.4} opacity={0.85} />
          <Path d={L.eye.brow} fill="none" stroke={L.browColor} strokeWidth={4.4} />
          {L.glasses ? (
            <G>
              <Circle cx={88} cy={74} r={14.5} fill="#fff" fillOpacity={0.12} strokeWidth={2.6} />
              <Circle cx={112} cy={74} r={14.5} fill="#fff" fillOpacity={0.12} strokeWidth={2.6} />
              <Path d="M82 66q3-3 7-3" stroke="#fff" strokeWidth={2} fill="none" />
            </G>
          ) : null}
          <Path
            d="M66 90Q66 104 72 114"
            stroke="#fff"
            strokeWidth={2.6}
            opacity={0.5}
            fill="none"
          />
          <Path d="M148 84l5-2M149 92l5-2" strokeWidth={1.8} opacity={0.45} fill="none" />
          {L.full ? (
            <G>
              <Path d={L.arm.frontD} strokeWidth={12} fill="none" />
              <Path d={L.arm.frontD} stroke={L.cloth} strokeWidth={6.6} fill="none" />
              <Circle
                cx={L.arm.frontHand[0]}
                cy={L.arm.frontHand[1]}
                r={6.6}
                fill={L.skin}
                strokeWidth={2.6}
              />
              {L.arm.coin ? (
                <G transform={`translate(${L.arm.frontHand[0]} ${L.arm.frontHand[1] - 14})`}>
                  <Circle r={15} fill="#FFC93C" strokeWidth={3} />
                  <Circle r={10} fill="none" stroke="#C48A0E" strokeWidth={2} />
                  <SvgText
                    y={6}
                    textAnchor="middle"
                    fontFamily={fonts.display}
                    fontSize={17}
                    fill="#7A4A00"
                    stroke="none"
                  >
                    ۲
                  </SvgText>
                  <Path d="M-9-7q3-4 8-5" stroke="#fff" strokeWidth={2.4} fill="none" />
                </G>
              ) : null}
            </G>
          ) : null}
          {L.acc.map((a, i) => (
            <Path key={i} d={a.d} fill={a.fill} stroke={a.stroke} strokeWidth={a.width} />
          ))}
          {L.extras.q ? <Mark x={150} y={34} size={42} fill="#3FC1F0" text="؟" /> : null}
          {L.extras.z ? (
            <G>
              <Mark x={138} y={34} size={24} fill="#B0C4EF" text="z" />
              <Mark x={154} y={16} size={32} fill="#B0C4EF" text="Z" />
            </G>
          ) : null}
          {L.extras.sweat ? (
            <Path d="M146 46q-8 12 0 16q8-4 0-16z" fill="#8FDCFA" strokeWidth={2.2} />
          ) : null}
          {L.extras.tear ? (
            <Path d="M121 88q-7 11 0 15q7-4 0-15z" fill="#8FDCFA" strokeWidth={2.2} />
          ) : null}
          {L.extras.spark ? (
            <Path
              d="M36 26Q38 34 46 36Q38 38 36 46Q34 38 26 36Q34 34 36 26ZM168 12Q169.5 17.5 175 19Q169.5 20.5 168 26Q166.5 20.5 161 19Q166.5 17.5 168 12ZM176 64Q177 68 181 69Q177 70 176 74Q175 70 171 69Q175 68 176 64Z"
              fill="#FFC93C"
              strokeWidth={2}
            />
          ) : null}
        </G>
      </Svg>
    </View>
  );
}

/** Lalezar glyph with a brown outline (stroke first, fill on top, since SVG paint-order is not available). */
function Mark({
  x,
  y,
  size,
  fill,
  text,
}: {
  x: number;
  y: number;
  size: number;
  fill: string;
  text: string;
}) {
  return (
    <G>
      <SvgText
        x={x}
        y={y}
        fontFamily={fonts.display}
        fontSize={size}
        fill={INK}
        stroke={INK}
        strokeWidth={6}
      >
        {text}
      </SvgText>
      <SvgText x={x} y={y} fontFamily={fonts.display} fontSize={size} fill={fill} stroke="none">
        {text}
      </SvgText>
    </G>
  );
}
