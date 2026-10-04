import { isWearKey, WEAR_SLOT_OF, wearKey } from '@dozari/shared';
import type { CosmeticSlot } from '@dozari/shared';
export { isWearKey, WEAR_SLOT_OF, wearKey };
import { G, Circle, Path, Rect } from 'react-native-svg';

/** One thing a player wears (D165/D176). `iconKey` of a cosmetic shop item names one of these; the art is drawn on the character itself. */
export type WearSlot = CosmeticSlot;
export interface Worn {
  slot: string;
  iconKey: string | null;
}

/** The key worn in a slot, or null. */
export function wornIn(worn: readonly Worn[] | undefined, slot: WearSlot): string | null {
  const k = wearKey(worn?.find((w) => w.slot === slot)?.iconKey);
  return k && WEAR_SLOT_OF[k] === slot ? k : null;
}

/** Head is centred on x=100, crown of the head near y=32, eyes at y=74, chin near y=140 (the coordinates of `Character`). */
export function HairArt({ k }: { k: string }) {
  if (k === 'hairLong') {
    const c = '#6A3B1E';
    return (
      <G>
        <Path d="M62 64C50 92 52 132 62 154L74 150C69 126 70 92 76 68Z M138 64C150 92 148 132 138 154L126 150C131 126 130 92 124 68Z" fill={c} strokeWidth={2.6} />
        <Path d="M62 62C60 36 80 28 100 30C120 28 140 36 138 62C128 48 112 44 100 48C88 44 72 48 62 62Z" fill={c} strokeWidth={2.6} />
        <Path d="M78 44Q86 38 94 38" stroke="#fff" strokeWidth={2} opacity={0.4} fill="none" />
      </G>
    );
  }
  if (k === 'hairCurly') {
    const c = '#2A1A12';
    const dots: [number, number, number][] = [[62, 70, 11], [66, 50, 14], [84, 38, 14], [104, 35, 14], [122, 40, 14], [136, 54, 13], [139, 72, 10]];
    return (
      <G>
        {dots.map(([x, y, r]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c} strokeWidth={2.6} />)}
        <Path d="M76 52Q88 46 100 50Q112 46 124 52" stroke={c} strokeWidth={9} fill="none" />
      </G>
    );
  }
  const c = '#B8641E';
  return (
    <G>
      <Circle cx={100} cy={20} r={17} fill={c} strokeWidth={2.8} />
      <Path d="M92 16q4-5 10-3" stroke="#fff" strokeWidth={2} opacity={0.45} fill="none" />
      <Path d="M66 60C62 40 80 30 100 32C120 30 138 40 134 60C128 50 120 46 112 52C106 44 96 44 90 52C82 46 72 50 66 60Z" fill={c} strokeWidth={2.6} />
    </G>
  );
}

export function HatArt({ k }: { k: string }) {
  if (k === 'crown') {
    return (
      <G>
        <Path d="M64 48L68 12L86 30L100 6L114 30L132 12L136 48Q100 58 64 48Z" fill="#FFC93C" strokeWidth={3} />
        <Path d="M66 42Q100 52 134 42" stroke="#C48A0E" strokeWidth={2.4} fill="none" />
        <Circle cx={100} cy={30} r={4.6} fill="#E04A3A" strokeWidth={2} />
        <Circle cx={80} cy={36} r={3.2} fill="#3FC1F0" strokeWidth={1.8} />
        <Circle cx={120} cy={36} r={3.2} fill="#3FC1F0" strokeWidth={1.8} />
        <Path d="M74 22L76 30" stroke="#fff" strokeWidth={2.2} opacity={0.7} fill="none" />
      </G>
    );
  }
  if (k === 'beanie') {
    return (
      <G>
        <Path d="M68 50C64 14 136 14 132 50Z" fill="#E8743B" strokeWidth={3} />
        <Path d="M66 44Q100 56 134 44L136 56Q100 68 64 56Z" fill="#C9531E" strokeWidth={3} />
        <Circle cx={100} cy={10} r={8} fill="#fff" strokeWidth={2.6} />
        <Path d="M80 30L84 44M96 26L98 44M112 26L112 44M126 32L124 44" stroke="#C9531E" strokeWidth={2.2} opacity={0.7} fill="none" />
      </G>
    );
  }
  return (
    <G>
      <Path d="M70 46C68 12 132 12 130 46Z" fill="#6B4A8E" strokeWidth={3} />
      <Path d="M70 40Q100 50 130 40L130 47Q100 57 70 47Z" fill="#FFC93C" strokeWidth={2.6} />
      <Path d="M48 50Q100 66 152 50Q146 40 100 42Q54 40 48 50Z" fill="#6B4A8E" strokeWidth={3} />
      <Path d="M82 24Q90 18 98 18" stroke="#fff" strokeWidth={2.4} opacity={0.5} fill="none" />
    </G>
  );
}

export function GlassesArt({ k }: { k: string }) {
  if (k === 'glassesSun') {
    return (
      <G>
        <Path d="M71 64H103V80Q103 91 87 91Q71 91 71 80Z M97 64H129V80Q129 91 113 91Q97 91 97 80Z" fill="#1E2A4A" strokeWidth={3} />
        <Path d="M103 68Q100 65 97 68M71 68L62 66M129 68L138 66" stroke="#3A2418" strokeWidth={3} fill="none" />
        <Path d="M76 69L82 69M102 69L108 69" stroke="#fff" strokeWidth={2.4} opacity={0.6} fill="none" />
      </G>
    );
  }
  return (
    <G>
      <Circle cx={88} cy={74} r={15.5} fill="#fff" fillOpacity={0.14} strokeWidth={3} />
      <Circle cx={112} cy={74} r={15.5} fill="#fff" fillOpacity={0.14} strokeWidth={3} />
      <Path d="M103 72Q100 69 97 72M72 72L62 70M128 72L138 70" stroke="#3A2418" strokeWidth={3} fill="none" />
      <Path d="M80 66q3-3 7-3" stroke="#fff" strokeWidth={2.2} fill="none" />
    </G>
  );
}

const TORSO = 'M70 146C62 170 60 196 62 216Q100 226 138 216C140 196 138 170 130 146Q100 138 70 146Z';

export function OutfitArt({ k }: { k: string }) {
  if (k === 'dress') {
    return (
      <G>
        <Path d={TORSO} fill="#B63B8F" strokeWidth={3} />
        <Path d="M64 200Q100 212 136 200L152 242Q100 258 48 242Z" fill="#B63B8F" strokeWidth={3} />
        <Path d="M64 204Q100 216 136 204" stroke="#FFC93C" strokeWidth={5} fill="none" />
        <Path d="M86 144Q100 158 114 144" stroke="#FFE48A" strokeWidth={3} fill="none" />
        <Path d="M76 224L72 240M100 228V248M124 224L128 240" stroke="#fff" strokeWidth={2} opacity={0.4} fill="none" />
      </G>
    );
  }
  return (
    <G>
      <Path d={TORSO} fill="#3F72D0" strokeWidth={3} />
      <Path d="M63 170Q100 180 137 170M62 188Q100 198 138 188M62 206Q100 216 138 206" stroke="#fff" strokeWidth={4} opacity={0.7} fill="none" />
      <Path d="M84 143Q100 160 116 143" fill="#fff" stroke="#3A2418" strokeWidth={2.6} />
      <Rect x={112} y={176} width={12} height={12} rx={3} fill="#FFC93C" strokeWidth={2} />
    </G>
  );
}

export function ScarfArt() {
  return (
    <G>
      <Path d="M116 160L128 196L113 200L104 166Z" fill="#D93B3B" strokeWidth={2.8} />
      <Path d="M66 146C80 162 120 162 134 146C138 156 134 162 128 164C112 172 88 172 72 164C66 162 62 156 66 146Z" fill="#D93B3B" strokeWidth={2.8} />
      <Path d="M80 160l2 9M94 163l1 9M108 163l-1 9M121 160l-2 9M118 176l8-3M121 188l7-3" stroke="#FFE48A" strokeWidth={2.4} fill="none" />
    </G>
  );
}
