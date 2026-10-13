/** Admin view: the leave log, who left a running duel or table and how (docs/logic/leave-penalty.md). Runs in the shared admin script scope. */
export const ADMIN_VIEWS2_LEAVES_JS = String.raw`
VIEWS.leaves = function (root) {
  var list = h('div'), sum = h('div');
  var KIND = { manual: 'خودش رفت', absent: 'قطع شد و برنگشت' };
  function draw() {
    api('/admin/leaves?limit=300').then(function (r) {
      clear(list); clear(sum);
      if (r.status === 404) return list.appendChild(empty('گزارش ترک روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      var rules = r.body.rules, rows = r.body.rows;
      sum.appendChild(h('div', { class: 'hint', text: 'قانون فعلی: ' + (rules.dayBanCount > 0 ? fa(rules.dayBanCount) + ' ترک در یک روز بازی را تا پایان روز می‌بندد' : 'محرومیت روزانه خاموش است') + ' · ' + (rules.badgeCount > 0 ? fa(rules.badgeCount) + ' ترک در ' + fa(rules.badgeWindowDays) + ' روز نشان «ترک‌کننده» می‌دهد' : 'نشان ترک‌کننده خاموش است') + '. اعداد در «تنظیمات ← بازی» عوض می‌شود.' }));
      if (!rows.length) return list.appendChild(empty('هنوز کسی بازی را وسطش رها نکرده'));
      // Leaves per player in this list, so a repeat leaver stands out.
      var count = {}; rows.forEach(function (x) { count[x.userId] = (count[x.userId] || 0) + 1; });
      rows.forEach(function (x) {
        list.appendChild(h('div', { class: 'kv' }, [
          h('span', { text: x.nickname }),
          h('span', { style: 'display:flex;gap:6px;align-items:center;color:var(--muted);font-size:12px' }, [
            count[x.userId] > 1 ? badge(fa(count[x.userId]) + ' ترک در این فهرست', 'b-warn') : null,
            badge(KIND[x.kind] || x.kind, x.kind === 'manual' ? 'b-info' : 'b-mute'),
            h('span', { text: ago(x.at) })
          ])
        ]));
      });
    });
  }
  root.appendChild(sum); root.appendChild(list);
  draw();
};
`;
