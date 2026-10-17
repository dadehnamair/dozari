import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

/** Scrollable body of a dialog card: with a `maxHeight` on the card, long content scrolls inside it instead of spilling off the screen (the close button stays above, outside the scroll). */
export function SheetBody({ children, gap = 8, center = true }: { children: ReactNode; gap?: number; center?: boolean }) {
  return (
    <ScrollView style={styles.body} contentContainerStyle={[{ gap }, center ? styles.center : null]} showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { alignSelf: 'stretch', flexGrow: 0, flexShrink: 1 },
  center: { alignItems: 'center' },
});
