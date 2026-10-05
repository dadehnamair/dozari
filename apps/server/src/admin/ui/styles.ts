/** Design system of the admin panel: tokens, layout, components. Light and dark, RTL, self-hosted font (served from /admin/fonts, no external requests). */
export const ADMIN_CSS = String.raw`
@font-face { font-family:Vazirmatn; font-weight:400; font-display:swap; src:url(/admin/fonts/Vazirmatn-Regular.ttf) format("truetype"); }
@font-face { font-family:Vazirmatn; font-weight:700; font-display:swap; src:url(/admin/fonts/Vazirmatn-Bold.ttf) format("truetype"); }
:root { color-scheme: light dark;
  --bg:#f6f5f9; --card:#ffffff; --card2:#f8f7fb; --ink:#241238; --muted:#6f6682; --line:#e6e0f1;
  --brand:#7a3fd1; --brand2:#a66bf0; --brandink:#ffffff; --gold:#ffc93c;
  --ok:#17803f; --okbg:#e0f5e8; --warn:#9a5b00; --warnbg:#fff0d0; --bad:#b3261e; --badbg:#fde6e4; --info:#3347a8; --infobg:#e7eafb;
  --side1:#ffffff; --side2:#ffffff; --shadow:0 1px 2px rgba(36,18,56,.05); --r:14px; }
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
.side { background:var(--card); color:var(--ink); border-inline-end:1px solid var(--line); padding:14px 10px; position:sticky; top:0; height:100vh; overflow:auto; display:flex; flex-direction:column; gap:2px; }
.brand { display:flex; align-items:center; gap:10px; padding:4px 10px 14px; font-size:20px; font-weight:800; }
.brand i { width:34px; height:34px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#fff4b0,#ffc93c 55%,#d98a0b); display:grid; place-items:center; color:#7a4a00; font-style:normal; font-size:18px; }
.nav-title { font-size:12px; font-weight:700; color:var(--muted); padding:16px 12px 4px; margin-top:6px; border-top:1px solid var(--line); } .nav-title:first-child { border-top:0; margin-top:0; }
.nav a { display:flex; align-items:center; gap:10px; padding:7px 12px; border-radius:10px; color:var(--ink); text-decoration:none; font-size:14px; }
.nav a:hover { background:var(--card2); }
.nav a[aria-current=page] { background:color-mix(in srgb,var(--brand) 13%,transparent); color:var(--brand); font-weight:700; }
.nav svg { width:18px; height:18px; flex:none; opacity:.8; }
.nav .count { margin-inline-start:auto; background:var(--gold); color:#3a2500; border-radius:99px; padding:0 8px; font-size:12px; font-weight:700; }
.side .foot { margin-top:auto; padding:10px; font-size:12px; color:var(--muted); }
.main { min-width:0; display:flex; flex-direction:column; }
.top { position:sticky; top:0; z-index:5; display:flex; gap:10px; align-items:center; padding:12px 28px; background:color-mix(in srgb,var(--bg) 90%,transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
.top h1 { margin:0; font-size:20px; flex:1; }
.content { padding:22px 24px 60px; max-width:1240px; width:100%; margin:0 auto; }
.menu-btn { display:none; }
.card { background:var(--card); border:1px solid var(--line); border-radius:var(--r); box-shadow:var(--shadow); padding:18px; margin-bottom:16px; }
.card h2 { margin:0 0 4px; font-size:17px; }
.add-head { display:flex; align-items:flex-start; gap:12px; justify-content:space-between; flex-wrap:wrap; } .add-head .sub { margin-bottom:0; max-width:62ch; } .add-head .btn { flex:none; }
.page-desc { color:var(--muted); font-size:13px; margin:0 0 14px; max-width:80ch; }
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
.btn.primary { background:linear-gradient(180deg,var(--brand2),var(--brand)); color:var(--brandink); border-color:transparent; font-weight:700; box-shadow:0 1px 2px rgba(0,0,0,.2); }
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

.tabs { display:flex; gap:4px; border-bottom:1px solid var(--line); margin-bottom:16px; overflow:auto; }
.tab { background:none; border:0; border-bottom:3px solid transparent; padding:9px 16px; cursor:pointer; color:var(--muted); font-weight:600; white-space:nowrap; display:flex; gap:6px; align-items:center; }
.tab[aria-selected=true] { color:var(--brand); border-bottom-color:var(--brand); }
.tab .count { background:var(--card2); border:1px solid var(--line); border-radius:99px; padding:0 7px; font-size:12px; color:var(--ink); }
.callout { background:var(--infobg); color:var(--info); border-radius:12px; padding:10px 14px; font-size:13.5px; margin-bottom:14px; } .callout.warn { background:var(--warnbg); color:var(--warn); }
.card.inline { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
.pz-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(420px,1fr)); } .pz { margin:0; }
.pz-head { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
.pz-groups { display:grid; gap:8px; }
.pz-group { border-inline-start:6px solid var(--lv); background:var(--card2); border-radius:10px; padding:8px 10px; display:grid; gap:6px; }
.pz-group input { font-weight:700; padding:5px 10px; }
.pz-items { display:flex; flex-wrap:wrap; gap:5px; } .pz-item { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:1px 9px; font-size:13px; }
.bd { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:16px; align-items:start; }
.bd-groups { display:grid; gap:12px; }
.bd-group { background:var(--card); border:2px solid var(--line); border-top:6px solid var(--lv); border-radius:var(--r); padding:12px; display:grid; gap:8px; cursor:pointer; }
.bd-group.active { border-color:var(--lv); box-shadow:0 0 0 4px color-mix(in srgb,var(--lv) 22%,transparent); }
.bd-lv { display:flex; justify-content:space-between; align-items:center; }
.slots { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.slot { min-height:62px; border:2px dashed var(--line); background:var(--card2); border-radius:12px; cursor:pointer; display:flex; align-items:center; gap:6px; padding:4px 8px; color:var(--muted); font-size:12.5px; justify-content:center; text-align:center; }
.slot.full { border-style:solid; border-color:var(--lv); background:var(--card); color:var(--ink); justify-content:flex-start; font-weight:600; position:relative; }
.slot.full .icon-tile { width:34px; height:34px; border-radius:10px; border-width:1.5px; box-shadow:none; } .slot.full .icon-tile svg { width:24px; height:24px; }
.slot.full i { position:absolute; inset-inline-end:6px; top:2px; font-style:normal; color:var(--bad); }
.bd-bar { position:sticky; bottom:0; display:flex; gap:10px; align-items:center; background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:10px 14px; margin-top:12px; box-shadow:0 -6px 20px rgba(0,0,0,.06); }
.progress { width:140px; height:8px; background:var(--card2); border-radius:9px; overflow:hidden; border:1px solid var(--line); } .progress i { display:block; height:100%; background:var(--brand); }
.bd-side { position:sticky; top:70px; background:var(--card); border:1px solid var(--line); border-radius:var(--r); padding:12px; display:grid; gap:8px; }
.picker-list { max-height:62vh; overflow:auto; display:grid; gap:4px; }
.pick { display:flex; gap:10px; align-items:center; text-align:start; background:transparent; border:1px solid transparent; border-radius:10px; padding:4px 6px; cursor:pointer; }
.pick:hover { background:var(--card2); border-color:var(--brand); }
.pick .icon-tile { width:38px; height:38px; border-radius:11px; border-width:1.5px; box-shadow:none; } .pick .icon-tile svg { width:28px; height:28px; }
.pick .pn { display:flex; flex-direction:column; line-height:1.3; } .pick small { color:var(--muted); }
@media (max-width:1000px) { .bd { grid-template-columns:1fr; } .bd-side { position:static; } .pz-grid { grid-template-columns:1fr; } .slots { grid-template-columns:repeat(2,1fr); } }
`;
