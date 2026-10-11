import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { Character } from '../components/Character';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { sendErrorReport } from './report';

/** What the player sees when a screen broke: the mascot, one friendly line, and a way back. The report has already gone to the admin panel by itself. */
function CrashCard({ error, onReset }: { error: Error; onReset: () => void }) {
  const [sent, setSent] = useState<'sending' | 'sent' | 'failed'>('sending');
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    // A beat for the card to paint, so the screenshot shows what the player is looking at.
    const id = setTimeout(() => void sendErrorReport({ kind: 'crash', message: `${error.name}: ${error.message}`, detail: error.stack ?? '' }).then((ok) => setSent(ok ? 'sent' : 'failed')), 400);
    return () => clearTimeout(id);
  }, [error]);
  const t = fa.errorReport;
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.mascot}><Character pose="sad" /></View>
        <Text style={styles.title}>{t.crashTitle}</Text>
        <Text style={styles.sub}>{t.crashSub}</Text>
        <Text style={styles.status}>{sent === 'sending' ? t.sending : sent === 'sent' ? t.sent : t.failed}</Text>
        <Text style={styles.detail} numberOfLines={3}>{error.message}</Text>
        <CandyButton label={t.crashRetry} color={colors.candy.lime} onPress={onReset} />
        {Platform.OS === 'web' ? <CandyButton label={t.reload} color={colors.candy.sky} onPress={() => (globalThis as { location?: { reload: () => void } }).location?.reload()} /> : null}
      </View>
    </View>
  );
}

/**
 * The app's last safety net: a screen that throws while drawing used to leave a blank page (the whole tree unmounts). Now the player gets a card and
 * a way back, and the error, the trail of recent calls and a screenshot go to the admin panel by themselves (docs/logic/client-errors.md).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; epoch: number }> {
  override state = { error: null as Error | null, epoch: 0 };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('[app] a screen crashed', error, info.componentStack);
    if (info.componentStack) error.stack = `${error.stack ?? ''}\n--- components ---${info.componentStack}`;
  }

  override render(): ReactNode {
    if (this.state.error) return <CrashCard error={this.state.error} onReset={() => this.setState((s) => ({ error: null, epoch: s.epoch + 1 }))} />;
    return <View key={this.state.epoch} style={styles.fill}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A0E52', padding: 20 },
  card: { width: '100%', maxWidth: 320, padding: 20, borderRadius: 28, backgroundColor: colors.cream, borderWidth: 4, borderColor: colors.ink, borderBottomWidth: 8, alignItems: 'center', gap: 8 },
  mascot: { width: 110, height: 120 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.ink, opacity: 0.85, textAlign: 'center' },
  status: { fontFamily: fonts.bold, fontSize: 12.5, color: '#7E46D6', textAlign: 'center' },
  detail: { fontFamily: fonts.body, fontSize: 11, color: colors.ink, opacity: 0.5, textAlign: 'center', writingDirection: 'ltr' },
});
