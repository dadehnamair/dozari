import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Icon } from '../components/Icon';
import type { IconName } from '../theme/icons';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';
import { useTheme } from '../theme/themeStore';
import { hideToast, useToast } from './toastStore';
import type { ToastKind } from './toastStore';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const TONE: Record<ToastKind, { color: string; icon: IconName }> = {
  success: { color: colors.candy.lime, icon: 'check' },
  error: { color: colors.candy.pink, icon: 'close' },
  info: { color: colors.candy.yellow, icon: 'info' },
};

/** One small pill that slides up above the bottom edge for every message the app has for the player (saved, failed, invited…). Mount once at the root. */
export function ToastHost() {
  const toast = useToast();
  const adult = useTheme() === 'adult';
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, useNativeDriver: Platform.OS !== 'web', friction: 8, tension: 90 }).start();
  }, [toast?.id, slide]);
  if (!toast) return null;
  const tone = TONE[toast.kind];
  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}
    >
      <Pressable onPress={hideToast} accessibilityRole="alert" style={[styles.toast, adult ? styles.toastAdult : null, { borderColor: tone.color }]}>
        <Icon name={tone.icon} size={18} color={tone.color} strokeWidth={3} />
        <Text style={[styles.text, adult ? styles.textAdult : null]}>{toast.text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 28, zIndex: 200, alignItems: 'center' },
  toast: { maxWidth: 420, flexDirection: ROW, alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, borderWidth: 2.5, backgroundColor: colors.ink, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 8 },
  toastAdult: { backgroundColor: '#1B1209' },
  text: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: '#fff', textAlign: TEXT_RIGHT },
  textAdult: { color: '#FFE9A8' },
});
