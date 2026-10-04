import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/** A radial gradient behind a view's content, drawn at the measured size (same approach as `GradientFill`). `cx`/`cy` are fractions. */
export function RadialFill({ stops, cx = 0.5, cy = 0.4, r = 0.75 }: { stops: readonly (readonly [number, string])[]; cx?: number; cy?: number; r?: number }) {
  const gid = `rf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: stops[stops.length - 1]?.[1] }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size && size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <RadialGradient id={gid} cx={size.w * cx} cy={size.h * cy} r={Math.max(size.w, size.h) * r} gradientUnits="userSpaceOnUse">
              {stops.map(([at, color]) => <Stop key={at} offset={at} stopColor={color} />)}
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${gid})`} />
          <Circle cx={0} cy={0} r={0} fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}
