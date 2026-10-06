import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Drift, Sway } from '../components/sceneMotion';
import { usePrefs } from '../prefs/store';
import { useTheme } from '../theme/themeStore';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { buildingParts } from './buildings';
import { HUB_BUILDINGS, canEnter } from './layout';
import type { HubAction, HubBuilding } from './layout';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const MAP_W = 318;
const MAP_H = 714;
const INK = '#4A2E1E';
const ROAD = 'M159 3000 V714 C159 640 60 630 70 560 C80 500 244 486 244 420 C244 360 88 372 88 300 C88 250 210 262 222 230';

/**
 * screen-hub of `11 More Screens` (D112): «شهر دوزاری», a hand-drawn bazaar town where each building is a game mode.
 * Tap one: its host and a short description rise from the bottom with «ورود». Only the modes that exist can be entered
 * (daily puzzle, tournament, solo, duel — and only while the admin has them on); the team teahouse and the
 * propose-and-vote school are drawn but say «به‌زودی».
 */
export function CityHub({ onClose, onEnter, features, dailyReady }: { onClose: () => void; onEnter: (a: HubAction) => void; features: { daily: boolean; duel: boolean; tournament: boolean }; dailyReady: boolean }) {
  useHardwareBack(onClose);
  /** Adult look: the town at night (docs/design/adult/Dozari Adult - Login Home, «Adult Hub»). */
  const adult = useTheme() === 'adult';
  const { width, height } = useWindowDimensions();
  const [sel, setSel] = useState<HubBuilding | null>(null);
  const slide = useRef(new Animated.Value(0)).current; // 0 = drawer hidden below the screen, 1 = raised
  const reduce = usePrefs().reduceMotion;
  const hasSel = sel !== null;
  useEffect(() => {
    if (!hasSel) return;
    if (reduce) return void slide.setValue(1);
    // A soft spring (slight settle, no bounce past the edge) feels smoother than a fixed-duration ease.
    Animated.spring(slide, { toValue: 1, damping: 22, stiffness: 150, mass: 1, overshootClamping: true, useNativeDriver: true }).start();
  }, [hasSel, reduce, slide]);
  const closeSheet = useCallback(() => {
    if (reduce) return setSel(null);
    Animated.timing(slide, { toValue: 0, duration: 280, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }).start(({ finished }) => finished && setSel(null));
  }, [reduce, slide]);
  const animated = !reduce; // the cloud drifts and the palms sway unless «حرکت کمتر» is on
  // The whole town fits the screen (nothing scrolls): scale by whichever of width / height is tighter.
  const k = Math.min(Math.min(width, 520) / MAP_W, height / MAP_H);
  const mapW = MAP_W * k;
  // The painted background reaches the screen's edges: the SVG is as wide / tall as the screen and its viewBox shows the map in the middle.
  const svgH = Math.max(height, MAP_H * k);
  const sideK = (width - mapW) / 2 / k;
  const t = fa.hub;

  return (
    <View style={styles.root}>
      {adult ? (
        <View style={StyleSheet.absoluteFill}><GradientFill from="#0A0712" to="#2A1A10" mid={{ at: 0.35, color: '#1E140E' }} /></View>
      ) : (
        <View style={[styles.sky, { height: 190 * k }]}>
          <View style={[styles.skyBand, { backgroundColor: '#5ECBC6', flex: 1 }]} />
          <View style={[styles.skyBand, { backgroundColor: '#8FDCCF', flex: 1 }]} />
          <View style={[styles.skyBand, { backgroundColor: '#B9EAD8', flex: 1 }]} />
        </View>
      )}
      <View style={styles.mapBox}>
        <View style={{ width: mapW, height: MAP_H * k }}>
          <Svg width={width} height={svgH} viewBox={`${-sideK} 0 ${width / k} ${svgH / k}`} style={{ position: 'absolute', top: 0, left: -(width - mapW) / 2 }}>
            {adult ? (
              <Defs>
                <RadialGradient id="hbG">
                  <Stop offset="0" stopColor="#FFD98A" stopOpacity={0.5} />
                  <Stop offset="1" stopColor="#FFD98A" stopOpacity={0} />
                </RadialGradient>
              </Defs>
            ) : null}
            <G stroke={adult ? '#0A0604' : INK} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round">
              {adult ? (
                <>
                  <Circle cx={60} cy={130} r={20} fill="#FFE9A8" stroke="none" />
                  <Circle cx={70} cy={124} r={18} fill="#0E0A10" stroke="none" />
                  {[[140, 120, 1.6], [200, 140, 1.2], [290, 118, 1.6], [110, 170, 1.1], [260, 176, 1.3], [30, 190, 1.2]].map(([cx, cy, r]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#E8B64A" stroke="none" />)}
                </>
              ) : null}
              {adult ? null : (
                <>
              <Drift from={-230} to={120} dur={60} begin={-20} animated={animated}><Path d="M-40 6 C-52 4 -50 -14 -36 -12 C-34 -26 -14 -28 -8 -16 C-2 -28 22 -26 22 -12 C38 -16 46 2 32 8 C30 18 12 18 6 10 C0 18 -18 18 -22 10 C-30 16 -42 14 -40 6Z" transform="translate(250 120) scale(.7)" fill="#fff" stroke="#4E9E9E" strokeWidth={2.2} /></Drift>
              <Path d="M-700 176 H0 C70 146 150 172 220 150 C260 138 290 146 318 140 H1020 V210 H-700Z" fill="#C9B5E0" stroke="#A893C8" strokeWidth={2} />
              <Path d="M-700 190 H0 C80 176 200 196 318 178 H1020 V3000 H-700Z" fill="#F2D59C" stroke="none" />
                </>
              )}
              <Path d={ROAD} fill="none" strokeWidth={30} />
              <Path d={ROAD} fill="none" stroke={adult ? '#3A2618' : '#FBEBC8'} strokeWidth={24} />
              <Path d={ROAD} fill="none" stroke={adult ? '#B8822A' : '#E2BF80'} strokeWidth={2} strokeDasharray={adult ? '6 9' : '6 10'} opacity={adult ? 0.8 : 1} />
              {adult ? HUB_BUILDINGS.map((b) => <Circle key={`glow-${b.key}`} cx={b.x} cy={b.by - 16} r={44} fill="url(#hbG)" stroke="none" />) : null}
              {adult ? null : <>
              <Sway x={300} y={470} dur={4.2} animated={animated}>
              <Path d="M300 470 C296 440 304 420 300 400" fill="none" strokeWidth={9} />
              <Path d="M300 470 C296 440 304 420 300 400" fill="none" stroke="#A8743E" strokeWidth={5} />
              <Path d="M300 400 C286 386 268 390 262 400 C276 394 288 396 300 402Z M300 400 C314 386 332 390 338 400 C324 394 312 396 300 402Z M300 398 C294 382 300 372 310 368 C304 378 302 388 301 398Z" fill="#3FA36B" />
              </Sway>
              <Sway x={20} y={470} dur={3.6} animated={animated}>
              <Path d="M20 470 C16 446 24 430 20 414" fill="none" strokeWidth={9} />
              <Path d="M20 470 C16 446 24 430 20 414" fill="none" stroke="#A8743E" strokeWidth={5} />
              <Path d="M20 414 C8 402 -8 406 -12 414 C2 408 10 410 20 416Z M20 414 C32 402 48 406 52 414 C40 408 30 410 20 416Z" fill="#3FA36B" />
              </Sway>
              </>}
              {HUB_BUILDINGS.map((b) => (
                <G key={b.key} transform={sel?.key === b.key ? `translate(${b.x} ${b.by}) scale(1.07) translate(${-b.x} ${-b.by})` : undefined}>
                  {buildingParts(b, adult).map((p, i) => (
                    <Path key={i} d={p.d} fill={p.f} stroke={p.stroke} strokeWidth={p.width} opacity={p.opacity} />
                  ))}
                </G>
              ))}
            </G>
          </Svg>

          {/* The drawing of each building is a tap target too (like its plate): both raise the same bottom drawer. */}
          {HUB_BUILDINGS.map((b) => (
            <Pressable key={`art-${b.key}`} onPress={() => setSel(b)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: (b.x - b.w / 2 - 6) * k, top: (b.by - b.h - 26) * k, width: (b.w + 12) * k, height: (b.h + 34) * k }} />
          ))}
          {HUB_BUILDINGS.map((b) => {
            const info = t.buildings[b.key];
            const badge = b.key === 'tower' && dailyReady ? t.isNew : b.key === 'caravan' && features.tournament ? t.live : null;
            return (
              <Pressable key={b.key} onPress={() => setSel(b)} accessibilityRole="button" accessibilityLabel={`${info?.name} · ${info?.mode}`} style={[styles.tag, { left: b.x * k - 70, top: (b.by + 8) * k, opacity: canEnter(b, features) ? 1 : 0.8 }]}>
                <View style={[styles.mode, adult ? ad.mode : { backgroundColor: b.chip }]}><Text style={[styles.modeText, adult ? ad.modeText : null]}>{info?.mode}</Text></View>
                <View style={[styles.plate, adult ? ad.plate : null, sel?.key === b.key ? (adult ? ad.plateOn : styles.plateOn) : null]}>
                  <Text style={[styles.plateText, adult ? (sel?.key === b.key ? ad.plateTextOn : ad.plateText) : null]}>{info?.name}</Text>
                  {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose}>
          {({ pressed }) => (
            <View style={[styles.back, pressed ? styles.pressed : null]}>
              <GradientFill from={adult ? '#5A3A1C' : '#C9A3FF'} to={adult ? '#24160A' : '#A66BF0'} />
              <Icon name="back" size={22} color={adult ? '#FFE9A8' : '#fff'} strokeWidth={3} />
            </View>
          )}
        </Pressable>
        <View style={[styles.title, adult ? ad.title : null]}>
          {adult ? null : <GradientFill from="#FFE48A" to={colors.candy.yellow} />}
          <Text style={[styles.titleText, adult ? ad.titleText : null]}>{t.title}</Text>
        </View>
        <View style={styles.spacer} />
      </View>
      {sel ? null : <View style={styles.hint} pointerEvents="none"><Text style={[styles.hintText, adult ? ad.hintText : null]}>{t.tap}</Text></View>}

      {sel ? (
        <>
          <Animated.View style={[styles.dim, { opacity: slide }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel={t.close} />
          </Animated.View>
          <Animated.View style={[styles.sheet, adult ? ad.sheet : null, { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [Math.max(300, height * 0.4), 0] }) }] }]}>
            <View style={styles.host}><Character who={sel.host} pose="wave" /></View>
            <View style={styles.sheetBody}>
              <View style={styles.sheetHead}>
                <Text style={[styles.sheetName, adult ? ad.sheetName : null]}>{t.buildings[sel.key]?.name}</Text>
                <View style={[styles.mode, styles.modeBig, adult ? ad.chipBig : { backgroundColor: sel.chip }]}><Text style={[styles.modeText, adult ? ad.chipBigText : null]}>{t.buildings[sel.key]?.mode}</Text></View>
              </View>
              <Text style={[styles.desc, adult ? ad.desc : null]}>{t.buildings[sel.key]?.desc}</Text>
              <View style={styles.buttons}>
                {(() => {
                  const ok = canEnter(sel, features);
                  return (
                    <Pressable disabled={!ok} accessibilityRole="button" accessibilityLabel={ok ? t.enter : t.soon} onPress={() => sel.action && onEnter(sel.action)} style={({ pressed }) => [styles.enter, !ok ? styles.enterOff : null, pressed ? styles.pressed : null]}>
                      <GradientFill from={adult ? (ok ? '#FFF1B8' : '#5A3A1C') : ok ? '#B8F08F' : '#D2C6E0'} to={adult ? (ok ? '#B8822A' : '#24160A') : ok ? '#5DBB3C' : '#A99BC0'} {...(adult && ok ? { mid: { at: 0.45, color: '#E8B64A' } } : {})} />
                      <Text style={[styles.enterText, adult ? (ok ? ad.enterText : ad.enterTextOff) : null]}>{ok ? t.enter : t.soon}</Text>
                    </Pressable>
                  );
                })()}
                <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={closeSheet} style={({ pressed }) => [styles.x, pressed ? styles.pressed : null]}>
                  <GradientFill from={adult ? '#5A3A1C' : '#FFAA7A'} to={adult ? '#24160A' : '#FF7A3D'} />
                  <Icon name="close" size={20} color={adult ? '#FFE9A8' : '#fff'} strokeWidth={3} />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

/** Adult overrides (night bazaar: near-black plates, gold frames, brass buttons). */
const ad = StyleSheet.create({
  mode: { backgroundColor: '#0E0A08', borderColor: '#8A5A16' },
  modeText: { color: '#E8B64A', textShadowColor: 'transparent' },
  plate: { backgroundColor: '#17100C', borderColor: '#E8B64A' },
  plateOn: { backgroundColor: '#E8B64A', borderColor: '#000' },
  plateText: { color: '#FFE9A8' },
  plateTextOn: { color: '#2A1606' },
  title: { backgroundColor: '#17100C', borderColor: '#E8B64A' },
  titleText: { color: '#FFE9A8' },
  hintText: { backgroundColor: '#17100C', borderColor: '#8A5A16', color: '#E8B64A' },
  sheet: { backgroundColor: '#17100C', borderColor: '#E8B64A' },
  sheetName: { color: '#FFE9A8' },
  chipBig: { backgroundColor: '#E8B64A', borderColor: '#000' },
  chipBigText: { color: '#2A1606', textShadowColor: 'transparent' },
  desc: { color: 'rgba(255,233,168,0.85)' },
  enterText: { color: '#2A1606', textShadowColor: 'transparent' },
  enterTextOff: { color: 'rgba(255,233,168,0.6)', textShadowColor: 'transparent' },
});

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#F2D59C' },
  mapBox: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  sky: { position: 'absolute', top: 0, left: 0, right: 0 },
  skyBand: { width: '100%' },
  tag: { position: 'absolute', width: 140, alignItems: 'center' },
  mode: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, marginBottom: -4, zIndex: 1 },
  modeBig: { marginBottom: 0 },
  modeText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  plate: { paddingHorizontal: 12, paddingTop: 3, paddingBottom: 2, borderRadius: 10, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.cream, ...lift(4) },
  plateOn: { backgroundColor: '#FFE48A' },
  plateText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  badge: { position: 'absolute', top: -10, left: -14, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.candy.pink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 11, color: '#fff' },
  top: { position: 'absolute', top: 30, left: 12, right: 12, flexDirection: ROW, alignItems: 'center', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  title: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(5) },
  titleText: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  spacer: { width: 42 },
  hint: { position: 'absolute', top: 92, left: 0, right: 0, alignItems: 'center' },
  hintText: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cream, fontFamily: fonts.bold, fontSize: 12, color: colors.ink, overflow: 'hidden' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(26,8,44,0.35)' },
  sheet: { position: 'absolute', left: 10, right: 10, bottom: 12, flexDirection: ROW, alignItems: 'flex-end', gap: 10, paddingTop: 16, paddingHorizontal: 14, paddingBottom: 14, borderRadius: 30, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.paper, ...lift(5) },
  host: { width: 104, height: 120, marginTop: -50 },
  sheetBody: { flex: 1, gap: 6, minWidth: 0 },
  sheetHead: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  sheetName: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  desc: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 22, color: colors.ink, textAlign: TEXT_RIGHT },
  buttons: { flexDirection: ROW, gap: 8, marginTop: 4 },
  enter: { flex: 1, height: 48, borderRadius: 15, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  enterOff: { opacity: 0.85 },
  enterText: { fontFamily: fonts.display, fontSize: 21, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  x: { width: 48, height: 48, borderRadius: 15, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
});
