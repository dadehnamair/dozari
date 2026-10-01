import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MyInvite } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchInvite, redeemInvite } from './api';
import { inviteMessage, redeemErrorText } from './inviteText';

const INK = '#3A2418';

/** «کد معرف»: my code (from a level), what it earns and the rules, and a field to enter a friend's code. */
export function InviteSheet({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<MyInvite | null>(null);
  const [entry, setEntry] = useState('');
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const load = useCallback(() => {
    fetchInvite().then(setInfo, () => setNote({ text: fa.invite.errors.generic ?? '', bad: true }));
  }, []);
  useEffect(load, [load]);

  const redeem = () =>
    redeemInvite(entry).then(
      (r) => (setNote({ text: fa.invite.success(r.bonus), bad: false }), setEntry(''), load()),
      (e) => setNote({ text: redeemErrorText(e instanceof ApiError ? e.code : 'generic'), bad: true }),
    );
  const share = () => {
    if (info?.code) void Share.share({ message: inviteMessage(info.code, info.rules.inviteeBonus) }).catch(() => undefined);
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.invite.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.invite.title}</Text>
        <Text style={styles.hint}>{fa.invite.sub}</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {info ? (
            <>
              <Text style={styles.label}>{fa.invite.yourCode}</Text>
              {info.code ? (
                <>
                  <Text selectable style={styles.code}>{info.code}</Text>
                  <Text style={styles.hint}>{fa.invite.uses(info.uses, info.maxUses)} · {fa.invite.rewarded}: {info.rewarded} · {fa.invite.pending}: {info.pending}</Text>
                  <CandyButton label={fa.invite.share} color={colors.candy.lime} onPress={share} />
                </>
              ) : (
                <Text style={styles.hint}>{fa.invite.lockedLevel(info.minLevel)}</Text>
              )}
              <Text style={styles.label}>{fa.invite.rulesTitle}</Text>
              <Text style={styles.hint}>• {fa.invite.rules.invitee(info.rules.inviteeBonus)}</Text>
              <Text style={styles.hint}>• {fa.invite.rules.inviter(info.rules.inviterReward, info.rules.rewardAfterGames)}</Text>
              <Text style={styles.hint}>• {fa.invite.rules.once}</Text>
              {info.activated ? (
                <Text style={styles.label}>{fa.invite.activated}</Text>
              ) : (
                <>
                  <Text style={styles.label}>{fa.invite.enterTitle}</Text>
                  <View style={styles.row}>
                    <TextInput value={entry} onChangeText={setEntry} autoCapitalize="characters" autoCorrect={false} maxLength={20} placeholder={fa.invite.enterPlaceholder} style={styles.input} accessibilityLabel={fa.invite.enterTitle} />
                    <Pressable onPress={() => void redeem()} style={styles.pill} accessibilityRole="button">
                      <Text style={styles.pillText}>{fa.invite.enter}</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </>
          ) : null}
          {note ? <Text style={[styles.hint, note.bad && styles.bad]}>{note.text}</Text> : null}
        </ScrollView>
        <CandyButton label={fa.invite.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 380, maxHeight: '88%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  scroll: { alignSelf: 'stretch', flexGrow: 0 },
  content: { gap: 8, alignItems: 'center' },
  label: { fontFamily: fonts.bold, fontSize: 15, color: INK, alignSelf: 'flex-start' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.8, alignSelf: 'flex-start' },
  bad: { color: '#B3261E', opacity: 1 },
  code: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 4, color: INK, writingDirection: 'ltr' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'stretch' },
  input: { flex: 1, fontFamily: fonts.bold, fontSize: 18, color: INK, borderWidth: 2, borderColor: INK, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff', textAlign: 'left', writingDirection: 'ltr' },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: INK },
});
