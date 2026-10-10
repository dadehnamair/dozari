import { StyleSheet, View } from 'react-native';
import { Scene } from './Scene';
import type { SceneName } from './Scene';
import { useTheme } from '../theme/themeStore';
import { WheelTouch } from './WheelTouch';
import { GradientFill } from './GradientFill';

/** Full-bleed painted scene behind the screen content. */
export function SceneBackground({ scene, mood, children }: { scene: SceneName; mood?: 'day' | 'dusk'; children?: React.ReactNode }) {
  const adult = useTheme() === 'adult';
  return (
    <View style={[styles.root, adult ? styles.rootAdult : null]}>
      {/* Vault-room tones under the painted scene: if a device fails to paint the SVG, the screen is still not plain black. */}
      {adult ? (
        <View style={styles.fill} pointerEvents="none">
          <GradientFill from="#2E1D14" to="#120B07" mid={{ at: 0.6, color: '#1E130D' }} />
        </View>
      ) : null}
      <View style={styles.fill} pointerEvents="none">
        <Scene scene={scene} mood={mood} />
      </View>
      {adult ? <WheelTouch /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#BDEBE0' },
  rootAdult: { backgroundColor: '#120B07' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
