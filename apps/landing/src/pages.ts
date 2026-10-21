import type { CastMember, DemoPuzzle, FaqPair, LandingData, Post, PostList, PostSummary, PublicComment, StoreReview } from './api.js';
import { EXTRA_CSS, commentsSection, faDate, faNum, reviewsBlock } from './blocks.js';
import type { Flash } from './blocks.js';
import { escapeHtml, plainText, renderMarkdown } from './markdown.js';
import { qrSvg } from './qr.js';
import { absolute, description, faqNode, head, ids } from './seo.js';
import type { Crumb, Site } from './seo.js';

export { faDate };

/**
 * Markup and styles follow the landing designs in `docs/design/landing` (ink borders, offset shadows, coloured bands, Lalezar headings).
 * Fonts are self-hosted (`/fonts`), characters and item icons are the design's own SVGs rendered once into `assets/` (`/characters`, `/items`).
 */
const CSS = `
@font-face{font-family:Vazirmatn;src:url(/fonts/Vazirmatn-400.woff2) format("woff2");font-weight:400 700;font-display:swap}
@font-face{font-family:Vazirmatn;src:url(/fonts/Vazirmatn-800.woff2) format("woff2");font-weight:800;font-display:swap}
@font-face{font-family:Vazirmatn;src:url(/fonts/Vazirmatn-900.woff2) format("woff2");font-weight:900;font-display:swap}
@font-face{font-family:Lalezar;src:url(/fonts/Lalezar-Regular.woff2) format("woff2");font-weight:400;font-display:swap}
:root{--ink:#2B1240;--cream:#FFF6E8;--yellow:#FFC93C;--orange:#FF7A3D;--lime:#7ED957;--pink:#FF4D8D;--sky:#3FC1F0;--violet:#A66BF0;--display:Lalezar,Vazirmatn,Tahoma,sans-serif}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:Vazirmatn,Tahoma,"Segoe UI",system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.9;font-size:17px}
a{color:#7E46D6}a:hover{color:var(--pink)}img{display:block}
h1,h2,h3{font-family:var(--display);font-weight:400;margin:0;text-wrap:balance}
p{text-wrap:pretty}
.in{max-width:1200px;margin:0 auto;padding:0 24px}
.band{border-bottom:4px solid var(--ink)}.band.y{background:var(--yellow)}.band.v{background:var(--violet);color:var(--cream)}.band.g{background:var(--lime)}.band.s{background:var(--sky);border-block:4px solid var(--ink)}.band.yb{background:var(--yellow);border-block:4px solid var(--ink)}
.band>.in{padding-top:64px;padding-bottom:64px}
.sec{padding-top:72px;padding-bottom:72px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:40px;align-items:center}
.col{display:flex;flex-direction:column;gap:18px}
/* nav */
header.top{position:sticky;top:0;z-index:20;background:var(--cream);border-bottom:4px solid var(--ink)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 24px;max-width:1200px;margin:0 auto}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font-family:var(--display);font-size:34px;line-height:1}
.face{border-radius:50%;overflow:hidden;background:var(--yellow);border:3px solid var(--ink);flex:none}.face img{width:100%;height:100%;object-fit:cover}
nav.main{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
nav.main a{font-weight:800;font-size:15px;padding:8px 16px;border-radius:999px;text-decoration:none;color:var(--ink);border:3px solid transparent;line-height:1.7}
nav.main a[aria-current=page]{background:var(--yellow);border-color:var(--ink)}
.btn{display:inline-block;font-family:var(--display);font-size:22px;line-height:1.5;padding:8px 22px 4px;border:3px solid var(--ink);border-radius:999px;background:var(--pink);color:var(--cream);text-decoration:none;box-shadow:0 4px 0 var(--ink)}
.btn:hover{color:var(--cream);transform:translateY(2px);box-shadow:0 2px 0 var(--ink)}
.btn.big{font-size:28px;border-width:4px;padding:12px 32px 8px;box-shadow:0 5px 0 var(--ink)}.btn.yellow{background:var(--yellow);color:var(--ink)}.btn.yellow:hover{color:var(--ink)}.btn.dark{background:var(--ink);color:var(--cream);box-shadow:none}.btn.dark:hover{color:var(--cream)}
/* shared pieces */
.pill{display:inline-block;align-self:flex-start;font-weight:800;font-size:14px;padding:4px 14px;border:3px solid var(--ink);border-radius:999px;background:var(--cream);color:var(--ink);line-height:1.8}
.pill.sm{font-size:13px;padding:2px 12px;border-width:2px;background:var(--yellow)}
h1{font-size:clamp(44px,6.5vw,84px);line-height:1.1}
h2.big{font-size:clamp(34px,4.5vw,52px);line-height:1.15;text-align:center}
.lead{margin:0;font-size:19px;font-weight:600;max-width:540px}
.stage{position:relative;display:grid;place-items:center;min-height:380px}
.stage .disc{position:absolute;width:380px;height:380px;max-width:90%;aspect-ratio:1;border-radius:50%;background:var(--orange);border:4px solid var(--ink)}
.stage img{position:relative;width:min(320px,80%);height:auto}
.badges{display:flex;gap:12px;flex-wrap:wrap}
.badge{display:flex;align-items:center;gap:12px;padding:10px 18px;border:3px solid var(--ink);border-radius:18px;background:var(--ink);color:var(--cream);text-decoration:none;box-shadow:0 4px 0 var(--pink);min-width:130px;line-height:1.5}
.badge .sl{width:28px;height:28px;flex:none;background:#fff;border-radius:7px;padding:2px;box-sizing:border-box}.badge .ic{width:28px;height:28px;flex:none;color:var(--yellow)}.badge .tx{display:flex;flex-direction:column;gap:2px}.badge.off{opacity:.6;box-shadow:none}.badge:hover{color:var(--cream)}.badge small{font-size:11px;font-weight:600;opacity:.75}.badge b{font-family:var(--display);font-weight:400;font-size:20px;line-height:1.2}
.cards4{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;padding:0;list-style:none;margin:0}
.tile{background:#fff;border:4px solid var(--ink);border-radius:28px;padding:24px;box-shadow:0 6px 0 var(--ink);display:flex;flex-direction:column;gap:12px}
.tile.cream{background:var(--cream)}
.tile .ic{width:72px;height:72px;border-radius:20px;border:3px solid var(--ink);display:grid;place-items:center}.tile .ic img{width:48px;height:48px}
.tile h3{font-size:28px;line-height:1.2}.tile p{margin:0;font-weight:500;font-size:15px}
.tile .n{font-family:var(--display);font-size:40px;line-height:1}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;padding:0;list-style:none;margin:0}
.steps li{display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center}
.shot{width:100%;max-width:240px;aspect-ratio:9/16;border:4px solid var(--ink);border-radius:32px;background:repeating-linear-gradient(135deg,var(--cream) 0 12px,#fff 12px 24px);display:grid;place-items:end center;overflow:hidden}.shot img{width:90%;height:auto}
.num{width:52px;height:52px;border-radius:50%;background:var(--yellow);border:3px solid var(--ink);display:grid;place-items:center;font-family:var(--display);font-size:28px;line-height:1}
.steps h3{font-size:28px}.steps p{margin:0;font-weight:600;font-size:15px;max-width:280px}
.castbox{display:flex;gap:8px;justify-content:center;align-items:flex-end;flex-wrap:wrap;background:var(--ink);border-radius:36px;padding:36px 20px 20px}
.castbox a{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;color:var(--cream);font-family:var(--display);font-size:20px}
.castbox img{width:120px;height:138px}
.row{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.more{font-weight:800;color:var(--ink)}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;padding:0;list-style:none;margin:0}
.pcard{text-decoration:none;color:var(--ink);background:#fff;border:4px solid var(--ink);border-radius:28px;overflow:hidden;box-shadow:0 6px 0 var(--ink);display:flex;flex-direction:column;height:100%}
.pcard:hover{color:var(--ink)}
.pthumb{aspect-ratio:16/9;border-bottom:4px solid var(--ink);display:grid;place-items:center;overflow:hidden}.pthumb img{width:120px;height:138px}.pthumb img.cover{width:100%;height:100%;object-fit:cover}
.pbody{padding:20px;display:flex;flex-direction:column;gap:8px;flex:1}
.pbody .cat{font-weight:800;font-size:13px;color:var(--pink)}.pbody h3{font-size:26px;line-height:1.3}.pbody p{margin:0;font-size:14px;line-height:1.8;opacity:.85}.pbody .date{font-weight:600;font-size:13px;opacity:.6;margin-top:auto}
.promo{background:var(--pink);border:4px solid var(--ink);border-radius:40px;box-shadow:0 8px 0 var(--ink);padding:40px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.promo.lime{background:var(--lime)}.promo h2{font-size:clamp(30px,4vw,48px);line-height:1.1;color:inherit}.promo.pk h2,.promo.pk p{color:var(--cream)}.promo p{margin:6px 0 0;font-weight:600;font-size:17px}
/* faq */
details.faq{background:#fff;border:4px solid var(--ink);border-radius:24px;overflow:hidden}
details.faq summary{cursor:pointer;font-weight:800;font-size:17px;padding:16px 22px;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px;line-height:1.7}
details.faq summary::-webkit-details-marker{display:none}details.faq summary h3{font:inherit;font-weight:800}
details.faq summary::after{content:"+";font-family:var(--display);font-size:28px;line-height:1}
details.faq[open],details.faq[open] summary{background:var(--yellow)}details.faq[open] summary::after{content:"−"}
details.faq p{margin:0;padding:0 22px 20px;font-weight:500;font-size:16px}
.faqs{display:flex;flex-direction:column;gap:14px}
/* about */
.trio{display:flex;justify-content:center;align-items:flex-end}.trio img{width:30%;height:auto}.trio img.mid{width:36%}
.team{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}
.member{background:#fff;border:4px solid var(--ink);border-radius:28px;padding:22px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.member .face{width:120px;height:120px}.member b{font-family:var(--display);font-weight:400;font-size:26px;line-height:1.2}.member span{font-weight:700;font-size:14px;opacity:.7}
.prose{max-width:900px;margin:0 auto}.prose p{font-weight:500;font-size:18px;line-height:2;margin:0}
/* download */
.chips{display:flex;gap:10px;flex-wrap:wrap}.chips .pill{align-self:auto}
.devices{display:flex;justify-content:center;align-items:center;gap:20px;flex-wrap:wrap}
.devices .shot{width:200px;box-shadow:0 8px 0 var(--ink)}
.qr{display:flex;flex-direction:column;align-items:center;gap:8px;background:#fff;border:4px solid var(--ink);border-radius:28px;padding:18px;font-weight:800;font-size:13px}.qr svg{width:140px;height:140px;border-radius:12px}
.stores{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;padding:0;list-style:none;margin:0}
.store{text-decoration:none;color:var(--ink);background:#fff;border:4px solid var(--ink);border-radius:28px;padding:22px;box-shadow:0 6px 0 var(--ink);display:flex;flex-direction:column;gap:14px;height:100%}
.store:hover{color:var(--ink)}.store.off{opacity:.55;box-shadow:none}
.store .top2{display:flex;align-items:center;gap:12px}.store .ab img{width:44px;height:44px;object-fit:contain;display:block}.store .ab .ic{width:30px;height:30px}.store .ab{width:56px;height:56px;border-radius:16px;border:3px solid var(--ink);display:grid;place-items:center;font-family:var(--display);font-size:26px;line-height:1;flex:none}
.store .t{display:flex;flex-direction:column;line-height:1.5}.store .t b{font-family:var(--display);font-weight:400;font-size:26px;line-height:1.2}.store .t small{font-weight:600;font-size:13px;opacity:.65}
.store .cta{align-self:flex-start;font-weight:800;font-size:15px;padding:6px 18px;border-radius:999px;background:var(--ink);color:var(--cream);line-height:1.8}
.reqs{display:flex;flex-direction:column;gap:16px}
.req{display:flex;justify-content:space-between;gap:12px;background:var(--cream);border:3px solid var(--ink);border-radius:18px;padding:12px 18px;font-weight:700;font-size:15px}.req span+span{opacity:.8;text-align:end}
.note{background:var(--cream);border:3px solid var(--ink);border-radius:24px;padding:22px;display:flex;flex-direction:column;gap:6px;font-weight:600;font-size:16px;line-height:1.8}
.band h2.l{font-size:clamp(30px,4vw,44px);line-height:1.1}
/* contact */
.csplit{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:40px;align-items:start;padding-top:56px;padding-bottom:56px}
.cform{background:var(--orange);border:4px solid var(--ink);border-radius:32px;box-shadow:0 8px 0 var(--ink);padding:28px;display:flex;flex-direction:column;gap:14px}
.cform .hd{display:flex;align-items:center;gap:12px}.cform .hd .face{width:72px;height:72px}.cform h2{font-size:36px;line-height:1.1}
.cform input,.cform select,.cform textarea{font:600 16px/1.8 Vazirmatn,sans-serif;padding:12px 16px;border:3px solid var(--ink);border-radius:16px;background:var(--cream);color:var(--ink);outline:none;width:100%}
.cform button{font-family:var(--display);font-size:24px;padding:10px 16px 6px;border:3px solid var(--ink);border-radius:999px;background:var(--ink);color:var(--cream);cursor:pointer}
.cform .hint{margin:0;font-weight:700;font-size:14px}
.sticky{position:sticky;top:110px;display:flex;flex-direction:column;gap:20px}
.info{display:flex;flex-direction:column;gap:10px;font-weight:700;font-size:15px}.info a,.info div{display:flex;justify-content:space-between;gap:12px;background:#fff;border:3px solid var(--ink);border-radius:18px;padding:12px 18px;color:var(--ink);text-decoration:none}.info .v{direction:ltr;font-family:ui-monospace,monospace;overflow-wrap:anywhere}
/* blog */
.cats{display:flex;gap:8px;flex-wrap:wrap}
.feat{text-decoration:none;color:var(--ink);display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));background:#fff;border:4px solid var(--ink);border-radius:36px;overflow:hidden;box-shadow:0 8px 0 var(--ink)}
.feat:hover{color:var(--ink)}.feat .art{background:var(--orange);min-height:300px;display:grid;place-items:center}.feat .art img{width:220px;height:auto}.feat .art img.cover{width:100%;height:100%;object-fit:cover}
.feat .tx{padding:36px;display:flex;flex-direction:column;gap:14px;justify-content:center}.feat h2{font-size:clamp(30px,3.6vw,40px);line-height:1.25}.feat p{margin:0;font-weight:500;font-size:16px}.feat .date{font-weight:600;font-size:13px;opacity:.6}
.pager{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.pager a,.pager span{width:44px;height:44px;display:grid;place-items:center;border:3px solid var(--ink);border-radius:14px;background:#fff;color:var(--ink);font-weight:800;font-size:16px;text-decoration:none;line-height:1}.pager .cur{background:var(--ink);color:var(--cream)}
/* post */
.art-post{max-width:760px;margin:0 auto;padding:40px 24px 64px;display:flex;flex-direction:column;gap:24px}
.crumbs{display:flex;gap:8px;flex-wrap:wrap;font-weight:600;font-size:14px;opacity:.85;margin:0;padding:0;list-style:none}.crumbs a{color:var(--ink)}.crumbs li+li::before{content:"/";margin-inline-end:8px;opacity:.6}
.art-post h1{font-size:clamp(38px,5vw,60px);line-height:1.2}
.byline{display:flex;align-items:center;gap:12px}.byline .face{width:52px;height:52px}.byline b{font-weight:800;font-size:15px;display:block;line-height:1.6}.byline span{font-weight:600;font-size:13px;opacity:.65}
.heroart{aspect-ratio:16/9;background:var(--yellow);border:4px solid var(--ink);border-radius:32px;display:grid;place-items:center;box-shadow:0 6px 0 var(--ink);overflow:hidden}.heroart img{width:220px;height:auto}.heroart img.cover{width:100%;height:100%;object-fit:cover}
.body{font-weight:500;font-size:18px;line-height:2.1}.body p{margin:0 0 1em}
.body h2{font-size:34px;line-height:1.3;margin:12px 0 .3em;text-align:start}.body h3{font-size:26px;margin:10px 0 .2em}
.body blockquote{margin:8px 0 1em;padding:24px 28px;background:#fff;border:4px solid var(--ink);border-radius:28px;font-family:var(--display);font-size:28px;line-height:1.5;color:var(--pink)}.body blockquote p{margin:0}
.body img{max-width:100%;height:auto;border-radius:20px;border:4px solid var(--ink)}
.body code{background:#fff;border:1px solid #ddd;border-radius:6px;padding:0 5px;font-family:ui-monospace,monospace}
.toc{background:#fff;border:3px dashed var(--ink);border-radius:18px;padding:8px 18px;font-size:16px}
.cta2{background:var(--sky);border:4px solid var(--ink);border-radius:32px;padding:28px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;box-shadow:0 6px 0 var(--ink)}.cta2 b{font-family:var(--display);font-weight:400;font-size:30px;line-height:1.3;display:block}.cta2 span{font-weight:600;font-size:15px}
.related{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;padding:0;list-style:none;margin:0}
.rel{text-decoration:none;color:var(--ink);background:#fff;border:4px solid var(--ink);border-radius:28px;padding:20px;display:flex;gap:14px;align-items:center}.rel:hover{color:var(--ink)}
.rel .sq{width:80px;height:80px;border-radius:20px;border:3px solid var(--ink);overflow:hidden;flex:none}.rel .sq img{width:100%;height:100%;object-fit:cover}.rel small{display:block;font-weight:800;font-size:12px;color:var(--pink)}.rel span{font-family:var(--display);font-size:22px;line-height:1.3;display:block}
/* plain pages (cast, privacy, 404) */
main.page{max-width:820px;margin:0 auto;padding:32px 24px 56px}
main.page h1{font-size:clamp(38px,5vw,56px);margin-bottom:12px}main.page h2{font-size:32px;margin:1.4em 0 .3em}main.page ul{padding-inline-start:1.2em}
.castlist{display:grid;gap:20px;margin-top:20px}.cc{display:flex;gap:18px;align-items:flex-start;background:#fff;border:4px solid var(--ink);border-radius:28px;padding:20px;box-shadow:0 6px 0 var(--ink)}
.cc img{width:110px;height:auto;flex:none}.cc img.photo{height:110px;border-radius:24px;object-fit:cover;border:3px solid var(--ink);background:var(--yellow)}.cc h2{margin:0;font-size:32px}.cc p{margin:.3em 0 0}.meta{font-size:14px;opacity:.75;font-weight:600}
/* footer */
footer.bottom{background:var(--ink);color:var(--cream)}
footer.bottom .in{padding-top:56px;padding-bottom:28px;display:flex;flex-direction:column;gap:36px}
.fgrid{display:grid;gap:32px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
footer.bottom h2{font-size:22px;margin:0 0 10px}footer.bottom ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
footer.bottom a{color:var(--cream);text-decoration:none;font-weight:600;font-size:15px}footer.bottom a:hover{color:var(--yellow)}
footer.bottom .brandname{font-family:var(--display);font-size:40px;color:var(--yellow);line-height:1}footer.bottom p{margin:12px 0 0;font-weight:500;font-size:15px;opacity:.85}
.social{display:flex;gap:8px;flex-wrap:wrap}.social a{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:14px;padding:6px 14px;border-radius:999px;line-height:1.8}.social .ic{width:18px;height:18px}
footer.bottom .badges{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:center;border-top:2px solid rgba(255,246,232,.2);padding-top:20px}footer.bottom .badges a,footer.bottom .badges span{display:flex;align-items:center;justify-content:center;background:#fff;border-radius:12px;padding:6px;height:88px;min-width:88px}footer.bottom .badges img{max-height:76px;max-width:120px;width:auto;height:auto;display:block}
.legal{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:2px solid rgba(255,246,232,.2);padding-top:20px;font-weight:600;font-size:13px;opacity:.7}.legal .ltr{direction:ltr}
/* motion + home extras (all animation is off under prefers-reduced-motion; content is visible without scripts) */
.prog{position:fixed;inset-block-start:0;inset-inline:0;height:5px;background:var(--pink);transform:scaleX(0);transform-origin:right;z-index:50;pointer-events:none}
header.top{transition:box-shadow .25s}header.top.sc{box-shadow:0 6px 0 rgba(43,18,64,.12)}
.brand .face{transition:transform .4s}.brand:hover .face{transform:rotate(-12deg) scale(1.08)}
.btn{transition:transform .15s,box-shadow .15s}
.btn.pulse{animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
main{overflow-x:clip}
.js .rv{opacity:0;transform:translateY(34px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.8,.2,1);transition-delay:var(--d,0s)}
.js .rv.l{transform:translateX(60px)}.js .rv.r{transform:translateX(-60px)}.js .rv.z{transform:scale(.88)}
.js .rv.in-v{opacity:1;transform:none}
/* hero */
.hero{position:relative;overflow:hidden}
.stage .disc{width:min(380px,80%);height:auto}.hero .stage .disc::after{content:"";position:absolute;inset:-14px;border-radius:50%;border:4px dashed var(--ink);animation:spin 40s linear infinite}
.hero .stage img{animation:bob 4s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
.fl{position:absolute;width:56px;height:56px;animation:float 6s ease-in-out infinite;animation-delay:var(--d,0s);filter:drop-shadow(0 4px 0 rgba(43,18,64,.25));pointer-events:none}
@keyframes float{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-22px) rotate(10deg)}}
.hero .h1w{display:inline-block}.hero h1 span.hl{display:inline-block;color:var(--pink);-webkit-text-stroke:0;text-shadow:3px 3px 0 var(--ink);animation:wob 3s ease-in-out infinite}
@keyframes wob{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg) scale(1.04)}}
/* marquee */
.mq{background:var(--ink);color:var(--yellow);border-bottom:4px solid var(--ink);overflow:hidden;white-space:nowrap;direction:ltr}
.mq .tr{display:inline-flex;gap:0;animation:mq 38s linear infinite;will-change:transform}.mq:hover .tr{animation-play-state:paused}
.mq span{font-family:var(--display);font-size:26px;line-height:1;padding:16px 28px;direction:rtl;display:inline-flex;align-items:center;gap:56px}.mq span::after{content:"✦";color:var(--pink);font-size:22px}
@keyframes mq{to{transform:translateX(-50%)}}
/* carousel */
.car{position:relative;max-width:1100px;margin:0 auto}
.car .track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border:4px solid var(--ink);border-radius:36px;box-shadow:0 8px 0 var(--ink);background:var(--ink);-webkit-overflow-scrolling:touch}
.car .track::-webkit-scrollbar{display:none}
.car figure{margin:0;flex:0 0 100%;scroll-snap-align:center;aspect-ratio:16/9}.car figure img{width:100%;height:100%;object-fit:cover}
.car .nav{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:26px}
.car .dots{display:flex;gap:10px}
.car .dot{width:16px;height:16px;border-radius:50%;border:3px solid var(--ink);background:var(--cream);padding:0;cursor:pointer;transition:transform .2s,background .2s}.car .dot[aria-current=true]{background:var(--pink);transform:scale(1.35)}
.car .arr{width:46px;height:46px;border-radius:50%;border:3px solid var(--ink);background:var(--yellow);font-family:var(--display);font-size:24px;line-height:1;cursor:pointer;box-shadow:0 3px 0 var(--ink);color:var(--ink)}.car .arr:active{transform:translateY(2px);box-shadow:none}
/* showcase rows */
.show{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:48px;align-items:center}
.show .tx{display:flex;flex-direction:column;gap:16px}.show h2{font-size:clamp(34px,4.6vw,56px);line-height:1.15}.show p{margin:0;font-weight:600;font-size:18px;max-width:520px}
.show .chips .pill{background:var(--cream)}
.frame{border:4px solid var(--ink);border-radius:28px;box-shadow:0 10px 0 var(--ink);overflow:hidden;background:var(--ink);transform:rotate(var(--t,-2deg));transition:transform .4s cubic-bezier(.2,.8,.2,1)}.frame:hover{transform:rotate(0) scale(1.02)}.frame img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover}
.js .rv.in-v.frame{transform:rotate(var(--t,-2deg))}.js .rv.in-v.frame:hover{transform:rotate(0) scale(1.02)}
.band.p{background:var(--pink);color:var(--cream)}.band.o{background:var(--orange)}
.pair{display:grid;gap:18px}.pair .frame:nth-child(2){--t:2.5deg;margin-inline-start:12%}.pair .frame:nth-child(1){margin-inline-end:12%}
/* stats */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;text-align:center}
.stat{background:var(--cream);border:4px solid var(--ink);border-radius:28px;box-shadow:0 6px 0 var(--ink);padding:26px 16px;transition:transform .25s}.stat:hover{transform:translateY(-6px) rotate(-1.5deg)}
.stat b{font-family:var(--display);font-weight:400;font-size:clamp(56px,7vw,84px);line-height:1;display:block;color:var(--c,var(--pink))}.stat span{font-weight:800;font-size:17px;color:var(--ink)}
/* demo puzzle */
.demo{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.dgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.dgrid .t{font:800 17px/1.3 Vazirmatn,sans-serif;min-height:68px;padding:8px 4px;border:3px solid var(--ink);border-radius:16px;background:var(--cream);color:var(--ink);cursor:pointer;box-shadow:0 4px 0 var(--ink);transition:transform .12s,background .15s}
.demo.icons .dgrid .t{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:14px;min-height:96px}.demo.icons .dgrid .t svg{width:46px;height:46px;flex:none;pointer-events:none}.demo.icons .dgrid .t img{width:56px;height:56px;object-fit:cover;border-radius:12px;border:2px solid var(--ink);background:#fff;flex:none;pointer-events:none}.demo.icons .dgrid .t span{pointer-events:none}.dgrid .t:hover{transform:translateY(-2px)}.dgrid .t[aria-pressed=true]{background:var(--violet);color:var(--cream);transform:translateY(3px);box-shadow:0 1px 0 var(--ink)}
.dgrid .t.done{cursor:default;box-shadow:none;transform:none;color:var(--ink);background:var(--gc)}
.dgrid .t.shake{animation:shake .45s}.dgrid .t.pop{animation:pop .5s}
.dgrid .gb{grid-column:1/-1;border:3px solid var(--ink);border-radius:16px;padding:6px 12px;text-align:center;font-family:var(--display);font-size:22px;line-height:1.5;background:var(--gc);color:var(--ink)}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}@keyframes pop{50%{transform:scale(1.12)}}
.dbar{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.dbar .btn{cursor:pointer;font-size:20px}.dbar .btn[disabled]{opacity:.45;cursor:not-allowed}
.dmsg{min-height:34px;text-align:center;font-weight:800;font-size:17px;margin:0}
.dnote{font-size:13px;font-weight:600;opacity:.75;text-align:center;margin:0}
/* cast */
.castbox a{transition:transform .25s}.castbox a:hover{transform:translateY(-12px) rotate(-3deg)}.castbox a:nth-child(even):hover{transform:translateY(-12px) rotate(3deg)}
.castbox img{animation:bob 4.5s ease-in-out infinite;animation-delay:var(--d,0s)}
/* final cta with banner */
.fin{display:block;width:100%;max-width:1100px;border:4px solid var(--ink);border-radius:40px;box-shadow:0 8px 0 var(--ink);overflow:hidden;transition:transform .35s}.fin:hover{transform:scale(1.015) rotate(-.6deg)}.fin img{width:100%;height:auto}
/* age tracks: the adult band (gold on near-black, docs/design/adult), the kid/teen cards and the comparison table */
.band.ad{background:#0E0A08;color:#FFE9A8;border-block:4px solid #E8B64A;position:relative;overflow:hidden}
.band.ad::before{content:"";position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 15% 120%,rgba(232,182,74,.07) 0 6deg,transparent 6deg 12deg);pointer-events:none}
.adg{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:44px;align-items:center;position:relative}
.adk{font:26px/1.2 var(--display);color:#E8B64A}.adrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.adbadge{display:inline-block;padding:2px 16px;border-radius:12px;border:3px solid #000;background:linear-gradient(180deg,#FFF1B8,#E8B64A 45%,#B8822A);box-shadow:inset 0 2px 0 rgba(255,255,255,.7),0 4px 0 #000;font:800 26px/1.4 Vazirmatn,sans-serif;color:#2A1606;direction:ltr}
.band.ad h2,.band.ad h1{color:#FFE9A8;text-shadow:0 3px 0 #000;font-size:clamp(34px,5vw,60px);line-height:1.3}.band.ad h2 em,.band.ad h1 em{font-style:normal;background:linear-gradient(180deg,#FFF1B8,#E8B64A 55%,#9A6A1C);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;-webkit-text-stroke:0}
.band.ad p{color:#FFE9A8;font-weight:600;margin:0}
.adlist{list-style:none;margin:0;padding:0;display:grid;gap:10px}.adlist li{display:flex;gap:10px;align-items:flex-start;font-weight:700;color:#FFE9A8}.adlist li::before{content:"";flex:none;width:12px;height:12px;margin-top:11px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFF1B8,#E8B64A 60%,#8A5A16);box-shadow:0 0 0 2px #000}
.brass{display:inline-block;align-self:flex-start;padding:8px 36px 4px;border-radius:20px;border:4px solid #000;background:linear-gradient(180deg,#FFF1B8 0%,#E8B64A 38%,#B8822A 72%,#8A5A16 100%);box-shadow:inset 0 3px 0 rgba(255,255,255,.75),inset 0 -5px 0 rgba(0,0,0,.25),0 7px 0 #000;font:32px/1.5 var(--display);color:#2A1606;text-decoration:none;text-shadow:0 1px 0 rgba(255,255,255,.55);transition:transform .15s}.brass:hover{color:#2A1606;transform:translateY(-3px)}
.adart{border:3px solid #E8B64A;border-radius:30px;box-shadow:0 0 0 4px #000,0 14px 40px rgba(232,182,74,.18);overflow:hidden;background:#000}.adart img{width:100%;height:auto}
.metals{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;position:relative}
.metals li{--m:#E8B64A;background:#17100C;border:2px solid #8A5A16;border-top:6px solid var(--m);border-radius:20px;padding:20px 22px;box-shadow:0 6px 0 #000}
.metals h3{font-size:26px;color:var(--m);margin-bottom:6px;line-height:1.5}.metals p{font-size:16px;line-height:1.9}.metals .gold{--m:#E8B64A}.metals .copper{--m:#D2793E}.metals .silver{--m:#C9D2DC}.metals .bronze{--m:#B07A3C}
.ages3{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px}
.agec{display:flex;flex-direction:column;border:4px solid var(--ink);border-radius:28px;background:#fff;box-shadow:0 8px 0 var(--ink);overflow:hidden}.agec img{width:100%;height:auto;border-bottom:4px solid var(--ink)}.agec .b{padding:18px 22px 22px;display:flex;flex-direction:column;gap:8px}.agec h3{font-size:30px}.agec p{margin:0;font-size:16px}.agec ul{margin:0;padding-inline-start:1.2em;font-size:15px;font-weight:600}
.cmp{width:100%;border-collapse:separate;border-spacing:0;border:3px solid var(--ink);border-radius:18px;overflow:hidden;background:#fff;font-size:15px}.cmp th,.cmp td{padding:10px 14px;text-align:start;border-bottom:2px solid rgba(43,18,64,.15);vertical-align:top}.cmp thead th{background:var(--ink);color:var(--cream);font-family:var(--display);font-weight:400;font-size:20px}.cmp tbody th{background:#FFF1B8;font-weight:800;white-space:nowrap}.cmp td.ad{background:#17100C;color:#FFE9A8;font-weight:700}.cmp thead th.ad{background:#B8822A;color:#2A1606}
.cmpbox{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 2px 8px}
.agelink{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:800}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.js .rv{opacity:1;transform:none}.mq{overflow-x:auto}}
@media(max-width:700px){header.top{border-bottom-width:3px}.bar{padding:8px 14px;gap:6px 10px}.brand{font-size:26px;gap:8px}.brand .face{width:38px!important;height:38px!important}.bar>.btn{font-size:16px;padding:6px 14px 3px;border-width:2px;box-shadow:0 3px 0 var(--ink)}nav.main{order:3;flex:0 0 100%;flex-wrap:nowrap;overflow-x:auto;gap:2px;scrollbar-width:none;margin:0 -14px;padding:0 14px 2px}nav.main::-webkit-scrollbar{display:none}nav.main a{font-size:13px;padding:2px 12px;border-width:2px;white-space:nowrap;line-height:1.7}}
@media(max-width:560px){.fl{display:none}.band>.in{padding-top:40px;padding-bottom:40px}.sec{padding-top:48px;padding-bottom:48px}.promo{padding:26px}.sticky{position:static}.cc{flex-direction:column}}
`;

/* ---- characters and icons (assets rendered from the design's own components) ---- */

export const WHO = ['dozari', 'dozariF', 'mashti', 'khale', 'pahlevan', 'baqal', 'mirza', 'goli', 'ajan'] as const;
export type Who = (typeof WHO)[number];

/** Display names of the designed cast, used when the game's cast list is empty and to pair a cast member with its drawing. */
const CAST_NAMES: Record<Who, string> = { dozari: 'دوزاری', dozariF: 'دوزاری‌خانم', mashti: 'مشتی', khale: 'خاله', pahlevan: 'پهلوون', baqal: 'بقال', mirza: 'میرزا', goli: 'گلی', ajan: 'آژان' };
const norm = (s: string): string => s.replace(/[‌\s]/g, '').replace(/ا(?=ن$)/, 'ا').replace('پهلوان', 'پهلوون');
/** A cast row's `image` is either the key of a designed character (`khale`) or a picture URL; the name is the fallback pairing. */
export const whoOf = (c: { name: string; image: string | null }, index: number): Who => WHO.find((w) => w === c.image) ?? WHO.find((w) => norm(CAST_NAMES[w]) === norm(c.name)) ?? (WHO[index % WHO.length] as Who);
export const photoOf = (image: string | null): string | null => (image && /^(https?:)?\/\/|^\//.test(image) ? image : null);

/** `name` is a file in `assets/characters` (`dozari-cheer-anim`, `khale-face`, ...). */
export const img = (name: string, w: number, h: number, opts: { alt?: string; cls?: string; eager?: boolean } = {}): string =>
  `<img${opts.cls ? ` class="${opts.cls}"` : ''} src="/characters/${name}.svg" alt="${escapeHtml(opts.alt ?? '')}" width="${w}" height="${h}"${opts.eager ? '' : ' loading="lazy"'} decoding="async">`;
export const face = (name: string, size: number): string => `<span class="face" style="width:${size}px;height:${size}px">${img(`${name}-face`, size, size)}</span>`;
const item = (name: string): string => `<img src="/items/${name}.svg" alt="" width="48" height="48" loading="lazy">`;

/** Post art, picked from the slug so a post always keeps the same picture. */
const POST_ART: [Who, string, string][] = [['mirza', 'thinking', '#FFC93C'], ['khale', 'pointing', '#7ED957'], ['goli', 'cheer', '#FF4D8D'], ['pahlevan', 'win', '#3FC1F0'], ['baqal', 'coin', '#A66BF0'], ['dozari', 'wave', '#FF7A3D']];
export const artOf = (slug: string): [Who, string, string] => {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return POST_ART[h % POST_ART.length] as [Who, string, string];
};

export const li = (items: string[]): string => items.map((i) => `<li>${i}</li>`).join('');

/* ---- layout ---- */

export type NavKey = 'home' | 'ages' | 'about' | 'blog' | 'download' | 'contact';
const NAV: [NavKey, string, string][] = [['home', '/', 'خانه'], ['ages', '/ages', 'رده‌های سنی'], ['about', '/about', 'درباره ما'], ['blog', '/blog', 'وبلاگ'], ['download', '/download', 'دانلود'], ['contact', '/contact', 'تماس و سوالات']];

const SOCIAL_LABEL: [RegExp, string][] = [[/instagram\.com/, 'اینستاگرام'], [/t\.me|telegram/, 'تلگرام'], [/aparat\.com/, 'آپارات'], [/bale\.ai|ble\.ir/, 'بله'], [/eitaa/, 'ایتا'], [/rubika/, 'روبیکا']];
const hostOf = (u: string): string => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
const socialLabel = (u: string): string => SOCIAL_LABEL.find(([re]) => re.test(u))?.[1] ?? hostOf(u);
/** Inline 24×24 glyphs (currentColor): no external requests. */
const ICON_PATH: Record<string, string> = {
  web: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 9h-3.1a15.6 15.6 0 0 0-1.4-6A8 8 0 0 1 18.9 11ZM12 4c.9 1 1.9 3.1 2.2 7H9.8C10.1 7.100 11.100 5 12 4ZM4.600 13h3.100c.1 2.200.6 4.300 1.400 6A8 8 0 0 1 4.600 13Zm3.100-2H4.600a8 8 0 0 1 4.500-6c-.8 1.700-1.300 3.800-1.400 6Zm4.300 9c-.9-1-1.900-3.100-2.200-7h4.400c-.3 3.900-1.300 6-2.200 7Zm2.900-1c.8-1.700 1.300-3.800 1.400-6h3.100a8 8 0 0 1-4.500 6Z',
  android: 'M6 18a1 1 0 0 0 1 1h1v3a1.500 1.500 0 0 0 3 0v-3h2v3a1.500 1.500 0 0 0 3 0v-3h1a1 1 0 0 0 1-1V8H6v10ZM3.500 8A1.500 1.500 0 0 0 2 9.500v6a1.500 1.500 0 0 0 3 0v-6A1.500 1.500 0 0 0 3.500 8Zm17 0A1.500 1.500 0 0 0 19 9.500v6a1.500 1.500 0 0 0 3 0v-6A1.500 1.500 0 0 0 20.500 8ZM15.500 2.700l1.200-1.800a.5.500 0 0 0-.8-.6L14.600 2.200a6 6 0 0 0-5.200 0L8.100.3a.5.500 0 0 0-.8.600L8.500 2.700A5.900 5.900 0 0 0 6 7h12a5.900 5.900 0 0 0-2.500-4.300ZM9.500 5.500a.75.75 0 1 1 0-1.500.75.75 0 0 1 0 1.500Zm5 0a.75.75 0 1 1 0-1.500.75.75 0 0 1 0 1.500Z',
  apple: 'M16.400 12.700c0-2.400 2-3.500 2.100-3.600a4.500 4.500 0 0 0-3.600-1.900c-1.500-.2-3 .9-3.700.9-.8 0-2-.9-3.300-.9a4.900 4.900 0 0 0-4.100 2.500c-1.800 3.100-.5 7.600 1.300 10.100.8 1.200 1.800 2.600 3.100 2.500 1.300-.1 1.700-.8 3.200-.8s1.900.8 3.200.8c1.400 0 2.200-1.200 3-2.500a10 10 0 0 0 1.400-2.900c0 0-2.600-1-2.600-4.200ZM14 5.200A4.300 4.300 0 0 0 15 2a4.400 4.400 0 0 0-2.900 1.500 4.100 4.100 0 0 0-1 3.100A3.600 3.600 0 0 0 14 5.200Z',
  instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.500a4.500 4.500 0 1 1 0 9 4.500 4.500 0 0 1 0-9Zm0 2a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5Zm5.200-3.200a1.100 1.100 0 1 1 0 2.200 1.100 1.100 0 0 1 0-2.200Z',
  telegram: 'M21.900 4.200 18.600 19.800c-.2 1.100-.9 1.400-1.800.9l-5-3.700-2.400 2.300c-.3.300-.5.500-1 .5l.4-5.100 9.300-8.400c.4-.4-.1-.6-.6-.2L6 13.300 1.100 11.800c-1.100-.3-1.100-1 .2-1.500L20.400 3c.9-.3 1.700.2 1.500 1.200Z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v.5l8 5 8-5V6H4Zm16 3L12 14 4 9v9h16V9Z',
  link: 'M10.600 13.400a1 1 0 0 1 0-1.400l3-3a3 3 0 1 1 4.200 4.200l-1.800 1.800-1.400-1.400 1.800-1.800a1 1 0 0 0-1.400-1.400l-3 3a1 1 0 0 1-1.400 0ZM13.400 10.600a1 1 0 0 1 0 1.400l-3 3a3 3 0 1 1-4.200-4.200L8 9l1.400 1.400-1.800 1.800a1 1 0 0 0 1.400 1.400l3-3a1 1 0 0 1 1.400 0Z',
};
/** A store's logo, served from /badges. */
const logo = (file: string, ext: string, alt: string): string => `<img src="/badges/${file}.${ext}" alt="${escapeHtml(alt)}" width="44" height="44" loading="lazy">`;
const icon = (k: string): string => `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="${ICON_PATH[k] ?? ICON_PATH.link}"/></svg>`;
/** Brand marks for the download page store tiles (own colours, no external requests). */
const BRAND_SVG = (viewBox: string, inner: string): string => `<svg class="ic" viewBox="${viewBox}" aria-hidden="true" focusable="false">${inner}</svg>`;
const TELEGRAM_ICON = BRAND_SVG('0 0 100 100', `<path fill="#fff" d="${'M88.723,12.142C76.419,17.238,23.661,39.091,9.084,45.047c-9.776,3.815-4.053,7.392-4.053,7.392s8.345,2.861,15.499,5.007c7.153,2.146,10.968-0.238,10.968-0.238l33.62-22.652c11.922-8.107,9.061-1.431,6.199,1.431c-6.199,6.2-16.452,15.975-25.036,23.844c-3.815,3.338-1.908,6.199-0.238,7.63c6.199,5.246,23.129,15.976,24.082,16.691c5.037,3.566,14.945,8.699,16.452-2.146c0,0,5.961-37.435,5.961-37.435c1.908-12.637,3.815-24.321,4.053-27.659C97.307,8.804,88.723,12.142,88.723,12.142z'}"/>`);
const BALE_ICON = BRAND_SVG('0 0 601 841', '<g fill="#0CBC8D"><path transform="translate(59.062,9.375)" d="M0 0 C10.168 6.594 20.077 13.580 29.937 20.625 C30.715 21.178 31.492 21.731 32.293 22.301 C34.574 23.925 36.850 25.555 39.125 27.187 C39.852 27.708 40.580 28.230 41.331 28.767 C45.187 31.553 48.957 34.414 52.664 37.398 C53.433 38.011 54.202 38.624 54.995 39.255 C56.466 40.434 57.925 41.628 59.369 42.840 C60.027 43.365 60.685 43.891 61.363 44.433 C61.934 44.905 62.506 45.378 63.094 45.864 C64.999 46.867 64.999 46.867 67.343 45.992 C70.134 44.521 72.509 42.850 75.011 40.929 C80.688 36.719 86.570 33.168 92.75 29.75 C94.379 28.846 94.379 28.846 96.041 27.925 C167.566 -11.217 250.781 -19.091 328.852 3.467 C382.111 19.319 434.757 52.021 469.667 95.796 C471.971 98.667 474.355 101.454 476.75 104.25 C487.700 117.421 496.664 131.657 504.937 146.625 C505.362 147.379 505.787 148.134 506.226 148.912 C544.210 216.497 551.211 299.089 530.777 373.261 C515.112 428.247 482.921 480.632 438.937 517.625 C438.394 518.081 437.852 518.537 437.292 519.008 C391.417 557.405 335.662 582.894 275.937 589.625 C274.713 589.766 274.713 589.766 273.464 589.910 C263.089 590.943 252.665 590.868 242.25 590.875 C240.744 590.876 240.744 590.876 239.209 590.877 C223.899 590.860 209.042 590.318 193.937 587.625 C192.929 587.453 191.922 587.281 190.884 587.104 C133.221 577.115 81.056 551.042 37.937 511.625 C36.978 510.770 36.019 509.915 35.031 509.035 C8.150 484.991 -13.758 454.280 -29.083 421.701 C-29.757 420.273 -30.438 418.848 -31.126 417.427 C-44.159 390.471 -51.996 361.804 -56.375 332.25 C-56.534 331.182 -56.694 330.115 -56.858 329.015 C-59.485 309.844 -59.215 290.424 -59.223 271.117 C-59.227 268.404 -59.233 265.692 -59.238 262.979 C-59.252 255.672 -59.258 248.365 -59.262 241.057 C-59.265 236.485 -59.269 231.912 -59.274 227.340 C-59.286 214.645 -59.296 201.950 -59.300 189.255 C-59.300 188.446 -59.300 187.638 -59.300 186.805 C-59.300 185.995 -59.301 185.185 -59.301 184.351 C-59.301 182.710 -59.302 181.069 -59.302 179.428 C-59.302 178.614 -59.303 177.800 -59.303 176.961 C-59.307 163.743 -59.324 150.525 -59.348 137.308 C-59.371 123.692 -59.384 110.077 -59.385 96.462 C-59.386 88.835 -59.392 81.208 -59.410 73.581 C-59.425 67.097 -59.430 60.612 -59.422 54.127 C-59.418 50.824 -59.421 47.522 -59.433 44.219 C-59.446 40.629 -59.440 37.039 -59.429 33.449 C-59.438 32.420 -59.446 31.391 -59.454 30.330 C-59.381 19.495 -57.678 9.675 -50.062 1.625 C-49.497 0.997 -48.933 0.369 -48.351 -0.277 C-33.982 -14.616 -15.177 -9.633 0 0 Z M318.900 184.564 C317.621 185.845 316.342 187.125 315.063 188.405 C312.329 191.142 309.597 193.881 306.865 196.621 C302.549 200.951 298.228 205.278 293.907 209.604 C284.747 218.774 275.592 227.949 266.437 237.125 C256.524 247.059 246.611 256.993 236.693 266.922 C232.394 271.226 228.098 275.532 223.804 279.839 C221.142 282.509 218.477 285.177 215.812 287.844 C214.574 289.084 213.336 290.325 212.100 291.568 C210.417 293.257 208.732 294.944 207.046 296.630 C206.552 297.126 206.059 297.623 205.551 298.135 C202.165 301.510 202.165 301.510 199.937 302.625 C199.699 302.062 199.462 301.500 199.217 300.920 C197.647 298.105 195.741 296.174 193.462 293.891 C192.070 292.489 192.070 292.489 190.649 291.058 C189.630 290.044 188.612 289.029 187.593 288.015 C186.544 286.964 185.494 285.913 184.445 284.861 C182.243 282.656 180.036 280.454 177.828 278.254 C175.022 275.460 172.224 272.656 169.430 269.850 C167.261 267.674 165.088 265.502 162.913 263.333 C161.881 262.302 160.851 261.271 159.823 260.237 C144.926 245.288 129.682 233.830 107.812 233.187 C91.091 233.889 76.907 239.931 64.937 251.625 C52.316 266.162 48.934 281.410 49.742 300.125 C50.176 305.677 51.715 310.553 53.937 315.625 C54.326 316.540 54.716 317.455 55.117 318.398 C62.918 334.509 79.659 347.539 92.121 360.046 C93.085 361.015 94.049 361.983 95.014 362.952 C99.541 367.498 104.072 372.043 108.605 376.585 C113.790 381.780 118.967 386.983 124.137 392.193 C128.170 396.257 132.211 400.312 136.258 404.362 C138.659 406.766 141.057 409.173 143.447 411.588 C160.235 429.265 160.235 429.265 181.437 440.625 C182.561 440.996 183.685 441.367 184.843 441.75 C199.973 446.029 215.593 443.997 229.625 437.062 C242.701 429.145 253.412 416.309 264.161 405.578 C265.865 403.879 267.570 402.181 269.275 400.484 C274.350 395.428 279.421 390.368 284.490 385.307 C286.406 383.395 288.321 381.484 290.237 379.572 C298.700 371.127 307.162 362.681 315.620 354.231 C317.680 352.173 319.739 350.116 321.799 348.058 C322.310 347.547 322.822 347.036 323.349 346.509 C331.653 338.214 339.965 329.927 348.281 321.644 C356.846 313.111 365.404 304.571 373.955 296.024 C378.745 291.236 383.538 286.451 388.340 281.675 C392.852 277.186 397.355 272.687 401.851 268.181 C403.497 266.534 405.147 264.891 406.801 263.251 C421.511 248.678 421.511 248.678 430.812 230.375 C431.201 229.256 431.591 228.137 431.992 226.984 C436.206 212.006 434.017 195.948 426.601 182.339 C417.226 167.044 404.318 157.926 386.937 153.625 C357.121 147.911 338.323 165.054 318.900 184.564 Z "/><path transform="translate(344,658)" d="M0 0 C3.518 1.986 5.697 4.093 7 8 C7.105 10.827 7.154 13.631 7.157 16.459 C7.162 17.323 7.167 18.187 7.173 19.077 C7.183 20.954 7.192 22.832 7.199 24.709 C7.211 27.686 7.230 30.663 7.252 33.639 C7.313 42.104 7.367 50.569 7.401 59.033 C7.422 64.211 7.457 69.388 7.502 74.566 C7.516 76.535 7.524 78.503 7.528 80.472 C7.533 83.236 7.556 86.000 7.583 88.764 C7.580 89.568 7.577 90.373 7.574 91.202 C7.706 100.282 10.452 108.536 17 115 C25.114 120.590 32.227 121.780 42 121 C49.028 119.390 54.860 115.982 59 110 C62.843 103.191 63.566 97.342 63.503 89.613 C63.513 88.552 63.522 87.491 63.532 86.399 C63.560 83.036 63.564 79.675 63.562 76.312 C63.566 72.939 63.575 69.566 63.603 66.193 C63.619 64.102 63.622 62.011 63.610 59.919 C63.655 53.640 64.152 48.847 68.812 44.187 C71.665 42.638 73.746 42.130 77 42 C81.864 43.687 85.539 46.440 88 51 C88.706 54.668 88.654 58.261 88.593 61.988 C88.593 63.046 88.593 64.103 88.593 65.193 C88.588 67.426 88.570 69.660 88.541 71.893 C88.500 75.290 88.500 78.686 88.507 82.083 C88.497 84.260 88.484 86.436 88.468 88.613 C88.468 89.619 88.468 90.626 88.468 91.663 C88.363 97.977 87.328 103.139 85 109 C84.695 109.907 84.391 110.815 84.078 111.75 C79.705 123.630 70.358 134.281 59 140 C45.262 145.811 31.234 147.063 17 142 C9.387 138.684 2.619 134.161 -3 128 C-3 127.34 -3 126.68 -3 126 C-3.461 126.424 -3.922 126.848 -4.398 127.285 C-17.402 138.978 -29.582 145.395 -47.304 145.210 C-61.241 144.415 -73.570 138.258 -83 128 C-91.187 117.714 -94.773 107.797 -95.937 94.875 C-96.794 85.595 -98.851 78.746 -105.687 72.062 C-111.447 67.463 -118.576 65.341 -125.941 65.726 C-134.940 66.921 -140.947 70.169 -147 77 C-151.451 82.914 -152.225 89.738 -152 97 C-150.764 105.241 -147.245 111.800 -140.574 116.828 C-133.482 121.026 -127.342 121.545 -119.319 121.042 C-114.369 120.763 -111.323 121.235 -107 124 C-104.023 127.472 -103.446 130.624 -103.664 135.074 C-104.246 138.414 -105.436 139.811 -108 142 C-116.527 146.647 -127.443 146.103 -136.625 143.875 C-150.501 139.487 -160.652 132.450 -168.394 120.101 C-173.068 111.072 -174.659 103.842 -174.562 93.625 C-174.586 92.482 -174.610 91.340 -174.634 90.164 C-174.611 76.381 -169.073 66.364 -159.714 56.621 C-149.213 46.518 -136.469 42.177 -122 42 C-106.988 43.048 -95.085 49.448 -84.812 60.187 C-76.994 69.331 -73.278 79.496 -72.625 91.312 C-72.042 99.836 -69.965 108.189 -63.871 114.496 C-56.785 120.190 -49.346 121.832 -40.375 121.488 C-32.993 120.420 -26.598 116.912 -22 111 C-15.182 101.801 -16.322 91.210 -16.398 80.328 C-16.392 78.316 -16.384 76.304 -16.374 74.293 C-16.351 69.021 -16.355 63.750 -16.367 58.478 C-16.386 50.028 -16.376 41.578 -16.342 33.128 C-16.336 30.184 -16.349 27.241 -16.364 24.297 C-16.361 22.490 -16.357 20.683 -16.353 18.875 C-16.366 17.655 -16.366 17.655 -16.381 16.410 C-16.338 10.339 -15.029 6.203 -10.812 1.625 C-7.168 -0.480 -4.057 -0.935 0 0 Z "/><path transform="translate(388,818)" d="M0 0 C3.081 1.628 5.264 3.030 7.375 5.812 C8.727 10.547 8.551 13.916 6.312 18.312 C3.810 21.219 2.726 22.237 -1 23 C-6.217 23 -8.013 22.881 -11.937 19.375 C-14.216 15.645 -15 13.361 -15 9 C-12.125 2.132 -7.407 -1.039 0 0 Z "/></g>');
const socialIcon = (u: string): string => (/instagram\.com/.test(u) ? 'instagram' : /t\.me|telegram/.test(u) ? 'telegram' : 'link');
const SOCIAL_BG = [['#FF4D8D', '#FFF6E8'], ['#3FC1F0', '#2B1240'], ['#FFC93C', '#2B1240'], ['#7ED957', '#2B1240'], ['#FF7A3D', '#2B1240']] as const;

/** Every page: scroll progress bar, sticky-header shadow and the scroll-reveal of `.rv` blocks. */
const BASE_JS = `(function(){var d=document,h=d.documentElement,p=d.querySelector('.prog'),t=d.querySelector('header.top'),els=[].slice.call(d.querySelectorAll('.rv'));
function sc(){p.style.transform='scaleX('+(h.scrollTop/((h.scrollHeight-h.clientHeight)||1))+')';t.classList.toggle('sc',h.scrollTop>8)}addEventListener('scroll',sc,{passive:true});sc();
if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in-v');io.unobserve(e.target)}})},{threshold:.12});els.forEach(function(e){io.observe(e)})}else els.forEach(function(e){e.classList.add('in-v')})})();`;

const BADGES: Record<string, { file: string; ext: string; alt: string }> = {
  enamad: { file: 'enamad', ext: 'png', alt: 'نماد اعتماد الکترونیکی' },
  samandehi: { file: 'samandehi', ext: 'webp', alt: 'نماد ساماندهی' },
  ersa: { file: 'ersa', ext: 'png', alt: 'نماد ارسا' },
  etehadieh: { file: 'etehadieh', ext: 'webp', alt: 'اتحادیه کسب‌وکارهای مجازی' },
  ircg: { file: 'ircg', ext: 'png', alt: 'ircg' },
  bazaar: { file: 'cafebazaar', ext: 'png', alt: 'کافه‌بازار' },
  myket: { file: 'myket', ext: 'svg', alt: 'مایکت' },
};
function badgesHtml(site: Site): string {
  const items = (site.badges ?? []).flatMap((b) => {
    const m = BADGES[b.id];
    if (!m) return [];
    const img = `<img src="/badges/${m.file}.${m.ext}" alt="${escapeHtml(m.alt)}" loading="lazy">`;
    return [b.url ? `<a href="${escapeHtml(b.url)}" target="_blank" rel="noopener nofollow" title="${escapeHtml(m.alt)}">${img}</a>` : `<span>${img}</span>`];
  });
  return items.length > 0 ? `<div class="badges">${items.join('')}</div>` : '';
}

export function layout(site: Site, headHtml: string, crumbs: Crumb[] | null, body: string, opts: { active?: NavKey; wide?: boolean } = {}): string {
  const crumbHtml =
    crumbs && crumbs.length > 1
      ? `<nav aria-label="مسیر صفحه"><ol class="crumbs">${li(crumbs.map((c) => (c.path !== undefined ? `<a href="${escapeHtml(c.path)}">${escapeHtml(c.name)}</a>` : `<span aria-current="page">${escapeHtml(c.name)}</span>`)))}</ol></nav>`
      : '';
  const nav = NAV.map(([k, href, label]) => `<a href="${href}"${k === opts.active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const year = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', timeZone: 'Asia/Tehran' }).format(Date.now());
  const content = opts.wide ? `<main>${body}</main>` : `<main class="page">\n${crumbHtml}\n${body}\n</main>`;
  const social = [...site.sameAs.map((u, n) => ({ u, label: socialLabel(u), c: SOCIAL_BG[n % SOCIAL_BG.length] as readonly [string, string] }))];
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
${headHtml}
<style>${CSS}${EXTRA_CSS}</style>
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
<div class="prog" aria-hidden="true"></div>
<header class="top"><div class="bar">
<a class="brand" href="/">${face('dozari', 48)}<span>${escapeHtml(site.name)}</span></a>
<nav class="main" aria-label="منوی اصلی">${nav}</nav>
<a class="btn" href="/download">دانلود رایگان</a>
</div></header>
${content}
<footer class="bottom"><div class="in">
<div class="fgrid">
<div><div class="brandname">${escapeHtml(site.name)}</div><p>${escapeHtml(site.tagline)}</p></div>
<div><h2 style="color:var(--sky)">صفحه‌ها</h2><ul><li><a href="/">خانه</a></li><li><a href="/ages">رده‌های سنی</a></li><li><a href="/about">درباره ما</a></li><li><a href="/blog">وبلاگ</a></li><li><a href="/cast">آدم‌های بازار</a></li><li><a href="/download">دانلود</a></li><li><a href="/contact">تماس و سوالات</a></li></ul></div>
<div><h2 style="color:var(--lime)">بیشتر بدانید</h2><ul><li><a href="/how-to-play">راهنمای بازی</a></li><li><a href="/modes">حالت‌های بازی</a></li><li><a href="/glossary">واژه‌نامه</a></li><li><a href="/stats">آمار بازی</a></li><li><a href="/status">وضعیت سرورها</a></li><li><a href="/press">رسانه و لوگو</a></li></ul></div>
<div><h2 style="color:var(--violet)">قوانین</h2><ul><li><a href="/terms">قوانین و شرایط</a></li><li><a href="/privacy">حریم خصوصی</a></li><li><a href="/sitemap">نقشه‌ی سایت</a></li><li><a href="/feed.xml">خبرخوان (RSS)</a></li></ul></div>
<div><h2 style="color:var(--orange)">ما را دنبال کنید</h2><div class="social">${social.map((s) => `<a href="${escapeHtml(s.u)}" rel="noopener me" style="background:${s.c[0]};color:${s.c[1]}">${icon(socialIcon(s.u))}${escapeHtml(s.label)}</a>`).join('')}${site.contactEmail ? `<a href="mailto:${escapeHtml(site.contactEmail)}" style="background:#FFF6E8;color:#2B1240">${icon('mail')}ایمیل</a>` : ''}</div></div>
</div>
${badgesHtml(site)}
<div class="legal"><span>© ${escapeHtml(year)} ${escapeHtml(site.name)} · همهٔ حقوق محفوظ است</span><span class="ltr">${escapeHtml(site.url.replace(/^https?:\/\//, ''))}</span></div>
</div></footer>
<script>${BASE_JS}</script>
</body>
</html>`;
}

/* ---- shared blocks ---- */

const faqList = (faq: FaqPair[], open = -1): string => `<div class="faqs">${faq.map((f, n) => `<details class="faq"${n === open ? ' open' : ''}><summary><h3>${escapeHtml(f.question)}</h3></summary><p>${escapeHtml(f.answer)}</p></details>`).join('')}</div>`;

/** Real download links only: the web app and the Android file, when the admin has set them. */
function storeBadges(site: Site): string {
  const b = (ic: string, small: string, name: string, href: string | null): string => {
    const inner = `${icon(ic)}<span class="tx"><small>${small}</small><b>${name}</b></span>`;
    return href ? `<a class="badge" href="${escapeHtml(href)}">${inner}</a>` : `<span class="badge off" aria-disabled="true">${inner}</span>`;
  };
  const bl = (file: string, ext: string, small: string, name: string, href: string): string => `<a class="badge" href="${escapeHtml(href)}"><img class="sl" src="/badges/${file}.${ext}" alt="" width="28" height="28" loading="lazy"><span class="tx"><small>${small}</small><b>${name}</b></span></a>`;
  return [b('web', 'بازی آنلاین', 'نسخهٔ وب', site.appUrl), b('android', 'دریافت فایل', 'اندروید', site.androidApp), ...(site.stores?.googlePlay ? [bl('googleplay', 'svg', 'دریافت از', 'گوگل‌پلی', site.stores.googlePlay)] : []), ...(site.stores?.bazaar ? [bl('cafebazaar', 'png', 'دریافت از', 'کافه‌بازار', site.stores.bazaar)] : []), ...(site.stores?.myket ? [bl('myket', 'svg', 'دریافت از', 'مایکت', site.stores.myket)] : []), b('apple', site.iosApp ? 'دریافت برنامه' : 'به‌زودی', 'iOS', site.iosApp), ...(site.baleBot ? [b('chat', 'بازی از طریق ربات', 'بله', site.baleBot)] : []), ...(site.telegramApp ? [b('chat', 'بازی بدون نصب', 'تلگرام', site.telegramApp)] : [])].join('');
}

const postCard = (p: PostSummary): string => {
  const [who, pose, bg] = artOf(p.slug);
  return `<li><a class="pcard" href="/blog/${encodeURIComponent(p.slug)}"><div class="pthumb" style="background:${bg}">${p.coverUrl ? `<img class="cover" src="${escapeHtml(p.coverUrl)}" alt="${escapeHtml(p.title)}" loading="lazy">` : img(`${who}-${pose}`, 120, 138)}</div><div class="pbody"><span class="cat">مقاله</span><h3>${escapeHtml(p.title)}</h3>${p.summary ? `<p>${escapeHtml(p.summary)}</p>` : ''}<span class="date">${escapeHtml(faDate(p.publishedAt))}${p.author ? ` · ${escapeHtml(p.author)}` : ''}</span></div></a></li>`;
};

export const promo = (cls: string, h: string, p: string, link: string): string => `<section class="in" style="padding-bottom:80px"><div class="promo ${cls}"><div><h2>${h}</h2><p>${p}</p></div>${link}</div></section>`;

/* ---- home ---- */

export const HOW_TO = [
  ['کالاها را ببین', 'شانزده کالا روی صفحه است؛ هر کدام یک قیمت واقعی در یکی از سال‌های گذشته ایران دارد.', 'khale-pointing'],
  ['چهارتا چهارتا گروه کن', 'کالاهایی را که یک قاعده‌ی مشترک دارند کنار هم بگذار؛ مثلاً قیمتشان در یک سال یا یک بازه است.', 'mirza-thinking'],
  ['حدس بزن و ادامه بده', 'هر گروه درست یک دسته‌ی رنگی می‌شود؛ اشتباه‌ها محدودند.', 'goli-cheer'],
  ['با دوستانت رقابت کن', 'همین بازی را تکی یا زنده دونفره، دو در دو و در تورنومنت بازی کن.', 'pahlevan-win'],
] as const;

const FEATURES = [
  ['coin', '#FFC93C', 'قیمت‌های واقعی', 'قیمت اسمی کالاها در سال‌های گذشته ایران، همان‌طور که روی برچسب بود؛ بدون تعدیل تورم.'],
  ['gift', '#7ED957', 'چالش روزانه', 'هر روز یک جدول تازه: شانزده کالا، چهار گروه و قاعده‌ای که باید پیدایش کنی.'],
  ['crown', '#3FC1F0', 'رقابت زنده', 'تکی، زنده دونفره، دو در دو و تورنومنت؛ حریفت را با سرعت و دقت شکست بده.'],
  ['hat', '#A66BF0', 'ظاهر مخصوص خودت', 'آواتار، کلاه و لباس‌هایی که با سکه‌های بازی به دست می‌آوری.'],
] as const;

/** The promo banners of `docs/design/banner` (resized to webp in `assets/banners`); the alt text is what the banner itself says. */
export const BANNERS = [
  ['banner1', 'دوزاری: بالاخره دوزاریت می‌افته! پازل، رقابت با رفقا، سفر به ۳۱ استان'],
  ['age-adult', 'دوزاری بزرگسال ۱۸+؛ صرافی بزرگ‌ترها: بازی کامل با دوئل زنده و حدس قیمت با شرط سکه'],
  ['banner2', '۱۶ کلمه، ۴ دسته! کلمه‌های هم‌خانواده را کنار هم بچین'],
  ['banner4', 'قیمت قدیما یادته؟ از نون سنگک تا پیکان جوانان'],
  ['banner3', 'با رفقات رقابت کن؛ رو در رو، زنده، همین الان'],
  ['banner5', 'سفر به ۳۱ استان؛ هر شهر یه بازارچه و یه سوغاتی'],
  ['banner6', 'نصف جهان تا شیراز؛ گز اصفهان، گل‌محمدی فارس'],
  ['banner7', 'هر روز یه جایزه؛ گردونه را بچرخون و سکه ببر'],
  ['banner8', 'با کل محل آشنا شو؛ همین حالا رایگان نصب کن'],
] as const;
const banner = (name: string, alt: string, opts: { eager?: boolean; cls?: string } = {}): string =>
  `<img${opts.cls ? ` class="${opts.cls}"` : ''} src="/banners/${name}.webp" alt="${escapeHtml(alt)}" width="1600" height="900"${opts.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
/** Banners that are not in the carousel (the kid and teen age cards). */
const AGE_BANNERS = [['age-kid', 'دوزاری کوچولو؛ فضای آموزشی کودک تا ۱۱ سال با حرف، کلمه و معنی'], ['age-teen', 'نوجوان ۱۲ تا ۱۷ سال؛ همون بازی با پازل راحت‌تر، رقابت و دوئل با رفقا']] as const;
const bannerAlt = (name: string): string => [...BANNERS, ...AGE_BANNERS].find((b) => b[0] === name)?.[1] ?? '';

/** The sliding banner strip: plain scroll-snap (works without scripts); the script only adds auto-play, arrows and dots. */
const carousel = (): string =>
  `<div class="car" role="region" aria-roledescription="carousel" aria-label="بنرهای معرفی بازی"><div class="track" tabindex="0">${BANNERS.map(([n, alt], k) => `<figure aria-label="${faNum(k + 1)} از ${faNum(BANNERS.length)}">${banner(n, alt, { eager: k === 0 })}</figure>`).join('')}</div>
<div class="nav"><button class="arr" type="button" data-go="-1" aria-label="قبلی">›</button><span class="dots">${BANNERS.map((_, k) => `<button class="dot" type="button" data-i="${k}" aria-label="بنر ${faNum(k + 1)}"${k === 0 ? ' aria-current="true"' : ''}></button>`).join('')}</span><button class="arr" type="button" data-go="1" aria-label="بعدی">‹</button></div></div>`;

const TICKER = ['قیمت اسمی، بدون تعدیل تورم', '۱۶ کالا، ۴ گروه', 'چالش روزانه', 'رقابت زنده با رفقا', 'سفر به ۳۱ استان', 'گردونه‌ی جایزه‌ی هر روز', 'بازی رایگان'];
const ticker = (): string => {
  const row = TICKER.map((t) => `<span>${escapeHtml(t)}</span>`).join('');
  return `<div class="mq" aria-hidden="true"><div class="tr">${row}${row}</div></div>`;
};

/** One alternating feature row: a banner in a tilted frame next to the text. `flip` puts the picture on the other side. */
const showRow = (cls: string, a: { h: string; p: string; chips: string[]; art: string; flip?: boolean }): string =>
  `<section class="band ${cls}"><div class="in show" style="padding-top:80px;padding-bottom:80px"><div class="tx rv ${a.flip ? 'r' : 'l'}"><h2>${escapeHtml(a.h)}</h2><p>${escapeHtml(a.p)}</p><div class="chips">${a.chips.map((c) => `<span class="pill sm">${escapeHtml(c)}</span>`).join('')}</div></div><div style="order:${a.flip ? -1 : 0}">${a.art}</div></div></section>`;

const frame = (name: string, t = '-2deg', d = '0s'): string => `<div class="frame rv z" style="--t:${t};--d:${d}">${banner(name, bannerAlt(name))}</div>`;

/* ---- age tracks (docs/logic/age-tracks.md): the adult game first, the kid and teen spaces beside it ---- */

/** What the adult track really has (`age-tracks.md` §What each band gets): [metal, title, text]. Metals follow the adult UI kit: gold play, copper competition, silver price guess, bronze the rest. */
const ADULT_FEATURES = [
  ['gold', 'پازل کامل قیمت', 'شانزده کالا، چهار گروه پنهان؛ همه‌ی پازل‌های بزرگسال، از چالش روزانه تا جدول‌های سخت، با قیمت اسمی و بدون تعدیل تورم.'],
  ['silver', 'حدس قیمت با شرط سکه', 'بعد از پازل، قیمت کالا را حدس بزن؛ فقط در حالت بزرگسال می‌توانی روی حدست سکه شرط ببندی.'],
  ['copper', 'دوئل زنده و میز خصوصی', 'رو در رو، دو در دو یا میز خصوصی با رفقا؛ حریف‌یابی فقط بین بزرگسال‌هاست.'],
  ['copper', 'تورنومنت و جدول رتبه‌ها', 'تورنومنت‌ها و جدول رتبه‌ی بزرگسال‌ها از بقیه‌ی رده‌ها جداست؛ رقابت بین هم‌سن‌وسال‌ها.'],
  ['bronze', 'گفت‌وگوی آزاد', 'با کد دعوت، گفت‌وگوی آزاد باز می‌شود؛ تا آن موقع تیکه‌های آماده‌ی بازی را داری.'],
  ['bronze', 'کالا و قیمت پیشنهادی', 'کالا یا قیمتی که یادت هست را برای بازی پیشنهاد بده؛ این بخش مخصوص بزرگسال‌هاست.'],
] as const;

const metalCards = (): string => `<ul class="metals">${ADULT_FEATURES.map(([m, t, d], k) => `<li class="${m} rv" style="--d:${(k % 3) * 0.1}s"><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></li>`).join('')}</ul>`;

/** Home: the adult band, big and dark, right under the banner strip. */
const adultBand = (name: string): string =>
  `<section class="band ad" id="adult"><div class="in adg" style="padding-top:72px;padding-bottom:72px">
<div class="col rv l" style="gap:18px"><div class="adrow"><span class="adbadge">18+</span><span class="adk">صرافی بزرگ‌ترها</span></div>
<h2>${escapeHtml(name)} بزرگسال؛ <em>بازی کامل</em></h2>
<p style="font-size:19px">همان بازی قیمت و خاطره‌ی قدیمی، بدون محدودیت‌های فضای بچه‌ها: پازل کامل، دوئل زنده، حدس قیمت با شرط سکه و رقابت فقط با بزرگسال‌ها.</p>
<ul class="adlist"><li>پازل‌های کامل با قیمت اسمی و بدون تعدیل تورم</li><li>دوئل زنده، دو در دو و میز خصوصی با رفقا</li><li>حدس قیمت با شرط سکه، تورنومنت و جدول رتبه‌ی بزرگسال‌ها</li><li>هیچ محتوای کودک در حساب بزرگسال دیده نمی‌شود</li></ul>
<a class="brass" href="/ages#adult">معرفی کامل بزرگسال</a></div>
<div class="adart rv z">${banner('age-adult', bannerAlt('age-adult'))}</div></div></section>`;

const kidTeenCards = (name: string): string => {
  const card = (n: string, t: string, ageLabel: string, lines: string[]): string =>
    `<article class="agec rv z">${banner(n, bannerAlt(n))}<div class="b"><h3>${escapeHtml(t)} <small style="font:700 15px Vazirmatn">${escapeHtml(ageLabel)}</small></h3><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul></div></article>`;
  return `<div class="ages3">${card('age-kid', `${name} کوچولو`, 'تا ۱۱ سال', ['پازل ساده‌ی تصویری از چیزهایی که بچه‌ها می‌شناسند', 'بعد از پازل، درس کلمه: حرف، کلمه، تصویر و یک قصه‌ی کوتاه', 'گفت‌وگوی امن با تیکه‌های آماده، بدون شرط‌بندی و بدون خرید'])}${card('age-teen', 'نوجوان', '۱۲ تا ۱۷ سال', ['همان بازی اصلی، با پازل‌های آسان‌تر در ابتدا', 'حدس قیمت بدون شرط سکه', 'دوستی و میز خانوادگی با تأیید بزرگ‌تر'])}</div>`;
};

/** Home: a short «every age» strip under the adult band; the details live on `/ages`. */
const agesStrip = (name: string): string =>
  `<section class="in sec col" style="gap:30px"><div class="col" style="align-items:center;text-align:center;gap:6px"><h2 class="big rv">بازی برای هر سن</h2><p class="rv" style="margin:0;font-weight:600;font-size:17px;opacity:.8">یک ${escapeHtml(name)}، سه رده؛ هر کس فضای خودش را دارد</p></div>${kidTeenCards(name)}<p class="agelink" style="justify-content:center;margin:0"><a href="/ages">مقایسه‌ی کامل رده‌ها و راهنمای والدین ←</a></p></section>`;

/** The try-it puzzle: the grouping mechanic with plain words (a red herring included: «نی» is also an instrument). Behaviour in `HOME_JS`. */
const DEMO_GROUPS = [
  ['میوه‌های پاییزی', ['انار', 'به', 'خرمالو', 'انگور']],
  ['سازهای ایرانی', ['تار', 'دف', 'کمانچه', 'سنتور']],
  ['ماشین‌های قدیمی', ['سمند', 'پیکان', 'ژیان', 'پراید']],
  ['چای‌خانه‌ی سنتی', ['نی', 'استکان', 'سماور', 'قلیون']],
] as const;
const DEMO_ORDER = [4, 12, 1, 9, 7, 0, 14, 5, 10, 3, 13, 8, 2, 15, 6, 11];
type DemoTile = { x: string; g: number; svg?: string; image?: string | null };
const demo = (live: DemoPuzzle | null): string => {
  const ok = live !== null && live.groups.length === 4 && live.groups.every((g) => g.items.length === 4);
  const titles = ok ? live.groups.map((g) => g.title) : DEMO_GROUPS.map(([t]) => t);
  const words: DemoTile[] = ok ? live.groups.flatMap((g, n) => g.items.map((i) => ({ x: i.name, g: n, svg: i.svg, image: i.image }))) : DEMO_GROUPS.flatMap(([, w], g) => w.map((x) => ({ x, g })));
  const tiles = DEMO_ORDER.map((i) => words[i] as DemoTile);
  return `<div class="demo${ok ? ' icons' : ''}" id="demo" data-groups='${escapeHtml(JSON.stringify(titles))}'>
<div class="dgrid">${tiles.map((t) => `<button class="t" type="button" data-g="${t.g}" aria-pressed="false">${t.image && /^https?:\/\//.test(t.image) ? `<img src="${escapeHtml(t.image)}" alt="" loading="lazy" decoding="async">` : (t.svg ?? '')}<span>${escapeHtml(t.x)}</span></button>`).join('')}</div>
<p class="dmsg" role="status" aria-live="polite">چهارتا کالای هم‌دسته را انتخاب کن</p>
<div class="dbar"><button class="btn" type="button" data-act="submit" disabled>ثبت کن</button><button class="btn yellow" type="button" data-act="reset">از اول</button></div>
<p class="dnote">${ok ? 'یک پازل واقعی از بازی؛ گروه‌ها بر پایه‌ی قیمت کالاها در سال‌های گذشته‌اند.' : 'نمونه‌ی ساده با کلمه‌ها؛ در بازی اصلی گروه‌ها بر پایه‌ی قیمت کالاها در سال‌های گذشته‌اند.'}</p></div>`;
};

/** The page script: banner auto-play, animated numbers and the try-it puzzle. */
const HOME_JS = `(function(){
var d=document,R=matchMedia('(prefers-reduced-motion: reduce)').matches;
var fa=function(n){return String(n).replace(/\\d/g,function(x){return '۰۱۲۳۴۵۶۷۸۹'[x]})};
var car=d.querySelector('.car');
if(car){var tr=car.querySelector('.track'),dots=car.querySelectorAll('.dot'),n=dots.length,cur=0,hold=false,t;
var rtl=function(){return getComputedStyle(tr).direction==='rtl'};
var go=function(i){cur=(i+n)%n;tr.scrollTo({left:(rtl()?-1:1)*cur*tr.clientWidth,behavior:R?'auto':'smooth'})};
tr.addEventListener('scroll',function(){var i=Math.round(Math.abs(tr.scrollLeft)/tr.clientWidth);if(i!==cur&&i<n){cur=i}dots.forEach(function(b,k){b.setAttribute('aria-current',k===cur)})},{passive:true});
car.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.dataset.go)go(cur+Number(b.dataset.go));else if(b.dataset.i)go(Number(b.dataset.i))});
['mouseenter','focusin','touchstart'].forEach(function(ev){car.addEventListener(ev,function(){hold=true},{passive:true})});
['mouseleave','focusout'].forEach(function(ev){car.addEventListener(ev,function(){hold=false})});
if(!R)setInterval(function(){if(!hold&&!d.hidden)go(cur+1)},4500);}
var cs=d.querySelectorAll('[data-to]');
if(cs.length&&'IntersectionObserver' in window&&!R){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io.unobserve(e.target);var el=e.target,to=Number(el.dataset.to),s=performance.now();(function f(now){var p=Math.min(1,(now-s)/1200);el.textContent=fa(Math.round(to*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(f)})(s)})},{threshold:.6});cs.forEach(function(c){io.observe(c)})}
var demo=d.getElementById('demo');
if(demo){var names=JSON.parse(demo.dataset.groups),colors=['#FFC93C','#7ED957','#3FC1F0','#A66BF0'],grid=demo.querySelector('.dgrid'),msg=demo.querySelector('.dmsg'),m0=demo.querySelector('.dmsg').textContent,ok=demo.querySelector('[data-act=submit]'),sel=[],solved=0,miss=0;
var tiles=[].slice.call(grid.querySelectorAll('.t'));
var sync=function(){tiles.forEach(function(t){t.setAttribute('aria-pressed',sel.indexOf(t)>-1)});ok.disabled=sel.length!==4};
grid.addEventListener('click',function(e){var t=e.target.closest('.t');if(!t||t.classList.contains('done'))return;var i=sel.indexOf(t);if(i>-1)sel.splice(i,1);else if(sel.length<4)sel.push(t);sync()});
ok.addEventListener('click',function(){if(sel.length!==4)return;var g=sel[0].dataset.g,same=sel.filter(function(t){return t.dataset.g===g}).length;
if(same===4){var bar=d.createElement('div');bar.className='gb';bar.textContent=names[g];bar.style.setProperty('--gc',colors[g]);bar.style.order=solved*5;grid.appendChild(bar);sel.forEach(function(t,k){t.classList.add('done','pop');t.style.setProperty('--gc',colors[g]);t.style.order=solved*5+1+k;t.setAttribute('aria-pressed','false')});solved++;sel=[];msg.textContent=solved===4?'دوزاری‌ات افتاد! همه‌ی گروه‌ها را پیدا کردی.':'آفرین! یک گروه پیدا شد.';sync();tiles.forEach(function(t){if(!t.classList.contains('done'))t.style.order=100})}
else{miss++;sel.forEach(function(t){t.classList.remove('shake');void t.offsetWidth;t.classList.add('shake')});msg.textContent=same===3?'یکی‌شون جاش اشتباهه!':'این‌ها هم‌دسته نیستند؛ دوباره فکر کن.';sel=[];sync()}});
demo.querySelector('[data-act=reset]').addEventListener('click',function(){grid.querySelectorAll('.gb').forEach(function(b){b.remove()});tiles.forEach(function(t){t.className='t';t.style.order='';t.style.removeProperty('--gc')});sel=[];solved=0;miss=0;msg.textContent=m0;sync()})}
})();`;

/** The people of the game for the home strip and the about page: the game's own cast list, else the designed one. */
export const castOf = (cast: CastMember[]): { name: string; role: string; who: Who; id: string; image: string | null }[] =>
  (cast.length ? cast : WHO.slice(0, 8).map((w) => ({ id: w, name: CAST_NAMES[w], role: '', bio: '', image: null }))).map((c, n) => ({ id: c.id, name: c.name, role: c.role, who: whoOf(c, n), image: photoOf(c.image) }));

const FLOATERS: [string, string, string, string][] = [['coin', '38%', '52%', '0s'], ['gift', '44%', '4%', '1.2s'], ['crown', '3%', '66%', '2.1s'], ['coinStack', '47%', '82%', '.6s'], ['hat', '90%', '8%', '1.7s'], ['map', '92%', '70%', '2.8s']];

export function homePage(site: Site, data: LandingData, latest: PostSummary[], demoPuzzle: DemoPuzzle | null = null): string {
  const { site: s, cast, faq } = data;
  const reviews = data.reviews ?? [];
  const i = ids(site);
  const title = s.seo?.title || `${s.name} — ${s.tagline}`;
  const desc = description(s.seo?.description || s.heroText || s.tagline);
  const nodes: Record<string, unknown>[] = [
    { '@type': 'WebPage', '@id': `${site.url}/#webpage`, url: `${site.url}/`, name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': i.site }, about: { '@id': i.org }, primaryImageOfPage: { '@type': 'ImageObject', url: absolute(site, '/banners/banner1.webp'), width: 1600, height: 900 } },
    {
      '@type': 'HowTo',
      name: `${s.name} چطور بازی می‌شود؟`,
      step: HOW_TO.map(([name, text], n) => ({ '@type': 'HowToStep', position: n + 1, name, text })),
    },
  ];
  const faqN = faqNode(faq);
  if (faqN) nodes.push(faqN);
  const people = castOf(cast).slice(0, 8);
  const stats: [number, string, string][] = [[16, 'کالا روی هر جدول', '#FF4D8D'], [4, 'گروه پنهان', '#7E46D6'], [31, 'استان برای سفر', '#2FA84F'], [4, 'حالت بازی', '#E8612A']];
  const body = `
<section class="band y hero"><div class="in grid2">
${FLOATERS.map(([n, x, y, dl]) => `<img class="fl" src="/items/${n}.svg" alt="" width="56" height="56" style="inset-inline-start:${x};top:${y};--d:${dl}" aria-hidden="true">`).join('')}
<div class="col" style="gap:22px;position:relative"><span class="pill">بازی قیمت‌های قدیمی ایران · رایگان</span>
<h1>${escapeHtml(s.heroTitle || s.name)}</h1>
<p class="lead">${escapeHtml(s.heroText)}</p>
<div class="badges">${storeBadges(site)}</div>
<a class="agelink" href="/ages#adult"><span class="adbadge" style="font-size:18px;padding:0 10px;box-shadow:0 3px 0 #000">18+</span> نسخه‌ی بزرگسال با دوئل زنده و حدس قیمت با شرط سکه ←</a></div>
<div class="stage"><span class="disc"></span>${img('dozari-cheer-anim', 320, 368, { eager: true, alt: `${s.name}، شخصیت اصلی بازی` })}</div>
</div></section>
${ticker()}
<section class="in sec col" style="gap:36px;padding-bottom:56px"><h2 class="big rv">بازار دوزاری را ببین</h2><div class="rv z">${carousel()}</div></section>
${adultBand(s.name)}
${agesStrip(s.name)}
<section class="in col" style="gap:36px;padding-bottom:80px"><h2 class="big rv">چرا ${escapeHtml(s.name)}؟</h2>
<ul class="cards4">${FEATURES.map(([ic, bg, t, d], k) => `<li class="tile rv" style="--d:${k * 0.1}s"><div class="ic" style="background:${bg}">${item(ic)}</div><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></li>`).join('')}</ul></section>
${showRow('p', { h: '۱۶ کلمه، ۴ دسته!', p: 'شانزده کالا روی صفحه است و فقط چهار قاعده‌ی پنهان. کالاهای هم‌دسته را کنار هم بچین تا هر گروه رنگ خودش را بگیرد.', chips: ['پازل روزانه', 'چهار گروه رنگی', 'اشتباه محدود'], art: frame('banner2', '-2deg') })}
${showRow('y', { h: 'قیمت قدیما یادته؟', p: 'از نون سنگک تا پیکان جوانان؛ قیمت اسمی هر کالا در یک سال شمسی، همان عددی که آن روز روی برچسب بود.', chips: ['قیمت اسمی', 'بدون تعدیل تورم', 'سال‌های شمسی'], art: frame('banner4', '2deg'), flip: true })}
${showRow('s', { h: 'با رفقات رقابت کن', p: 'حریف پیدا کن و ببین دوزاری کی زودتر می‌افتد؛ تکی، زنده دونفره، دو در دو، میز خصوصی یا تورنومنت.', chips: ['رو در رو', 'دو در دو', 'میز خصوصی', 'تورنومنت'], art: frame('banner3', '-2deg') })}
<section class="band g"><div class="in show" style="padding-top:80px;padding-bottom:80px"><div class="tx rv l"><h2>سفر به ۳۱ استان</h2><p>هر شهر یه بازارچه و یه سوغاتی دارد؛ از گز اصفهان تا گل‌محمدی فارس. استان‌ها را یکی‌یکی باز کن و جدول‌های تازه‌اش را بازی کن.</p><div class="chips"><span class="pill sm">نقشه‌ی سفر</span><span class="pill sm">سوغاتی هر استان</span></div></div><div class="pair">${frame('banner5', '-2deg')}${frame('banner6', '2.5deg', '.15s')}</div></div></section>
${showRow('o', { h: 'هر روز یه جایزه', p: 'گردونه‌ی روزانه را بچرخان و سکه ببر؛ سکه‌ها برای آواتار، کلاه و لباس مخصوص خودت خرج می‌شوند.', chips: ['گردونه‌ی روزانه', 'سکه‌ی بازی', 'ظاهر اختصاصی'], art: frame('banner7', '2deg'), flip: true })}
<section class="band v"><div class="in col" style="gap:36px;padding-top:80px;padding-bottom:80px"><h2 class="big rv" style="color:var(--cream)">دوزاری در یک نگاه</h2>
<div class="stats">${stats.map(([n, l, c], k) => `<div class="stat rv z" style="--c:${c};--d:${k * 0.1}s"><b data-to="${n}">${faNum(n)}</b><span>${l}</span></div>`).join('')}</div></div></section>
<section class="in sec col" style="gap:28px"><div class="col" style="align-items:center;text-align:center;gap:6px"><h2 class="big rv">همین‌جا امتحان کن</h2><p class="rv" style="margin:0;font-weight:600;font-size:17px;opacity:.8">دوزاری‌ات می‌افتد؟ شانزده کالا، چهار دسته</p></div><div class="rv z">${demo(demoPuzzle)}</div></section>
<section class="band s"><div class="in col" style="gap:36px;padding-top:80px;padding-bottom:80px"><h2 class="big rv">${escapeHtml(s.name)} چطور بازی می‌شود؟</h2>
<ol class="steps">${HOW_TO.map(([n, t, art], k) => `<li class="rv" style="--d:${k * 0.12}s"><div class="shot">${img(art, 216, 248)}</div><span class="num">${faNum(k + 1)}</span><h3>${escapeHtml(n)}</h3><p>${escapeHtml(t)}</p></li>`).join('')}</ol></div></section>
<section class="in sec col" style="gap:28px"><div class="col" style="align-items:center;text-align:center;gap:6px"><h2 class="big rv">آدم‌های بازار</h2><p style="margin:0;font-weight:600;font-size:17px;opacity:.8">هر کدوم یه قصه دارن و یه عالمه کالا</p></div>
<div class="castbox rv z">${people.map((c, k) => `<a href="/cast#${escapeHtml(c.id)}" style="--d:${(k % 4) * 0.4}s">${c.image ? `<img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" width="120" height="138" loading="lazy" style="object-fit:contain">` : img(`${c.who}-idle`, 120, 138, { alt: c.name })}<span>${escapeHtml(c.name)}</span></a>`).join('')}</div>
<p style="text-align:center;margin:0"><a href="/cast">معرفی کامل بازیگران دوزاری</a></p></section>
${latest.length ? `<section class="in col" style="gap:28px;padding-bottom:80px"><div class="row"><h2 class="big rv" style="text-align:start">تازه‌های وبلاگ</h2><a class="more" href="/blog">همهٔ مطالب ←</a></div><ul class="pgrid">${latest.map(postCard).join('')}</ul></section>` : ''}
${reviews.length ? `<section class="in col" style="gap:20px;padding-bottom:80px"><h2 class="big rv">بازیکن‌ها چی می‌گن؟</h2>${reviewsBlock(reviews.slice(0, 6))}<p style="text-align:center;margin:0"><a href="/reviews">همه‌ی نظرها</a></p></section>` : ''}
${faq.length ? `<section class="in col" style="gap:28px;padding-bottom:80px"><h2 class="big rv">پرسش‌های متداول</h2>${faqList(faq)}</section>` : ''}
<section class="in col" style="gap:28px;padding-bottom:80px;align-items:center"><h2 class="big rv">همین حالا رایگان دانلود کن</h2><a class="fin rv z" href="/download" aria-label="دانلود ${escapeHtml(s.name)}">${banner('banner8', bannerAlt('banner8'))}</a><a class="btn big yellow pulse" href="/download">دانلود ${escapeHtml(s.name)}</a></section>
<script>${HOME_JS}</script>`;
  return layout(site, head(site, { title, description: desc, path: '/', nodes }), null, body, { active: 'home', wide: true });
}

export const webPage = (site: Site, path: string, type: string, title: string, desc: string): Record<string, unknown> => ({ '@type': type, '@id': `${absolute(site, path)}#webpage`, url: absolute(site, path), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } });

/* ---- about ---- */

export function aboutPage(site: Site, cast: CastMember[] = []): string {
  const title = `درباره‌ی ${site.name}: قصه‌ی اسم و ایده‌ی بازی`;
  const desc = description(`${site.name} یک بازی فارسی درباره‌ی قیمت‌های قدیمی ایران است؛ ببین اسمش از کجا آمده و چه چیزهایی برایمان مهم است.`);
  const n = escapeHtml(site.name);
  const values = [
    ['۰۱', '#FF4D8D', 'قیمت واقعی', 'قیمت‌ها اسمی‌اند، همان عددی که آن سال روی برچسب بود؛ هیچ‌کدام با تورم تعدیل نشده.'],
    ['۰۲', '#3FC1F0', 'بازی منصفانه', 'داوری و امتیاز و سکه همه سمت سرور است؛ تقلب جا ندارد و آگهی یا ردیاب شخص ثالث در برنامه نیست.'],
    ['۰۳', '#A66BF0', 'برای همه‌ی نسل‌ها', 'پدربزرگ‌ها قیمت‌ها را یادشان است و بچه‌ها می‌خواهند بدانند؛ بازی دورهمی را راه می‌اندازد.'],
  ] as const;
  const team = castOf(cast).slice(0, 4);
  const body = `
<section class="band v"><div class="in grid2">
<div class="col"><span dir="ltr" style="align-self:flex-start;font:700 13px ui-monospace,monospace;color:var(--yellow)">ABOUT US</span>
<h1 style="font-size:clamp(44px,6vw,76px)">ما عاشق قیمت‌های قدیمی‌ایم</h1>
<p class="lead" style="font-size:18px">${n} را کسانی ساخته‌اند که دلشان برای قیمت نان و سکه و بلیت سینما، برای بازی‌های خانوادگی و قصه‌ی بازار تنگ شده بود. می‌خواستیم بازی‌ای بسازیم که هم سرگرم کند، هم یادمان بیاورد چه روزگاری داشتیم.</p></div>
<div class="trio">${img('mashti-wave', 200, 230, { eager: true, alt: 'مشتی' })}${img('dozari-cheer-anim', 240, 276, { eager: true, cls: 'mid', alt: n })}${img('khale-idle', 200, 230, { eager: true, alt: 'خاله' })}</div>
</div></section>
<section class="in sec prose col" style="gap:20px"><h2 class="big" style="text-align:start;font-size:clamp(32px,4vw,48px)">قصه‌ی اسم «${n}»</h2>
<p>قدیم‌ها توی تلفن‌های عمومی سکه‌ی دوریالی می‌انداختند و تا سکه نمی‌افتاد تماس وصل نمی‌شد. از همان‌جا اصطلاح «دوزاری‌اش افتاد» آمد؛ یعنی بالاخره فهمید. بازی ما هم همین است: قیمت‌ها را کنار هم می‌گذاری تا ناگهان دوزاری‌ات بیفتد و قاعده‌ی پنهان گروه را ببینی.</p></section>
<section class="band yb"><div class="in col" style="gap:32px;padding-top:72px;padding-bottom:72px"><h2 class="big" style="font-size:clamp(32px,4vw,48px)">چیزهایی که برامون مهمه</h2>
<ul class="cards4">${values.map(([num, c, t, d]) => `<li class="tile cream"><div class="n" style="color:${c}">${num}</div><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></li>`).join('')}</ul></div></section>
<section class="in sec col" style="gap:32px"><h2 class="big" style="font-size:clamp(32px,4vw,48px)">آدم‌های ${n}</h2>
<div class="team">${team.map((m, k) => `<div class="member"><span class="face" style="width:120px;height:120px;background:${['#FFC93C', '#FF4D8D', '#3FC1F0', '#7ED957'][k % 4]}">${m.image ? `<img src="${escapeHtml(m.image)}" alt="${escapeHtml(m.name)}" width="120" height="120" loading="lazy">` : img(`${m.who}-face`, 120, 120, { alt: m.name })}</span><b>${escapeHtml(m.name)}</b>${m.role ? `<span>${escapeHtml(m.role)}</span>` : ''}</div>`).join('')}</div></section>
${promo('lime', 'می‌خوای با ما کار کنی؟', 'همکاری، تبلیغات یا پیشنهاد کالا؟ خوشحال می‌شیم بشنویم.', '<a class="btn big dark" href="/contact">تماس با ما</a>')}`;
  return layout(site, head(site, { title, description: desc, path: '/about', nodes: [webPage(site, '/about', 'AboutPage', title, desc)], crumbs: [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'درباره‌ی ما' }] }), null, body, { active: 'about', wide: true });
}

/* ---- download ---- */

export function downloadPage(site: Site, reviews: StoreReview[] = []): string {
  const title = `دانلود ${site.name}: رایگان برای اندروید، مرورگر و بله`;
  const desc = description(`${site.name} را رایگان روی گوشی اندروید نصب کن، همین حالا در مرورگر بازی کن یا از طریق ربات بله شروع کن.`);
  type Store = { fa: string; os: string; ab: string; bg: string; cta: string; href: string | null };
  const stores: Store[] = [
    { fa: 'نسخهٔ وب', os: 'مرورگر', ab: icon('web'), bg: '#FF7A3D', cta: 'بازی آنلاین', href: site.appUrl },
    { fa: 'دانلود مستقیم', os: 'فایل APK اندروید', ab: icon('android'), bg: '#FFC93C', cta: 'دریافت فایل', href: site.androidApp },
    { fa: 'بله', os: 'بازی از طریق ربات', ab: BALE_ICON, bg: '#fff', cta: 'شروع در بله', href: site.baleBot ?? null },
    ...(site.telegramApp ? [{ fa: 'تلگرام', os: 'بازی در مینی‌اپ، بدون نصب', ab: TELEGRAM_ICON, bg: '#2AABEE', cta: 'بازی در تلگرام', href: site.telegramApp }] : []),
    { fa: 'گوگل‌پلی', os: 'اندروید', ab: logo('googleplay', 'svg', 'گوگل‌پلی'), bg: '#fff', cta: site.stores?.googlePlay ? 'دریافت از گوگل‌پلی' : 'به‌زودی', href: site.stores?.googlePlay ?? null },
    { fa: 'کافه‌بازار', os: 'اندروید', ab: logo('cafebazaar', 'png', 'کافه‌بازار'), bg: '#fff', cta: site.stores?.bazaar ? 'دریافت از بازار' : 'به‌زودی', href: site.stores?.bazaar ?? null },
    { fa: 'مایکت', os: 'اندروید', ab: logo('myket', 'svg', 'مایکت'), bg: '#fff', cta: site.stores?.myket ? 'دریافت از مایکت' : 'به‌زودی', href: site.stores?.myket ?? null },
    { fa: 'اپ‌استور', os: 'آیفون و آیپد', ab: logo('appstore', 'svg', 'اپ‌استور'), bg: '#fff', cta: site.iosApp ? 'دریافت برنامه' : 'به‌زودی', href: site.iosApp },
  ];
  const reqs = [['اتصال اینترنت', 'برای بازی زنده و ذخیره‌ی پیشرفت'], ['حساب', 'مهمان؛ شماره‌ی تلفن اختیاری است'], ['مرورگر', 'نسخه‌ی تازه‌ی کروم، فایرفاکس، سافاری یا ادج'], ['هزینه', 'رایگان']] as const;
  const inGame = ['تکی، زنده دونفره، دو در دو و میز خصوصی', 'جدول تازه هر روز', 'آواتار، کلاه و لباس با سکه‌ی بازی', 'نمودار قیمت پایان هر بازی برای دیدن مسیر قیمت‌ها'];
  const body = `
<section class="band g"><div class="in grid2">
<div class="col" style="gap:16px"><h1 style="font-size:clamp(48px,6vw,80px)">${escapeHtml(site.name)} رو دانلود کن</h1>
<p class="lead" style="font-size:18px">رایگان، بدون نیاز به ثبت‌نام طولانی. پیشرفتت با حسابت روی هر دستگاه برمی‌گردد.</p>
<div class="chips"><span class="pill">رایگان</span><span class="pill">اندروید و وب</span><span class="pill">بدون آگهی مزاحم</span></div></div>
<div class="devices"><div class="shot">${img('dozari-cheer-anim', 180, 207, { eager: true, alt: site.name })}</div>
<div class="qr">${qrSvg(absolute(site, '/download'))}<span>با دوربین گوشی اسکن کن</span></div></div>
</div></section>
<section class="in sec col" style="gap:28px"><h2 class="big" style="text-align:start;font-size:clamp(32px,4vw,44px)">از کجا دانلود کنم؟</h2>
<ul class="stores">${stores
    .map((x) => {
      const inner = `<div class="top2"><span class="ab" style="background:${x.bg}">${x.ab}</span><span class="t"><b>${x.fa}</b><small>${x.os}</small></span></div><span class="cta">${x.cta}</span>`;
      return `<li>${x.href ? `<a class="store" href="${escapeHtml(x.href)}">${inner}</a>` : `<div class="store off" aria-disabled="true">${inner}</div>`}</li>`;
    })
    .join('')}</ul></section>
<section class="band s"><div class="in grid2" style="align-items:start;gap:32px">
<div class="reqs"><h2 class="l">چیزهایی که لازم است</h2>${reqs.map(([k, v]) => `<div class="req"><span>${k}</span><span>${v}</span></div>`).join('')}</div>
<div class="reqs"><h2 class="l">توی بازی چی هست؟</h2><div class="note">${inGame.map((t) => `<span>• ${t}</span>`).join('')}</div></div>
</div></section>${reviews.length ? `
<section class="in sec col" style="gap:20px"><h2 class="big" style="text-align:start;font-size:clamp(32px,4vw,44px)">بازیکن‌ها چی می‌گن؟</h2>${reviewsBlock(reviews.slice(0, 3))}<p style="margin:0"><a href="/reviews">همه‌ی نظرها</a></p></section>` : ''}`;
  return layout(site, head(site, { title, description: desc, path: '/download', nodes: [webPage(site, '/download', 'WebPage', title, desc)], crumbs: [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'دانلود' }] }), null, body, { active: 'download', wide: true });
}

/* ---- contact ---- */

// Fills the mail body with the sender's name and contact before the mail program opens; without scripts the message alone is sent.
const MAIL_JS = `document.querySelector('.cform form').addEventListener('submit',function(e){var f=e.target,b=f.elements.body;var n=f.elements.who.value,c=f.elements.contact.value;b.value=(n?n+'\\n':'')+(c?c+'\\n\\n':'')+b.value;});`;

export function contactPage(site: Site, faq: FaqPair[]): string {
  const title = `تماس با ${site.name} و پرسش‌های متداول`;
  const desc = description(`پاسخ پرسش‌های رایج درباره‌ی ${site.name} و راه‌های تماس با تیم بازی.`);
  const nodes: Record<string, unknown>[] = [webPage(site, '/contact', 'ContactPage', title, desc)];
  const faqN = faqNode(faq);
  if (faqN) nodes.push(faqN);
  const mail = site.contactEmail;
  const form = mail
    ? `<form action="mailto:${escapeHtml(mail)}" method="get" enctype="text/plain" class="col" style="gap:12px">
<input name="who" placeholder="اسمت" autocomplete="name"><input name="contact" placeholder="ایمیل یا شماره موبایل" autocomplete="email">
<select name="subject"><option>پشتیبانی بازی</option><option>پیشنهاد کالا یا قیمت</option><option>همکاری و تبلیغات</option><option>رسانه</option></select>
<textarea name="body" rows="4" placeholder="پیامت رو بنویس…" required></textarea>
<button type="submit">ارسال پیام</button><p class="hint">با زدن دکمه، برنامه‌ی ایمیل تو با پیام آماده باز می‌شود.</p></form><script>${MAIL_JS}</script>`
    : '<p class="hint" style="font-weight:800">فعلاً از بخش پیام‌های برنامه یا کانال‌های رسمی بازی برایمان بنویس.</p>';
  const info = [mail ? `<a href="mailto:${escapeHtml(mail)}"><span>ایمیل</span><span class="v">${escapeHtml(mail)}</span></a>` : '', ...site.sameAs.map((u) => `<a href="${escapeHtml(u)}" rel="noopener me"><span>${escapeHtml(socialLabel(u))}</span><span class="v">${escapeHtml(hostOf(u))}</span></a>`)].join('');
  const body = `
<section class="in csplit">
<div class="col" style="gap:20px"><h1 style="font-size:clamp(44px,5vw,64px)">سوالات متداول</h1>${faq.length ? faqList(faq, 0) : '<p>به‌زودی پرسش‌های رایج این‌جا جمع می‌شوند.</p>'}</div>
<div class="sticky"><div class="cform"><div class="hd">${face('khale-wave', 72)}<h2>برامون پیام بفرست</h2></div>${form}</div>${info ? `<div class="info">${info}</div>` : ''}</div>
</section>`;
  return layout(site, head(site, { title, description: desc, path: '/contact', nodes, crumbs: [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'تماس و پرسش‌ها' }] }), null, body, { active: 'contact', wide: true });
}

/* ---- blog ---- */

export function blogIndexPage(site: Site, list: PostList): string {
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const path = list.page > 1 ? `/blog?page=${list.page}` : '/blog';
  const title = list.page > 1 ? `بلاگ ${site.name} — صفحه‌ی ${list.page}` : `بلاگ ${site.name}: مقاله‌هایی درباره‌ی قیمت‌های قدیمی`;
  const desc = description(`مقاله‌های بلاگ ${site.name} درباره‌ی قیمت کالاها در سال‌های گذشته ایران، نوستالژی و ترفندهای بازی.`);
  const nodes: Record<string, unknown>[] = [
    { '@type': 'CollectionPage', '@id': `${absolute(site, path)}#webpage`, url: absolute(site, path), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } },
    { '@type': 'ItemList', itemListElement: list.posts.map((p, n) => ({ '@type': 'ListItem', position: n + 1, url: absolute(site, `/blog/${encodeURIComponent(p.slug)}`), name: p.title })) },
  ];
  const featured = list.page === 1 ? list.posts[0] : undefined;
  const rest = featured ? list.posts.slice(1) : list.posts;
  const pageHref = (n: number): string => (n === 1 ? '/blog' : `/blog?page=${n}`);
  const pager = pages > 1 ? `<nav class="pager" aria-label="صفحه‌بندی">${Array.from({ length: pages }, (_, k) => k + 1).map((n) => (n === list.page ? `<span class="cur" aria-current="page">${faNum(n)}</span>` : `<a href="${pageHref(n)}">${faNum(n)}</a>`)).join('')}</nav>` : '';
  const body = `
<section class="in col" style="padding-top:56px;padding-bottom:24px"><h1 style="font-size:clamp(48px,6vw,72px)">وبلاگ ${escapeHtml(site.name)}</h1><p style="margin:0;font-weight:600;font-size:18px;opacity:.8">${escapeHtml(desc)}</p></section>
${featured ? `<section class="in" style="padding-top:16px;padding-bottom:32px"><a class="feat" href="/blog/${encodeURIComponent(featured.slug)}"><div class="art">${featured.coverUrl ? `<img class="cover" src="${escapeHtml(featured.coverUrl)}" alt="${escapeHtml(featured.title)}">` : img('dozari-wave', 220, 253, { eager: true })}</div><div class="tx"><span class="pill sm">مطلب ویژه</span><h2>${escapeHtml(featured.title)}</h2>${featured.summary ? `<p>${escapeHtml(featured.summary)}</p>` : ''}<span class="date">${escapeHtml(faDate(featured.publishedAt))}</span></div></a></section>` : ''}
<section class="in col" style="gap:32px;padding-top:16px;padding-bottom:80px">${list.posts.length ? (rest.length ? `<ul class="pgrid">${rest.map(postCard).join('')}</ul>` : '') : '<p>هنوز مطلبی منتشر نشده؛ به‌زودی برمی‌گردیم.</p>'}${pager}</section>`;
  return layout(site, head(site, { title, description: desc, path, nodes, crumbs: [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'بلاگ' }] }), null, body, { active: 'blog', wide: true });
}

export function postPage(site: Site, post: Post, more: PostSummary[], comments: PublicComment[] = [], flash: Flash = null): string {
  const path = `/blog/${encodeURIComponent(post.slug)}`;
  const { html, headings } = renderMarkdown(post.bodyMd);
  const title = post.metaTitle || `${post.title} | ${site.name}`;
  const desc = description(post.metaDescription || post.summary || plainText(post.bodyMd));
  const crumbs: Crumb[] = [{ name: 'خانه', path: '/' }, { name: 'وبلاگ', path: '/blog' }, { name: post.title }];
  const i = ids(site);
  const node: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': `${absolute(site, path)}#article`,
    mainEntityOfPage: absolute(site, path),
    headline: post.title.slice(0, 110),
    description: desc,
    inLanguage: 'fa-IR',
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: post.author ? { '@type': 'Person', name: post.author } : { '@id': i.org },
    publisher: { '@id': i.org },
    isPartOf: { '@id': i.site },
  };
  if (post.coverUrl) node.image = post.coverUrl;
  if (comments.length) node.comment = comments.slice(0, 20).map((c) => ({ '@type': 'Comment', author: { '@type': 'Person', name: c.author }, dateCreated: new Date(c.createdAt).toISOString(), text: c.body }));
  const [who, pose, bg] = artOf(post.slug);
  const toc = headings.filter((h) => h.level === 2);
  const body = `<article class="art-post">
<nav aria-label="مسیر صفحه"><ol class="crumbs">${li(crumbs.map((c) => (c.path !== undefined ? `<a href="${escapeHtml(c.path)}">${escapeHtml(c.name)}</a>` : `<span aria-current="page">${escapeHtml(c.name)}</span>`)))}</ol></nav>
<span class="pill sm">مقاله</span>
<h1>${escapeHtml(post.title)}</h1>
<div class="byline">${face(who, 52)}<div><b>${escapeHtml(post.author || `تیم محتوای ${site.name}`)}</b><span>منتشر شده: <time datetime="${new Date(post.publishedAt).toISOString()}">${escapeHtml(faDate(post.publishedAt))}</time>${post.updatedAt - post.publishedAt > 86_400_000 ? ` · به‌روزرسانی: <time datetime="${new Date(post.updatedAt).toISOString()}">${escapeHtml(faDate(post.updatedAt))}</time>` : ''}</span></div></div>
<div class="heroart" style="background:${bg}">${post.coverUrl ? `<img class="cover" src="${escapeHtml(post.coverUrl)}" alt="${escapeHtml(post.title)}" width="800" height="450">` : img(`${who}-${pose}`, 220, 253, { eager: true })}</div>
${toc.length > 2 ? `<nav class="toc" aria-label="فهرست مطالب"><strong>در این مقاله</strong><ul>${li(toc.map((h) => `<a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`))}</ul></nav>` : ''}
<div class="body">${html}</div>
<div class="cta2"><div><b>${escapeHtml(site.name)} منتظرته!</b><span>رایگان دانلود کن و قیمت‌ها را کنار هم بگذار</span></div><a class="btn" href="/download">دانلود</a></div>
${commentsSection('post', post.slug, comments, flash, 'نظرت درباره‌ی این مقاله')}
</article>
${more.length ? `<section class="in col" style="gap:24px;padding-bottom:80px"><h2 style="font-size:40px">مطالب مرتبط</h2><ul class="related">${more.map((p) => { const [w, , c] = artOf(p.slug); return `<li><a class="rel" href="/blog/${encodeURIComponent(p.slug)}"><span class="sq" style="background:${c}">${p.coverUrl ? `<img src="${escapeHtml(p.coverUrl)}" alt="" loading="lazy">` : img(`${w}-face`, 80, 80)}</span><div><small>مقاله</small><span>${escapeHtml(p.title)}</span></div></a></li>`; }).join('')}</ul></section>` : ''}`;
  return layout(site, head(site, { title, description: desc, path, type: 'article', image: post.coverUrl, nodes: [node], crumbs, publishedTime: post.publishedAt, modifiedTime: post.updatedAt }), null, body, { active: 'blog', wide: true });
}

/* ---- cast ---- */

export function castPage(site: Site, cast: CastMember[], counts: Record<string, number> = {}): string {
  const title = `بازیگران ${site.name}: شخصیت‌های بازی`;
  const desc = description(`با شخصیت‌ها و آدم‌های ${site.name} آشنا شو: کی راهنمای بازی است و هر کس چه نقشی دارد.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'بازیگران' }];
  const nodes: Record<string, unknown>[] = [{ '@type': 'AboutPage', '@id': `${site.url}/cast#webpage`, url: absolute(site, '/cast'), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } }];
  const people = cast.map((c, n) => ({ ...c, who: whoOf(c, n), image: photoOf(c.image) }));
  const body = `<h1>بازیگران ${escapeHtml(site.name)}</h1><p>${escapeHtml(desc)}</p>${people.length ? `<div class="castlist">${people.map((c) => `<section class="cc" id="${escapeHtml(c.id)}">${c.image ? `<img class="photo" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" width="110" height="110" loading="lazy">` : img(`${c.who}-idle`, 110, 126, { alt: c.name })}<div><h2><a href="/cast/${encodeURIComponent(c.id)}" style="color:inherit;text-decoration:none">${escapeHtml(c.name)}</a></h2>${c.role ? `<p class="meta">${escapeHtml(c.role)}</p>` : ''}<p>${escapeHtml(c.bio)}</p><a class="more" href="/cast/${encodeURIComponent(c.id)}#comments">پروفایل و نظرها (${faNum(counts[c.id] ?? 0)})</a></div></section>`).join('')}</div>` : '<p>به‌زودی معرفی می‌شوند.</p>'}`;
  return layout(site, head(site, { title, description: desc, path: '/cast', nodes, crumbs }), crumbs, body);
}

/* ---- ages ---- */

const AGE_FAQ: FaqPair[] = [
  { question: 'دوزاری بزرگسال چه فرقی با نسخه‌ی بچه‌ها دارد؟', answer: 'بزرگسال همه‌ی بازی است: پازل‌های کامل، حدس قیمت با شرط سکه، دوئل و تورنومنت فقط با بزرگسال‌ها و پیشنهاد کالا و قیمت. فضای کودک و نوجوان ساده‌تر و امن‌تر است و بدون شرط‌بندی و خرید.' },
  { question: 'رده‌ی سنی را خودم انتخاب می‌کنم؟', answer: 'بله؛ بعد از ورود می‌پرسیم «چه کسی بازی می‌کنه؟» و یکی از کودک، نوجوان یا بزرگسال را انتخاب می‌کنی. تاریخ تولد هیچ نقشی در انتخاب ندارد. رفتن به رده‌ی بالاتر برای کودک و نوجوان فقط با تأیید بزرگ‌تر ممکن است.' },
  { question: 'بچه‌ام با غریبه‌ها بازی می‌کند؟', answer: 'نه. حریف‌یابی هر رده فقط بین همان رده است و دوست و میز کودک و نوجوان با تأیید والد باز می‌شود. گفت‌وگو هم با تیکه‌های آماده‌ی امن است.' },
  { question: 'والدین می‌توانند فضای بچه‌ها را ببینند؟', answer: 'بله. حساب والد می‌تواند «پیش‌نمایش» فضای کودک و نوجوان را بدون ثبت پیشرفت و سکه باز کند و فرزندانش را از یک حساب مدیریت کند.' },
];

/** The comparison table: one row per thing a parent or a player asks about (`age-tracks.md` §What each band gets). */
const CMP_ROWS: [string, string, string, string][] = [
  ['پازل', 'ساده و تصویری، با درس کلمه', 'پازل‌های آسان‌تر در شروع', 'همه‌ی پازل‌ها'],
  ['حدس قیمت', 'ندارد', 'بدون شرط سکه', 'با شرط سکه'],
  ['حریف‌یابی', 'فقط کودک‌ها', 'فقط نوجوان‌ها', 'فقط بزرگسال‌ها'],
  ['گفت‌وگو', 'تیکه‌های آماده‌ی امن', 'تیکه‌های آماده؛ متن آزاد پس از اتصال به والد', 'متن آزاد با کد دعوت'],
  ['دوست و میز', 'با تأیید والد', 'با تأیید والد', 'آزاد بین بزرگسال‌ها'],
  ['تورنومنت و جدول', 'جدول خودشان', 'جدول خودشان', 'جدول و تورنومنت بزرگسال'],
  ['پیشنهاد کالا و قیمت', 'ندارد', 'ندارد', 'دارد'],
];

export function agesPage(site: Site): string {
  const n = escapeHtml(site.name);
  const title = `رده‌های سنی ${site.name}: کودک، نوجوان و بزرگسال`;
  const desc = description(`${site.name} برای هر سن یک فضا دارد؛ بزرگسال‌ها بازی کامل با دوئل زنده و حدس قیمت با شرط سکه را دارند و بچه‌ها فضایی ساده و امن.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'رده‌های سنی' }];
  const nodes: Record<string, unknown>[] = [{ '@type': 'WebPage', '@id': `${site.url}/ages#webpage`, url: absolute(site, '/ages'), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site }, primaryImageOfPage: { '@type': 'ImageObject', url: absolute(site, '/banners/age-adult.webp'), width: 1600, height: 900 } }];
  const faqN = faqNode(AGE_FAQ);
  if (faqN) nodes.push(faqN);
  const steps: [string, string][] = [['برنامه را باز کن', 'بازی رایگان است و با نسخه‌ی وب، اندروید یا ربات بله شروع می‌شود.'], ['«بزرگسال» را انتخاب کن', 'در صفحه‌ی «چه کسی بازی می‌کنه؟» کارت بزرگسال اولین کارت است؛ همان بازی کامل شروع می‌شود.'], ['بازی کن و رقابت کن', 'پازل روزانه را حل کن، با رفقا دوئل بزن و روی حدس قیمتت سکه شرط ببند.']];
  const head1 = head(site, { title, description: desc, path: '/ages', nodes, crumbs });
  const body = `
<section class="band ad" id="adult"><div class="in adg" style="padding-top:64px;padding-bottom:64px">
<div class="col rv l" style="gap:18px"><div class="adrow"><span class="adbadge">18+</span><span class="adk">صرافی بزرگ‌ترها</span></div>
<h1>رده‌های سنی ${n}؛ <em>بزرگسال‌ها بازی کامل را دارند</em></h1>
<p style="font-size:19px">${n} یک بازی قیمت و خاطره‌ی قدیمی است و برای هر سن یک فضا دارد. در رده‌ی بزرگسال همه‌چیز باز است: پازل کامل، دوئل زنده، حدس قیمت با شرط سکه و رقابت با هم‌سن‌وسال‌ها. بچه‌ها فضای ساده و امن خودشان را دارند.</p>
<a class="brass" href="/download">همین حالا بازی کن</a></div>
<div class="adart rv z">${banner('age-adult', bannerAlt('age-adult'), { eager: true })}</div></div></section>
<section class="band ad" style="border-top:0"><div class="in col" style="gap:30px;padding-top:24px;padding-bottom:72px;position:relative"><h2 class="rv">در رده‌ی بزرگسال چه خبر است؟</h2>${metalCards()}
<p class="rv" style="font-size:17px">حریف‌یابی، دوست و تورنومنت بزرگسال‌ها از رده‌های کودک و نوجوان جداست و هیچ محتوای کودک در حساب بزرگسال دیده نمی‌شود. اگر فرزندی داری می‌توانی با او پشت یک میز خانوادگی بنشینی.</p></div></section>
<section class="in sec col" style="gap:28px"><h2 class="big rv">از کجا شروع کنم؟</h2>
<ol class="steps">${steps.map(([t, d], k) => `<li class="rv" style="--d:${k * 0.12}s"><span class="num">${faNum(k + 1)}</span><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></li>`).join('')}</ol>
<p style="text-align:center;margin:0"><a href="/download">دانلود و نصب رایگان</a></p></section>
<section class="band yb"><div class="in col" style="gap:30px;padding-top:72px;padding-bottom:72px" id="kids"><h2 class="big rv">و برای بچه‌ها و نوجوان‌ها</h2><p class="rv" style="margin:0;font-weight:600;font-size:18px;text-align:center">فضای کودک و نوجوان همان برند و همان بازی است، با قانون‌های محتاط‌تر؛ رده‌ی ${n} کوچولو فقط داخل برنامه برای کودک‌ها نام دارد.</p>${kidTeenCards(site.name)}</div></section>
<section class="in sec col" style="gap:24px"><h2 class="big rv">مقایسه‌ی سه رده</h2>
<div class="cmpbox rv"><table class="cmp"><thead><tr><th scope="col"></th><th scope="col">کودک · تا ۱۱ سال</th><th scope="col">نوجوان · ۱۲ تا ۱۷</th><th scope="col" class="ad">بزرگسال · ۱۸+</th></tr></thead><tbody>${CMP_ROWS.map(([a, k, t, d]) => `<tr><th scope="row">${escapeHtml(a)}</th><td>${escapeHtml(k)}</td><td>${escapeHtml(t)}</td><td class="ad">${escapeHtml(d)}</td></tr>`).join('')}</tbody></table></div></section>
<section class="band s"><div class="in col" style="gap:20px;padding-top:64px;padding-bottom:64px" id="parents"><h2 class="big rv">راهنمای والدین</h2>
<ul class="rv" style="margin:0;font-weight:700;font-size:18px"><li>رده را خودت انتخاب می‌کنی؛ یک شماره‌ی تلفن می‌تواند چند فرزند را در یک حساب نگه دارد.</li><li>بچه‌ها بلافاصله و تکی بازی می‌کنند؛ دوست، میز و گفت‌وگو با تأیید والد باز می‌شود.</li><li>رفتن به رده‌ی بالاتر برای کودک و نوجوان فقط با تأیید والد ممکن است.</li><li>شرط‌بندی با سکه و خرید واقعی در فضای کودک و نوجوان وجود ندارد.</li><li>«پیش‌نمایش» فضای کودک و نوجوان را بدون ثبت پیشرفت و سکه ببین.</li></ul></div></section>
<section class="in col" style="gap:24px;padding-top:72px;padding-bottom:72px"><h2 class="big rv">پرسش‌های رده‌ی سنی</h2>${faqList(AGE_FAQ)}</section>
<section class="in col" style="gap:24px;padding-bottom:80px;align-items:center"><h2 class="big rv">دوزاری‌ات را بینداز</h2><a class="btn big yellow pulse" href="/download">دانلود ${n}</a></section>`;
  return layout(site, head1, crumbs, body, { active: 'ages', wide: true });
}

/** The privacy policy (needed for the store listings). Facts only: what the app really stores, from `users` and the chat/ledger tables. */
export function privacyPage(site: Site): string {
  const title = `سیاست حریم خصوصی ${site.name}`;
  const desc = description(`${site.name} چه اطلاعاتی از بازیکن‌ها نگه می‌دارد، برای چه کاری و چطور می‌شود آن را پاک کرد.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'حریم خصوصی' }];
  const n = escapeHtml(site.name);
  const contact = site.contactEmail ? `از راه ایمیل <a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a> با ما در تماس باش.` : 'از راه بخش پیام‌های برنامه یا کانال رسمی بازی با ما در تماس باش.';
  const nodes: Record<string, unknown>[] = [{ '@type': 'WebPage', '@id': `${site.url}/privacy#webpage`, url: absolute(site, '/privacy'), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } }];
  const body = `<h1>${escapeHtml(title)}</h1>
<p>${n} یک بازی آنلاین فارسی است. این صفحه ساده می‌گوید چه چیزی نگه می‌داریم و چرا. ما اطلاعات تو را نمی‌فروشیم و در برنامه آگهی یا ردیاب شخص ثالث نمی‌گذاریم.</p>
<h2>چه اطلاعاتی نگه می‌داریم؟</h2>
<ul>
<li><strong>برای بازی کردن لازم است:</strong> یک شناسه‌ی تصادفی دستگاه (برای ساختن حساب مهمان)، نام مستعار و آواتار، پیشرفت، امتیازها، سکه‌ها و تاریخچه‌ی بازی‌ها.</li>
<li><strong>اگر خودت بدهی (اختیاری):</strong> جنسیت، تاریخ تولد، شهر، شماره‌ی تلفن (با کد پیامکی تأیید می‌شود)، ایمیل و اتصال حساب به بله.</li>
<li><strong>گفت‌وگو و گزارش‌ها:</strong> پیام‌هایی که در گفت‌وگوها می‌فرستی و گزارش‌هایی که می‌دهی یا درباره‌ات داده می‌شود، تا بتوانیم رفتار نادرست را بررسی کنیم.</li>
<li><strong>پیشنهادها:</strong> کالا یا قیمتی که برای بازی پیشنهاد می‌کنی و رأی‌هایی که می‌دهی.</li>
</ul>
<h2>برای چه کاری از آن‌ها استفاده می‌کنیم؟</h2>
<p>برای اجرای بازی (حریف‌یابی، جدول رتبه‌ها، دوستان)، پرداخت جایزه‌ها و سکه‌ها، جلوگیری از تقلب و آزار و بهتر کردن بازی. شماره‌ی تلفن فقط برای ورود، پیدا کردن دوست‌ها و ارسال کد تأیید به کار می‌رود.</p>
<h2>به چه کسی داده می‌شود؟</h2>
<p>نام مستعار، آواتار و سطح تو برای بازیکن‌های دیگر دیده می‌شود. اطلاعات خصوصی مثل تلفن و ایمیل برای بازیکن‌های دیگر نمایش داده نمی‌شود. پیامک تأیید ممکن است از راه یک سرویس پیامکی ایرانی فرستاده شود و پیام‌های بله از راه ربات بله. اطلاعاتی برای تبلیغ به کسی نمی‌دهیم.</p>
<h2>چقدر نگه می‌داریم و چطور پاک می‌شود؟</h2>
<p>تا وقتی حساب داری. هر وقت خواستی از «تنظیمات» برنامه، گزینه‌ی حذف حساب را بزن؛ بعد از تأیید با کد، اطلاعات شخصی (نام، تلفن، ایمیل، شناسه) پاک می‌شود و حساب بسته می‌شود. بخشی از سابقه‌ی بی‌نام بازی‌ها و تراکنش‌های سکه برای صحت جدول‌ها می‌ماند.</p>
<h2>امنیت</h2>
<p>ارتباط برنامه با سرور رمزگذاری‌شده (https) است. با این حال هیچ سیستمی صددرصد امن نیست؛ اگر مشکلی دیدی به ما خبر بده.</p>
<h2>تماس</h2>
<p>${contact}</p>
<p class="meta">این متن ممکن است با تغییر بازی به‌روز شود؛ تاریخ آخرین بازبینی نسخه‌ی سایت، همین صفحه است.</p>`;
  return layout(site, head(site, { title, description: desc, path: '/privacy', nodes, crumbs }), crumbs, body);
}

/** The terms of use (store listings ask for it next to the privacy policy). Plain rules that match how the game really works. */
export function termsPage(site: Site): string {
  const title = `قوانین و شرایط استفاده از ${site.name}`;
  const desc = description(`قاعده‌های بازی ${site.name}: رفتار در بازی و گفت‌وگو، سکه‌ها و جایزه‌ها، حساب کاربری و پیشنهاد کالا.`);
  const crumbs: Crumb[] = [{ name: 'صفحه‌ی اول', path: '/' }, { name: 'قوانین' }];
  const n = escapeHtml(site.name);
  const contact = site.contactEmail ? `از راه ایمیل <a href="mailto:${escapeHtml(site.contactEmail)}">${escapeHtml(site.contactEmail)}</a> با ما در تماس باش.` : 'از راه بخش پیام‌های برنامه یا کانال رسمی بازی با ما در تماس باش.';
  const nodes: Record<string, unknown>[] = [{ '@type': 'WebPage', '@id': `${site.url}/terms#webpage`, url: absolute(site, '/terms'), name: title, description: desc, inLanguage: 'fa-IR', isPartOf: { '@id': ids(site).site } }];
  const body = `<h1>${escapeHtml(title)}</h1>
<p>با نصب و استفاده از ${n} این قاعده‌ها را می‌پذیری. کوتاه و ساده نوشته‌ایم تا همه بخوانند. حریم خصوصی را در <a href="/privacy">صفحه‌ی جدا</a> توضیح داده‌ایم.</p>
<h2>بازی و حساب کاربری</h2>
<ul>
<li>بازی برای سرگرمی است و با قیمت‌های تاریخی و اسمی کار می‌کند؛ این قیمت‌ها توصیه‌ی مالی یا آمار رسمی نیستند.</li>
<li>هر نفر یک حساب داشته باشد. حساب و کد دعوتت را به نام خودت نگه دار و با دیگران عوض نکن.</li>
<li>اگر زیر ۱۸ سال داری، با اطلاع خانواده از بازی استفاده کن.</li>
</ul>
<h2>رفتار در بازی و گفت‌وگو</h2>
<ul>
<li>به بازیکن‌های دیگر احترام بگذار. توهین، تهدید، آزار، محتوای نامناسب، تبلیغ و درخواست اطلاعات شخصی ممنوع است.</li>
<li>نام مستعار و آواتار نباید توهین‌آمیز یا تقلید از دیگران باشد.</li>
<li>تقلب، استفاده از ربات یا ابزار خودکار، سوءاستفاده از اشکال بازی و ساختن چند حساب برای گرفتن جایزه ممنوع است.</li>
<li>گفت‌وگوی آزاد فقط برای کسانی باز است که کد دعوت را وارد کرده‌اند؛ بقیه پیام‌های آماده می‌فرستند. می‌توانی هر بازیکنی را گزارش یا مسدود کنی.</li>
</ul>
<h2>سکه‌ها، جایزه‌ها و خرید</h2>
<ul>
<li>سکه‌ها و جایزه‌ها فقط داخل بازی ارزش دارند. به پول نقد تبدیل نمی‌شوند و قابل انتقال یا فروش بیرون از بازی نیستند.</li>
<li>سکه و پیشرفتِ ثبت‌شده در سرور ملاک است؛ اگر اشکالی باعث دریافت اشتباه شود، حق اصلاح آن را داریم.</li>
<li>خریدهای درون‌برنامه (در صورت وجود) از راه مارکت یا درگاه انجام می‌شود و قوانین همان سرویس هم برای آن‌ها صدق می‌کند.</li>
</ul>
<h2>کالا و قیمتی که پیشنهاد می‌دهی</h2>
<p>با فرستادن پیشنهاد، اجازه می‌دهی ما آن را بررسی، ویرایش و در بازی استفاده کنیم. فقط اطلاعاتی بفرست که حق انتشارش را داری. ممکن است پیشنهادی را رد کنیم.</p>
<h2>محدودیت و حذف حساب</h2>
<p>برای محافظت از بازی و بازیکن‌ها می‌توانیم گفت‌وگو را ببندیم، جایزه را برگردانیم یا حساب را موقت یا همیشگی مسدود کنیم. هر وقت خواستی می‌توانی حسابت را از «تنظیمات» برنامه حذف کنی.</p>
<h2>مسئولیت</h2>
<p>سعی می‌کنیم بازی همیشه بالا باشد، اما ممکن است قطعی، به‌روزرسانی یا اشکال پیش بیاید و تضمین بی‌وقفه بودن نمی‌دهیم. نام‌ها و تصویر کالاها فقط برای شناسایی نوستالژیک آورده شده و مالکیت برندها با صاحبانشان است. شخصیت‌ها، نوشته‌ها و طراحی ${n} مال ما هستند.</p>
<h2>تغییر قوانین</h2>
<p>ممکن است با رشد بازی این متن تغییر کند. ادامه‌ی استفاده یعنی پذیرفتن نسخه‌ی تازه.</p>
<h2>تماس</h2>
<p>${contact}</p>`;
  return layout(site, head(site, { title, description: desc, path: '/terms', nodes, crumbs }), crumbs, body);
}

export function notFoundPage(site: Site): string {
  const body = `<h1>این صفحه پیدا نشد</h1><p>نشانی را اشتباه نوشته‌ای یا صفحه جابه‌جا شده. از این‌جا ادامه بده:</p><p><a href="/">صفحه‌ی اول ${escapeHtml(site.name)}</a> · <a href="/blog">مقاله‌های بلاگ</a> · <a href="/cast">بازیگران</a></p>`;
  return layout(site, head(site, { title: `صفحه پیدا نشد | ${site.name}`, description: 'این صفحه وجود ندارد.', path: '/404', noindex: true }), null, body);
}

export function unavailablePage(site: Site): string {
  const body = `<h1>${escapeHtml(site.name)} برمی‌گردد</h1><p>نگران نباش؛ سایت برای چند دقیقه در دسترس نیست و به‌زودی برمی‌گردیم.</p>`;
  return layout(site, head(site, { title: `به‌زودی برمی‌گردیم | ${site.name}`, description: 'سایت موقتاً در دسترس نیست.', path: '/', noindex: true }), null, body);
}

export type { FaqPair };
