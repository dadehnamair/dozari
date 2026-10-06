import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SHOP_GIFT_EFFECTS, SHOP_GIFT_MAX_COINS } from '@dozari/shared';
import type { ShopItem } from '@dozari/shared';
import { GuideBubble } from '../components/GuideBubble';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';
import { fetchShop, giftItem } from './api';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const g = fa.birthdayGift;

/** The small things from the shop that can be given (hint packs, wheel spins up to `SHOP_GIFT_MAX_COINS`), for a friend in their birthday week. */
export const giftable = (items: readonly ShopItem[], level: number): ShopItem[] =>
  items.filter((i) => (SHOP_GIFT_EFFECTS as readonly string[]).includes(i.effect) && i.currency === 'coins' && i.priceCoins > 0 && i.priceCoins <= SHOP_GIFT_MAX_COINS && i.minLevel <= level);

export function GiftSheet({ friendId, friendName, onClose }: { friendId: string; friendName: string; onClose: () => void }) {
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetchShop().then((s) => (setItems(giftable(s.items, s.level)), setBalance(s.balance)), () => (setItems([]), setNote(g.errors.generic ?? null)));
  }, []);
  const give = (id: string) => {
    if (busy) return;
    setBusy(true);
    giftItem(id, friendId)
      .then((r) => (setBalance(r.balance), setNote(g.sent)), (e) => setNote(g.errors[e instanceof ApiError ? e.code : 'generic'] ?? g.errors.generic ?? null))
      .finally(() => setBusy(false));
  };
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={g.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{g.title(friendName)}</Text>
        <GuideBubble who="baqal" text={g.intro} />
        {balance !== null ? <Text style={styles.balance}>{g.balance(balance)}</Text> : null}
        <ScrollView style={styles.list} contentContainerStyle={styles.content}>
          {items && items.length === 0 ? <Text style={styles.note}>{g.empty}</Text> : null}
          {items?.map((i) => (
            <View key={i.id} style={styles.row}>
              <View style={styles.icon}><Item icon={i.iconKey ?? 'gift'} /></View>
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>{i.titleFa}</Text>
                <Text style={styles.sub}>{g.price(i.priceCoins)}</Text>
              </View>
              <Pressable onPress={() => give(i.id)} disabled={busy} style={[styles.give, busy ? styles.off : null]} accessibilityRole="button"><Text style={styles.giveText}>{g.give}</Text></Pressable>
            </View>
          ))}
        </ScrollView>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button"><Text style={styles.closeText}>{g.close}</Text></Pressable>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, backgroundColor: 'rgba(20,8,32,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 420, maxHeight: '88%', backgroundColor: colors.cream, borderWidth: 3, borderColor: colors.ink, borderRadius: 24, padding: 14, gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, textAlign: 'center' },
  balance: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink, opacity: 0.75, textAlign: 'center' },
  list: { flexGrow: 0 },
  content: { gap: 8 },
  row: { flexDirection: ROW, alignItems: 'center', gap: 10, padding: 8, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff' },
  icon: { width: 40, height: 40 },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: TEXT_RIGHT },
  sub: { fontFamily: fonts.bold, fontSize: 12, color: '#7E46D6', textAlign: TEXT_RIGHT },
  give: { paddingHorizontal: 14, height: 36, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.lime, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.5 },
  giveText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center' },
  close: { alignSelf: 'center', paddingHorizontal: 22, height: 36, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.sky, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
});
