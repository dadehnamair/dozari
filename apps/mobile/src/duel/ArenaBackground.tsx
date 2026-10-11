import { StyleSheet, View } from 'react-native';
import { Scene } from '../components/Scene';
import { colors } from '../theme/colors';

/** Background of screen-match in `13 Match Screens v2`: the courtyard at dusk under a violet vignette so the board and the cards stand out. */
export function ArenaBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><Scene scene="hojre" mood="dusk" /></View>
      <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, styles.top]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, styles.bottom]} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.deeper, overflow: 'hidden' },
  shade: { backgroundColor: 'rgba(26,8,44,0.42)' },
  top: { bottom: '70%', backgroundColor: 'rgba(26,8,44,0.28)' },
  bottom: { top: '72%', backgroundColor: 'rgba(26,8,44,0.28)' },
});
