import { useId } from 'react';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { fa } from '../i18n/fa';
import { fonts, colors } from '../theme/colors';
import { useTheme } from '../theme/themeStore';

/** «دوزاری» wordmark: gold gradient letters over a thick ink outline, as on the kit's splash screen. */
export function Wordmark({
  width = 270,
  variant = 'gold',
}: {
  width?: number;
  variant?: 'gold' | 'violet';
}) {
  const adult = useTheme() === 'adult';
  const gid = `wm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stops = adult
    ? ([
        ['0', '#FFF1B8'],
        ['0.45', '#E8B64A'],
        ['1', '#9A6A1C'],
      ] as const)
    : variant === 'gold'
      ? ([
          ['0', '#FFF6A8'],
          ['0.5', '#FFC93C'],
          ['1', '#FF7A3D'],
        ] as const)
      : ([
          ['0', '#C9A3FF'],
          ['1', '#6634B0'],
        ] as const);
  return (
    <Svg
      width={width}
      height={width * (200 / 700)}
      viewBox="-90 0 700 200"
      style={{ overflow: 'visible' }}
      accessibilityLabel={fa.home.title}
    >
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          {stops.map(([o, c]) => (
            <Stop key={o} offset={o} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <SvgText
        x={260}
        y={158}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontSize={168}
        fill={colors.ink}
        stroke={colors.ink}
        strokeWidth={26}
        strokeLinejoin="round"
      >
        {fa.home.title}
      </SvgText>
      <SvgText
        x={260}
        y={146}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontSize={168}
        fill={colors.ink}
        stroke={colors.ink}
        strokeWidth={14}
        strokeLinejoin="round"
      >
        {fa.home.title}
      </SvgText>
      <SvgText
        x={260}
        y={146}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontSize={168}
        fill={`url(#${gid})`}
      >
        {fa.home.title}
      </SvgText>
    </Svg>
  );
}
