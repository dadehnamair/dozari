import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { usePrefs } from '../prefs/store';
import { coinDelta, lastSeenBalance, rememberBalance } from './coinDelta';

const COUNT_MS = 900;
const FLOAT_MS = 1600;

/**
 * Drives the coin counter after wins and losses: `shown` counts from the old balance to the new one, and `fx`
 * carries the «+N» / «−N» chip that floats up and fades (`progress` 0→1). Reduced motion jumps straight to the value.
 */
export function useCoinDelta(balance: number | null) {
  const prefs = usePrefs();
  const [shown, setShown] = useState<number | null>(balance);
  const [fx, setFx] = useState<{ delta: number; key: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const key = useRef(0);

  useEffect(() => {
    if (balance === null) return undefined;
    const prev = lastSeenBalance();
    const delta = coinDelta(prev, balance);
    rememberBalance(balance);
    if (delta === 0 || prev === null) {
      setShown(balance);
      return undefined;
    }
    setFx({ delta, key: ++key.current });
    if (prefs.reduceMotion) {
      setShown(balance);
      const t = setTimeout(() => setFx(null), FLOAT_MS);
      return () => clearTimeout(t);
    }
    setShown(prev);
    count.setValue(prev);
    progress.setValue(0);
    const id = count.addListener(({ value }) => setShown(Math.round(value)));
    Animated.parallel([
      Animated.timing(count, { toValue: balance, duration: COUNT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(progress, { toValue: 1, duration: FLOAT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setFx(null);
    });
    return () => {
      count.removeListener(id);
      count.stopAnimation();
      progress.stopAnimation();
      setShown(balance);
    };
  }, [balance, count, progress, prefs.reduceMotion]);

  return { shown, fx, progress };
}
