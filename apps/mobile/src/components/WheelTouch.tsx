import { useMemo, useState } from 'react';
import { PanResponder, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { usePrefs } from '../prefs/store';
import { dragWheel, grabWheel, releaseWheel } from './wheelSpin';

/** The wheel's centre and reach on the scene's 390 x 844 canvas (Scene.tsx, case 'sarafi'). */
const CX = 195;
const CY = 420;
const REACH = 112;

/**
 * An invisible disc over the painted vault wheel (adult look): drag around the centre to turn it, let go to spin it on.
 * It sits behind the screen's own content, which must let touches through where the wheel shows (`pointerEvents="box-none"`).
 */
export function WheelTouch() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const calm = usePrefs().reduceMotion;
  const pan = useMemo(() => {
    let lastAngle = 0;
    let lastAt = 0;
    const angleAt = (x: number, y: number, r: number) => (Math.atan2(y - r, x - r) * 180) / Math.PI;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        grabWheel();
        lastAngle = NaN;
        lastAt = Date.now();
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const a = angleAt(locationX, locationY, sizeRef.r);
        const now = Date.now();
        if (!Number.isNaN(lastAngle)) {
          let d = a - lastAngle;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          dragWheel(d, (now - lastAt) / 1000);
        }
        lastAngle = a;
        lastAt = now;
      },
      onPanResponderRelease: () => releaseWheel(!calmRef.v),
      onPanResponderTerminate: () => releaseWheel(!calmRef.v),
    });
  }, []);
  calmRef.v = calm;
  const s = size.w && size.h ? Math.max(size.w / 390, size.h / 844) : 0;
  const r = REACH * s;
  sizeRef.r = r;
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none" onLayout={onLayout}>
      {s > 0 ? (
        <View
          {...pan.panHandlers}
          accessible={false}
          style={{ position: 'absolute', width: r * 2, height: r * 2, borderRadius: r, left: size.w / 2 + (CX - 195) * s - r, top: size.h / 2 + (CY - 422) * s - r }}
        />
      ) : null}
    </View>
  );
}

const calmRef = { v: false };
const sizeRef = { r: 0 };
