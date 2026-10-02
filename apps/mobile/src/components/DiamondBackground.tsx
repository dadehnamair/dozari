import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

/** "bg-search": rotated checkerboard in two violets with a pink glow in the middle and dark top/bottom. */
export function DiamondBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern
            id="dq"
            width={64}
            height={64}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect x={0} y={0} width={64} height={64} fill="#3C2A8E" />
            <Rect x={0} y={0} width={32} height={32} fill="#4A36A6" />
            <Rect x={32} y={32} width={32} height={32} fill="#4A36A6" />
          </Pattern>
          <RadialGradient id="dg" cx="50%" cy="38%" rx="62%" ry="62%">
            <Stop offset="0" stopColor="rgb(198,120,255)" stopOpacity={0.55} />
            <Stop offset="1" stopColor="rgb(198,120,255)" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="dv" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2B1240" stopOpacity={0.4} />
            <Stop offset="0.3" stopColor="#2B1240" stopOpacity={0} />
            <Stop offset="0.7" stopColor="#2B1240" stopOpacity={0} />
            <Stop offset="1" stopColor="#2B1240" stopOpacity={0.7} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#dq)" />
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#dg)" />
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#dv)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#3C2A8E' } });
