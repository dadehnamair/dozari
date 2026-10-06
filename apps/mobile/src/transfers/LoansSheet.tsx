import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TransferRow } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { GuideBubble } from '../components/GuideBubble';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { answerLoan, fetchTransfers, repayLoan } from './api';
import { transferErrorText } from './rulesText';
import { useHardwareBack } from '../nav/useHardwareBack';

const INK = '#3A2418';
const n = (v: number) => toPersianDigits(String(v));

const title = (t: TransferRow): string => {
  const f = fa.transfers;
  if (t.kind === 'gift') return t.direction === 'out' ? f.outGift(t.otherName) : f.inGift(t.otherName);
  return t.direction === 'out' ? f.outLoan(t.otherName) : f.inLoan(t.otherName);
};

/** «هدیه و قرض‌ها»: what I sent and received; accept or decline offers, repay, cancel. */
export function LoansSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [rows, setRows] = useState<TransferRow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchTransfers().then(setRows, () => setNote(fa.transfers.errors.generic ?? ''));
  }, []);
  useEffect(load, [load]);

  const act = (p: Promise<void>) =>
    p.then(
      () => (setNote(null), load()),
      (e) => (setNote(transferErrorText(e instanceof ApiError ? e.code : 'generic')), load()),
    );

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.transfers.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.transfers.loansOpen}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.content}>
          <GuideBubble who="baqal" text={fa.transfers.baqalHello} />
          {rows && rows.length === 0 ? <Text style={styles.hint}>{fa.transfers.none}</Text> : null}
          {rows?.map((t) => (
            <View key={t.id} style={styles.item}>
              <View style={styles.itemText}>
                <Text style={styles.name}>{title(t)} · {n(t.amount)}</Text>
                <Text style={[styles.hint, t.overdue && styles.bad]}>
                  {fa.transfers.status[t.status] ?? t.status}
                  {t.kind === 'loan' && t.status === 'open' ? ` · ${fa.transfers.repaidOf(t.repaid, t.amount)}` : ''}
                  {t.overdue ? ` · ${fa.transfers.overdue}` : ''}
                </Text>
              </View>
              {t.kind === 'loan' && t.status === 'offered' && t.direction === 'in' ? (
                <>
                  <Pressable onPress={() => void act(answerLoan(t.id, 'accept'))} style={[styles.pill, styles.on]}><Text style={styles.pillText}>{fa.transfers.accept}</Text></Pressable>
                  <Pressable onPress={() => void act(answerLoan(t.id, 'decline'))} style={styles.pill}><Text style={styles.pillText}>{fa.transfers.decline}</Text></Pressable>
                </>
              ) : null}
              {t.kind === 'loan' && t.status === 'offered' && t.direction === 'out' ? (
                <Pressable onPress={() => void act(answerLoan(t.id, 'cancel'))} style={styles.pill}><Text style={styles.pillText}>{fa.transfers.cancel}</Text></Pressable>
              ) : null}
              {t.kind === 'loan' && t.status === 'open' && t.direction === 'in' ? (
                <Pressable onPress={() => void act(repayLoan(t.id, t.amount - t.repaid))} style={[styles.pill, styles.on]}><Text style={styles.pillText}>{fa.transfers.repay}</Text></Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
        {note ? <Text style={[styles.hint, styles.bad]}>{note}</Text> : null}
        <CandyButton label={fa.transfers.close} sfx="back" color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 400, maxHeight: '88%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  list: { alignSelf: 'stretch', flexGrow: 0 },
  content: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 14, borderWidth: 2, borderColor: INK, backgroundColor: colors.card },
  itemText: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.8 },
  bad: { color: '#B3261E', opacity: 1 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  on: { backgroundColor: '#7ED957' },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: INK },
});
