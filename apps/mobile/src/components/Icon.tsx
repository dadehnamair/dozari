import Svg, { Path } from 'react-native-svg';
import { ICON_PATHS } from '../theme/icons';
import type { IconName } from '../theme/icons';
import { colors } from '../theme/colors';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Rounded line icon from the design kit (24x24 grid, stroke only). */
export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 2.4 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={ICON_PATHS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
