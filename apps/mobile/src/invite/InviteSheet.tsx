import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MyInvite } from '@dozari/shared';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { SlabButton } from '../components/SlabButton';
import { GameTopBar } from '../game/GameTopBar';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { fetchInvite, redeemInvite } from './api';
import { inviteMessage, redeemErrorText } from './inviteText';
import { useHardwareBack } from '../nav/useHardwareBack';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
/** Progress boxes under the code: at most this many, the last one a chest. */
const STEPS = 5;

type Clip = { writeText: (t: string) => Promise<void> };
/** The browser clipboard on the web; native has no clipboard module yet (the code stays selectable and shareable). */
const clipboard = (): Clip | null => {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  return (navigator as unknown as { clipboard?: Clip }).clipboard ?? null;
};

/** screen-invite of `19 Social Daily Onboarding`: my code with copy, how many came, the rules, sharing, and entering a friend's code. */
export function InviteSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [info, setInfo] = useState<MyInvite | null>(null);
  const [entry, setEntry] = useState('');
  const [copied, setCopied] = useState(false);
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
  const clip = clipboard();
  const copy = () => {
    if (info?.code && clip) void clip.writeText(info.code).then(() => setCopied(true), () => undefined);
  };
  const steps = info ? Math.min(STEPS, info.maxUses) : STEPS;
  const came = info ? info.uses : 0;

  return (
    <View style={styles.root}>
      <GradientFill from={colors.candy.sky} to={colors.ink} mid={{ at: 0.45, color: '#2A8CC8' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <GameTopBar title={fa.invite.title} backLabel={fa.invite.close} onBack={onClose} />
          <View style={styles.cast}>
            <View style={[styles.side, styles.flip]}><Character who="mashti" pose="wave" /></View>
            <View style={styles.hero}><Character who="dozari" pose="win" /></View>
            <View style={styles.side}><Character who="goli" pose="cheer" /></View>
          </View>
          <Text style={styles.headline}>{fa.invite.headline}</Text>
          {info ? <Text style={styles.sub}>{fa.invite.perInvite(info.rules.inviterReward, info.rules.inviteeBonus)}</Text> : null}

          {info ? (
            <View style={styles.card}>
              <Text style={styles.label}>{fa.invite.yourCode}</Text>
              {info.code ? (
                <>
                  <View style={styles.codeRow}>
                    <View style={styles.codeBox}><Text selectable style={styles.code}>{info.code}</Text></View>
                    {clip ? (
                      <Pressable accessibilityRole="button" onPress={copy} style={[styles.copy, copied ? styles.copied : null]}>
                        <Text style={styles.copyText}>{copied ? fa.invite.copied : fa.invite.copy}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.progressHead}>
                    <Text style={styles.small}>{fa.invite.came(came, info.maxUses)}</Text>
                    <Text style={[styles.small, styles.grape]}>{fa.invite.rewarded}: {info.rewarded} · {fa.invite.pending}: {info.pending}</Text>
                  </View>
                  <View style={styles.steps}>
                    {Array.from({ length: steps }, (_, k) => (
                      <View key={k} style={[styles.step, k < came ? styles.stepOn : null]}>
                        <View style={[styles.stepIcon, k < came ? null : styles.stepOff]}><Item icon={k === steps - 1 ? 'chest' : 'coin'} /></View>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.small}>{fa.invite.lockedLevel(info.minLevel)}</Text>
              )}
              <Text style={styles.label}>{fa.invite.rulesTitle}</Text>
              <Text style={styles.small}>• {fa.invite.rules.invitee(info.rules.inviteeBonus)}</Text>
              <Text style={styles.small}>• {fa.invite.rules.inviter(info.rules.inviterReward, info.rules.rewardAfterGames)}</Text>
              <Text style={styles.small}>• {fa.invite.rules.once}</Text>
              {info.activated ? (
                <Text style={styles.label}>{fa.invite.activated}</Text>
              ) : (
                <>
                  <Text style={styles.label}>{fa.invite.enterTitle}</Text>
                  <View style={styles.codeRow}>
                    <TextInput value={entry} onChangeText={setEntry} autoCapitalize="characters" autoCorrect={false} maxLength={20} placeholder={fa.invite.enterPlaceholder} style={styles.input} accessibilityLabel={fa.invite.enterTitle} />
                    <Pressable onPress={() => void redeem()} style={styles.copy} accessibilityRole="button"><Text style={styles.copyText}>{fa.invite.enter}</Text></Pressable>
                  </View>
                </>
              )}
              {note ? <Text style={[styles.small, note.bad ? styles.bad : null]}>{note.text}</Text> : null}
            </View>
          ) : note ? <Text style={styles.sub}>{note.text}</Text> : null}

          <View style={styles.spacer} />
          {info?.code ? (
            <>
              <Text style={styles.sub}>{fa.invite.shareTo}</Text>
              <SlabButton label={fa.invite.share} color={colors.candy.lime} height={60} fontSize={22} grow={0} onPress={share} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#2A8CC8' },
  scroll: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 26, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 480, gap: 8 },
  cast: { flexDirection: ROW, justifyContent: 'center', alignItems: 'flex-end', marginTop: 4 },
  side: { width: 104, height: 120, marginHorizontal: -16 },
  hero: { width: 132, height: 152, zIndex: 1 },
  flip: { transform: [{ scaleX: -1 }] },
  headline: { fontFamily: fonts.display, fontSize: 26, color: '#fff', textAlign: 'center', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1 },
  sub: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream, textAlign: 'center' },
  card: { marginTop: 6, padding: 12, borderRadius: 22, backgroundColor: '#FBF1DE', borderWidth: 3, borderColor: colors.ink, gap: 8, ...lift(5) },
  label: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: 'right' },
  codeRow: { flexDirection: ROW, gap: 6 },
  codeBox: { flex: 1, height: 52, borderRadius: 14, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  code: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 4, color: colors.ink, writingDirection: 'ltr' },
  copy: { minWidth: 84, height: 52, paddingHorizontal: 10, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center', ...lift(4) },
  copied: { backgroundColor: colors.candy.lime },
  copyText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  progressHead: { flexDirection: ROW, justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  small: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 19, color: colors.ink, textAlign: 'right' },
  grape: { color: '#7E46D6' },
  steps: { flexDirection: ROW, gap: 4 },
  step: { flex: 1, height: 40, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepOn: { backgroundColor: '#B8F08F' },
  stepIcon: { width: 28, height: 28 },
  stepOff: { opacity: 0.35 },
  input: { flex: 1, height: 52, fontFamily: fonts.bold, fontSize: 18, color: colors.ink, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, paddingHorizontal: 10, backgroundColor: '#fff', textAlign: 'left', writingDirection: 'ltr' },
  bad: { color: '#B3261E' },
  spacer: { flex: 1, minHeight: 10 },
});
