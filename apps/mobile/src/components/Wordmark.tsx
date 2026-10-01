import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { fa } from '../i18n/fa';
import { fonts } from '../theme/colors';

/** «دوزاری» wordmark: gold gradient letters over a thick ink outline, as on the kit's splash screen. */
export function Wordmark({ width = 270 }: { width?: number }) {
  return (
    <Svg
      width={width}
      height={width * (200 / 700)}
      viewBox="-90 0 700 200"
      style={{ overflow: 'visible' }}
      accessibilityLabel={fa.home.title}
    >
      <Defs>
        <LinearGradient id="wm" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF6A8" />
          <Stop offset="0.5" stopColor="#FFC93C" />
          <Stop offset="1" stopColor="#FF7A3D" />
        </LinearGradient>
      </Defs>
      <SvgText
        x={260}
        y={158}
        textAnchor="middle"
        fontFamily={fonts.display}
        fontSize={168}
        fill="#2B1240"
        stroke="#2B1240"
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
        fill="#2B1240"
        stroke="#2B1240"
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
        fill="url(#wm)"
      >
        {fa.home.title}
      </SvgText>
    </Svg>
  );
}
