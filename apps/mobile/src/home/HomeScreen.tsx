import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GradientFill } from '../components/GradientFill';
import { useTheme } from '../theme/themeStore';
import { SceneBackground } from '../components/SceneBackground';
import { Character } from '../components/Character';
import { ProfileSheet } from '../social/ProfileSheet';
import { SettingsPage } from '../social/SettingsPage';
import { LeaderboardPage } from '../social/LeaderboardPage';
import { CityHub } from '../hub/CityHub';
import { SchoolSheet } from '../feedback/SchoolSheet';
import { Item } from '../components/Item';
import { fetchFriends } from '../social/api';
import { connectNotices } from '../notices/connectNotices';
import { FriendRequestSheet } from '../notices/FriendRequestSheet';
import { claimProfileTask } from '../social/profileTasksApi';
import { profileNudge } from './profileNudge';
import { MissionsSheet } from '../missions/MissionsSheet';
import { missionRows } from '../missions/model';
import type { MissionAvailability } from '../missions/model';
import { InviteSheet } from '../invite/InviteSheet';
import { heroFor } from '../social/heroFor';
import { setLookGender } from '../theme/look';
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
import { FittingRoom } from '../wardrobe/FittingRoom';
import { TreasuryPage } from '../keepsake/TreasuryPage';
import { WheelPage } from '../wheel/WheelPage';
import { ChatSheet } from '../chat/ChatSheet';
import { shareTable } from '../tables/api';
import { TableSheet } from '../tables/TableSheet';
import { TournamentSheet } from '../tournament/TournamentSheet';
import { SlabButton } from '../components/SlabButton';
import { AnimatedLogo } from '../components/AnimatedLogo';
import { useDailyReward } from '../daily/useDailyReward';
import { solarMonthOf, toPersianDigits } from '@dozari/shared';
import type { ChildLimits, TrackRulesDto } from '@dozari/shared';
import { ProvinceBadge } from '../components/ProvinceBadge';
import type { IconName } from '../theme/icons';
import { fa } from '../i18n/fa';
import { colors } from '../theme/colors';
import { Icon } from '../components/Icon';
import { HeroCoinToss } from './HeroCoinToss';
import { HubTile } from './HubTile';
import { fmt, styles } from './homeStyles';
import { useHeroMotion } from './useHeroMotion';
import { useHomeData } from './useHomeData';
import { StatPill } from './StatPill';
import { StatInfoSheet } from './StatInfoSheet';

interface Tile {
  key: string;
  icon: IconName;
  label: string;
  color: string;
  badge?: string;
  badgeColor?: string;
  glow?: boolean;
  onPress: () => void;
}

/**
 * Home hub, laid out as screen-home of `docs/design/Dozari - 01 Screens`: three counters on top, the wordmark and a
 * speech bubble, corner tiles down both sides, the floating hero, and two big buttons at the bottom. Every feature
 * keeps its sheet; a tile only shows when its feature flag is on.
 */
export function HomeScreen({ onSolo, onPriceOnly, onDaily, onDuel, onDuelResume, onTutorial, onLookup, onGallery, features = OPEN_CONFIG.features, settings = OPEN_CONFIG.raw, myTrack, onPreview }: { onSolo: () => void; onPreview?: (track: 'kid' | 'teen') => void; onPriceOnly?: () => void; onDaily?: () => void; onDuel?: () => void; onDuelResume?: () => void; onTutorial?: () => void; onLookup: () => void; onGallery?: () => void; features?: ClientConfig['features']; settings?: ClientConfig['raw']; /** Track rules and the guardian's limits; absent = no restriction. */ myTrack?: { rules: TrackRulesDto | null; limits: ChildLimits | null } }) {
  const adult = useTheme() === 'adult';
  const month = useMemo(() => solarMonthOf(Date.now()), []);
  /** Short phones (≤700px tall) get tighter columns and a smaller hero so nothing runs into the bottom buttons. */
  const compact = useWindowDimensions().height <= 700;
  const daily = useDailyReward();
  const { spins, loadSpins, liveMatch, gender, setGender, level, province, slogan, dailyPuzzle, loadMe, profileTasks, loadTasks, gems, worn, loadWorn } = useHomeData(features);
  const hero = useHeroMotion();
  const [wheelOpen, setWheelOpen] = useState(false);
  const [baleOpen, setBaleOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableCode, setTableCode] = useState<string | undefined>(undefined);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  /** The explainer page of the 💎 or 🔥 counter. */
  const [infoOpen, setInfoOpen] = useState<'gems' | 'streak' | null>(null);
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
  const [profileStart, setProfileStart] = useState<'friends' | 'edit' | null>(null);
  /** A friend request is waiting: who sent the latest one (when pushed live) and how many wait in all. */
  const [friendNotice, setFriendNotice] = useState<{ from?: string; count: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  /** A mission opened a page over the missions sheet (which closed to make room): closing that page brings the sheet back. */
  const [backToMissions, setBackToMissions] = useState(false);
  const returnToMissions = () => {
    if (!backToMissions) return;
    setBackToMissions(false);
    setMissionsOpen(true);
  };
  const [inviteOpen, setInviteOpen] = useState(false);
  const [nudgeToast, setNudgeToast] = useState<string | null>(null);
  const nudge = profileNudge(profileTasks, (k) => (k === 'bale' ? features.bale : k === 'phone' ? features.friends : true));
  const onNudge = () => {
    if (!nudge) return;
    if (nudge.action === 'claim') {
      void claimProfileTask(nudge.task.key).then((r) => (setNudgeToast(fa.home.profileNudge.got(fmt(r.coins))), loadTasks()), () => loadTasks());
    } else if (nudge.action === 'profile') { setProfileStart('edit'); setProfileOpen(true); }
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
      // Table news arrives as a short line from the guide (the table sheet itself polls for the details).
      if (n.kind === 'table_invite') return setNudgeToast(fa.home.tableInvite(n.from ?? ''));
      if (n.kind === 'table_request') return setNudgeToast(fa.home.tableRequest(n.from ?? ''));
      if (n.kind === 'table_answer') return setNudgeToast(n.accepted ? fa.tables.openList.accepted : fa.tables.openList.declined);
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

  const h = fa.home.hub;
  const unread = inbox.inbox?.unread ?? 0;
  const right: Tile[] = [
    ...(features.tables && myTrack?.limits?.duelsEnabled !== false ? [{ key: 'tables', icon: 'users' as const, label: h.tables, color: colors.candy.sky, onPress: () => setTableOpen(true) }] : []),
    ...(features.tournament && myTrack?.rules?.tournaments !== false ? [{ key: 'tour', icon: 'trophy' as const, label: h.tournaments, color: colors.candy.orange, onPress: () => setTournamentOpen(true) }] : []),
    ...(features.friends ? [{ key: 'board', icon: 'crown' as const, label: h.leaderboard, color: colors.candy.pink, onPress: () => setBoardOpen(true) }] : []),
    ...(features.lookup ? [{ key: 'lookup', icon: 'search' as const, label: h.lookup, color: colors.candy.grape, onPress: onLookup }] : []),
    ...(onGallery ? [{ key: 'kit', icon: 'star' as const, label: h.gallery, color: colors.candy.lime, onPress: onGallery }] : []),
  ];
  const left: Tile[] = [
    ...(features.inbox ? [{ key: 'inbox', icon: 'mail' as const, label: h.messages, color: colors.candy.pink, badge: unread > 0 ? toPersianDigits(String(unread)) : undefined, badgeColor: colors.candy.lime, onPress: () => (inbox.reload(), setInboxOpen(true)) }] : []),
    // A kid/teen has no public chat room: the entry is simply not drawn (their friends' chat lives with the friends).
    ...(features.chat && myTrack?.rules?.freeTextChat !== 'guardian_switch' ? [{ key: 'chat', icon: 'chat' as const, label: h.chat, color: colors.candy.sky, onPress: () => setChatOpen(true) }] : []),
    ...(features.shop ? [{ key: 'shop', icon: 'gift' as const, label: h.shop, color: colors.candy.lime, onPress: () => setShopOpen(true) }] : []),
    ...(features.shop ? [{ key: 'wardrobe', icon: 'shirt' as const, label: h.wardrobe, color: colors.candy.pink, onPress: () => setWardrobeOpen(true) }] : []),
    ...(features.shop ? [{ key: 'treasury', icon: 'puzzle' as const, label: h.treasury, color: colors.candy.yellow, onPress: () => setTreasuryOpen(true) }] : []),
  ];

  const dailyOpenForPlay = features.daily && onDaily && dailyPuzzle && (dailyPuzzle.state === 'available' || dailyPuzzle.state === 'playing');
  const bubble = dailyOpenForPlay ? (dailyPuzzle.state === 'playing' ? h.dailyPlaying : h.dailyReady) : `${fa.months[month - 1]?.name ?? ''} · ${fa.months[month - 1]?.mood ?? ''}`;
  // New players sit out the live duel until `duel.min_level` (the server enforces it too): the button stays, with a lock and an explanation.
  const contact = typeof settings['sponsor.contact_url'] === 'string' ? settings['sponsor.contact_url'].trim() : '';
  const sponsorInvite = /^(https:\/\/|mailto:)/i.test(contact) ? { title: String(settings['sponsor.cta_title'] ?? ''), body: String(settings['sponsor.cta_body'] ?? ''), url: contact } : null;
  const duelMin = typeof settings['duel.min_level'] === 'number' ? settings['duel.min_level'] : 3;
  const duelLocked = level !== null && level < duelMin && !liveMatch;
  const openDuel = () => (duelLocked ? setNudgeToast(fa.home.duelLocked(duelMin)) : onDuel?.());
  const second = liveMatch && onDuelResume
    ? { label: h.resume, color: colors.candy.orange, badge: '!', onPress: onDuelResume }
    : features.duel && onDuel
      ? { label: h.duel, color: duelLocked ? colors.candy.grape : colors.candy.orange, badge: undefined, onPress: openDuel }
      : null;

  const priceOnlyOn = features.priceonly && !!onPriceOnly;

  return (
    <SceneBackground scene="bazaar">
      {adult ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><GradientFill from="rgba(14,10,8,0.55)" to="rgba(14,10,8,0.7)" mid={{ at: 0.5, color: 'rgba(14,10,8,0.1)' }} /></View> : null}
      <View style={styles.root} pointerEvents="box-none" onTouchStart={() => setTip(null)}>
        <View style={styles.pills}>
          {daily.status ? <StatPill color={colors.candy.yellow} icon="coin" value={fmt(daily.status.balance)} label={`${daily.status.balance} ${h.coins}`} onPress={() => setLedgerOpen(true)} /> : null}
          {gems > 0 ? <StatPill color={colors.candy.sky} glyph="💎" value={fmt(gems)} label={`${gems} ${h.gems}`} onPress={() => setInfoOpen('gems')} /> : null}
          {dailyPuzzle && dailyPuzzle.state !== 'unavailable' && dailyPuzzle.streak > 0 ? <StatPill color={colors.candy.pink} glyph="🔥" value={`${toPersianDigits(String(dailyPuzzle.streak))} ${h.streak}`} label={`${dailyPuzzle.streak} ${h.streak}`} onPress={() => setInfoOpen('streak')} /> : null}
          <Pressable onPress={() => setHubOpen(true)} accessibilityRole="button" accessibilityLabel={fa.hub.open} style={[styles.mapBtn, adult ? styles.mapBtnAdult : null]}>
            <View style={styles.mapIcon}><Item icon="map" /></View>
          </Pressable>
          {/* The lucky wheel is always one tap away; the number is the spins waiting (wins, level and tournament prizes, the shop, the daily free spin). */}
          <Pressable onPress={() => setWheelOpen(true)} accessibilityRole="button" accessibilityLabel={h.wheel} style={[styles.mapBtn, adult ? styles.mapBtnAdult : null]}>
            <Icon name="wheel" size={22} color={adult ? '#FFE9A8' : '#fff'} strokeWidth={2.2} />
            {spins > 0 || daily.status?.canClaim ? <View style={styles.spinBadge}><Text style={styles.spinBadgeText}>{spins > 0 ? toPersianDigits(String(spins)) : '!'}</Text></View> : null}
          </Pressable>
          {/* A spacer keeps the level pill at the far (left) end of the row, whether or not the streak pill is showing. */}
          <View style={styles.pillsGap} />
          {level !== null ? <StatPill color={colors.candy.grape} icon="rosette" value={toPersianDigits(String(level))} label={`${h.level} ${level} · ${h.settings}`} badge={missionsReady > 0 ? toPersianDigits(String(missionsReady)) : undefined} onPress={() => setSettingsOpen(true)} /> : null}
        </View>

        <View style={styles.middle} pointerEvents="box-none">
          <View style={[styles.column, compact ? styles.columnCompact : null]}>{right.map(({ key, ...t }) => <HubTile key={key} {...t} />)}</View>
          <View style={styles.center} pointerEvents="box-none">
            <AnimatedLogo width={200} />
            <Pressable onPress={dailyOpenForPlay ? onDaily : undefined} disabled={!dailyOpenForPlay} accessibilityRole={dailyOpenForPlay ? 'button' : 'text'}>
              <Text style={styles.bubble} numberOfLines={2}>{bubble}</Text>
            </Pressable>
            {province ? (
              <Pressable onPress={() => setProfileOpen(true)} accessibilityRole="button" accessibilityLabel={province.hello} style={styles.greet}>
                <ProvinceBadge province={province} size={compact ? 30 : 38} />
                <Text style={styles.hello} numberOfLines={1}>{province.hello}</Text>
              </Pressable>
            ) : null}
            {slogan ? <Text style={styles.slogan} numberOfLines={2}>{slogan}</Text> : null}
            <View style={styles.spacer} pointerEvents="none" />
            {tip !== null && tips[tip] ? (
              <GuideBubble who={heroFor(gender)} text={tips[tip].text} />
            ) : nudgeToast ? (
              <GuideBubble who={heroFor(gender)} text={nudgeToast} />
            ) : missionsReady > 0 ? (
              <GuideBubble who={heroFor(gender)} text={fa.home.missionNudge(missionsReady)} onPress={() => setSettingsOpen(true)} />
            ) : nudge ? (
              <GuideBubble who={heroFor(gender)} text={fa.home.profileNudge[nudge.action === 'claim' ? 'claim' : nudge.key](fmt(nudge.task.coins))} onPress={onNudge} />
            ) : null}
            {/* A touch on the character itself must not count as «a tap elsewhere» that closes the tip. */}
            <View onTouchStart={(e) => e.stopPropagation()}>
            <Pressable onPress={() => (setTip((cur) => nextTip(cur, tips.length)), hero.hop())} accessibilityRole="button" accessibilityLabel={fa.home.guide.name}>
              <Animated.View style={[styles.hero, compact ? styles.heroCompact : null, { transform: hero.transform }]}>
                <Character who={heroFor(gender)} pose="wave" month={month} worn={worn} />
                <HeroCoinToss width={compact ? 130 : 180} height={compact ? 142 : 197} tossKey={hero.tossKey} enabled={!hero.reduceMotion} />
              </Animated.View>
            </Pressable>
            </View>
          </View>
          <View style={[styles.column, compact ? styles.columnCompact : null]}>{left.map(({ key, ...t }) => <HubTile key={key} {...t} />)}</View>
        </View>

        <View style={styles.buttons}>
          {/* Three modes side by side: icon above the label so each name fits on a narrow phone. */}
          <SlabButton label={h.play} sfx="confirm" color={colors.candy.lime} height={68} fontSize={priceOnlyOn ? 20 : 28} onPress={onSolo} />
          {second ? <SlabButton label={second.label} color={second.color} badge={second.badge} icon={duelLocked ? 'lock' : undefined} height={68} fontSize={priceOnlyOn ? 20 : 28} onPress={second.onPress} /> : null}
          {priceOnlyOn ? <SlabButton label={fa.priceOnly.play} sfx="confirm" color={adult ? colors.candy.sky : colors.candy.yellow} icon="coin" height={68} fontSize={20} onPress={onPriceOnly!} /> : null}
        </View>
      </View>

      {review.open && review.url ? <ReviewSheet message={review.message} url={review.url} onReview={review.onReview} onLater={review.onLater} onNever={review.onNever} /> : null}
      {friendNotice && !profileOpen ? <FriendRequestSheet from={friendNotice.from} count={friendNotice.count} onSee={() => (setFriendNotice(null), setProfileStart('friends'), setProfileOpen(true))} onLater={() => setFriendNotice(null)} /> : null}
      {profileOpen ? <ProfileSheet start={profileStart} onClose={() => (setProfileOpen(false), setProfileStart(null), loadMe(), loadTasks(), returnToMissions())} onGender={(g) => (setGender(g), setLookGender(g))} /> : null}
      {hubOpen ? (
        <CityHub
          onClose={() => setHubOpen(false)}
          features={{ daily: features.daily && !!onDaily, duel: features.duel && !!onDuel, tournament: features.tournament }}
          dailyReady={!!dailyOpenForPlay}
          onEnter={(a) => {
            setHubOpen(false);
            if (a === 'solo') onSolo();
            else if (a === 'daily') onDaily?.();
            else if (a === 'duel') openDuel();
            else if (a === 'suggest') setSchoolOpen(true);
            else setTournamentOpen(true);
          }}
        />
      ) : null}
      {schoolOpen ? <SchoolSheet onClose={() => setSchoolOpen(false)} /> : null}
      {boardOpen ? <LeaderboardPage onClose={() => setBoardOpen(false)} /> : null}
      {settingsOpen ? <SettingsPage onMissions={() => (setSettingsOpen(false), setMissionsOpen(true))} missionsReady={missionsReady} onClose={() => (setSettingsOpen(false), loadTasks(), returnToMissions())} onProfile={() => (setSettingsOpen(false), setProfileOpen(true))} onTutorial={onTutorial ? () => (setSettingsOpen(false), onTutorial()) : undefined} onAccountGone={onTutorial ? () => (setSettingsOpen(false), onTutorial()) : undefined} ageTracksOn={settings['feature.age_tracks'] === 1} baleOn={features.bale} onPreview={onPreview ? (t) => (setSettingsOpen(false), onPreview(t)) : undefined} /> : null}
      {ledgerOpen ? <LedgerSheet onClose={() => setLedgerOpen(false)} /> : null}
      {infoOpen ? <StatInfoSheet kind={infoOpen} value={infoOpen === 'gems' ? gems : dailyPuzzle?.streak ?? 0} onClose={() => setInfoOpen(null)} /> : null}
      {inboxOpen ? <InboxSheet inbox={inbox.inbox} failed={inbox.failed} onRead={inbox.markRead} onReadAll={inbox.markAll} onClose={() => setInboxOpen(false)} /> : null}
      {tableOpen ? <TableSheet initialCode={tableCode} onMatch={onDuelResume ? () => (setTableOpen(false), onDuelResume()) : undefined} onClose={() => (setTableOpen(false), setTableCode(undefined))} onShare={() => shareTable()} /> : null}
      {tournamentOpen ? <TournamentSheet onClose={() => setTournamentOpen(false)} invite={sponsorInvite} /> : null}
      {chatOpen ? <ChatSheet onClose={() => setChatOpen(false)} onJoinTable={(code) => (setChatOpen(false), setTableCode(code), setTableOpen(true))} /> : null}
      {shopOpen ? <ShopSheet realMoney={Number(settings['feature.coin_packages']) === 1 && myTrack?.rules?.purchases !== false} onClose={() => { setShopOpen(false); daily.reload(); }} /> : null}
      {treasuryOpen ? <TreasuryPage onClose={() => (setTreasuryOpen(false), daily.reload())} /> : null}
      {wardrobeOpen ? <FittingRoom who={heroFor(gender)} realMoney={Number(settings['feature.coin_packages']) === 1 && myTrack?.rules?.purchases !== false} onClose={() => (setWardrobeOpen(false), loadWorn(), daily.reload())} /> : null}
      {wheelOpen ? <WheelPage daily={daily} onClose={() => (setWheelOpen(false), loadSpins(), daily.reload())} /> : null}
      {missionsOpen ? (
        <MissionsSheet
          avail={missionAvail}
          links={missionAvail.link}
          onClose={() => (setMissionsOpen(false), loadTasks())}
          onChanged={loadTasks}
          onGo={(go) => {
            // The missions sheet paints over the pages opened from it: close it first so the page can be used.
            setMissionsOpen(false);
            setBackToMissions(go !== 'play');
            if (go === 'play') return onSolo();
            if (go === 'profile') return (setProfileStart('edit'), setProfileOpen(true));
            if (go === 'settings') return setSettingsOpen(true);
            if (go === 'bale') return setBaleOpen(true);
            return setInviteOpen(true);
          }}
        />
      ) : null}
      {inviteOpen ? <InviteSheet onClose={() => (setInviteOpen(false), loadTasks(), returnToMissions())} /> : null}
      {baleOpen ? <BaleSheet onClose={() => (setBaleOpen(false), loadTasks(), returnToMissions())} /> : null}
    </SceneBackground>
  );
}

