import { useId } from 'react';
import { Platform, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import Svg, {
  Circle,
  Defs,
  FeDisplacementMap,
  FeTurbulence,
  Filter,
  G,
  Pattern,
  Rect,
} from 'react-native-svg';
import { usePrefs } from '../prefs/store';
import { characterLook } from '../theme/character';
import { Motion } from './characterMotion';
import { BodyArt, ExtrasArt, FaceArt, FrontArm, HeadArt, INK } from './characterParts';
import { wornIn } from './wearArt';
import type { Worn } from './wearArt';
import type { CharacterCrop, CharacterId, CharacterPose } from '../theme/character';

interface Props {
  who?: CharacterId;
  pose?: CharacterPose;
  /** Solar Hijri month 1..12: the hero «dozari» wears that month's look (docs/design/Character.dc.html). */
  month?: number;
  /** 0..6 picks one of the cast when `who` is not given (used by avatars). */
  skin?: number;
  crop?: CharacterCrop;
  width?: DimensionValue;
  height?: DimensionValue;
  /** Pencil-wobble displacement filter of the design. On by default on the web; native filter support is unverified, so off there. */
  wobble?: boolean;
  /** Living motion (head bob, breathing, blinking, swinging arms, hat coin). On for full-body characters unless the player chose less motion; face crops (avatars, lists) stay still unless asked. */
  anim?: boolean;
  /** Cosmetics worn (D165/D176): hair, hat, glasses on the head, clothes and scarf on the body (full body only). */
  worn?: readonly Worn[];
}

/** Hand-drawn market characters (docs/design/Dozari - 04 Characters.dc.html), ported to react-native-svg. */
export function Character({
  who = 'dozari',
  pose = 'idle',
  month,
  skin,
  crop = 'full',
  width = '100%',
  height = '100%',
  wobble = Platform.OS === 'web',
  anim,
  worn,
}: Props) {
  const hairK = wornIn(worn, 'hair');
  const hatK = wornIn(worn, 'hat');
  const glassesK = wornIn(worn, 'glasses');
  const outfitK = wornIn(worn, 'outfit');
  const scarfK = wornIn(worn, 'accessory');
  const reduce = usePrefs().reduceMotion;
  const on = !reduce && (anim ?? crop === 'full');
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fid = `${uid}f`;
  const pid = `${uid}p`;
  const L = characterLook({ who: who === 'dozari' && skin !== undefined ? undefined : who, pose, month, crop, skin });
  const pat = L.pattern;
  const delay = -(((L.seed || 1) % 7) * 0.13);
  const up = pose === 'wave' || pose === 'cheer' || pose === 'win';
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
          {L.full ? <BodyArt L={L} pid={pid} on={on} up={up} delay={delay} outfitK={outfitK} scarfK={scarfK} /> : null}
          <Motion part="head" on={on} delay={delay}>
            <HeadArt L={L} on={on} hairK={hairK} hatK={hatK} />
            <FaceArt L={L} on={on} delay={delay} glassesK={glassesK} />
          </Motion>
          {L.full ? <FrontArm L={L} on={on} up={up} /> : null}
          <ExtrasArt L={L} />
        </G>
      </Svg>
    </View>
  );
}
