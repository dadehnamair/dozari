import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SoloChart, YScale } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { fetchSoloChart } from '../solo/api';
import { colors } from '../theme/colors';
import { ChartView } from './ChartView';

/** Result-screen chart: loads the history once the game is over; one colour tab per group (purple first). */
export function ChartPanel({ sessionId }: { sessionId: string }) {
  const [chart, setChart] = useState<SoloChart | 'failed' | null>(null);
  const [level, setLevel] = useState<number>(3);
  const [scale, setScale] = useState<YScale>('log');

  useEffect(() => {
    let alive = true;
    fetchSoloChart(sessionId).then((c) => alive && setChart(c)).catch(() => alive && setChart('failed'));
    return () => { alive = false; };
  }, [sessionId]);

  if (chart === null) return <ActivityIndicator color={colors.candy.yellow} />;
  if (chart === 'failed') return <Text style={styles.msg}>{fa.solo.chart.loadFailed}</Text>;
  const group = chart.groups.find((g) => g.level === level) ?? chart.groups[0];
  if (!group) return null;

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
      <ChartView group={group} scale={scale} />
      <Pressable onPress={() => setScale((s) => (s === 'log' ? 'linear' : 'log'))} accessibilityRole="button">
        <Text style={styles.toggle}>{scale === 'log' ? fa.solo.chart.log : fa.solo.chart.linear}</Text>
      </Pressable>
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
  toggle: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.candy.sky },
  msg: { fontFamily: 'Vazirmatn_400Regular', color: colors.cream },
});
