/** Admin view: the question workshop — questions players designed, reviewed by other players, waiting for the admin (docs/logic/question-workshop.md). */
export const ADMIN_VIEWS2_WORKSHOP_JS = String.raw`
VIEWS.workshop = function (root) {
  var list = h('div'), topics = [];
  var STATE = { pending: ['در حال بازبینی', 'b-mute'], ready_for_review: ['منتظر مدیر', 'b-info'], approved: ['تأییدشده', 'b-ok'], rejected: ['ردشده', 'b-bad'] };
  var REASONS = [['wrong_answer', 'جواب اشتباه یا قابل‌بحث'], ['unclear', 'مبهم یا بد نوشته‌شده'], ['duplicate', 'تکراری'], ['off_topic', 'خارج از موضوع'], ['bad_taste', 'نامناسب']];
  var DIFF = [['1', 'آسان'], ['2', 'متوسط'], ['3', 'سخت']];
  var status = select([['ready_for_review', 'منتظر تأیید مدیر'], ['pending', 'در حال بازبینی'], ['approved', 'تأییدشده'], ['rejected', 'ردشده'], ['', 'همه']], 'ready_for_review');
  function editForm(x) {
    var f = {
      topic: select(topics.map(function (t) { return [t.id, t.nameFa]; }), x.topicId),
      text: h('textarea', { rows: 2, maxlength: 300, text: x.textFa }),
      opts: [0, 1, 2, 3].map(function (i) { return h('input', { type: 'text', maxlength: 80, value: x.options[i] }); }),
      right: select([['0', 'گزینه‌ی ۱'], ['1', 'گزینه‌ی ۲'], ['2', 'گزینه‌ی ۳'], ['3', 'گزینه‌ی ۴']], String(x.correctIndex)),
      expl: h('input', { type: 'text', maxlength: 300, value: x.explanationFa, placeholder: 'توضیح کوتاه (اختیاری)' }),
      diff: select(DIFF, String(x.difficulty || 2))
    };
    var rows = [['موضوع', f.topic], ['پرسش', f.text]].concat(f.opts.map(function (o, i) { return ['گزینه‌ی ' + fa(i + 1), o]; })).concat([['گزینه‌ی درست', f.right], ['توضیح', f.expl], ['سختی', f.diff]]);
    return {
      node: h('div', { class: 'form-grid' }, rows.map(function (n) { return field(n[0], n[1]); })),
      body: function () { return { topicId: f.topic.value, textFa: f.text.value.trim(), options: f.opts.map(function (o) { return o.value.trim(); }), correctIndex: Number(f.right.value), explanationFa: f.expl.value.trim(), difficulty: Number(f.diff.value) }; }
    };
  }
  function approve(x, edit, close) {
    api('/admin/workshop/' + x.id + '/approve', { method: 'POST', body: edit ? { edit: edit } : {} }).then(function (r) {
      if (!r.ok) return fail(r);
      toast('تأیید شد' + (r.body.reward ? ' — ' + fa(r.body.reward.total) + ' سکه به طراح' : ''));
      if (close) close();
      draw();
    });
  }
  function reject(x) {
    var reason = select(REASONS, 'unclear');
    modal('رد کردن سؤال', h('div', {}, [h('p', { text: 'دلیل برای طراح فرستاده می‌شود.' }), field('دلیل', reason)]), [{ label: 'انصراف' }, { label: 'رد کن', cls: 'bad', keepOpen: true, run: function (close) {
      api('/admin/workshop/' + x.id + '/reject', { method: 'POST', body: { reason: reason.value } }).then(function (r) { if (!r.ok) return fail(r); toast('رد شد'); close(); draw(); });
    } }]);
  }
  function draw() {
    api('/admin/workshop' + (status.value ? '?status=' + status.value : '')).then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('کارگاه سؤال روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.submissions.length) return list.appendChild(empty('سؤالی در این بخش نیست'));
      r.body.submissions.forEach(function (x) {
        var open = x.status === 'pending' || x.status === 'ready_for_review';
        var st = STATE[x.status] || [x.status, 'b-mute'];
        list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
          h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
            badge(x.topicNameFa || 'موضوع', 'b-info'), badge(st[0], st[1]),
            badge('سختی: ' + (DIFF.filter(function (d) { return d[0] === String(x.difficulty); })[0] || ['', '؟'])[1], 'b-mute'),
            x.disputes >= 2 ? badge('جواب مشکوک: ' + fa(x.disputes) + ' از ' + fa(x.reviews) + ' بازبین جور دیگر جواب دادند', 'b-bad') : null,
            h('span', { style: 'color:var(--muted);font-size:12px', text: x.userName + ' · امتیاز ' + fa(x.score) + ' از ' + fa(x.reviews) + ' بازبین · ' + ago(x.createdAt) + (x.rejectReason ? ' · ' + (REASONS.filter(function (z) { return z[0] === x.rejectReason; })[0] || ['', ''])[1] : '') })
          ]),
          h('div', { style: 'margin-top:6px;font-weight:600', text: x.textFa }),
          h('div', { class: 'pz-items', style: 'margin-top:6px' }, x.options.map(function (o, i) { return h('span', { class: 'pz-item', text: (i === x.correctIndex ? '✓ ' : '') + o, style: i === x.correctIndex ? 'font-weight:700' : '' }); })),
          x.explanationFa ? h('div', { style: 'color:var(--muted);font-size:12px;margin-top:4px', text: x.explanationFa }) : null,
          open ? h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
            h('button', { class: 'btn sm ok', text: 'تأیید', onclick: function () { approve(x, null); } }),
            h('button', { class: 'btn sm', text: 'ویرایش و تأیید', onclick: function () {
              var fm = editForm(x);
              modal('ویرایش و تأیید سؤال', fm.node, [{ label: 'انصراف' }, { label: 'تأیید با این ویرایش', cls: 'primary', keepOpen: true, run: function (close) { approve(x, fm.body(), close); } }]);
            } }),
            h('button', { class: 'btn sm bad', text: 'رد', onclick: function () { reject(x); } })
          ]) : null
        ]));
      });
    });
  }
  status.onchange = draw;
  root.appendChild(card('کارگاه سؤال', 'سؤال‌هایی که بازیکن‌ها ساخته‌اند و بازیکن‌های دیگر بازبینی کرده‌اند (جواب را کور می‌زنند و به سؤال 👍/👎 می‌دهند). تأیید، سؤال را با نام طراح وارد بازی می‌کند و جایزه‌ی طراح و امتیاز بازبین‌ها را می‌دهد؛ مقدارها در «تنظیمات» (گروه بازبینی) است.', [h('div', { class: 'toolbar' }, [status])]));
  root.appendChild(list);
  api('/admin/puzzle-topics').then(function (t) { topics = t.ok ? t.body.topics : []; draw(); });
};
`;
