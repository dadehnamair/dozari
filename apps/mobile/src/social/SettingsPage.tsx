import { FACE_TEXT } from '../theme/skin';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { Scene } from '../components/Scene';
import { fa } from '../i18n/fa';
import { signOutEverywhere } from '../account/api';
import { DeleteAccountDialog } from '../account/DeleteAccountDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MUSIC_VOLUMES } from '../prefs/model';
import { setPref, usePrefs } from '../prefs/store';
import { IosInstallSheet } from '../pwa/PwaLayer';
import { usePwa } from '../pwa/usePwa';
import { playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';
import { PhoneLoginSheet } from '../phone/PhoneLoginSheet';
import { DARK, useDark } from '../theme/skin';
import { BaleSheet } from '../bale/BaleSheet';
import { ChildCodeSheet } from '../agetrack/ChildCodeSheet';
import { ChildrenSheet } from '../agetrack/ChildrenSheet';
import { CityPicker } from './CityPicker';
import { fetchMyProfile } from './api';
import type { City } from '@dozari/shared';
import { pageTop, safeTop } from '../theme/safeArea';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

interface Row {
  key: string;
  icon: string;
  tint: string;
  label: string;
  toggle?: boolean;
  value?: string;
  tone?: string;
  onPress: () => void;
}

/**
 * screen-settings of `11 More Screens` (D107): the hujre scene, a sky title plate, Mashti with his line, then grouped
 * cards of rows — switches that work on this device (sound, vibration, less motion), shortcuts (profile, city,
 * install) and the account (replay the tutorial, sign out, delete with a second tap).
 */
export function SettingsPage({ onClose, onProfile, onTutorial, onAccountGone, ageTracksOn = false, baleOn = false, onPreview }: { onClose: () => void; /** A guardian opens a read-only preview of the kid or teen space. */ onPreview?: (track: 'kid' | 'teen') => void; onProfile: () => void; onTutorial?: () => void; onAccountGone?: () => void; /** The server's age-track switch: shows the guardian rows. */ ageTracksOn?: boolean; /** The Bale bot is set up: shows the «connect to Bale» row. */ baleOn?: boolean }) {
  useHardwareBack(onClose);
  const dark = useDark();
  const prefs = usePrefs();
  const pwa = usePwa();
  const [iosHelp, setIosHelp] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [city, setCity] = useState<City | null | undefined>(undefined);
  const [askOut, setAskOut] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [childrenOpen, setChildrenOpen] = useState(false);
  const [childCodeOpen, setChildCodeOpen] = useState(false);
  const [baleOpen, setBaleOpen] = useState(false);
  const t = fa.settings;
  // Nothing scrolls: on a short screen the rows tighten instead.
  const compact = useWindowDimensions().height < 760;

  if (cityOpen) return <CityPicker current={city ?? null} onPicked={(c) => (setCity(c), setCityOpen(false))} onClose={() => setCityOpen(false)} />;
  const openCity = () => void fetchMyProfile().then((p) => (setCity(p.city), setCityOpen(true)), () => setNote(fa.account.failed));
  const toggle = (k: 'sound' | 'music' | 'vibration' | 'reduceMotion') => () => {
    setPref(k, !prefs[k]);
    if (k === 'sound' && !prefs.sound) setTimeout(() => playSfx('coin'), 0);
  };

  const groups: { title: string; tint: string; rows: Row[] }[] = [
    {
      title: t.groups.game,
      tint: colors.candy.sky,
      rows: [
        { key: 'sound', icon: 'radio', tint: '#3FC1F0', label: fa.prefs.sound, toggle: prefs.sound, onPress: toggle('sound') },
        { key: 'music', icon: 'radio', tint: '#FFC93C', label: fa.prefs.music, toggle: prefs.music, onPress: toggle('music') },
        { key: 'vibration', icon: 'phone', tint: '#A66BF0', label: fa.prefs.vibration, toggle: prefs.vibration, onPress: toggle('vibration') },
        { key: 'motion', icon: 'hourglass', tint: '#FF8FB6', label: fa.prefs.reduceMotion, toggle: prefs.reduceMotion, onPress: toggle('reduceMotion') },
      ],
    },
    {
      title: t.groups.me,
      tint: colors.candy.lime,
      rows: [
        { key: 'profile', icon: 'medal', tint: '#FFC93C', label: t.profile, onPress: onProfile },
        { key: 'city', icon: 'map', tint: '#7ED957', label: t.city, onPress: openCity },
        ...(pwa.installMode !== 'none' ? [{ key: 'install', icon: 'phone', tint: '#FF7A3D', label: t.install, onPress: () => void pwa.promptInstall().then((r) => r === 'ios' && setIosHelp(true)) }] : []),
        ...(onTutorial ? [{ key: 'tutorial', icon: 'scroll', tint: '#3FC1F0', label: t.tutorial, onPress: onTutorial }] : []),
      ],
    },
    {
      title: t.groups.account,
      tint: colors.candy.pink,
      rows: [
        { key: 'about', icon: 'lantern', tint: '#C9A3FF', label: t.about, onPress: () => setAboutOpen((v) => !v) },
        ...(baleOn ? [{ key: 'bale', icon: 'bolt', tint: '#FF7A3D', label: fa.bale.row, onPress: () => setBaleOpen(true) }] : []),
        { key: 'phoneLogin', icon: 'phone', tint: '#7ED957', label: fa.phoneLogin.row, onPress: () => setLoginOpen(true) },
        ...(ageTracksOn ? [{ key: 'children', icon: 'medal', tint: '#FFAA7A', label: fa.guardian.childrenRow, onPress: () => setChildrenOpen(true) }, { key: 'childLogin', icon: 'key', tint: '#C9A3FF', label: fa.guardian.childLoginRow, onPress: () => setChildCodeOpen(true) }] : []),
        { key: 'out', icon: 'key', tint: '#FFAA7A', label: t.signOut, onPress: () => setAskOut(true) },
        { key: 'del', icon: 'lock', tint: '#FF4D8D', label: t.delete, tone: '#B3261E', onPress: () => setAskDelete(true) },
      ],
    },
  ];

  return (
    <View style={[styles.root, dark ? dk.root : null]}>
      <View style={styles.scene} pointerEvents="none"><Scene scene="hojre" /></View>
      <View style={styles.page}>
        <View style={[styles.column, compact ? styles.columnTight : null]}>
          <View style={styles.head}>
            <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose}>
              {({ pressed }) => (
                <View style={[styles.back, pressed ? styles.pressed : null]}>
                  <GradientFill from="#C9A3FF" to="#A66BF0" />
                  <Icon name="back" size={22} color="#fff" strokeWidth={3} />
                </View>
              )}
            </Pressable>
            <View style={styles.plate}>
              <GradientFill from="#8FDCFA" to="#3FC1F0" />
              <Text style={styles.plateText}>{t.title}</Text>
            </View>
            <View style={styles.mashti} accessibilityLabel={t.mashti}><Character who="mashti" pose="pointing" crop="face" /></View>
          </View>

          {groups.map((g) => (
            <View key={g.title} style={[styles.group, dark ? dk.group : null]}>
              <View style={[styles.groupHead, { backgroundColor: g.tint }]}><Text style={styles.groupTitle}>{g.title}</Text></View>
              {g.rows.map((r) => (
                <Pressable key={r.key} onPress={r.onPress} accessibilityRole={r.toggle === undefined ? 'button' : 'switch'} accessibilityState={r.toggle === undefined ? undefined : { checked: r.toggle }} style={[styles.row, dark ? dk.row : null, compact ? styles.rowTight : null]}>
                  <View style={[styles.tile, { backgroundColor: r.tint }]}><View style={styles.tileIcon}><Item icon={r.icon} /></View></View>
                  <Text style={[styles.rowText, dark ? dk.text : null, r.tone ? { color: dark ? '#F08A80' : r.tone } : null]}>{r.label}</Text>
                  {r.toggle !== undefined ? (
                    <View style={[styles.track, dark ? dk.track : null, { backgroundColor: r.toggle ? (dark ? '#E8B64A' : '#7ED957') : (dark ? '#0E0A08' : '#D9C7A6') }]}>
                      <View style={[styles.knob, r.toggle ? styles.knobOn : null]} />
                    </View>
                  ) : null}
                </Pressable>
              ))}
              {g.title === t.groups.game && prefs.music ? (
                <View style={[styles.volume, dark ? dk.row : null]}>
                  <Text style={[styles.volumeLabel, dark ? dk.text : null]}>{fa.prefs.musicVolume}</Text>
                  <View style={styles.volumeSteps}>
                    {MUSIC_VOLUMES.map((v, i) => (
                      <Pressable key={v} onPress={() => setPref('musicVolume', v)} accessibilityRole="button" accessibilityState={{ selected: prefs.musicVolume === v }} style={[styles.step, dark ? dk.step : null, prefs.musicVolume === v ? styles.stepOn : null]}>
                        <Text style={[styles.stepText, dark && prefs.musicVolume !== v ? dk.text : null]}>{fa.prefs.musicVolumes[i]}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {g.title === t.groups.account && aboutOpen ? <Text style={[styles.about, dark ? dk.text : null]}>{fa.account.aboutText}</Text> : null}
              {g.title === t.groups.account && note ? <Text style={[styles.about, dark ? dk.text : null]}>{note}</Text> : null}
            </View>
          ))}
        </View>
      </View>
      {askOut ? (
        <ConfirmDialog
          title={fa.account.signOutAsk.title}
          message={fa.account.signOutAsk.message}
          confirmLabel={fa.account.signOutAsk.confirm}
          cancelLabel={fa.account.signOutAsk.cancel}
          onCancel={() => setAskOut(false)}
          onConfirm={() => void signOutEverywhere().then(() => (setAskOut(false), setNote(fa.account.signOutDone), onAccountGone?.()), () => (setAskOut(false), setNote(fa.account.failed)))}
        />
      ) : null}
      {askDelete ? <DeleteAccountDialog onCancel={() => setAskDelete(false)} onDeleted={() => (setAskDelete(false), setNote(fa.account.deleteDone), onAccountGone?.())} /> : null}
      {loginOpen ? <PhoneLoginSheet onClose={() => setLoginOpen(false)} /> : null}
      {childrenOpen ? <ChildrenSheet onClose={() => setChildrenOpen(false)} onPreview={onPreview ? (t) => (setChildrenOpen(false), onPreview(t)) : undefined} /> : null}
      {childCodeOpen ? <ChildCodeSheet onClose={() => setChildCodeOpen(false)} /> : null}
      {baleOpen ? <BaleSheet onClose={() => setBaleOpen(false)} /> : null}
      {iosHelp ? <IosInstallSheet onClose={() => setIosHelp(false)} /> : null}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

/** Overrides for the adult look: dark panels with gold frames and cream-gold text. */
const dk = StyleSheet.create({
  root: { backgroundColor: DARK.field },
  group: { backgroundColor: DARK.panel, borderColor: DARK.frame },
  row: { borderColor: DARK.line },
  text: { color: DARK.text, opacity: 1 },
  track: { borderColor: DARK.frame },
  step: { backgroundColor: DARK.raised, borderColor: DARK.frame },
});

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#D99A52' },
  scene: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.9 },
  page: { flex: 1, paddingBottom: 12 },
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: pageTop(), gap: 8 },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 24, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, ...FACE_TEXT },
  spacer: { width: 42 },
  mashti: { width: 42, height: 46 },
  columnTight: { paddingTop: safeTop(12), gap: 6 },
  rowTight: { minHeight: 36, paddingVertical: 1 },
  group: { borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, overflow: 'hidden', ...lift(5) },
  groupHead: { paddingVertical: 6, paddingHorizontal: 14, borderBottomWidth: 3, borderColor: colors.ink },
  groupTitle: { fontFamily: fonts.display, fontSize: 16, color: '#fff', textAlign: TEXT_RIGHT, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1, ...FACE_TEXT },
  row: { minHeight: 46, flexDirection: ROW, alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 4, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(43,18,64,0.2)' },
  tile: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { width: 22, height: 22 },
  rowText: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21, color: colors.ink, textAlign: TEXT_RIGHT },
  track: { width: 52, height: 30, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, justifyContent: 'center', paddingHorizontal: 2 },
  knob: { width: 21, height: 21, borderRadius: 11, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream, alignSelf: 'flex-start' },
  knobOn: { alignSelf: 'flex-end' },
  volume: { gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(43,18,64,0.2)' },
  volumeLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, textAlign: TEXT_RIGHT },
  volumeSteps: { flexDirection: ROW, gap: 6 },
  step: { flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cream },
  stepOn: { backgroundColor: '#FFC93C' },
  stepText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  about: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 19, color: colors.ink, opacity: 0.8, textAlign: TEXT_RIGHT, padding: 12 },
});
