/** Admin panel view: database backups to S3-compatible storage (browser JS, concatenated into one script by ../views2.ts). */
export const ADMIN_VIEWS2_BACKUPS_JS = String.raw`VIEWS.backups = function (root) {
  var WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  var BERR = { invalid_request: 'ورودی نامعتبر است؛ آدرس سرور (با http یا https)، نام باکت و زمان‌بندی را بررسی کن', too_many: 'به سقف تعداد مقصدها رسیده‌ای', busy: 'یک بک‌آپ همین الان در حال اجراست', not_found: 'پیدا نشد', secret_unreadable: 'کلید مخفی ذخیره‌شده خوانده نمی‌شود؛ کلید را دوباره وارد کن', secret_required: 'کلید مخفی را وارد کن', failed: 'ارتباط با فضای ذخیره‌سازی ناموفق بود' };
  var list = h('div');
  var openRuns = {}, timer = null;
  function when(ms) { return ms ? new Date(ms).toLocaleString('fa-IR') : '—'; }
  function size(b) { if (b === null || b === undefined) return '—'; if (b < 1024) return fa(b) + ' بایت'; if (b < 1048576) return fa((b / 1024).toFixed(1)) + ' کیلوبایت'; if (b < 1073741824) return fa((b / 1048576).toFixed(1)) + ' مگابایت'; return fa((b / 1073741824).toFixed(2)) + ' گیگابایت'; }
  function scheduleText(s) {
    if (s.kind === 'hourly') return 'هر ' + fa(s.everyHours) + ' ساعت';
    if (s.kind === 'daily') return 'هر روز ساعت ' + fa(s.time);
    return 'هر ' + WEEKDAYS[s.weekday] + ' ساعت ' + fa(s.time);
  }
  function retentionText(r) {
    var p = [];
    if (r.maxAgeDays) p.push('بک‌آپ‌های قدیمی‌تر از ' + fa(r.maxAgeDays) + ' روز');
    if (r.maxCount) p.push('هر چه بیشتر از ' + fa(r.maxCount) + ' بک‌آپ آخر');
    return p.length ? 'پاک می‌شود: ' + p.join(' و ') + ' (آخرین بک‌آپ سالم همیشه می‌ماند)' : 'هیچ‌وقت خودکار پاک نمی‌شود';
  }
  function statusBadge(r) {
    if (r.deletedAt) return badge(r.deletedReason === 'retention' ? 'پاک شد (طبق برنامه)' : 'پاک شد (دستی)', 'b-mute');
    return r.status === 'ok' ? badge('سالم', 'b-ok') : r.status === 'running' ? badge('در حال اجرا…', 'b-info') : badge('ناموفق', 'b-bad');
  }
  function num(v, min, max, w) { return h('input', { type: 'number', value: v === null || v === undefined ? '' : v, min: min, max: max, style: 'width:' + (w || 90) + 'px' }); }
  function openForm(t) {
    var name = h('input', { type: 'text', value: t ? t.name : '', maxlength: 80, placeholder: 'مثلاً لیارا — روزانه' });
    var endpoint = h('input', { type: 'text', value: t ? t.endpoint : '', dir: 'ltr', placeholder: 'https://s3.example.com' });
    var region = h('input', { type: 'text', value: t ? t.region : '', dir: 'ltr', maxlength: 60, placeholder: 'خالی = پیش‌فرض' });
    var bucket = h('input', { type: 'text', value: t ? t.bucket : '', dir: 'ltr', maxlength: 120 });
    var prefix = h('input', { type: 'text', value: t ? t.prefix : '', dir: 'ltr', maxlength: 200, placeholder: 'مثلاً dozari/db (اختیاری)' });
    var access = h('input', { type: 'text', value: t ? t.accessKey : '', dir: 'ltr', maxlength: 200, autocomplete: 'off' });
    var secret = h('input', { type: 'password', dir: 'ltr', maxlength: 300, autocomplete: 'new-password', placeholder: t ? 'خالی = بدون تغییر' : '' });
    var active = h('input', { type: 'checkbox' }); active.checked = t ? t.isActive : true;
    var s = t ? t.schedule : { kind: 'daily', time: '03:00' };
    var kind = select([['hourly', 'هر چند ساعت'], ['daily', 'هر روز'], ['weekly', 'هر هفته']], s.kind);
    var every = num(s.kind === 'hourly' ? s.everyHours : 6, 1, 720, 80);
    var time = h('input', { type: 'time', value: s.time || '03:00' });
    var weekday = select(WEEKDAYS.map(function (d, i) { return [String(i), d]; }), String(s.kind === 'weekly' ? s.weekday : 0));
    var r = t ? t.retention : { maxAgeDays: 14, maxCount: null };
    var keepDays = num(r.maxAgeDays, 1, 3650), keepCount = num(r.maxCount, 1, 1000);
    var everyF = field('هر چند ساعت', every), timeF = field('ساعت اجرا (به وقت ایران)', time), dayF = field('روز هفته', weekday);
    function sync() { everyF.style.display = kind.value === 'hourly' ? '' : 'none'; timeF.style.display = kind.value === 'hourly' ? 'none' : ''; dayF.style.display = kind.value === 'weekly' ? '' : 'none'; }
    kind.addEventListener('change', sync); sync();
    function schedule() { return kind.value === 'hourly' ? { kind: 'hourly', everyHours: +every.value } : kind.value === 'daily' ? { kind: 'daily', time: time.value } : { kind: 'weekly', weekday: +weekday.value, time: time.value }; }
    function bodyOf() {
      var b = { name: name.value.trim(), endpoint: endpoint.value.trim(), region: region.value.trim(), bucket: bucket.value.trim(), prefix: prefix.value.trim(), accessKey: access.value.trim(), isActive: active.checked, schedule: schedule(), retention: { maxAgeDays: keepDays.value ? +keepDays.value : null, maxCount: keepCount.value ? +keepCount.value : null } };
      if (secret.value) b.secretKey = secret.value;
      return b;
    }
    var testBtn = h('button', { type: 'button', class: 'btn', text: 'تست اتصال', onclick: function () {
      var b = bodyOf();
      api('/admin/backups/test', { method: 'POST', body: { id: t ? t.id : undefined, endpoint: b.endpoint, region: b.region, bucket: b.bucket, prefix: b.prefix, accessKey: b.accessKey, secretKey: b.secretKey } }).then(function (x) {
        if (!x.ok) return fail(x);
        if (x.body.ok) toast('اتصال و نوشتن در باکت درست کار می‌کند'); else toast((BERR[x.body.error] || 'ناموفق') + (x.body.message ? ': ' + x.body.message : ''), true);
      });
    } });
    formModal(t ? 'ویرایش مقصد' : 'مقصد تازه', [
      ['نام', name], ['آدرس سرور S3', endpoint, 'با http یا https و بدون نام باکت'], ['ریجن', region], ['نام باکت', bucket], ['پوشه (پیشوند) داخل باکت', prefix],
      ['Access Key', access], ['Secret Key', secret, t ? 'ذخیره‌شده است و نمایش داده نمی‌شود' : 'رمزنگاری‌شده ذخیره می‌شود'],
      h('label', { class: 'f' }, [active, ' فعال (بک‌آپ خودکار بگیرد)']),
      ['نوع زمان‌بندی', kind], everyF, timeF, dayF,
      ['پاک‌کردن بعد از (روز)', keepDays, 'خالی = بر اساس سن پاک نشود'], ['فقط این‌قدر بک‌آپ آخر بماند', keepCount, 'خالی = بر اساس تعداد پاک نشود'],
      h('div', {}, [testBtn])
    ], function () {
      var b = bodyOf();
      if (!t && !b.secretKey) { toast(BERR.secret_required, true); return false; }
      return api(t ? '/admin/backups/' + t.id : '/admin/backups', { method: t ? 'PATCH' : 'POST', body: b }).then(function (x) { if (!x.ok) { toast(BERR[x.body && x.body.error] || 'نشد', true); return false; } toast('ذخیره شد'); draw(); return true; });
    });
  }
  function runsTable(t, box) {
    api('/admin/backups/' + t.id + '/runs').then(function (r) {
      clear(box);
      if (!r.ok) return fail(r);
      if (!r.body.runs.length) return box.appendChild(empty('هنوز بک‌آپی گرفته نشده'));
      box.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [
        h('thead', {}, [h('tr', {}, ['زمان', 'نوع', 'وضعیت', 'حجم', 'مدت', 'فایل در باکت', ''].map(function (x) { return h('th', { text: x }); }))]),
        h('tbody', {}, r.body.runs.map(function (run) {
          var live = run.status === 'ok' && !run.deletedAt;
          var dur = run.finishedAt ? fa(Math.max(1, Math.round((run.finishedAt - run.startedAt) / 1000))) + ' ثانیه' : '—';
          return h('tr', {}, [
            h('td', { text: when(run.startedAt) }), h('td', { text: run.trigger === 'schedule' ? 'خودکار' : 'دستی' }),
            h('td', {}, [statusBadge(run), run.error ? h('div', { class: 'h ltr', text: run.error, style: 'font-size:12px;max-width:340px;white-space:normal' }) : null]),
            h('td', { text: size(run.sizeBytes) }), h('td', { text: dur }), h('td', { class: 'ltr', text: run.objectKey }),
            h('td', {}, live ? [
              h('button', { class: 'btn sm', text: 'دانلود', onclick: function () { api('/admin/backups/runs/' + run.id + '/download', { method: 'POST' }).then(function (x) { if (!x.ok) return fail(x); window.open(x.body.url, '_blank', 'noopener'); toast('لینک دانلود ' + fa(Math.round(x.body.expiresInSeconds / 60)) + ' دقیقه اعتبار دارد'); }); } }),
              h('button', { class: 'btn sm bad', text: 'حذف', onclick: function () { if (!confirm('این فایل بک‌آپ از باکت پاک شود؟ برگشت ندارد.')) return; api('/admin/backups/runs/' + run.id, { method: 'DELETE' }).then(function (x) { if (!x.ok) return fail(x); toast('پاک شد'); draw(); }); } })
            ] : [])
          ]);
        }))
      ])]));
    });
  }
  function targetCard(t) {
    var runsBox = h('div');
    var last = t.lastRun;
    var info = h('div', { class: 'h', style: 'display:flex;flex-direction:column;gap:3px;margin:6px 0' }, [
      h('span', { class: 'ltr', text: t.endpoint + ' · ' + t.bucket + (t.prefix ? '/' + t.prefix : '') }),
      h('span', { text: 'زمان‌بندی: ' + scheduleText(t.schedule) + (t.isActive && t.nextRunAt ? ' · بک‌آپ بعدی: ' + when(t.nextRunAt) : '') }),
      h('span', { text: retentionText(t.retention) }),
      h('span', { text: 'در باکت: ' + fa(t.liveCount) + ' فایل · ' + size(t.liveBytes) }),
      last ? h('span', { text: 'آخرین تلاش: ' + ago(last.startedAt) + ' — ' + (last.status === 'ok' ? 'سالم (' + size(last.sizeBytes) + ')' : last.status === 'running' ? 'در حال اجرا' : 'ناموفق: ' + (last.error || '')) }) : h('span', { text: 'هنوز بک‌آپی گرفته نشده' })
    ]);
    function toggleRuns() { openRuns[t.id] = !openRuns[t.id]; if (openRuns[t.id]) runsTable(t, runsBox); else clear(runsBox); }
    if (openRuns[t.id]) runsTable(t, runsBox);
    return h('section', { class: 'card' }, [
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [h('h2', { text: t.name, style: 'margin:0' }), t.isActive ? badge('فعال', 'b-ok') : badge('خاموش', 'b-warn'), t.running ? badge('در حال بک‌گیری…', 'b-info') : null, t.secretOk ? null : badge('کلید مخفی خوانده نمی‌شود', 'b-bad')]),
      info,
      h('div', { class: 'toolbar' }, [
        h('button', { class: 'btn primary', text: 'همین حالا بک‌آپ بگیر', onclick: function () { api('/admin/backups/' + t.id + '/run', { method: 'POST' }).then(function (x) { if (!x.ok) { toast(BERR[x.body && x.body.error] || 'نشد', true); return; } toast('بک‌آپ شروع شد'); openRuns[t.id] = true; draw(); }); } }),
        h('button', { class: 'btn', text: 'لیست بک‌آپ‌ها', onclick: toggleRuns }),
        h('button', { class: 'btn', text: 'تست اتصال', onclick: function () { api('/admin/backups/test', { method: 'POST', body: { id: t.id, endpoint: t.endpoint, region: t.region, bucket: t.bucket, prefix: t.prefix, accessKey: t.accessKey } }).then(function (x) { if (!x.ok) return fail(x); if (x.body.ok) toast('اتصال و نوشتن در باکت درست کار می‌کند'); else toast((BERR[x.body.error] || 'ناموفق') + (x.body.message ? ': ' + x.body.message : ''), true); }); } }),
        h('button', { class: 'btn', text: 'ویرایش', onclick: function () { openForm(t); } }),
        h('button', { class: 'btn bad', text: 'حذف مقصد', onclick: function () {
          if (!confirm('مقصد «' + t.name + '» و تاریخچه‌اش از پنل حذف شود؟')) return;
          var files = t.liveCount > 0 && confirm('فایل‌های بک‌آپ این مقصد (' + fa(t.liveCount) + ' فایل) هم از باکت پاک شوند؟\nOK = پاک شوند · Cancel = در باکت بمانند');
          api('/admin/backups/' + t.id + '?deleteFiles=' + (files ? '1' : '0'), { method: 'DELETE' }).then(function (x) { if (!x.ok) { toast(BERR[x.body && x.body.error] || 'نشد', true); return; } toast('حذف شد'); draw(); });
        } })
      ]),
      runsBox
    ]);
  }
  function draw() {
    if (timer) { clearTimeout(timer); timer = null; }
    api('/admin/backups').then(function (r) {
      clear(list);
      if (r.status === 404) return list.appendChild(empty('بک‌آپ روی این سرور فعال نیست'));
      if (!r.ok) return fail(r);
      if (!r.body.targets.length) list.appendChild(empty('هنوز مقصدی اضافه نکرده‌ای', 'با «مقصد تازه» مشخصات یک سرور S3 را بده تا بک‌آپ دیتابیس خودکار بگیرد.'));
      r.body.targets.forEach(function (t) { list.appendChild(targetCard(t)); });
      if (r.body.targets.some(function (t) { return t.running; })) timer = setTimeout(function () { if (root.isConnected) draw(); }, 4000);
    });
  }
  root.appendChild(h('section', { class: 'card add-card' }, [h('div', { class: 'add-head' }, [h('div', {}, [h('h2', { text: 'مقصد تازه' }), h('div', { class: 'sub', text: 'هر مقصد یک سرور/باکت S3 با زمان‌بندی و قانون پاک‌شدن خودش دارد. فقط دیتابیس بک‌آپ می‌شود (فایل .sql.gz).' })]), h('button', { class: 'btn primary', text: '＋ مقصد تازه', onclick: function () { openForm(null); } })])]));
  root.appendChild(list);
  draw();
};
`;
