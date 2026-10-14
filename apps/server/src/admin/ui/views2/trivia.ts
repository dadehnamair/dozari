/** Admin view: general four-choice questions, each filed under a topic (docs/logic/trivia.md). Runs in the shared admin script scope. */
export const ADMIN_VIEWS2_TRIVIA_JS = String.raw`
VIEWS.trivia = function (root) {
  var T = { topics: [], rows: [], topic: '', status: 'approved', diff: '' };
  var TRACKS = [['adult', 'بزرگسال'], ['teen', 'نوجوان'], ['kid', 'کودک']];
  var DIFF = [['1', 'آسان'], ['2', 'متوسط'], ['3', 'سخت']];
  function diffName(n) { return (DIFF.filter(function (d) { return d[0] === String(n); })[0] || ['', '؟'])[1]; }
  var list = h('div'), bar = h('div');
  function topicOpts(blank) { return (blank ? [['', blank]] : []).concat(T.topics.map(function (t) { return [t.id, t.nameFa]; })); }
  function form(q) {
    var f = {
      topic: select(topicOpts(), q ? q.topicId : (T.topic || (T.topics[0] && T.topics[0].id) || '')),
      text: h('textarea', { rows: 2, maxlength: 300, placeholder: 'متن پرسش، مثلا: کدام یک از این‌ها میوه است؟', text: q ? q.textFa : '' }),
      opts: [0, 1, 2, 3].map(function (i) { return h('input', { type: 'text', maxlength: 80, placeholder: 'گزینه‌ی ' + fa(i + 1), value: q ? q.options[i] : '' }); }),
      right: select([['0', 'گزینه‌ی ۱'], ['1', 'گزینه‌ی ۲'], ['2', 'گزینه‌ی ۳'], ['3', 'گزینه‌ی ۴']], q ? String(q.correctIndex) : '0'),
      expl: h('input', { type: 'text', maxlength: 300, placeholder: 'توضیح کوتاه بعد از جواب (اختیاری)', value: q ? q.explanationFa : '' }),
      track: select(TRACKS, q ? q.ageTrack : 'adult'),
      diff: select(DIFF, q ? String(q.difficulty || 2) : '2')
    };
    function body() {
      return { topicId: f.topic.value, textFa: f.text.value.trim(), options: f.opts.map(function (o) { return o.value.trim(); }), correctIndex: Number(f.right.value), explanationFa: f.expl.value.trim(), ageTrack: f.track.value, difficulty: Number(f.diff.value) };
    }
    var rows = [['موضوع (اجباری)', f.topic], ['پرسش', f.text]].concat(f.opts.map(function (o, i) { return ['گزینه‌ی ' + fa(i + 1), o]; })).concat([['گزینه‌ی درست', f.right], ['توضیح', f.expl], ['رده‌ی سنی', f.track], ['سختی', f.diff]]);
    return { node: h('div', { class: 'form-grid' }, rows.map(function (n) { return field(n[0], n[1]); })), body: body };
  }
  function save(id, fm, close) {
    if (!fm.body().topicId) return toast('موضوع را انتخاب کن', true);
    api(id ? '/admin/trivia/' + id : '/admin/trivia', { method: id ? 'PUT' : 'POST', body: fm.body() }).then(function (r) { if (!r.ok) return fail(r); toast('ذخیره شد'); close(); reload(); });
  }
  function openForm(q) {
    var fm = form(q);
    modal(q ? 'ویرایش پرسش' : 'پرسش جدید', fm.node, [{ label: 'انصراف' }, { label: 'ذخیره', cls: 'primary', keepOpen: true, run: function (close) { save(q && q.id, fm, close); } }]);
  }
  function draw() {
    clear(bar);
    var topicSel = select(topicOpts('همه‌ی موضوع‌ها'), T.topic); topicSel.onchange = function () { T.topic = topicSel.value; reload(); };
    var dfSel = select([['', 'همه‌ی سختی‌ها']].concat(DIFF), T.diff); dfSel.onchange = function () { T.diff = dfSel.value; draw(); };
    var stSel = select([['approved', 'فعال'], ['draft', 'پیش‌نویس'], ['retired', 'بازنشسته']], T.status); stSel.onchange = function () { T.status = stSel.value; reload(); };
    bar.appendChild(h('div', { class: 'toolbar' }, [topicSel, stSel, dfSel, h('span', { style: 'flex:1' }), h('button', { class: 'btn primary', text: '＋ پرسش جدید', onclick: function () { if (!T.topics.length) return toast('اول در «ساخت پازل ← موضوع‌ها» یک موضوع بساز', true); openForm(null); } })]));
    clear(list);
    var shown = T.rows.filter(function (q) { return !T.diff || String(q.difficulty) === T.diff; });
    var count = { 1: 0, 2: 0, 3: 0 }; T.rows.forEach(function (q) { count[q.difficulty] = (count[q.difficulty] || 0) + 1; });
    list.appendChild(h('div', { style: 'color:var(--muted);font-size:12px;padding:4px 2px', text: 'آسان ' + fa(count[1]) + ' · متوسط ' + fa(count[2]) + ' · سخت ' + fa(count[3]) + ' — برای «سؤال بر اساس لول بازیکن» (تنظیمات ← امتیاز و پاداش) بهتر است از هر سطح چند ده سؤال داشته باشی.' }));
    if (!shown.length) return list.appendChild(empty('پرسشی در این بخش نیست'));
    var names = {}; T.topics.forEach(function (t) { names[t.id] = t.nameFa; });
    shown.forEach(function (q) {
      var next = q.status === 'retired' ? 'approved' : 'retired';
      list.appendChild(h('div', { class: 'card', style: 'padding:12px' }, [
        h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [badge(names[q.topicId] || 'موضوع نامعلوم', 'b-info'), badge(diffName(q.difficulty), q.difficulty === 1 ? 'b-ok' : q.difficulty === 3 ? 'b-bad' : 'b-mute'), q.plays ? h('span', { style: 'color:var(--muted);font-size:12px', text: fa(q.plays) + ' بار جواب داده شد، ' + fa(Math.round(q.rightCount * 100 / q.plays)) + '٪ درست' + (q.measured ? ' ← اندازه‌گیری: ' + diffName(q.measured) : '') }) : null, q.measured && q.measured !== q.difficulty ? h('button', { class: 'btn sm', text: 'قبول «' + diffName(q.measured) + '»', onclick: function () { api('/admin/trivia/' + q.id, { method: 'PATCH', body: { difficulty: q.measured } }).then(function (r) { r.ok ? (toast('سختی عوض شد'), reload()) : fail(r); }); } }) : null, q.authorId ? badge('طراح بازیکن', 'b-info') : null, q.ageTrack !== 'adult' ? badge(q.ageTrack === 'kid' ? 'کودک' : 'نوجوان', 'b-warn') : null, h('b', { text: q.textFa })]),
        h('div', { class: 'pz-items', style: 'margin-top:6px' }, q.options.map(function (o, i) { return h('span', { class: 'pz-item', text: (i === q.correctIndex ? '✓ ' : '') + o, style: i === q.correctIndex ? 'font-weight:700' : '' }); })),
        h('div', { class: 'toolbar', style: 'margin-top:8px' }, [
          h('button', { class: 'btn sm', text: 'ویرایش', onclick: function () { openForm(q); } }),
          q.status === 'draft' ? h('button', { class: 'btn sm ok', text: 'تأیید', onclick: function () { setStatus(q, 'approved'); } }) : null,
          h('button', { class: 'btn sm ' + (next === 'retired' ? 'bad' : 'ok'), text: next === 'retired' ? 'بازنشسته کن' : 'فعال کن', onclick: function () { setStatus(q, next); } })
        ])
      ]));
    });
  }
  function setStatus(q, status) { api('/admin/trivia/' + q.id, { method: 'PATCH', body: { status: status } }).then(function (r) { r.ok ? (toast('انجام شد'), reload()) : fail(r); }); }
  function reload() {
    api('/admin/puzzle-topics').then(function (t) {
      T.topics = t.ok ? t.body.topics : [];
      api('/admin/trivia?status=' + T.status + (T.topic ? '&topicId=' + T.topic : '')).then(function (r) {
        if (r.status === 404) { clear(root); return root.appendChild(empty('پرسش‌های عمومی روی این سرور فعال نیست')); }
        if (!r.ok) return fail(r);
        T.rows = r.body.questions; draw();
      });
    });
  }
  root.appendChild(bar); root.appendChild(list);
  reload();
};
`;
