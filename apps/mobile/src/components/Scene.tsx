import { useId, useState } from 'react';
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
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { usePrefs } from '../prefs/store';
import { fonts } from '../theme/colors';
import { useTheme } from '../theme/themeStore';
import { Breathe, Drift, Glow, Musician, Sway, Turn } from './sceneMotion';

export const SCENES = ['bazaar', 'alley', 'hojre', 'caravan', 'win', 'sarafi'] as const;
export type SceneName = (typeof SCENES)[number];

const rays = () => {
  let d = '';
  const cx = 195;
  const cy = 380;
  const R = 900;
  for (let i = 0; i < 18; i++) {
    const a = (i * 20 * Math.PI) / 180;
    const c = ((i * 20 + 10) * Math.PI) / 180;
    d += `M${cx} ${cy} L${(cx + R * Math.cos(a)).toFixed(0)} ${(cy + R * Math.sin(a)).toFixed(0)} L${(cx + R * Math.cos(c)).toFixed(0)} ${(cy + R * Math.sin(c)).toFixed(0)}Z `;
  }
  return d;
};
const RAYS = rays();
/** The vault-room floor diamonds (a 48 px cross-hatch), as one path: Android paints no SVG that contains a <Pattern>. */
const FLOOR_TILES = (() => {
  let d = '';
  for (let x = -208; x < 390; x += 48) d += `M${x} 640 L${x + 204} 844 `;
  for (let x = 0; x < 600; x += 48) d += `M${x} 640 L${x - 204} 844 `;
  return d;
})();
const CLOUD = 'M-40 6 C-52 4 -50 -14 -36 -12 C-34 -26 -14 -28 -8 -16 C-2 -28 22 -26 22 -12 C38 -16 46 2 32 8 C30 18 12 18 6 10 C0 18 -18 18 -22 10 C-30 16 -42 14 -40 6Z';
const FLAG_COLORS = ['#FF4D8D', '#3FC1F0', '#7ED957', '#A66BF0', '#FFF6E8'];
const FLAGS = Array.from({ length: 11 }, (_, i) => {
  const t = (i + 0.5) / 11;
  const x = -10 + 410 * t;
  const y = 90 + 80 * 4 * t * (1 - t);
  return {
    d: `M${(x - 12).toFixed(1)} ${(y - 2).toFixed(1)} L${(x + 12).toFixed(1)} ${(y - 2).toFixed(1)} L${x.toFixed(1)} ${(y + 24).toFixed(1)}Z`,
    c: FLAG_COLORS[i % 5] as string,
  };
});

interface Props {
  scene: SceneName;
  /** `dusk` multiplies a night-blue over the scene (bg-lose). */
  mood?: 'day' | 'dusk';
  width?: DimensionValue;
  height?: DimensionValue;
  /** Pencil-wobble filter of the design: on for the web, off on native until filters are verified there. */
  wobble?: boolean;
  /** Clouds drift, lanterns glow, the palm sways. Defaults to on unless the player chose reduced motion. */
  animated?: boolean;
}

/** Painted backgrounds (docs/design/Dozari - 02 Backgrounds.dc.html, Scene.dc.html), 390 x 844 canvas, cropped to fill. */
export function Scene({
  scene: sceneProp,
  mood: moodProp = 'day',
  width = '100%',
  height = '100%',
  wobble: wobbleProp = Platform.OS === 'web',
  animated: animatedProp,
}: Props) {
  /** The adult look paints every scene but the celebration as the vault room (docs/design/adult/). */
  const adult = useTheme() === 'adult';
  const scene = adult && sceneProp !== 'win' ? 'sarafi' : sceneProp;
  const mood = adult ? 'day' : moodProp;
  const reduce = usePrefs().reduceMotion;
  const animated = animatedProp ?? !reduce;
  // The pencil-wobble filter over the whole scene is recomputed on every animation frame (60 → 25 fps even on a desktop,
  // far worse on phones, where the clouds, lanterns and palm then barely move): a moving scene is drawn without it.
  const wobble = wobbleProp && !animated;
  const u = useId().replace(/[^a-zA-Z0-9]/g, '');
  // Android paints a percent-sized Svg inside an absolute layer as nothing (see GradientFill): draw at the measured pixel size.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      style={{ width, height, overflow: 'hidden' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
      }}
    >
      <Svg width={size?.w ?? '100%'} height={size?.h ?? '100%'} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Defs>
          {wobble ? (
            <Filter id={`${u}p`} x="-5%" y="-5%" width="110%" height="110%">
              <FeTurbulence
                type="fractalNoise"
                baseFrequency="0.022"
                numOctaves={2}
                seed={7}
                result="n"
              />
              <FeDisplacementMap
                in="SourceGraphic"
                in2="n"
                scale={5}
                xChannelSelector="R"
                yChannelSelector="G"
                result="d"
              />
            </Filter>
          ) : null}
          <LinearGradient id={`${u}skyA`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7ED6DA" />
            <Stop offset="0.42" stopColor="#BDEBE0" />
            <Stop offset="0.6" stopColor="#FBE6BF" />
          </LinearGradient>
          <LinearGradient id={`${u}skyB`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4FC4C4" />
            <Stop offset="0.6" stopColor="#A8E6D6" />
          </LinearGradient>
          <LinearGradient id={`${u}wall`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#EBC07C" />
            <Stop offset="1" stopColor="#D29652" />
          </LinearGradient>
          <RadialGradient id={`${u}win`} cx="50%" cy="42%" r="70%">
            <Stop offset="0" stopColor="#FFF4B0" />
            <Stop offset="0.4" stopColor="#FFC93C" />
            <Stop offset="1" stopColor="#FF7A3D" />
          </RadialGradient>
          <RadialGradient id={`${u}glow`} cx="50%" cy="100%" r="90%">
            <Stop offset="0" stopColor="#FFE0A0" />
            <Stop offset="0.35" stopColor="#E0803E" />
            <Stop offset="0.75" stopColor="#7A3418" />
            <Stop offset="1" stopColor="#3E1A0C" />
          </RadialGradient>
          <RadialGradient id={`${u}lg`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFE48A" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#FFE48A" stopOpacity={0} />
          </RadialGradient>
          {adult ? null : (
            <>
          <Pattern id={`${u}aR`} width={24} height={10} patternUnits="userSpaceOnUse">
            <Rect width={12} height={10} fill="#E84A3C" />
            <Rect x={12} width={12} height={10} fill="#FFF3E0" />
          </Pattern>
          <Pattern id={`${u}aG`} width={24} height={10} patternUnits="userSpaceOnUse">
            <Rect width={12} height={10} fill="#3FA36B" />
            <Rect x={12} width={12} height={10} fill="#FFF3E0" />
          </Pattern>
          <Pattern id={`${u}br`} width={28} height={14} patternUnits="userSpaceOnUse">
            <Rect width={28} height={14} fill="#E5884A" />
            <Path
              d="M0 13.5 H28 M0 6.5 H28 M14 0 V7 M1 7 V14"
              stroke="#B85A2A"
              strokeWidth={1.6}
              fill="none"
              opacity={0.7}
            />
          </Pattern>
            </>
          )}
          <LinearGradient id={`${u}sfW`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2E1D14" />
            <Stop offset="0.6" stopColor="#1E130D" />
            <Stop offset="1" stopColor="#120B07" />
          </LinearGradient>
          <RadialGradient id={`${u}sfV`} cx="40%" cy="35%" r="75%">
            <Stop offset="0" stopColor="#FFF1B8" />
            <Stop offset="0.35" stopColor="#E8B64A" />
            <Stop offset="0.75" stopColor="#B8822A" />
            <Stop offset="1" stopColor="#6A4210" />
          </RadialGradient>
          <RadialGradient id={`${u}sfG`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFD98A" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFD98A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G
          filter={wobble ? `url(#${u}p)` : undefined}
          stroke="#4A2E1E"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {paint(scene, u, animated)}
        </G>
        {mood === 'dusk' ? <Rect width={390} height={844} fill="#27306E" opacity={0.5} /> : null}
      </Svg>
    </View>
  );
}

function paint(scene: SceneName, u: string, animated: boolean) {
  switch (scene) {
    case 'bazaar':
      return (
        <>
          <Rect width={390} height={844} fill={`url(#${u}skyA)`} stroke="none" />
          <Circle cx={300} cy={150} r={110} fill={`url(#${u}lg)`} stroke="none" opacity={0.7} />
          <G fill="#FFFFFF" stroke="#7DBFC2" strokeWidth={2.2}>
            <Drift from={-156} to={374} dur={70} begin={-20.6} animated={animated}>
              <Path transform="translate(86 140)" d={CLOUD} />
            </Drift>
            <Drift from={-370} to={160} dur={55} begin={-38.4} animated={animated}>
              <Path transform="translate(300 260) scale(.75)" d={CLOUD} />
            </Drift>
            <Drift from={-240} to={290} dur={85} begin={-38.5} animated={animated}>
              <Path transform="translate(170 350) scale(.55)" d={CLOUD} />
            </Drift>
          </G>
          <G fill="#E8CBB6" stroke="#C7A08B" strokeWidth={2}>
            <Path d="M0 470 V440 h60 v-10 h30 v10 h40 V470Z M260 470 V436 h50 v-10 h30 v10 h60 V470Z" />
            <Path d="M98 470 V380 h14 V470Z M96 380 l9 -16 l9 16Z M278 470 V390 h14 V470Z M276 390 l9 -16 l9 16Z" />
            <Path d="M140 460 V440 h110 v20Z M150 440 C150 384 240 384 240 440Z M195 392 v-16" />
          </G>
          <Path d="M0 460 h122 v190 h-122Z" fill="#EDB46A" />
          <Path d="M268 460 h122 v190 h-122Z" fill="#E9A85C" />
          <Path d="M-4 452 h130 v14 h-130Z M264 452 h130 v14 h-130Z" fill="#C98A4E" />
          <Path d="M0 474 h122 v8 h-122Z M268 474 h122 v8 h-122Z" fill="#3E93B8" />
          <Path
            d="M30 530 V510 C30 494 54 494 54 510 V530Z M70 530 V510 C70 494 94 494 94 510 V530Z M296 530 V510 C296 494 320 494 320 510 V530Z M336 530 V510 C336 494 360 494 360 510 V530Z"
            fill="#5A2A14"
          />
          <Path
            d="M8 492 h34 M60 500 h44 M14 540 h28 M276 492 h40 M330 540 h40 M290 500 h24"
            stroke="#FFF3DC"
            strokeWidth={3}
            opacity={0.5}
            fill="none"
          />
          <Path
            d="M108 488 l8 -6 M108 498 l8 -6 M108 508 l8 -6 M272 500 l8 -6 M272 510 l8 -6"
            strokeWidth={1.6}
            opacity={0.4}
            fill="none"
          />
          <Path d="M-6 548 h136 l-12 30 h-112Z" fill={`url(#${u}aR)`} />
          <Path d="M260 548 h136 l-12 30 h-112Z" fill={`url(#${u}aG)`} />
          <Path
            d="M6 578 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0"
            fill="#E84A3C"
          />
          <Path
            d="M272 578 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0"
            fill="#3FA36B"
          />
          <Path d="M4 586 h110 v64 h-110Z M276 586 h110 v64 h-110Z" fill="#6A3018" />
          <Path d="M-4 616 h124 v12 h-124Z M270 616 h124 v12 h-124Z" fill="#B8743E" />
          <G strokeWidth={2}>
            <Circle cx={14} cy={607} r={9} fill="#FF5A4A" />
            <Circle cx={31} cy={605} r={9} fill="#FFB23F" />
            <Circle cx={48} cy={607} r={9} fill="#7ED957" />
            <Circle cx={65} cy={605} r={9} fill="#FF5A4A" />
            <Ellipse cx={94} cy={602} rx={17} ry={13} fill="#3FA36B" />
          </G>
          <Path
            d="M84 594 q10 8 20 0 M82 604 q12 6 24 0 M11 602 q2 -3 5 -3 M28 600 q2 -3 5 -3 M62 600 q2 -3 5 -3"
            stroke="#fff"
            strokeWidth={1.8}
            fill="none"
            opacity={0.7}
          />
          <Path d="M8 628 h46 v22 h-46Z M62 628 h46 v22 h-46Z" fill="#D9A15E" />
          <Path d="M8 639 h46 M62 639 h46" fill="none" strokeWidth={1.6} />
          <Path
            d="M286 616 C278 610 278 592 288 588 V580 h10 v8 C308 592 308 610 300 616Z"
            fill="#C46A3A"
          />
          <Path
            d="M316 616 C306 610 306 594 316 590 V584 h12 v6 C338 594 338 610 328 616Z"
            fill="#3E93B8"
          />
          <Path
            d="M348 616 C340 612 340 596 350 594 V586 h8 v8 C366 596 366 612 358 616Z"
            fill="#E8B04A"
          />
          <Path
            d="M285 600 q2 -6 6 -8 M314 602 q2 -6 6 -8"
            stroke="#fff"
            strokeWidth={2}
            fill="none"
            opacity={0.7}
          />
          <Path
            d="M282 650 C276 636 284 628 300 630 C316 628 324 636 318 650Z M330 650 C324 636 332 628 348 630 C364 628 372 636 366 650Z"
            fill="#F2E2C2"
          />
          <Path d="M286 634 C292 624 308 624 314 634Z" fill="#E8743B" />
          <Path d="M334 634 C340 624 356 624 362 634Z" fill="#FFC93C" />
          <Path d="M122 420 h146 v230 h-146Z" fill="#F4CB8E" />
          <Path
            d="M114 410 h162 v16 h-162Z M122 410 v-10 h16 v10Z M154 410 v-10 h16 v10Z M187 410 v-10 h16 v10Z M220 410 v-10 h16 v10Z M252 410 v-10 h16 v10Z"
            fill="#C98A4E"
          />
          <Path d="M138 650 V520 C138 462 252 462 252 520 V650Z" fill="#3E93B8" />
          <Path
            d="M144 650 V522 C144 470 246 470 246 522 V650"
            fill="none"
            stroke="#FFF6E8"
            strokeWidth={2.4}
            strokeDasharray="1 7"
          />
          <Path d="M150 650 V524 C150 482 240 482 240 524 V650Z" fill={`url(#${u}glow)`} />
          <Path
            d="M168 650 V562 C168 534 222 534 222 562 V650Z"
            fill="#8A3E1A"
            opacity={0.5}
            strokeWidth={1.6}
          />
          <Path
            d="M182 650 V592 C182 574 208 574 208 592 V650Z"
            fill="#FFE2A8"
            opacity={0.85}
            strokeWidth={1.4}
          />
          <Circle cx={146} cy={446} r={9} fill="#FFC93C" />
          <Circle cx={244} cy={446} r={9} fill="#FFC93C" />
          <Path d="M164 432 h62 v26 h-62Z" fill="#FFF6E8" />
          <SvgText
            x={195}
            y={452}
            textAnchor="middle"
            fontFamily={fonts.display}
            fontSize={19}
            fill="#3A2418"
            stroke="none"
          >
            بازار
          </SvgText>
          <Path d="M122 500 Q195 556 268 500" fill="none" strokeWidth={1.6} />
          <G transform="translate(158 522)">
            <Glow r={20} radii={[20,23,19,22,20]} dur={1.3} fill={`url(#${u}lg)`} animated={animated} />
            <Path d="M0 0 v5" fill="none" />
            <Path d="M-7 5 C-10 14 -7 23 0 25 C7 23 10 14 7 5Z" fill="#FF5C8A" />
          </G>
          <G transform="translate(195 528)">
            <Glow r={22} radii={[22,25,21,24,22]} dur={1.7} fill={`url(#${u}lg)`} animated={animated} />
            <Path d="M0 0 v5" fill="none" />
            <Path d="M-8 5 C-11 15 -8 25 0 27 C8 25 11 15 8 5Z" fill="#FFC93C" />
          </G>
          <G transform="translate(232 522)">
            <Glow r={20} radii={[20,22,19,23,20]} dur={1.1} fill={`url(#${u}lg)`} animated={animated} />
            <Path d="M0 0 v5" fill="none" />
            <Path d="M-7 5 C-10 14 -7 23 0 25 C7 23 10 14 7 5Z" fill="#3FC1F0" />
          </G>
          <Path d="M0 650 h390 v194 h-390Z" fill="#EECFA0" />
          <Path d="M0 650 h390 v12 h-390Z" fill="#3A2418" opacity={0.12} stroke="none" />
          <Path
            d="M195 650 L-160 844 M195 650 L550 844 M195 650 L40 844 M195 650 L350 844 M195 650 L195 844 M0 680 H390 M0 724 H390 M0 786 H390"
            fill="none"
            stroke="#D3A672"
            strokeWidth={2}
            opacity={0.7}
          />
          <Musician animated={animated} />
          <G transform="translate(195 714)">
            <Path d="M-84 -22 L84 -22 L100 24 L-100 24Z" fill="#B8235A" />
            <Path
              d="M-72 -14 L72 -14 L85 16 L-85 16Z"
              fill="none"
              stroke="#FFC93C"
              strokeWidth={3}
            />
            <Path d="M0 -9 L22 1 L0 11 L-22 1Z" fill="#3E93B8" />
            <Path
              d="M-96 24 l-3 7 M-76 24 l-2 7 M-56 24 l-1 7 M56 24 l1 7 M76 24 l2 7 M96 24 l3 7"
              fill="none"
              strokeWidth={1.8}
            />
          </G>
          <Path
            d="M30 770 h60 M250 806 h80 M120 826 h50"
            stroke="#FFF3DC"
            strokeWidth={4}
            opacity={0.55}
            fill="none"
          />
        </>
      );
    case 'alley':
      return (
        <>
          <Rect width={390} height={844} fill={`url(#${u}skyB)`} stroke="none" />
          <G fill="#FFFFFF" stroke="#4E9E9E" strokeWidth={2.2}>
            <Drift from={-370} to={160} dur={60} begin={-41.9} animated={animated}>
              <Path transform="translate(300 130)" d={CLOUD} />
            </Drift>
            <Drift from={-150} to={380} dur={75} begin={-21.2} animated={animated}>
              <Path transform="translate(80 300) scale(.7)" d={CLOUD} />
            </Drift>
          </G>
          <Path
            d="M0 520 V478 h50 v-14 h40 v14 h30 V520Z M110 520 C110 478 172 478 172 520Z M260 520 V470 h40 v-22 h14 v22 h76 V520Z"
            fill="#C9B5E0"
            stroke="#A893C8"
            strokeWidth={2}
          />
          <Path d="M0 520 h390 v200 h-390Z" fill={`url(#${u}br)`} />
          <Path d="M-4 508 h398 v18 h-398Z" fill="#C46A3A" />
          <Path
            d="M0 532 h390 M20 560 h70 M160 600 h60 M300 690 h70"
            stroke="#FFF3DC"
            strokeWidth={3}
            opacity={0.35}
            fill="none"
          />
          <Path d="M52 720 V606 C52 570 118 570 118 606 V720Z" fill="#8A4A22" />
          <Path d="M60 720 V610 C60 582 110 582 110 610 V720Z" fill="#3FA9A0" />
          <Path
            d="M85 586 V720 M64 650 h18 M88 650 h18 M64 690 h18 M88 690 h18"
            fill="none"
            strokeWidth={1.8}
          />
          <Circle cx={79} cy={664} r={4} fill="#FFC93C" />
          <Circle cx={91} cy={664} r={4} fill="#FFC93C" />
          <Path d="M44 720 h82 v10 h-82Z" fill="#D9A15E" />
          <Path d="M232 642 V600 h14 v42Z M306 600 h14 v42 h-14Z" fill="#3FA9A0" />
          <Path d="M246 642 V604 C246 576 306 576 306 604 V642Z" fill="#2B5E8C" />
          <Path d="M276 580 V642 M246 612 h60" stroke="#FFF6E8" strokeWidth={2} fill="none" />
          <Path d="M240 642 h72 v8 h-72Z" fill="#D9A15E" />
          <Path d="M260 642 l4 -14 h24 l4 14Z" fill="#C46A3A" />
          <G strokeWidth={1.8}>
            <Circle cx={268} cy={620} r={5.5} fill="#FF5C8A" />
            <Circle cx={278} cy={614} r={5.5} fill="#FFC93C" />
            <Circle cx={288} cy={620} r={5.5} fill="#FF5C8A" />
          </G>
          <Path d="M180 560 h30 v5 h-30Z M206 565 v8" fill="#4A2E1E" />
          <G transform="translate(206 573)">
            <Circle cy={14} r={22} fill={`url(#${u}lg)`} stroke="none" />
            <Path d="M-8 0 C-11 12 -8 22 0 24 C8 22 11 12 8 0Z" fill="#FFC93C" />
          </G>
          <Path d="M0 720 h390 v124 h-390Z" fill="#F1D8A8" />
          <Path d="M0 720 h390 v10 h-390Z" fill="#3A2418" opacity={0.14} stroke="none" />
          <Path
            d="M20 760 q14 -8 28 0 M70 782 q14 -8 28 0 M140 758 q14 -8 28 0 M200 792 q14 -8 28 0 M268 764 q14 -8 28 0 M320 790 q14 -8 28 0 M40 816 q14 -8 28 0 M170 824 q14 -8 28 0 M290 820 q14 -8 28 0"
            fill="none"
            stroke="#C9A06A"
            strokeWidth={2}
          />
        </>
      );
    case 'hojre':
      return (
        <>
          <Rect width={390} height={844} fill={`url(#${u}wall)`} stroke="none" />
          <Path d="M0 0 h390 v100 h-390Z" fill="#B9763E" />
          <Path d="M0 96 h390 v12 h-390Z" fill="#7A4220" />
          <Path d="M0 124 h390 v26 h-390Z" fill="#3E93B8" />
          <Path
            d="M0 137 H390"
            stroke="#FFF6E8"
            strokeWidth={6}
            strokeDasharray="6 12"
            fill="none"
          />
          <Path
            d="M60 760 V420 C60 300 330 300 330 420 V760"
            stroke="#C98A4E"
            strokeWidth={4}
            opacity={0.55}
            fill="none"
          />
          <Path
            d="M30 200 h80 M260 260 h90 M40 480 h50 M300 560 h60"
            stroke="#FFF3DC"
            strokeWidth={5}
            opacity={0.35}
            fill="none"
          />
          <Path d="M60 108 v40 M330 108 v40" fill="none" strokeWidth={1.8} />
          <G transform="translate(60 148)">
            <Glow r={26} radii={[26,29,25,28,26]} dur={1.4} fill={`url(#${u}lg)`} animated={animated} />
            <Path d="M-9 0 C-12 14 -9 26 0 28 C9 26 12 14 9 0Z" fill="#FF5C8A" />
          </G>
          <G transform="translate(330 148)">
            <Glow r={26} radii={[26,29,25,28,26]} dur={1.9} fill={`url(#${u}lg)`} animated={animated} />
            <Path d="M-9 0 C-12 14 -9 26 0 28 C9 26 12 14 9 0Z" fill="#7ED957" />
          </G>
          <Path d="M0 740 h390 v104 h-390Z" fill="#B8743E" />
          <Path
            d="M0 772 H390 M0 806 H390 M80 740 v32 M220 740 v32 M150 772 v34 M300 772 v34 M60 806 v38 M260 806 v38"
            fill="none"
            stroke="#8A4A22"
            strokeWidth={2}
          />
          <Path d="M70 768 L320 768 L350 830 L40 830Z" fill="#2F7FA8" />
          <Path
            d="M84 776 L306 776 L330 822 L60 822Z"
            fill="none"
            stroke="#FFC93C"
            strokeWidth={3}
          />
        </>
      );
    case 'caravan':
      return (
        <>
          <Rect width={390} height={844} fill={`url(#${u}skyB)`} stroke="none" />
          <Circle cx={90} cy={170} r={70} fill={`url(#${u}lg)`} stroke="none" />
          <G fill="#FFFFFF" stroke="#4E9E9E" strokeWidth={2.2}>
            <Drift from={-350} to={180} dur={50} begin={-33} animated={animated}>
              <Path transform="translate(280 200)" d={CLOUD} />
            </Drift>
          </G>
          <Path
            d="M250 580 V520 h24 v-20 C274 480 304 480 304 500 v20 h22 v-40 h10 v-16 l6 -10 l6 10 v16 h10 v120Z"
            fill="#E9C089"
            stroke="#C99A60"
            strokeWidth={2}
          />
          <Path d="M0 600 C100 560 200 620 390 570 V844 H0Z" fill="#F2CD8E" />
          <Path
            d="M40 640 V470 C40 410 150 410 150 470 V640 H124 V474 C124 440 66 440 66 474 V640Z"
            fill="#E07A4A"
          />
          <Path d="M150 470 l-10 22 h10Z M40 520 h26 M124 560 h26" fill="#C4562E" strokeWidth={2} />
          <Sway x={300} y={650} dur={4} animated={animated}>
          <Path
            d="M300 650 C296 610 304 570 300 530"
            stroke="#4A2E1E"
            strokeWidth={12}
            fill="none"
          />
          <Path
            d="M300 650 C296 610 304 570 300 530"
            stroke="#A8743E"
            strokeWidth={7}
            fill="none"
          />
          <Path
            d="M300 530 C280 510 254 514 244 530 C264 522 284 524 300 532Z M300 530 C320 508 346 512 356 528 C336 520 316 522 300 532Z M300 528 C292 504 300 488 314 484 C306 498 304 512 302 528Z M300 530 C284 520 272 540 270 556 C280 544 290 536 300 532Z"
            fill="#3FA36B"
          />
          </Sway>
          <Path d="M0 690 C120 650 260 710 390 668 V844 H0Z" fill="#E9B46A" />
          <Path
            d="M30 720 q40 -10 80 0 M210 740 q50 -12 100 0 M90 790 q40 -10 80 0"
            stroke="#FFF3DC"
            strokeWidth={4}
            opacity={0.55}
            fill="none"
          />
          <Path
            d="M170 660 C162 660 160 640 170 636 V628 h10 v8 C190 640 188 660 180 660Z"
            fill="#C46A3A"
          />
        </>
      );
    case 'win':
      return (
        <>
          <Rect width={390} height={844} fill={`url(#${u}win)`} stroke="none" />
          <Path d={RAYS} fill="#FFFFFF" opacity={0.28} stroke="none" />
          <Path d="M-10 90 Q195 170 400 90" fill="none" strokeWidth={1.8} />
          {FLAGS.map((f) => (
            <Path key={f.d} d={f.d} fill={f.c} strokeWidth={2} />
          ))}
          <Path
            d="M0 844 V700 h60 v-30 h40 v30 h30 C130 640 210 640 210 700 h40 v-50 h16 v50 h40 v-24 h60 v24 h24 V844Z"
            fill="#E8743B"
          />
          <Path
            d="M20 740 h20 v24 h-20Z M150 730 C150 716 170 716 170 730 v20 h-20Z M300 720 h16 v20 h-16Z M340 740 h16 v20 h-16Z"
            fill="#7A3418"
          />
        </>
      );
    case 'sarafi':
      return (
        <>
<Rect width={390} height={844} fill={`url(#${u}sfW)`} stroke="none" />
<Path d="M0 0 h390 v86 h-390Z" fill="#3A2416" />
<Path d="M0 82 h390 v10 h-390Z" fill="#B8822A" />
<Path d="M0 100 h390" stroke="#E8B64A" strokeWidth={2} opacity={.6} fill="none" />
<Path d="M0 108 H390" stroke="#8A5A16" strokeWidth={5} strokeDasharray="4 10" fill="none" />
<Path d="M30 640 V250 C30 160 140 160 140 250 V640 M250 640 V250 C250 160 360 160 360 250 V640" fill="none" stroke="#3A2618" strokeWidth={4} />
<Path d="M30 260 h110 M250 260 h110" stroke="#2A1A10" strokeWidth={2} fill="none" />
<G strokeWidth={2}>
<Path d="M22 330 h126 v10 h-126Z M22 450 h126 v10 h-126Z M242 330 h126 v10 h-126Z M242 450 h126 v10 h-126Z" fill="#8A5A16" />
<Path d="M22 340 l8 10 h110 l8 -10 M22 460 l8 10 h110 l8 -10 M242 340 l8 10 h110 l8 -10 M242 460 l8 10 h110 l8 -10" fill="#5A3A12" />
<Ellipse cx={50} cy={326} rx={16} ry={5} fill="#C48A0E" /><Path d="M34 326 v-22 h32 v22" fill="#E8B64A" /><Ellipse cx={50} cy={304} rx={16} ry={5} fill="#FFE48A" />
<Path d="M36 312 h28 M36 318 h28" fill="none" strokeWidth={1.4} />
<Ellipse cx={86} cy={326} rx={14} ry={4.5} fill="#C48A0E" /><Path d="M72 326 v-14 h28 v14" fill="#E8B64A" /><Ellipse cx={86} cy={312} rx={14} ry={4.5} fill="#FFE48A" />
<Path d="M104 330 l6 -14 h26 l6 14Z" fill="#E8B64A" /><Path d="M112 316 l4 -9 h16 l4 9Z" fill="#FFD75A" />
<Path d="M30 450 l6 -14 h30 l6 14Z M54 436 l5 -11 h20 l5 11Z" fill="#E8B64A" />
<Circle cx={110} cy={432} r={14} fill="#FFE48A" /><Circle cx={110} cy={432} r={9} fill="none" stroke="#B8822A" strokeWidth={2} />
<Path d="M254 330 v-30 h36 v30Z" fill="#6A3018" /><Path d="M254 300 h36 v-6 h-36Z" fill="#E8B64A" /><Circle cx={272} cy={316} r={4} fill="#E8B64A" />
<Ellipse cx={326} cy={326} rx={16} ry={5} fill="#C48A0E" /><Path d="M310 326 v-26 h32 v26" fill="#E8B64A" /><Ellipse cx={326} cy={300} rx={16} ry={5} fill="#FFE48A" />
<Path d="M312 308 h28 M312 314 h28 M312 320 h28" fill="none" strokeWidth={1.4} />
<Path d="M256 450 C250 430 262 418 278 422 C292 418 304 430 298 450Z" fill="#D9B37A" /><Path d="M266 424 l-4 -10 l10 4 l6 -6 l6 6 l10 -4 l-4 10" fill="#D9B37A" /><Circle cx={278} cy={436} r={6} fill="#E8B64A" />
<Path d="M318 450 h40 v-24 h-40Z" fill="#E8E1CF" /><Path d="M322 432 h32 M322 438 h24 M322 444 h28" fill="none" strokeWidth={1.2} />
</G>
<Circle cx={195} cy={420} r={150} fill={`url(#${u}sfG)`} stroke="none" />
<Circle cx={195} cy={420} r={118} fill="#3A2416" strokeWidth={3} />
<Circle cx={195} cy={420} r={106} fill={`url(#${u}sfV)`} strokeWidth={3} />
<Circle cx={195} cy={420} r={86} fill="none" stroke="#6A4210" strokeWidth={3} />
<G fill="#FFE48A" strokeWidth={1.6}><Circle cx={195} cy={324} r={5} /><Circle cx={195} cy={516} r={5} /><Circle cx={99} cy={420} r={5} /><Circle cx={291} cy={420} r={5} /><Circle cx={127} cy={352} r={5} /><Circle cx={263} cy={352} r={5} /><Circle cx={127} cy={488} r={5} /><Circle cx={263} cy={488} r={5} /></G>
<Turn x={195} y={420} deg={14} dur={9} animated={animated}>
<Path d="M195 362 V478 M137 420 H253 M154 379 L236 461 M236 379 L154 461" stroke="#3A2416" strokeWidth={9} fill="none" />
<Path d="M195 362 V478 M137 420 H253 M154 379 L236 461 M236 379 L154 461" stroke="#B8822A" strokeWidth={4} fill="none" />
<G fill="#E8B64A" strokeWidth={2}><Circle cx={195} cy={362} r={7} /><Circle cx={195} cy={478} r={7} /><Circle cx={137} cy={420} r={7} /><Circle cx={253} cy={420} r={7} /><Circle cx={154} cy={379} r={6} /><Circle cx={236} cy={461} r={6} /><Circle cx={236} cy={379} r={6} /><Circle cx={154} cy={461} r={6} /></G>
<Circle cx={195} cy={420} r={22} fill="#E8B64A" strokeWidth={3} /><Circle cx={195} cy={420} r={10} fill="#3A2416" /></Turn>
<Path d="M140 360 q14 -24 40 -32" stroke="#FFF6E8" strokeWidth={3} opacity={.6} fill="none" />
<Path d="M98 0 v130 M292 0 v130" fill="none" strokeWidth={1.8} />
<G transform="translate(98 130)"><Breathe cy={26} r={40} dur={3.2} fill={`url(#${u}sfG)`} animated={animated} /><Path d="M-14 0 h28 l-4 -8 h-20Z" fill="#B8822A" /><Path d="M-12 0 C-18 16 -16 40 -8 48 H8 C16 40 18 16 12 0Z" fill="#E8B64A" /><Ellipse cy={24} rx={6} ry={10} fill="#FFF1B8" stroke="none" /></G>
<G transform="translate(292 130)"><Breathe cy={26} r={40} dur={3.8} fill={`url(#${u}sfG)`} animated={animated} /><Path d="M-14 0 h28 l-4 -8 h-20Z" fill="#B8822A" /><Path d="M-12 0 C-18 16 -16 40 -8 48 H8 C16 40 18 16 12 0Z" fill="#E8B64A" /><Ellipse cy={24} rx={6} ry={10} fill="#FFF1B8" stroke="none" /></G>
<Path d="M0 640 h390 v204 h-390Z" fill="#24170F" />
<Path d={FLOOR_TILES} fill="none" stroke="#3A2618" strokeWidth={2} />
<Path d="M0 640 h390 v8 h-390Z" fill="#000" opacity={.35} stroke="none" />
<Path d="M0 690 h390 v86 h-390Z" fill="#3A2416" />
<Path d="M0 690 h390 v12 h-390Z" fill="#8A5A16" />
<Path d="M0 702 h390" stroke="#E8B64A" strokeWidth={2} fill="none" />
<Path d="M20 720 h80 v40 h-80Z M155 720 h80 v40 h-80Z M290 720 h80 v40 h-80Z" fill="none" stroke="#5A3A20" strokeWidth={2.4} />
<G transform="translate(60 690)" strokeWidth={1.8}><Path d="M0 0 V-34" fill="none" strokeWidth={3} /><Path d="M-24 -30 H24" fill="none" strokeWidth={2.4} /><Path d="M-24 -30 L-30 -16 H-18Z M24 -30 L18 -16 H30Z" fill="none" strokeWidth={1.4} /><Ellipse cx={-24} cy={-16} rx={9} ry={3} fill="#E8B64A" /><Ellipse cx={24} cy={-16} rx={9} ry={3} fill="#E8B64A" /><Circle cy={-36} r={3.5} fill="#E8B64A" /><Path d="M-10 0 h20 v-4 h-20Z" fill="#8A5A16" /></G>
<G transform="translate(330 690)" strokeWidth={1.8}><Ellipse cy={-4} rx={18} ry={5} fill="#C48A0E" /><Path d="M-18 -4 v-10 h36 v10" fill="#E8B64A" /><Ellipse cy={-14} rx={18} ry={5} fill="#FFE48A" /><Ellipse cx={8} cy={-20} rx={13} ry={4} fill="#FFE48A" /></G>
        </>
      );
  }
}
