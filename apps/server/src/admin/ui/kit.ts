/** UI kit of the admin SPA: line icons and the reusable page building blocks (page header, tabs, segmented control, data table, search box, to-do rows). */
export const ADMIN_KIT_JS = String.raw`
var ICON_D = {
  dashboard: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
  players: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c2.5.5 3.5 2.5 3.5 5.5',
  catalog: 'M4 6.5L12 3l8 3.5v11L12 21l-8-3.5zM4 6.5l8 3.5 8-3.5M12 10v11',
  game: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  economy: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M15 9.5H10.5a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3H9',
  comms: 'M4 5h16v11H9l-5 4z',
  system: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  chev: 'M6 9l6 6 6-6',
  arrow: 'M15 6l-6 6 6 6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5',
  chatreports: 'M5 4h14v16H5zM9 9h6M9 13h4',
  badges: 'M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z',
  bots: 'M12 3v3M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3zM9 13h.01M15 13h.01M9 17h6',
  invites: 'M3 8h18v10H3zM3 8l9 6 9-6',
  words: 'M12 3l9 16H3zM12 10v4M12 17v.5',
  prices: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M15 9.5H10.5a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3H9',
  inbox: 'M3 5h18v14H3zM3 13h5l1 3h6l1-3h5',
  sources: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  puzzles: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  dailypuzzle: 'M3 5h18v14H3zM3 10h18M8 3v4M16 3v4',
  levels: 'M3 20h5v-5h5v-5h5V5h3M3 20h18',
  cities: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6',
  taunts: 'M4 5h16v11H9l-5 4z',
  tournaments: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  daily: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12',
  shop: 'M4 8h16l-1.5 11h-13zM8 8a4 4 0 0 1 8 0',
  messages: 'M3 5h18v14H3zM3 6l9 7 9-7',
  bale: 'M21 4L3 11l6 2 2 6 3-4 5 3z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  admins: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  socket: 'M4 12h4l3-7 4 14 3-7h2',
  audit: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 3l9 16H3zM12 10v4M12 17v.5'
};
function ic(key, size) {
  var s = svgEl('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
  if (size) { s.setAttribute('width', size); s.setAttribute('height', size); }
  s.appendChild(svgEl('path', { d: ICON_D[key] || ICON_D.dashboard }));
  return s;
}

/* Page header with an optional right-hand action area. */
function pageHead(title, desc, actions) {
  return h('div', { class: 'phead' }, [h('div', { class: 'row' }, [h('div', {}, [h('h1', { text: title }), desc ? h('p', { text: desc }) : null]), actions ? h('div', { class: 'toolbar', style: 'margin:0' }, actions) : null])]);
}
/* Segmented control: seg([[value, label], …], current, onChange). */
function seg(options, current, onChange) {
  var el = h('div', { class: 'seg', role: 'group' });
  function draw() {
    clear(el);
    options.forEach(function (o) { el.appendChild(h('button', { type: 'button', 'aria-pressed': String(o[0] === current), text: o[1], onclick: function () { current = o[0]; draw(); onChange(o[0]); } })); });
  }
  draw();
  return el;
}
/* Search input with a magnifier, debounced: searchBox('…', function (text) {…}, initial). */
function searchBox(placeholder, onInput, initial) {
  var inp = h('input', { type: 'search', placeholder: placeholder, value: initial || '', 'aria-label': placeholder }), t;
  inp.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { onInput(inp.value); }, 200); });
  var box = h('div', { class: 'search' }, [ic('search'), inp]);
  box.input = inp;
  return box;
}
/* A small initials avatar for list rows. */
function initials(name) { var t = String(name || '?').trim(); return t ? Array.from(t)[0] : '?'; }
/* Data table: cols = [{ label, render(row) -> node|string, sort(row) -> key, cls }]; opts = { onRow, empty, pageSize }. Client-side sort + paging. */
function dtable(cols, rows, opts) {
  opts = opts || {};
  var wrap = h('div'), sortCol = -1, dir = 1, page = 0, size = opts.pageSize || 0;
  function draw() {
    clear(wrap);
    if (!rows.length) return wrap.appendChild(empty(opts.empty || 'موردی پیدا نشد'));
    var list = rows.slice();
    if (sortCol >= 0 && cols[sortCol].sort) { var sf = cols[sortCol].sort; list.sort(function (a, b) { var x = sf(a), y = sf(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; }); }
    var total = list.length;
    if (size) { if (page * size >= total) page = 0; list = list.slice(page * size, page * size + size); }
    wrap.appendChild(h('div', { class: 'tbl-wrap' }, [h('table', {}, [
      h('thead', {}, [h('tr', {}, cols.map(function (c, i) {
        return h('th', { class: c.sort ? 'sortable' : '', text: c.label + (i === sortCol ? (dir > 0 ? ' ▲' : ' ▼') : ''), onclick: c.sort ? function () { if (sortCol === i) dir = -dir; else { sortCol = i; dir = 1; } draw(); } : null });
      }))]),
      h('tbody', {}, list.map(function (r) {
        return h('tr', { class: opts.onRow ? 'click' : '', onclick: opts.onRow ? function (e) { if (!e.target.closest('button,a,input,select')) opts.onRow(r); } : null }, cols.map(function (c) {
          var v = c.render(r); return h('td', { class: c.cls || '' }, [v === null || v === undefined ? '' : v]);
        }));
      }))
    ])]));
    if (size && total > size) {
      var pages = Math.ceil(total / size);
      wrap.appendChild(h('div', { class: 't-foot' }, [h('span', { text: 'صفحه ' + fa(page + 1) + ' از ' + fa(pages) + ' · ' + fa(total) + ' مورد' }),
        h('span', { style: 'display:flex;gap:6px' }, [page > 0 ? h('button', { class: 'btn sm', text: 'قبلی', onclick: function () { page--; draw(); } }) : null, page < pages - 1 ? h('button', { class: 'btn sm', text: 'بعدی', onclick: function () { page++; draw(); } }) : null])]));
    }
  }
  draw();
  wrap.setRows = function (r) { rows = r; page = 0; draw(); };
  return wrap;
}
/* A row in a "needs attention" list. tone: warn | bad | ok | info. */
function todoRow(n, title, sub, tone, href) {
  var kids = [h('div', { class: 'dot ' + (tone === 'warn' ? '' : tone || '') }, [typeof n === 'string' ? n : fa(n)]), h('div', { class: 't' }, [h('b', { text: title }), sub ? h('span', { text: sub }) : null]), href ? h('span', { class: 'go', text: '←' }) : null];
  return href ? h('a', { class: 'todo', href: href }, kids) : h('div', { class: 'todo' }, kids);
}
function banner(kind, text, link) { return h('div', { class: 'banner ' + kind }, [h('span', { text: text }), link ? h('a', { href: link[0], text: link[1] }) : null]); }
function sectionTitle(t) { return h('div', { class: 'sect-t', text: t }); }
function defs(pairs) {
  var dl = h('dl', { class: 'deflist' });
  pairs.forEach(function (p) { if (!p) return; dl.appendChild(h('dt', { text: p[0] })); dl.appendChild(h('dd', {}, [p[1]])); });
  return dl;
}
`;
