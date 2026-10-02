import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Full-bleed radial backdrop (the kit's splash colours); sits behind children. */
export function GradientBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="38%" r="75%">
            <Stop offset="0" stopColor="#FF8FB6" />
            <Stop offset="0.4" stopColor="#C64FD8" />
            <Stop offset="0.8" stopColor="#5A2D91" />
            <Stop offset="1" stopColor="#2B1240" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#bg)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#2B1240' } });
