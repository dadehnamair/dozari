import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { Character } from '../components/Character';
import type { Worn } from '../components/wearArt';
import { usePrefs } from '../prefs/store';
import { colors, fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';
import { RadialFill } from './RadialFill';

/** Twenty-degree sunburst (every other 10° wedge), as the design's `repeating-conic-gradient`. */
const RAYS = Array.from({ length: 18 }, (_, i) => {
  const a0 = (i * 20 * Math.PI) / 180;
  const a1 = ((i * 20 + 10) * Math.PI) / 180;
  const R = 500;
  return `M0 0L${(R * Math.cos(a0)).toFixed(1)} ${(R * Math.sin(a0)).toFixed(1)}L${(R * Math.cos(a1)).toFixed(1)} ${(R * Math.sin(a1)).toFixed(1)}Z`;
}).join('');

/** The fitting-room stage of the design: warm radial backdrop, a slowly turning sunburst, a floor shadow, the character, and a toast on top. */
export function WardrobeStage({ who, worn, toast, height }: { who: CharacterId; worn: readonly Worn[]; toast: string | null; height: number }) {
  const reduce = usePrefs().reduceMotion;
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return undefined;
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 40_000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, turn]);
  return (
    <View style={[styles.stage, { height }]}>
      <RadialFill stops={[[0, '#FFE48A'], [0.55, '#FFC93C'], [1, '#FF7A3D']]} cy={0.4} r={0.8} />
      <Animated.View pointerEvents="none" style={[styles.rays, { transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
        <Svg width={1000} height={1000} viewBox="-500 -500 1000 1000"><Path d={RAYS} fill="rgba(255,255,255,0.22)" /></Svg>
      </Animated.View>
      <View pointerEvents="none" style={styles.shadow}><Svg width={200} height={34}><Ellipse cx={100} cy={17} rx={100} ry={17} fill={colors.ink} opacity={0.22} /></Svg></View>
      <View style={[styles.model, { height: height - 14 }]}><Character who={who} pose="wave" worn={worn} /></View>
      {toast ? <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { borderRadius: 22, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  rays: { position: 'absolute', left: '50%', top: '42%', width: 1000, height: 1000, marginLeft: -500, marginTop: -500 },
  shadow: { position: 'absolute', bottom: 8 },
  model: { aspectRatio: 240 / 276, marginBottom: 6 },
  toast: { position: 'absolute', top: 10, left: 12, right: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.lime, alignItems: 'center' },
  toastText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: 'center' },
});
