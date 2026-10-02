/** Design system of the admin panel: tokens, layout, components. Light and dark, RTL, self-hosted font (served from /admin/fonts, no external requests). */
export const ADMIN_CSS = String.raw`
@font-face { font-family:Vazirmatn; font-weight:400; font-display:swap; src:url(/admin/fonts/Vazirmatn-Regular.ttf) format("truetype"); }
@font-face { font-family:Vazirmatn; font-weight:700; font-display:swap; src:url(/admin/fonts/Vazirmatn-Bold.ttf) format("truetype"); }
:root { color-scheme: light dark;
  --bg:#f4f1fa; --card:#ffffff; --card2:#faf8fe; --ink:#241238; --muted:#6f6682; --line:#e6e0f1;
  --brand:#7a3fd1; --brand2:#a66bf0; --brandink:#ffffff; --gold:#ffc93c;
  --ok:#17803f; --okbg:#e0f5e8; --warn:#9a5b00; --warnbg:#fff0d0; --bad:#b3261e; --badbg:#fde6e4; --info:#3347a8; --infobg:#e7eafb;
  --side1:#2b1240; --side2:#4b1f78; --shadow:0 1px 2px rgba(36,18,56,.06),0 8px 24px rgba(36,18,56,.07); --r:16px; }
@media (prefers-color-scheme: dark) { :root:not([data-theme=light]) {
  --bg:#150d20; --card:#1f152d; --card2:#251a36; --ink:#f1ebfa; --muted:#a89cbd; --line:#34264a;
  --brand:#b78cff; --brand2:#8d5be0; --brandink:#1a0d2b;
  --ok:#74d69d; --okbg:#173a27; --warn:#f0b35a; --warnbg:#3a2a10; --bad:#f4a19a; --badbg:#431d1b; --info:#aab6ff; --infobg:#222a52;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35); } }
:root[data-theme=dark] { --bg:#150d20; --card:#1f152d; --card2:#251a36; --ink:#f1ebfa; --muted:#a89cbd; --line:#34264a; --brand:#b78cff; --brand2:#8d5be0; --brandink:#1a0d2b;
  --ok:#74d69d; --okbg:#173a27; --warn:#f0b35a; --warnbg:#3a2a10; --bad:#f4a19a; --badbg:#431d1b; --info:#aab6ff; --infobg:#222a52; --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35); }
* { box-sizing:border-box; }
[hidden] { display:none !important; }
html { scroll-behavior:smooth; }
body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.65 Vazirmatn, Tahoma, "Segoe UI", system-ui, sans-serif; }
a { color:var(--brand); text-decoration:none; } a:hover { text-decoration:underline; }
input, select, textarea, button { font:inherit; color:inherit; }
.shell { display:grid; grid-template-columns:248px 1fr; min-height:100vh; }
.side { background:linear-gradient(180deg,var(--side1),var(--side2)); color:#f5eeff; padding:18px 12px; position:sticky; top:0; height:100vh; overflow:auto; display:flex; flex-direction:column; gap:4px; }
.brand { display:flex; align-items:center; gap:10px; padding:6px 10px 16px; font-size:22px; font-weight:800; letter-spacing:.3px; }
.brand i { width:38px; height:38px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#fff4b0,#ffc93c 55%,#d98a0b); border:3px solid #2b1240; display:grid; place-items:center; color:#7a4a00; font-style:normal; font-size:20px; box-shadow:0 3px 0 #1a0a2c; }
.nav-title { font-size:11px; letter-spacing:.6px; opacity:.55; padding:12px 12px 4px; }
.nav a { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:12px; color:#eadcff; text-decoration:none; }
.nav a:hover { background:rgba(255,255,255,.1); }
.nav a[aria-current=page] { background:rgba(255,255,255,.18); color:#fff; font-weight:700; box-shadow:inset 3px 0 0 var(--gold); }
.nav svg { width:19px; height:19px; flex:none; opacity:.9; }
.nav .count { margin-inline-start:auto; background:var(--gold); color:#3a2500; border-radius:99px; padding:0 8px; font-size:12px; font-weight:700; }
.side .foot { margin-top:auto; padding:10px; font-size:12px; opacity:.7; }
.main { min-width:0; display:flex; flex-direction:column; }
.top { position:sticky; top:0; z-index:5; display:flex; gap:10px; align-items:center; padding:12px 24px; background:color-mix(in srgb,var(--bg) 88%,transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
.top h1 { margin:0; font-size:20px; flex:1; }
.content { padding:22px 24px 60px; max-width:1180px; width:100%; margin:0 auto; }
.menu-btn { display:none; }
.card { background:var(--card); border:1px solid var(--line); border-radius:var(--r); box-shadow:var(--shadow); padding:18px; margin-bottom:16px; }
.card h2 { margin:0 0 4px; font-size:17px; }
.card > .sub { color:var(--muted); font-size:13px; margin-bottom:12px; }
.grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); }
.stat-card { background:var(--card); border:1px solid var(--line); border-radius:var(--r); box-shadow:var(--shadow); padding:16px; display:flex; flex-direction:column; gap:2px; position:relative; overflow:hidden; }
.stat-card::after { content:""; position:absolute; inset-inline-end:-18px; top:-18px; width:70px; height:70px; border-radius:50%; background:var(--tint,var(--brand2)); opacity:.14; }
.stat-card .n { font-size:30px; font-weight:800; line-height:1.2; direction:ltr; text-align:right; }
.stat-card .l { color:var(--muted); font-size:13px; }
.stat-card .d { font-size:12px; color:var(--muted); }
.stat-card a.go { font-size:12px; margin-top:6px; }
.btn { border:1px solid var(--line); background:var(--card); border-radius:11px; padding:7px 14px; cursor:pointer; transition:.12s; display:inline-flex; gap:6px; align-items:center; }
.btn:hover { border-color:var(--brand); transform:translateY(-1px); }
.btn.primary { background:linear-gradient(180deg,var(--brand2),var(--brand)); color:var(--brandink); border-color:transparent; font-weight:700; box-shadow:0 3px 0 rgba(0,0,0,.18); }
.btn.ok { background:var(--okbg); color:var(--ok); border-color:transparent; } .btn.bad { background:var(--badbg); color:var(--bad); border-color:transparent; }
.btn.ghost { background:transparent; } .btn.sm { padding:3px 10px; font-size:13px; } .btn[disabled] { opacity:.5; cursor:not-allowed; transform:none; }
input[type=text], input[type=password], input[type=search], input[type=number], input[type=url], select, textarea { width:100%; background:var(--card2); border:1px solid var(--line); border-radius:11px; padding:8px 12px; outline:none; }
textarea { min-height:84px; resize:vertical; }
input:focus, select:focus, textarea:focus { border-color:var(--brand); box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 22%,transparent); }
label.f { display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--muted); }
.form-grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); }
.toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
.toolbar input[type=search] { max-width:300px; }
.chip { border:1px solid var(--line); background:var(--card); border-radius:99px; padding:3px 12px; cursor:pointer; font-size:13px; }
.chip[aria-pressed=true] { background:var(--brand); color:var(--brandink); border-color:transparent; }
.badge { display:inline-block; border-radius:99px; padding:0 9px; font-size:12px; line-height:20px; white-space:nowrap; }
.b-ok { background:var(--okbg); color:var(--ok); } .b-warn { background:var(--warnbg); color:var(--warn); } .b-bad { background:var(--badbg); color:var(--bad); } .b-info { background:var(--infobg); color:var(--info); } .b-mute { background:var(--card2); color:var(--muted); border:1px solid var(--line); }
table { width:100%; border-collapse:collapse; } th, td { text-align:start; padding:9px 10px; border-bottom:1px solid var(--line); vertical-align:middle; } th { font-size:12px; color:var(--muted); font-weight:600; background:var(--card2); position:sticky; top:0; }
tr:last-child td { border-bottom:0; } .ltr { direction:ltr; unicode-bidi:embed; } .num { font-variant-numeric:tabular-nums; }
.tbl-wrap { overflow:auto; border:1px solid var(--line); border-radius:12px; }
.pgrid { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); }
.pcard { background:var(--card); border:1px solid var(--line); border-radius:var(--r); box-shadow:var(--shadow); padding:12px; display:flex; gap:12px; align-items:center; cursor:pointer; transition:.12s; }
.pcard:hover { border-color:var(--brand); transform:translateY(-2px); }
.icon-tile { width:58px; height:58px; border-radius:16px; background:radial-gradient(circle at 30% 22%,#fff6d8,#ffe9b8 60%); border:2px solid #3a2418; display:grid; place-items:center; flex:none; box-shadow:0 3px 0 #3a2418; } .icon-tile svg { width:40px; height:40px; }
.icon-tile.empty { background:var(--card2); border-style:dashed; border-color:var(--line); box-shadow:none; color:var(--muted); font-size:22px; }
.pcard .t { font-weight:700; } .pcard .m { color:var(--muted); font-size:12.5px; }
.empty-state { text-align:center; padding:40px 10px; color:var(--muted); }
.overlay { position:fixed; inset:0; background:rgba(15,6,26,.55); z-index:20; display:flex; align-items:flex-start; justify-content:center; padding:4vh 12px; overflow:auto; }
.modal { background:var(--card); border-radius:20px; box-shadow:0 30px 80px rgba(0,0,0,.4); width:min(760px,100%); border:1px solid var(--line); }
.modal header { display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid var(--line); } .modal header h3 { margin:0; flex:1; font-size:17px; }
.modal .body { padding:18px; display:flex; flex-direction:column; gap:14px; } .modal footer { padding:12px 18px; border-top:1px solid var(--line); display:flex; gap:8px; justify-content:flex-end; }
.icon-pick { display:grid; grid-template-columns:repeat(auto-fill,minmax(78px,1fr)); gap:8px; max-height:46vh; overflow:auto; padding:2px; }
.icon-pick button { background:var(--card2); border:2px solid var(--line); border-radius:14px; padding:6px 4px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; font-size:11px; color:var(--muted); }
.icon-pick button:hover, .icon-pick button[aria-pressed=true] { border-color:var(--brand); color:var(--ink); } .icon-pick svg { width:40px; height:40px; }
.toast-area { position:fixed; inset-inline-start:18px; bottom:18px; z-index:50; display:flex; flex-direction:column; gap:8px; }
.toast { background:#2b1240; color:#fff; border-radius:12px; padding:10px 16px; box-shadow:0 10px 30px rgba(0,0,0,.35); border-inline-start:4px solid var(--gold); animation:pop .2s; } .toast.err { border-inline-start-color:#ff6b6b; }
@keyframes pop { from { transform:translateY(10px); opacity:0; } }
.kv { display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid var(--line); } .kv:last-child { border-bottom:0; }
.setting { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(150px,.7fr) auto; gap:10px 14px; align-items:center; padding:12px 0; border-bottom:1px solid var(--line); } .setting:last-child { border-bottom:0; }
.setting .l { font-weight:600; } .setting .h { color:var(--muted); font-size:12.5px; }
.cand { border:1px solid var(--line); border-radius:var(--r); background:var(--card); box-shadow:var(--shadow); padding:14px; margin-bottom:12px; display:grid; gap:10px; }
.cand .head { display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; } .cand .name { font-size:17px; font-weight:800; } .cand .price { font-size:18px; font-weight:800; color:var(--brand); }
.quote { background:var(--card2); border-inline-start:3px solid var(--brand2); border-radius:8px; padding:6px 10px; font-size:13px; color:var(--muted); }
.login { max-width:380px; margin:12vh auto; } .login h1 { margin-top:0; }
.flag { background:var(--warnbg); color:var(--warn); border-radius:8px; padding:2px 8px; font-size:12.5px; display:inline-block; }
@media (max-width:860px) { .shell { grid-template-columns:1fr; } .side { position:fixed; inset-block:0; inset-inline-start:0; width:260px; z-index:30; transform:translateX(110%); transition:.2s; } body.nav-open .side { transform:none; } .menu-btn { display:inline-flex; } .top { padding:10px 14px; } .content { padding:14px 14px 60px; } .setting { grid-template-columns:1fr; } }
`;
