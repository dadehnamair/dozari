import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPersianNumber, toPersianDigits, rialsToTomanString } from '@dozari/shared';
import type { FeedCard, WorkshopInfo } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { GuideBubble } from '../components/GuideBubble';
import { SceneBackground } from '../components/SceneBackground';
import { useHardwareBack } from '../nav/useHardwareBack';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { pageTop } from '../theme/safeArea';
import { fetchFeed, voteOn } from './api';
import { SuggestDialog } from './SuggestDialog';

const t = fa.feedback;

/** What the question side of the sheet needs; absent when the workshop is off for this player (price section only). */
export interface SchoolWorkshop {
  info: WorkshopInfo | null;
  onOpen: (tab: 'make' | 'review') => void;
}

/**
 * «قیمت/سوال» (the gold tab under the wallet): two sections. Price = suggest an item or vote on others' suggestions (D104);
 * Question = design a question or review others' (the question workshop, D237).
 */
export function SchoolSheet({ onClose, workshop, initialSection = 'price' }: { onClose: () => void; workshop?: SchoolWorkshop; initialSection?: 'price' | 'question' }) {
  useHardwareBack(onClose);
  const [section, setSection] = useState<'price' | 'question'>(workshop ? initialSection : 'price');
  const [suggesting, setSuggesting] = useState(false);
  const [voting, setVoting] = useState(false);
  const waiting = workshop?.info?.waiting ?? 0;
  return (
    <View style={styles.root}>
      <SceneBackground scene="bazaar">
        <View style={styles.column}>
          <Text style={styles.title}>{t.school.title}</Text>
          {workshop && !voting ? (
            <View style={styles.tabs}>
              {(['price', 'question'] as const).map((k) => (
                <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: section === k }} onPress={() => setSection(k)} style={[styles.tab, section === k ? styles.tabOn : null]}>
                  <Text style={styles.tabText}>{k === 'price' ? t.school.tabPrice : t.school.tabQuestion}</Text>
                  {k === 'question' && waiting > 0 ? <Text style={styles.tabBadge}>{formatPersianNumber(waiting)}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          {voting ? (
            <VoteCard onBack={() => setVoting(false)} />
          ) : section === 'price' || !workshop ? (
            <>
              <GuideBubble who="mirza" text={t.school.hint} />
              <CandyButton label={t.school.suggest} color={colors.candy.lime} onPress={() => setSuggesting(true)} />
              <CandyButton label={t.school.vote} color={colors.candy.sky} onPress={() => setVoting(true)} />
              <CandyButton label={fa.hub.close} sfx="back" color={colors.candy.orange} onPress={onClose} />
            </>
          ) : (
            <>
              <GuideBubble who="mirza" text={t.school.questionHint} />
              {workshop.info ? <Text style={styles.sub}>{fa.workshop.reward(formatPersianNumber(workshop.info.rewardCoins))}</Text> : null}
              <CandyButton label={t.school.makeQuestion} color={colors.candy.lime} onPress={() => workshop.onOpen('make')} />
              <CandyButton label={waiting > 0 ? t.school.reviewWaiting(formatPersianNumber(waiting)) : t.school.reviewQuestions} color={colors.candy.sky} onPress={() => workshop.onOpen('review')} />
              <CandyButton label={fa.hub.close} sfx="back" color={colors.candy.orange} onPress={onClose} />
            </>
          )}
        </View>
      </SceneBackground>
      {suggesting ? <SuggestDialog onClose={() => setSuggesting(false)} /> : null}
    </View>
  );
}

function VoteCard({ onBack }: { onBack: () => void }) {
  const [card, setCard] = useState<FeedCard | null | 'locked' | 'loading'>('loading');
  const [need, setNeed] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => {
    setCard('loading');
    fetchFeed().then(
      (f) => (f.locked ? (setNeed(f.need), setCard('locked')) : setCard(f.card)),
      () => (setNote(t.vote.error), setCard(null)),
    );
  }, []);
  useEffect(load, [load]);
  const vote = (c: FeedCard, value: 1 | -1) =>
    voteOn(c.id, value).then(load, () => (setNote(t.vote.error), load()));

  if (card === 'loading') return <Text style={styles.sub}>…</Text>;
  if (card === 'locked' || card === null) {
    return (
      <>
        <GuideBubble who="mirza" text={card === 'locked' ? t.vote.locked(need) : (note ?? t.vote.empty)} />
        <CandyButton label={fa.hub.close} sfx="back" color={colors.candy.orange} onPress={onBack} />
      </>
    );
  }
  return (
    <>
      <Text style={styles.sub}>{t.vote.title}</Text>
      <View style={styles.card}>
        <Text style={styles.kind}>{t.vote.kinds[card.kind] ?? card.kind}</Text>
        <Text style={styles.name}>{card.nameFa}</Text>
        {card.year !== null ? <Text style={styles.line}>{`سال ${toPersianDigits(String(card.year))}`}</Text> : null}
        {card.priceRials !== null ? <Text style={styles.price}>{`${rialsToTomanString(card.priceRials)} ${fa.feedback.form.toman}`}</Text> : null}
        <Text style={styles.line}>{`${t.vote.source[card.sourceType] ?? ''}${card.sourceText ? `: ${card.sourceText}` : ''}`}</Text>
        {card.note ? <Text style={styles.line}>{card.note}</Text> : null}
      </View>
      {note ? <Text style={styles.err}>{note}</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={() => vote(card, 1)} accessibilityRole="button" accessibilityLabel={t.vote.up} style={[styles.vote, { backgroundColor: colors.candy.lime }]}><Text style={styles.voteText}>👍 {t.vote.up}</Text></Pressable>
        <Pressable onPress={() => vote(card, -1)} accessibilityRole="button" accessibilityLabel={t.vote.down} style={[styles.vote, { backgroundColor: '#FF8FB6' }]}><Text style={styles.voteText}>👎 {t.vote.down}</Text></Pressable>
      </View>
      <CandyButton label={fa.hub.close} sfx="back" color={colors.candy.orange} onPress={onBack} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 25 },
  column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 14, paddingTop: pageTop() + 8, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 28, color: '#fff', textAlign: 'center', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  sub: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream, textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', paddingVertical: 9, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper },
  tabOn: { backgroundColor: colors.candy.yellow },
  tabText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  tabBadge: { fontFamily: fonts.display, fontSize: 12, color: '#fff', backgroundColor: '#E53935', borderRadius: 99, paddingHorizontal: 6, overflow: 'hidden' },
  card: { padding: 16, gap: 6, borderRadius: 22, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.cream },
  kind: { alignSelf: 'center', fontFamily: fonts.bold, fontSize: 12, color: '#fff', backgroundColor: '#3F72D0', paddingHorizontal: 10, borderRadius: 99, overflow: 'hidden' },
  name: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, textAlign: 'center' },
  price: { fontFamily: fonts.display, fontSize: 22, color: '#B3590B', textAlign: 'center' },
  line: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, textAlign: 'center' },
  err: { fontFamily: fonts.bold, fontSize: 13, color: '#FFD0CC', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  vote: { flex: 1, height: 60, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  voteText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
});
