import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ChildrenResponse } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { SheetClose } from '../components/SheetClose';
import { useConfirm } from '../components/useConfirm';
import { fa } from '../i18n/fa';
import { useHardwareBack } from '../nav/useHardwareBack';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { colors, fonts } from '../theme/colors';
import { ChildPanelSheet } from './ChildPanelSheet';
import { addChild, fetchChildren } from './guardianApi';

const INK = '#3A2418';
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const l = fa.guardian;
const textOf = (e: unknown): string => l.errors[e instanceof ApiError ? e.code : 'generic'] ?? l.errors.generic ?? '';
const TRACK_COLOR: Record<string, string> = { kid: colors.candy.orange, teen: colors.candy.grape };

/**
 * The guardian's page («فرزندان من»): the children as cards. Tap one to manage them (sign-in code, move, preview, settings, friends, removal);
 * adding a child asks for a confirm first.
 */
export function ChildrenSheet({ onClose, onPreview }: { onClose: () => void; /** Opens a read-only look at the kid or teen space for the guardian (nothing is saved). */ onPreview?: (track: 'kid' | 'teen') => void }) {
  useHardwareBack(onClose);
  const { ask, dialog } = useConfirm();
  const [data, setData] = useState<ChildrenResponse | 'failed' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const load = useCallback(() => void fetchChildren().then(setData, () => setData('failed')), []);
  useEffect(load, [load]);
  const ready = data && data !== 'failed' ? data : null;
  const panel = ready?.children.find((c) => c.id === panelId) ?? null;
  const add = (track: 'kid' | 'teen') => {
    const c = l.confirms.add(l.trackChip[track] ?? '');
    ask({ title: c.title, message: c.message, confirmLabel: c.yes, danger: false, onConfirm: () => void addChild(track).then(() => (setNote(null), load()), (e) => setNote(textOf(e))) });
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={l.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <SheetClose onPress={onClose} label={l.close} />
        <Text style={styles.title}>{l.childrenTitle}</Text>
        <Text style={styles.text}>{l.childrenIntro}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {data === null ? <ActivityIndicator color={INK} /> : null}
          {data === 'failed' ? <Text style={styles.bad}>{l.errors.generic}</Text> : null}
          {ready && !ready.phoneVerified ? <Text style={styles.text}>{l.needPhone}</Text> : null}
          {ready && ready.children.length === 0 && ready.phoneVerified ? <Text style={styles.text}>{l.empty}</Text> : null}
          {ready?.children.map((c) => (
            <Pressable key={c.id} onPress={() => setPanelId(c.id)} accessibilityRole="button" accessibilityLabel={`${c.nickname} · ${l.manage}`}>
              {({ pressed }) => (
                <View style={[styles.child, { borderColor: TRACK_COLOR[c.track] ?? INK }, pressed ? styles.pressed : null]}>
                  <Avatar avatar={avatarOf(c.avatarKey)} size={54} />
                  <View style={styles.childBody}>
                    <Text style={styles.name} numberOfLines={1}>{c.nickname}</Text>
                    <View style={[styles.chip, { backgroundColor: TRACK_COLOR[c.track] ?? colors.candy.sky }]}><Text style={styles.chipText}>{l.trackChip[c.track] ?? ''}</Text></View>
                    <Text style={styles.hint}>{l.manage}</Text>
                  </View>
                  <Icon name="back" size={22} color={INK} strokeWidth={3} />
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
        {note ? <Text style={styles.bad}>{note}</Text> : null}
        {ready && ready.phoneVerified && ready.children.length < ready.max ? (
          <View style={styles.addRow}>
            <AddTile label={l.addKid} color={colors.candy.orange} onPress={() => add('kid')} />
            <AddTile label={l.addTeen} color={colors.candy.grape} onPress={() => add('teen')} />
          </View>
        ) : null}
      </Pressable>
      {panel ? <ChildPanelSheet child={panel} onPreview={onPreview} onClose={() => (setPanelId(null), load())} onRemoved={() => (setPanelId(null), load())} /> : null}
      {dialog}
    </Pressable>
  );
}

function AddTile({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.addTile, { backgroundColor: color }, pressed ? styles.pressed : null]}>
      <View style={styles.plus}><Icon name="plus" size={20} color="#fff" strokeWidth={3.4} /></View>
      <Text style={styles.addText} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 380, maxHeight: '90%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK, textAlign: 'center' },
  text: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: INK, textAlign: 'center' },
  bad: { fontFamily: fonts.bold, fontSize: 13.5, color: '#B3261E', textAlign: 'center' },
  list: { flexGrow: 0 },
  listContent: { gap: 10 },
  child: { flexDirection: ROW, alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 3, backgroundColor: '#fff', shadowColor: INK, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  pressed: { transform: [{ translateY: 2 }] },
  childBody: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  name: { fontFamily: fonts.display, fontSize: 19, color: INK },
  chip: { paddingHorizontal: 10, paddingVertical: 1, borderRadius: 99, borderWidth: 2, borderColor: INK },
  chipText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#fff', textShadowColor: INK, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  hint: { fontFamily: fonts.body, fontSize: 11.5, color: '#5B4A70' },
  addRow: { flexDirection: ROW, gap: 10 },
  addTile: { flex: 1, minHeight: 64, borderRadius: 18, borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 6, shadowColor: INK, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  plus: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.22)', alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 19, color: '#fff', textAlign: 'center', textShadowColor: INK, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
});
