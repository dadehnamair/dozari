// Bale mini-app glue. Runs before the game bundle: tells Bale the page is ready, trades the signed `initData` for a Dozari
// session (POST /auth/bale-miniapp) and stores it where the game looks for it, then starts the game. Plain ES5, no dependencies.
(function () {
  var cfg = window.__BALE_MINIAPP__ || {};
  var webApp = window.Bale && window.Bale.WebApp;
  var initData = (webApp && webApp.initData) || '';

  function store(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* private mode: the game falls back to a guest session */
    }
  }

  function startGame() {
    var holders = document.querySelectorAll('script[data-src]');
    for (var i = 0; i < holders.length; i++) {
      var s = document.createElement('script');
      s.src = holders[i].getAttribute('data-src');
      s.defer = true;
      document.body.appendChild(s);
    }
  }

  function showError() {
    var box = document.createElement('div');
    box.setAttribute('dir', 'rtl');
    box.style.cssText =
      'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;' +
      'background:#2b1240;color:#fff;font:16px sans-serif;text-align:center;padding:24px';
    box.innerHTML = '<div>اتصال به دوزاری برقرار نشد.</div><button style="padding:10px 24px;border:0;border-radius:12px;font-size:16px">تلاش دوباره</button>';
    box.lastChild.onclick = function () {
      box.remove();
      login();
    };
    document.body.appendChild(box);
  }

  function login() {
    fetch(cfg.apiUrl + '/auth/bale-miniapp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData: initData }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('login ' + res.status);
        return res.json();
      })
      .then(function (session) {
        store('dozari.token', session.token);
        store('dozari.deviceId', session.deviceId);
        startGame();
      })
      .catch(showError);
  }

  if (webApp) {
    try {
      webApp.ready();
      webApp.expand();
    } catch (e) {
      /* older Bale clients lack some calls */
    }
  }
  // Opened outside Bale (a plain browser): no signed data to send, so the game starts as an ordinary guest.
  if (initData) window.addEventListener('DOMContentLoaded', login);
  else window.addEventListener('DOMContentLoaded', startGame);
})();
