import { StyleSheet, View } from 'react-native';
import { Scene } from './Scene';
import type { SceneName } from './Scene';

/** Full-bleed painted scene behind the screen content. */
export function SceneBackground({ scene, mood, children }: { scene: SceneName; mood?: 'day' | 'dusk'; children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={styles.fill} pointerEvents="none">
        <Scene scene={scene} mood={mood} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#BDEBE0' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
