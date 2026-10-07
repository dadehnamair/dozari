import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { AgeTrack } from '@dozari/shared';
import { SlabButton } from '../components/SlabButton';
import { Scene } from '../components/Scene';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { safeTop } from '../theme/safeArea';
import { setLookTrack } from '../theme/look';
import { saveAgeTrack } from './api';
import { GuardianStep } from './GuardianStep';
import { forgetTrackRules } from './useTrackRules';

const INK = colors.ink;

/**
 * First-run «who is playing?» screen (docs/logic/age-tracks.md): three big cards on the same bazaar-at-dusk look as the sign-in screen.
 * Shown once per account, only when the server's age-track switch is on. The adult card comes first and wears the main colour.
 */
export function AgeTrackScreen({ onDone, initial }: { onDone: (track: AgeTrack) => void; /** The track already picked on the sign-in card: saved at once, only the guardian step (kid, teen) is shown. */ initial?: AgeTrack }) {
  const l = fa.ageTrack;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  /** A kid or teen who just picked: the guardian step comes next (skippable). */
  const [picked, setPicked] = useState<AgeTrack | null>(null);
  const tight = useWindowDimensions().height < 700;
  const pick = (track: AgeTrack) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    saveAgeTrack(track).then(
      () => (forgetTrackRules(), setLookTrack(track), track === 'adult' ? onDone(track) : (setBusy(false), setPicked(track))),
      () => (setBusy(false), setFailed(true)),
    );
  };
  const auto = useRef(false);
  useEffect(() => {
    if (initial && !auto.current) {
      auto.current = true;
      pick(initial);
    }
  }, [initial]);
  const rows: { track: AgeTrack; label: string; hint: string; color: string }[] = [
    { track: 'adult', label: l.adult, hint: l.adultHint, color: colors.candy.lime },
    { track: 'teen', label: l.teen, hint: l.teenHint, color: colors.candy.sky },
    { track: 'kid', label: l.kid, hint: l.kidHint, color: colors.candy.orange },
  ];
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}><Scene scene="bazaar" mood="dusk" /></View>
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={[styles.top, { paddingTop: safeTop(tight ? 24 : 44) }]}>
        <Text style={styles.heading}>{l.title}</Text>
        <Text style={styles.subHeading}>{l.sub}</Text>
      </View>
      <View style={[styles.cardWrap, tight ? styles.cardWrapTight : null]} pointerEvents="box-none">
      <View style={[styles.card, tight ? styles.cardTight : null]}>
        {picked ? <GuardianStep onDone={() => onDone(picked)} /> : null}
        {picked || (preset && !failed) ? null : rows.map((r) => (
          <View key={r.track} style={styles.row}>
            <SlabButton label={busy ? l.saving : r.label} color={r.color} height={tight ? 50 : 58} fontSize={24} grow={0} disabled={busy} sfx="confirm" onPress={() => pick(r.track)} />
            <Text style={styles.hint}>{r.hint}</Text>
          </View>
        ))}
        {failed && !picked ? <Text style={styles.error}>{l.failed}</Text> : null}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgTop },
  shade: { backgroundColor: 'rgba(26,8,48,0.35)' },
  top: { alignItems: 'center', paddingHorizontal: 24, gap: 8 },
  heading: { fontFamily: fonts.display, fontSize: 34, color: '#fff', textAlign: 'center' },
  subHeading: { fontFamily: fonts.body, fontSize: 15, color: '#F3E8FF', textAlign: 'center', maxWidth: 360 },
  // Centring wrapper: `alignSelf` does nothing on an absolute box (the card stuck to the left on wide screens).
  cardWrap: { position: 'absolute', left: 14, right: 14, bottom: 26, alignItems: 'center' },
  cardWrapTight: { bottom: 12 },
  card: { width: '100%', maxWidth: 420, padding: 14, paddingTop: 16, gap: 12, borderRadius: 26, borderWidth: 4, borderColor: INK, backgroundColor: colors.paper },
  cardTight: { gap: 8, padding: 12 },
  row: { gap: 4 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: '#5B4A70', textAlign: 'center' },
  error: { fontFamily: fonts.body, fontSize: 14, color: '#B8235A', textAlign: 'center' },
});
