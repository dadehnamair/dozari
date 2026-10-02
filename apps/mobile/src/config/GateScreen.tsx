import { Linking, StyleSheet, Text, View } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { SceneBackground } from '../components/SceneBackground';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const INK = '#3A2418';

/** Full-screen stop sign: maintenance mode, or an app version that is too old (both set from the admin panel). */
export function GateScreen({ kind, message, updateUrl }: { kind: 'maintenance' | 'update'; message: string; updateUrl: string }) {
  return (
    <SceneBackground scene="alley">
      <View style={styles.box}>
        <View style={styles.card}>
          <Text style={styles.title}>{kind === 'maintenance' ? fa.gate.maintenanceTitle : fa.gate.updateTitle}</Text>
          <Text style={styles.text}>{kind === 'maintenance' ? message || fa.gate.maintenanceDefault : fa.gate.updateText}</Text>
          {kind === 'update' && updateUrl ? <CandyButton label={fa.gate.updateButton} color={colors.candy.lime} onPress={() => void Linking.openURL(updateUrl)} /> : null}
        </View>
      </View>
    </SceneBackground>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 20, gap: 12, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 26, color: INK, textAlign: 'center' },
  text: { fontFamily: fonts.bold, fontSize: 15, color: INK, textAlign: 'center' },
});
