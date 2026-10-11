import { toPersianDigits } from '@dozari/shared';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { colors, fonts } from '../theme/colors';
import { deleteMyAccount, requestDeleteCode } from './api';

const codeOf = (e: unknown): string => (e instanceof ApiError ? e.code : 'generic');

/** Deleting the account: a warning first, then a fresh one-time code sent to the verified phone / Bale, then the final delete. */
export function DeleteAccountDialog({ onDeleted, onCancel }: { onDeleted: () => void; onCancel: () => void }) {
  const t = fa.account.del;
  const [step, setStep] = useState<'warn' | 'code'>('warn');
  const [channel, setChannel] = useState<'sms' | 'bale'>('sms');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setBusy(true);
    setError(null);
    requestDeleteCode().then(
      (r) => (setChannel(r.channel), setStep('code'), setBusy(false)),
      (e) => (setError(t.errors[codeOf(e)] ?? t.errors.generic ?? ''), setBusy(false)),
    );
  };
  const remove = () => {
    setBusy(true);
    setError(null);
    deleteMyAccount(code.trim()).then(
      () => onDeleted(),
      (e) => (setError(t.errors[codeOf(e)] ?? t.errors.generic ?? ''), setBusy(false)),
    );
  };

  if (step === 'warn') {
    return <ConfirmDialog danger busy={busy} title={t.title} message={t.warn} error={error} confirmLabel={t.sendCode} cancelLabel={t.cancel} onConfirm={send} onCancel={onCancel} />;
  }
  return (
    <ConfirmDialog danger busy={busy || code.trim().length < 4} title={t.codeTitle} message={channel === 'sms' ? t.sentSms : t.sentBale} error={error} confirmLabel={t.confirm} cancelLabel={t.cancel} onConfirm={remove} onCancel={onCancel}>
      <TextInput value={toPersianDigits(code)} onChangeText={setCode} keyboardType="number-pad" maxLength={8} autoFocus style={styles.input} accessibilityLabel={t.codeTitle} />
    </ConfirmDialog>
  );
}

const styles = StyleSheet.create({
  input: { alignSelf: 'center', width: 180, fontFamily: fonts.display, fontSize: 24, letterSpacing: 6, color: colors.ink, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, paddingVertical: 6, backgroundColor: colors.card, textAlign: 'center', writingDirection: 'ltr' },
});
