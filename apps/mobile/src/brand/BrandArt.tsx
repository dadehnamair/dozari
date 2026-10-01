import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Character } from '../components/Character';
import { Wordmark } from '../components/Wordmark';
import { fonts } from '../theme/colors';

/** Brand art from docs/design/Dozari - 03 Brand.dc.html. Squares are full-bleed; the OS rounds the corners. */

const rays = (() => {
  let d = '';
  for (let i = 0; i < 18; i++) {
    const a = (i * 20 * Math.PI) / 180;
    const b = ((i * 20 + 10) * Math.PI) / 180;
    d += `M0 0 L${(Math.cos(a) * 400).toFixed(1)} ${(Math.sin(a) * 400).toFixed(1)} L${(Math.cos(b) * 400).toFixed(1)} ${(Math.sin(b) * 400).toFixed(1)}Z `;
  }
  return d;
})();

/** Violet radial backdrop with a sunburst; also the Android adaptive background. */
export function IconBackdrop({ size }: { size: number }) {
  const gid = `ib${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="-50 -50 100 100" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="45%" r="60%">
          <Stop offset="0" stopColor="#C9A3FF" />
          <Stop offset="0.45" stopColor="#A66BF0" />
          <Stop offset="1" stopColor="#5A2D91" />
        </RadialGradient>
      </Defs>
      <Rect x={-50} y={-50} width={100} height={100} fill={`url(#${gid})`} />
      <Path d={rays} transform="scale(0.5)" fill="rgba(255,255,255,0.14)" />
    </Svg>
  );
}

function Gloss({ size }: { size: number }) {
  const gid = `gl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size * 0.46} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.28} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={size} height={size * 0.46} fill={`url(#${gid})`} />
    </Svg>
  );
}

/** app-icon 1024: backdrop, the hero's face, gloss. */
export function AppIconArt({ size = 1024 }: { size?: number }) {
  const inset = size * (16 / 180);
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <IconBackdrop size={size} />
      <View style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset }}>
        <Character crop="face" pose="idle" />
      </View>
      <Gloss size={size} />
    </View>
  );
}

/** android-fg: transparent, the face inside the 66% safe zone of the adaptive icon. */
export function AndroidForeground({ size = 1024 }: { size?: number }) {
  const inset = size * 0.17;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset }}>
        <Character crop="face" pose="idle" />
      </View>
    </View>
  );
}

/** Ring with the «۲» glyph, drawn in one colour: Android themed icon (mono) and notification icon. */
export function RingMark({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.64,
          height: size * 0.64,
          borderRadius: size,
          borderWidth: size * 0.065,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: size * 0.38,
            lineHeight: size * 0.5,
            color,
            paddingTop: size * 0.04,
          }}
        >
          ۲
        </Text>
      </View>
    </View>
  );
}

/** favicon: gold coin with the letter «د». */
export function FaviconArt({ size = 48 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: '#FFC93C',
        borderWidth: size * 0.085,
        borderColor: '#2B1240',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size * 0.54,
          lineHeight: size * 0.7,
          color: '#2B1240',
          paddingTop: size * 0.06,
        }}
      >
        د
      </Text>
    </View>
  );
}

function Coin({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: '#FFC93C',
        borderWidth: size * 0.07,
        borderColor: '#2B1240',
        borderBottomWidth: size * 0.1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size * 0.6,
          lineHeight: size * 0.8,
          color: '#7A4A00',
          paddingTop: size * 0.06,
        }}
      >
        ۲
      </Text>
    </View>
  );
}

/** logo-stacked: the hero cheering over the gold wordmark (on dark). */
export function LogoStacked({ width = 240 }: { width?: number }) {
  return (
    <View style={{ width, alignItems: 'center', paddingBottom: width * 0.08 }}>
      <View style={{ width: width * 0.5, height: width * 0.55 }}>
        <Character pose="cheer" />
      </View>
      <Wordmark width={width * 0.8} />
    </View>
  );
}

/** logo-wordmark for light backgrounds: violet wordmark and the coin. */
export function LogoLight({ width = 330 }: { width?: number }) {
  return (
    <View
      style={{
        width,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      <Wordmark width={width * 0.66} variant="violet" />
      <Coin size={width * 0.18} />
    </View>
  );
}
