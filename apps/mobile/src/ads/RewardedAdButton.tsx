import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AdOffer, AdPlacement } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchAds } from './api';
import { adProvider } from './provider';
import { runRewardedAd } from './runAd';
import type { AdRun } from './runAd';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/**
 * «ببین و جایزه بگیر»: shown only when the server offers this placement to this player (adult, ads and this placement switched on, cap and
 * cooldown not hit) AND an ad network is ready. `onRewarded` gets what the server paid, so the screen can refresh its balance.
 */
export function RewardedAdButton({ placement, onRewarded }: { placement: AdPlacement; onRewarded?: (paid: Extract<AdRun, { ok: true }>) => void }) {
  const [offer, setOffer] = useState<AdOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => fetchAds().then((s) => setOffer(s.offers.find((o) => o.placement === placement) ?? null), () => setOffer(null)), [placement]);
  useEffect(() => void load(), [load]);

  if (!offer || !adProvider()) return null;
  const t = fa.ads;
  const wait = offer.cooldownLeft > 0;
  const go = async () => {
    if (busy || wait) return;
    setBusy(true);
    setNote(null);
    const out = await runRewardedAd(placement, adProvider());
    setBusy(false);
    if (out.ok) {
      setNote(t.paid(out.rewardAmount, t.kinds[out.rewardKind] ?? ''));
      onRewarded?.(out);
    } else if (out.reason !== 'dismissed') setNote(t.failed[out.reason] ?? t.failed.failed ?? null);
    void load();
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => void go()} disabled={busy || wait} accessibilityRole="button" style={({ pressed }) => [styles.btn, busy || wait ? styles.off : null, pressed ? styles.pressed : null]}>
        <Text style={styles.icon}>🎬</Text>
        <View style={styles.texts}>
          <Text style={styles.title}>{busy ? t.playing : wait ? t.cooldown(offer.cooldownLeft) : t.watch(offer.rewardAmount, t.kinds[offer.rewardKind] ?? '')}</Text>
          <Text style={styles.sub}>{t.left(offer.leftToday)}</Text>
        </View>
      </Pressable>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 6 },
  btn: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.yellow },
  off: { opacity: 0.55 },
  pressed: { transform: [{ translateY: 2 }] },
  icon: { fontSize: 26 },
  texts: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.display, fontSize: 16, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.ink, opacity: 0.75, textAlign: 'center' },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center' },
});
