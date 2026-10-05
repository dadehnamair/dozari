/** Admin panel views: Users and the live socket view (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_USERS_JS = String.raw`/* ---------------- socket + audit ---------------- */
VIEWS.socket = function (root) {
  var box = h('div'), timer;
  root.appendChild(box);
  function pull() {
    if (S.route !== 'socket') return clearInterval(timer);
    api('/admin/socket').then(function (r) {
      if (r.status === 404) { clearInterval(timer); clear(box); return box.appendChild(empty('سرویس سوکت روی این سرور فعال نیست')); }
      if (!r.ok) return; var s = r.body; clear(box);
      box.appendChild(h('div', { class: 'grid' }, [statCard('اتصال فعال', fa(s.connections), '', '#3fc1f0'), statCard('بیشترین اتصال همزمان', fa(s.peakConnections), '', '#a66bf0'), statCard('کل اتصال‌ها', faNum(s.totalConnections), '', '#7ed957'), statCard('اتصال ردشده', fa(s.rejectedHandshakes), 'توکن نامعتبر', '#ff4d8d'), statCard('در صف', fa(s.queueLength), 'بیشترین انتظار ' + fa(s.longestWaitSec) + ' ثانیه', '#ffc93c'), statCard('مسابقه فعال', fa(s.activeMatches), '', '#ff7a3d'), statCard('زمان روشن بودن', fa(Math.floor(s.uptimeSec / 3600)) + ' ساعت', fa(Math.floor((s.uptimeSec % 3600) / 60)) + ' دقیقه', '#3fc1f0')]));
    });
  }
  pull(); timer = setInterval(pull, 3000);
};
`;
