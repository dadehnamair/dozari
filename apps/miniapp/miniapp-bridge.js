// Mini-app glue (Bale, Telegram). Runs before the game bundle: tells the host the page is ready (full-screen, colours, links), works out which
// messenger hosts the page so the game picks the matching SDK, then starts the game. There is no messenger login (D243): the game signs in
// with its own guest account and «ورود با شماره», exactly like the web app. Plain ES5, no dependencies.
(function () {
  window.__MINIAPP__ = window.__MINIAPP__ || {};
  // The host is the messenger the page was opened in. Bale's SDK is in the page head and also reads Telegram's launch data, so its `initData`
  // can be filled inside Telegram: only what Telegram itself supplies (`tgWebAppPlatform` in the launch parameters, or its native bridge) says
  // Telegram. Telegram's own SDK is then fetched (its script host may be blocked for Bale users, so Bale launches never wait for it).
  var platform = 'bale';
  var webApp = window.Bale && window.Bale.WebApp && window.Bale.WebApp.initData ? window.Bale.WebApp : null;
  var launchData = /[#&?]tgWebAppData=/.test(location.hash + location.search);
  function launchedByTelegram() {
    if (/[#&?]tgWebAppPlatform=/.test(location.hash + location.search) || window.TelegramWebviewProxy) return true;
    try {
      // Telegram's SDK keeps its launch parameters for the session: a reload has no hash any more.
      return /tgWebAppPlatform/.test(window.sessionStorage.getItem('__telegram__initParams') || '');
    } catch (e) {
      return false;
    }
  }
  var telegramSdk = null; // resolves with Telegram's WebApp (or null) once its script has loaded or failed
  var initData = (webApp && webApp.initData) || '';
  if (!webApp && window.Bale && window.Bale.WebApp) webApp = window.Bale.WebApp; // outside a launch: methods exist, data is empty
  if (!initData && launchData) {
    // Telegram launch and no Bale SDK data: the Telegram SDK is the only source of the signed string.
    var launched = /[#&?]tgWebAppData=([^&]*)/.exec(location.hash + location.search);
    try {
      initData = launched ? decodeURIComponent(launched[1]) : '';
    } catch (e) {
      initData = '';
    }
  }

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
      // Scripts added from JS are async by default (`defer` is ignored): a split bundle's common chunk could then run before the
      // chunk that defines Metro's `__d` ("Can't find variable: __d"). `async = false` runs them in the order they were added.
      s.async = false;
      document.body.appendChild(s);
    }
  }

  // Link ?startapp=daily|solo|duel (https://ble.ir/<bot>?startapp=daily) opens that screen: the game reads its own `?go=` once.
  function applyStartParam() {
    var raw = (webApp && webApp.initDataUnsafe && webApp.initDataUnsafe.start_param) || '';
    if (!raw) {
      var m = /[?&#]tgWebAppStartParam=([^&#]*)/.exec(location.search + location.hash);
      raw = m ? decodeURIComponent(m[1]) : '';
    }
    // «daily_g<ref>» = the screen plus the bot group the link came from; «table_<CODE>_g<ref>» opens a shared private table
    // (docs/logic/group-game.md §Funnel, §Table card). The ref is kept for the game's request headers.
    var parts = /^(solo|daily|duel)(?:_(g[a-z0-9]{4,12}))?$/.exec(raw);
    var table = parts ? null : /^table_([2-9A-HJKMNP-Z]{5})(?:_(g[a-z0-9]{4,12}))?$/.exec(raw);
    // «i_<ID>» = a friend's personal invite link from the bot's /invite (docs/logic/group-game.md §Personal invite link)
    var invite = parts || table ? null : /^i_([A-Za-z0-9]{4,12})$/.exec(raw);
    var ref = parts ? parts[2] : table ? table[2] : '';
    if (ref) {
      try {
        localStorage.setItem('dozari_src', ref);
      } catch (e) {
        /* no storage: the visit is simply not attributed */
      }
    }
    if (location.search.indexOf('go=') !== -1 || (!parts && !table && !invite)) return;
    try {
      history.replaceState(null, '', location.pathname + (invite ? '?go=invite&code=' + invite[1] : table ? '?go=table&code=' + table[1] : '?go=' + parts[1]) + location.hash);
    } catch (e) {
      /* the game then opens on its home screen */
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

  // Everything host-specific: tell the messenger the page is ready, full-screen, colours, links.
  function setupHost() {
    if (!webApp) return;
    try {
      webApp.ready();
      webApp.expand();
      if (webApp.setHeaderColor) webApp.setHeaderColor('#2B1240'); // the game's own purple, in light and dark themes alike
      routeLinksThroughHost();
    } catch (e) {
      /* older clients lack some calls */
    }
    applyStartParam();
  }

  // Telegram's SDK is fetched in the background when launch data is in the address; if it cannot be reached in 4 s it is given up.
  function loadTelegramSdk() {
    if (telegramSdk) return telegramSdk;
    telegramSdk = new Promise(function (resolve) {
      if (window.Telegram && window.Telegram.WebApp) return resolve(window.Telegram.WebApp);
      var s = document.createElement('script');
      s.src = 'https://telegram.org/js/telegram-web-app.js';
      s.onload = function () {
        resolve((window.Telegram && window.Telegram.WebApp) || null);
      };
      s.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(s);
      setTimeout(function () {
        resolve((window.Telegram && window.Telegram.WebApp) || null);
      }, 4000);
    });
    return telegramSdk;
  }

  // Telegram's own SDK replaces Bale's (which merely echoed the launch data), so the game's host calls reach the right messenger.
  function adoptTelegram(sdk) {
    if (sdk && sdk.initData) {
      webApp = sdk;
      initData = sdk.initData;
    }
    window.__MINIAPP__.platform = platform = 'telegram';
    setupHost();
  }

  // The Telegram SDK wait can outlast DOMContentLoaded: run at once then.
  function whenReady(fn) {
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function begin() {
    // Old Bale apps can run no mini-app at all (no launch data): say so instead of a blank page.
    if (webApp && webApp.isMiniAppSupported === false && !initData) {
      whenReady(showUpdateNotice);
      return;
    }
    // No messenger sign-in (D243): the game starts with its own guest account, like the web app.
    whenReady(startGame);
  }

  function init() {
    if (launchedByTelegram()) {
      // Telegram: wait (at most 4 s) for its SDK, which the game reads for the back button, header colour and links.
      loadTelegramSdk().then(function (sdk) {
        adoptTelegram(sdk);
        begin();
      });
      return;
    }
    window.__MINIAPP__.platform = platform = 'bale';
    setupHost();
    begin();
  }

  init();
})();
