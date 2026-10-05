import type { ReactNode } from 'react';
import { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg';
import { fonts } from '../theme/colors';
import type { CharacterLook } from '../theme/character';
import { Motion } from './characterMotion';
import { MakeupBase, MakeupGloss, MakeupLiner, MakeupLip, MakeupMarks } from './makeupArt';
import { AccessoryArt, GlassesArt, HairArt, HatArt, OutfitArt, WearBack } from './wearArt';

export const INK = '#3A2418';

/** Parts of the hand-drawn character (Character.tsx composes them); coordinates are those of the design's 200x260 sheet. */
interface Look {
  L: CharacterLook;
}

/** Legs, shoes, back arm and torso (full body only). */
export function BodyArt({ L, pid, on, up, delay, outfitK, scarfK }: Look & { pid: string; on: boolean; up: boolean; delay: number; outfitK: string | null; scarfK: string | null }) {
  const body = 'M70 146C62 170 60 196 62 216Q100 226 138 216C140 196 138 170 130 146Q100 138 70 146Z';
  return (
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
              <Motion part="armBack" on={on} up={up}>
                <Path d={L.arm.backD} strokeWidth={12} fill="none" />
                <Path d={L.arm.backD} stroke={L.cloth} strokeWidth={6.6} fill="none" />
                <Circle
                  cx={L.arm.backHand[0]}
                  cy={L.arm.backHand[1]}
                  r={6.6}
                  fill={L.skin}
                  strokeWidth={2.6}
                />
              </Motion>
              <Motion part="body" on={on} delay={delay}>
              {outfitK ? <WearBack k={outfitK} /> : null}
              {scarfK ? <WearBack k={scarfK} /> : null}
              <Path d={body} fill={L.cloth} stroke="none" />
              <Path d={body} fill={`url(#${pid})`} stroke="none" />
              {L.beltD ? <Path d={L.beltD} fill={L.belt} strokeWidth={2.4} /> : null}
              <Path d={body} fill="none" strokeWidth={3.2} />
              {L.police ? (
                <G>
                  <Path d="M88 146L100 160L112 146" fill="none" strokeWidth={2.6} />
                  <Path d="M96 154L104 154L107 182L100 190L93 182Z" fill="#1E2A4A" strokeWidth={2.4} />
                  <Path d="M70 150Q78 144 88 148L86 156Q76 154 68 158Z M130 150Q122 144 112 148L114 156Q124 154 132 158Z" fill="#FFC93C" strokeWidth={2.2} />
                  <Path d="M120 166l2.4 5 5.4 .6-4 3.6 1.2 5.4-5-2.8-5 2.8 1.2-5.4-4-3.6 5.4-.6Z" fill="#FFC93C" strokeWidth={2} />
                  <Path d="M78 168h12M78 174h12" strokeWidth={2} fill="none" opacity={0.5} />
                </G>
              ) : null}
              {L.heroF ? (
                <G>
                  <Path d="M63 206Q100 216 137 206L148 234Q100 248 52 234Z" fill={L.cloth} strokeWidth={3} />
                  <Path d="M63 206Q100 216 137 206L148 234Q100 248 52 234Z" fill={`url(#${pid})`} stroke="none" />
                  <Path d="M54 228Q100 242 146 228" stroke="#FFC93C" strokeWidth={3.4} fill="none" />
                  <Path d="M60 222l3 6" stroke="#fff" strokeWidth={2.2} opacity={0.6} fill="none" />
                </G>
              ) : null}
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
              {outfitK ? <OutfitArt k={outfitK} /> : null}
              {scarfK ? <AccessoryArt k={scarfK} /> : null}
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
              </Motion>
            </G>
  );
}

/** Hair, ears, head shape, hair/hat (default or worn). */
export function HeadArt({ L, on, hairK, hatK }: Look & { on: boolean; hairK: string | null; hatK: string | null }) {
  return (
    <>
          {hairK ? <WearBack k={hairK} /> : null}
          {hatK ? <WearBack k={hatK} /> : null}
          {L.hairBack && !hairK ? (
            <G>
              <Path d={L.hairBack} strokeWidth={12} fill="none" />
              <Path d={L.hairBack} stroke={L.hairColor} strokeWidth={7} fill="none" />
            </G>
          ) : null}
          {L.ribbon && !hairK ? <Path d={L.ribbon} fill="#E8743B" strokeWidth={2.2} /> : null}
          {L.hero ? (
            <G>
              <Ellipse cx={62} cy={98} rx={9} ry={12} fill={L.skin} strokeWidth={3} />
              <Path d="M62 92q-4 6 0 12" fill="none" strokeWidth={2} opacity={0.6} />
              <Ellipse cx={138} cy={98} rx={9} ry={12} fill={L.skin} strokeWidth={3} />
              <Path d="M138 92q4 6 0 12" fill="none" strokeWidth={2} opacity={0.6} />
            </G>
          ) : null}
          <Path d={L.headD} fill={L.skin} strokeWidth={3.4} />
          {L.hero && !L.heroF && !hairK ? (
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
          {L.heroF && !hairK ? (
            <G>
              <Path d="M66 60C62 40 80 30 100 32C120 30 138 40 134 60C128 50 120 46 112 52C106 44 96 44 90 52C82 46 72 50 66 60Z" fill="#4A2A1A" strokeWidth={2.6} />
              <Path d="M76 46Q84 40 92 40" stroke="#fff" strokeWidth={2} opacity={0.45} fill="none" />
            </G>
          ) : null}
          {hairK ? <HairArt k={hairK} /> : null}
          {hatK || hairK ? null : (
          <G transform={`translate(0 ${L.hatY}) rotate(${L.hatRot} 100 40)`}>
            <Path d={L.hat.d} fill={L.hat.fill} strokeWidth={3.2} />
            {L.hat.pat ? (
              <Path d={L.hat.pat} fill="none" stroke={L.hat.patC} strokeWidth={L.hat.patW} />
            ) : null}
            {L.hat.acc ? <Path d={L.hat.acc} fill={L.hat.accC} strokeWidth={2.4} /> : null}
            {L.hat.hl ? (
              <Path d={L.hat.hl} fill="none" stroke="#fff" strokeWidth={2.6} opacity={0.65} />
            ) : null}
            {L.police ? (
              <G>
                <Circle cx={100} cy={40} r={8} fill="#FFC93C" strokeWidth={2.4} />
                <Path d="M100 34.5l1.6 3.4 3.7 .4-2.7 2.5 .8 3.7-3.4-1.9-3.4 1.9 .8-3.7-2.7-2.5 3.7-.4Z" fill="#C48A0E" stroke="none" />
              </G>
            ) : null}
            {L.hero ? (
              <G>
                <Motion part="coin" on={on}>
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
                </Motion>
              </G>
            ) : null}
          </G>
          )}
          {hatK ? <HatArt k={hatK} /> : null}
    </>
  );
}

/** Cheeks, eyes, beard, mouth, nose, brow, glasses. */
export function FaceArt({ L, on, delay, glassesK, makeupK }: Look & { on: boolean; delay: number; glassesK: string | null; makeupK: string | null }) {
  return (
    <>
          {makeupK ? <MakeupBase k={makeupK} eyesOpen={L.eye.open} /> : null}
          <Ellipse cx={75} cy={104} rx={9} ry={6} fill="#FF7C70" opacity={0.45} stroke="none" />
          <Ellipse cx={125} cy={104} rx={9} ry={6} fill="#FF7C70" opacity={0.45} stroke="none" />
          {L.freckles ? (
            <Path d={L.freckles} stroke="#B8643A" strokeWidth={2.4} fill="none" opacity={0.7} />
          ) : null}
          <Motion part="eyes" on={on} delay={delay}>
          {L.eye.open ? (
            <G>
              <Ellipse cx={88} cy={74} rx={L.eye.rx} ry={L.eye.ry} fill="#fff" strokeWidth={2.8} />
              <Ellipse cx={112} cy={74} rx={L.eye.rx} ry={L.eye.ry} fill="#fff" strokeWidth={2.8} />
              <Circle cx={L.eye.plx} cy={L.eye.py} r={L.eye.pr} fill="#2A1A12" stroke="none" />
              <Circle cx={L.eye.prx} cy={L.eye.py} r={L.eye.pr} fill="#2A1A12" stroke="none" />
              <Circle cx={L.eye.hlx} cy={L.eye.hly} r={1.5} fill="#fff" stroke="none" />
              <Circle cx={L.eye.hrx} cy={L.eye.hly} r={1.5} fill="#fff" stroke="none" />
              {L.eye.lid ? <Path d={L.eye.lid} fill={L.skin} strokeWidth={2.8} /> : null}
              {L.heroF ? <Path d="M77 68l-6-4M78 63l-4-6M123 68l6-4M122 63l4-6" strokeWidth={2.4} fill="none" /> : null}
            </G>
          ) : null}
          {L.eye.lines ? <Path d={L.eye.lines} fill="none" strokeWidth={3.4} /> : null}
          </Motion>
          {makeupK ? <MakeupLiner k={makeupK} eyesOpen={L.eye.open} /> : null}
          {L.beard.d ? <Path d={L.beard.d} fill={L.beard.color} strokeWidth={3} /> : null}
          {L.beard.curl ? (
            <Path d={L.beard.curl} fill="none" strokeWidth={1.6} opacity={0.55} />
          ) : null}
          <G transform={`translate(0 ${L.mouthY})`}>
            {makeupK ? <MakeupLip k={makeupK} mouthD={L.mouth.d} /> : null}
            <Path d={L.mouth.d} fill={L.mouth.f} strokeWidth={3} />
            {makeupK ? <MakeupGloss k={makeupK} /> : null}
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
          {makeupK ? <MakeupMarks k={makeupK} /> : null}
          <Path d={L.eye.brow} fill="none" stroke={L.browColor} strokeWidth={4.4} />
          {glassesK ? <GlassesArt k={glassesK} /> : L.glasses ? (
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
    </>
  );
}

/** Front arm (full body only). */
export function FrontArm({ L, on, up }: Look & { on: boolean; up: boolean }): ReactNode {
  return (
            <Motion part="armFront" on={on} up={up}>
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
            </Motion>
  );
}

/** Accessories and mood marks (question mark, sleep, sweat, tear, sparkle). */
export function ExtrasArt({ L }: Look) {
  return (
    <>
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
    </>
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
