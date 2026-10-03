import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import type { LevelRoad, Unlock } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { claimLevelRewards, fetchLevelRoad } from './api';
import { claimableCoins, claimableSpins, levelProgress, roadNodes, xpToReach } from './road';
import type { RoadNode } from './road';
import { roadLayout, skyStars } from './roadPath';
import { pageTop } from '../theme/safeArea';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TEXT_START } from '../theme/direction';

const ROW = ('row-reverse' as const);
const n = (v: number) => toPersianDigits(String(v));

const view = (u: Unlock): { title: string; text: string; icon: string } => {
  if (u.kind === 'shop') return { title: u.titleFa ?? '', text: '', icon: u.iconKey ?? 'magnifier' };
  return fa.levels.unlock[u.kind] ?? { title: '', text: '', icon: 'coin' };
};

/**
 * screen-levels of `17 Chat Shop Unlocks` (D109): a purple night, the yellow «جادهٔ لول‌ها» plate and the road itself —
 * one round node per level on a cream path (done: gold with a tick, current: yellow with the hero waving, ahead: grey
 * with a padlock), cards beside the levels that open something. Tapping an unlocked-later card opens the locked popup.
 * What each level opens comes from the real gates (`GET /me/levels`).
 */
export function LevelRoadPage({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [road, setRoad] = useState<LevelRoad | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState<{ unlock: Unlock } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [got, setGot] = useState<{ coins: number; spins: number } | null>(null);
  const scroller = useRef<ScrollView>(null);
  const win = useWindowDimensions();
  const width = Math.min(520, win.width);

  useEffect(() => {
    fetchLevelRoad().then(setRoad, () => setFailed(true));
  }, []);
  const nodes = road ? roadNodes(road) : [];
  const ready = road ? claimableCoins(road) + claimableSpins(road) : 0;
  const claim = () => {
    if (claiming || ready === 0) return;
    setClaiming(true);
    claimLevelRewards().then(
      (out) => {
        setGot({ coins: out.coins, spins: out.spins });
        return fetchLevelRoad().then(setRoad);
      },
      () => setFailed(true),
    ).finally(() => setClaiming(false));
  };
  // Bring the current level into view once the road is drawn (the list runs from the top level down).
  useEffect(() => {
    if (!road) return;
    const here = roadLayout(road.levelMax, width).points.find((p) => p.level === road.level);
    const t = setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, (here?.y ?? 0) - (win.height - 200) * 0.55), animated: false }), 60);
    return () => clearTimeout(t);
  }, [road]);

  return (
    <View style={styles.root}>
      <View style={styles.sky} pointerEvents="none"><GradientFill from="#5E1F7E" to="#2B1240" mid={{ at: 0.5, color: '#3C1A66' }} /></View>
      <View style={styles.column}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={fa.levels.close} onPress={onClose}>
            {({ pressed }) => (
              <View style={[styles.back, pressed ? styles.pressed : null]}>
                <GradientFill from="#C9A3FF" to="#A66BF0" />
                <Icon name="back" size={22} color="#fff" strokeWidth={3} />
              </View>
            )}
          </Pressable>
          <View style={styles.plate}>
            <GradientFill from="#FFE48A" to={colors.candy.yellow} />
            <Text style={styles.plateText}>{fa.levels.title}</Text>
          </View>
        </View>
        {road ? (
          <View style={styles.xpBox}>
            <View style={styles.xpHead}>
              <Text style={styles.xpLevel}>{fa.levels.popup.yours(road.level)}</Text>
              <Text style={styles.xpText}>{road.xpForNext === 0 ? fa.levels.maxLevel : fa.levels.xpOf(road.xpInLevel, road.xpForNext)}</Text>
            </View>
            <View style={styles.xpBar}><View style={[styles.xpFill, { width: `${Math.round(levelProgress(road) * 100)}%` }]} /></View>
            {ready > 0 ? (
              <Pressable accessibilityRole="button" onPress={claim} disabled={claiming} style={({ pressed }) => [styles.claimAll, pressed ? styles.pressed : null]}>
                <GradientFill from="#B8F08F" to="#5DBB3C" />
                <Text style={styles.claimAllText}>{fa.levels.claimAll(claimableCoins(road), claimableSpins(road))}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {failed ? <Text style={styles.note}>{fa.levels.error}</Text> : null}
        <ScrollView ref={scroller} contentContainerStyle={styles.road} showsVerticalScrollIndicator={false}>
          {road ? <RoadCanvas road={road} nodes={nodes} width={width} onLocked={(unlock) => setLocked({ unlock })} onClaim={claim} /> : null}
        </ScrollView>
      </View>
      {got !== null ? (
        <Pressable style={styles.overlay} onPress={() => setGot(null)} accessibilityLabel={fa.levels.popup.ok}>
          <View style={styles.gotBox}><View style={styles.gotIcon}><Item icon={got.coins > 0 ? 'coinStack' : 'dice'} /></View><Text style={styles.gotText}>{fa.levels.got(got.coins, got.spins)}</Text></View>
        </Pressable>
      ) : null}
      {locked && road ? <LockedPopup road={road} unlock={locked.unlock} onClose={() => setLocked(null)} /> : null}
    </View>
  );
}

/** The winding road itself: a brown path with an S-curve between every pair of levels, a gold stretch up to the player's level, round nodes on the bends and the cards beside them. */
function RoadCanvas({ road, nodes, width, onLocked, onClaim }: { road: LevelRoad; nodes: RoadNode[]; width: number; onLocked: (u: Unlock) => void; onClaim: () => void }) {
  const lay = roadLayout(road.levelMax, width);
  const byLevel = new Map(nodes.map((nd) => [nd.level, nd]));
  const stars = skyStars(width, lay.height);
  const here = lay.points.find((p) => p.level === road.level);
  return (
    <View style={{ width, height: lay.height, alignSelf: 'center' }}>
      {stars.map((st, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: st.x, top: st.y, width: st.r, height: st.r, borderRadius: st.r, backgroundColor: '#FFF4B0', opacity: st.o }} />
      ))}
      <Svg width={width} height={lay.height} style={StyleSheet.absoluteFill}>
        <G transform="translate(0 8)"><Path d={lay.pathD} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={54} strokeLinecap="round" /></G>
        <Path d={lay.pathD} fill="none" stroke="#2B1240" strokeWidth={54} strokeLinecap="round" />
        <Path d={lay.pathD} fill="none" stroke="#C9A06A" strokeWidth={44} strokeLinecap="round" />
        <Path d={lay.pathD} fill="none" stroke="#F6E2C2" strokeWidth={34} strokeLinecap="round" />
        {road.level > 1 ? (
          <>
            <Path d={lay.doneD(road.level)} fill="none" stroke="#FFC93C" strokeWidth={34} strokeLinecap="round" />
            <G transform="translate(-4 -3)"><Path d={lay.doneD(road.level)} fill="none" stroke="#FFE48A" strokeWidth={10} strokeLinecap="round" /></G>
          </>
        ) : null}
        <Path d={lay.pathD} fill="none" stroke="rgba(43,18,64,0.28)" strokeWidth={4} strokeLinecap="round" strokeDasharray="12 16" />
      </Svg>
      {lay.points.map((p) => {
        const node = byLevel.get(p.level);
        if (!node) return null;
        return <RoadStop key={p.level} node={node} x={p.x} y={p.y} left={p.left} reached={node.level <= road.level} onLocked={onLocked} onClaim={onClaim} />;
      })}
      {here ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: here.x - 34, top: here.y - 50 - 79, width: 68, height: 79, zIndex: 3 }}>
          <Character who="dozari" pose="wave" />
        </View>
      ) : null}
    </View>
  );
}

const CARD_W = 156;

function RoadStop({ node, x, y, left, reached, onLocked, onClaim }: { node: RoadNode; x: number; y: number; left: boolean; reached: boolean; onLocked: (u: Unlock) => void; onClaim: () => void }) {
  const dim = node.state === 'locked';
  const current = node.state === 'current';
  const size = current ? 66 : 54;
  const count = Math.min(2, node.unlocks.length) + (node.reward ? 1 : 0);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!current) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [current, pulse]);
  const cardsH = count * 50 + Math.max(0, count - 1) * 4 + (node.unlocks.length > (node.reward ? 1 : 2) ? 14 : 0);
  return (
    <>
      <Animated.View style={[styles.node, current ? styles.nodeCurrent : node.state === 'done' ? styles.nodeDone : styles.nodeLocked, { left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, transform: [{ scale: pulse }] }]}>
        <Text style={[styles.nodeText, current ? styles.nodeTextBig : null, dim ? styles.nodeTextDim : null]}>{n(node.level)}</Text>
        {node.state === 'done' ? <View style={styles.tick}><Icon name="check" size={13} color="#fff" strokeWidth={4} /></View> : null}
        {dim ? <View style={styles.lockBadge}><Item icon="lock" /></View> : null}
      </Animated.View>
      {current ? <Text style={[styles.youTag, { left: x - 45, top: y + size / 2 + 6 }]}>{fa.levels.hereNow}</Text> : null}
      {count > 0 ? (
        <View style={[styles.cardsBox, { top: y - cardsH / 2, width: CARD_W }, left ? { left: x + 38 } : { left: Math.max(4, x - 38 - CARD_W) }]}>
          <Cards node={node} dim={dim} reached={reached} onLocked={onLocked} onClaim={onClaim} />
        </View>
      ) : null}
    </>
  );
}

function Cards({ node, dim, reached, onLocked, onClaim }: { node: RoadNode; dim: boolean; reached: boolean; onLocked: (u: Unlock) => void; onClaim: () => void }) {
  if (node.unlocks.length === 0 && !node.reward) return null;
  const room = node.reward ? 1 : 2;
  const r = node.reward;
  return (
    <View style={styles.cards}>
      {r ? (
        <Pressable onPress={reached && !r.claimed ? onClaim : undefined} disabled={!reached || r.claimed} accessibilityRole={reached && !r.claimed ? 'button' : 'text'} accessibilityLabel={fa.levels.rewardTitle} style={[styles.card, styles.cardReward, !reached ? styles.cardDim : null]}>
          <View style={styles.cardIcon}><View style={[styles.cardIconInner, !reached ? styles.gray : null]}><Item icon={r.coins > 0 ? 'coinStack' : 'dice'} /></View></View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle} numberOfLines={1}>{fa.levels.prize(r.coins, r.spins)}</Text>
            <Text style={[styles.cardSub, r.claimed ? styles.cardDone : reached ? styles.cardClaim : null]} numberOfLines={1}>{r.claimed ? fa.levels.claimed : reached ? fa.levels.claim : fa.levels.fromLevel(node.level)}</Text>
          </View>
        </Pressable>
      ) : null}
      {node.unlocks.length > room ? <Text style={styles.more}>{`+${n(node.unlocks.length - room)}`}</Text> : null}
      {node.unlocks.slice(0, room).map((u, i) => {
        const v = view(u);
        return (
          <Pressable key={`${u.kind}-${i}`} onPress={dim ? () => onLocked(u) : undefined} disabled={!dim} accessibilityRole={dim ? 'button' : 'text'} accessibilityLabel={v.title} style={[styles.card, dim ? styles.cardDim : null]}>
            <View style={styles.cardIcon}><View style={[styles.cardIconInner, dim ? styles.gray : null]}><Item icon={v.icon} /></View></View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} numberOfLines={1}>{v.title}</Text>
              <Text style={[styles.cardSub, dim ? null : styles.cardDone]} numberOfLines={1}>{dim ? fa.levels.fromLevel(node.level) : fa.levels.done}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** popup-locked of the design: what is here, when it opens, how far the player is, Ajan's line. */
function LockedPopup({ road, unlock, onClose }: { road: LevelRoad; unlock: Unlock; onClose: () => void }) {
  useHardwareBack(onClose);
  const v = view(unlock);
  const left = Math.max(0, unlock.level - road.level);
  const pct = Math.round(levelProgress(road) * 100);
  const p = fa.levels.popup;
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={p.ok}>
      <Pressable style={styles.popup} onPress={() => undefined}>
        <View style={styles.popIcon}>
          <View style={[styles.popIconInner, styles.gray]}><Item icon={v.icon} /></View>
          <View style={styles.popLock}><Item icon="lock" /></View>
        </View>
        <Text style={styles.popTitle}>{v.title}</Text>
        <View style={styles.opens}><Text style={styles.opensText}>{p.opensAt}</Text><Text style={styles.opensLevel}>{p.level(unlock.level)}</Text></View>
        <View style={styles.progress}>
          <View style={styles.progressHead}>
            <Text style={styles.small}>{p.yours(road.level)}</Text>
            <Text style={styles.small}>{p.left(left)}</Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
            <Text style={styles.barText}>{n(road.xp)} / {n(road.xp + xpToReach(road, road.level + 1))}</Text>
          </View>
        </View>
        {v.text ? (
          <View style={styles.what}>
            <Text style={styles.whatTitle}>{p.what}</Text>
            <Text style={styles.whatText}>{v.text}</Text>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.ok, pressed ? styles.pressed : null]}>
          <GradientFill from="#B8F08F" to="#5DBB3C" />
          <Text style={styles.okText}>{p.ok}</Text>
        </Pressable>
      </Pressable>
      <View style={styles.ajan} pointerEvents="none"><Character who="ajan" pose="pointing" /></View>
      <View style={styles.ajanBubble} pointerEvents="none"><Text style={styles.ajanText}>{p.ajan(left)}</Text></View>
    </Pressable>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#3C1A66' },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: pageTop() },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', marginTop: 10 },
  road: { paddingBottom: 40 },
  cardsBox: { position: 'absolute', zIndex: 2 },
  node: { position: 'absolute', borderWidth: 4, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', zIndex: 2, ...lift(5) },
  nodeDone: { backgroundColor: '#7ED957' },
  nodeCurrent: { backgroundColor: '#FFC93C', shadowColor: colors.candy.yellow, shadowOpacity: 1, shadowRadius: 16, borderColor: colors.ink },
  nodeLocked: { backgroundColor: '#6A4A8E' },
  nodeText: { fontFamily: fonts.display, fontSize: 22, color: '#fff', textShadowColor: '#2E7A22', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  nodeTextBig: { fontSize: 28, textShadowColor: '#B86E00' },
  nodeTextDim: { color: '#C9A3FF', textShadowColor: colors.ink },
  tick: { position: 'absolute', top: -8, left: -8, width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFC93C', alignItems: 'center', justifyContent: 'center' },
  lockBadge: { position: 'absolute', top: -10, left: -10, width: 26, height: 26 },
  youTag: { position: 'absolute', width: 90, textAlign: 'center', zIndex: 3, fontFamily: fonts.display, fontSize: 12, color: colors.ink, backgroundColor: colors.candy.yellow, borderWidth: 2, borderColor: colors.ink, borderRadius: 8, overflow: 'hidden' },
  more: { fontFamily: fonts.display, fontSize: 12, color: colors.cream, textAlign: 'center' },
  cards: { gap: 4 },
  card: { flexDirection: ROW, alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 5, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FBF1DE', ...lift(4) },
  cardDim: { backgroundColor: '#D7C9EC', opacity: 0.92 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cardIconInner: { width: 30, height: 30 },
  gray: { opacity: 0.45 },
  cardText: { flexShrink: 1, gap: 1 },
  cardTitle: { fontFamily: fonts.display, fontSize: 13, color: colors.ink, textAlign: TEXT_START },
  cardSub: { fontFamily: fonts.bold, fontSize: 9.5, color: '#7E46D6', textAlign: TEXT_START },
  cardDone: { color: '#3FA36B' },
  cardReward: { backgroundColor: '#FFF1B8' },
  cardClaim: { color: '#E8743B' },
  xpBox: { marginHorizontal: 14, marginBottom: 6, gap: 4 },
  xpHead: { flexDirection: ROW, justifyContent: 'space-between' },
  xpLevel: { fontFamily: fonts.display, fontSize: 16, color: colors.cream },
  xpText: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
  xpBar: { height: 16, borderRadius: 99, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#E8D2B0', overflow: 'hidden' },
  xpFill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.candy.yellow },
  claimAll: { height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 4, ...lift(4) },
  claimAllText: { fontFamily: fonts.display, fontSize: 18, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  gotBox: { marginTop: 80, alignItems: 'center', gap: 12 },
  gotIcon: { width: 130, height: 130 },
  gotText: { fontFamily: fonts.display, fontSize: 28, color: colors.candy.yellow, textAlign: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: 'rgba(26,8,44,0.72)', alignItems: 'center', paddingTop: 90, paddingHorizontal: 18 },
  popup: { width: '100%', maxWidth: 380, borderRadius: 28, borderWidth: 4, borderColor: colors.ink, backgroundColor: '#FBF1DE', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 14, gap: 8, ...lift(8) },
  popIcon: { marginTop: -30, width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: colors.ink, backgroundColor: '#3C1A66', alignItems: 'center', justifyContent: 'center' },
  popIconInner: { width: 70, height: 70 },
  popLock: { position: 'absolute', bottom: -6, left: -6, width: 48, height: 48 },
  popTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, textAlign: 'center' },
  opens: { flexDirection: ROW, alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 99, backgroundColor: colors.ink },
  opensText: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
  opensLevel: { fontFamily: fonts.display, fontSize: 19, color: colors.candy.yellow },
  progress: { alignSelf: 'stretch', gap: 4 },
  progressHead: { flexDirection: ROW, justifyContent: 'space-between' },
  small: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  bar: { height: 22, borderRadius: 99, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#E8D2B0', overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#A66BF0' },
  barText: { fontFamily: fonts.display, fontSize: 12, color: colors.ink, textAlign: 'center' },
  what: { alignSelf: 'stretch', gap: 4, padding: 10, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(43,18,64,0.3)', backgroundColor: 'rgba(166,107,240,0.12)' },
  whatTitle: { fontFamily: fonts.display, fontSize: 15, color: '#7E46D6', textAlign: TEXT_START },
  whatText: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 20, color: colors.ink, textAlign: TEXT_START },
  ok: { alignSelf: 'stretch', height: 54, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  okText: { fontFamily: fonts.display, fontSize: 18, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  ajan: { position: 'absolute', bottom: 22, left: 8, width: 100, height: 116 },
  ajanBubble: { position: 'absolute', bottom: 52, left: 112, right: 14, padding: 10, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff', ...lift(4) },
  ajanText: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 18, color: colors.ink, textAlign: TEXT_START },
});
