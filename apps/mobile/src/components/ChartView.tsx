import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { getChartRules } from '../config/chartRules';
import { CHART_SERIES_COLORS, buildChartData, compactTomanLabel, formatShortJalaliYear, lineSegments, normalizeX, normalizeY, xTicks, yTicks } from '@dozari/shared';
import type { SoloChart, YScale } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors } from '../theme/colors';

/** Persian text inside the chart's left-to-right container: isolate it so words and digits keep their reading order. */
const rtl = (text: string): string => `\u2067${text}\u2069`;

const DEFAULT_HEIGHT = 230;
const PAD = { left: 58, right: 12, top: 12, bottom: 26 };

/** Overlaid price history of one group's four products (docs/logic/result-chart.md). Time runs left to right. */
export function ChartView({ group, scale, height: HEIGHT = DEFAULT_HEIGHT }: { group: SoloChart['groups'][number]; scale: YScale; /** Plot height; the end scene shrinks it on short screens. */ height?: number }) {
  const [width, setWidth] = useState(0);
  const data = buildChartData(
    group.items.map((it) => ({
      productId: it.productId,
      name: it.nameFa,
      prices: it.points.map((p) => ({ year: p.year, month: p.month, priceRials: BigInt(p.priceRials) })),
    })),
    { colors: CHART_SERIES_COLORS.dark, ruleYear: group.ruleYear, ...getChartRules() },
  );

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const X = (year: number) => PAD.left + normalizeX(year, data.years ?? { min: 0, max: 0 }) * innerW;
  const Y = (rials: bigint) => PAD.top + (1 - normalizeY(rials, data.yDomain ?? { minRials: 1n, maxRials: 1n }, scale)) * innerH;

  return (
    <View style={styles.wrap}>
      <View style={[styles.chart, LTR, { height: HEIGHT }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {data.years && data.yDomain && width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {yTicks(data.yDomain, scale).map((t) => (
              <Line key={`y${t}`} x1={PAD.left} x2={width - PAD.right} y1={Y(t)} y2={Y(t)} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            ))}
            {yTicks(data.yDomain, scale).map((t) => (
              <SvgText key={`yl${t}`} x={PAD.left - 6} y={Y(t) + 4} fill={colors.cream} fontSize={10} textAnchor="end">{rtl(compactTomanLabel(t))}</SvgText>
            ))}
            {xTicks(data.years).map((y) => (
              <SvgText key={`xl${y}`} x={X(y)} y={HEIGHT - 8} fill={colors.cream} fontSize={10} textAnchor="middle">{formatShortJalaliYear(y)}</SvgText>
            ))}
            {data.markers.map((m) => (
              <Line key={m.year} x1={X(m.year)} x2={X(m.year)} y1={PAD.top} y2={PAD.top + innerH} stroke={colors.candy.yellow} strokeWidth={1.5} strokeDasharray="5 4" />
            ))}
            {data.series.map((s) =>
              lineSegments(s.points).map((run, i) => (
                <Path key={`${s.productId}-${i}`} d={run.map((p, k) => `${k === 0 ? 'M' : 'L'}${X(p.year).toFixed(1)} ${Y(p.rials).toFixed(1)}`).join(' ')} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              )),
            )}
            {data.series.flatMap((s) => s.points.map((p) => <Circle key={`${s.productId}-${p.year}`} cx={X(p.year)} cy={Y(p.rials)} r={3.5} fill={s.color} />))}
          </Svg>
        ) : (
          <Text style={styles.empty}>{data.years ? '' : fa.solo.chart.noData}</Text>
        )}
      </View>
      <View style={styles.legend}>
        {data.series.map((s) => (
          <View key={s.productId} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.name}</Text>
          </View>
        ))}
        {data.markers.map((m) => (
          <Text key={m.year} style={styles.marker}>┆ {m.label}</Text>
        ))}
      </View>
    </View>
  );
}

// Not in StyleSheet.create: react-native-web's dev validation rejects `direction` there, though it works on both platforms.
const LTR: ViewStyle = { direction: 'ltr' };

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  chart: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, justifyContent: 'center' },
  empty: { fontFamily: 'Vazirmatn_400Regular', color: colors.cream, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.cream },
  marker: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.candy.yellow },
});
