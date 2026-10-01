import { useId } from 'react';
import { Platform, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import Svg, { Defs, Ellipse, FeDisplacementMap, FeTurbulence, Filter, G, Path, Text as SvgText } from 'react-native-svg';
import { fonts } from '../theme/colors';
import { ITEMS } from '../theme/item-data';

const INK = '#3A2418';

interface Props {
  /** Key of the icon pack (`coin`, `chest`, `teaGlass` ...); unknown keys draw the coin. */
  icon: string;
  width?: DimensionValue;
  height?: DimensionValue;
  /** Pencil-wobble filter: on for the web, off on native until filters are verified there. */
  wobble?: boolean;
}

/** Hand-drawn item / product icon (docs/design/Item.dc.html). */
export function Item({ icon, width = '100%', height = '100%', wobble = Platform.OS === 'web' }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const def = ITEMS[icon] ?? ITEMS.coin;
  const seed = icon.length * 7 + 3;
  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="-4 -4 72 72" style={{ overflow: 'visible' }}>
        <Defs>
          {wobble ? (
            <Filter id={`${uid}f`} x="-15%" y="-15%" width="130%" height="130%">
              <FeTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={seed} result="n" />
              <FeDisplacementMap in="SourceGraphic" in2="n" scale={1.8} xChannelSelector="R" yChannelSelector="G" />
            </Filter>
          ) : null}
        </Defs>
        <G filter={wobble ? `url(#${uid}f)` : undefined} stroke={INK} strokeLinejoin="round" strokeLinecap="round">
          <Ellipse cx={32} cy={63} rx={18} ry={2.6} fill={INK} opacity={0.14} stroke="none" />
          {def?.p.map(([d, f, a, b], i) => {
            if (f === 'L') return <Path key={i} d={d} fill="none" stroke={b ?? INK} strokeWidth={Number(a)} />;
            if (f === 'H') return <Path key={i} d={d} fill="none" stroke="#fff" strokeWidth={2.4} />;
            return <Path key={i} d={d} fill={f} stroke={a === 'N' ? 'none' : INK} strokeWidth={2.4} />;
          })}
          {def?.t?.map(([x, y, size, text, color], i) => (
            <SvgText key={i} x={x} y={y} textAnchor="middle" fontFamily={fonts.display} fontSize={size} fill={color} stroke="none">
              {text}
            </SvgText>
          ))}
        </G>
      </Svg>
    </View>
  );
}
