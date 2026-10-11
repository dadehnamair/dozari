import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CHAT_MODES, FRIEND_APPROVALS, GUARDIAN_REMINDER_CHOICES, toPersianDigits } from '@dozari/shared';
import type { ChildDigest, ChildRow, GuardianSettings } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import type { IconName } from '../theme/icons';
import { useConfirm } from '../components/useConfirm';
import { HubTile } from '../home/HubTile';
import { avatarOf } from '../social/avatarOf';
import { fa } from '../i18n/fa';
import { SheetClose } from '../components/SheetClose';
import { ApiError } from '../net/http';
import { useHardwareBack } from '../nav/useHardwareBack';
import { colors, fonts } from '../theme/colors';
import { approveChildFriend, blockChildFriend, childLinkCode, fetchChildBlocks, fetchChildDigest, fetchChildFriends, fetchChildSettings, removeChildFriend, saveChildSettings, setChildTrack, unblockChildFriend } from './guardianApi';
import { RemoveChildDialog } from './RemoveChildDialog';
import type { ChildFriend } from './guardianApi';
import { QUIET_HOURS, minutesToHour, sameSettings, withQuietHours } from './guardianPanel';

const INK = '#3A2418';
const p = fa.guardian.panel;
const g = fa.guardian;
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const TRACK_COLOR: Record<string, string> = { kid: colors.candy.orange, teen: colors.candy.grape };
const errorOf = (e: unknown): string => g.errors[e instanceof ApiError ? e.code : 'generic'] ?? p.failed;

/** Icon choices: each option is a tile with a picture and a short label, so the choice reads at a glance. */
function IconPills<T extends string>({ options, value, onPick }: { options: readonly { key: T; icon: IconName; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onPick(o.key)} accessibilityRole="button" accessibilityState={{ selected: o.key === value }} accessibilityLabel={o.label} style={[styles.iconPill, o.key === value ? styles.iconPillOn : null]}>
          <Icon name={o.icon} size={24} color={INK} strokeWidth={2.6} />
          <Text style={styles.iconPillText} numberOfLines={2}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Pills<T extends string | number>({ options, value, label, onPick }: { options: readonly T[]; value: T; label: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Pressable key={String(o)} onPress={() => onPick(o)} accessibilityRole="button" accessibilityState={{ selected: o === value }} style={[styles.pill, o === value ? styles.pillOn : null]}>
          <Text style={styles.pillText}>{label(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * One child's guardian panel (docs/logic/age-tracks.md §Guardian panel): plain switches that only ever narrow what the child can do, the friends and the
 * requests waiting for a yes, and the digest «امروز چه یاد گرفت». Each switch saves at once.
 */
export function ChildPanelSheet({ child, onClose, onPreview, onRemoved }: { child: ChildRow; onClose: () => void; onPreview?: (track: 'kid' | 'teen') => void; onRemoved?: () => void }) {
  useHardwareBack(onClose);
  const { ask, dialog } = useConfirm();
  const [code, setCode] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [s, setS] = useState<GuardianSettings | null>(null);
  const [digest, setDigest] = useState<ChildDigest | null>(null);
  const [friends, setFriends] = useState<{ friends: ChildFriend[]; requests: ChildFriend[] } | null>(null);
  const [blocked, setBlocked] = useState<ChildFriend[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const reloadFriends = useCallback(() => {
    void fetchChildFriends(child.id).then(setFriends, () => undefined);
    void fetchChildBlocks(child.id).then(setBlocked, () => undefined);
  }, [child.id]);
  useEffect(() => {
    void fetchChildSettings(child.id).then(setS, () => setNote(p.failed));
    void fetchChildDigest(child.id).then(setDigest, () => undefined);
    reloadFriends();
  }, [child.id, reloadFriends]);

  const apply = (next: GuardianSettings) => {
    if (!s || sameSettings(s, next)) return;
    const before = s;
    setS(next);
    saveChildSettings(child.id, next).then(() => setNote(null), () => (setS(before), setNote(p.failed)));
  };
  /** Narrowing a switch applies at once; widening what the child may do (text chat, duels, automatic friends) asks first. */
  const change = (next: GuardianSettings) => {
    if (!s || sameSettings(s, next)) return;
    const widen = (next.chatMode === 'friends_text' && s.chatMode !== 'friends_text' ? g.confirms.chatOpen : null) ?? (next.duelsEnabled && !s.duelsEnabled ? g.confirms.duelsOn : null);
    if (!widen) return apply(next);
    ask({ title: widen.title, message: widen.message, confirmLabel: widen.yes, danger: false, onConfirm: () => apply(next) });
  };
  const sure = (c: { title: string; message: string; yes: string }, run: () => void, danger = true) => ask({ title: c.title, message: c.message, confirmLabel: c.yes, danger, onConfirm: run });
  const other = child.track === 'kid' ? 'teen' : 'kid';
  const act = (job: Promise<void>) => job.then(reloadFriends, () => setNote(p.failed));
  const quietFrom = s?.quietFrom === null || s?.quietFrom === undefined ? null : minutesToHour(s.quietFrom);
  const quietTo = s?.quietTo === null || s?.quietTo === undefined ? null : minutesToHour(s.quietTo);
  const hours = (h: number) => toPersianDigits(String(h));

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={p.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <SheetClose onPress={onClose} label={p.close} />
        <View style={styles.head}>
          <Avatar avatar={avatarOf(child.avatarKey)} size={60} />
          <View style={styles.headBody}>
            <Text style={styles.title} numberOfLines={1}>{child.nickname}</Text>
            <View style={[styles.chip, { backgroundColor: TRACK_COLOR[child.track] ?? colors.candy.sky }]}><Text style={styles.chipText}>{g.trackChip[child.track] ?? ''}</Text></View>
          </View>
        </View>

        <View style={styles.actions}>
          <HubTile onLight icon="lock" label={g.actions.code} color={colors.candy.lime} onPress={() => sure(g.confirms.code(child.nickname), () => void childLinkCode(child.id).then((r) => setCode(r.code), (e) => setNote(errorOf(e))), false)} />
          <HubTile onLight icon="refresh" label={g.actions.move} color={colors.candy.sky} onPress={() => sure(g.confirms.move(child.nickname, g.trackChip[other] ?? ''), () => void setChildTrack(child.id, other).then(() => onClose(), (e) => setNote(errorOf(e))), false)} />
          {onPreview ? <HubTile onLight icon="eye" label={g.actions.preview} color={colors.candy.grape} onPress={() => onPreview(child.track === 'kid' ? 'kid' : 'teen')} /> : null}
          <HubTile onLight icon="trash" label={g.actions.remove} color={colors.candy.pink} onPress={() => setRemoving(true)} />
        </View>
        {code ? <Text style={styles.code}>{g.codeIs(toPersianDigits(code))}</Text> : null}

        <ScrollView contentContainerStyle={styles.content}>
          {s === null ? <ActivityIndicator color={INK} /> : null}

          {digest ? (
            <View style={styles.card}>
              <Text style={styles.section}>{p.digestTitle}</Text>
              <Text style={styles.text}>{p.digestWords(toPersianDigits(String(digest.wordsWeek)), toPersianDigits(String(digest.wordsTotal)))}</Text>
              {digest.recentWords.length > 0 ? <Text style={styles.text}>{digest.recentWords.join('، ')}</Text> : null}
              <Text style={styles.text}>{p.digestGames(toPersianDigits(String(digest.gamesWeek)), toPersianDigits(String(digest.winsWeek)), toPersianDigits(String(digest.daysPlayedWeek)))}</Text>
              {digest.minutesWeek > 0 ? <Text style={styles.text}>{p.digestMinutes(toPersianDigits(String(digest.minutesWeek)))}</Text> : null}
              <Text style={styles.text}>{p.digestLevel(toPersianDigits(String(digest.level)), toPersianDigits(String(digest.friends)))}</Text>
            </View>
          ) : null}

          {s ? (
            <>
              <Text style={styles.section}>{p.chat}</Text>
              <IconPills
                options={CHAT_MODES.map((m) => ({ key: m, icon: (m === 'friends_text' ? 'chat' : m === 'phrases' ? 'star' : 'mute') as IconName, label: p.chatModes[m] ?? m }))}
                value={s.chatMode}
                onPick={(chatMode) => change({ ...s, chatMode })}
              />

              <Text style={styles.section}>{p.friends}</Text>
              <IconPills options={FRIEND_APPROVALS.map((m) => ({ key: m, icon: (m === 'ask' ? 'lock' : 'check') as IconName, label: p.friendModes[m] ?? m }))} value={s.friendApproval} onPick={(friendApproval) => change({ ...s, friendApproval })} />

              <Text style={styles.section}>{p.duels}</Text>
              <IconPills
                options={[{ key: 'on', icon: 'swords', label: p.on }, { key: 'off', icon: 'lock', label: p.off }] as const}
                value={s.duelsEnabled ? 'on' : 'off'}
                onPick={(v) => change({ ...s, duelsEnabled: v === 'on' })}
              />

              <Text style={styles.section}>{p.quiet}</Text>
              <Text style={styles.text}>{quietFrom === null || quietTo === null ? p.quietNone : p.quietWindow(hours(quietFrom), hours(quietTo))}</Text>
              <Text style={styles.hint}>{p.quietFrom}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pills options={QUIET_HOURS} value={quietFrom ?? -1} label={hours} onPick={(h) => change(withQuietHours(s, h, quietTo ?? (h + 8) % 24))} />
              </ScrollView>
              <Text style={styles.hint}>{p.quietTo}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pills options={QUIET_HOURS} value={quietTo ?? -1} label={hours} onPick={(h) => change(withQuietHours(s, quietFrom ?? (h + 16) % 24, h))} />
              </ScrollView>
              {quietFrom !== null ? (
                <Pressable onPress={() => sure(g.confirms.quietClear, () => change(withQuietHours(s, null, null)))} accessibilityRole="button" style={styles.linkBtn}><Icon name="close" size={16} color={INK} strokeWidth={3} /><Text style={styles.linkText}>{p.quietClear}</Text></Pressable>
              ) : null}

              <Text style={styles.section}>{p.reminder}</Text>
              <Pills options={[0, ...GUARDIAN_REMINDER_CHOICES]} value={s.reminderMinutes ?? 0} label={(m) => (m === 0 ? p.off : p.minutes(toPersianDigits(String(m))))} onPick={(m) => change({ ...s, reminderMinutes: m === 0 ? null : m })} />
            </>
          ) : null}

          {friends && friends.requests.length > 0 ? (
            <>
              <Text style={styles.section}>{p.requests}</Text>
              {friends.requests.map((f) => (
                <View key={f.id} style={styles.friend}>
                  <Text style={styles.name} numberOfLines={1}>{f.nickname}</Text>
                  <IconBtn icon="check" label={p.approve} color={colors.candy.lime} onPress={() => void act(approveChildFriend(child.id, f.id))} />
                  <IconBtn icon="close" label={p.decline} color={colors.candy.pink} onPress={() => sure(g.confirms.decline(f.nickname), () => void act(removeChildFriend(child.id, f.id)))} />
                </View>
              ))}
            </>
          ) : null}
          {friends && friends.friends.length > 0 ? (
            <>
              <Text style={styles.section}>{p.friendList}</Text>
              {friends.friends.map((f) => (
                <View key={f.id} style={styles.friend}>
                  <Text style={styles.name} numberOfLines={1}>{f.nickname}</Text>
                  <IconBtn icon="trash" label={p.removeFriend} color={colors.candy.pink} onPress={() => sure(g.confirms.removeFriend(f.nickname), () => void act(removeChildFriend(child.id, f.id)))} />
                  <IconBtn icon="flag" label={p.block} color={colors.candy.grape} onPress={() => sure(g.confirms.block(f.nickname), () => void act(blockChildFriend(child.id, f.id)))} />
                </View>
              ))}
            </>
          ) : null}
          {blocked.length > 0 ? (
            <>
              <Text style={styles.section}>{p.blockedList}</Text>
              {blocked.map((f) => (
                <View key={f.id} style={styles.friend}>
                  <Text style={styles.name} numberOfLines={1}>{f.nickname}</Text>
                  <IconBtn icon="refresh" label={p.unblock} color={colors.candy.sky} onPress={() => sure(g.confirms.unblock(f.nickname), () => void act(unblockChildFriend(child.id, f.id)), false)} />
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
        {note ? <Text style={styles.bad}>{note}</Text> : null}
      </Pressable>
      {removing ? <RemoveChildDialog child={child} onClose={() => setRemoving(false)} onRemoved={() => (setRemoving(false), onRemoved?.())} /> : null}
      {dialog}
    </Pressable>
  );
}

/** A small round icon button with its name under it (approve, remove, block…). */
function IconBtn({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.iconBtnWrap}>
      {({ pressed }) => (
        <>
          <View style={[styles.iconBtn, { backgroundColor: color }, pressed ? styles.pressed : null]}><Icon name={icon} size={18} color="#fff" strokeWidth={3} /></View>
          <Text style={styles.iconBtnText} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 32, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 400, maxHeight: '92%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 14, gap: 8 },
  head: { flexDirection: ROW, alignItems: 'center', gap: 12 },
  headBody: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  chip: { paddingHorizontal: 10, paddingVertical: 1, borderRadius: 99, borderWidth: 2, borderColor: INK },
  chipText: { fontFamily: fonts.bold, fontSize: 11.5, color: '#fff', textShadowColor: INK, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  actions: { flexDirection: ROW, justifyContent: 'space-around', paddingVertical: 4 },
  code: { fontFamily: fonts.display, fontSize: 17, color: '#6634B0', textAlign: 'center' },
  content: { gap: 8, paddingBottom: 6 },
  card: { gap: 4, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: INK, backgroundColor: colors.card },
  section: { fontFamily: fonts.display, fontSize: 17, color: INK, textAlign: 'right', marginTop: 4 },
  text: { fontFamily: fonts.bold, fontSize: 13.5, color: INK, textAlign: 'right' },
  hint: { fontFamily: fonts.body, fontSize: 12, color: '#5B4A70', textAlign: 'right' },
  bad: { fontFamily: fonts.bold, fontSize: 13.5, color: '#B3261E', textAlign: 'center' },
  row: { flexDirection: ROW, gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.card },
  pillOn: { backgroundColor: colors.candy.lime },
  pillText: { fontFamily: fonts.bold, fontSize: 13.5, color: INK },
  iconPill: { flex: 1, minWidth: 92, minHeight: 74, paddingHorizontal: 6, paddingVertical: 8, borderRadius: 16, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconPillOn: { backgroundColor: colors.candy.lime },
  iconPillText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 17, color: INK, textAlign: 'center' },
  linkBtn: { flexDirection: ROW, alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { fontFamily: fonts.bold, fontSize: 13, color: INK },
  friend: { flexDirection: ROW, alignItems: 'center', gap: 8, padding: 8, borderRadius: 14, borderWidth: 2, borderColor: INK, backgroundColor: colors.card },
  name: { flex: 1, minWidth: 0, fontFamily: fonts.display, fontSize: 16, color: INK, textAlign: 'right' },
  iconBtnWrap: { alignItems: 'center', gap: 2, minWidth: 48 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 2.5, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontFamily: fonts.bold, fontSize: 10.5, color: INK },
  pressed: { transform: [{ translateY: 2 }] },
});
