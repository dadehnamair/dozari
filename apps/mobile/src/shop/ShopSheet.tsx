import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Shop, ShopItem } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { GuideBubble } from '../components/GuideBubble';
import { Item } from '../components/Item';
import { Scene } from '../components/Scene';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { buyItem, fetchShop } from './api';
import { pageTop } from '../theme/safeArea';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));

/** Tabs of screen-shop (design 17). Only «کمکی» (hint tokens) has goods today; the rest open with later features. */
const CARD_H = 190;
const CARD_H_TIGHT = 140;
const CARD_GAP = 10;
const PAGER_H = 44;

const TABS = [
  { key: 'coins', icon: 'coinStack' },
  { key: 'gems', icon: 'gem' },
  { key: 'boost', icon: 'magnifier' },
  { key: 'outfit', icon: 'medal' },
  { key: 'avatar', icon: 'crown' },
  { key: 'offer', icon: 'gift' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** The guide's longer explanation of why an item cannot be bought right now. */
const whyText = (it: ShopItem): string | null => {
  const w = it.blocked ? fa.shop.why[it.blocked] : undefined;
  return typeof w === 'function' ? w(it.minLevel) : (w ?? null);
};

const stateText = (it: ShopItem): string | null => {
  if (it.blocked === 'LEVEL') return fa.shop.needLevel(it.minLevel);
  if (it.blocked === 'DAILY_LIMIT') return fa.shop.dailyLimit;
  if (it.blocked === 'COINS') return fa.shop.needCoins;
  return it.leftToday !== null ? fa.shop.leftToday(it.leftToday) : null;
};

/**
 * screen-shop of `17 Chat Shop Unlocks`: the hujre scene under a dark veil, the yellow «حجرهٔ دوزاری» plate with the
 * coin count, six tabs and a two-column grid of goods; a purchase ends in the «مال خودت شد!» card. Everything is
 * bought with coins (`shop.md`); the level gate and daily limit show on the card before the player taps.
 */
export function ShopSheet({ onClose, onBalance }: { onClose: () => void; onBalance?: (coins: number) => void }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [tab, setTab] = useState<TabKey>('boost');
  const [note, setNote] = useState<string | null>(null);
  const [whyLocked, setWhyLocked] = useState<string | null>(null);
  const [bought, setBought] = useState<ShopItem | null>(null);
  // Nothing scrolls: the items are paged, as many per page as the measured height allows.
  const [boxH, setBoxH] = useState(0);
  const [page, setPage] = useState(0);
  const tight = boxH > 0 && boxH < 470;
  const rows = Math.max(1, Math.floor((boxH - PAGER_H + CARD_GAP) / ((tight ? CARD_H_TIGHT : CARD_H) + CARD_GAP)));
  const perPage = rows * 2;
  const items = tab === 'boost' ? (shop?.items ?? []) : [];
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const at = Math.min(page, pages - 1);

  const load = useCallback(() => {
    fetchShop().then(
      (s) => (setShop(s), setNote(null), onBalance?.(s.balance)),
      () => setNote(fa.shop.error),
    );
  }, [onBalance]);
  useEffect(load, [load]);

  const buy = (it: ShopItem) =>
    buyItem(it.id).then(
      () => (setBought(it), load()),
      () => (setNote(fa.shop.error), load()),
    );
  const pick = (k: TabKey) => (setTab(k), setNote(k === 'boost' ? null : fa.shop.soon));

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><Scene scene="hojre" /></View>
      <View style={styles.veil} pointerEvents="none"><GradientFill from="rgba(43,18,64,0.55)" to="rgba(43,18,64,0.82)" /></View>
      <View style={styles.column}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={fa.shop.close} onPress={onClose}>
            {({ pressed }) => (
              <View style={[styles.back, pressed ? styles.pressed : null]}>
                <GradientFill from="#FFE48A" to={colors.candy.yellow} />
                <Icon name="back" size={22} color={colors.ink} strokeWidth={3} />
              </View>
            )}
          </Pressable>
          <View style={styles.plate}>
            <GradientFill from="#FFE48A" to={colors.candy.yellow} />
            <Text style={styles.plateText}>{fa.shop.room}</Text>
          </View>
          {shop ? (
            <View style={styles.pill} accessibilityLabel={`${fa.shop.balance} ${shop.balance}`}>
              <Text style={styles.pillText}>{n(shop.balance)}</Text>
              <View style={styles.pillIcon}><Item icon="coin" /></View>
            </View>
          ) : null}
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => pick(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={styles.tabCell}>
                <View style={[styles.tab, on ? styles.tabOn : null, t.key !== 'boost' ? styles.tabSoon : null]}>
                  <View style={styles.tabIcon}><Item icon={t.icon} /></View>
                  <Text style={styles.tabText} numberOfLines={1}>{fa.shop.tabs[t.key]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {whyLocked ? <Pressable onPress={() => setWhyLocked(null)} accessibilityRole="button"><GuideBubble who="baqal" text={whyLocked} /></Pressable> : <GuideBubble who="baqal" text={fa.shop.baqalHello} />}

        <View style={styles.list} onLayout={(e) => setBoxH(e.nativeEvent.layout.height)}>
        <View style={styles.grid}>
          {tab === 'boost'
            ? items.slice(at * perPage, (at + 1) * perPage).map((it) => {
                const why = stateText(it);
                const locked = it.blocked !== null;
                return (
                  <View key={it.id} style={styles.cell}>
                    <View style={[styles.card, tight ? styles.cardTight : null]}>
                      <View style={[styles.art, tight ? styles.artTight : null]}>
                        <View style={[styles.artIcon, tight ? styles.artIconTight : null]}><Item icon={it.iconKey ?? 'magnifier'} /></View>
                        {locked ? <View style={styles.lock}><View style={styles.lockIcon}><Item icon="lock" /></View></View> : null}
                      </View>
                      <Text style={styles.name} numberOfLines={1}>{it.titleFa}</Text>
                      <Text style={[styles.sub, tight ? styles.subTight : null]} numberOfLines={2}>{why ?? fa.shop.amount(it.amount)}</Text>
                      <Pressable onPress={() => (locked ? setWhyLocked(whyText(it)) : void buy(it))} accessibilityRole="button" accessibilityLabel={`${fa.shop.buy} ${it.titleFa}`} style={({ pressed }) => [styles.buy, tight ? styles.buyTight : null, locked ? styles.buyOff : null, pressed ? styles.pressed : null]}>
                        <View style={styles.buyIcon}><Item icon="coin" /></View>
                        <Text style={styles.buyText}>{it.priceCoins === 0 ? fa.shop.free : n(it.priceCoins)}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            : null}
        </View>
        {pages > 1 ? (
          <View style={styles.pager}>
            <Pressable disabled={at === 0} onPress={() => setPage(at - 1)} accessibilityRole="button" accessibilityLabel={fa.shop.prev} style={[styles.pageBtn, at === 0 ? styles.buyOff : null]}><Icon name="back" size={18} color={colors.ink} strokeWidth={3} /></Pressable>
            <Text style={styles.pageText}>{n(at + 1)} / {n(pages)}</Text>
            <Pressable disabled={at >= pages - 1} onPress={() => setPage(at + 1)} accessibilityRole="button" accessibilityLabel={fa.shop.next} style={[styles.pageBtn, styles.flipX, at >= pages - 1 ? styles.buyOff : null]}><Icon name="back" size={18} color={colors.ink} strokeWidth={3} /></Pressable>
          </View>
        ) : null}
        </View>
      </View>

      {bought ? (
        <Pressable style={styles.won} onPress={() => setBought(null)} accessibilityLabel={fa.shop.close}>
          <View style={styles.wonIcon}><Item icon={bought.iconKey ?? 'magnifier'} /></View>
          <View style={styles.wonPlate}>
            <GradientFill from="#FFE48A" to={colors.candy.yellow} />
            <Text style={styles.wonText}>{fa.shop.ownedNow}</Text>
          </View>
          <Text style={styles.wonName}>{bought.titleFa} · {fa.shop.amount(bought.amount)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#3C1A66' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 10, paddingTop: pageTop() },
  head: { flexDirection: ROW, alignItems: 'center', gap: 6, marginBottom: 12 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  pill: { flexDirection: ROW, alignItems: 'center', gap: 3, height: 38, paddingHorizontal: 9, borderRadius: 99, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(26,8,44,0.75)' },
  pillText: { fontFamily: fonts.display, fontSize: 15, color: '#fff' },
  pillIcon: { width: 28, height: 28 },
  tabs: { flexDirection: ROW, gap: 4 },
  tabCell: { flex: 1, minWidth: 0 },
  tab: { height: 58, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FFF6E8', alignItems: 'center', justifyContent: 'center', padding: 2, ...lift(4) },
  tabOn: { backgroundColor: colors.candy.yellow, transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 } },
  tabSoon: { opacity: 0.6 },
  tabIcon: { width: 28, height: 28 },
  tabText: { fontFamily: fonts.display, fontSize: 11, color: colors.ink },
  note: { marginTop: 8, fontFamily: fonts.bold, fontSize: 12, color: colors.cream, textAlign: 'center' },
  list: { flex: 1, marginTop: 12 },
  grid: { flexDirection: ROW, flexWrap: 'wrap', gap: CARD_GAP },
  pager: { position: 'absolute', left: 0, right: 0, bottom: 0, height: PAGER_H, flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 14 },
  pageBtn: { width: 36, height: 32, borderRadius: 10, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  cardTight: { paddingTop: 4, paddingBottom: 6 },
  artTight: { height: 40 },
  artIconTight: { width: 38, height: 38 },
  subTight: { minHeight: 0 },
  buyTight: { height: 30 },
  flipX: { transform: [{ scaleX: -1 }] },
  pageText: { fontFamily: fonts.display, fontSize: 16, color: '#fff' },
  cell: { width: '47.8%' },
  card: { borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FBEBD2', alignItems: 'center', paddingTop: 8, paddingBottom: 8, paddingHorizontal: 6, gap: 2, ...lift(5) },
  art: { height: 74, width: '100%', alignItems: 'center', justifyContent: 'center' },
  artIcon: { width: 68, height: 68 },
  lock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, backgroundColor: 'rgba(43,18,64,0.55)', alignItems: 'center', justifyContent: 'center' },
  lockIcon: { width: 40, height: 40 },
  name: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  sub: { fontFamily: fonts.bold, fontSize: 10, color: '#7E46D6', minHeight: 28, textAlign: 'center' },
  buy: { width: '100%', height: 36, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.lime, flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 4, ...lift(3) },
  buyOff: { opacity: 0.45 },
  buyIcon: { width: 20, height: 20 },
  buyText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  won: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9, backgroundColor: 'rgba(26,8,44,0.86)', alignItems: 'center', justifyContent: 'center', gap: 14 },
  wonIcon: { width: 130, height: 130 },
  wonPlate: { paddingHorizontal: 26, paddingVertical: 8, borderRadius: 16, borderWidth: 4, borderColor: colors.ink, overflow: 'hidden', ...lift(6) },
  wonText: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  wonName: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream },
});
