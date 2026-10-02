import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { SceneBackground } from '../components/SceneBackground';
import { Character } from '../components/Character';
import { DailyRewardCard } from '../components/DailyRewardCard';
import { IconButton } from '../components/IconButton';
import { ProfileSheet } from '../social/ProfileSheet';
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
import { dailyPuzzleLabel } from '../daily/label';
import type { DailyStatus } from '@dozari/shared';
import { shareTable } from '../tables/api';
import { TableSheet } from '../tables/TableSheet';
import { TournamentSheet } from '../tournament/TournamentSheet';
import { Toast } from '../components/Toast';
import { Wordmark } from '../components/Wordmark';
import { useDailyReward } from '../daily/useDailyReward';
import { solarMonthOf, toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

/** Home: wordmark, the waving mascot (floating, as on the kit's splash) and the way into a solo game. */
export function HomeScreen({ onSolo, onDaily, onDuel, onDuelResume, onLookup, onGallery, features = OPEN_CONFIG.features, settings = OPEN_CONFIG.raw }: { onSolo: () => void; onDaily?: () => void; onDuel?: () => void; onDuelResume?: () => void; onLookup: () => void; onGallery?: () => void; features?: ClientConfig['features']; settings?: ClientConfig['raw'] }) {
  const month = useMemo(() => solarMonthOf(Date.now()), []);
  const daily = useDailyReward();
  const [dailyOpen, setDailyOpen] = useState(false);
  const [baleOpen, setBaleOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableCode, setTableCode] = useState<string | undefined>(undefined);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [dailyPuzzle, setDailyPuzzle] = useState<DailyStatus | null>(null);
  useEffect(() => {
    fetchMyProfile().then((p) => setGender(p.gender), () => undefined);
  }, []);
  useEffect(() => {
    if (features.daily) fetchDailyStatus().then(setDailyPuzzle, () => undefined);
  }, [features.daily]);
  const inbox = useInbox();
  const review = useReviewPrompt(settings);
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -10,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  return (
    <SceneBackground scene="bazaar">
      <View style={styles.content}>
        <View style={styles.topBar}>
          {daily.status ? (
            <View style={styles.coins} accessibilityLabel={`${daily.status.balance} ${fa.daily.coins}`}>
              <Text style={styles.coinsText}>{toPersianDigits(String(daily.status.balance))}</Text>
              <Text style={styles.coinsUnit}>{fa.daily.coins}</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.actions}>
          {features.friends ? <IconButton icon="user" label={fa.profile.open} color={colors.candy.grape} size={48} onPress={() => setProfileOpen(true)} /> : null}
          {features.inbox ? <IconButton icon="mail" label={fa.inbox.open} color={colors.candy.sky} badge={inbox.inbox && inbox.inbox.unread > 0 ? toPersianDigits(String(inbox.inbox.unread)) : undefined} size={48} onPress={() => { inbox.reload(); setInboxOpen(true); }} /> : null}
          {daily.status ? (
            <IconButton icon="gift" label={fa.daily.open} color={colors.candy.pink} badge={daily.status.canClaim ? '!' : undefined} size={48} onPress={() => setDailyOpen(true)} />
          ) : null}
          </View>
        </View>
        <View style={styles.top}>
          <Wordmark />
          <Text style={styles.tagline}>{fa.home.tagline}</Text>
        </View>
        <View style={styles.bottom}>
          <Animated.View style={[styles.mascot, { transform: [{ translateY: float }] }]}>
            <Character who={heroFor(gender)} pose="wave" month={month} />
          </Animated.View>
          <Text style={styles.mood}>
            {fa.months[month - 1]?.name} · {fa.months[month - 1]?.mood}
          </Text>
          {features.daily && onDaily && dailyPuzzle && dailyPuzzle.state !== 'unavailable' ? (
            <CandyButton
              label={dailyPuzzleLabel(dailyPuzzle)}
              color={colors.candy.orange}
              disabled={dailyPuzzle.state === 'won' || dailyPuzzle.state === 'lost'}
              onPress={onDaily}
            />
          ) : null}
          <CandyButton label={fa.home.soloButton} color={colors.candy.yellow} onPress={onSolo} />
          {features.duel && onDuel ? <CandyButton label={fa.duel.open} color={colors.candy.pink} onPress={onDuel} /> : null}
          {features.lookup ? <CandyButton label={fa.home.lookupButton} color={colors.candy.lime} onPress={onLookup} /> : null}
          {features.tournament ? <CandyButton label={fa.tournament.open} color={colors.candy.pink} onPress={() => setTournamentOpen(true)} /> : null}
          {features.tables ? <CandyButton label={fa.tables.open} color={colors.candy.lime} onPress={() => setTableOpen(true)} /> : null}
          {features.chat ? <CandyButton label={fa.chat.open} color={colors.candy.sky} onPress={() => setChatOpen(true)} /> : null}
          {features.shop ? <CandyButton label={fa.shop.open} color={colors.candy.orange} onPress={() => setShopOpen(true)} /> : null}
          {features.bale ? <CandyButton label={fa.bale.open} color={colors.candy.grape} onPress={() => setBaleOpen(true)} /> : null}
          {onGallery ? (
            <CandyButton label={fa.kit.gallery} color={colors.candy.sky} onPress={onGallery} />
          ) : null}
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
      {profileOpen ? <ProfileSheet onClose={() => setProfileOpen(false)} onGender={setGender} /> : null}
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
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  topBar: { position: 'absolute', top: 14, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(251,241,222,0.92)', borderWidth: 3, borderColor: '#3A2418' },
  coinsText: { fontFamily: fonts.display, fontSize: 20, color: '#3A2418' },
  coinsUnit: { fontFamily: fonts.bold, fontSize: 12, color: '#3A2418' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: 'rgba(60,30,90,0.92)', borderRadius: 30, padding: 4, gap: 10 },
  won: { alignItems: 'center', paddingBottom: 10 },
  top: { alignItems: 'center', gap: 6 },
  bottom: { alignItems: 'center', gap: 10 },
  tagline: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#3A2418',
    textShadowColor: '#FFF6E8',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  mood: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#3A2418',
    textAlign: 'center',
    backgroundColor: 'rgba(251,241,222,0.92)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#3A2418',
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  mascot: { width: 190, height: 215 },
});
