import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BaleLinkCode, BaleLinkStatus } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { GuideBubble } from '../components/GuideBubble';
import { useConfirm } from '../components/useConfirm';
import { fa } from '../i18n/fa';
import { SheetClose } from '../components/SheetClose';
import { colors, fonts } from '../theme/colors';
import { ApiError } from '../net/http';
import { phoneErrorText } from '../phone/errors';
import { PhoneStep } from '../phone/PhoneStep';
import { fetchBaleLink, requestBaleCode, unlinkBale } from './api';
import { useTheme } from '../theme/themeStore';
import { useHardwareBack } from '../nav/useHardwareBack';

const INK = '#3A2418';

/** Bottom sheet of the Bale link: get a one-time code, send it to the bot, see "linked", unlink. */
export function BaleSheet({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [status, setStatus] = useState<BaleLinkStatus | null>(null);
  const [code, setCode] = useState<BaleLinkCode | null>(null);
  const adult = useTheme() === 'adult';
  const [failed, setFailed] = useState(false);
  /** Why the code could not be had, when the server said so (not set up, sign-in lost, too many tries). */
  const [why, setWhy] = useState<string | null>(null);
  const [phoneNote, setPhoneNote] = useState<string | null>(null);

  useEffect(() => {
    fetchBaleLink().then(setStatus, () => setFailed(true));
  }, []);

  const getCode = () =>
    requestBaleCode().then(
      (c) => (setCode(c), setFailed(false), setWhy(null), setPhoneNote(null)),
      (e) => {
        if (e instanceof ApiError && e.code === 'phone_required') return setPhoneNote(phoneErrorText('phone_required'));
        setWhy(e instanceof ApiError ? fa.bale.errors[e.code] ?? null : null);
        setFailed(true);
      },
    );
  const { ask, dialog } = useConfirm();
  const unlink = () =>
    unlinkBale().then(() => {
      setCode(null);
      setStatus((s) => (s ? { ...s, linked: false } : s));
    }, () => setFailed(true));

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.bale.close}>
      <Pressable style={[styles.sheet, adult ? styles.sheetAdult : null]} onPress={() => undefined}>
        <SheetClose onPress={onClose} label={fa.bale.close} />
        <Text style={[styles.title, adult ? styles.textAdult : null]}>{fa.bale.title}</Text>
        <GuideBubble who="mirza" text={fa.bale.intro} />
        <PhoneStep />
        {phoneNote ? <Text style={[styles.text, adult ? styles.textAdult : null]}>{phoneNote}</Text> : null}
        {failed ? <Text style={[styles.text, adult ? styles.textAdult : null]}>{why ?? fa.bale.error}</Text> : null}
        {status && !status.configured ? <Text style={[styles.text, adult ? styles.textAdult : null]}>{fa.bale.notConfigured}</Text> : null}
        {status?.linked ? (
          <>
            <Text style={[styles.text, adult ? styles.textAdult : null]}>{fa.bale.linked}</Text>
            <CandyButton label={fa.bale.unlink} color={colors.candy.pink} onPress={() => ask({ title: fa.confirm.unlinkBale.title, message: fa.confirm.unlinkBale.message, confirmLabel: fa.confirm.unlinkBale.yes, onConfirm: unlink })} />
          </>
        ) : null}
        {status?.configured && !status.linked ? (
          code ? (
            <View style={styles.codeBox}>
              <Text style={[styles.text, adult ? styles.textAdult : null]}>
                {fa.bale.sendTo}
                {code.botUsername ? ` (@${code.botUsername})` : ''}
              </Text>
              <Text selectable style={styles.code}>
                {code.code}
              </Text>
              {code.botUsername ? <CandyButton label={fa.bale.openBot} color={colors.candy.lime} onPress={() => void Linking.openURL(`https://ble.ir/${code.botUsername}?start=${code.code}`).catch(() => setFailed(true))} /> : null}
              <Text style={[styles.small, adult ? styles.textAdult : null]}>{fa.bale.expires}</Text>
            </View>
          ) : (
            <CandyButton label={fa.bale.getCode} color={colors.candy.lime} onPress={() => void getCode()} />
          )
        ) : null}
      </Pressable>
      {dialog}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 10, alignItems: 'center' },
  sheetAdult: { backgroundColor: '#17100C', borderColor: '#E8B64A' },
  textAdult: { color: '#FFE9A8' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK, textAlign: 'center' },
  small: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.7 },
  codeBox: { alignItems: 'center', gap: 6 },
  code: { fontFamily: fonts.display, fontSize: 36, letterSpacing: 4, color: INK, backgroundColor: '#FFC93C', borderWidth: 3, borderColor: INK, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, overflow: 'hidden' },
});
