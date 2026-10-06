/** Admin panel view: the AI studio (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_AI_JS = String.raw`
var AI_ERR = {
  ai_not_configured: 'هیچ سرویس هوش مصنوعی تنظیم نشده؛ کلید API را در فایل env سرور بگذار (راهنما: docs/logic/ai-studio.md).',
  ai_unknown_provider: 'این سرویس روی سرور تنظیم نشده.',
  ai_rate_limited: 'سقف تولید در ساعت پر شده؛ کمی بعد دوباره امتحان کن.',
  ai_timeout: 'سرویس دیر جواب داد. دوباره امتحان کن یا مدل دیگری بگذار.',
  ai_unreachable: 'سرور به سرویس هوش مصنوعی نرسید (شبکه یا فیلتر).',
  ai_http_error: 'سرویس خطا داد (کلید، اعتبار یا نام مدل را بررسی کن).',
  ai_bad_output: 'جواب مدل قابل استفاده نبود. دوباره بزن یا توضیح را ساده‌تر کن.',
  ai_invalid_model: 'نام مدل درست نیست.',
  ai_not_found: 'موردی برای این کار پیدا نشد (مثلاً آیتم کودکِ بدون درس یا پازل).'
};
/* Persian reading of the provider's HTTP status, shown beside the provider's own message. */
var AI_STATUS_HINT = { 400: 'درخواست یا نام مدل پذیرفته نشد', 401: 'کلید API نامعتبر است', 402: 'اعتبار حساب تمام شده؛ شارژ کن', 403: 'دسترسی رد شد (کلید، سهمیه یا محدودیت منطقه)', 404: 'مدل یا آدرس سرویس پیدا نشد', 429: 'سقف درخواست یا اعتبار تمام شده', 500: 'خطای داخلی سرویس', 503: 'سرویس شلوغ است' };
function aiErrorText(b, fallback) {
  var t = AI_ERR[b && b.error] || fallback;
  if (b && b.providerStatus) t += ' — ' + (AI_STATUS_HINT[b.providerStatus] || 'کد ' + b.providerStatus) + ' (' + b.providerStatus + ')' + (b.providerMessage ? ': ' + b.providerMessage : '');
  return t;
}
var AI_KINDS = [['products', 'محصول'], ['kid_lessons', 'کلمه‌آموزی کودک'], ['puzzle_titles', 'عنوان گروه‌های پازل'], ['blog', 'مقاله‌ی بلاگ']];
/* Editable fields of one draft, per kind: [key, label, 'text' | 'area' | 'select', options]. */
function aiPricesText(list) { return (list || []).map(function (p) { return p.year + ': ' + p.priceToman; }).join('\n'); }
function aiParsePrices(text) {
  var out = [];
  text.split('\n').forEach(function (line) {
    var m = line.replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 1776); }).replace(/[,٬،\s]/g, '').match(/^(\d{4})[:=\-](\d+)$/);
    if (m) out.push({ year: +m[1], priceToman: +m[2] });
  });
  return out;
}
function aiFields(kind) {
  if (kind === 'products') return [['nameFa', 'نام', 'text'], ['slug', 'شناسه‌ی لاتین', 'text'], ['unitFa', 'واحد', 'text'], ['category', 'دسته', 'select', (S.meta && S.meta.categories) || []], ['storyFa', 'جمله‌ی نوستالژیک', 'area'], ['prices', 'قیمت‌ها (هر خط «سال: قیمت به تومان»)', 'area']];
  if (kind === 'kid_lessons') return [['wordFa', 'کلمه', 'text'], ['syllablesFa', 'هجاها', 'text'], ['storyFa', 'داستان کوتاه', 'area']];
  if (kind === 'puzzle_titles') return [['titleFa', 'عنوان', 'text']];
  return [['titleFa', 'عنوان', 'text'], ['summaryFa', 'خلاصه', 'area'], ['bodyMd', 'متن (مارک‌داون)', 'area'], ['metaTitle', 'عنوان سئو', 'text'], ['metaDescription', 'توضیح سئو', 'area']];
}
VIEWS.ai = function (root) {
  var info = null, result = null;
  var out = h('div');
  var kind = load('ai.kind') || 'products';
  var opts = h('div', { class: 'form-grid' });
  var provider = h('select'), model = h('input', { type: 'text', placeholder: 'خالی = مدل پیش‌فرض سرویس', style: 'direction:ltr', maxlength: 80 });
  var hint = h('textarea', { rows: 2, maxlength: 300, placeholder: 'توضیح اضافه (اختیاری): مثلاً «بیشتر لوازم مدرسه» یا «لحن شوخ‌تر»' });
  var go = h('button', { class: 'btn primary', text: 'تولید پیش‌نویس' });
  var ctl = {};
  function num(v, min, max) { return h('input', { type: 'number', value: v, min: min, max: max, style: 'width:100px' }); }
  function buildOptions() {
    clear(opts); ctl = {};
    if (kind === 'products') {
      ctl.count = num(8, 1, 20);
      ctl.category = select([['', 'هر دسته']].concat(((S.meta && S.meta.categories) || []).map(function (c) { return [c, c]; })), '');
      ctl.ageTrack = select([['adult', 'بزرگسال'], ['teen', 'نوجوان'], ['kid', 'کودک']], 'adult');
      ctl.fromYear = num('', 1300, 1450); ctl.toYear = num('', 1300, 1450);
      [['تعداد', ctl.count], ['دسته', ctl.category], ['رده‌ی سنی', ctl.ageTrack], ['از سال (شمسی)', ctl.fromYear], ['تا سال (شمسی)', ctl.toYear]].forEach(function (p) { opts.appendChild(field(p[0], p[1])); });
      opts.appendChild(h('div', { class: 'h', text: 'قیمت هرگز از هوش مصنوعی گرفته نمی‌شود؛ محصول‌ها غیرفعال ساخته می‌شوند تا خودت قیمت و تأیید را بزنی.' }));
    } else if (kind === 'kid_lessons') {
      ctl.count = num(10, 1, 20);
      opts.appendChild(field('تعداد آیتم', ctl.count, 'برای آیتم‌های رده‌ی کودکِ بدون درس'));
    } else if (kind === 'puzzle_titles') {
      ctl.puzzle = select([['', 'در حال بارگیری…']], ''); ctl.style = select([['witty', 'بامزه و شوخ'], ['plain', 'ساده و روشن']], 'witty');
      api('/admin/puzzles').then(function (r) {
        if (!r.ok) return;
        clear(ctl.puzzle);
        (r.body.puzzles || []).forEach(function (p) { ctl.puzzle.appendChild(h('option', { value: p.id, text: p.groups.map(function (g) { return g.items[0]; }).join('، ') + ' …' })); });
      });
      opts.appendChild(field('پازل', ctl.puzzle)); opts.appendChild(field('سبک', ctl.style));
    } else {
      ctl.topic = h('input', { type: 'text', maxlength: 300, placeholder: 'مثلاً قیمت نان در دهه‌ی ۶۰' });
      ctl.count = num(1, 1, 3);
      ctl.length = select([['short', 'کوتاه'], ['medium', 'متوسط'], ['long', 'بلند']], 'medium');
      ctl.tone = select([['friendly', 'صمیمی'], ['nostalgic', 'نوستالژیک'], ['informative', 'اطلاعاتی']], 'friendly');
      ctl.keywords = h('input', { type: 'text', placeholder: 'کلیدواژه‌ها با ویرگول جدا شوند' });
      [['موضوع', ctl.topic], ['تعداد مقاله', ctl.count], ['طول', ctl.length], ['لحن', ctl.tone], ['کلیدواژه', ctl.keywords]].forEach(function (p) { opts.appendChild(field(p[0], p[1])); });
    }
  }
  function request() {
    var body = { kind: kind, provider: provider.value, hint: hint.value.trim() || undefined, model: model.value.trim() || undefined };
    if (kind === 'products') { body.count = +ctl.count.value; if (ctl.category.value) body.category = ctl.category.value; body.ageTrack = ctl.ageTrack.value; if (ctl.fromYear.value) body.fromYear = +ctl.fromYear.value; if (ctl.toYear.value) body.toYear = +ctl.toYear.value; }
    else if (kind === 'kid_lessons') body.count = +ctl.count.value;
    else if (kind === 'puzzle_titles') { body.puzzleId = ctl.puzzle.value; body.style = ctl.style.value; }
    else { body.topic = ctl.topic.value.trim(); body.count = +ctl.count.value; body.length = ctl.length.value; body.tone = ctl.tone.value; body.keywords = ctl.keywords.value.split(/[,،]/).map(function (x) { return x.trim(); }).filter(Boolean); }
    return body;
  }
  function showDrafts() {
    clear(out);
    if (!result) return;
    var rows = result.drafts.map(function (d, i) {
      var use = h('input', { type: 'checkbox' }); use.checked = true;
      var inputs = {};
      var fields = aiFields(result.kind).map(function (f) {
        var key = f[0], cur = key === 'prices' ? aiPricesText(d.prices) : d[key];
        var el = f[2] === 'select' ? select(f[3], cur) : h(f[2] === 'area' ? 'textarea' : 'input', f[2] === 'area' ? { rows: key === 'bodyMd' ? 12 : key === 'prices' ? 4 : 2, text: cur || '' } : { type: 'text', value: cur || '' });
        if (key === 'slug' || key === 'prices') el.style.direction = 'ltr';
        inputs[key] = el;
        return field(f[1], el);
      });
      var title = result.kind === 'kid_lessons' ? (d.nameFa || '') : result.kind === 'puzzle_titles' ? 'سطح ' + fa(d.level + 1) : '';
      return { use: use, inputs: inputs, draft: d, node: h('section', { class: 'card' }, [h('label', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:8px' }, [use, h('b', { text: 'پیشنهاد ' + fa(i + 1) + (title ? ' · ' + title : '') })]), h('div', { class: 'form-grid' }, fields)]) };
    });
    function collect(row) {
      var d = {};
      Object.keys(row.draft).forEach(function (k) { d[k] = row.draft[k]; });
      Object.keys(row.inputs).forEach(function (k) { var v = row.inputs[k].value.trim(); if (k === 'prices') { d.prices = aiParsePrices(v); return; } d[k] = (k === 'unitFa' || k === 'syllablesFa' || k === 'metaTitle' || k === 'metaDescription') && v === '' ? null : v; });
      if (result.kind === 'kid_lessons') delete d.nameFa;
      return d;
    }
    var save = h('button', { class: 'btn ok', text: 'ذخیره‌ی موارد انتخاب‌شده', onclick: function () {
      var picked = rows.filter(function (r) { return r.use.checked; }).map(collect);
      if (!picked.length) return toast('چیزی انتخاب نشده', true);
      var body = { kind: result.kind, drafts: picked };
      if (result.kind === 'puzzle_titles') body.puzzleId = result.puzzleId;
      api('/admin/ai/save', { method: 'POST', body: body }).then(function (r) {
        if (!r.ok) return toast(AI_ERR[r.body && r.body.error] || 'ذخیره نشد؛ مقدارها را بررسی کن', true);
        var okN = r.body.results.filter(function (x) { return x.ok; }).length;
        var bad = r.body.results.filter(function (x) { return !x.ok; });
        toast(fa(okN) + ' مورد ذخیره شد' + (bad.length ? ' · ' + fa(bad.length) + ' ناموفق: ' + bad.map(function (x) { return x.label + ' (' + x.error + ')'; }).join('، ') : ''), bad.length > 0);
        if (!bad.length) { result = null; showDrafts(); }
      });
    } });
    var note = { products: 'محصول‌ها غیرفعال ذخیره می‌شوند؛ در «کاتالوگ محصولات» بازبینی و فعالشان کن.', kid_lessons: 'درس‌ها پیش‌نویس می‌شوند؛ در «کلمه‌آموزی کودک» تأییدشان کن.', puzzle_titles: 'عنوان‌ها همان لحظه روی پازل می‌نشینند.', blog: 'مقاله‌ها پیش‌نویس می‌شوند؛ در «بلاگ» منتشرشان کن.' }[result.kind];
    out.appendChild(h('div', { class: 'banner info' }, [h('span', { text: fa(result.drafts.length) + ' پیشنهاد از ' + result.provider + ' / ' + result.model + (result.dropped ? ' · ' + fa(result.dropped) + ' مورد نامعتبر کنار گذاشته شد' : '') + '. ' + note + ' محتوای هوش مصنوعی را قبل از انتشار خودت بخوان.' })]));
    rows.forEach(function (r) { out.appendChild(r.node); });
    out.appendChild(save);
  }
  go.addEventListener('click', function () {
    go.disabled = true; go.textContent = 'در حال تولید… (تا یک دقیقه)';
    api('/admin/ai/generate', { method: 'POST', body: request() }).then(function (r) {
      go.disabled = false; go.textContent = 'تولید پیش‌نویس';
      if (!r.ok) return toast(aiErrorText(r.body, 'درخواست درست نیست؛ فیلدها را بررسی کن'), true);
      result = r.body; if (result.kind === 'puzzle_titles') result.puzzleId = ctl.puzzle.value;
      showDrafts();
    });
  });
  var tabs = seg(AI_KINDS, kind, function (v) { kind = v; store('ai.kind', v); result = null; buildOptions(); showDrafts(); });
  var form = card('تولید محتوا', 'چند گزینه را انتخاب کن؛ سرور از سرویس هوش مصنوعی پیش‌نویس می‌گیرد. هیچ چیزی بدون بازبینی خودت منتشر یا تأیید نمی‌شود.', [tabs, opts, h('div', { class: 'form-grid', style: 'margin-top:10px' }, [field('سرویس', provider), field('مدل', model)]), field('توضیح اضافه', hint), h('div', { style: 'margin-top:10px' }, [go])]);
  root.appendChild(form); root.appendChild(out);
  buildOptions();
  api('/admin/ai').then(function (r) {
    if (r.status === 404) { clear(form); form.appendChild(empty('استودیوی هوش مصنوعی روی این سرور فعال نیست (دیتابیس لازم است)')); return; }
    if (!r.ok) return fail(r);
    info = r.body;
    if (!info.providers.length) { root.insertBefore(banner('warn', AI_ERR.ai_not_configured), form); go.disabled = true; return; }
    info.providers.forEach(function (p) { provider.appendChild(h('option', { value: p.id, text: p.label + ' — ' + p.defaultModel })); });
  });
};
`;
