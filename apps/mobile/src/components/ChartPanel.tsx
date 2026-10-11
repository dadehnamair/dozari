import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SoloChart, YScale } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { fetchSoloChart } from '../solo/api';
import { fetchInvite } from '../invite/api';
import { captureAndShare } from '../share/shareCapture';
import { ShareCard } from '../share/ShareCard';
import { shareLine } from '../share/shareLine';
import { colors } from '../theme/colors';
import { ChartView } from './ChartView';

/** Result-screen chart: loads the history once the game is over; one colour tab per group (purple first). */
export function ChartPanel({ sessionId, height }: { sessionId: string; height?: number }) {
  const [chart, setChart] = useState<SoloChart | 'failed' | null>(null);
  const [level, setLevel] = useState<number>(3);
  const [scale, setScale] = useState<YScale>('log');
  const [code, setCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const cardRef = useRef<View>(null);

  // The invite code on the card is a nicety: without it the card is still shared.
  useEffect(() => {
    let alive = true;
    fetchInvite().then((i) => alive && setCode(i.code ?? null), () => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchSoloChart(sessionId).then((c) => alive && setChart(c)).catch(() => alive && setChart('failed'));
    return () => { alive = false; };
  }, [sessionId]);

  if (chart === null) return <ActivityIndicator color={colors.candy.yellow} />;
  if (chart === 'failed') return <Text style={styles.msg}>{fa.solo.chart.loadFailed}</Text>;
  const group = chart.groups.find((g) => g.level === level) ?? chart.groups[0];
  if (!group) return null;

  const line = shareLine(group);
  const share = () => {
    if (sharing) return;
    setSharing(true);
    setShareNote(null);
    captureAndShare(cardRef, fa.share.message(line, code))
      .catch(() => setShareNote(fa.share.failed))
      .finally(() => setSharing(false));
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{fa.solo.chart.title}</Text>
      <View style={styles.tabs}>
        {[...chart.groups].reverse().map((g) => (
          <Pressable key={g.level} onPress={() => setLevel(g.level)} style={[styles.tab, { backgroundColor: colors.group[g.level] }, g.level === group.level && styles.tabOn]} accessibilityRole="button">
            <Text style={styles.tabText}>{fa.solo.groupTab[g.level]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.groupTitle}>{group.titleFa}</Text>
      <ChartView group={group} scale={scale} height={height} />
      <Pressable onPress={() => setScale((s) => (s === 'log' ? 'linear' : 'log'))} accessibilityRole="button">
        <Text style={styles.toggle}>{scale === 'log' ? fa.solo.chart.log : fa.solo.chart.linear}</Text>
      </Pressable>
      <Pressable onPress={share} disabled={sharing} accessibilityRole="button" style={styles.share}>
        <Text style={styles.shareText}>{sharing ? fa.share.sharing : fa.share.button}</Text>
      </Pressable>
      {shareNote ? <Text style={styles.msg}>{shareNote}</Text> : null}
      <View pointerEvents="none" style={styles.offscreen}><ShareCard ref={cardRef} group={group} scale={scale} line={line} code={code} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 520, gap: 10, alignItems: 'center', marginTop: 12 },
  title: { fontFamily: 'Vazirmatn_700Bold', fontSize: 18, color: colors.cream },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, opacity: 0.6 },
  tabOn: { opacity: 1, borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.3)' },
  tabText: { fontFamily: 'Vazirmatn_700Bold', fontSize: 13, color: colors.ink },
  groupTitle: { fontFamily: 'Vazirmatn_700Bold', fontSize: 15, color: colors.cream },
  share: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.lime },
  shareText: { fontFamily: 'Vazirmatn_700Bold', fontSize: 14, color: colors.ink },
  offscreen: { position: 'absolute', left: -4000, top: 0 },
  toggle: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.candy.sky },
  msg: { fontFamily: 'Vazirmatn_400Regular', color: colors.cream },
});
