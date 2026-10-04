/** Admin panel views: Shop, wheel, short links (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_ECONOMY_JS = String.raw`VIEWS.shop = function (root) {
  var list = h('div');
  function num(v, min) { return h('input', { type: 'number', value: v, min: min === undefined ? 0 : min, style: 'width:90px' }); }
  function txt(v, ph) { return h('input', { type: 'text', value: v || '', placeholder: ph || '', maxlength: 80, style: 'width:130px' }); }
  function row(it) {
    var toman = num(Math.floor((it.priceRials || 0) / 10)), skuB = txt(it.skuBazaar, 'SKU بازار'), skuM = txt(it.skuMyket, 'SKU مایکت');
    var cur = select([['coins', 'سکه'], ['gems', 'الماس']], it.currency || 'coins'), price = num(it.currency === 'gems' ? it.priceGems : it.priceCoins), lvl = num(it.minLevel, 1), lim = num(it.perDayLimit), amt = num(it.amount, 1);
    function save(patch) { api('/admin/shop/' + it.id, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
    return h('div', { class: 'card', style: 'padding:12px' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        h('b', { text: it.titleFa }), it.isActive ? badge('فعال', 'b-ok') : badge('پنهان', 'b-warn'), h('span', { class: 'h', text: it.descriptionFa })
      ]),
      h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
        field('پرداخت با', cur), field('قیمت', price), field('قیمت پول واقعی (تومان، ۰ = بدون)', toman), field('SKU بازار', skuB), field('SKU مایکت', skuM), field('تعداد در هر خرید', amt), field('کمترین لول', lvl), field('سقف خرید در روز (۰ = بی‌سقف)', lim),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { save({ priceRials: +toman.value * 10, skuBazaar: skuB.value.trim() || null, skuMyket: skuM.value.trim() || null, currency: cur.value, priceCoins: cur.value === 'coins' ? +price.value : it.priceCoins, priceGems: cur.value === 'gems' ? +price.value : it.priceGems, amount: +amt.value, minLevel: +lvl.value, perDayLimit: +lim.value }); } }),
        h('button', { class: 'btn', text: it.isActive ? 'پنهان کن' : 'فعال کن', onclick: function () { save({ isActive: !it.isActive }); } })
      ])
    ]);
  }
  function draw() {
    api('/admin/shop').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('فروشگاه روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      r.body.items.forEach(function (it) { list.appendChild(row(it)); });
    });
  }
  var title = h('input', { type: 'text', placeholder: 'نام آیتم', maxlength: 80 }), desc = h('input', { type: 'text', placeholder: 'توضیح کوتاه برای بازیکن', maxlength: 300 });
  var tomanNew = num(0), skuBN = h('input', { type: 'text', placeholder: 'SKU بازار', maxlength: 80 }), skuMN = h('input', { type: 'text', placeholder: 'SKU مایکت', maxlength: 80 });
  var cur = select([['coins', 'سکه'], ['gems', 'الماس']], 'coins'), price = num(20), amt = num(1, 1), lvl = num(1, 1), lim = num(0), eff = select([['hint_token', 'توکن راهنما'], ['wheel_spin', 'چرخش گردونه'], ['cosmetic', 'لباس / کلاه']], 'hint_token'), slot = select([['hat', 'کلاه'], ['outfit', 'لباس'], ['accessory', 'شال و زیورآلات'], ['hair', 'مو'], ['glasses', 'عینک']], 'hat'), icon = h('input', { type: 'text', placeholder: 'magnifier، shapoo، crown، beanie، hairLong، hairCurly، hairBun، glassesRound، glassesSun، shirt، dress، scarf', value: 'magnifier', maxlength: 30 });
  root.appendChild(card('قیمت راهنما در بازی تکی', 'قیمت هر راهنما، لول لازم و سقف راهنما در هر بازی در بخش «تنظیمات ← اقتصاد» است.', []));
  root.appendChild(card('آیتم‌های فروشگاه', 'هر آیتم با سکه یا الماس خریده می‌شود و «توکن راهنما» می‌دهد؛ توکن به جای سکه در بازی تکی خرج می‌شود. بازیکن شرط لول و سقف روزانه را قبل از خرید می‌بیند.', [list]));
  root.appendChild(addCard('آیتم تازه', 'نوع اثر: «توکن راهنما» (به جای سکه در بازی تکی خرج می‌شود) یا «چرخش گردونه» (هر عدد یک چرخش گردونه‌ی شانس) یا «لباس / کلاه» (یک بار خریده می‌شود و روی آواتار پوشیده می‌شود؛ تعداد را ۱ بگذارید).', 'آیتم تازه', [['عنوان', title], ['توضیح', desc], ['نوع اثر', eff], ['جایگاه (فقط لباس / کلاه)', slot], ['نام آیکن', icon], ['پرداخت با', cur], ['قیمت (به واحد انتخابی)', price], ['قیمت پول واقعی (تومان، ۰ = بدون)', tomanNew], ['SKU بازار (اختیاری)', skuBN], ['SKU مایکت (اختیاری)', skuMN], ['تعداد (توکن یا چرخش)', amt], ['کمترین لول', lvl], ['سقف در روز', lim]], function () {
    return api('/admin/shop', { method: 'POST', body: { titleFa: title.value.trim(), descriptionFa: desc.value.trim(), effect: eff.value, amount: +amt.value, priceRials: +tomanNew.value * 10, skuBazaar: skuBN.value.trim() || null, skuMyket: skuMN.value.trim() || null, currency: cur.value, priceCoins: cur.value === 'coins' ? +price.value : 0, priceGems: cur.value === 'gems' ? +price.value : 0, minLevel: +lvl.value, perDayLimit: +lim.value, slot: eff.value === 'cosmetic' ? slot.value : null, iconKey: eff.value === 'wheel_spin' ? 'dice' : icon.value.trim() || 'magnifier', isActive: true } }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('آیتم ساخته شد'); title.value = ''; desc.value = ''; draw(); return true; });
  }));
  draw();
};
VIEWS.wheel = function (root) {
  var KIND = { coins: 'سکه', gems: 'الماس', hint_token: 'توکن راهنما', wheel_spin: 'چرخش گردونه', cosmetic: 'لباس / کلاه' };
  var KINDS = [['coins', 'سکه'], ['gems', 'الماس'], ['hint_token', 'توکن راهنما'], ['wheel_spin', 'چرخش گردونه'], ['cosmetic', 'لباس / کلاه (آیتم فروشگاه)']];
  var itemSel = select([['', '— آیتم لباس —']], '');
  var list = h('div'), odds = h('div', { class: 'h' });
  function num(v, min) { return h('input', { type: 'number', value: v, min: min === undefined ? 0 : min, style: 'width:90px' }); }
  function row(p, total) {
    var amt = num(p.amount, 1), w = num(p.weight);
    function save(patch) { api('/admin/wheel/prizes/' + p.id, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
    var pct = total > 0 && p.isActive ? Math.round((1000 * p.weight) / total) / 10 : 0;
    return h('div', { class: 'card', style: 'padding:12px' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        h('b', { text: (KIND[p.kind] || p.kind) + (p.titleFa ? ' · ' + p.titleFa : '') }), p.isActive ? badge('فعال', 'b-ok') : badge('پنهان', 'b-warn'), h('span', { class: 'h', text: 'شانس تقریبی ' + faNum(pct) + '٪' })
      ]),
      h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
        field('مقدار', amt), field('وزن شانس (۰ = هیچ‌وقت)', w),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { save({ amount: +amt.value, weight: +w.value }); } }),
        h('button', { class: 'btn', text: p.isActive ? 'پنهان کن' : 'فعال کن', onclick: function () { save({ isActive: !p.isActive }); } })
      ])
    ]);
  }
  function draw() {
    api('/admin/wheel/prizes').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('گردونه روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      var total = 0;
      r.body.prizes.forEach(function (p) { if (p.isActive) total += p.weight; });
      var coins = 0;
      r.body.prizes.forEach(function (p) { if (p.isActive && p.kind === 'coins' && total > 0) coins += (p.amount * p.weight) / total; });
      odds.textContent = 'میانگین سکه‌ی هر چرخش (بدون مقیاس): ' + faNum(Math.round(coins * 10) / 10) + ' · قطعه‌ی بدون شانس روی گردونه دیده نمی‌شود.';
      r.body.prizes.forEach(function (p) { list.appendChild(row(p, total)); });
    });
  }
  var kind = select(KINDS, 'coins'), amt = num(10, 1), wt = num(10);
  root.appendChild(card('جایزه‌های گردونه', 'هر ردیف یک قطعه‌ی گردونه است. شانس هر قطعه = وزنش تقسیم بر جمع وزن‌های فعال. چرخش رایگان و چرخش بعد از برد در «تنظیمات ← اقتصاد» است.', [odds, list]));
  root.appendChild(addCard('قطعه‌ی تازه', 'نوع جایزه، مقدارش و وزن شانس را بنویسید.', 'قطعه‌ی تازه', [['نوع جایزه', kind], ['آیتم (فقط برای لباس / کلاه)', itemSel], ['مقدار (برای لباس ۱)', amt], ['وزن شانس', wt]], function () {
    return api('/admin/wheel/prizes', { method: 'POST', body: { kind: kind.value, itemId: kind.value === 'cosmetic' ? itemSel.value || null : null, amount: kind.value === 'cosmetic' ? 1 : +amt.value, weight: +wt.value, isActive: true } }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('قطعه ساخته شد'); draw(); return true; });
  }));
  api('/admin/shop').then(function (r) { if (!r.ok) return; r.body.items.filter(function (i) { return i.effect === 'cosmetic'; }).forEach(function (i) { itemSel.appendChild(h('option', { value: i.id, text: i.titleFa })); }); });
  draw();
};
VIEWS.shortlinks = function (root) {
  var list = h('div'), baseUrl = '';
  var ERR = { invalid_url: 'آدرس مقصد درست نیست (باید با http یا https شروع شود).', invalid_code: 'کد فقط حرف کوچک انگلیسی، عدد، خط تیره و زیرخط باشد (۲ تا ۲۴ نویسه).', reserved: 'این کد برای سیستم رزرو است.', taken: 'این کد قبلاً استفاده شده.', self_link: 'مقصد نباید خود دامنه‌ی کوتاه باشد.' };
  function row(l) {
    var full = baseUrl ? baseUrl + '/' + l.code : '/s/' + l.code;
    function save(patch) { api('/admin/short-links/' + l.code, { method: 'PATCH', body: patch }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); }
    var target = h('input', { type: 'text', value: l.targetUrl, style: 'min-width:260px;flex:1' });
    return h('div', { class: 'card', style: 'padding:12px' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
        h('b', { text: full, style: 'direction:ltr' }), l.isActive ? badge('فعال', 'b-ok') : badge('خاموش', 'b-warn'), h('span', { class: 'h', text: faNum(l.clicks) + ' کلیک' + (l.note ? ' · ' + l.note : '') })
      ]),
      h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
        field('مقصد', target),
        h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { save({ url: target.value }); } }),
        h('button', { class: 'btn', text: l.isActive ? 'خاموش کن' : 'روشن کن', onclick: function () { save({ isActive: !l.isActive }); } })
      ])
    ]);
  }
  function draw() {
    api('/admin/short-links').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('لینک کوتاه روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      baseUrl = r.body.base;
      if (!baseUrl) list.appendChild(h('div', { class: 'h', text: 'دامنه‌ی لینک کوتاه در «تنظیمات ← اپ» خالی است؛ تا آن را پر نکنید لینک‌ها فقط با /s/کد کار می‌کنند.' }));
      if (r.body.links.length === 0) list.appendChild(empty('هنوز لینکی نساخته‌اید'));
      r.body.links.forEach(function (l) { list.appendChild(row(l)); });
    });
  }
  var url = h('input', { type: 'text', placeholder: 'https://…', style: 'direction:ltr' }), code = h('input', { type: 'text', placeholder: 'خالی = خودکار', maxlength: 24, style: 'direction:ltr' }), note = h('input', { type: 'text', placeholder: 'یادداشت (اختیاری)', maxlength: 120 });
  root.appendChild(card('لینک‌های کوتاه', 'هر لینک بعد از دامنه‌ی کوتاه می‌آید؛ مثلاً 2oi.ir/dl. تغییر مقصد فوری اثر می‌کند.', [list]));
  root.appendChild(addCard('لینک تازه', 'آدرس کامل مقصد را بنویسید؛ کد دلخواه اختیاری است.', 'لینک تازه', [['مقصد', url], ['کد دلخواه', code], ['یادداشت', note]], function () {
    return api('/admin/short-links', { method: 'POST', body: { url: url.value.trim(), code: code.value.trim() || undefined, note: note.value.trim() } }).then(function (x) { if (!x.ok) { toast(ERR[x.body && x.body.error] || 'نشد'); return false; } toast('ساخته شد: ' + x.body.code); url.value = ''; code.value = ''; note.value = ''; draw(); return true; });
  }));
  draw();
};
`;
