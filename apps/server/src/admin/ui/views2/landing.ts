/** Admin panel views: Landing site posts, cast, FAQ (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_LANDING_JS = String.raw`var LANDING_ERR = { slug_taken: 'این نشانی (slug) قبلاً برای مقاله‌ی دیگری استفاده شده.', invalid_slug: 'نشانی فقط حرف، عدد و خط تیره باشد (حداقل ۲ نویسه).', invalid_cover: 'آدرس تصویر باید با http یا https شروع شود.', empty: 'عنوان و متن مقاله لازم است.' };
function postFields(p) {
  p = p || {};
  var f = {
    title: h('input', { type: 'text', value: p.titleFa || '', maxlength: 160 }),
    slug: h('input', { type: 'text', value: p.slug || '', placeholder: 'خالی = از عنوان ساخته می‌شود', maxlength: 120, style: 'direction:ltr' }),
    summary: h('textarea', { rows: 2, maxlength: 400, text: p.summaryFa || '' }),
    body: h('textarea', { rows: 14, style: 'width:100%;font-family:monospace;direction:rtl', text: p.bodyMd || '' }),
    metaTitle: h('input', { type: 'text', value: p.metaTitle || '', maxlength: 70, placeholder: 'خالی = همان عنوان' }),
    metaDesc: h('textarea', { rows: 2, maxlength: 200, text: p.metaDescription || '' }),
    cover: h('input', { type: 'text', value: p.coverUrl || '', placeholder: 'https://…', style: 'direction:ltr' }),
    author: h('input', { type: 'text', value: p.authorName || '', maxlength: 80 }),
    status: select([['draft', 'پیش‌نویس (منتشر نشده)'], ['published', 'منتشر شده']], p.status || 'draft')
  };
  f.nodes = [['عنوان', f.title], ['نشانی (slug)', f.slug, 'تغییر نشانی یک مقاله‌ی منتشرشده خودکار ۳۰۱ می‌شود.'], ['خلاصه', f.summary, 'یکی دو جمله؛ در فهرست و نتیجه‌ی جستجو دیده می‌شود.'], ['متن (مارک‌داون)', f.body, 'با ## بخش بسازید؛ زیر هر ## جمله‌ی اول پاسخ مستقیم باشد.'], ['عنوان گوگل', f.metaTitle], ['توضیح گوگل', f.metaDesc, 'حداکثر ۱۶۰ نویسه.'], ['تصویر شاخص', imageField(f.cover, 'landing')], ['نویسنده', f.author], ['وضعیت', f.status]];
  f.value = function () { return { titleFa: f.title.value.trim(), slug: f.slug.value.trim() || undefined, summaryFa: f.summary.value.trim(), bodyMd: f.body.value, metaTitle: f.metaTitle.value.trim() || null, metaDescription: f.metaDesc.value.trim() || null, coverUrl: f.cover.value.trim() || null, authorName: f.author.value.trim(), status: f.status.value }; };
  return f;
}
VIEWS.landingposts = function (root) {
  var list = h('div');
  function edit(id) {
    api('/admin/landing/posts/' + id).then(function (r) {
      if (!r.ok) return fail(r);
      var f = postFields(r.body);
      modal('ویرایش مقاله', h('div', { class: 'form-grid' }, f.nodes.map(function (n) { return field(n[0], n[1], n[2]); })), [{ label: 'انصراف' }, { label: 'ذخیره', cls: 'primary', keepOpen: true, run: function (close) {
        api('/admin/landing/posts/' + id, { method: 'PUT', body: f.value() }).then(function (x) { if (!x.ok) return toast(LANDING_ERR[x.body && x.body.error] || 'نشد', true); toast('ذخیره شد'); close(); draw(); });
      } }]);
    });
  }
  function draw() {
    api('/admin/landing/posts').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('سایت معرفی روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (r.body.posts.length === 0) list.appendChild(empty('هنوز مقاله‌ای ننوشته‌اید'));
      r.body.posts.forEach(function (p) {
        list.appendChild(h('div', { class: 'card', style: 'padding:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
          h('b', { text: p.titleFa }), p.status === 'published' ? badge('منتشر شده', 'b-ok') : badge('پیش‌نویس', 'b-warn'), h('span', { class: 'h', text: '/blog/' + p.slug, style: 'direction:ltr' }),
          h('button', { class: 'btn', text: 'ویرایش', onclick: function () { edit(p.id); } })
        ]));
      });
    });
  }
  var fresh = postFields(null);
  root.appendChild(card('مقاله‌ها', 'فقط مقاله‌های «منتشر شده» در سایت معرفی، نقشه‌ی سایت و llms.txt دیده می‌شوند.', [list]));
  root.appendChild(addCard('مقاله‌ی تازه', 'مارک‌داون بنویسید؛ HTML خام حذف می‌شود.', 'مقاله‌ی تازه', fresh.nodes, function () {
    return api('/admin/landing/posts', { method: 'POST', body: fresh.value() }).then(function (x) { if (!x.ok) { toast(LANDING_ERR[x.body && x.body.error] || 'نشد', true); return false; } toast('ساخته شد'); draw(); return true; });
  }));
  draw();
};
function simpleList(root, o) {
  var list = h('div');
  function draw() {
    api(o.path).then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('سایت معرفی روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      var rows = r.body[o.key];
      if (rows.length === 0) list.appendChild(empty(o.none));
      rows.forEach(function (it) {
        var inputs = o.edit.map(function (e) { return h(e.tag || 'input', e.tag ? { rows: 3, text: it[e.k] || '' } : { type: 'text', value: it[e.k] || '' }); });
        list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
          h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [h('b', { text: it[o.title] }), it.isActive ? badge('فعال', 'b-ok') : badge('پنهان', 'b-warn')]),
          h('div', { class: 'form-grid', style: 'margin-top:8px' }, o.edit.map(function (e, i) { return field(e.label, inputs[i]); })),
          h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
            h('button', { class: 'btn primary', text: 'ذخیره', onclick: function () { var body = {}; o.edit.forEach(function (e, i) { body[e.k] = inputs[i].value; }); api(o.path + '/' + it.id, { method: 'PATCH', body: body }).then(function (x) { if (!x.ok) return fail(x); toast('ذخیره شد'); draw(); }); } }),
            h('button', { class: 'btn', text: it.isActive ? 'پنهان کن' : 'فعال کن', onclick: function () { api(o.path + '/' + it.id, { method: 'PATCH', body: { isActive: !it.isActive } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } }),
            h('button', { class: 'btn', text: 'بالاتر', onclick: function () { api(o.path + '/' + it.id, { method: 'PATCH', body: { sortOrder: Math.max(0, it.sortOrder - 1) } }).then(function (x) { if (!x.ok) return fail(x); draw(); }); } })
          ])
        ]));
      });
    });
  }
  var inputs = o.edit.map(function (e) { return h(e.tag || 'input', e.tag ? { rows: 3 } : { type: 'text' }); });
  root.appendChild(card(o.heading, o.sub, [list]));
  root.appendChild(addCard(o.addTitle, o.addSub, o.addTitle, o.edit.map(function (e, i) { return [e.label, inputs[i]]; }), function () {
    var body = { isActive: true }; o.edit.forEach(function (e, i) { body[e.k] = inputs[i].value.trim(); });
    return api(o.path, { method: 'POST', body: body }).then(function (x) { if (!x.ok) { fail(x); return false; } toast('ساخته شد'); inputs.forEach(function (i) { i.value = ''; }); draw(); return true; });
  }));
  draw();
}
VIEWS.landingcast = function (root) {
  simpleList(root, { path: '/admin/landing/cast', key: 'cast', title: 'nameFa', none: 'هنوز کسی اضافه نشده', heading: 'بازیگران', sub: 'ترتیب نمایش با «بالاتر» عوض می‌شود. «تصویر» نام شخصیت (dozari، dozariF …) یا آدرس تصویر است.', addTitle: 'بازیگر تازه', addSub: 'نام، نقش و یک معرفی کوتاه.',
    edit: [{ k: 'nameFa', label: 'نام' }, { k: 'roleFa', label: 'نقش' }, { k: 'bioFa', label: 'معرفی', tag: 'textarea' }, { k: 'imageKey', label: 'تصویر' }] });
};
VIEWS.landingcomments = function (root) {
  var list = h('div');
  var which = select([['pending', 'در انتظار تأیید'], ['approved', 'تأییدشده'], ['hidden', 'پنهان']], 'pending');
  function set(c, status) { api('/admin/landing/comments/' + c.id, { method: 'PATCH', body: { status: status } }).then(function (x) { if (!x.ok) return fail(x); toast('انجام شد'); draw(); }); }
  function draw() {
    api('/admin/landing/comments?status=' + which.value).then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('سایت معرفی روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (r.body.comments.length === 0) list.appendChild(empty('نظری در این دسته نیست'));
      r.body.comments.forEach(function (c) {
        list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
          h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [h('b', { text: c.authorName }), badge(c.targetType === 'post' ? 'مقاله' : 'شخصیت', 'b-ok'), h('span', { class: 'h', text: c.targetKey, style: 'direction:ltr' })]),
          h('p', { text: c.body, style: 'white-space:pre-wrap' }),
          h('div', { class: 'toolbar' }, [
            c.status !== 'approved' ? h('button', { class: 'btn primary', text: 'تأیید', onclick: function () { set(c, 'approved'); } }) : null,
            c.status !== 'hidden' ? h('button', { class: 'btn', text: 'پنهان کن', onclick: function () { set(c, 'hidden'); } }) : null
          ].filter(Boolean))
        ]));
      });
    });
  }
  which.onchange = draw;
  root.appendChild(card('نظرها', 'نظر تازه همیشه «در انتظار تأیید» است؛ لینک و کلمه‌های ممنوع پیش از ثبت رد می‌شوند.', [which, list]));
  draw();
};
VIEWS.landingfaq = function (root) {
  simpleList(root, { path: '/admin/landing/faq', key: 'faq', title: 'questionFa', none: 'هنوز پرسشی نیست', heading: 'پرسش‌های متداول', sub: 'جواب را با یک جمله‌ی مستقیم شروع کنید؛ هر دو، گوگل و دستیارهای هوش مصنوعی، همین را نقل می‌کنند.', addTitle: 'پرسش تازه', addSub: 'پرسش و پاسخ کوتاه.',
    edit: [{ k: 'questionFa', label: 'پرسش' }, { k: 'answerFa', label: 'پاسخ', tag: 'textarea' }] });
};
`;
