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
      '#tsAuthGate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
      '#tsAuthGate .ta-box{width:min(92vw,360px);border:1px solid #26303c;background:#101318;padding:26px 24px;}' +
      '#tsAuthGate .ta-eyebrow{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;' +
      'text-transform:uppercase;color:#3a7bd5;margin:0 0 6px;}' +
      '#tsAuthGate h1{color:#e8edf2;font-size:20px;margin:0 0 16px;}' +
      '#tsAuthGate input{display:block;width:100%;box-sizing:border-box;background:#0a0a0c;border:1px solid #2c3540;' +
      'color:#e8edf2;padding:11px 12px;font-size:15px;margin-bottom:10px;}' +
      '#tsAuthGate input:focus{outline:none;border-color:#3a7bd5;}' +
      '#tsAuthGate button{width:100%;background:#3a7bd5;color:#0a0a0c;border:none;padding:11px 0;font-weight:600;' +
      'font-size:14px;cursor:pointer;}' +
      '#tsAuthGate button:disabled{opacity:.6;}' +
      '#tsAuthGate .ta-err{color:#c9604f;font-size:13px;min-height:18px;margin-top:10px;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    overlay = document.createElement('div');
    overlay.id = 'tsAuthGate';
    overlay.innerHTML =
      '<div class="ta-box">' +
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
