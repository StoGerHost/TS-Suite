/* ============================================================
   TS-Suite · Zugangsschutz mit Supabase Auth (ts-auth.js)
   ------------------------------------------------------------
   Echte Anmeldung mit E-Mail + Passwort (Konten werden im
   Supabase-Dashboard unter Authentication > Users angelegt).
   Die Sitzung bleibt pro Gerät dauerhaft angemeldet
   (Refresh-Token, verwaltet von supabase-js).

   Einbindung mit automatischem Gate (Overlay bis zum Login):
     <script src="config.js"><\/script>
     <script src="ts-auth.js" data-gate data-title="CRM"><\/script>

   Einbindung nur als API (z. B. Startseiten-Suche):
     <script src="ts-auth.js"><\/script>

   API:
     TSAuth.isUnlocked()  -> true, wenn angemeldet
     TSAuth.getToken()    -> Access-Token (JWT) oder null
     TSAuth.showGate(t)   -> Login-Overlay manuell öffnen
     TSAuth.logout()      -> Abmelden (Seite lädt neu)
     TSAuth.ready         -> Promise, aufgelöst nach Session-Prüfung
   Events (auf document):
     'tsauth:login'       -> nach erfolgreichem frischem Login

   Kompatibilität zur alten Version:
     TSAuth.verify()/markUnlocked() existieren noch, tun aber
     nichts mehr — der alte Zugangscode ist abgelöst.

   Design: Das Overlay nutzt dieselben CSS-Variablen wie der Rest
   der Suite (--bg, --surface, --accent, --line-30, --font-mono …).
   Läuft die Seite ausnahmsweise ohne das Blueprint-:root-Set,
   greifen die var()-Fallbacks — dann sieht es exakt so aus wie
   bisher, bricht also nirgends.
   ============================================================ */
(function () {
  'use strict';

  if (typeof TENANT === 'undefined') {
    console.error('ts-auth.js: config.js muss VOR ts-auth.js eingebunden sein.');
    return;
  }

  var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  var scriptTag = document.currentScript;
  var wantGate = scriptTag && scriptTag.hasAttribute('data-gate');
  var gateTitle = (scriptTag && scriptTag.getAttribute('data-title')) || 'TS-Suite';

  var client = null;
  var readyResolve;
  var ready = new Promise(function (res) { readyResolve = res; });

  /* ---------- Token synchron aus localStorage lesen ----------
     supabase-js legt die Session unter sb-<ref>-auth-token ab.
     So ist der Token sofort verfügbar, noch bevor das CDN-
     Skript geladen ist — wichtig für früh startende fetches. */
  function storageKey() {
    try {
      var ref = new URL(TENANT.supabaseUrl).hostname.split('.')[0];
      return 'sb-' + ref + '-auth-token';
    } catch (e) { return null; }
  }
  function getToken() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.access_token) || null;
    } catch (e) { return null; }
  }
  function isUnlocked() { return !!getToken(); }

  /* ---------- supabase-js laden und Client bauen ---------- */
  function loadLib() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement('script');
      s.src = CDN;
      s.onload = res;
      s.onerror = function () { rej(new Error('supabase-js konnte nicht geladen werden')); };
      document.head.appendChild(s);
    });
  }

  function initClient() {
    return loadLib().then(function () {
      client = window.supabase.createClient(TENANT.supabaseUrl, TENANT.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: storageKey() }
      });
      return client.auth.getSession();
    }).then(function (res) {
      var session = res && res.data ? res.data.session : null;
      if (!session && getToken()) {
        /* Gespeicherte Sitzung ist abgelaufen und nicht mehr erneuerbar:
           Karteileiche entfernen und (im Gate-Modus) neu anmelden lassen. */
        try { localStorage.removeItem(storageKey()); } catch (e) {}
        if (wantGate) showGate();
      }
      readyResolve();
    }).catch(function (err) {
      console.error('ts-auth.js:', err);
      readyResolve();
    });
  }

  /* ---------- Login-Overlay ---------- */
  var overlay = null;

  function buildOverlay() {
    if (overlay) return overlay;
    var css =
      /* Vollflächiges Gate, dunkler Blueprint-Grund inkl. Rastermuster
         wie auf den übrigen Seiten (index.html, admin.html, crm.html). */
      '#tsAuthGate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'padding:20px;background:var(--bg,#0a0a0c);' +
      'background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),' +
      'linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:34px 34px;' +
      'font-family:var(--font-display,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);}' +

      '#tsAuthGate .ta-box{width:min(92vw,360px);border:1px solid var(--line-30,rgba(58,123,213,.3));' +
      'border-radius:2px;background:var(--surface,#111318);padding:28px 24px;' +
      'box-shadow:0 8px 40px rgba(0,0,0,.6);}' +

      '#tsAuthGate .ta-icon{width:38px;height:38px;border:1.5px solid var(--accent,#3a7bd5);' +
      'display:flex;align-items:center;justify-content:center;font-size:17px;margin-bottom:14px;}' +

      '#tsAuthGate .ta-eyebrow{font-family:var(--font-mono,ui-monospace,Menlo,monospace);font-size:11px;' +
      'letter-spacing:.08em;text-transform:uppercase;color:var(--accent,#3a7bd5);margin:0 0 6px;}' +

      '#tsAuthGate h1{color:var(--ink,#e9edf2);font-size:19px;font-weight:800;margin:0 0 18px;' +
      'font-family:var(--font-display,inherit);}' +

      '#tsAuthGate input{display:block;width:100%;box-sizing:border-box;background:var(--bg,#0a0a0c);' +
      'border:1px solid var(--line-30,rgba(58,123,213,.3));border-radius:2px;color:var(--ink,#e9edf2);' +
      'padding:11px 12px;font-size:16px;min-height:44px;margin-bottom:10px;font-family:inherit;outline:none;' +
      'transition:border-color .15s;}' +
      '#tsAuthGate input::placeholder{color:var(--ink-40,rgba(233,237,242,.4));}' +
      '#tsAuthGate input:focus{border-color:var(--glow,#5eead4);box-shadow:0 0 0 3px rgba(94,234,212,.18);}' +

      '#tsAuthGate button{width:100%;background:var(--accent,#3a7bd5);color:var(--bg,#0a0a0c);border:none;' +
      'border-radius:2px;padding:12px 0;font-weight:700;font-size:14px;font-family:var(--font-mono,inherit);' +
      'letter-spacing:.02em;min-height:44px;cursor:pointer;transition:filter .15s;}' +
      '#tsAuthGate button:hover{filter:brightness(1.1);}' +
      '#tsAuthGate button:disabled{opacity:.6;cursor:default;}' +

      '#tsAuthGate .ta-err{color:var(--danger,#e05a4e);font-size:12.5px;font-weight:600;' +
      'font-family:var(--font-mono,inherit);min-height:18px;margin-top:10px;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    overlay = document.createElement('div');
    overlay.id = 'tsAuthGate';
    overlay.innerHTML =
      '<div class="ta-box">' +
      '  <div class="ta-icon" aria-hidden="true">&#128274;</div>' +
      '  <p class="ta-eyebrow">Blueprint · TS-Suite</p>' +
      '  <h1>' + gateTitle.replace(/[<>&]/g, '') + '</h1>' +
      '  <input type="email" id="taEmail" placeholder="E-Mail" autocomplete="username" inputmode="email">' +
      '  <input type="password" id="taPw" placeholder="Passwort" autocomplete="current-password">' +
      '  <button id="taBtn">Anmelden</button>' +
      '  <div class="ta-err" id="taErr"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var btn = overlay.querySelector('#taBtn');
    var mail = overlay.querySelector('#taEmail');
    var pw = overlay.querySelector('#taPw');
    var errEl = overlay.querySelector('#taErr');

    function doLogin() {
      var e = mail.value.trim(), p = pw.value;
      if (!e || !p) { errEl.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
      btn.disabled = true;
      errEl.textContent = '';
      ready.then(function () {
        if (!client) throw new Error('Keine Verbindung zum Anmeldedienst.');
        return client.auth.signInWithPassword({ email: e, password: p });
      }).then(function (r) {
        if (r && r.error) throw r.error;
        try { document.dispatchEvent(new CustomEvent('tsauth:login')); } catch (ev) {}
        /* Frischer Login: Seite neu laden, damit alle Daten-
           Abfragen von Anfang an mit dem Token laufen. */
        location.reload();
      }).catch(function (err) {
        btn.disabled = false;
        var msg = (err && err.message) || 'Anmeldung fehlgeschlagen.';
        if (/invalid login credentials/i.test(msg)) msg = 'E-Mail oder Passwort falsch.';
        errEl.textContent = msg;
      });
    }
    btn.addEventListener('click', doLogin);
    pw.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doLogin(); });
    mail.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') pw.focus(); });
    return overlay;
  }

  function showGate(title) {
    if (title) gateTitle = title;
    var run = function () { buildOverlay().style.display = 'flex'; };
    if (document.body) run(); else document.addEventListener('DOMContentLoaded', run);
  }
  function hideGate() { if (overlay) overlay.style.display = 'none'; }

  function logout() {
    var done = function () {
      try { localStorage.removeItem(storageKey()); } catch (e) {}
      location.reload();
    };
    ready.then(function () {
      if (client) return client.auth.signOut();
    }).then(done).catch(done);
  }

  /* ---------- Öffentliche API ---------- */
  window.TSAuth = {
    ready: ready,
    isUnlocked: isUnlocked,
    getToken: getToken,
    showGate: showGate,
    hideGate: hideGate,
    logout: logout,
    /* Kompatibilität zur alten Version: */
    verify: function () { console.warn('TSAuth.verify(): abgelöst durch Supabase Auth.'); return false; },
    markUnlocked: function () {}
  };

  /* ---------- Altlasten früherer Schutzmechanismen entfernen ---------- */
  try {
    localStorage.removeItem('tsSuiteCustomPwHash');
    sessionStorage.removeItem('tsSuiteAuthOk');
    sessionStorage.removeItem('ts_uebersicht_auth');
  } catch (e) {}

  /* ---------- Start ---------- */
  initClient();
  if (wantGate && !isUnlocked()) showGate();
})();
