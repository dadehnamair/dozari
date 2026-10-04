import { PRODUCT_CATEGORIES, groupTypedNumber } from '@dozari/shared';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { Chips, FormDialog, formStyles as s } from './FormDialog';
import { submitSuggestion } from './api';
import { buildSubmission } from './suggestInput';

const t = fa.feedback;
const codeOf = (e: unknown): string => (e instanceof ApiError ? e.code : 'generic');
const CATEGORIES = PRODUCT_CATEGORIES.map((c) => [c, fa.lookup.categories[c] ?? c] as const);

/**
 * One form for the three suggestions: a new item, a price for an item, or «this price is wrong».
 * With `product` (opened from a price on screen) the player chooses between «wrong» and «my price»; without, it is a new item.
 */
export function SuggestDialog({ product, onClose }: { product?: { id: string; nameFa: string; year?: number }; onClose: () => void }) {
  const [mode, setMode] = useState<'price_report' | 'price_point'>('price_report');
  const kind = product ? mode : 'item';
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [year, setYear] = useState(product?.year ? groupTypedNumber(String(product.year)).replace(/٬/g, '') : '');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<'toman' | 'rial'>('toman');
  const [source, setSource] = useState<'user_memory' | 'website'>('user_memory');
  const [sourceText, setSourceText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const body = buildSubmission({ kind, productId: product?.id, nameFa: name, category, year, price, unit, source, sourceText, note });
  const send = () => {
    if (busy) return;
    if (!body) return setError(t.form.invalid);
    setBusy(true);
    setError(null);
    submitSuggestion(body).then(
      () => (setDone(true), setBusy(false)),
      (e) => (setError(t.form.errors[codeOf(e)] ?? t.form.errors.generic ?? ''), setBusy(false)),
    );
  };

  const title = product ? `${t.price.title}: ${product.nameFa}` : t.form.itemTitle;
  return (
    <FormDialog title={title} onClose={onClose}>
      {done ? (
        <>
          <Text style={s.ok}>{t.form.done}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, s.go]}><Text style={s.btnText}>{t.close}</Text></Pressable>
        </>
      ) : (
        <>
          {product ? <Chips options={[['price_report', t.price.modeWrong], ['price_point', t.price.modeSuggest]] as const} value={mode} onPick={setMode} /> : null}
          {kind === 'item' ? (
            <>
              <Text style={s.label}>{t.form.name}</Text>
              <TextInput value={name} onChangeText={setName} maxLength={80} style={s.input} accessibilityLabel={t.form.name} />
              <Text style={s.label}>{t.form.category}</Text>
              <Chips options={CATEGORIES} value={category} onPick={setCategory} />
            </>
          ) : null}
          {kind === 'price_report' ? (
            <>
              <Text style={s.label}>{t.price.wrongNote}</Text>
              <TextInput value={note} onChangeText={setNote} multiline maxLength={500} placeholder={t.price.wrongPlaceholder} placeholderTextColor="#9A8A7A" style={[s.input, s.multiline]} accessibilityLabel={t.price.wrongNote} />
            </>
          ) : null}
          {kind !== 'price_report' ? <Text style={s.label}>{t.form.year}</Text> : null}
          {kind !== 'price_report' ? <TextInput value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} style={s.input} accessibilityLabel={t.form.year} /> : null}
          <Text style={s.label}>{t.form.price}</Text>
          <TextInput value={groupTypedNumber(price)} onChangeText={(v) => setPrice(groupTypedNumber(v))} keyboardType="number-pad" style={s.input} accessibilityLabel={t.form.price} />
          <Chips options={[['toman', t.form.toman], ['rial', t.form.rial]] as const} value={unit} onPick={setUnit} />
          <Text style={s.label}>{t.form.source}</Text>
          <Chips options={[['user_memory', t.form.memory], ['website', t.form.link]] as const} value={source} onPick={setSource} />
          {source === 'website' ? <TextInput value={sourceText} onChangeText={setSourceText} maxLength={300} placeholder={t.form.sourceText} placeholderTextColor="#9A8A7A" autoCapitalize="none" style={s.input} accessibilityLabel={t.form.sourceText} /> : null}
          {kind !== 'price_report' ? (
            <>
              <Text style={s.label}>{t.form.note}</Text>
              <TextInput value={note} onChangeText={setNote} maxLength={500} style={s.input} accessibilityLabel={t.form.note} />
            </>
          ) : null}
          {error ? <Text style={s.error}>{error}</Text> : null}
          <View style={s.buttons}>
            <Pressable onPress={send} disabled={busy} accessibilityRole="button" style={[s.btn, s.go, busy ? s.off : null]}><Text style={s.btnText}>{t.form.send}</Text></Pressable>
            <Pressable onPress={onClose} accessibilityRole="button" style={[s.btn, s.cancel]}><Text style={s.btnText}>{t.cancel}</Text></Pressable>
          </View>
        </>
      )}
    </FormDialog>
  );
}

/** The small «قیمت اشتباهه؟» link next to a price on screen; opens the suggestion form for that product. */
export function PriceFeedbackLink({ product, color }: { product: { id: string; nameFa: string; year?: number }; color?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8}>
        <Text style={{ fontFamily: 'Vazirmatn_700Bold', fontSize: 12, color: color ?? '#8E7B6B', textDecorationLine: 'underline', textAlign: 'center' }}>{t.price.link}</Text>
      </Pressable>
      {open ? <SuggestDialog product={product} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
