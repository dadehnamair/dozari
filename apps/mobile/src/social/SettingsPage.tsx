import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { Scene } from '../components/Scene';
import { fa } from '../i18n/fa';
import { deleteMyAccount, signOutEverywhere } from '../account/api';
import { setPref, usePrefs } from '../prefs/store';
import { IosInstallSheet } from '../pwa/PwaLayer';
import { usePwa } from '../pwa/usePwa';
import { playSfx } from '../sound/engine';
import { colors, fonts } from '../theme/colors';
import { CityPicker } from './CityPicker';
import { fetchMyProfile } from './api';
import type { City } from '@dozari/shared';

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
export function SettingsPage({ onClose, onProfile, onTutorial, onAccountGone }: { onClose: () => void; onProfile: () => void; onTutorial?: () => void; onAccountGone?: () => void }) {
  const prefs = usePrefs();
  const pwa = usePwa();
  const [iosHelp, setIosHelp] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [city, setCity] = useState<City | null | undefined>(undefined);
  const [sure, setSure] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const t = fa.settings;

  if (cityOpen) return <CityPicker current={city ?? null} onPicked={(c) => (setCity(c), setCityOpen(false))} onClose={() => setCityOpen(false)} />;
  const openCity = () => void fetchMyProfile().then((p) => (setCity(p.city), setCityOpen(true)), () => setNote(fa.account.failed));
  const toggle = (k: 'sound' | 'vibration' | 'reduceMotion') => () => {
    setPref(k, !prefs[k]);
    if (k === 'sound' && !prefs.sound) setTimeout(() => playSfx('coin'), 0);
  };

  const groups: { title: string; tint: string; rows: Row[] }[] = [
    {
      title: t.groups.game,
      tint: colors.candy.sky,
      rows: [
        { key: 'sound', icon: 'radio', tint: '#3FC1F0', label: fa.prefs.sound, toggle: prefs.sound, onPress: toggle('sound') },
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
        { key: 'out', icon: 'key', tint: '#FFAA7A', label: t.signOut, onPress: () => void signOutEverywhere().then(() => (setNote(fa.account.signOutDone), onAccountGone?.()), () => setNote(fa.account.failed)) },
        { key: 'del', icon: 'lock', tint: '#FF4D8D', label: t.delete, tone: '#B3261E', onPress: () => (sure ? void deleteMyAccount().then(() => (setNote(fa.account.deleteDone), onAccountGone?.()), () => setNote(fa.account.failed)) : setSure(true)) },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.scene} pointerEvents="none"><Scene scene="hojre" /></View>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.column}>
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
            <View style={styles.spacer} />
          </View>

          <View style={styles.talk}>
            <View style={styles.mashti}><Character who="mashti" pose="pointing" /></View>
            <View style={styles.bubble}><Text style={styles.bubbleText}>{t.mashti}</Text></View>
          </View>

          {groups.map((g) => (
            <View key={g.title} style={styles.group}>
              <View style={[styles.groupHead, { backgroundColor: g.tint }]}><Text style={styles.groupTitle}>{g.title}</Text></View>
              {g.rows.map((r) => (
                <Pressable key={r.key} onPress={r.onPress} accessibilityRole={r.toggle === undefined ? 'button' : 'switch'} accessibilityState={r.toggle === undefined ? undefined : { checked: r.toggle }} style={styles.row}>
                  <View style={[styles.tile, { backgroundColor: r.tint }]}><View style={styles.tileIcon}><Item icon={r.icon} /></View></View>
                  <Text style={[styles.rowText, r.tone ? { color: r.tone } : null]}>{r.key === 'del' && sure ? fa.account.deleteSure : r.label}</Text>
                  {r.toggle !== undefined ? (
                    <View style={[styles.track, { backgroundColor: r.toggle ? '#7ED957' : '#D9C7A6' }]}>
                      <View style={[styles.knob, r.toggle ? styles.knobOn : null]} />
                    </View>
                  ) : null}
                </Pressable>
              ))}
              {g.title === t.groups.account && aboutOpen ? <Text style={styles.about}>{fa.account.aboutText}</Text> : null}
              {g.title === t.groups.account && note ? <Text style={styles.about}>{note}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>
      {iosHelp ? <IosInstallSheet onClose={() => setIosHelp(false)} /> : null}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#D99A52' },
  scene: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.9 },
  page: { paddingBottom: 30 },
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 30, gap: 10 },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 24, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  spacer: { width: 42 },
  talk: { flexDirection: ROW, alignItems: 'flex-end', gap: 4 },
  mashti: { width: 92, height: 106 },
  bubble: { flex: 1, marginBottom: 30, padding: 10, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFF6E8', ...lift(4) },
  bubbleText: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 20, color: colors.ink, textAlign: 'right' },
  group: { borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FBF1DE', overflow: 'hidden', ...lift(5) },
  groupHead: { paddingVertical: 6, paddingHorizontal: 14, borderBottomWidth: 3, borderColor: colors.ink },
  groupTitle: { fontFamily: fonts.display, fontSize: 16, color: '#fff', textAlign: 'right', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  row: { minHeight: 46, flexDirection: ROW, alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 4, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(43,18,64,0.2)' },
  tile: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { width: 22, height: 22 },
  rowText: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 21, color: colors.ink, textAlign: 'right' },
  track: { width: 52, height: 30, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, justifyContent: 'center', paddingHorizontal: 2 },
  knob: { width: 21, height: 21, borderRadius: 11, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FFF6E8', alignSelf: 'flex-start' },
  knobOn: { alignSelf: 'flex-end' },
  about: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 19, color: colors.ink, opacity: 0.8, textAlign: 'right', padding: 12 },
});
