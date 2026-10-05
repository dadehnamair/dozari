import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { letterForms, toPersianDigits } from '@dozari/shared';
import type { LessonCard } from '@dozari/shared';
import { SlabButton } from '../components/SlabButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchLessons } from './lessonApi';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/**
 * Word lesson of the kid track (docs/logic/age-tracks.md): after a puzzle, one card per item that has an approved lesson —
 * the word, its letters one by one (joined where the script joins them), the letter count and a one-line story.
 * Nothing to show (no approved lessons, or the server fails) simply ends the lesson; it must never block the game.
 */
export function LessonPanel({ productIds, onDone }: { productIds: readonly string[]; onDone: () => void }) {
  const [cards, setCards] = useState<LessonCard[] | null>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    let alive = true;
    fetchLessons(productIds).then(
      (c) => alive && (c.length === 0 ? onDone() : setCards(c)),
      () => alive && onDone(),
    );
    return () => {
      alive = false;
    };
  }, [productIds.join(',')]);

  if (!cards) return <ActivityIndicator color={colors.candy.yellow} accessibilityLabel={fa.lesson.loading} />;
  const card = cards[i];
  if (!card) return null;
  const forms = letterForms(card.wordFa);
  const last = i === cards.length - 1;
  return (
    <View style={styles.card} accessibilityLabel={card.wordFa}>
      <Text style={styles.title}>{fa.lesson.title}</Text>
      <Text style={styles.word}>{card.wordFa}</Text>
      <View style={[styles.letters, { flexDirection: ROW }]}>
        {forms.map((f, k) => (
          <View key={k} style={styles.letter}>
            <Text style={styles.letterText}>{f.letter}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.count}>{fa.lesson.letters(toPersianDigits(String(forms.length)))}</Text>
      {card.syllablesFa ? <Text style={styles.syllables}>{card.syllablesFa}</Text> : null}
      {card.storyFa ? <Text style={styles.story}>{card.storyFa}</Text> : null}
      <View style={styles.actions}>
        <SlabButton label={fa.lesson.skip} color={colors.candy.sky} height={50} fontSize={18} onPress={onDone} />
        <SlabButton label={last ? fa.lesson.last : fa.lesson.next} sfx="confirm" color={colors.candy.lime} height={50} fontSize={20} grow={1.4} onPress={() => (last ? onDone() : setI(i + 1))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', gap: 10, alignItems: 'center', padding: 14, borderRadius: 22, borderWidth: 3, borderColor: '#2B1240', backgroundColor: '#FBF1DE' },
  title: { fontFamily: fonts.display, fontSize: 18, color: '#5B4A70' },
  word: { fontFamily: fonts.display, fontSize: 44, color: '#2B1240' },
  letters: { flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  letter: { minWidth: 46, height: 52, paddingHorizontal: 8, borderRadius: 12, borderWidth: 2, borderColor: '#2B1240', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: fonts.display, fontSize: 30, color: '#2B1240' },
  count: { fontFamily: fonts.bold, fontSize: 15, color: '#5B4A70' },
  syllables: { fontFamily: fonts.bold, fontSize: 18, color: '#A66BF0' },
  story: { fontFamily: fonts.body, fontSize: 16, color: '#2B1240', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
});
