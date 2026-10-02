import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LevelRoad, Unlock } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchLevelRoad } from './api';
import { levelProgress, roadNodes, xpToReach } from './road';
import type { RoadNode } from './road';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const ROW_H = 84;
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
  const [road, setRoad] = useState<LevelRoad | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState<{ unlock: Unlock } | null>(null);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    fetchLevelRoad().then(setRoad, () => setFailed(true));
  }, []);
  const nodes = road ? roadNodes(road) : [];
  // Bring the current level into view once the road is drawn (the list runs from the top level down).
  useEffect(() => {
    if (!road) return;
    const idx = nodes.findIndex((x) => x.state === 'current');
    const t = setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, idx * ROW_H - 160), animated: false }), 60);
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
        {failed ? <Text style={styles.note}>{fa.levels.error}</Text> : null}
        <ScrollView ref={scroller} contentContainerStyle={styles.road} showsVerticalScrollIndicator={false}>
          {nodes.map((node, i) => (
            <Row key={node.level} node={node} index={i} onLocked={(unlock) => setLocked({ unlock })} />
          ))}
        </ScrollView>
      </View>
      {locked && road ? <LockedPopup road={road} unlock={locked.unlock} onClose={() => setLocked(null)} /> : null}
    </View>
  );
}

function Row({ node, index, onLocked }: { node: RoadNode; index: number; onLocked: (u: Unlock) => void }) {
  // Cards alternate sides so a busy road does not stack on one edge.
  const cardOnStart = index % 2 === 0;
  const dim = node.state === 'locked';
  return (
    <View style={styles.row}>
      <View style={[styles.side, styles.sideStart]}>{cardOnStart ? <Cards node={node} dim={dim} onLocked={onLocked} /> : node.state === 'current' ? <Hero /> : null}</View>
      <View style={styles.mid}>
        <View style={styles.path} />
        <View style={[styles.node, node.state === 'done' ? styles.nodeDone : node.state === 'current' ? styles.nodeCurrent : styles.nodeLocked]}>
          <Text style={[styles.nodeText, dim ? styles.nodeTextDim : null]}>{n(node.level)}</Text>
          {node.state === 'done' ? <View style={styles.tick}><Icon name="check" size={13} color="#fff" strokeWidth={4} /></View> : null}
          {dim ? <View style={styles.lockBadge}><Item icon="lock" /></View> : null}
        </View>
      </View>
      <View style={[styles.side, styles.sideEnd]}>{!cardOnStart ? <Cards node={node} dim={dim} onLocked={onLocked} /> : node.state === 'current' ? <Hero /> : null}</View>
    </View>
  );
}

/** The hero waves from the empty side of the current level. */
function Hero() {
  return (
    <View style={styles.hero} pointerEvents="none">
      <Character who="dozari" pose="wave" />
    </View>
  );
}

function Cards({ node, dim, onLocked }: { node: RoadNode; dim: boolean; onLocked: (u: Unlock) => void }) {
  if (node.unlocks.length === 0) return null;
  return (
    <View style={styles.cards}>
      {node.unlocks.slice(0, 2).map((u, i) => {
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
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 30 },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', marginTop: 10 },
  road: { paddingBottom: 60 },
  row: { height: ROW_H, flexDirection: ROW, alignItems: 'center' },
  side: { flex: 1, paddingHorizontal: 6 },
  sideStart: { alignItems: 'flex-end' },
  sideEnd: { alignItems: 'flex-start' },
  mid: { width: 70, alignItems: 'center', justifyContent: 'center', height: ROW_H },
  path: { position: 'absolute', top: 0, bottom: 0, width: 30, backgroundColor: '#F6E2C2', borderLeftWidth: 4, borderRightWidth: 4, borderColor: colors.ink },
  node: { width: 52, height: 52, borderRadius: 26, borderWidth: 4, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...lift(5) },
  nodeDone: { backgroundColor: '#FFC93C' },
  nodeCurrent: { backgroundColor: '#FFE48A', transform: [{ scale: 1.15 }] },
  nodeLocked: { backgroundColor: '#B6A5CF' },
  nodeText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  nodeTextDim: { color: '#5A4A7A' },
  tick: { position: 'absolute', top: -8, left: -8, width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#7ED957', alignItems: 'center', justifyContent: 'center' },
  lockBadge: { position: 'absolute', top: -10, left: -10, width: 26, height: 26 },
  hero: { width: 60, height: 70 },
  cards: { gap: 4, maxWidth: 170 },
  card: { flexDirection: ROW, alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 5, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FBF1DE', ...lift(4) },
  cardDim: { backgroundColor: '#D7C9EC', opacity: 0.92 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cardIconInner: { width: 30, height: 30 },
  gray: { opacity: 0.45 },
  cardText: { flexShrink: 1, gap: 1 },
  cardTitle: { fontFamily: fonts.display, fontSize: 13, color: colors.ink, textAlign: 'right' },
  cardSub: { fontFamily: fonts.bold, fontSize: 9.5, color: '#7E46D6', textAlign: 'right' },
  cardDone: { color: '#3FA36B' },
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
  whatTitle: { fontFamily: fonts.display, fontSize: 15, color: '#7E46D6', textAlign: 'right' },
  whatText: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 20, color: colors.ink, textAlign: 'right' },
  ok: { alignSelf: 'stretch', height: 54, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  okText: { fontFamily: fonts.display, fontSize: 18, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  ajan: { position: 'absolute', bottom: 22, left: 8, width: 100, height: 116 },
  ajanBubble: { position: 'absolute', bottom: 52, left: 112, right: 14, padding: 10, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff', ...lift(4) },
  ajanText: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 18, color: colors.ink, textAlign: 'right' },
});
