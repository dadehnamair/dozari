import { ADMIN_CORE_JS } from './ui/core.js';
import { ADMIN_BOOT_JS, ADMIN_SHELL_JS } from './ui/shell.js';
import { ADMIN_CSS } from './ui/styles.js';
import { ADMIN_VIEWS1_JS } from './ui/views1.js';
import { ADMIN_VIEWS2_JS } from './ui/views2.js';

/**
 * The admin single-page app served at GET /admin. Self-contained (no external fonts, scripts or requests); all data is
 * inserted with textContent / DOM APIs, never innerHTML. The page itself carries no data: every call needs the token.
 */
export const ADMIN_PAGE_HTML = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>پنل ادمین دوزاری</title>
<style>${ADMIN_CSS}</style>
</head>
<body>
<div id="login" class="login card" hidden>
  <h1>پنل ادمین دوزاری</h1>
  <div class="sub" style="color:var(--muted);margin-bottom:12px">توکن ادمین (مقدار ADMIN_TOKEN در فایل .env) را وارد کن.</div>
  <form id="login-form" style="display:flex;flex-direction:column;gap:10px">
    <input id="login-token" type="password" autocomplete="off" placeholder="توکن ادمین">
    <button class="btn primary" type="submit" style="justify-content:center">ورود</button>
    <div id="login-msg" class="flag" style="background:transparent;color:var(--bad)"></div>
  </form>
</div>
<div id="app" class="shell" hidden>
  <aside class="side">
    <div class="brand"><i>۲</i><span>دوزاری</span></div>
    <nav id="nav" class="nav"></nav>
    <div class="foot">پنل مدیریت</div>
  </aside>
  <div class="main">
    <div class="top">
      <button id="menu" class="btn menu-btn" aria-label="منو">☰</button>
      <h1 id="title"></h1>
      <button id="theme" class="btn sm" aria-label="تغییر تم">🌓</button>
      <button id="logout" class="btn sm">خروج</button>
    </div>
    <div class="content" id="view"></div>
  </div>
</div>
<div id="toasts" class="toast-area" aria-live="polite"></div>
<script>
(function () {
'use strict';
${ADMIN_CORE_JS}
${ADMIN_SHELL_JS}
${ADMIN_VIEWS1_JS}
${ADMIN_VIEWS2_JS}
${ADMIN_BOOT_JS}
})();
</script>
</body>
</html>`;
