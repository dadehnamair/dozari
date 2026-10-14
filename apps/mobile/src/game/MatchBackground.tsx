import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { bootTheme } from '../theme/bootTheme';
import { AdultBackdrop } from '../duel/adultKit';
import Svg, { Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Background of screen-match (`docs/design/Dozari - 01 Screens`): deep violet, faint 46px checker, a glow at the top. */
export function MatchBackground({ children }: { children?: React.ReactNode }) {
  // The adult look paints the vault room (docs/design/adult/Dozari Adult - Quiz Duel) instead of the violet checker.
  if (bootTheme() === 'adult') return <AdultBackdrop>{children}</AdultBackdrop>;
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="mbq" width={46} height={46} patternUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={23} height={23} fill="#FFFFFF" fillOpacity={0.055} />
            <Rect x={23} y={23} width={23} height={23} fill="#FFFFFF" fillOpacity={0.055} />
          </Pattern>
          <RadialGradient id="mbg" cx="50%" cy="20%" rx="60%" ry="45%">
            <Stop offset="0" stopColor="rgb(198,120,255)" stopOpacity={0.55} />
            <Stop offset="1" stopColor="rgb(198,120,255)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#mbg)" />
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#mbq)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.deeper } });
