import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Splits `rgba(r,g,b,a)` into an opaque colour plus an opacity: Android's react-native-svg ignores the alpha inside
 * `stopColor`, which turned translucent overlays into solid black. Other colour strings pass through untouched.
 */
function splitAlpha(color: string): { color: string; opacity: number } {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i.exec(color.trim());
  return m ? { color: `rgb(${m[1]},${m[2]},${m[3]})`, opacity: Number(m[4]) } : { color, opacity: 1 };
}

/**
 * Absolute vertical gradient behind a view's content (no native gradient dependency).
 *
 * The SVG is drawn at the view's measured pixel size: a 1x1 viewBox stretched with percentage sizes came out shifted on
 * Android (a wide strip of the layer underneath showed at one side of buttons). The flat colour under it keeps the face
 * solid even for the first frame, before the size is known.
 */
export function GradientFill({
  from,
  to,
  mid,
}: {
  from: string;
  to: string;
  mid?: { at: number; color: string };
}) {
  const gid = `gf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: mid?.color ?? to }]}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
      }}
    >
      {size && size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              {[
                { at: 0, color: from },
                ...(mid ? [mid] : []),
                { at: 1, color: to },
              ].map((s) => {
                const c = splitAlpha(s.color);
                return <Stop key={s.at} offset={s.at} stopColor={c.color} stopOpacity={c.opacity} />;
              })}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${gid})`} />
        </Svg>
      ) : null}
    </View>
  );
}
