import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HintKind, HintPayload, SoloHints } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { SheetClose } from '../components/SheetClose';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchHints, takeHint } from './api';
import { hintBlockedText } from './hintView';
import { useHardwareBack } from '../nav/useHardwareBack';

const INK = '#3A2418';
const n = (v: number) => toPersianDigits(String(v));

const failureText = (e: unknown): string => {
  if (!(e instanceof ApiError)) return fa.hints.error;
  if (e.code === 'insufficient') return fa.hints.insufficient;
  if (e.code === 'nothing_left') return fa.hints.nothingLeft;
  if (e.code === 'game_over') return fa.hints.gameOver;
  return fa.hints.error;
};

/** Paid hints of a solo game: what each costs now, what the player owns, and the one-tap purchase. */
export function HintSheet({ sessionId, onGiven, onClose }: { sessionId: string; onGiven: (given: HintPayload[]) => void; onClose: () => void }) {
  useHardwareBack(onClose);
  const [info, setInfo] = useState<SoloHints | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchHints(sessionId).then(
      (h) => (setInfo(h), onGiven(h.given)),
      () => setNote(fa.hints.error),
    );
  }, [sessionId, onGiven]);
  useEffect(load, [load]);

  const take = (kind: HintKind) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    takeHint(sessionId, kind).then(
      () => (load(), onClose()),
      (e) => setNote(failureText(e)),
    ).finally(() => setBusy(false));
  };

  const blocked = info ? hintBlockedText(info) : null;
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.hints.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <SheetClose onPress={onClose} label={fa.hints.close} />
        <Text style={styles.title}>{fa.hints.title}</Text>
        <Text style={styles.hint}>{fa.hints.sub}</Text>
        {info ? (
          <>
            <Text style={styles.hint}>{fa.hints.balance}: {n(info.balance)} {fa.hints.coins} · {fa.hints.tokens}: {n(info.tokens)}</Text>
            <Text style={styles.hint}>{fa.hints.used(info.used, info.max)}</Text>
            {blocked ? <Text style={styles.warn}>{blocked}</Text> : null}
            <View style={styles.list}>
              {info.options.map((o) => (
                <Pressable key={o.kind} disabled={blocked !== null || busy} onPress={() => take(o.kind)} style={[styles.option, (blocked !== null || busy) && styles.off]} accessibilityRole="button">
                  <Text style={styles.optionName}>{fa.hints.kind[o.kind]}</Text>
                  <Text style={styles.price}>{info.tokens > 0 ? fa.hints.free : `${n(o.price)} ${fa.hints.coins}`}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        {note ? <Text style={styles.warn}>{note}</Text> : null}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.75, textAlign: 'center' },
  warn: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
  list: { alignSelf: 'stretch', gap: 8 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 2, borderColor: INK, backgroundColor: '#FFC93C' },
  off: { opacity: 0.45 },
  optionName: { fontFamily: fonts.bold, fontSize: 15, color: INK },
  price: { fontFamily: fonts.display, fontSize: 15, color: INK },
});
