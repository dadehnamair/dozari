import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Absolute vertical gradient behind a view's content (no native gradient dependency). */
export function GradientFill({
  from,
  to,
  mid,
}: {
  from: string;
  to: string;
  mid?: { at: number; color: string };
}) {
  const gid = `gf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          {[
            { at: 0, color: from },
            ...(mid ? [mid] : []),
            { at: 1, color: to },
          ].map((s) => (
            <Stop key={s.at} offset={s.at} stopColor={s.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={1} height={1} fill={`url(#${gid})`} />
    </Svg>
  );
}
