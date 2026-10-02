import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const INK = '#3A2418';

/** «نظر بده» dialog: go to the store page, ask again later, or never ask again. */
export function ReviewSheet({ message, url, onReview, onLater, onNever }: { message: string; url: string; onReview: () => void; onLater: () => void; onNever: () => void }) {
  return (
    <Pressable style={styles.overlay} onPress={onLater} accessibilityLabel={fa.review.later}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.review.title}</Text>
        <Text style={styles.text}>{message || fa.review.defaultMessage}</Text>
        <CandyButton
          label={fa.review.go}
          color={colors.candy.lime}
          onPress={() => {
            void Linking.openURL(url);
            onReview();
          }}
        />
        <CandyButton label={fa.review.later} color={colors.candy.sky} onPress={onLater} />
        <Pressable onPress={onNever} accessibilityRole="button">
          <Text style={styles.never}>{fa.review.never}</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 18, gap: 10, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  text: { fontFamily: fonts.bold, fontSize: 15, color: INK, textAlign: 'center' },
  never: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.6, textDecorationLine: 'underline' },
});
