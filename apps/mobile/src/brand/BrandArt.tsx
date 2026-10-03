import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Character } from '../components/Character';
import type { CharacterId } from '../theme/character';
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

/** Warm radial backdrop (yellow to orange) with a sunburst; also the Android adaptive background. */
export function IconBackdrop({ size }: { size: number }) {
  const gid = `ib${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="-50 -50 100 100" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="30%" r="86%">
          <Stop offset="0" stopColor="#FFE48A" />
          <Stop offset="0.5" stopColor="#FFC93C" />
          <Stop offset="1" stopColor="#FF7A3D" />
        </RadialGradient>
      </Defs>
      <Rect x={-50} y={-50} width={100} height={100} fill={`url(#${gid})`} />
      <Path d={rays} transform="scale(0.5)" fill="rgba(255,255,255,0.22)" />
    </Svg>
  );
}

/** The gold coin of the icon: ink outline and drop shadow, the hero's waving face inside (proportions of the 180px design). */
function CoinHero({ size, who }: { size: number; who?: CharacterId }) {
  const gid = `cn${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const d = size * 0.7422;
  const edge = size * 0.0233;
  const drop = size * 0.0272;
  return (
    <>
      <View style={{ position: 'absolute', left: size * 0.1289, top: size * 0.1289, width: d, height: d + drop }}>
        <Svg width={d} height={d + drop}>
          <Defs>
            <RadialGradient id={gid} cx="35%" cy="30%" r="75%">
              <Stop offset="0" stopColor="#FFF4B0" />
              <Stop offset="0.55" stopColor="#FFC93C" />
              <Stop offset="1" stopColor="#D98A0B" />
            </RadialGradient>
          </Defs>
          <Circle cx={d / 2} cy={d / 2 + drop} r={d / 2} fill="#2B1240" />
          <Circle cx={d / 2} cy={d / 2} r={d / 2} fill="#2B1240" />
          <Circle cx={d / 2} cy={d / 2} r={d / 2 - edge} fill={`url(#${gid})`} />
        </Svg>
      </View>
      <View style={{ position: 'absolute', left: size * 0.1878, top: size * 0.1367, width: size * 0.625, height: size * 0.6833 }}>
        <Character who={who} crop="face" pose="wave" />
      </View>
    </>
  );
}

/** app-icon 1024: sunburst backdrop, the gold coin with the hero waving. */
export function AppIconArt({ size = 1024, who }: { size?: number; who?: CharacterId }) {
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <IconBackdrop size={size} />
      <CoinHero size={size} who={who} />
    </View>
  );
}

/** android-fg: transparent coin and hero, drawn at 90% so the coin rim stays inside the 66% safe zone of the adaptive icon. */
export function AndroidForeground({ size = 1024, who }: { size?: number; who?: CharacterId }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, transform: [{ scale: 0.9 }] }}>
        <CoinHero size={size} who={who} />
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
