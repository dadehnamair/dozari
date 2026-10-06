import { StyleSheet, View } from 'react-native';
import { Scene } from './Scene';
import type { SceneName } from './Scene';
import { useTheme } from '../theme/themeStore';

/** Full-bleed painted scene behind the screen content. */
export function SceneBackground({ scene, mood, children }: { scene: SceneName; mood?: 'day' | 'dusk'; children?: React.ReactNode }) {
  const adult = useTheme() === 'adult';
  return (
    <View style={[styles.root, adult ? styles.rootAdult : null]}>
      <View style={styles.fill} pointerEvents="none">
        <Scene scene={adult && scene !== 'win' ? 'sarafi' : scene} mood={adult ? undefined : mood} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#BDEBE0' },
  rootAdult: { backgroundColor: '#120B07' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
