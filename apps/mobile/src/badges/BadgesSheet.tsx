import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MyBadges } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { Item } from '../components/Item';
import { GuideBubble } from '../components/GuideBubble';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { equipBadge, fetchMyBadges, markNoticesRead } from './api';
import { progressText, skillText } from './text';
import { useHardwareBack } from '../nav/useHardwareBack';

const INK = '#3A2418';

/** «نشان‌ها و پیام‌ها»: skill tier, earned and locked badges (with how far along), which one is shown, warnings and commendations. */
export function BadgesSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [me, setMe] = useState<MyBadges | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    fetchMyBadges().then(
      (m) => (setMe(m), setFailed(false)),
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (me?.notices.some((n) => !n.read)) void markNoticesRead().catch(() => undefined);
  }, [me]);

  const equip = (id: string | null) => equipBadge(id).then(load, () => setFailed(true));
  const minutesLeft = me?.muted ? Math.max(1, Math.ceil((me.muted.until - Date.now()) / 60_000)) : 0;

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.badges.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.badges.title}</Text>
        {failed ? <Text style={styles.warn}>{fa.badges.error}</Text> : null}
        <ScrollView style={styles.list} contentContainerStyle={styles.content}>
          <GuideBubble who="ajan" text={fa.badges.ajanHello} />
          {me ? (
            <>
              <Text style={styles.label}>{fa.badges.skillTitle}: {skillText(me.skill)}</Text>
              {me.muted ? <Text style={styles.warn}>{fa.badges.muted(minutesLeft)}</Text> : null}
              <Text style={styles.label}>{fa.badges.earned}</Text>
              {me.earned.length === 0 ? <Text style={styles.hint}>{fa.badges.noneEarned}</Text> : null}
              {me.earned.map((b) => (
                <View key={b.id} style={styles.item}>
                  {b.iconKey ? <View style={styles.icon}><Item icon={b.iconKey} /></View> : null}
                  <View style={styles.itemText}>
                    <Text style={styles.name}>{b.titleFa}</Text>
                    <Text style={styles.hint}>{b.descriptionFa}</Text>
                    {b.perk !== 'none' ? <Text style={styles.hint}>• {fa.badges.perks[b.perk]}</Text> : null}
                  </View>
                  {b.kind === 'badge' ? (
                    <Pressable onPress={() => void equip(me.equippedId === b.id ? null : b.id)} style={[styles.pill, me.equippedId === b.id && styles.on]} accessibilityRole="button">
                      <Text style={styles.pillText}>{me.equippedId === b.id ? fa.badges.shown : fa.badges.show}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {me.locked.length > 0 ? <Text style={styles.label}>{fa.badges.locked}</Text> : null}
              {me.locked.map((b) => (
                <View key={b.id} style={[styles.item, styles.lockedItem]}>
                  <View style={styles.itemText}>
                    <Text style={styles.name}>{b.titleFa}</Text>
                    <Text style={styles.hint}>{b.descriptionFa}</Text>
                    <Text style={styles.hint}>{progressText(b.metric, b.have, b.min)}</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.label}>{fa.badges.notices}</Text>
              {me.notices.length === 0 ? <Text style={styles.hint}>{fa.badges.noNotices}</Text> : null}
              {me.notices.map((n) => (
                <View key={n.id} style={styles.item}>
                  <View style={styles.itemText}>
                    <Text style={[styles.name, n.kind === 'warning' && styles.warn]}>{n.kind === 'warning' ? fa.badges.warning : fa.badges.commendation}</Text>
                    <Text style={styles.hint}>{n.text}</Text>
                    <Text style={styles.hint}>{n.by === 'agent' ? fa.badges.byAgent : fa.badges.byAdmin}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
        <CandyButton label={fa.badges.close} sfx="back" color={colors.candy.sky} onPress={onClose} />
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
  label: { fontFamily: fonts.bold, fontSize: 15, color: INK },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.8 },
  warn: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 14, borderWidth: 2, borderColor: INK, backgroundColor: '#fff' },
  lockedItem: { opacity: 0.6 },
  icon: { width: 40, height: 40 },
  itemText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: INK, backgroundColor: colors.cream },
  on: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 12, color: INK },
});
