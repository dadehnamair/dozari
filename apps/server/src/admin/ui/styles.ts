/**
 * Design system of the admin panel: tokens, layout, components. Light and dark, RTL, self-hosted font (served from /admin/fonts, no external requests).
 * Neutral "ink + indigo" palette tuned for dense data screens; the brand gold only appears as an accent.
 */
export const ADMIN_CSS = String.raw`
@font-face { font-family:Vazirmatn; font-weight:400; font-display:swap; src:url(/admin/fonts/Vazirmatn-Regular.ttf) format("truetype"); }
@font-face { font-family:Vazirmatn; font-weight:700; font-display:swap; src:url(/admin/fonts/Vazirmatn-Bold.ttf) format("truetype"); }
:root { color-scheme: light dark;
  --bg:#f5f6fa; --surface:#ffffff; --surface2:#f8f9fc; --surface3:#eef0f6; --ink:#161a2b; --ink2:#3c4259; --muted:#6a7188; --line:#e3e6ef; --line2:#d3d8e6;
  --brand:#4f46e5; --brand-h:#4338ca; --brand-soft:#eceafd; --brandink:#ffffff; --gold:#f5b73b;
  --ok:#14804a; --okbg:#e2f6ea; --warn:#9a5b00; --warnbg:#fff1d6; --bad:#c0302a; --badbg:#fde8e6; --info:#2753c9; --infobg:#e6edfd;
  --side:#12162b; --side2:#1b2040; --sidetext:#aeb5d3; --sidehi:#ffffff;
  --shadow:0 1px 2px rgba(22,26,43,.05),0 4px 14px rgba(22,26,43,.05); --shadow-lg:0 24px 70px rgba(10,14,35,.35); --r:12px; --r-sm:8px; }
@media (prefers-color-scheme: dark) { :root:not([data-theme=light]) {
  --bg:#0d1020; --surface:#161a2e; --surface2:#1a1f36; --surface3:#222844; --ink:#eef0fb; --ink2:#c6cbe4; --muted:#8e96b8; --line:#272d4a; --line2:#343b5e;
  --brand:#8b84ff; --brand-h:#a29cff; --brand-soft:#252a52; --brandink:#0d1020;
  --ok:#5fd596; --okbg:#12332a; --warn:#f0b35a; --warnbg:#38290f; --bad:#f4958f; --badbg:#401d1c; --info:#8fb0ff; --infobg:#1c2850;
  --side:#0a0c1a; --side2:#141833; --shadow:0 1px 2px rgba(0,0,0,.4),0 4px 14px rgba(0,0,0,.3); } }
:root[data-theme=dark] { --bg:#0d1020; --surface:#161a2e; --surface2:#1a1f36; --surface3:#222844; --ink:#eef0fb; --ink2:#c6cbe4; --muted:#8e96b8; --line:#272d4a; --line2:#343b5e;
  --brand:#8b84ff; --brand-h:#a29cff; --brand-soft:#252a52; --brandink:#0d1020;
  --ok:#5fd596; --okbg:#12332a; --warn:#f0b35a; --warnbg:#38290f; --bad:#f4958f; --badbg:#401d1c; --info:#8fb0ff; --infobg:#1c2850;
  --side:#0a0c1a; --side2:#141833; --shadow:0 1px 2px rgba(0,0,0,.4),0 4px 14px rgba(0,0,0,.3); }
* { box-sizing:border-box; }
[hidden] { display:none !important; }
html { scroll-behavior:smooth; }
body { margin:0; background:var(--bg); color:var(--ink); font:14.5px/1.7 Vazirmatn, Tahoma, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
a { color:var(--brand); text-decoration:none; } a:hover { text-decoration:underline; }
input, select, textarea, button { font:inherit; color:inherit; }
:focus-visible { outline:2px solid var(--brand); outline-offset:2px; }
::selection { background:var(--brand-soft); }
.ltr { direction:ltr; unicode-bidi:embed; } .num { font-variant-numeric:tabular-nums; } .muted { color:var(--muted); }

/* ---------- shell ---------- */
.shell { display:grid; grid-template-columns:264px minmax(0,1fr); min-height:100vh; }
.side { background:linear-gradient(180deg,var(--side),var(--side2)); color:var(--sidetext); position:sticky; top:0; height:100vh; display:flex; flex-direction:column; }
.brand { display:flex; align-items:center; gap:11px; padding:18px 18px 14px; color:var(--sidehi); font-size:19px; font-weight:700; }
.brand i { width:34px; height:34px; border-radius:10px; background:linear-gradient(145deg,#ffd978,var(--gold)); display:grid; place-items:center; color:#4a3000; font-style:normal; font-size:18px; box-shadow:0 4px 12px rgba(245,183,59,.35); }
.brand small { display:block; font-size:11px; font-weight:400; color:var(--sidetext); opacity:.8; margin-top:-4px; }
.side-search { margin:0 14px 10px; display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); border-radius:10px; padding:7px 11px; cursor:pointer; color:var(--sidetext); font-size:13px; text-align:start; }
.side-search:hover { background:rgba(255,255,255,.12); }
.side-search kbd { margin-inline-start:auto; font:11px/1 monospace; background:rgba(255,255,255,.12); border-radius:5px; padding:3px 6px; direction:ltr; }
.nav { flex:1; overflow:auto; padding:4px 10px 12px; scrollbar-width:thin; }
.nav-sec { margin-bottom:2px; }
.nav-head { width:100%; display:flex; align-items:center; gap:11px; padding:9px 12px; border:0; background:transparent; border-radius:10px; color:var(--sidetext); cursor:pointer; text-align:start; font-weight:600; }
.nav-head:hover { background:rgba(255,255,255,.07); color:#fff; }
.nav-head svg { width:19px; height:19px; flex:none; opacity:.85; }
.nav-head .chev { margin-inline-start:auto; width:14px; height:14px; transition:transform .15s; opacity:.6; }
.nav-sec.open > .nav-head .chev { transform:rotate(-90deg); }
.nav-sec.active > .nav-head { color:#fff; }
.nav-sec.active > .nav-head svg { color:var(--gold); opacity:1; }
.nav-sub { display:none; margin:2px 0 6px; padding-inline-start:20px; border-inline-start:1px solid rgba(255,255,255,.12); margin-inline-start:21px; }
.nav-sec.open > .nav-sub { display:block; }
.nav-sub a { display:flex; align-items:center; gap:8px; padding:6px 12px; border-radius:8px; color:var(--sidetext); font-size:13.5px; text-decoration:none; }
.nav-sub a:hover { background:rgba(255,255,255,.07); color:#fff; }
.nav-sub a[aria-current=page] { background:rgba(255,255,255,.14); color:#fff; font-weight:700; }
.count { margin-inline-start:auto; background:var(--gold); color:#3a2500; border-radius:99px; padding:0 7px; font-size:11.5px; font-weight:700; line-height:19px; min-width:19px; text-align:center; }
.nav-head .count { margin-inline-start:6px; } .nav-head .chev + .count { margin-inline-start:0; }
.side-foot { padding:12px 14px; border-top:1px solid rgba(255,255,255,.08); display:flex; align-items:center; gap:10px; }
.avatar { width:34px; height:34px; border-radius:50%; background:var(--brand); color:var(--brandink); display:grid; place-items:center; font-weight:700; flex:none; }
.side-foot .who { min-width:0; flex:1; line-height:1.35; } .side-foot .who b { display:block; color:#fff; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .side-foot .who span { font-size:11.5px; }
.icon-btn { width:34px; height:34px; border-radius:9px; border:1px solid transparent; background:transparent; color:inherit; cursor:pointer; display:grid; place-items:center; flex:none; }
.icon-btn:hover { background:rgba(127,127,160,.16); } .icon-btn svg { width:18px; height:18px; }
.main { min-width:0; display:flex; flex-direction:column; }
.top { position:sticky; top:0; z-index:5; display:flex; gap:10px; align-items:center; padding:10px 28px; background:color-mix(in srgb,var(--bg) 86%,transparent); backdrop-filter:blur(12px); border-bottom:1px solid var(--line); min-height:54px; }
.top .crumb { flex:1; color:var(--muted); font-size:13px; display:flex; gap:7px; align-items:center; min-width:0; white-space:nowrap; overflow:hidden; }
.top .crumb b { color:var(--ink); font-weight:600; }
.top .quick { display:flex; align-items:center; gap:8px; background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:5px 12px; color:var(--muted); cursor:pointer; font-size:13px; min-width:200px; }
.top .quick:hover { border-color:var(--line2); } .top .quick kbd { margin-inline-start:auto; font:11px/1 monospace; background:var(--surface3); border-radius:5px; padding:3px 6px; direction:ltr; }
.top .icon-btn { color:var(--ink2); border-color:var(--line); background:var(--surface); }
.menu-btn { display:none !important; }
.content { padding:22px 28px 70px; max-width:1320px; width:100%; margin:0 auto; }
.banner { display:flex; gap:10px; align-items:center; border-radius:var(--r-sm); padding:9px 14px; margin-bottom:14px; font-size:13.5px; }
.banner.warn { background:var(--warnbg); color:var(--warn); } .banner.info { background:var(--infobg); color:var(--info); } .banner.bad { background:var(--badbg); color:var(--bad); }
.banner a { color:inherit; font-weight:700; text-decoration:underline; }

/* ---------- page header + tabs ---------- */
.phead { margin-bottom:18px; }
.phead h1 { margin:0; font-size:23px; line-height:1.4; }
.phead p { margin:2px 0 0; color:var(--muted); font-size:13.5px; }
.phead .row { display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; } .phead .row > div:first-child { flex:1; min-width:220px; }
.tabs { display:flex; gap:2px; border-bottom:1px solid var(--line); margin:14px 0 20px; overflow-x:auto; scrollbar-width:none; }
.tabs a { padding:9px 15px; color:var(--muted); font-weight:600; font-size:14px; border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap; display:flex; gap:7px; align-items:center; text-decoration:none; }
.tabs a:hover { color:var(--ink); }
.tabs a[aria-current=page] { color:var(--brand); border-bottom-color:var(--brand); }
.tabs .count { background:var(--brand); color:var(--brandink); }

/* ---------- surfaces ---------- */
.card { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); box-shadow:var(--shadow); padding:18px 20px; margin-bottom:16px; }
.card h2 { margin:0 0 2px; font-size:16px; }
.card > .sub { color:var(--muted); font-size:13px; margin-bottom:12px; }
.card.flush { padding:0; overflow:hidden; }
.card-h { display:flex; align-items:center; gap:10px; padding:14px 20px; border-bottom:1px solid var(--line); } .card-h h2 { margin:0; flex:1; }
.cols { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); align-items:start; } .cols > .card { margin-bottom:0; }
.grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); margin-bottom:16px; }
.stat-card { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); box-shadow:var(--shadow); padding:15px 17px; display:flex; flex-direction:column; gap:1px; position:relative; text-decoration:none; color:inherit; }
a.stat-card:hover { border-color:var(--brand); text-decoration:none; }
.stat-card .l { color:var(--muted); font-size:13px; display:flex; gap:7px; align-items:center; }
.stat-card .l i { width:8px; height:8px; border-radius:50%; background:var(--tint,var(--brand)); display:inline-block; }
.stat-card .n { font-size:28px; font-weight:700; line-height:1.3; direction:ltr; text-align:right; }
.stat-card .d { font-size:12.5px; color:var(--muted); }
.stat-card a.go { font-size:12.5px; margin-top:6px; }
.grid.kpis { grid-template-columns:repeat(auto-fit,minmax(185px,1fr)); }
.bar { height:6px; border-radius:99px; background:var(--surface3); overflow:hidden; margin-top:8px; } .bar > i { display:block; height:100%; background:var(--tint,var(--brand)); border-radius:99px; }
.todo { display:flex; align-items:center; gap:12px; padding:11px 20px; border-bottom:1px solid var(--line); color:inherit; text-decoration:none; }
.todo:last-child { border-bottom:0; } a.todo:hover { background:var(--surface2); text-decoration:none; }
.todo .dot { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; flex:none; background:var(--warnbg); color:var(--warn); font-weight:700; }
.todo .dot.bad { background:var(--badbg); color:var(--bad); } .todo .dot.ok { background:var(--okbg); color:var(--ok); } .todo .dot.info { background:var(--infobg); color:var(--info); }
.todo .t { flex:1; min-width:0; } .todo .t b { display:block; font-weight:600; } .todo .t span { color:var(--muted); font-size:12.5px; }
.todo .go { color:var(--muted); }
.quick-links { display:grid; gap:10px; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); padding:14px 20px 18px; }
.quick-links a { display:flex; gap:9px; align-items:center; padding:10px 12px; border:1px solid var(--line); border-radius:10px; color:var(--ink2); background:var(--surface2); font-weight:600; font-size:13.5px; text-decoration:none; }
.quick-links a:hover { border-color:var(--brand); color:var(--brand); } .quick-links svg { width:18px; height:18px; flex:none; }

/* ---------- controls ---------- */
.btn { border:1px solid var(--line2); background:var(--surface); border-radius:9px; padding:6px 14px; cursor:pointer; transition:background .12s,border-color .12s; display:inline-flex; gap:6px; align-items:center; font-weight:600; font-size:13.5px; line-height:1.6; white-space:nowrap; }
.btn:hover { border-color:var(--brand); background:var(--surface2); }
.btn.primary { background:var(--brand); color:var(--brandink); border-color:var(--brand); } .btn.primary:hover { background:var(--brand-h); }
.btn.ok { background:var(--okbg); color:var(--ok); border-color:transparent; } .btn.bad { background:var(--badbg); color:var(--bad); border-color:transparent; }
.btn.ok:hover, .btn.bad:hover { filter:brightness(.96); border-color:transparent; }
.btn.ghost { background:transparent; border-color:transparent; } .btn.ghost:hover { background:var(--surface3); }
.btn.sm { padding:2px 10px; font-size:12.5px; } .btn[disabled] { opacity:.5; cursor:not-allowed; }
input[type=text], input[type=password], input[type=search], input[type=number], input[type=url], input[type=date], select, textarea { width:100%; background:var(--surface); border:1px solid var(--line2); border-radius:9px; padding:7px 12px; outline:none; transition:border-color .12s,box-shadow .12s; }
input[type=checkbox] { width:18px; height:18px; accent-color:var(--brand); vertical-align:middle; }
textarea { min-height:84px; resize:vertical; }
input:focus, select:focus, textarea:focus { border-color:var(--brand); box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 20%,transparent); }
input::placeholder, textarea::placeholder { color:var(--muted); opacity:.8; }
label.f { display:flex; flex-direction:column; gap:5px; font-size:12.5px; color:var(--muted); font-weight:600; }
.form-grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); }
.toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
.toolbar input[type=search], .toolbar input[type=text] { max-width:300px; }
.toolbar select { width:auto; min-width:140px; }
.search { position:relative; max-width:320px; flex:1; min-width:200px; } .search input { padding-inline-start:36px; } .search svg { position:absolute; inset-inline-start:11px; top:50%; transform:translateY(-50%); width:16px; height:16px; color:var(--muted); pointer-events:none; }
.chips { display:flex; gap:6px; flex-wrap:wrap; }
.chip { border:1px solid var(--line2); background:var(--surface); border-radius:99px; padding:2px 13px; cursor:pointer; font-size:13px; font-weight:600; color:var(--ink2); }
.chip:hover { border-color:var(--brand); } .chip[aria-pressed=true] { background:var(--brand); color:var(--brandink); border-color:var(--brand); }
.seg { display:inline-flex; background:var(--surface3); border-radius:10px; padding:3px; gap:2px; flex-wrap:wrap; }
.seg button { border:0; background:transparent; border-radius:8px; padding:4px 13px; cursor:pointer; font-weight:600; font-size:13px; color:var(--muted); }
.seg button[aria-pressed=true] { background:var(--surface); color:var(--ink); box-shadow:var(--shadow); }
.badge { display:inline-flex; align-items:center; border-radius:99px; padding:0 9px; font-size:12px; line-height:21px; white-space:nowrap; font-weight:600; }
.b-ok { background:var(--okbg); color:var(--ok); } .b-warn { background:var(--warnbg); color:var(--warn); } .b-bad { background:var(--badbg); color:var(--bad); } .b-info { background:var(--infobg); color:var(--info); } .b-mute { background:var(--surface3); color:var(--muted); }

/* ---------- tables ---------- */
table { width:100%; border-collapse:collapse; }
th, td { text-align:start; padding:10px 14px; border-bottom:1px solid var(--line); vertical-align:middle; }
th { font-size:12px; color:var(--muted); font-weight:700; background:var(--surface2); white-space:nowrap; position:sticky; top:0; z-index:1; }
th.sortable { cursor:pointer; user-select:none; } th.sortable:hover { color:var(--ink); }
tbody tr:hover td { background:var(--surface2); } tr:last-child td { border-bottom:0; }
tr.click { cursor:pointer; }
.tbl-wrap { overflow:auto; border:1px solid var(--line); border-radius:var(--r); background:var(--surface); box-shadow:var(--shadow); margin-bottom:14px; max-height:72vh; }
.card .tbl-wrap { box-shadow:none; }
.t-foot { display:flex; gap:10px; align-items:center; justify-content:space-between; color:var(--muted); font-size:13px; margin-bottom:10px; flex-wrap:wrap; }
.user-cell { display:flex; gap:10px; align-items:center; } .user-cell .av { width:32px; height:32px; border-radius:50%; background:var(--brand-soft); color:var(--brand); display:grid; place-items:center; font-weight:700; flex:none; font-size:13px; } .user-cell b { display:block; line-height:1.3; } .user-cell small { color:var(--muted); font-size:11px; }

/* ---------- catalog cards ---------- */
.pgrid { display:grid; gap:12px; grid-template-columns:repeat(auto-fill,minmax(310px,1fr)); }
.pcard { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); box-shadow:var(--shadow); padding:12px; display:flex; gap:12px; align-items:center; cursor:pointer; transition:border-color .12s,transform .12s; }
.pcard:hover { border-color:var(--brand); transform:translateY(-1px); }
.pcard .t { font-weight:700; } .pcard .m { color:var(--muted); font-size:12.5px; }
.icon-tile { width:56px; height:56px; border-radius:14px; background:radial-gradient(circle at 30% 22%,#fff6d8,#ffe9b8 60%); border:2px solid #3a2418; display:grid; place-items:center; flex:none; box-shadow:0 3px 0 #3a2418; } .icon-tile svg { width:38px; height:38px; }
.icon-tile.empty { background:var(--surface2); border:2px dashed var(--line2); box-shadow:none; color:var(--muted); font-size:22px; }
.empty-state { text-align:center; padding:44px 12px; color:var(--muted); }
.empty-state b { display:block; color:var(--ink2); font-size:15px; margin-bottom:2px; }

/* ---------- overlays ---------- */
.overlay { position:fixed; inset:0; background:rgba(8,10,25,.55); backdrop-filter:blur(2px); z-index:40; display:flex; align-items:flex-start; justify-content:center; padding:5vh 12px; overflow:auto; animation:fade .15s; }
.modal { background:var(--surface); border-radius:16px; box-shadow:var(--shadow-lg); width:min(760px,100%); border:1px solid var(--line); animation:rise .18s; }
.modal.sm { width:min(440px,100%); }
.modal header { display:flex; align-items:center; gap:10px; padding:14px 20px; border-bottom:1px solid var(--line); } .modal header h3 { margin:0; flex:1; font-size:16.5px; }
.modal .body { padding:20px; display:flex; flex-direction:column; gap:16px; } .modal footer { padding:12px 20px; border-top:1px solid var(--line); display:flex; gap:8px; justify-content:flex-end; background:var(--surface2); border-radius:0 0 16px 16px; }
.overlay.drawer { padding:0; justify-content:flex-start; align-items:stretch; }
.drawer .panel { background:var(--surface); width:min(620px,100%); min-height:100vh; box-shadow:var(--shadow-lg); display:flex; flex-direction:column; animation:slide .2s; border-inline-end:1px solid var(--line); }
.drawer .panel header { display:flex; align-items:center; gap:12px; padding:16px 22px; border-bottom:1px solid var(--line); }
.drawer .panel header h3 { margin:0; font-size:17px; } .drawer .panel header .sub { color:var(--muted); font-size:12.5px; }
.drawer .panel .tabs { margin:0; padding:0 14px; } .drawer .panel .tabs a, .drawer .panel .tabs button { cursor:pointer; }
.drawer .panel .dbody { padding:20px 22px 40px; display:flex; flex-direction:column; gap:18px; flex:1; }
.tabs button { border:0; background:transparent; padding:9px 15px; color:var(--muted); font-weight:600; font-size:14px; border-bottom:2px solid transparent; margin-bottom:-1px; cursor:pointer; white-space:nowrap; }
.tabs button[aria-current=page] { color:var(--brand); border-bottom-color:var(--brand); }
.sect-t { font-weight:700; font-size:13.5px; margin:0 0 8px; color:var(--ink2); }
.palette { width:min(620px,100%); margin-top:10vh; background:var(--surface); border:1px solid var(--line); border-radius:16px; box-shadow:var(--shadow-lg); overflow:hidden; animation:rise .15s; }
.palette input { border:0; border-bottom:1px solid var(--line); border-radius:0; padding:15px 20px; font-size:16px; box-shadow:none !important; background:transparent; }
.palette .res { max-height:52vh; overflow:auto; padding:6px; }
.palette .grp { font-size:11.5px; color:var(--muted); padding:8px 12px 3px; font-weight:700; }
.palette .it { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:9px; cursor:pointer; }
.palette .it[aria-selected=true] { background:var(--brand-soft); color:var(--brand); }
.palette .it svg { width:17px; height:17px; flex:none; opacity:.75; } .palette .it small { margin-inline-start:auto; color:var(--muted); }
.palette .hint { padding:8px 16px; border-top:1px solid var(--line); color:var(--muted); font-size:12px; background:var(--surface2); display:flex; gap:14px; }
.icon-pick { display:grid; grid-template-columns:repeat(auto-fill,minmax(78px,1fr)); gap:8px; max-height:46vh; overflow:auto; padding:2px; }
.icon-pick button { background:var(--surface2); border:2px solid var(--line); border-radius:12px; padding:6px 4px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; font-size:11px; color:var(--muted); }
.icon-pick button:hover, .icon-pick button[aria-pressed=true] { border-color:var(--brand); color:var(--ink); } .icon-pick svg { width:40px; height:40px; }
.toast-area { position:fixed; inset-inline-start:18px; bottom:18px; z-index:80; display:flex; flex-direction:column; gap:8px; }
.toast { background:#161a2b; color:#fff; border-radius:10px; padding:10px 16px; box-shadow:0 10px 30px rgba(0,0,0,.35); border-inline-start:4px solid var(--ok); animation:rise .2s; max-width:420px; } .toast.err { border-inline-start-color:#ff6b6b; }
@keyframes rise { from { transform:translateY(10px); opacity:0; } } @keyframes fade { from { opacity:0; } } @keyframes slide { from { transform:translateX(-30px); opacity:0; } }

/* ---------- lists / settings ---------- */
.kv { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--line); } .kv:last-child { border-bottom:0; }
.deflist { display:grid; grid-template-columns:150px 1fr; gap:0 18px; } .deflist dt, .deflist dd { margin:0; padding:8px 0; border-bottom:1px solid var(--line); } .deflist dt { color:var(--muted); } .deflist dd { font-weight:600; } .deflist dt:last-of-type, .deflist dd:last-of-type { border-bottom:0; }
.setting { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(150px,.7fr) auto; gap:10px 16px; align-items:center; padding:13px 0; border-bottom:1px solid var(--line); } .setting:last-child { border-bottom:0; }
.setting .l { font-weight:600; } .setting .h { color:var(--muted); font-size:12.5px; }
.setting.changed { border-inline-start:3px solid var(--gold); padding-inline-start:12px; }
.cand { border:1px solid var(--line); border-radius:var(--r); background:var(--surface); box-shadow:var(--shadow); padding:14px 16px; margin-bottom:12px; display:grid; gap:10px; }
.cand .head { display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; } .cand .name { font-size:16.5px; font-weight:700; } .cand .price { font-size:17px; font-weight:700; color:var(--brand); }
.quote { background:var(--surface2); border-inline-start:3px solid var(--brand); border-radius:8px; padding:6px 10px; font-size:13px; color:var(--muted); }
.flag { background:var(--warnbg); color:var(--warn); border-radius:8px; padding:2px 8px; font-size:12.5px; display:inline-block; margin-inline-end:6px; }

/* ---------- login ---------- */
.login-wrap { min-height:100vh; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
.login-art { background:radial-gradient(circle at 20% 15%,#3a3f8f,transparent 55%),linear-gradient(160deg,var(--side),#1d2250); color:#fff; padding:56px; display:flex; flex-direction:column; justify-content:center; gap:14px; }
.login-art .brand { padding:0; font-size:28px; } .login-art .brand i { width:48px; height:48px; font-size:26px; border-radius:14px; }
.login-art p { max-width:420px; color:#c3c9ea; margin:0; line-height:2; }
.login-art ul { list-style:none; padding:0; margin:10px 0 0; display:grid; gap:9px; color:#dfe3fb; } .login-art li::before { content:"✓"; color:var(--gold); margin-inline-end:9px; font-weight:700; }
.login-form { display:grid; place-items:center; padding:30px; }
.login-box { width:min(380px,100%); } .login-box h1 { margin:0 0 4px; font-size:23px; } .login-box .sub { color:var(--muted); margin-bottom:18px; }
.login-box form { display:flex; flex-direction:column; gap:12px; }
.login-box .err { color:var(--bad); min-height:22px; font-size:13.5px; }

@media (max-width:1000px) { .top .quick span { display:none; } .top .quick { min-width:0; } }
@media (max-width:900px) {
  .shell { grid-template-columns:1fr; }
  .side { position:fixed; inset-block:0; inset-inline-start:0; width:280px; z-index:30; transform:translateX(110%); transition:transform .2s; box-shadow:var(--shadow-lg); }
  body.nav-open .side { transform:none; }
  body.nav-open::after { content:""; position:fixed; inset:0; background:rgba(8,10,25,.5); z-index:25; }
  .menu-btn { display:grid !important; } .top { padding:8px 14px; } .content { padding:16px 14px 60px; }
  .setting { grid-template-columns:1fr; } .login-wrap { grid-template-columns:1fr; } .login-art { display:none; }
  .cols { grid-template-columns:1fr; } .toolbar input[type=search], .toolbar input[type=text] { max-width:none; }
  .overlay { padding:0; } .modal { border-radius:0; min-height:100vh; width:100%; } .modal.sm { min-height:0; margin:auto 12px; border-radius:16px; }
}
@media print { .side, .top { display:none; } .shell { display:block; } }
`;
