import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Shop, ShopItem } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { buyItem, fetchShop } from './api';

const INK = '#3A2418';
const n = (v: number) => toPersianDigits(String(v));

const stateText = (it: ShopItem): string | null => {
  if (it.blocked === 'LEVEL') return fa.shop.needLevel(it.minLevel);
  if (it.blocked === 'DAILY_LIMIT') return fa.shop.dailyLimit;
  if (it.blocked === 'COINS') return fa.shop.needCoins;
  return it.leftToday !== null ? fa.shop.leftToday(it.leftToday) : null;
};

/** «فروشگاه»: everything is bought with coins; the level gate and daily limit are shown before the player taps. */
export function ShopSheet({ onClose, onBalance }: { onClose: () => void; onBalance?: (coins: number) => void }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchShop().then(
      (s) => (setShop(s), onBalance?.(s.balance)),
      () => setNote(fa.shop.error),
    );
  }, [onBalance]);
  useEffect(load, [load]);

  const buy = (it: ShopItem) =>
    buyItem(it.id).then(
      () => (setNote(fa.shop.bought), load()),
      () => (setNote(fa.shop.error), load()),
    );

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.shop.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.shop.title}</Text>
        <Text style={styles.hint}>{fa.shop.sub}</Text>
        {shop ? <Text style={styles.hint}>{fa.shop.balance}: {n(shop.balance)} {fa.shop.price} · {fa.shop.tokens}: {n(shop.tokens)}</Text> : null}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {shop?.items.map((it) => {
            const why = stateText(it);
            const locked = it.blocked !== null;
            return (
              <View key={it.id} style={styles.item}>
                {it.iconKey ? <View style={styles.icon}><Item icon={it.iconKey} /></View> : null}
                <View style={styles.itemText}>
                  <Text style={styles.itemName}>{it.titleFa} · {fa.shop.amount(it.amount)}</Text>
                  <Text style={styles.hint}>{it.descriptionFa}</Text>
                  {why ? <Text style={[styles.hint, locked && styles.warn]}>{why}</Text> : null}
                </View>
                <Pressable disabled={locked} onPress={() => void buy(it)} style={[styles.buy, locked && styles.off]} accessibilityRole="button">
                  <Text style={styles.buyText}>{n(it.priceCoins)}</Text>
                  <Text style={styles.buyUnit}>{fa.shop.buy}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
        {note ? <Text style={styles.hint}>{note}</Text> : null}
        <CandyButton label={fa.shop.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 400, maxHeight: '88%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.75, textAlign: 'center' },
  warn: { color: '#B3261E', opacity: 1 },
  list: { alignSelf: 'stretch', flexGrow: 0 },
  listContent: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: INK, backgroundColor: '#fff' },
  icon: { width: 44, height: 44 },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontFamily: fonts.bold, fontSize: 15, color: INK },
  buy: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 2, borderColor: INK, backgroundColor: '#7ED957' },
  off: { opacity: 0.4 },
  buyText: { fontFamily: fonts.display, fontSize: 16, color: INK },
  buyUnit: { fontFamily: fonts.bold, fontSize: 11, color: INK },
});
