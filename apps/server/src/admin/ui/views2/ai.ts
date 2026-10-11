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
  else if (b && b.providerMessage) t += ' — ' + b.providerMessage;
  return t;
}
var AI_KINDS = [['products', 'محصول'], ['kid_lessons', 'کلمه‌آموزی کودک'], ['puzzle_titles', 'عنوان گروه‌های پازل'], ['puzzle_groups', 'پازل کامل (گروه + محصول)'], ['blog', 'مقاله‌ی بلاگ']];
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
/** Fills a <select> with the puzzle tiers (level ranges) once they arrive, keeping current selected. */
function aiLoadTiers(sel, current) {
  api('/admin/puzzles/tiers').then(function (r) {
    if (!r.ok) return;
    (r.body.tiers || []).forEach(function (t) {
      sel.appendChild(h('option', { value: t.id, text: t.nameFa + ' (لول ' + fa(t.minLevel) + (t.maxLevel === null ? ' به بالا' : ' تا ' + fa(t.maxLevel)) + ')' }));
    });
    sel.value = current || '';
  });
}
function aiManual(root) {
  var info = null, result = null;
  var out = h('div');
  var kind = load('ai.kind') || 'products';
  var opts = h('div', { class: 'form-grid' });
  var provider = h('select'), model = select([['', 'پیش‌فرض سرویس']], ''); model.style.direction = 'ltr';
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
      opts.appendChild(h('div', { class: 'h', text: 'قیمت‌ها فقط پیشنهادند: «در انتظار» ثبت می‌شوند و محصول‌ها غیرفعال ساخته می‌شوند تا خودت بررسی و تأیید کنی.' }));
    } else if (kind === 'kid_lessons') {
      ctl.count = num(10, 1, 20);
      opts.appendChild(field('تعداد آیتم', ctl.count, 'برای آیتم‌های رده‌ی کودکِ بدون درس'));
    } else if (kind === 'puzzle_groups') {
      ctl.count = num(1, 1, 3);
      ctl.ageTrack = select([['adult', 'بزرگسال'], ['teen', 'نوجوان'], ['kid', 'کودک']], 'adult');
      ctl.style = select([['witty', 'بامزه و شوخ'], ['plain', 'ساده و روشن']], 'witty');
      ctl.tier = select([['', 'بدون سطح (ترکیبی)']], '');
      aiLoadTiers(ctl.tier, '');
      [['تعداد پازل', ctl.count], ['برای بازیکن‌های سطح', ctl.tier], ['رده‌ی سنی', ctl.ageTrack], ['سبک عنوان', ctl.style]].forEach(function (p) { opts.appendChild(field(p[0], p[1])); });
      opts.appendChild(h('div', { class: 'h', text: 'هوش مصنوعی خودش ۴ گروه و ۴ محصولِ هر گروه را از کاتالوگ انتخاب می‌کند (فقط محصول‌های فعال). پازل‌ها پیش‌نویس ذخیره می‌شوند و بعد از بازبینی در «ساخت پازل» تأییدشان کن.' }));
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
    else if (kind === 'puzzle_groups') { body.count = +ctl.count.value; body.ageTrack = ctl.ageTrack.value; body.style = ctl.style.value; if (ctl.tier.value) body.tierId = ctl.tier.value; }
    else if (kind === 'puzzle_titles') { body.puzzleId = ctl.puzzle.value; body.style = ctl.style.value; }
    else { body.topic = ctl.topic.value.trim(); body.count = +ctl.count.value; body.length = ctl.length.value; body.tone = ctl.tone.value; body.keywords = ctl.keywords.value.split(/[,،]/).map(function (x) { return x.trim(); }).filter(Boolean); }
    return body;
  }
  function showDrafts() {
    clear(out);
    if (!result) return;
    if (result.kind === 'puzzle_groups') {
      var dl = h('datalist', { id: 'ai-pool' });
      ((result.context && result.context.pool) || []).forEach(function (p) { dl.appendChild(h('option', { value: p.nameFa })); });
      out.appendChild(dl);
    }
    var LEVEL_NAME = ['زرد (آسان)', 'سبز', 'آبی', 'بنفش (سخت)'];
    var rows = result.drafts.map(function (d, i) {
      if (result.kind === 'puzzle_groups') {
        var usePz = h('input', { type: 'checkbox' }); usePz.checked = true;
        var pool = (result.context && result.context.pool) || [];
        var byName = {}, byId = {};
        pool.forEach(function (p) { byName[p.nameFa] = p; byId[p.productId] = p; });
        var edits = d.groups.map(function (g) {
          var t = h('input', { type: 'text', value: g.titleFa || '' }), e = h('input', { type: 'text', value: g.explanationFa || '' });
          var okG = h('input', { type: 'checkbox' });
          var items = g.items.map(function (x) {
            var cur = { productId: x.productId, nameFa: x.nameFa };
            var inp = h('input', { type: 'text', value: x.nameFa || x.productId, list: 'ai-pool', style: 'width:150px' });
            var cat = h('span', { class: 'h' });
            var setCat = function () { var p = byId[cur.productId]; cat.textContent = p && p.category ? p.category : ''; };
            inp.addEventListener('change', function () {
              var p = byName[inp.value.trim()];
              if (!p) { inp.value = cur.nameFa || ''; return toast('این محصول در فهرست کاتالوگ نیست؛ از پیشنهادهای لیست انتخاب کن', true); }
              cur.productId = p.productId; cur.nameFa = p.nameFa; setCat(); okG.checked = false;
            });
            setCat();
            return { cur: cur, node: h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, [inp, cat]) };
          });
          var chips = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin:6px 0' }, items.map(function (x) { return x.node; }));
          var approve = h('label', { style: 'display:flex;gap:6px;align-items:center' }, [okG, h('span', { text: 'این چهار محصول به این دسته می‌خورند (تأیید می‌کنم)' })]);
          return { level: g.level, t: t, e: e, ok: okG, items: items, node: h('div', { class: 'card' }, [h('b', { text: LEVEL_NAME[g.level] || ('سطح ' + g.level) }), h('div', { class: 'form-grid' }, [field('عنوان', t), field('قاعده‌ی دسته', e)]), h('div', { class: 'h', text: 'محصول‌هایی که هوش مصنوعی به این دسته وصل کرده (برای عوض‌کردن، نام را پاک کن و از لیست دیگری بگذار):' }), chips, approve]) };
        });
        return { use: usePz, pz: true, draft: d, edits: edits, node: h('section', { class: 'card' }, [h('label', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:8px' }, [usePz, h('b', { text: 'پازل ' + fa(i + 1) })]), h('div', {}, edits.map(function (x) { return x.node; }))]) };
      }
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
      if (row.pz) return { ageTrack: row.draft.ageTrack, groups: row.draft.groups.map(function (g, gi) { return { level: g.level, titleFa: row.edits[gi].t.value.trim(), explanationFa: row.edits[gi].e.value.trim(), items: row.edits[gi].items.map(function (x) { return x.cur; }) }; }) };
      var d = {};
      Object.keys(row.draft).forEach(function (k) { d[k] = row.draft[k]; });
      Object.keys(row.inputs).forEach(function (k) { var v = row.inputs[k].value.trim(); if (k === 'prices') { d.prices = aiParsePrices(v); return; } d[k] = (k === 'unitFa' || k === 'syllablesFa' || k === 'metaTitle' || k === 'metaDescription') && v === '' ? null : v; });
      if (result.kind === 'kid_lessons') delete d.nameFa;
      return d;
    }
    var save = h('button', { class: 'btn ok', text: 'ذخیره‌ی موارد انتخاب‌شده', onclick: function () {
      var chosen = rows.filter(function (r) { return r.use.checked; });
      for (var ci = 0; ci < chosen.length; ci++) {
        var row = chosen[ci];
        if (!row.pz) continue;
        if (!row.edits.every(function (g) { return g.ok.checked; })) return toast('اول محصول‌های هر چهار دسته را بخوان و «تأیید می‌کنم» را بزن', true);
        var ids = {}, dup = false;
        row.edits.forEach(function (g) { g.items.forEach(function (x) { if (ids[x.cur.productId]) dup = true; ids[x.cur.productId] = 1; }); });
        if (dup) return toast('یک محصول در دو دسته آمده؛ یکی را عوض کن', true);
      }
      var picked = chosen.map(collect);
      if (!picked.length) return toast('چیزی انتخاب نشده', true);
      var body = { kind: result.kind, drafts: picked };
      if (result.kind === 'puzzle_titles') body.puzzleId = result.puzzleId;
      if (result.kind === 'puzzle_groups' && result.tierId) body.tierId = result.tierId;
      api('/admin/ai/save', { method: 'POST', body: body }).then(function (r) {
        if (!r.ok) return toast(AI_ERR[r.body && r.body.error] || 'ذخیره نشد؛ مقدارها را بررسی کن', true);
        var okN = r.body.results.filter(function (x) { return x.ok; }).length;
        var bad = r.body.results.filter(function (x) { return !x.ok; });
        toast(fa(okN) + ' مورد ذخیره شد' + (bad.length ? ' · ' + fa(bad.length) + ' ناموفق: ' + bad.map(function (x) { return x.label + ' (' + x.error + ')'; }).join('، ') : ''), bad.length > 0);
        if (!bad.length) { result = null; showDrafts(); }
      });
    } });
    var sent = result.context && (result.kind === 'products' ? (result.context.existing || []).length : result.kind === 'puzzle_groups' ? (result.context.existingPuzzles || []).length : 0);
    var note = { products: 'محصول‌ها غیرفعال ذخیره می‌شوند؛ در «کاتالوگ محصولات» بازبینی و فعالشان کن.', kid_lessons: 'درس‌ها پیش‌نویس می‌شوند؛ در «کلمه‌آموزی کودک» تأییدشان کن.', puzzle_titles: 'عنوان‌ها همان لحظه روی پازل می‌نشینند.', puzzle_groups: 'پازل‌ها پیش‌نویس ذخیره می‌شوند؛ در «ساخت پازل» بخوان و تأییدشان کن.', blog: 'مقاله‌ها پیش‌نویس می‌شوند؛ در «بلاگ» منتشرشان کن.' }[result.kind];
    out.appendChild(h('div', { class: 'banner info' }, [h('span', { text: fa(result.drafts.length) + ' پیشنهاد از ' + result.provider + ' / ' + result.model + (result.dropped ? ' · ' + fa(result.dropped) + ' مورد نامعتبر کنار گذاشته شد' : '') + '. ' + note + ' محتوای هوش مصنوعی را قبل از انتشار خودت بخوان.' + (sent ? ' برای جلوگیری از تکراری‌شدن، فهرست ' + fa(sent) + (result.kind === 'products' ? ' محصول' : ' پازل') + ' موجود همراه درخواست به هوش مصنوعی داده شد.' : '') })]));
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
  function loadModels() {
    var p = (info && info.providers || []).filter(function (x) { return x.id === provider.value; })[0];
    clear(model);
    model.appendChild(h('option', { value: '', text: p ? 'پیش‌فرض سرویس (' + p.defaultModel + ')' : 'پیش‌فرض سرویس' }));
    if (!p) return;
    var asked = provider.value;
    api('/admin/ai/models?provider=' + encodeURIComponent(asked)).then(function (r) {
      if (!r.ok || provider.value !== asked) return;
      (r.body.models || []).forEach(function (m) { model.appendChild(h('option', { value: m, text: m })); });
    });
  }
  provider.addEventListener('change', loadModels);
  var tabs = seg(AI_KINDS, kind, function (v) { kind = v; store('ai.kind', v); result = null; buildOptions(); showDrafts(); });
  var form = card('تولید محتوا', 'چند گزینه را انتخاب کن؛ سرور از سرویس هوش مصنوعی پیش‌نویس می‌گیرد. هیچ چیزی بدون بازبینی خودت منتشر یا تأیید نمی‌شود.', [tabs, opts, h('div', { class: 'form-grid', style: 'margin-top:10px' }, [field('سرویس', provider), field('مدل', model)]), field('توضیح اضافه', hint), h('div', { style: 'margin-top:10px' }, [go])]);
  root.appendChild(form); root.appendChild(out);
  buildOptions();
  api('/admin/ai').then(function (r) {
    if (r.status === 404) { clear(form); form.appendChild(empty('استودیوی هوش مصنوعی روی این سرور فعال نیست (دیتابیس لازم است)')); return; }
    if (!r.ok) return fail(r);
    info = r.body;
    if (!info.providers.length) { root.insertBefore(banner('warn', AI_ERR.ai_not_configured), form); go.disabled = true; return; }
    info.providers.forEach(function (p) { provider.appendChild(h('option', { value: p.id, text: p.label })); });
    loadModels();
  });
}

var AI_SCHED_KINDS = [['puzzle_groups', 'پازل کامل (گروه + محصول)'], ['products', 'محصول'], ['kid_lessons', 'کلمه‌آموزی کودک'], ['blog', 'مقاله‌ی بلاگ']];
var AI_SCHED_ERR = {
  invalid_cron: 'عبارت زمان‌بندی درست نیست.',
  too_frequent: 'این برنامه بیش از حد پشت‌سرهم اجرا می‌شود؛ هر اجرا یک درخواست پولی به سرویس است.',
  never_runs: 'این زمان‌بندی هیچ‌وقت اجرا نمی‌شود (مثلاً ۳۰ بهمن).',
  topic_required: 'برای مقاله باید موضوع بنویسی.',
  count_too_high: 'تعداد بیشتر از سقفِ این نوع است.',
  unknown_provider: 'این سرویس روی سرور تنظیم نشده.',
  too_many: 'تعداد برنامه‌ها به سقف رسیده؛ یکی را پاک کن.',
  not_found: 'این برنامه دیگر وجود ندارد.',
  busy: 'یک اجرای دیگر در حال انجام است؛ کمی بعد دوباره بزن.',
  invalid_request: 'فیلدها را بررسی کن.'
};
var AI_DAYS = [[6, 'ش'], [0, 'ی'], [1, 'د'], [2, 'س'], [3, 'چ'], [4, 'پ'], [5, 'ج']];
var AI_EVERY = [1, 2, 3, 4, 6, 8, 12];
function aiPad(n) { return (n < 10 ? '0' : '') + n; }
/* A plain-Persian reading of the cron expressions the builder makes; anything else is shown as typed. */
function aiCronText(cron) {
  var m = /^(\d{1,2}) (\d{1,2}) \* \* (\*|[0-6](?:,[0-6])*)$/.exec(cron);
  if (m) {
    var at = fa(aiPad(+m[2]) + ':' + aiPad(+m[1]));
    if (m[3] === '*') return 'هر روز ساعت ' + at;
    return 'ساعت ' + at + ' · ' + m[3].split(',').map(function (d) { return AI_DAYS.filter(function (x) { return String(x[0]) === d; })[0][1]; }).join('، ');
  }
  m = /^(\d{1,2}) \*\/(\d{1,2}) \* \* \*$/.exec(cron);
  if (m) return 'هر ' + fa(m[2]) + ' ساعت (دقیقه‌ی ' + fa(m[1]) + ')';
  return cron;
}
function aiWhen(ms) {
  if (!ms) return '—';
  try { return new Date(ms).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return new Date(ms).toISOString(); }
}
/* Schedule picker: «every day at HH:MM (on chosen weekdays)», «every N hours» or a raw cron expression. */
function aiCronBuilder() {
  var mode = select([['daily', 'هر روز (یا روزهای انتخابی) در ساعت مشخص'], ['hours', 'هر چند ساعت یک‌بار'], ['raw', 'پیشرفته (عبارت cron)']], 'daily');
  var time = h('input', { type: 'time', value: '09:00' });
  var every = select(AI_EVERY.map(function (n) { return [String(n), 'هر ' + fa(n) + ' ساعت']; }), '6');
  var minute = h('input', { type: 'number', min: 0, max: 59, value: 0, style: 'width:90px' });
  var raw = h('input', { type: 'text', placeholder: '0 9 * * *', style: 'direction:ltr' });
  var boxes = AI_DAYS.map(function (d) { var c = h('input', { type: 'checkbox' }); c.checked = true; return c; });
  var daysRow = h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, AI_DAYS.map(function (d, i) { return h('label', { style: 'display:flex;gap:4px;align-items:center' }, [boxes[i], h('span', { text: d[1] })]); }));
  var box = h('div', { class: 'form-grid' });
  function draw() {
    clear(box);
    if (mode.value === 'daily') { box.appendChild(field('ساعت (به وقت تهران)', time)); box.appendChild(field('روزهای هفته', daysRow)); }
    else if (mode.value === 'hours') { box.appendChild(field('تکرار', every)); box.appendChild(field('در دقیقه‌ی', minute)); }
    else box.appendChild(field('عبارت cron (دقیقه ساعت روزِ‌ماه ماه روزِ‌هفته)', raw, 'مثلاً «30 8 * * 6,1» یعنی شنبه و دوشنبه ۰۸:۳۰ به وقت تهران'));
  }
  mode.addEventListener('change', draw);
  draw();
  return {
    node: h('div', {}, [field('زمان‌بندی', mode), box]),
    value: function () {
      if (mode.value === 'raw') return raw.value.trim();
      if (mode.value === 'hours') return (+minute.value || 0) + ' */' + every.value + ' * * *';
      var t = (time.value || '09:00').split(':');
      var on = AI_DAYS.filter(function (d, i) { return boxes[i].checked; }).map(function (d) { return d[0]; }).sort();
      return (+t[1]) + ' ' + (+t[0]) + ' * * ' + (on.length === 0 || on.length === 7 ? '*' : on.join(','));
    },
    set: function (cron) {
      var m = /^(\d{1,2}) (\d{1,2}) \* \* (\*|[0-6](?:,[0-6])*)$/.exec(cron);
      if (m) { mode.value = 'daily'; time.value = aiPad(+m[2]) + ':' + aiPad(+m[1]); boxes.forEach(function (b, i) { b.checked = m[3] === '*' || m[3].split(',').indexOf(String(AI_DAYS[i][0])) >= 0; }); draw(); return; }
      m = /^(\d{1,2}) \*\/(\d{1,2}) \* \* \*$/.exec(cron);
      if (m && AI_EVERY.indexOf(+m[2]) >= 0) { mode.value = 'hours'; every.value = m[2]; minute.value = m[1]; draw(); return; }
      mode.value = 'raw'; raw.value = cron; draw();
    }
  };
}
function aiSchedules(root) {
  var info = null, limits = null, list = h('div'), formBox = h('div');
  function kindLabel(k) { return (AI_SCHED_KINDS.filter(function (x) { return x[0] === k; })[0] || [k, k])[1]; }
  function lastText(r) {
    if (!r.lastRunAt) return 'هنوز اجرا نشده';
    var when = ago(r.lastRunAt);
    if (r.lastStatus === 'ok') return when + ' · ' + fa(r.lastSaved) + ' مورد ذخیره شد' + (r.lastMessage ? ' (' + r.lastMessage + ')' : '');
    if (r.lastStatus === 'empty') return when + ' · چیزی برای ساخت نبود';
    return when + ' · ناموفق: ' + (AI_ERR[r.lastMessage] || r.lastMessage);
  }
  function save(id, body, done) {
    api(id ? '/admin/ai/schedules/' + id : '/admin/ai/schedules', { method: id ? 'PUT' : 'POST', body: body }).then(function (r) {
      if (!r.ok) return toast(AI_SCHED_ERR[r.body && r.body.error] || 'ذخیره نشد', true);
      toast('ذخیره شد'); if (done) done(); refresh();
    });
  }
  function edit(row) {
    clear(formBox);
    var name = h('input', { type: 'text', maxlength: 80, value: row ? row.name : '', placeholder: 'مثلاً «پازل‌های شبانه»' });
    var kind = select(AI_SCHED_KINDS, row ? row.kind : 'puzzle_groups');
    var when = aiCronBuilder(); if (row) when.set(row.cron);
    var provider = select((info.providers || []).map(function (p) { return [p.id, p.label]; }), row ? row.provider : undefined);
    var model = h('input', { type: 'text', value: row ? row.model : '', placeholder: 'خالی = مدل پیش‌فرض سرویس', style: 'direction:ltr' });
    var hint = h('textarea', { rows: 2, maxlength: 300, text: row ? row.hint : '', placeholder: 'توضیح اضافه (اختیاری)' });
    var enabled = h('input', { type: 'checkbox' }); enabled.checked = row ? row.enabled : true;
    var count = h('input', { type: 'number', min: 1, max: 20, value: row ? row.count : 1, style: 'width:100px' });
    var cats = ((S.meta && S.meta.categories) || []);
    var category = select([['', 'هر دسته']].concat(cats.map(function (c) { return [c, c]; })), row && row.category ? row.category : '');
    var ageTrack = select([['adult', 'بزرگسال'], ['teen', 'نوجوان'], ['kid', 'کودک']], row ? row.ageTrack : 'adult');
    var style = select([['witty', 'بامزه و شوخ'], ['plain', 'ساده و روشن']], row ? row.style : 'witty');
    var tier = select([['', 'بدون سطح (ترکیبی)']], ''); aiLoadTiers(tier, row && row.tierId ? row.tierId : '');
    var fromYear = h('input', { type: 'number', min: 1300, max: 1450, value: row && row.fromYear ? row.fromYear : '', style: 'width:100px' });
    var toYear = h('input', { type: 'number', min: 1300, max: 1450, value: row && row.toYear ? row.toYear : '', style: 'width:100px' });
    var topic = h('input', { type: 'text', maxlength: 300, value: row ? row.topic : '', placeholder: 'مثلاً قیمت نان در دهه‌ی ۶۰' });
    var length = select([['short', 'کوتاه'], ['medium', 'متوسط'], ['long', 'بلند']], row ? row.length : 'medium');
    var tone = select([['friendly', 'صمیمی'], ['nostalgic', 'نوستالژیک'], ['informative', 'اطلاعاتی']], row ? row.tone : 'friendly');
    var opts = h('div', { class: 'form-grid' });
    function drawOpts() {
      clear(opts);
      var k = kind.value, items = [['تعداد در هر اجرا (سقف ' + fa(limits.maxCount[k]) + ')', count]];
      if (k === 'products') items.push(['دسته', category], ['رده‌ی سنی', ageTrack], ['از سال (شمسی)', fromYear], ['تا سال (شمسی)', toYear]);
      if (k === 'puzzle_groups') items.push(['برای بازیکن‌های سطح', tier], ['رده‌ی سنی', ageTrack], ['سبک عنوان', style]);
      if (k === 'blog') items.push(['موضوع', topic], ['طول', length], ['لحن', tone]);
      items.forEach(function (p) { opts.appendChild(field(p[0], p[1])); });
      count.max = limits.maxCount[k];
    }
    kind.addEventListener('change', drawOpts); drawOpts();
    var go = h('button', { class: 'btn primary', text: row ? 'ذخیره‌ی تغییرات' : 'ساخت برنامه', onclick: function () {
      var body = { name: name.value.trim(), kind: kind.value, enabled: enabled.checked, cron: when.value(), provider: provider.value, model: model.value.trim(), hint: hint.value.trim(), count: +count.value || 1, ageTrack: ageTrack.value, style: style.value, tierId: tier.value || null, category: category.value || null, fromYear: fromYear.value ? +fromYear.value : null, toYear: toYear.value ? +toYear.value : null, topic: topic.value.trim(), length: length.value, tone: tone.value };
      if (!body.name) return toast('برای برنامه اسم بگذار', true);
      save(row && row.id, body, function () { clear(formBox); });
    } });
    var cancel = h('button', { class: 'btn ghost', text: 'انصراف', onclick: function () { clear(formBox); } });
    formBox.appendChild(card(row ? 'ویرایش برنامه' : 'برنامه‌ی تازه', 'سرور در زمان‌های تعیین‌شده خودش از هوش مصنوعی پیش‌نویس می‌گیرد و ذخیره می‌کند؛ همه‌چیز پیش‌نویس می‌ماند و منتشر نمی‌شود.', [
      h('div', { class: 'form-grid' }, [field('نام برنامه', name), field('چه چیزی ساخته شود', kind)]),
      when.node, opts,
      h('div', { class: 'form-grid', style: 'margin-top:10px' }, [field('سرویس', provider), field('مدل', model)]),
      field('توضیح اضافه', hint),
      h('label', { style: 'display:flex;gap:6px;align-items:center;margin:10px 0' }, [enabled, h('span', { text: 'روشن باشد' })]),
      h('div', { style: 'display:flex;gap:8px' }, [go, cancel])
    ]));
  }
  function draw(rows) {
    clear(list);
    if (!rows.length) return list.appendChild(empty('هنوز برنامه‌ای نیست', 'با «برنامه‌ی تازه» مشخص کن سرور هر چند وقت چه چیزی بسازد.'));
    rows.forEach(function (r) {
      var run = h('button', { class: 'btn sm', text: 'اجرا همین الان', onclick: function () {
        run.disabled = true; run.textContent = 'در حال اجرا… (تا یک دقیقه)';
        api('/admin/ai/schedules/' + r.id + '/run', { method: 'POST' }).then(function (x) {
          if (!x.ok) { run.disabled = false; run.textContent = 'اجرا همین الان'; return toast(AI_SCHED_ERR[x.body && x.body.error] || 'اجرا نشد', true); }
          toast(x.body.schedule.lastStatus === 'ok' ? fa(x.body.schedule.lastSaved) + ' مورد ذخیره شد' : lastText(x.body.schedule), x.body.schedule.lastStatus === 'error'); refresh();
        });
      } });
      var toggle = h('button', { class: 'btn sm', text: r.enabled ? 'خاموش کن' : 'روشن کن', onclick: function () { var b = {}; Object.keys(r).forEach(function (k) { b[k] = r[k]; }); b.enabled = !r.enabled; save(r.id, b); } });
      var del = h('button', { class: 'btn sm bad', text: 'حذف', onclick: function () {
        ask('برنامه‌ی «' + r.name + '» پاک شود؟ چیزهایی که تا حالا ساخته شده می‌ماند.', function () {
          api('/admin/ai/schedules/' + r.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return toast(AI_SCHED_ERR[x.body && x.body.error] || 'پاک نشد', true); toast('پاک شد'); refresh(); });
        }, { danger: true, yes: 'حذف' });
      } });
      list.appendChild(h('section', { class: 'card', style: r.enabled ? '' : 'opacity:.7' }, [
        h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [h('b', { text: r.name }), h('span', { class: 'badge', text: kindLabel(r.kind) }), r.enabled ? null : h('span', { class: 'badge', text: 'خاموش' })]),
        h('div', { class: 'h', text: aiCronText(r.cron) + ' · ' + fa(r.count) + ' مورد در هر اجرا · ' + r.provider + (r.model ? ' / ' + r.model : '') }),
        h('div', { class: 'h', text: 'اجرای بعدی: ' + (r.enabled ? aiWhen(r.nextRunAt) : '—') }),
        h('div', { class: 'h', text: 'آخرین اجرا: ' + lastText(r), style: r.lastStatus === 'error' ? 'color:var(--bad,#c0392b)' : '' }),
        h('div', { style: 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap' }, [run, h('button', { class: 'btn sm', text: 'ویرایش', onclick: function () { edit(r); } }), toggle, del])
      ]));
    });
  }
  function refresh() {
    api('/admin/ai/schedules').then(function (r) {
      if (!r.ok) return root.appendChild(empty('برنامه‌ی زمانی روی این سرور فعال نیست (دیتابیس لازم است)'));
      limits = r.body.limits; draw(r.body.schedules);
    });
  }
  root.appendChild(card('برنامه‌ی زمانی', 'سرور خودش در زمان‌های مشخص‌شده (به وقت تهران) از هوش مصنوعی پیش‌نویس می‌سازد، مثل وقتی که خودت «تولید» و «ذخیره» را می‌زنی. فاصله‌ی دو اجرا نباید خیلی کم باشد (هر اجرا یک درخواست پولی است) و سقف تولید در ساعت برای دستی و خودکار مشترک است.', [
    h('button', { class: 'btn primary', text: 'برنامه‌ی تازه', onclick: function () { if (info && limits) edit(null); } })
  ]));
  root.appendChild(formBox); root.appendChild(list);
  api('/admin/ai').then(function (r) {
    if (!r.ok) return fail(r);
    info = r.body;
    if (!info.providers.length) { root.insertBefore(banner('warn', AI_ERR.ai_not_configured), formBox); return; }
    refresh();
  });
}
VIEWS.ai = function (root) {
  var mode = load('ai.mode') === 'schedule' ? 'schedule' : 'manual';
  var body = h('div');
  function show() { clear(body); (mode === 'schedule' ? aiSchedules : aiManual)(body); }
  root.appendChild(seg([['manual', 'تولید دستی'], ['schedule', 'برنامه‌ی زمانی']], mode, function (v) { mode = v; store('ai.mode', v); show(); }));
  root.appendChild(body);
  show();
};
`;
