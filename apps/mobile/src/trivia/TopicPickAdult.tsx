import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatPersianNumber } from '@dozari/shared';
import type { TriviaTopics } from '@dozari/shared';
import { AdultBackdrop, BrassSquare, Plate } from '../duel/adultKit';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { playSfx } from '../sound/engine';
import { fonts } from '../theme/colors';
import { nativeTopInset } from '../theme/safeArea';

/** The screen is laid out with `direction: 'rtl'` (see `styles.screen`), so a row starts at the right edge on every platform. */
const ROW = 'row' as const;
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

const GO_ON = ['#FFD2B0', '#B0552A'] as const;

type Topic = TriviaTopics['topics'][number];

/**
 * Adult look of the question duel's topic picker («صرافی و گاوصندوق», copper = duel; docs/design/adult/Dozari Adult - Quiz Duel):
 * the entry-fee plate, «تصادفی» (rolls a topic onto the grid), the topic grid, and a start button naming the chosen topic.
 */
export function TopicPickAdult({ topics, fee, busy = false, note = null, texts, mix, onBack, onStart }: { topics: Topic[]; fee: number; busy?: boolean; note?: string | null; /** Heading, subtitle and the fee plate's two lines (the question duel and the solo questions each say their own). */ texts: { title: string; sub: string; feeTitle: string; feeSub: string }; /** A button that starts straight away on every topic (solo); absent = «تصادفی» rolls a topic onto the grid (duel). */ mix?: { label: string; onPress: () => void }; onBack: () => void; onStart: (topicId: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const chosen = topics.find((x) => x.id === sel) ?? null;
  const roll = () => {
    if (topics.length === 0) return;
    playSfx('confirm');
    setSel(topics[Math.floor(Math.random() * topics.length)]!.id);
  };
  return (
    <AdultBackdrop>
      <View style={[styles.screen, { paddingTop: nativeTopInset() + 8 }]}>
        <View style={styles.head}>
          <BrassSquare glyph="back" label={fa.solo.back} onPress={onBack} />
          <View style={styles.headText}>
            <Text style={styles.title}>{texts.title}</Text>
            <Text style={styles.sub}>{texts.sub}</Text>
          </View>
          <View style={styles.trophy}><View style={styles.trophyIcon}><Item icon="trophy" /></View></View>
        </View>

        <Plate radius={16} border="#E8B64A" style={styles.fee}>
          <View style={styles.feeCoin}><View style={styles.feeCoinIcon}><Item icon="coin" /></View></View>
          <View style={styles.feeText}>
            <Text style={styles.feeTitle}>{texts.feeTitle}</Text>
            <Text style={styles.feeSub}>{texts.feeSub}</Text>
          </View>
        </Plate>

        {note ? <Text style={styles.error}>{note}</Text> : null}
        {topics.length === 0 ? <Text style={styles.empty}>{t.noQuestions}</Text> : null}

        {topics.length > 0 ? (
          <>
            <Pressable accessibilityRole="button" disabled={busy} onPress={mix ? mix.onPress : roll} style={({ pressed }) => (pressed ? styles.pressed : null)}>
              <Plate radius={17} border="#000" frame={3} from="#FFF1B8" to="#8A5A16" style={styles.random}>
                <View style={styles.dice}><Item icon="dice" /></View>
                <Text style={styles.randomText}>{mix ? mix.label : t.randomAdult}</Text>
              </Plate>
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
                    style={({ pressed }) => [styles.topic, pressed ? styles.pressed : null]}
                  >
                    <Plate radius={17} border={on ? '#FFD2B0' : '#8A5A16'} from={on ? '#5A2E18' : '#2A1E16'} to={on ? '#2A140A' : '#17100C'} ledge={3} glow={on ? '#E0895A' : undefined} height={100} style={styles.topicFace}>
                    <View style={[styles.topicRing, on ? styles.topicRingOn : null]}><View style={styles.topicIcon}><Item icon={TOPIC_ICON[x.nameFa] ?? 'star'} /></View></View>
                    <Text style={[styles.topicName, on ? styles.topicNameOn : null]} numberOfLines={1}>{x.nameFa}</Text>
                    <View style={styles.topicCount}><Text style={styles.topicCountText}>{formatPersianNumber(x.questions)}</Text></View>
                    {on ? <View style={styles.tick}><Text style={styles.tickText}>✓</Text></View> : null}
                    </Plate>
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
              style={({ pressed }) => [!chosen ? styles.goOff : null, pressed ? styles.pressed : null]}
            >
              <Plate radius={16} border="#000" frame={3} from={chosen ? GO_ON[0] : '#5A4A3A'} to={chosen ? GO_ON[1] : '#3A2A1C'} height={54} style={styles.go}>
              <Text style={styles.goText}>{chosen ? a.go(chosen.nameFa) : a.pickFirst}</Text>
              {fee > 0 ? (
                <View style={styles.goFee}>
                  <View style={styles.goFeeIcon}><Item icon="coin" /></View>
                  <Text style={styles.goFeeText}>{formatPersianNumber(fee)}</Text>
                </View>
              ) : null}
              </Plate>
            </Pressable>
          </>
        ) : null}
      </View>
    </AdultBackdrop>
  );
}

const styles = StyleSheet.create({
  screen: { direction: 'rtl', flex: 1, paddingHorizontal: 12, paddingBottom: 14, gap: 10, width: '100%', maxWidth: 480, alignSelf: 'center' },
  head: { flexDirection: ROW, alignItems: 'center', gap: 10 },
  headText: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 36, color: '#FFE9A8', textAlign: 'right' },
  sub: { fontFamily: fonts.bold, fontSize: 11.5, color: 'rgba(255,233,168,0.65)', textAlign: 'right' },
  trophy: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#2A1C12', borderWidth: 2, borderColor: '#E0895A', alignItems: 'center', justifyContent: 'center' },
  trophyIcon: { width: 28, height: 28 },
  fee: { flexDirection: ROW, alignItems: 'center', gap: 10, padding: 8 },
  feeCoin: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0E0A08', borderWidth: 1.5, borderColor: '#8A5A16', alignItems: 'center', justifyContent: 'center' },
  feeCoinIcon: { width: 30, height: 30 },
  feeText: { flex: 1, gap: 2 },
  feeTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: '#FFE9A8', textAlign: 'right' },
  feeSub: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 17, color: 'rgba(255,233,168,0.7)', textAlign: 'right' },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#FF9A8A', textAlign: 'center' },
  empty: { fontFamily: fonts.bold, fontSize: 14, color: 'rgba(255,233,168,0.7)', textAlign: 'center', marginTop: 20 },
  random: { height: 52, flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 10 },
  dice: { width: 38, height: 38, transform: [{ rotate: '-12deg' }] },
  randomText: { fontFamily: fonts.display, fontSize: 23, color: '#2A1606' },
  or: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  orLine: { flex: 1, height: 1.5, backgroundColor: '#8A5A16', opacity: 0.7 },
  orText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#E8B64A' },
  scroll: { flex: 1, minHeight: 0 },
  grid: { flexDirection: ROW, flexWrap: 'wrap', gap: 9, paddingVertical: 4, paddingBottom: 6 },
  topic: { width: '48.5%' },
  topicFace: { alignItems: 'center', justifyContent: 'center', gap: 2, padding: 6 },
    topicRing: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#17100C', borderWidth: 1.5, borderColor: '#5A3A1C', alignItems: 'center', justifyContent: 'center' },
  topicRingOn: { borderColor: '#E0895A' },
  topicIcon: { width: 34, height: 34 },
  topicName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: '#FFE9A8' },
  topicNameOn: { color: '#FFE2CC' },
  topicCount: { position: 'absolute', top: 7, right: 7, minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#0E0A08', borderWidth: 1, borderColor: '#5A3A1C', alignItems: 'center', justifyContent: 'center' },
  topicCountText: { fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 15, color: 'rgba(255,233,168,0.7)' },
  tick: { position: 'absolute', top: 7, left: 7, width: 22, height: 22, borderRadius: 11, backgroundColor: '#E0895A', borderWidth: 1.5, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  tickText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 16, color: '#2A1206' },
  go: { flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 8 },
  goOff: { opacity: 0.55 },
  goText: { fontFamily: fonts.display, fontSize: 21, color: '#2A1206' },
  goFee: { flexDirection: ROW, alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.22)' },
  goFeeIcon: { width: 18, height: 18 },
  goFeeText: { fontFamily: fonts.display, fontSize: 15, color: '#FFF1B8' },
  pressed: { transform: [{ translateY: 2 }] },
});
