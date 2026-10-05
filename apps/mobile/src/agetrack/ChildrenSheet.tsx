import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import type { ChildrenResponse } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { useHardwareBack } from '../nav/useHardwareBack';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { addChild, childLinkCode, fetchChildren, removeChild, setChildTrack } from './guardianApi';

const INK = '#3A2418';
const l = fa.guardian;
const trackName = (t: string): string => (t === 'kid' ? l.kid : l.teen);
const textOf = (e: unknown): string => l.errors[e instanceof ApiError ? e.code : 'generic'] ?? l.errors.generic ?? '';

/** The guardian's panel («فرزندان من»): the child profiles, a sign-in code for each, moving a child to another track and removing one. */
export function ChildrenSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [data, setData] = useState<ChildrenResponse | 'failed' | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => void fetchChildren().then(setData, () => setData('failed')), []);
  useEffect(load, [load]);
  const run = (job: Promise<void>) => job.then(() => (setNote(null), load()), (e) => setNote(textOf(e)));

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={l.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{l.childrenTitle}</Text>
        <Text style={styles.text}>{l.childrenIntro}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {data === null ? <ActivityIndicator color={INK} /> : null}
          {data === 'failed' ? <Text style={styles.bad}>{l.errors.generic}</Text> : null}
          {data && data !== 'failed' && !data.phoneVerified ? <Text style={styles.text}>{l.needPhone}</Text> : null}
          {data && data !== 'failed' && data.children.length === 0 && data.phoneVerified ? <Text style={styles.text}>{l.empty}</Text> : null}
          {data && data !== 'failed'
            ? data.children.map((c) => (
                <View key={c.id} style={styles.child}>
                  <Text style={styles.name}>{c.nickname} · {trackName(c.track)}</Text>
                  {codes[c.id] ? <Text style={styles.code}>{l.codeIs(toPersianDigits(codes[c.id]!))}</Text> : null}
                  <View style={styles.row}>
                    <CandyButton label={l.makeCode} color={colors.candy.lime} onPress={() => void childLinkCode(c.id).then((r) => setCodes((p) => ({ ...p, [c.id]: r.code })), (e) => setNote(textOf(e)))} />
                    <CandyButton label={l.moveTo(trackName(c.track === 'kid' ? 'teen' : 'kid'))} color={colors.candy.sky} onPress={() => void run(setChildTrack(c.id, c.track === 'kid' ? 'teen' : 'kid'))} />
                  </View>
                  <CandyButton label={l.remove} color={colors.candy.pink} onPress={() => void run(removeChild(c.id))} />
                </View>
              ))
            : null}
        </ScrollView>
        {note ? <Text style={styles.bad}>{note}</Text> : null}
        {data && data !== 'failed' && data.phoneVerified && data.children.length < data.max ? (
          <View style={styles.row}>
            <CandyButton label={l.addKid} color={colors.candy.orange} onPress={() => void run(addChild('kid'))} />
            <CandyButton label={l.addTeen} color={colors.candy.grape} onPress={() => void run(addChild('teen'))} />
          </View>
        ) : null}
        <CandyButton label={l.close} sfx="back" color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 380, maxHeight: '90%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK, textAlign: 'center' },
  text: { fontFamily: fonts.bold, fontSize: 13.5, color: INK, textAlign: 'center' },
  bad: { fontFamily: fonts.bold, fontSize: 13.5, color: '#B3261E', textAlign: 'center' },
  list: { flexGrow: 0 },
  listContent: { gap: 10 },
  child: { gap: 8, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: INK, backgroundColor: '#fff' },
  name: { fontFamily: fonts.display, fontSize: 18, color: INK, textAlign: 'center' },
  code: { fontFamily: fonts.bold, fontSize: 15, color: '#6634B0', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
});
