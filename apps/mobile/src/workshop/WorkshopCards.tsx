import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPersianNumber } from '@dozari/shared';
import type { WorkshopInfo } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { buzz, playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';

const t = fa.workshop;
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const N = (n: number) => formatPersianNumber(n);

/** A soft breathing scale, to catch the eye. */
function usePulse(strength = 0.03): Animated.AnimatedInterpolation<number> {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + strength] });
}

/**
 * The Home card of the question workshop (docs/logic/question-workshop.md §Making people want to do it): the live reward, a loud ribbon
 * during a campaign, and a red badge with the number of questions waiting for the player's review.
 */
export function WorkshopHomeCard({ info, onOpen }: { info: WorkshopInfo; onOpen: () => void }) {
  const scale = usePulse(info.boostPercent > 0 || info.waiting > 0 ? 0.035 : 0.02);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.homeTitle} onPress={() => (playSfx('confirm'), buzz(15), onOpen())} style={({ pressed }) => [styles.card, info.boostPercent > 0 ? styles.cardBoost : null, pressed ? styles.pressed : null]}>
        <Text style={styles.icon}>✍️</Text>
        <View style={styles.texts}>
          <Text style={styles.title}>{t.homeTitle}</Text>
          <Text style={styles.sub}>{info.boostPercent > 0 ? t.homeBoost(N(info.boostPercent)) : t.homeReward(N(info.rewardCoins))}</Text>
          <Text style={styles.sub2}>{info.waiting > 0 ? t.homeWaiting(N(info.waiting)) : t.homeEmpty}</Text>
        </View>
        {info.waiting > 0 ? <Text style={styles.badge}>{N(info.waiting)}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

/** The call-to-action after a question game («از این سؤال‌ها خوشت اومد؟ خودت بساز…»). */
export function WorkshopPromo({ reward, boost, onOpen }: { reward: number; boost?: number; onOpen: () => void }) {
  const scale = usePulse(0.025);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.promoAction} onPress={() => (playSfx('confirm'), buzz(15), onOpen())} style={[styles.promo, boost && boost > 0 ? styles.cardBoost : null]}>
        <Text style={styles.promoText}>{t.promo(N(reward))}</Text>
        {boost && boost > 0 ? <Text style={styles.promoBoost}>{t.homeBoost(N(boost))}</Text> : null}
        <Text style={styles.promoAction}>{t.promoAction} ›</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: ROW, alignItems: 'center', gap: 10, padding: 12, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.yellow },
  cardBoost: { backgroundColor: '#FF8A3D' },
  pressed: { transform: [{ translateY: 2 }] },
  icon: { fontSize: 34 },
  texts: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, textAlign: 'center' },
  sub2: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.8, textAlign: 'center' },
  badge: { minWidth: 28, textAlign: 'center', fontFamily: fonts.display, fontSize: 15, color: '#fff', backgroundColor: '#E53935', borderRadius: 99, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  promo: { gap: 2, padding: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center' },
  promoText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 26, color: colors.ink, textAlign: 'center' },
  promoBoost: { fontFamily: fonts.display, fontSize: 14, color: '#fff', textAlign: 'center' },
  promoAction: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
});
