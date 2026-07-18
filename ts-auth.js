/* ============================================================
   TS-Suite · Gemeinsamer Zugangsschutz (ts-auth.js)
   ------------------------------------------------------------
   Einbindung mit automatischem Gate (Overlay bis zur Freigabe):
     <script src="ts-auth.js" data-gate data-title="CRM"></script>

   Einbindung nur als Prüf-API (z.B. Berichtsübersicht mit
   eigenem Gate):
     <script src="ts-auth.js"></script>
     -> window.TSAuth.verify(pw), .markUnlocked(), .isUnlocked()

   Freigabe-Logik:
   - Master-Passwort (fest hinterlegt, als Hash) ODER
   - eigenes Passwort (vom Nutzer festgelegt, Hash in localStorage
     DIESES Geräts/Browsers)
   - Eine Freigabe gilt für die laufende Browser-Sitzung in allen
     geschützten Bereichen (sessionStorage).

   Eigenes Passwort festlegen/ändern: direkt im Gate über
   "Eigenes Passwort festlegen / ändern" — dazu muss das Master-
   oder das bisherige eigene Passwort eingegeben werden.

   HINWEIS ZUR SICHERHEIT: Das ist ein clientseitiger Komfort-
   schutz gegen versehentlichen Zugriff, kein echter Schutz der
   Daten — die liegen weiterhin hinter dem Supabase-Anon-Key.
   ============================================================ */
(function () {
  'use strict';

  // Master-Passwort als Doppel-Hash (djb2/sdbm-Variante).
  // Akzeptiert werden beide Schreibweisen: sto78O8 (großes O) und sto7808 (Null).
  var MASTER_HASHES = ['73ed1bf5-9868d17b', '73ed20aa-9868cf20'];

  var LS_CUSTOM = 'tsSuiteCustomPwHash'; // eigenes Passwort (Hash, pro Gerät)
  var SS_OK = 'tsSuiteAuthOk';           // Sitzungs-Freigabe für alle Bereiche

  function hash(str) {
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 37) ^ c) >>> 0;
    }
    return h1.toString(16) + '-' + h2.toString(16);
  }

  function customHash() {
    try { return localStorage.getItem(LS_CUSTOM) || null; } catch (e) { return null; }
  }

  function verify(pw) {
    if (!pw) return false;
    var h = hash(pw);
    if (MASTER_HASHES.indexOf(h) !== -1) return true;
    var c = customHash();
    return !!c && h === c;
  }

  function isUnlocked() {
    try { return sessionStorage.getItem(SS_OK) === '1'; } catch (e) { return false; }
  }

  function markUnlocked() {
    try { sessionStorage.setItem(SS_OK, '1'); } catch (e) {}
  }

  function setCustom(currentPw, newPw) {
    if (!verify(currentPw)) return { ok: false, msg: 'Aktuelles Passwort ist falsch.' };
    if (!newPw || newPw.length < 4) return { ok: false, msg: 'Neues Passwort: mindestens 4 Zeichen.' };
    try { localStorage.setItem(LS_CUSTOM, hash(newPw)); } catch (e) {
      return { ok: false, msg: 'Speichern nicht möglich (localStorage gesperrt).' };
    }
    return { ok: true, msg: 'Eigenes Passwort gespeichert — gilt auf diesem Gerät für alle geschützten Bereiche.' };
  }

  function removeCustom(currentPw) {
    if (!verify(currentPw)) return { ok: false, msg: 'Aktuelles Passwort ist falsch.' };
    try { localStorage.removeItem(LS_CUSTOM); } catch (e) {}
    return { ok: true, msg: 'Eigenes Passwort entfernt — es gilt wieder nur das Master-Passwort.' };
  }

  window.TSAuth = {
    verify: verify,
    isUnlocked: isUnlocked,
    markUnlocked: markUnlocked,
    setCustom: setCustom,
    removeCustom: removeCustom,
    hasCustom: function () { return !!customHash(); }
  };

  /* ---------------- Automatisches Gate (data-gate) ---------------- */
  var script = document.currentScript;
  if (!script || !script.hasAttribute('data-gate')) return;
  if (isUnlocked()) return;

  var title = script.getAttribute('data-title') || document.title || 'Geschützter Bereich';

  // Sofort-Verdeckung: verhindert kurzes Aufblitzen des Inhalts, bevor das Gate steht
  var preHide = document.createElement('style');
  preHide.id = 'tsAuthPreHide';
  preHide.textContent = 'body > :not(#tsAuthGate){visibility:hidden !important;}';
  (document.head || document.documentElement).appendChild(preHide);

  function buildGate() {
    var css = '' +
      '#tsAuthGate{position:fixed;inset:0;z-index:2147483000;background:#0a0a0c;display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Inter","IBM Plex Sans","Segoe UI",system-ui,sans-serif;color:#e9edf2;}' +
      '#tsAuthGate *{box-sizing:border-box;}' +
      '#tsAuthGate .ta-box{width:100%;max-width:400px;background:#111318;border:1px solid rgba(58,123,213,.3);padding:30px 26px;}' +
      '#tsAuthGate .ta-eyebrow{font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#3a7bd5;margin:0 0 8px;font-weight:600;}' +
      '#tsAuthGate h1{font-size:20px;margin:0 0 18px;font-weight:700;}' +
      '#tsAuthGate input{width:100%;background:#0a0a0c;border:1px solid rgba(58,123,213,.35);color:#e9edf2;padding:11px 12px;font-size:15px;font-family:inherit;margin-bottom:10px;}' +
      '#tsAuthGate input:focus{outline:none;border-color:#3a7bd5;}' +
      '#tsAuthGate button{width:100%;background:#3a7bd5;color:#0a0a0c;border:none;padding:12px;font-weight:600;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:14px;cursor:pointer;}' +
      '#tsAuthGate button:hover{background:#2f66b3;}' +
      '#tsAuthGate .ta-err{color:#c9604f;font-size:13px;min-height:18px;margin-top:10px;}' +
      '#tsAuthGate .ta-ok{color:#5c9e7c;font-size:13px;min-height:18px;margin-top:10px;}' +
      '#tsAuthGate .ta-toggle{display:inline-block;margin-top:16px;color:#8394a1;font-size:12.5px;text-decoration:underline;cursor:pointer;background:none;border:none;padding:0;width:auto;font-family:inherit;}' +
      '#tsAuthGate .ta-toggle:hover{color:#3a7bd5;background:none;}' +
      '#tsAuthGate .ta-setup{display:none;margin-top:16px;padding-top:16px;border-top:1px solid rgba(58,123,213,.2);}' +
      '#tsAuthGate .ta-setup.ta-open{display:block;}' +
      '#tsAuthGate .ta-hint{color:#8394a1;font-size:12px;line-height:1.5;margin:0 0 12px;}';

    var style = document.createElement('style');
    style.textContent = css;

    var gate = document.createElement('div');
    gate.id = 'tsAuthGate';
    gate.innerHTML =
      '<div class="ta-box">' +
      '  <p class="ta-eyebrow">TS-Suite · Gesch\u00fctzter Bereich</p>' +
      '  <h1></h1>' +
      '  <input type="password" id="taPw" placeholder="Passwort" autocomplete="current-password">' +
      '  <button type="button" id="taUnlock">Entsperren</button>' +
      '  <div class="ta-err" id="taMsg"></div>' +
      '  <button type="button" class="ta-toggle" id="taToggle">Eigenes Passwort festlegen / \u00e4ndern</button>' +
      '  <div class="ta-setup" id="taSetup">' +
      '    <p class="ta-hint">Legt ein eigenes Passwort fest, das auf <strong>diesem Ger\u00e4t</strong> zus\u00e4tzlich zum Master-Passwort alle gesch\u00fctzten Bereiche \u00f6ffnet.</p>' +
      '    <input type="password" id="taCur" placeholder="Master- oder bisheriges eigenes Passwort" autocomplete="off">' +
      '    <input type="password" id="taNew1" placeholder="Neues Passwort (min. 4 Zeichen)" autocomplete="new-password">' +
      '    <input type="password" id="taNew2" placeholder="Neues Passwort wiederholen" autocomplete="new-password">' +
      '    <button type="button" id="taSave">Eigenes Passwort speichern</button>' +
      '  </div>' +
      '</div>';

    gate.querySelector('h1').textContent = title;

    function msg(text, ok) {
      var el = gate.querySelector('#taMsg');
      el.textContent = text || '';
      el.className = ok ? 'ta-ok' : 'ta-err';
    }

    function unlock() {
      var val = gate.querySelector('#taPw').value;
      if (verify(val)) {
        markUnlocked();
        gate.remove();
        style.remove();
        preHide.remove();
        document.documentElement.style.overflow = '';
      } else {
        msg('Falsches Passwort.');
      }
    }

    gate.querySelector('#taUnlock').addEventListener('click', unlock);
    gate.querySelector('#taPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') unlock(); });

    gate.querySelector('#taToggle').addEventListener('click', function () {
      gate.querySelector('#taSetup').classList.toggle('ta-open');
    });

    gate.querySelector('#taSave').addEventListener('click', function () {
      var cur = gate.querySelector('#taCur').value;
      var n1 = gate.querySelector('#taNew1').value;
      var n2 = gate.querySelector('#taNew2').value;
      if (n1 !== n2) { msg('Die neuen Passw\u00f6rter stimmen nicht \u00fcberein.'); return; }
      var res = setCustom(cur, n1);
      msg(res.msg, res.ok);
      if (res.ok) {
        gate.querySelector('#taCur').value = '';
        gate.querySelector('#taNew1').value = '';
        gate.querySelector('#taNew2').value = '';
        gate.querySelector('#taSetup').classList.remove('ta-open');
        gate.querySelector('#taPw').value = n1; // direkt entsperrbereit
      }
    });

    document.documentElement.style.overflow = 'hidden';
    document.head.appendChild(style);
    document.body.appendChild(gate);
    setTimeout(function () { var i = gate.querySelector('#taPw'); if (i) i.focus(); }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildGate);
  } else {
    buildGate();
  }
})();
