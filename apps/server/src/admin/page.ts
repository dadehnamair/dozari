import { ADMIN_CORE_JS } from './ui/core.js';
import { ADMIN_KIT_JS } from './ui/kit.js';
import { ADMIN_BOOT_JS, ADMIN_SHELL_JS } from './ui/shell.js';
import { ADMIN_CSS } from './ui/styles.js';
import { ADMIN_VIEWS1_JS } from './ui/views1.js';
import { ADMIN_VIEWS2_JS } from './ui/views2.js';
import { ADMIN_VIEWS3_JS } from './ui/views3.js';

/**
 * The admin single-page app served at GET /admin. Self-contained (no external fonts, scripts or requests); all data is
 * inserted with textContent / DOM APIs, never innerHTML. The page itself carries no data: every call needs the token.
 */
export const ADMIN_PAGE_HTML = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مرکز مدیریت دوزاری</title>
<style>${ADMIN_CSS}</style>
</head>
<body>
<div id="login" class="login-wrap" hidden>
  <section class="login-art">
    <div class="brand"><i>۲</i><span>دوزاری<small>مرکز مدیریت</small></span></div>
    <p>همه‌ی بازی در یک جا: محتوا و قیمت‌ها، بازیکن‌ها، اقتصاد سکه، پیام‌ها و تنظیمات زنده‌ی سرور.</p>
    <ul><li>هر تغییر با نام خودت در گزارش ثبت می‌شود</li><li>دسترسی‌ها بر پایه‌ی نقش است</li><li>جستجوی سریع با Ctrl + K</li></ul>
  </section>
  <section class="login-form">
    <div class="login-box">
      <h1>ورود به پنل</h1>
      <div class="sub">با نام کاربری و رمز خودت وارد شو.</div>
      <form id="login-form">
        <input id="login-user" type="text" autocomplete="username" placeholder="نام کاربری" dir="ltr" aria-label="نام کاربری">
        <input id="login-pass" type="password" autocomplete="current-password" placeholder="رمز" dir="ltr" aria-label="رمز">
        <input id="login-token" type="password" autocomplete="off" placeholder="توکن اصلی (ADMIN_TOKEN)" dir="ltr" aria-label="توکن اصلی" hidden>
        <button class="btn primary" type="submit" style="justify-content:center;padding:9px">ورود</button>
        <button id="login-mode" class="btn ghost sm" type="button" style="justify-content:center">ورود با توکن اصلی</button>
        <div id="login-msg" class="err" role="alert"></div>
      </form>
    </div>
  </section>
</div>
<div id="app" class="shell" hidden>
  <aside class="side">
    <div class="brand"><i>۲</i><span>دوزاری<small>مرکز مدیریت</small></span></div>
    <button id="side-search" class="side-search" type="button"><span>جستجو و پرش سریع…</span><kbd>Ctrl K</kbd></button>
    <nav id="nav" class="nav" aria-label="منوی اصلی"></nav>
    <div class="side-foot">
      <div id="avatar" class="avatar"></div>
      <div class="who"><b id="who-name"></b><span id="who-role"></span></div>
      <button id="logout" class="icon-btn" aria-label="خروج" title="خروج"></button>
    </div>
  </aside>
  <div class="main">
    <div class="top">
      <button id="menu" class="icon-btn menu-btn" aria-label="منو"></button>
      <div id="crumb" class="crumb"></div>
      <button id="quick" class="quick" type="button"><span>جستجو…</span><kbd>Ctrl K</kbd></button>
      <button id="theme" class="icon-btn" aria-label="تغییر تم" title="تغییر تم"></button>
    </div>
    <main class="content" id="view"></main>
  </div>
</div>
<div id="toasts" class="toast-area" aria-live="polite"></div>
<script>
(function () {
'use strict';
${ADMIN_CORE_JS}
${ADMIN_KIT_JS}
${ADMIN_SHELL_JS}
${ADMIN_VIEWS1_JS}
${ADMIN_VIEWS2_JS}
${ADMIN_VIEWS3_JS}
${ADMIN_BOOT_JS}
})();
</script>
</body>
</html>`;
