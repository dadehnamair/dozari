import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ShopItem } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { RadialFill } from './RadialFill';
import { RARITY, rarityOf } from './rarity';
import { actionFor, priceOf } from './tryOn';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const grouped = (n: number): string => toPersianDigits(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '٬'));

/**
 * One card of a pack (design `21 Cosmetic Packs`): a backdrop tinted by rarity with the item on a face, the rarity badge, a green tick when it is
 * on the stage, the name, and the price button (gold = to buy, white = owned, green = worn). The level a locked item needs is a chip *inside* the picture.
 */
export function PackCard({ item, on, onTry, onAct, onPay, realMoney }: { item: ShopItem; on: boolean; onTry: () => void; onAct: () => void; onPay: () => void; realMoney: boolean }) {
  const r = RARITY[rarityOf(item)];
  const action = actionFor(item);
  const locked = action === 'locked';
  const label = item.owned ? (item.equipped ? fa.shop.worn : fa.shop.wear) : priceOf(item) === 0 ? fa.shop.free : grouped(priceOf(item));
  const pay = !item.owned && priceOf(item) > 0;
  return (
    <Pressable onPress={onTry} accessibilityRole="button" accessibilityLabel={item.titleFa} accessibilityState={{ selected: on }} style={[styles.card, on ? styles.cardOn : null]}>
      <View style={styles.pic}>
        <RadialFill stops={[[0, '#FFFFFF'], [0.7, r.backdrop]]} cy={0.35} r={0.7} />
        <View style={styles.face}><Item icon={item.iconKey ?? 'magnifier'} /></View>
        <View style={[styles.rarity, { backgroundColor: r.color }]}><Text style={styles.rarityText}>{r.name}</Text></View>
        {on ? <View style={styles.tick}><Text style={styles.tickText}>✓</Text></View> : null}
        {locked && item.blocked === 'LEVEL' ? <View style={styles.lock}><Text style={styles.lockText}>{fa.shop.needLevel(item.minLevel)}</Text></View> : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>{item.titleFa}</Text>
      <Pressable onPress={onAct} accessibilityRole="button" accessibilityLabel={item.owned ? (item.equipped ? fa.shop.takeOff : fa.shop.wear) : `${fa.shop.buy} ${item.titleFa}`} style={({ pressed }) => [styles.btn, item.owned ? (item.equipped ? styles.btnWorn : styles.btnOwned) : null, locked ? styles.btnOff : null, pressed ? styles.pressed : null]}>
        {!item.owned ? <GradientFill from="#FFE48A" to={colors.candy.yellow} /> : null}
        {pay ? <View style={styles.payIcon}><Item icon={item.currency === 'gems' ? 'gem' : 'coin'} /></View> : null}
        <Text style={styles.btnText} numberOfLines={1}>{label}</Text>
      </Pressable>
      {realMoney && item.priceToman > 0 && !item.owned ? (
        <Pressable onPress={onPay} accessibilityRole="button" accessibilityLabel={`${fa.shop.payMoney} ${item.titleFa}`} style={({ pressed }) => [styles.money, pressed ? styles.pressed : null]}>
          <Text style={styles.moneyText} numberOfLines={1}>{fa.shop.toman(item.priceToman)}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  card: { width: '48%', borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFF6E8', padding: 6, paddingBottom: 8, gap: 4, ...lift(4) },
  cardOn: { borderColor: colors.candy.yellow, backgroundColor: '#FFF1C9' },
  pic: { height: 124, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  face: { width: 100, height: 108 },
  rarity: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 7, borderRadius: 8, borderWidth: 2, borderColor: colors.ink },
  rarityText: { fontFamily: fonts.display, fontSize: 12, color: colors.ink },
  tick: { position: 'absolute', top: 6, left: 6, width: 26, height: 26, borderRadius: 13, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#7ED957', alignItems: 'center', justifyContent: 'center' },
  tickText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  lock: { position: 'absolute', bottom: 6, left: 6, right: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(43,18,64,0.8)', alignItems: 'center' },
  lockText: { fontFamily: fonts.display, fontSize: 12, color: '#fff' },
  name: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.ink, textAlign: 'center' },
  btn: { height: 34, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden', flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 4, ...lift(3) },
  btnOwned: { backgroundColor: '#fff' },
  btnWorn: { backgroundColor: '#B8F08F' },
  btnOff: { opacity: 0.5 },
  pressed: { transform: [{ translateY: 2 }] },
  payIcon: { width: 20, height: 20 },
  btnText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  money: { height: 28, borderRadius: 10, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.sky, alignItems: 'center', justifyContent: 'center' },
  moneyText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
});
