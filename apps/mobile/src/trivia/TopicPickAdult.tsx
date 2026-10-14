import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatPersianNumber } from '@dozari/shared';
import type { TriviaTopics } from '@dozari/shared';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { SceneBackground } from '../components/SceneBackground';
import { fa } from '../i18n/fa';
import { playSfx } from '../sound/engine';
import { fonts } from '../theme/colors';
import { nativeTopInset } from '../theme/safeArea';

const t = fa.triviaDuel;
const a = t.adult;

/** Icon of each topic by its Persian name (topics are DB content, so an unknown name draws a star). */
const TOPIC_ICON: Record<string, string> = {
  خوراکی: 'burger',
  ورزشی: 'medal',
  سرگرمی: 'headphones',
  مدرسه: 'book',
  عمومی: 'bulb',
  اماکن: 'map',
  'مهارت/شغل': 'bag',
  خودرو: 'peykan',
  خونه: 'house',
  خانواده: 'heart',
  فوتبالی: 'ball',
  طبیعت: 'tulip',
};

const GO_ON = ['#FFD2B0', '#E0895A', '#B0552A', '#7A3414'] as const;

type Topic = TriviaTopics['topics'][number];

/**
 * Adult look of the question duel's topic picker («صرافی و گاوصندوق», copper = duel; docs/design/adult/Dozari Adult - Quiz Duel):
 * the entry-fee plate, «تصادفی» (rolls a topic onto the grid), the topic grid, and a start button naming the chosen topic.
 */
export function TopicPickAdult({ topics, fee, busy, note, onBack, onStart }: { topics: Topic[]; fee: number; busy: boolean; note: string | null; onBack: () => void; onStart: (topicId: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const chosen = topics.find((x) => x.id === sel) ?? null;
  const roll = () => {
    if (topics.length === 0) return;
    playSfx('confirm');
    setSel(topics[Math.floor(Math.random() * topics.length)]!.id);
  };
  return (
    <SceneBackground scene="sarafi">
      <GradientFill from="rgba(14,10,8,0.7)" to="rgba(14,10,8,0.96)" mid={{ at: 0.28, color: 'rgba(14,10,8,0.88)' }} />
      <View style={[styles.screen, { paddingTop: nativeTopInset() + 8 }]}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={fa.solo.back} hitSlop={8} onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>›</Text>
          </Pressable>
          <View style={styles.headText}>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.sub}>{a.pickSub}</Text>
          </View>
          <View style={styles.trophy}><View style={styles.trophyIcon}><Item icon="trophy" /></View></View>
        </View>

        <View style={styles.fee}>
          <View style={styles.feeCoin}><View style={styles.feeCoinIcon}><Item icon="coin" /></View></View>
          <View style={styles.feeText}>
            <Text style={styles.feeTitle}>{fee > 0 ? a.feeTitle(formatPersianNumber(fee)) : a.freeTitle}</Text>
            <Text style={styles.feeSub}>{a.feeSub}</Text>
          </View>
        </View>

        {note ? <Text style={styles.error}>{note}</Text> : null}
        {topics.length === 0 ? <Text style={styles.empty}>{t.noQuestions}</Text> : null}

        {topics.length > 0 ? (
          <>
            <Pressable accessibilityRole="button" disabled={busy} onPress={roll} style={({ pressed }) => [styles.random, pressed ? styles.pressed : null]}>
              <GradientFill from="#FFF1B8" to="#8A5A16" mid={{ at: 0.4, color: '#E8B64A' }} />
              <View style={styles.dice}><Item icon="dice" /></View>
              <Text style={styles.randomText}>{t.randomAdult}</Text>
            </Pressable>
            <View style={styles.or}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>{a.or}</Text>
              <View style={styles.orLine} />
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {topics.map((x) => {
                const on = x.id === sel;
                return (
                  <Pressable
                    key={x.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    disabled={busy}
                    onPress={() => {
                      playSfx('tap');
                      setSel(on ? null : x.id);
                    }}
                    style={({ pressed }) => [styles.topic, on ? styles.topicOn : null, pressed ? styles.pressed : null]}
                  >
                    <View style={[styles.topicRing, on ? styles.topicRingOn : null]}><View style={styles.topicIcon}><Item icon={TOPIC_ICON[x.nameFa] ?? 'star'} /></View></View>
                    <Text style={[styles.topicName, on ? styles.topicNameOn : null]} numberOfLines={1}>{x.nameFa}</Text>
                    <Text style={styles.topicCount}>{fa.trivia.questionsCount(formatPersianNumber(x.questions))}</Text>
                    {on ? <View style={styles.tick}><Text style={styles.tickText}>✓</Text></View> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              disabled={busy || !chosen}
              onPress={() => {
                if (chosen) {
                  playSfx('confirm');
                  onStart(chosen.id);
                }
              }}
              style={({ pressed }) => [styles.go, !chosen ? styles.goOff : null, pressed ? styles.pressed : null]}
            >
              <GradientFill from={chosen ? GO_ON[0] : '#5A4A3A'} to={chosen ? GO_ON[3] : '#3A2A1C'} mid={chosen ? { at: 0.5, color: GO_ON[1] } : undefined} />
              <Text style={styles.goText}>{chosen ? a.go(chosen.nameFa) : a.pickFirst}</Text>
              {fee > 0 ? (
                <View style={styles.goFee}>
                  <View style={styles.goFeeIcon}><Item icon="coin" /></View>
                  <Text style={styles.goFeeText}>{formatPersianNumber(fee)}</Text>
                </View>
              ) : null}
            </Pressable>
          </>
        ) : null}
      </View>
    </SceneBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 12, paddingBottom: 14, gap: 10, width: '100%', maxWidth: 480, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#3A2412', borderWidth: 2, borderColor: '#B8822A', alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: '#FFE9A8' },
  headText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: '#FFE9A8', textAlign: 'right' },
  sub: { fontFamily: fonts.bold, fontSize: 11.5, color: 'rgba(255,233,168,0.65)', textAlign: 'right' },
  trophy: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#2A1C12', borderWidth: 2, borderColor: '#E0895A', alignItems: 'center', justifyContent: 'center' },
  trophyIcon: { width: 28, height: 28 },
  fee: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 16, backgroundColor: '#201610', borderWidth: 2, borderColor: '#E8B64A' },
  feeCoin: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0E0A08', borderWidth: 1.5, borderColor: '#8A5A16', alignItems: 'center', justifyContent: 'center' },
  feeCoinIcon: { width: 30, height: 30 },
  feeText: { flex: 1, gap: 2 },
  feeTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: '#FFE9A8', textAlign: 'right' },
  feeSub: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 17, color: 'rgba(255,233,168,0.7)', textAlign: 'right' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#FF9A8A', textAlign: 'center' },
  empty: { fontFamily: fonts.bold, fontSize: 14, color: 'rgba(255,233,168,0.7)', textAlign: 'center', marginTop: 20 },
  random: { height: 58, borderRadius: 17, borderWidth: 3, borderColor: '#000', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  dice: { width: 38, height: 38, transform: [{ rotate: '-12deg' }] },
  randomText: { fontFamily: fonts.display, fontSize: 23, color: '#2A1606' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  orLine: { flex: 1, height: 1.5, backgroundColor: '#8A5A16', opacity: 0.7 },
  orText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#E8B64A' },
  scroll: { flex: 1, minHeight: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingVertical: 4, paddingBottom: 6 },
  topic: { width: '48.5%', height: 100, borderRadius: 17, borderWidth: 2, borderColor: '#8A5A16', backgroundColor: '#201610', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
  topicOn: { borderColor: '#FFD2B0', backgroundColor: '#3F2010' },
  topicRing: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#17100C', borderWidth: 1.5, borderColor: '#5A3A1C', alignItems: 'center', justifyContent: 'center' },
  topicRingOn: { borderColor: '#E0895A' },
  topicIcon: { width: 34, height: 34 },
  topicName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, color: '#FFE9A8' },
  topicNameOn: { color: '#FFE2CC' },
  topicCount: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,233,168,0.6)' },
  tick: { position: 'absolute', top: 7, left: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: '#E0895A', borderWidth: 1.5, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  tickText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 16, color: '#2A1206' },
  go: { height: 54, borderRadius: 16, borderWidth: 3, borderColor: '#000', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  goOff: { opacity: 0.55 },
  goText: { fontFamily: fonts.display, fontSize: 21, color: '#2A1206' },
  goFee: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.22)' },
  goFeeIcon: { width: 18, height: 18 },
  goFeeText: { fontFamily: fonts.display, fontSize: 15, color: '#FFF1B8' },
  pressed: { transform: [{ translateY: 2 }] },
});
