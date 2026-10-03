import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TransferInfo } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchTransferInfo, offerLoan, sendGift } from './api';
import { amountChoices, transferErrorText, transferRuleLines } from './rulesText';
import { useHardwareBack } from '../nav/useHardwareBack';

const INK = '#3A2418';

/** Gift or loan to a friend: the rules first («آجان»), then a tap on an amount. */
export function TransferSheet({ friendId, kind, onClose }: { friendId: string; kind: 'gift' | 'loan'; onClose: () => void }) {
  useHardwareBack(onClose);
  const [info, setInfo] = useState<TransferInfo | null>(null);
  const [read, setRead] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTransferInfo().then(setInfo, () => setNote({ text: fa.transfers.errors.generic ?? '', bad: true }));
  }, []);

  const send = (amount: number) => {
    if (busy) return;
    setBusy(true);
    (kind === 'gift' ? sendGift : offerLoan)(friendId, amount)
      .then(
        () => (setNote({ text: kind === 'gift' ? fa.transfers.sentGift : fa.transfers.sentLoan, bad: false }), fetchTransferInfo().then(setInfo, () => undefined)),
        (e) => setNote({ text: transferErrorText(e instanceof ApiError ? e.code : 'generic'), bad: true }),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.transfers.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{kind === 'gift' ? fa.transfers.gift : fa.transfers.loan}</Text>
        {info && !read ? (
          <>
            <Text style={styles.label}>{fa.transfers.rulesTitle}</Text>
            <Text style={styles.hint}>{fa.transfers.rulesIntro}</Text>
            {transferRuleLines(info, kind).map((l) => (
              <Text key={l} style={styles.hint}>• {l}</Text>
            ))}
            <CandyButton label={fa.transfers.understood} color={colors.candy.lime} onPress={() => setRead(true)} />
          </>
        ) : null}
        {info && read ? (
          <>
            <Text style={styles.hint}>{fa.transfers.weekLeft(info.leftThisWeek)}</Text>
            <Text style={styles.label}>{fa.transfers.pick}</Text>
            <View style={styles.row}>
              {amountChoices(info).map((n) => (
                <Pressable key={n} disabled={busy} onPress={() => send(n)} style={[styles.pill, busy && styles.off]} accessibilityRole="button">
                  <Text style={styles.pillText}>{toPersianDigits(String(n))}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        {note ? <Text style={[styles.hint, note.bad && styles.bad]}>{note.text}</Text> : null}
        <CandyButton label={fa.transfers.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  label: { fontFamily: fonts.bold, fontSize: 15, color: INK, alignSelf: 'flex-start' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.85, alignSelf: 'flex-start' },
  bad: { color: '#B3261E', opacity: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: '#FFC93C' },
  off: { opacity: 0.5 },
  pillText: { fontFamily: fonts.display, fontSize: 18, color: INK },
});
