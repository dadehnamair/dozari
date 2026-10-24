/**
 * Design system of the admin panel: tokens, layout, components. Light and dark, RTL, self-hosted font (served from /admin/fonts, no external requests).
 * Neutral "ink + indigo" palette tuned for dense data screens; the brand gold only appears as an accent.
 */
export const ADMIN_CSS = String.raw`
@font-face { font-family:Vazirmatn; font-weight:400; font-display:swap; src:url(/admin/fonts/Vazirmatn-Regular.ttf) format("truetype"); }
@font-face { font-family:Lalezar; font-weight:400; font-display:swap; src:url(/admin/fonts/Lalezar-Regular.woff2) format("woff2"); }
@font-face { font-family:Vazirmatn; font-weight:700; font-display:swap; src:url(/admin/fonts/Vazirmatn-Bold.ttf) format("truetype"); }
:root { color-scheme: light dark;
  --bg:#f5f6fa; --surface:#ffffff; --surface2:#f8f9fc; --surface3:#eef0f6; --ink:#161a2b; --ink2:#3c4259; --muted:#6a7188; --line:#e3e6ef; --line2:#d3d8e6;
  --brand:#4f46e5; --brand-h:#4338ca; --brand-soft:#eceafd; --brandink:#ffffff; --gold:#f5b73b;
  --ok:#14804a; --okbg:#e2f6ea; --warn:#9a5b00; --warnbg:#fff1d6; --bad:#c0302a; --badbg:#fde8e6; --info:#2753c9; --infobg:#e6edfd;
  --side:#12162b; --side2:#1b2040; --sidetext:#aeb5d3; --sidehi:#ffffff;
  --card:var(--surface); --card2:var(--surface2); --brand2:var(--brand);
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
.shell { display:grid; grid-template-columns:auto minmax(0,1fr); min-height:100vh; }
/* sidebar: «Dozari Admin - Sidebar Menu» design (navy glass, gold active bar, collapsible rail with flyouts) */
.side { width:300px; background:linear-gradient(180deg,rgba(20,24,66,.97),rgba(16,19,56,.99)); color:#C4C8EE; position:sticky; top:0; height:100vh; display:flex; flex-direction:column; border-inline-end:1px solid rgba(255,255,255,.06); box-shadow:-20px 0 60px rgba(0,0,0,.25); transition:width .28s cubic-bezier(.4,0,.2,1); z-index:2; }
.brand { display:flex; align-items:center; gap:12px; padding:22px 18px 18px; color:#FFF6E8; }
.brand i { width:44px; height:44px; flex:none; border-radius:14px; background:linear-gradient(160deg,#FFE27A,#FFC93C 55%,#F0A91E); display:grid; place-items:center; color:#2B1240; font:normal 26px/1 Lalezar,Vazirmatn,sans-serif; box-shadow:0 0 0 1px rgba(255,255,255,.25) inset,0 8px 24px rgba(255,201,60,.35); }
.brand .bt { flex:1; min-width:0; font:24px/1 Lalezar,Vazirmatn,sans-serif; } .brand .bt small { display:block; font:12px/1.2 Vazirmatn,sans-serif; color:#8E94C8; margin-top:5px; }
.rail-btn { width:34px; height:34px; flex:none; border-radius:10px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#9AA0D0; display:grid; place-items:center; cursor:pointer; }
.rail-btn:hover { background:rgba(255,255,255,.09); color:#fff; } .rail-btn svg { width:18px; height:18px; }
.side-search { margin:0 16px 10px; height:44px; display:flex; align-items:center; gap:10px; padding:0 14px; border-radius:14px; background:rgba(8,10,32,.55); border:1px solid rgba(255,255,255,.07); box-shadow:0 1px 0 rgba(255,255,255,.04) inset; cursor:text; }
.side-search:focus-within { border-color:rgba(255,201,60,.55); }
.side-search svg { width:17px; height:17px; flex:none; color:#7C82B8; }
.side-search input[type=search] { flex:1; min-width:0; background:none !important; border:0 !important; box-shadow:none !important; padding:0 !important; height:auto !important; max-width:none !important; outline:0; -webkit-appearance:none; color:#E8E9FF; font:500 14px Vazirmatn,sans-serif; } .side-search input::placeholder { color:#7C82B8; }
.side-search kbd { font:500 11px/1 ui-monospace,"JetBrains Mono",monospace; color:#9AA0D0; padding:3px 7px; border-radius:7px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.08); direction:ltr; }
.nav { flex:1; overflow:hidden auto; padding:6px 12px 16px; display:flex; flex-direction:column; gap:2px; scrollbar-width:thin; }
.nav-none { padding:28px 12px; text-align:center; color:#8E94C8; font-size:13px; }
.nav-label { font:500 10.5px ui-monospace,"JetBrains Mono",monospace; letter-spacing:.08em; color:#6A70A8; padding:16px 12px 6px; }
.nav-div { height:1px; background:rgba(255,255,255,.06); margin:10px; }
.nav-sec { position:relative; }
.nav-head { position:relative; width:100%; height:46px; display:flex; align-items:center; gap:12px; padding:0 10px; border:0; border-radius:13px; background:transparent; color:#C4C8EE; cursor:pointer; text-align:start; font:500 14.5px Vazirmatn,sans-serif; text-decoration:none; transition:background .2s; }
.nav-head:hover { background:rgba(255,255,255,.06); color:#C4C8EE; text-decoration:none; }
.nav-head .bar { position:absolute; inset-inline-start:-12px; top:10px; bottom:10px; width:4px; border-radius:0 4px 4px 0; background:#FFC93C; box-shadow:0 0 14px #FFC93C; opacity:0; transition:opacity .2s; }
.nav-head .ico { position:relative; width:32px; height:32px; flex:none; border-radius:10px; display:grid; place-items:center; background:rgba(255,255,255,.05); color:#AEB3E6; transition:all .2s; }
.nav-head .ico svg { width:19px; height:19px; }
.nav-head .ico .dot { position:absolute; top:-2px; inset-inline-start:-2px; width:9px; height:9px; border-radius:50%; background:#FF4D8D; border:2px solid #141842; }
.nav-head .lbl { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.nav-head .chev { width:16px; height:16px; flex:none; opacity:.7; transition:transform .25s; }
.nav-sec.open > .nav-head .chev { transform:rotate(180deg); }
.nav-sec.active > .nav-head { background:rgba(255,255,255,.045); color:#FFF6E8; font-weight:700; }
.nav-sec.active > .nav-head .bar { opacity:1; }
.nav-sec.active > .nav-head .ico { background:#FFC93C; color:#2B1240; }
.nav-sec.lit > .nav-head { background:linear-gradient(90deg,rgba(255,201,60,.22),rgba(255,201,60,.04)); box-shadow:inset 0 0 0 1px rgba(255,201,60,.22); }
.sum { min-width:22px; height:20px; padding:0 6px; border-radius:10px; background:rgba(255,77,141,.16); color:#FF8DB5; font:700 11px Vazirmatn,sans-serif; display:grid; place-items:center; }
.nav-fold { display:grid; grid-template-rows:0fr; transition:grid-template-rows .3s cubic-bezier(.4,0,.2,1); }
.nav-sec.open > .nav-fold { grid-template-rows:1fr; }
.nav-fold > div { overflow:hidden; min-height:0; }
.nav-sub { position:relative; margin:4px 0 6px; margin-inline-start:27px; padding-inline-start:14px; display:flex; flex-direction:column; gap:1px; }
.nav-sub::before { content:""; position:absolute; inset-inline-start:0; top:6px; bottom:6px; width:1.5px; border-radius:2px; background:linear-gradient(180deg,rgba(255,201,60,.5),rgba(255,255,255,.08)); }
.nav-sub a { position:relative; height:38px; display:flex; align-items:center; gap:10px; padding:0 12px; border-radius:11px; color:#A9AEDC; font:500 13.5px Vazirmatn,sans-serif; text-decoration:none; }
.nav-sub a:hover { background:rgba(255,255,255,.05); color:#fff; text-decoration:none; }
.nav-sub a::before { content:""; position:absolute; inset-inline-start:-17.5px; width:7px; height:7px; border-radius:50%; background:#3A3F7A; border:2px solid #141842; box-sizing:content-box; }
.nav-sub a span:first-child { flex:1; white-space:nowrap; }
.nav-sub a[aria-current=page] { background:linear-gradient(90deg,rgba(255,201,60,.16),rgba(255,201,60,.02)); color:#FFD45C; font-weight:700; }
.nav-sub a[aria-current=page]::before { background:#FFC93C; box-shadow:0 0 10px #FFC93C; }
.count { min-width:24px; height:20px; padding:0 7px; border-radius:10px; background:rgba(255,77,141,.18); color:#FF8DB5; font:800 11px Vazirmatn,sans-serif; display:grid; place-items:center; margin-inline-start:0; }
.count.gold { background:#FFC93C; color:#2B1240; }
.side-foot { margin:0 12px 14px; padding:10px; border-radius:16px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); display:flex; align-items:center; gap:10px; }
.avatar { position:relative; width:38px; height:38px; border-radius:50%; background:linear-gradient(160deg,#C9CCFF,#8F95F0); color:#1B1F5C; display:grid; place-items:center; font:800 15px Vazirmatn,sans-serif; flex:none; }
.avatar::after { content:""; position:absolute; bottom:0; inset-inline-start:0; width:10px; height:10px; border-radius:50%; background:#7ED957; border:2px solid #171B4A; }
.side-foot .who { min-width:0; flex:1; line-height:1.35; } .side-foot .who b { display:block; color:#fff; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .side-foot .who span { font-size:11.5px; color:#8E94C8; }
.side-foot .icon-btn { color:#9AA0D0; } .side-foot .icon-btn:hover { background:rgba(255,77,141,.14); color:#FF8DB5; }
.flyout { position:absolute; inset-inline-end:calc(100% + 14px); top:0; width:240px; padding:8px; border-radius:16px; background:#1A1E52; border:1px solid rgba(255,255,255,.08); box-shadow:0 20px 50px rgba(0,0,0,.45); z-index:10; }
.flyout b { display:block; font:700 13px Vazirmatn,sans-serif; color:#FFF6E8; padding:8px 10px; }
.flyout a { height:36px; display:flex; align-items:center; gap:8px; padding:0 10px; border-radius:10px; color:#A9AEDC; font:500 13px Vazirmatn,sans-serif; text-decoration:none; }
.flyout a span:first-child { flex:1; } .flyout a:hover { background:rgba(255,255,255,.06); color:#fff; text-decoration:none; }
.flyout a[aria-current=page] { background:linear-gradient(90deg,rgba(255,201,60,.16),rgba(255,201,60,.02)); color:#FFD45C; font-weight:700; }
/* collapsed rail (desktop only) */
@media (min-width:901px) {
  .shell.rail .side { width:84px; }
  .shell.rail .brand { padding-inline:18px; } .shell.rail .brand .bt, .shell.rail .side-search, .shell.rail .nav-label, .shell.rail .nav-head .lbl, .shell.rail .nav-head .chev, .shell.rail .nav-head .sum, .shell.rail .nav-fold, .shell.rail .side-foot .who, .shell.rail #logout { display:none; }
  .shell.rail .brand { flex-direction:column; gap:10px; padding-inline:0; } .shell.rail .brand i { margin:0; }
  .shell.rail .nav { overflow:visible; }
  .shell.rail .nav-head { justify-content:center; padding:0; }
  .shell.rail .side-foot { justify-content:center; }
}
@media (max-width:900px) { .rail-btn { display:none; } .flyout { display:none; } }
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
.cat-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); } .cat-row input[type=text] { flex:1; min-width:160px; width:auto; }
.cat-slug { min-width:110px; color:var(--muted); font-size:12.5px; } .cat-new { border-bottom:0; padding-top:14px; }
.ai-sec { border:1px solid var(--line); border-radius:12px; padding:14px 16px; background:var(--surface2); margin-top:12px; }
.ai-sec-h { display:flex; flex-direction:column; gap:2px; margin-bottom:12px; } .ai-sec-h b { font-size:14px; }
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
.user-cell { display:flex; gap:10px; align-items:center; } .av-disc { border-radius:50%; color:#fff; display:grid; place-items:center; font-weight:700; flex:none; border:3px solid var(--surface); box-shadow:0 0 0 1px var(--line2); }
.av-pick { display:grid; grid-template-columns:repeat(auto-fill,minmax(40px,1fr)); gap:8px; } .av-pick button { border:0; background:transparent; padding:2px; border-radius:50%; cursor:pointer; } .av-pick button[aria-pressed=true] .av-disc { box-shadow:0 0 0 3px var(--brand); }
.stat-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; } .stat-row > div { background:var(--surface2); border:1px solid var(--line); border-radius:10px; padding:8px 12px; } .stat-row b { display:block; font-size:19px; } .stat-row span { color:var(--muted); font-size:12px; }
.user-cell .av { width:32px; height:32px; border-radius:50%; background:var(--brand-soft); color:var(--brand); display:grid; place-items:center; font-weight:700; flex:none; font-size:13px; } .user-cell b { display:block; line-height:1.3; } .user-cell small { color:var(--muted); font-size:11px; }

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
.overlay.drawer { padding:0; justify-content:flex-start; align-items:flex-start; }
.drawer .panel { background:var(--surface); width:min(620px,100%); min-height:100vh; box-shadow:var(--shadow-lg); display:flex; flex-direction:column; animation:slide .2s; border-inline-end:1px solid var(--line); }
.drawer .panel > header, .drawer .panel > .tabs { flex:none; }
.drawer .panel header { display:flex; align-items:center; gap:12px; padding:16px 22px; border-bottom:1px solid var(--line); }
.drawer .panel header h3 { margin:0; font-size:17px; } .drawer .panel header .sub { color:var(--muted); font-size:12.5px; }
.drawer .panel .tabs { margin:0; padding:0 14px; } .drawer .panel .tabs a, .drawer .panel .tabs button { cursor:pointer; }
.drawer .panel .dbody > .sect-t { margin-bottom:-12px; }
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
.icon-picker { display:flex; flex-direction:column; gap:8px; min-width:0; }
.icon-bar { display:flex; flex-direction:column; gap:6px; }
.icon-cats { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; scrollbar-width:thin; }
.icon-cats .chip { flex:none; white-space:nowrap; display:inline-flex; align-items:center; gap:6px; }
.icon-cats .chip small { font-size:11px; opacity:.7; font-weight:500; }
.icon-count { font-size:12px; color:var(--muted); }
.icon-pick { display:grid; grid-template-columns:repeat(auto-fill,minmax(84px,1fr)); gap:8px; max-height:46vh; overflow:auto; padding:2px; align-content:start; }
.icon-pick button span { text-align:center; line-height:1.4; }
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
/* ---------- view-specific (puzzle builder, pickers, callouts) ---------- */
.tab { background:none; border:0; border-bottom:3px solid transparent; padding:9px 16px; cursor:pointer; color:var(--muted); font-weight:600; white-space:nowrap; display:flex; gap:6px; align-items:center; }
.tab[aria-selected=true] { color:var(--brand); border-bottom-color:var(--brand); }
.tab .count { background:var(--card2); border:1px solid var(--line); border-radius:99px; padding:0 7px; font-size:12px; color:var(--ink); }
.callout { background:var(--infobg); color:var(--info); border-radius:12px; padding:10px 14px; font-size:13.5px; margin-bottom:14px; } .callout.warn { background:var(--warnbg); color:var(--warn); }
.card.inline { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
.pz-grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(440px,1fr)); }
.pz { margin:0; display:flex; flex-direction:column; gap:12px; border-top:5px solid var(--line2); transition:box-shadow .15s; }
.pz-draft { border-top-color:var(--warn); } .pz-approved { border-top-color:var(--ok); } .pz-retired { border-top-color:var(--line2); opacity:.85; }
.pz.dirty { box-shadow:0 0 0 3px color-mix(in srgb,var(--warn) 35%,transparent); }
.pz-head { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.pz-meta { display:grid; grid-template-columns:1fr 1fr; gap:10px; background:var(--card2); border-radius:12px; padding:10px 12px; } .pz-meta .f:last-child { grid-column:1 / -1; }
.pz-review { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 12px; border-radius:12px; background:color-mix(in srgb,var(--warn) 14%,transparent); } .pz-review.done { background:color-mix(in srgb,var(--ok) 12%,transparent); }
.rv-tab { display:grid; gap:14px; max-width:560px; margin-inline:auto; padding-bottom:84px; }
.rv-bar { position:fixed; inset-inline:0; bottom:0; z-index:20; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 12px calc(10px + env(safe-area-inset-bottom)); background:var(--card); border-top:1px solid var(--line2); }
@media (min-width:1001px) { .rv-bar { position:sticky; border:1px solid var(--line2); border-radius:12px; } .rv-tab { padding-bottom:0; } }
.rv-bar .btn { min-height:44px; } .rv-pos { font-size:13px; color:var(--muted); white-space:nowrap; }
.pz-groups { display:grid; gap:10px; }
.pz-group { border-inline-start:6px solid var(--lv); background:var(--card2); border-radius:12px; padding:10px 12px; display:grid; gap:8px; }
.pz-lv { display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--muted); } .pz-lv i { width:10px; height:10px; border-radius:50%; background:var(--lv); display:inline-block; } .pz-lv b { color:var(--ink2); }
.pz-group input { font-weight:700; padding:6px 10px; }
.pz-items { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
.pz-item { display:flex; align-items:center; gap:8px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:6px 10px; font-size:13.5px; color:inherit; font-family:inherit; cursor:pointer; text-align:start; min-height:40px; }
.pz-item span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .pz-item em { font-style:normal; color:var(--muted); font-size:13px; opacity:0; transition:opacity .12s; }
.pz-item:hover { border-color:var(--brand); } .pz-item:hover em { opacity:1; } .pz-item.changed { border-color:var(--warn); background:var(--warnbg); } .pz-item.changed em { opacity:1; color:var(--warn); }
.pz-foot { margin-top:auto; padding-top:4px; border-top:1px dashed var(--line); }
.pz-filters { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:10px 14px; }
.swap-now { display:flex; align-items:center; gap:10px; flex-wrap:wrap; background:var(--card2); border-radius:10px; padding:8px 12px; }
.rv-out { display:grid; gap:8px; } .rv-row { border:1px solid var(--line); border-radius:12px; padding:10px 12px; display:grid; gap:4px; }
@media (max-width:560px) { .pz-grid { grid-template-columns:1fr; } .pz-meta { grid-template-columns:1fr; } }
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
.add-head { display:flex; align-items:flex-start; gap:12px; justify-content:space-between; flex-wrap:wrap; } .add-head .sub { margin-bottom:0; max-width:62ch; } .add-head .btn { flex:none; }
.page-desc { color:var(--muted); font-size:13px; margin:0 0 14px; max-width:80ch; }
.pz-list { display:flex; flex-direction:column; gap:8px; max-height:56vh; overflow:auto; padding:2px; }
.pz-card { display:flex; align-items:center; gap:12px; border:1px solid var(--line); border-radius:12px; padding:8px 12px; background:var(--surface); min-width:0; }
.pz-card.pick-it { cursor:pointer; } .pz-card.pick-it:hover, .pz-card.pick-it:focus { border-color:var(--brand); background:var(--brand-soft); outline:none; }
.pz-id { color:var(--muted); font-size:12px; flex:none; }
.pz-titles { flex:1; min-width:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:2px 14px; }
.pz-t { font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-inline-start:8px; border-inline-start:3px solid var(--line2); }
.pz-t.l0 { border-color:#e0b100; } .pz-t.l1 { border-color:#3fa34d; } .pz-t.l2 { border-color:#3b7bd8; } .pz-t.l3 { border-color:#8e4fc7; }
.day-row { display:grid; grid-template-columns:170px 1fr auto; gap:14px; align-items:center; padding:10px 0; border-bottom:1px solid var(--line); } .day-row:last-child { border-bottom:0; }
.day-k { display:flex; flex-direction:column; gap:4px; } .day-p { min-width:0; }
.th-row { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:10px 0; border-bottom:1px solid var(--line); } .th-main { display:flex; flex-direction:column; gap:3px; min-width:0; }
@media (max-width:800px) { .day-row { grid-template-columns:1fr; } }
/* ---------- visual polish layer (last wins; tokens only, so light + dark both follow) ---------- */
:root { --r:14px; --ring:color-mix(in srgb,var(--brand) 22%,transparent); --shadow-md:0 2px 4px rgba(22,26,43,.05),0 10px 28px rgba(22,26,43,.09); }
body { background:radial-gradient(1100px 420px at 85% -120px,color-mix(in srgb,var(--brand) 9%,transparent),transparent 70%),radial-gradient(900px 380px at -10% -100px,color-mix(in srgb,var(--gold) 9%,transparent),transparent 70%),var(--bg); background-attachment:fixed; }
* { scrollbar-width:thin; scrollbar-color:var(--line2) transparent; }
.side { box-shadow:inset -1px 0 0 rgba(255,255,255,.04); }
.brand i { box-shadow:0 6px 18px rgba(245,183,59,.4),inset 0 1px 0 rgba(255,255,255,.5); }
.nav-head, .nav-sub a { transition:background .15s,color .15s,transform .15s; }
.nav-sec.active > .nav-head { background:linear-gradient(270deg,rgba(245,183,59,.16),rgba(255,255,255,.04)); box-shadow:inset -3px 0 0 var(--gold); }
.nav-sub a[aria-current=page] { background:linear-gradient(270deg,rgba(255,255,255,.2),rgba(255,255,255,.08)); box-shadow:inset -2px 0 0 var(--gold); }
.top { box-shadow:0 1px 0 var(--line),0 8px 24px -16px rgba(22,26,43,.25); }
.content { animation:rise .25s ease-out; }
.phead h1 { font-size:25px; letter-spacing:-.2px; display:flex; align-items:center; gap:10px; }
.phead h1::before { content:""; width:5px; height:26px; border-radius:4px; background:linear-gradient(180deg,var(--gold),var(--brand)); flex:none; }
.card { border-radius:var(--r); box-shadow:var(--shadow); transition:box-shadow .2s,border-color .2s; position:relative; }
.card:hover { box-shadow:var(--shadow-md); }
.card h2 { font-size:16.5px; display:flex; align-items:center; gap:8px; }
.card h2::before { content:""; width:7px; height:7px; border-radius:50%; background:var(--gold); box-shadow:0 0 0 3px color-mix(in srgb,var(--gold) 25%,transparent); flex:none; }
.card-h { background:linear-gradient(180deg,var(--surface2),var(--surface)); }
.stat-card { overflow:hidden; transition:transform .18s,box-shadow .18s,border-color .18s; }
.stat-card::before { content:""; position:absolute; inset-inline:0; top:0; height:3px; background:linear-gradient(90deg,var(--tint,var(--brand)),transparent); }
.stat-card:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
.stat-card .n { background:linear-gradient(180deg,var(--ink),var(--ink2)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.bar { height:7px; } .bar > i { background:linear-gradient(90deg,var(--tint,var(--brand)),color-mix(in srgb,var(--tint,var(--brand)) 60%,#fff)); }
.btn { border-radius:10px; box-shadow:0 1px 1px rgba(22,26,43,.04); transition:background .15s,border-color .15s,box-shadow .15s,transform .1s; }
.btn:hover { box-shadow:0 3px 10px -3px rgba(22,26,43,.2); } .btn:active { transform:translateY(1px) scale(.99); box-shadow:none; }
.btn.primary { background:linear-gradient(180deg,color-mix(in srgb,var(--brand) 88%,#fff),var(--brand)); box-shadow:0 4px 12px -4px color-mix(in srgb,var(--brand) 70%,transparent),inset 0 1px 0 rgba(255,255,255,.22); }
.btn.primary:hover { background:linear-gradient(180deg,var(--brand),var(--brand-h)); }
input[type=text], input[type=password], input[type=search], input[type=number], input[type=url], input[type=date], select, textarea { border-radius:10px; padding:8px 12px; background:var(--surface2); }
input:focus, select:focus, textarea:focus { background:var(--surface); box-shadow:0 0 0 4px var(--ring); }
select { cursor:pointer; }
.search svg { opacity:.8; }
.seg { box-shadow:inset 0 1px 2px rgba(22,26,43,.08); } .seg button { transition:background .15s,color .15s; } .seg button:hover { color:var(--ink); }
.chip { transition:all .15s; } .chip:hover { transform:translateY(-1px); }
.badge { padding:0 10px; letter-spacing:.1px; box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 14%,transparent); }
th { text-transform:none; letter-spacing:.2px; background:linear-gradient(180deg,var(--surface2),var(--surface3)); border-bottom:1px solid var(--line2); }
tbody tr { transition:background .12s; } tbody tr:nth-child(even) td { background:color-mix(in srgb,var(--surface2) 55%,transparent); } tbody tr:hover td { background:var(--brand-soft); }
.tbl-wrap { border-radius:var(--r); box-shadow:var(--shadow); }
.todo { transition:background .15s,padding .15s; } a.todo:hover { padding-inline-start:26px; }
.todo .dot { border-radius:12px; }
.quick-links a { transition:all .15s; background:var(--surface); } .quick-links a:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
.pcard { transition:transform .18s,box-shadow .18s,border-color .18s; } .pcard:hover { transform:translateY(-3px); box-shadow:var(--shadow-md); }
.overlay { backdrop-filter:blur(6px); background:rgba(8,10,25,.6); }
.modal { border-radius:20px; overflow:hidden; box-shadow:var(--shadow-lg),0 0 0 1px rgba(255,255,255,.04); animation:rise .22s cubic-bezier(.2,.9,.3,1.2); }
.modal header { background:linear-gradient(180deg,var(--surface2),var(--surface)); padding:16px 22px; }
.modal footer { border-radius:0; }
.palette { border-radius:20px; }
.empty-state { padding:52px 16px; background:radial-gradient(260px 120px at 50% 40%,color-mix(in srgb,var(--brand) 7%,transparent),transparent); border-radius:var(--r); }
.empty-state b { font-size:16px; }
.banner { border-radius:12px; border:1px solid color-mix(in srgb,currentColor 18%,transparent); }
.pz-card { transition:border-color .15s,background .15s,transform .12s; } .pz-card.pick-it:hover { transform:translateX(-2px); }
.day-row { border-radius:12px; padding-inline:10px; transition:background .15s; } .day-row:hover { background:var(--surface2); }
.th-row { transition:background .15s; border-radius:12px; padding-inline:10px; } .th-row:hover { background:var(--surface2); }
:focus-visible { outline-offset:3px; border-radius:6px; }
@media (prefers-reduced-motion:reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }
/* thin progress bar while any request is in flight */
body::before { content:""; position:fixed; inset-inline:0; top:0; height:3px; z-index:90; background:linear-gradient(90deg,transparent,var(--gold),var(--brand),transparent); background-size:50% 100%; background-repeat:no-repeat; opacity:0; pointer-events:none; transition:opacity .15s; }
body.busy::before { opacity:1; animation:busy 1s linear infinite; }
@keyframes busy { from { background-position:150% 0; } to { background-position:-50% 0; } }
.setting.dirty { background:color-mix(in srgb,var(--brand) 7%,transparent); border-radius:10px; padding-inline:12px; }
@media print { .side, .top { display:none; } .shell { display:block; } }
`;
