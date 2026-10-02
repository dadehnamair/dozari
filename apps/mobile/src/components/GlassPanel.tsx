import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

/** panel-glass: translucent white card over a scene. */
export function GlassPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    padding: 18,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    gap: 12,
  },
});
