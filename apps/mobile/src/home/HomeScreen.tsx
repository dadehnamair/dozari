import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SceneBackground } from '../components/SceneBackground';
import { Character } from '../components/Character';
import { DailyRewardCard } from '../components/DailyRewardCard';
import { Toast } from '../components/Toast';
import { ProfileSheet } from '../social/ProfileSheet';
import { SettingsPage } from '../social/SettingsPage';
import { LeaderboardPage } from '../social/LeaderboardPage';
import { CityHub } from '../hub/CityHub';
import { SchoolSheet } from '../feedback/SchoolSheet';
import { Item } from '../components/Item';
import { fetchFriends, fetchMyProfile } from '../social/api';
import { connectNotices } from '../notices/connectNotices';
import { FriendRequestSheet } from '../notices/FriendRequestSheet';
import { claimProfileTask, fetchProfileTasks } from '../social/profileTasksApi';
import { profileNudge } from './profileNudge';
import { fetchGems } from '../ledger/gemsApi';
import { MissionsSheet } from '../missions/MissionsSheet';
import { missionRows } from '../missions/model';
import type { MissionAvailability } from '../missions/model';
import { InviteSheet } from '../invite/InviteSheet';
import type { ProfileTask } from '@dozari/shared';
import { heroFor } from '../social/heroFor';
import { applyAppIcon } from '../appIcon/appIcon';
import type { Gender } from '@dozari/shared';
import { ReviewSheet } from '../review/ReviewSheet';
import { useReviewPrompt } from '../review/useReviewPrompt';
import { OPEN_CONFIG } from '../config/gate';
import type { ClientConfig } from '../config/gate';
import { InboxSheet } from '../inbox/InboxSheet';
import { LedgerSheet } from '../ledger/LedgerSheet';
import { GuideBubble } from '../components/GuideBubble';
import { availableTips, nextTip } from './guideTips';
import { useInbox } from '../inbox/useInbox';
import { BaleSheet } from '../bale/BaleSheet';
import { ShopSheet } from '../shop/ShopSheet';
import { fetchWheel } from '../wheel/api';
import { WheelPage } from '../wheel/WheelPage';
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
import { Icon } from '../components/Icon';
import { usePrefs } from '../prefs/store';
import { HeroCoinToss } from './HeroCoinToss';
import { HubTile } from './HubTile';
import { StatPill } from './StatPill';
import { nativeTopInset } from '../theme/safeArea';

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
  const [wheelOpen, setWheelOpen] = useState(false);
  const [spins, setSpins] = useState(0);
  const loadSpins = () => void fetchWheel().then((w) => setSpins(w.pending), () => undefined);
  useEffect(loadSpins, []);
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
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [tip, setTip] = useState<number | null>(null);
  const tips = availableTips(fa.home.guide.tips, new Set(['duel', 'daily', 'shop', 'chat', 'inbox'].filter((k) => !features[k as 'duel' | 'daily' | 'shop' | 'chat' | 'inbox'])));
  // A tip fades after a while so the guide never covers the menu for good.
  useEffect(() => {
    if (tip === null) return;
    const timer = setTimeout(() => setTip(null), 12_000);
    return () => clearTimeout(timer);
  }, [tip]);
  const [profileOpen, setProfileOpen] = useState(false);
  /** Opens the profile straight on the friends list (from a friend-request notice). */
  const [profileStart, setProfileStart] = useState<'friends' | null>(null);
  /** A friend request is waiting: who sent the latest one (when pushed live) and how many wait in all. */
  const [friendNotice, setFriendNotice] = useState<{ from?: string; count: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  /** The player's province (D101): its badge and local greeting sit under the wordmark. */
  const [province, setProvince] = useState<Province | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<DailyStatus | null>(null);
  const loadMe = useCallback(() => {
    fetchMyProfile().then((p) => (setGender(p.gender), applyAppIcon(p.gender), setLevel(p.level.level), setProvince(provinceOf(p.city?.province))), () => undefined);
  }, []);
  useEffect(loadMe, [loadMe]);
  const [profileTasks, setProfileTasks] = useState<ProfileTask[]>([]);
  const [gems, setGems] = useState(0);
  const loadGems = useCallback(() => void fetchGems().then((w) => setGems(w.balance), () => undefined), []);
  useEffect(loadGems, [loadGems]);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [nudgeToast, setNudgeToast] = useState<string | null>(null);
  const loadTasks = useCallback(() => void fetchProfileTasks().then((r) => setProfileTasks(r.tasks), () => undefined), []);
  useEffect(loadTasks, [loadTasks]);
  useEffect(() => {
    if (features.daily) fetchDailyStatus().then(setDailyPuzzle, () => undefined);
  }, [features.daily]);
  const nudge = profileNudge(profileTasks, (k) => (k === 'bale' ? features.bale : k === 'phone' ? features.friends : true));
  const onNudge = () => {
    if (!nudge) return;
    if (nudge.action === 'claim') {
      void claimProfileTask(nudge.task.key).then((r) => (setNudgeToast(fa.home.profileNudge.got(fmt(r.coins))), loadTasks()), () => loadTasks());
    } else if (nudge.action === 'profile') setProfileOpen(true);
    else if (nudge.action === 'settings') setSettingsOpen(true);
    else setBaleOpen(true);
  };
  useEffect(() => {
    if (!nudgeToast) return;
    const timer = setTimeout(() => setNudgeToast(null), 3000);
    return () => clearTimeout(timer);
  }, [nudgeToast]);
  const inbox = useInbox();
  const inboxReload = inbox.reload;
  useEffect(() => {
    if (!features.friends) return undefined;
    // Requests already waiting when the app opens, then pushes while it is open (a quiet socket, D168).
    fetchFriends().then((f) => f.incoming.length > 0 && setFriendNotice({ count: f.incoming.length }), () => undefined);
    return connectNotices((n) => {
      if (n.kind === 'inbox') return inboxReload();
      setFriendNotice((cur) => ({ from: n.from, count: (cur?.count ?? 0) + 1 }));
    });
  }, [features.friends, inboxReload]);
  const review = useReviewPrompt(settings);
  const text = (v: unknown): string | null => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null);
  const missionAvail: MissionAvailability = {
    link: (k) => (k === 'follow_instagram' ? text(settings['link.instagram']) : k === 'follow_channel' ? text(settings['link.channel']) : k === 'rate_app' ? review.url ?? null : null),
    feature: (k) => (k === 'bale' ? features.bale : k === 'phone' ? features.friends : true),
  };
  const missionsReady = missionRows(profileTasks, missionAvail, new Set()).filter((r) => r.state === 'claim').length;
  const prefs = usePrefs();
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

  // A tap makes Dozari hop (squash, spring up, land) and flip his coin right away.
  const jump = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const [tossKey, setTossKey] = useState(0);
  const hop = () => {
    setTossKey((k) => k + 1);
    if (prefs.reduceMotion) return;
    Animated.sequence([
      Animated.timing(squash, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(squash, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(jump, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(jump, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(squash, { toValue: 0.6, duration: 70, useNativeDriver: true }),
      Animated.spring(squash, { toValue: 0, friction: 4, tension: 160, useNativeDriver: true }),
    ]).start();
  };

  const h = fa.home.hub;
  const unread = inbox.inbox?.unread ?? 0;
  const right: Tile[] = [
    { key: 'missions', icon: 'target' as const, label: h.missions, color: colors.candy.lime, badge: missionsReady > 0 ? toPersianDigits(String(missionsReady)) : undefined, badgeColor: colors.candy.pink, onPress: () => setMissionsOpen(true) },
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
      <View style={styles.root} onTouchStart={() => setTip(null)}>
        <View style={styles.pills}>
          {daily.status ? <StatPill color={colors.candy.yellow} icon="coin" value={fmt(daily.status.balance)} label={`${daily.status.balance} ${h.coins}`} onPress={() => setLedgerOpen(true)} /> : null}
          {gems > 0 ? <StatPill color={colors.candy.sky} glyph="💎" value={fmt(gems)} label={`${gems} ${h.gems}`} /> : null}
          {dailyPuzzle && dailyPuzzle.state !== 'unavailable' ? <StatPill color={colors.candy.pink} glyph="🔥" value={`${toPersianDigits(String(dailyPuzzle.streak))} ${h.streak}`} label={`${dailyPuzzle.streak} ${h.streak}`} /> : null}
          <Pressable onPress={() => setHubOpen(true)} accessibilityRole="button" accessibilityLabel={fa.hub.open} style={styles.mapBtn}>
            <View style={styles.mapIcon}><Item icon="map" /></View>
          </Pressable>
          {/* The lucky wheel is always one tap away; the number is the spins waiting (wins, level and tournament prizes, the shop, the daily free spin). */}
          <Pressable onPress={() => setWheelOpen(true)} accessibilityRole="button" accessibilityLabel={h.wheel} style={styles.mapBtn}>
            <Icon name="wheel" size={22} color="#fff" strokeWidth={2.2} />
            {spins > 0 ? <View style={styles.spinBadge}><Text style={styles.spinBadgeText}>{toPersianDigits(String(spins))}</Text></View> : null}
          </Pressable>
          {level !== null ? <StatPill color={colors.candy.grape} icon="rosette" value={toPersianDigits(String(level))} label={`${h.level} ${level}`} onPress={() => setProfileOpen(true)} /> : null}
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
            {tip !== null && tips[tip] ? (
              <GuideBubble who={heroFor(gender)} text={tips[tip].text} />
            ) : nudgeToast ? (
              <GuideBubble who={heroFor(gender)} text={nudgeToast} />
            ) : nudge ? (
              <GuideBubble who={heroFor(gender)} text={fa.home.profileNudge[nudge.action === 'claim' ? 'claim' : nudge.key](fmt(nudge.task.coins))} onPress={onNudge} />
            ) : null}
            {/* A touch on the character itself must not count as «a tap elsewhere» that closes the tip. */}
            <View onTouchStart={(e) => e.stopPropagation()}>
            <Pressable onPress={() => (setTip((cur) => nextTip(cur, tips.length)), hop())} accessibilityRole="button" accessibilityLabel={fa.home.guide.name}>
              <Animated.View style={[styles.hero, compact ? styles.heroCompact : null, { transform: [{ translateY: Animated.add(float, jump.interpolate({ inputRange: [0, 1], outputRange: [0, -30] })) }, { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }, { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) }] }]}>
                <Character who={heroFor(gender)} pose="wave" month={month} />
                <HeroCoinToss width={compact ? 130 : 180} height={compact ? 142 : 197} tossKey={tossKey} enabled={!prefs.reduceMotion} />
              </Animated.View>
            </Pressable>
            </View>
          </View>
          <View style={[styles.column, compact ? styles.columnCompact : null]}>{left.map(({ key, ...t }) => <HubTile key={key} {...t} />)}</View>
        </View>

        <View style={styles.buttons}>
          <SlabButton label={h.play} color={colors.candy.lime} onPress={onSolo} />
          {second ? <SlabButton label={second.label} color={second.color} badge={second.badge} onPress={second.onPress} /> : null}
        </View>
      </View>

      {dailyOpen && daily.status ? (
        <Pressable style={styles.overlay} onPress={() => setDailyOpen(false)} accessibilityLabel={fa.solo.back}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <DailyRewardCard
              steps={daily.status.steps}
              day={daily.status.day}
              canClaim={daily.status.canClaim && !daily.claiming}
              onClaim={daily.claim}
              waitText={daily.countdown ? `${daily.countdown} ${fa.daily.wait}` : undefined}
            />
            {daily.won !== null ? (
              <View style={styles.won}>
                <Toast text={`${toPersianDigits(String(daily.won))} ${fa.daily.won}`} tone={colors.candy.yellow} />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      ) : null}
      {review.open && review.url ? <ReviewSheet message={review.message} url={review.url} onReview={review.onReview} onLater={review.onLater} onNever={review.onNever} /> : null}
      {friendNotice && !profileOpen ? <FriendRequestSheet from={friendNotice.from} count={friendNotice.count} onSee={() => (setFriendNotice(null), setProfileStart('friends'), setProfileOpen(true))} onLater={() => setFriendNotice(null)} /> : null}
      {profileOpen ? <ProfileSheet start={profileStart} onClose={() => (setProfileOpen(false), setProfileStart(null), loadMe(), loadTasks())} onGender={(g) => (setGender(g), applyAppIcon(g))} /> : null}
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
            else if (a === 'suggest') setSchoolOpen(true);
            else setTournamentOpen(true);
          }}
        />
      ) : null}
      {schoolOpen ? <SchoolSheet onClose={() => setSchoolOpen(false)} /> : null}
      {boardOpen ? <LeaderboardPage onClose={() => setBoardOpen(false)} /> : null}
      {settingsOpen ? <SettingsPage onClose={() => (setSettingsOpen(false), loadTasks())} onProfile={() => (setSettingsOpen(false), setProfileOpen(true))} onTutorial={onTutorial ? () => (setSettingsOpen(false), onTutorial()) : undefined} onAccountGone={onTutorial ? () => (setSettingsOpen(false), onTutorial()) : undefined} /> : null}
      {ledgerOpen ? <LedgerSheet onClose={() => setLedgerOpen(false)} /> : null}
      {inboxOpen ? <InboxSheet inbox={inbox.inbox} failed={inbox.failed} onRead={inbox.markRead} onReadAll={inbox.markAll} onClose={() => setInboxOpen(false)} /> : null}
      {tableOpen ? <TableSheet initialCode={tableCode} onMatch={onDuelResume ? () => (setTableOpen(false), onDuelResume()) : undefined} onClose={() => (setTableOpen(false), setTableCode(undefined))} onShare={() => shareTable()} /> : null}
      {tournamentOpen ? <TournamentSheet onClose={() => setTournamentOpen(false)} /> : null}
      {chatOpen ? <ChatSheet onClose={() => setChatOpen(false)} onJoinTable={(code) => (setChatOpen(false), setTableCode(code), setTableOpen(true))} /> : null}
      {shopOpen ? <ShopSheet realMoney={Number(settings['feature.coin_packages']) === 1} onClose={() => { setShopOpen(false); daily.reload(); }} /> : null}
      {wheelOpen ? <WheelPage onClose={() => (setWheelOpen(false), loadSpins(), daily.reload())} /> : null}
      {missionsOpen ? (
        <MissionsSheet
          avail={missionAvail}
          links={missionAvail.link}
          onClose={() => (setMissionsOpen(false), loadTasks())}
          onChanged={loadTasks}
          onGo={(go) => {
            if (go === 'play') return (setMissionsOpen(false), onSolo());
            if (go === 'profile') return setProfileOpen(true);
            if (go === 'settings') return setSettingsOpen(true);
            if (go === 'bale') return setBaleOpen(true);
            return setInviteOpen(true);
          }}
        />
      ) : null}
      {inviteOpen ? <InviteSheet onClose={() => (setInviteOpen(false), loadTasks())} /> : null}
      {baleOpen ? <BaleSheet onClose={() => (setBaleOpen(false), loadTasks())} /> : null}
    </SceneBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: 14 + nativeTopInset(), paddingBottom: 22, paddingHorizontal: 12 },
  pills: { flexDirection: RTL_ROW, gap: 8, minHeight: 40, alignItems: 'center', flexWrap: 'wrap' },
  mapBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(43,18,64,0.65)', alignItems: 'center', justifyContent: 'center' },
  mapIcon: { width: 26, height: 26 },
  spinBadge: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.candy.lime, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  spinBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink },
  middle: { flex: 1, flexDirection: RTL_ROW, justifyContent: 'space-between', paddingTop: 12 },
  column: { width: 72, gap: 12, alignItems: 'center', paddingTop: 44 },
  columnCompact: { gap: 2, paddingTop: 20 },
  center: { flex: 1, alignItems: 'center' },
  greet: { flexDirection: RTL_ROW, alignItems: 'center', gap: 4, marginTop: 6, maxWidth: '100%' },
  hello: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  bubble: {
    marginTop: 16,
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
