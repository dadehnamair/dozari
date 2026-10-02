import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SceneBackground } from '../components/SceneBackground';
import { Character } from '../components/Character';
import { DailyWheelPage } from '../daily/DailyWheelPage';
import { ProfileSheet } from '../social/ProfileSheet';
import { SettingsPage } from '../social/SettingsPage';
import { LeaderboardPage } from '../social/LeaderboardPage';
import { CityHub } from '../hub/CityHub';
import { Item } from '../components/Item';
import { fetchMyProfile } from '../social/api';
import { heroFor } from '../social/heroFor';
import type { Gender } from '@dozari/shared';
import { ReviewSheet } from '../review/ReviewSheet';
import { useReviewPrompt } from '../review/useReviewPrompt';
import { OPEN_CONFIG } from '../config/gate';
import type { ClientConfig } from '../config/gate';
import { InboxSheet } from '../inbox/InboxSheet';
import { useInbox } from '../inbox/useInbox';
import { BaleSheet } from '../bale/BaleSheet';
import { ShopSheet } from '../shop/ShopSheet';
import { ChatSheet } from '../chat/ChatSheet';
import { fetchDailyStatus } from '../daily/puzzleApi';
import type { DailyStatus } from '@dozari/shared';
import { fetchMatchActive } from '../duel/api';
import { shareTable } from '../tables/api';
import { TableSheet } from '../tables/TableSheet';
import { TournamentSheet } from '../tournament/TournamentSheet';
import { SlabButton } from '../components/SlabButton';
import { Wordmark } from '../components/Wordmark';
import { useDailyReward } from '../daily/useDailyReward';
import { provinceOf, solarMonthOf, toPersianDigits } from '@dozari/shared';
import type { Province } from '@dozari/shared';
import { ProvinceBadge } from '../components/ProvinceBadge';
import type { IconName } from '../theme/icons';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { HubTile } from './HubTile';
import { StatPill } from './StatPill';

interface Tile {
  key: string;
  icon: IconName;
  label: string;
  color: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
}

/**
 * Right-to-left rows on every platform: native flips `row` itself once RTL is forced (App.tsx); react-native-web
 * reports RTL but lays rows out left-to-right, so web needs `row-reverse`.
 */
const RTL_ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

const fmt = (n: number) => toPersianDigits(n.toLocaleString('en-US').replace(/,/g, '٬'));

/**
 * Home hub, laid out as screen-home of `docs/design/Dozari - 01 Screens`: three counters on top, the wordmark and a
 * speech bubble, corner tiles down both sides, the floating hero, and two big buttons at the bottom. Every feature
 * keeps its sheet; a tile only shows when its feature flag is on.
 */
export function HomeScreen({ onSolo, onDaily, onDuel, onDuelResume, onTutorial, onLookup, onGallery, features = OPEN_CONFIG.features, settings = OPEN_CONFIG.raw }: { onSolo: () => void; onDaily?: () => void; onDuel?: () => void; onDuelResume?: () => void; onTutorial?: () => void; onLookup: () => void; onGallery?: () => void; features?: ClientConfig['features']; settings?: ClientConfig['raw'] }) {
  const month = useMemo(() => solarMonthOf(Date.now()), []);
  /** Short phones (≤700px tall) get tighter columns and a smaller hero so nothing runs into the bottom buttons. */
  const compact = useWindowDimensions().height <= 700;
  const daily = useDailyReward();
  const [dailyOpen, setDailyOpen] = useState(false);
  const [baleOpen, setBaleOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [liveMatch, setLiveMatch] = useState(false);
  useEffect(() => {
    if (features.duel) void fetchMatchActive().then(setLiveMatch, () => undefined);
  }, [features.duel]);
  const [tableCode, setTableCode] = useState<string | undefined>(undefined);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  /** The player's province (D101): its badge and local greeting sit under the wordmark. */
  const [province, setProvince] = useState<Province | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<DailyStatus | null>(null);
  const loadMe = useCallback(() => {
    fetchMyProfile().then((p) => (setGender(p.gender), setLevel(p.level.level), setProvince(provinceOf(p.city?.province))), () => undefined);
  }, []);
  useEffect(loadMe, [loadMe]);
  useEffect(() => {
    if (features.daily) fetchDailyStatus().then(setDailyPuzzle, () => undefined);
  }, [features.daily]);
  const inbox = useInbox();
  const review = useReviewPrompt(settings);
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -10, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const h = fa.home.hub;
  const unread = inbox.inbox?.unread ?? 0;
  const right: Tile[] = [
    ...(daily.status ? [{ key: 'daily', icon: 'calendar' as const, label: h.daily, color: colors.candy.yellow, badge: daily.status.canClaim ? '!' : undefined, onPress: () => setDailyOpen(true) }] : []),
    ...(features.tables ? [{ key: 'tables', icon: 'users' as const, label: h.tables, color: colors.candy.sky, onPress: () => setTableOpen(true) }] : []),
    ...(features.tournament ? [{ key: 'tour', icon: 'trophy' as const, label: h.tournaments, color: colors.candy.orange, onPress: () => setTournamentOpen(true) }] : []),
    ...(features.friends ? [{ key: 'board', icon: 'crown' as const, label: h.leaderboard, color: colors.candy.pink, onPress: () => setBoardOpen(true) }] : []),
    ...(features.lookup ? [{ key: 'lookup', icon: 'search' as const, label: h.lookup, color: colors.candy.grape, onPress: onLookup }] : []),
    ...(onGallery ? [{ key: 'kit', icon: 'star' as const, label: h.gallery, color: colors.candy.lime, onPress: onGallery }] : []),
  ];
  const left: Tile[] = [
    ...(features.friends ? [{ key: 'settings', icon: 'settings' as const, label: h.settings, color: colors.candy.grape, onPress: () => setSettingsOpen(true) }] : []),
    ...(features.inbox ? [{ key: 'inbox', icon: 'mail' as const, label: h.messages, color: colors.candy.pink, badge: unread > 0 ? toPersianDigits(String(unread)) : undefined, badgeColor: colors.candy.lime, onPress: () => (inbox.reload(), setInboxOpen(true)) }] : []),
    ...(features.chat ? [{ key: 'chat', icon: 'chat' as const, label: h.chat, color: colors.candy.sky, onPress: () => setChatOpen(true) }] : []),
    ...(features.shop ? [{ key: 'shop', icon: 'gift' as const, label: h.shop, color: colors.candy.lime, onPress: () => setShopOpen(true) }] : []),
    ...(features.bale ? [{ key: 'bale', icon: 'bolt' as const, label: h.bale, color: colors.candy.orange, onPress: () => setBaleOpen(true) }] : []),
  ];

  const dailyOpenForPlay = features.daily && onDaily && dailyPuzzle && (dailyPuzzle.state === 'available' || dailyPuzzle.state === 'playing');
  const bubble = dailyOpenForPlay ? (dailyPuzzle.state === 'playing' ? h.dailyPlaying : h.dailyReady) : `${fa.months[month - 1]?.name ?? ''} · ${fa.months[month - 1]?.mood ?? ''}`;
  const second = liveMatch && onDuelResume
    ? { label: h.resume, color: colors.candy.orange, badge: '!', onPress: onDuelResume }
    : features.duel && onDuel
      ? { label: h.duel, color: colors.candy.orange, badge: undefined, onPress: onDuel }
      : null;

  return (
    <SceneBackground scene="bazaar">
      <View style={styles.root}>
        <View style={styles.pills}>
          {daily.status ? <StatPill color={colors.candy.yellow} glyph="۲" glyphColor="#7A4A00" value={fmt(daily.status.balance)} label={`${daily.status.balance} ${h.coins}`} /> : null}
          {dailyPuzzle && dailyPuzzle.state !== 'unavailable' ? <StatPill color={colors.candy.pink} glyph="🔥" value={`${toPersianDigits(String(dailyPuzzle.streak))} ${h.streak}`} label={`${dailyPuzzle.streak} ${h.streak}`} /> : null}
          <Pressable onPress={() => setHubOpen(true)} accessibilityRole="button" accessibilityLabel={fa.hub.open} style={styles.mapBtn}>
            <View style={styles.mapIcon}><Item icon="map" /></View>
          </Pressable>
          {level !== null ? <StatPill color={colors.candy.grape} glyph="★" glyphColor="#FFE48A" value={toPersianDigits(String(level))} label={`${h.level} ${level}`} onPress={() => setProfileOpen(true)} /> : null}
        </View>

        <View style={styles.middle}>
          <View style={[styles.column, compact ? styles.columnCompact : null]}>{right.map(({ key, ...t }) => <HubTile key={key} {...t} />)}</View>
          <View style={styles.center}>
            <Wordmark width={200} />
            <Pressable onPress={dailyOpenForPlay ? onDaily : undefined} disabled={!dailyOpenForPlay} accessibilityRole={dailyOpenForPlay ? 'button' : 'text'}>
              <Text style={styles.bubble} numberOfLines={2}>{bubble}</Text>
            </Pressable>
            {province ? (
              <Pressable onPress={() => setProfileOpen(true)} accessibilityRole="button" accessibilityLabel={province.hello} style={styles.greet}>
                <ProvinceBadge province={province} size={compact ? 30 : 38} />
                <Text style={styles.hello} numberOfLines={1}>{province.hello}</Text>
              </Pressable>
            ) : null}
            <View style={styles.spacer} />
            <Animated.View style={[styles.hero, compact ? styles.heroCompact : null, { transform: [{ translateY: float }] }]}>
              <Character who={heroFor(gender)} pose="wave" month={month} />
            </Animated.View>
          </View>
          <View style={[styles.column, compact ? styles.columnCompact : null]}>{left.map(({ key, ...t }) => <HubTile key={key} {...t} />)}</View>
        </View>

        <View style={styles.buttons}>
          <SlabButton label={h.play} color={colors.candy.lime} onPress={onSolo} />
          {second ? <SlabButton label={second.label} color={second.color} badge={second.badge} onPress={second.onPress} /> : null}
        </View>
      </View>

      {dailyOpen ? <DailyWheelPage daily={daily} onClose={() => setDailyOpen(false)} /> : null}
      {review.open && review.url ? <ReviewSheet message={review.message} url={review.url} onReview={review.onReview} onLater={review.onLater} onNever={review.onNever} /> : null}
      {profileOpen ? <ProfileSheet onClose={() => (setProfileOpen(false), loadMe())} onGender={setGender} /> : null}
      {hubOpen ? (
        <CityHub
          onClose={() => setHubOpen(false)}
          features={{ daily: features.daily && !!onDaily, duel: features.duel && !!onDuel, tournament: features.tournament }}
          dailyReady={!!dailyOpenForPlay}
          onEnter={(a) => {
            setHubOpen(false);
            if (a === 'solo') onSolo();
            else if (a === 'daily') onDaily?.();
            else if (a === 'duel') onDuel?.();
            else setTournamentOpen(true);
          }}
        />
      ) : null}
      {boardOpen ? <LeaderboardPage onClose={() => setBoardOpen(false)} /> : null}
      {settingsOpen ? <SettingsPage onClose={() => setSettingsOpen(false)} onProfile={() => (setSettingsOpen(false), setProfileOpen(true))} onTutorial={onTutorial ? () => (setSettingsOpen(false), onTutorial()) : undefined} onAccountGone={onTutorial ? () => (setSettingsOpen(false), onTutorial()) : undefined} /> : null}
      {inboxOpen ? <InboxSheet inbox={inbox.inbox} failed={inbox.failed} onRead={inbox.markRead} onReadAll={inbox.markAll} onClose={() => setInboxOpen(false)} /> : null}
      {tableOpen ? <TableSheet initialCode={tableCode} onMatch={onDuelResume ? () => (setTableOpen(false), onDuelResume()) : undefined} onClose={() => (setTableOpen(false), setTableCode(undefined))} onShare={() => shareTable()} /> : null}
      {tournamentOpen ? <TournamentSheet onClose={() => setTournamentOpen(false)} /> : null}
      {chatOpen ? <ChatSheet onClose={() => setChatOpen(false)} onJoinTable={(code) => (setChatOpen(false), setTableCode(code), setTableOpen(true))} /> : null}
      {shopOpen ? <ShopSheet onClose={() => { setShopOpen(false); daily.reload(); }} /> : null}
      {baleOpen ? <BaleSheet onClose={() => setBaleOpen(false)} /> : null}
    </SceneBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 14, paddingBottom: 22, paddingHorizontal: 12 },
  pills: { flexDirection: RTL_ROW, gap: 8, minHeight: 36, alignItems: 'center' },
  mapBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(43,18,64,0.65)', alignItems: 'center', justifyContent: 'center' },
  mapIcon: { width: 26, height: 26 },
  middle: { flex: 1, flexDirection: RTL_ROW, justifyContent: 'space-between', paddingTop: 12 },
  column: { width: 72, gap: 12, alignItems: 'center', paddingTop: 44 },
  columnCompact: { gap: 2, paddingTop: 20 },
  center: { flex: 1, alignItems: 'center' },
  greet: { flexDirection: RTL_ROW, alignItems: 'center', gap: 4, marginTop: 6, maxWidth: '100%' },
  hello: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  bubble: {
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
    textAlign: 'center',
  },
  spacer: { flex: 1 },
  hero: { width: 180, height: 197, marginBottom: 8 },
  heroCompact: { width: 130, height: 142 },
  buttons: { flexDirection: RTL_ROW, gap: 12, paddingTop: 6 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: 'rgba(60,30,90,0.92)', borderRadius: 30, padding: 4, gap: 10 },
  won: { alignItems: 'center', paddingBottom: 10 },
});
