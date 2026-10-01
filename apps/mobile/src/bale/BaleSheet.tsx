import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BaleLinkCode, BaleLinkStatus } from '@dozari/shared';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchBaleLink, requestBaleCode, unlinkBale } from './api';

const INK = '#3A2418';

/** Bottom sheet of the Bale link: get a one-time code, send it to the bot, see "linked", unlink. */
export function BaleSheet({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<BaleLinkStatus | null>(null);
  const [code, setCode] = useState<BaleLinkCode | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchBaleLink().then(setStatus, () => setFailed(true));
  }, []);

  const getCode = () => requestBaleCode().then((c) => (setCode(c), setFailed(false)), () => setFailed(true));
  const unlink = () =>
    unlinkBale().then(() => {
      setCode(null);
      setStatus((s) => (s ? { ...s, linked: false } : s));
    }, () => setFailed(true));

  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.bale.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.bale.title}</Text>
        <Text style={styles.text}>{fa.bale.intro}</Text>
        {failed ? <Text style={styles.text}>{fa.bale.error}</Text> : null}
        {status && !status.configured ? <Text style={styles.text}>{fa.bale.notConfigured}</Text> : null}
        {status?.linked ? (
          <>
            <Text style={styles.text}>{fa.bale.linked}</Text>
            <CandyButton label={fa.bale.unlink} color={colors.candy.pink} onPress={unlink} />
          </>
        ) : null}
        {status?.configured && !status.linked ? (
          code ? (
            <View style={styles.codeBox}>
              <Text style={styles.text}>
                {fa.bale.sendTo}
                {code.botUsername ? ` (@${code.botUsername})` : ''}
              </Text>
              <Text selectable style={styles.code}>
                {code.code}
              </Text>
              <Text style={styles.small}>{fa.bale.expires}</Text>
            </View>
          ) : (
            <CandyButton label={fa.bale.getCode} color={colors.candy.lime} onPress={() => void getCode()} />
          )
        ) : null}
        <CandyButton label={fa.bale.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16, gap: 10, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK, textAlign: 'center' },
  small: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.7 },
  codeBox: { alignItems: 'center', gap: 6 },
  code: { fontFamily: fonts.display, fontSize: 36, letterSpacing: 4, color: INK, backgroundColor: '#FFC93C', borderWidth: 3, borderColor: INK, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, overflow: 'hidden' },
});
