// Mini-app glue (Bale, Telegram). Runs before the game bundle: tells the host the page is ready, trades the signed `initData` for a
// Dozari session (POST /auth/miniapp) and stores it where the game looks for it, then starts the game. Plain ES5, no dependencies.
(function () {
  var cfg = window.__MINIAPP__ || {};
  // The host is the messenger the page was opened in: Bale's SDK is in the page head; Telegram's is loaded only when Telegram passes
  // its launch data (its script host may be blocked for Bale users, so it never delays a Bale launch).
  var platform = 'bale';
  var webApp = window.Bale && window.Bale.WebApp && window.Bale.WebApp.initData ? window.Bale.WebApp : null;
  var launchedByTelegram = !webApp && /[#&?]tgWebAppData=/.test(location.hash + location.search);
  function adoptTelegram() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      platform = 'telegram';
      webApp = window.Telegram.WebApp;
      initData = webApp.initData;
    }
  }
  var initData = (webApp && webApp.initData) || '';
  if (!webApp && window.Bale && window.Bale.WebApp) webApp = window.Bale.WebApp; // outside a launch: methods exist, data is empty

  // Bale's web client may open the page in a sandboxed iframe: no usable localStorage (it throws). Fall back to an in-memory
  // one so the game keeps its token for this visit; the next open logs in through the messenger again.
  try {
    window.localStorage.getItem('dozari.probe');
  } catch (e) {
    var mem = {};
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: function (k) {
          return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
        },
        setItem: function (k, v) {
          mem[k] = String(v);
        },
        removeItem: function (k) {
          delete mem[k];
        },
        clear: function () {
          mem = {};
        },
      },
    });
  }

  function store(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* private mode: the game falls back to a guest session */
    }
  }

  // A messenger's web view has no console: collect script errors and, if the game has drawn nothing after a while, show them on screen.
  var errors = [];
  window.addEventListener('error', function (e) {
    errors.push(String(e.message || e) + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    errors.push('promise: ' + String((e.reason && e.reason.message) || e.reason));
  });
  function watchStart() {
    setTimeout(function () {
      var root = document.getElementById('root');
      if (root && root.childNodes.length) return;
      var box = document.createElement('pre');
      box.setAttribute('dir', 'ltr');
      box.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;max-height:60%;overflow:auto;margin:0;padding:12px;background:#000c;color:#fff;font:11px monospace;white-space:pre-wrap;z-index:99999';
      box.textContent =
        'dozari: game did not start\nsdk=' + !!webApp + ' initData=' + initData.length + ' platform=' + ((webApp && webApp.platform) || '-') +
        '\nua=' + navigator.userAgent + '\n' + errors.join('\n');
      document.body.appendChild(box);
    }, 8000);
  }

  function startGame() {
    watchStart();
    var holders = document.querySelectorAll('script[data-src]');
    for (var i = 0; i < holders.length; i++) {
      var s = document.createElement('script');
      s.src = holders[i].getAttribute('data-src');
      s.defer = true;
      document.body.appendChild(s);
    }
  }

  function showError(err) {
    var box = document.createElement('div');
    box.setAttribute('dir', 'rtl');
    box.style.cssText =
      'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
      'background:#2b1240;color:#fff;font:16px sans-serif;text-align:center;padding:24px';
    box.innerHTML = '<div>اتصال به دوزاری برقرار نشد.</div><div dir="ltr" style="font-size:12px;opacity:.7">' + String((err && err.message) || err) + '<br>page ' + location.origin + '<br>api ' + cfg.apiUrl + '</div><button style="padding:10px 24px;border:0;border-radius:12px;font-size:16px">تلاش دوباره</button>';
    box.lastChild.onclick = function () {
      box.remove();
      login();
    };
    document.body.appendChild(box);
  }

  function login() {
    fetch(cfg.apiUrl + '/auth/miniapp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform: platform, initData: initData }),
    })
      .then(function (res) {
        if (res.ok) return res.json();
        return res.text().then(function (t) {
          throw new Error('login ' + res.status + ' ' + t.slice(0, 120));
        });
      })
      .then(function (session) {
        store('dozari.token', session.token);
        store('dozari.deviceId', session.deviceId);
        startGame();
      })
      .catch(showError);
  }

  // Link ?startapp=daily|solo|duel (https://ble.ir/<bot>?startapp=daily) opens that screen: the game reads its own `?go=` once.
  function applyStartParam() {
    var raw = (webApp && webApp.initDataUnsafe && webApp.initDataUnsafe.start_param) || '';
    if (!raw) {
      var m = /[?&#]tgWebAppStartParam=([^&#]*)/.exec(location.search + location.hash);
      raw = m ? decodeURIComponent(m[1]) : '';
    }
    if (/^(solo|daily|duel)$/.test(raw) && location.search.indexOf('go=') === -1) {
      try {
        history.replaceState(null, '', location.pathname + '?go=' + raw + location.hash);
      } catch (e) {
        /* the game then opens on its home screen */
      }
    }
  }

  // Old messenger apps cannot run mini-apps at all: say so instead of a blank page.
  function showUpdateNotice() {
    var box = document.createElement('div');
    box.setAttribute('dir', 'rtl');
    box.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#2b1240;color:#fff;font:16px sans-serif;text-align:center;padding:24px;z-index:99999';
    box.textContent = 'برای بازی دوزاری، بله را به آخرین نسخه به‌روزرسانی کن.';
    document.body.appendChild(box);
  }

  // External links (sponsors, downloads...) open in the messenger's own browser instead of replacing the game.
  function routeLinksThroughHost() {
    var open = window.open;
    window.open = function (url) {
      if (typeof url === 'string' && /^https?:\/\//.test(url) && url.indexOf(location.origin) !== 0 && webApp && webApp.openLink) {
        webApp.openLink(url);
        return null;
      }
      return open.apply(window, arguments);
    };
  }

  function init() {
    if (webApp) {
      try {
        webApp.ready();
        webApp.expand();
        if (webApp.setHeaderColor) webApp.setHeaderColor('#2B1240'); // the game's own purple, in light and dark themes alike
        routeLinksThroughHost();
      } catch (e) {
        /* older clients lack some calls */
      }
      applyStartParam();
      if (webApp.isMiniAppSupported === false) window.addEventListener('DOMContentLoaded', showUpdateNotice);
    }
    // Opened outside a messenger (a plain browser): no signed data to send, so the game starts as an ordinary guest.
    if (webApp && webApp.isMiniAppSupported === false) return;
    if (initData) window.addEventListener('DOMContentLoaded', login);
    else window.addEventListener('DOMContentLoaded', startGame);
  }

  // Telegram's SDK is fetched only when Telegram launched the page; if it cannot be reached in 4 s the game starts as a guest.
  function loadTelegramSdk(done) {
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      adoptTelegram();
      done();
    };
    var s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js';
    s.onload = finish;
    s.onerror = finish;
    document.head.appendChild(s);
    setTimeout(finish, 4000);
  }

  if (launchedByTelegram) loadTelegramSdk(init);
  else init();
})();
