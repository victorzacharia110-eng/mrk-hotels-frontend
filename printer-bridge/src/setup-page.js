'use strict';

/**
 * The human-facing setup page served at GET / (http://localhost:9720/).
 *
 * It lets an operator set the printer's network address at run time — no JSON
 * editing, no restart, no rebuild. Saving writes config.local.json next to the
 * executable (or the package root) and applies it immediately.
 *
 * The whole page is one self-contained string so it is bundled into the
 * single-file .exe (no external assets to ship alongside it).
 *
 * @param {{configPath?: string, version?: string}} [info]
 * @returns {string} Full HTML document.
 */
function renderSetupPage(info = {}) {
  const configPath = JSON.stringify(info.configPath || '');
  const version = JSON.stringify(info.version || '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MRK Printer Bridge</title>
<style>
  :root { --mrk:#005eb8; --mrk-dark:#004a91; --bg:#f4f6f8; --card:#fff; --line:#e2e6ea; --ink:#1f2a37; --muted:#6b7280; --ok:#0b8a3e; --err:#c02626; }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; background:var(--bg); color:var(--ink); }
  .wrap { max-width:560px; margin:40px auto; padding:0 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:24px; box-shadow:0 1px 3px rgba(16,24,40,.06); }
  h1 { margin:0 0 4px; font-size:20px; }
  .sub { margin:0 0 20px; color:var(--muted); font-size:13px; }
  .status { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:9px; background:#f0f5fb; border:1px solid #d5e3f2; margin-bottom:20px; font-size:14px; }
  .dot { width:10px; height:10px; border-radius:50%; background:#9aa4af; flex:none; }
  .dot.ok { background:var(--ok); } .dot.err { background:var(--err); }
  label { display:block; font-weight:600; font-size:13px; margin:0 0 6px; }
  input { width:100%; padding:10px 12px; font-size:15px; border:1px solid var(--line); border-radius:8px; background:#fff; }
  input:focus { outline:none; border-color:var(--mrk); box-shadow:0 0 0 3px rgba(0,94,184,.15); }
  .row { display:flex; gap:12px; margin-bottom:16px; }
  .row .grow { flex:1; } .row .port { width:120px; }
  .actions { display:flex; gap:10px; margin-top:4px; }
  button { padding:11px 18px; font-size:15px; font-weight:600; border-radius:8px; border:1px solid transparent; cursor:pointer; }
  button.primary { background:var(--mrk); color:#fff; } button.primary:hover { background:var(--mrk-dark); }
  button.ghost { background:#fff; color:var(--mrk); border-color:var(--mrk); } button.ghost:hover { background:#f0f5fb; }
  .msg { min-height:20px; font-size:13px; margin:14px 0 0; }
  .msg.ok { color:var(--ok); } .msg.err { color:var(--err); }
  details { margin-top:20px; } summary { cursor:pointer; color:var(--muted); font-size:13px; }
  pre { background:#0b141a; color:#d7e3ec; padding:12px; border-radius:8px; overflow:auto; font-size:12px; margin:10px 0 0; }
  .hint { color:var(--muted); font-size:12px; margin-top:6px; }
  .steps { margin:0 0 18px; padding-left:20px; color:var(--ink); font-size:14px; }
  .steps li { margin:4px 0; }
  .results { display:flex; flex-direction:column; gap:8px; margin-top:14px; }
  .result-item { display:flex; justify-content:space-between; align-items:center; text-align:left; background:#f0f5fb; border:1px solid #d5e3f2; color:var(--ink); font-weight:600; padding:10px 12px; }
  .result-item:hover { background:#e3eefb; }
  .ri-ip { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  .ri-mac { color:var(--muted); font-weight:400; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
  .fixbox { margin-top:14px; padding:14px; background:#fff8e6; border:1px solid #f0d98a; border-radius:9px; }
  .fixbox h3 { margin:0 0 6px; font-size:14px; }
  .fixbox p { margin:0 0 10px; font-size:13px; color:var(--ink); }
  .hidden { display:none; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>MRK Printer Bridge</h1>
      <p class="sub">Set the receipt printer's network address. Saving applies immediately.</p>

      <div class="status"><span id="dot" class="dot"></span><span id="statusText">Checking…</span></div>

      <ol class="steps">
        <li>Click <b>Detect printers</b>.</li>
        <li>Click your printer in the list.</li>
        <li>Click <b>Save</b>, then <b>Test print</b>.</li>
      </ol>

      <form id="form">
        <div class="row">
          <div class="grow">
            <label for="host">Printer IP address</label>
            <input id="host" placeholder="192.168.1.100" autocomplete="off" inputmode="decimal">
          </div>
          <div class="port">
            <label for="port">Port</label>
            <input id="port" type="number" placeholder="9100" min="1" max="65535" autocomplete="off">
          </div>
        </div>
        <div class="row hidden" id="tokenRow">
          <div class="grow">
            <label for="token">Access token</label>
            <input id="token" type="password" autocomplete="off" placeholder="required by this bridge">
          </div>
        </div>
        <div class="actions">
          <button type="submit" class="primary">Save</button>
          <button type="button" id="detect" class="ghost">Detect printers</button>
          <button type="button" id="test" class="ghost">Test print</button>
        </div>
      </form>

      <div id="results" class="results hidden"></div>

      <div id="fixbox" class="fixbox hidden">
        <h3>Printer plugged straight into this PC?</h3>
        <p>If the printer's network cable goes directly into this computer (not the router), the PC needs a one-time connection fix. Windows will ask for permission once — click <b>Yes</b>.</p>
        <button type="button" id="fixlink" class="primary">Fix direct-cable connection</button>
      </div>

      <p id="msg" class="msg"></p>
      <p class="hint" id="pathHint"></p>

      <details>
        <summary>Details</summary>
        <pre id="details"></pre>
      </details>
    </div>
  </div>

<script>
(function () {
  var CONFIG_PATH = ${configPath};
  var VERSION = ${version};
  var $ = function (id) { return document.getElementById(id); };
  var token = localStorage.getItem('mrk-bridge-token') || '';
  var authRequired = false;

  function headers(extra) {
    var h = extra || {};
    if (token) h['X-Auth-Token'] = token;
    return h;
  }

  function setStatus(text, cls) {
    $('statusText').textContent = text;
    $('dot').className = 'dot' + (cls ? ' ' + cls : '');
  }

  function msg(text, cls) { var m = $('msg'); m.textContent = text || ''; m.className = 'msg' + (cls ? ' ' + cls : ''); }

  function json(url) { return fetch(url).then(function (r) { return r.json(); }); }

  function refresh() {
    return json('/health?probe=1').then(function (h) {
      authRequired = !!h.auth;
      if (authRequired) $('tokenRow').classList.remove('hidden');
      var fixbox = $('fixbox');
      if (h.transport === 'network' && h.reachable === false) {
        setStatus('Printer configured but NOT reachable \\u2014 ' + h.printer, 'err');
        fixbox.classList.remove('hidden');
      } else if (h.transport === 'network') {
        setStatus('Connected \\u2014 printing over the network to ' + h.printer, 'ok');
        fixbox.classList.add('hidden');
      } else {
        setStatus('Ready \\u2014 printing via the Windows queue (' + h.printer + ')', 'ok');
      }
      return json('/config');
    }).then(function (c) {
      if (c && c.ok) {
        if (document.activeElement !== $('host')) $('host').value = c.printerHost || '';
        if (document.activeElement !== $('port')) $('port').value = c.printerPort || 9100;
        CONFIG_PATH = c.configPath || CONFIG_PATH;
      }
      $('pathHint').textContent = CONFIG_PATH ? 'Settings saved to: ' + CONFIG_PATH : '';
      $('details').textContent = JSON.stringify({ version: VERSION, auth: authRequired }, null, 2);
    }).catch(function () {
      setStatus('Cannot reach the bridge itself \\u2014 is it running?', 'err');
    });
  }

  function testBytes(host, port) {
    var enc = new TextEncoder();
    var parts = [[0x1b, 0x40]];
    var line = function (s) { return enc.encode(s + '\\n'); };
    parts.push(line('MRK PRINTER BRIDGE'));
    parts.push(line('Test print OK'));
    parts.push(line((host || '') + (port ? ':' + port : '')));
    parts.push(line(new Date().toLocaleString()));
    parts.push(enc.encode('\\n\\n\\n'));
    parts.push([0x1d, 0x56, 0x42, 0x00]);
    var len = 0, i;
    for (i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len), off = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], off); off += parts[i].length; }
    return out;
  }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    msg('Saving\\u2026');
    fetch('/config', {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ printerHost: $('host').value.trim(), printerPort: Number($('port').value) || 9100 })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body.ok) { msg('Saved \\u2014 printer set to ' + res.body.printer + '.', 'ok'); refresh(); }
        else { msg('Could not save: ' + (res.body.error || res.status) + (res.status === 401 ? ' (check the access token)' : ''), 'err'); }
      })
      .catch(function () { msg('Could not reach the bridge.', 'err'); });
  });

  $('test').addEventListener('click', function () {
    msg('Sending test print\\u2026');
    var bytes = testBytes($('host').value.trim(), Number($('port').value) || 9100);
    fetch('/print', { method: 'POST', headers: headers({ 'Content-Type': 'application/octet-stream' }), body: bytes })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body.ok) msg('Test print sent to ' + res.body.printer + '.', 'ok');
        else msg('Print failed: ' + (res.body.error || res.status), 'err');
      })
      .catch(function () { msg('Could not reach the bridge.', 'err'); });
  });

  $('token').addEventListener('change', function () {
    token = $('token').value.trim();
    if (token) localStorage.setItem('mrk-bridge-token', token);
    else localStorage.removeItem('mrk-bridge-token');
  });

  $('detect').addEventListener('click', function () {
    var box = $('results');
    box.classList.add('hidden');
    box.innerHTML = '';
    msg('Scanning the local network for printers\\u2026 (a few seconds)');
    fetch('/discover').then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok) { msg('Scan failed: ' + (res.error || 'unknown error'), 'err'); return; }
      if (!res.printers || !res.printers.length) {
        msg('No printers found on the local network. If the printer is plugged straight into this PC, use the button below. Otherwise type its IP above. (Scanned ' + res.scanned + ' addresses.)', 'err');
        $('fixbox').classList.remove('hidden');
        return;
      }
      msg('Found ' + res.printers.length + (res.printers.length > 1 ? ' printers' : ' printer') + ' \\u2014 click one to use it:', 'ok');
      box.classList.remove('hidden');
      res.printers.forEach(function (p) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'result-item';
        var ip = document.createElement('span');
        ip.className = 'ri-ip';
        ip.textContent = p.ip + ':' + p.ports.join(',');
        b.appendChild(ip);
        if (p.mac) {
          var mac = document.createElement('span');
          mac.className = 'ri-mac';
          mac.textContent = p.mac;
          b.appendChild(mac);
        }
        b.addEventListener('click', function () {
          $('host').value = p.ip;
          if (p.ports && p.ports[0]) $('port').value = p.ports[0];
          msg('Selected ' + p.ip + '. Click Save to apply.', 'ok');
        });
        box.appendChild(b);
      });
    }).catch(function () { msg('Could not reach the bridge.', 'err'); });
  });

  $('fixlink').addEventListener('click', function () {
    var host = $('host').value.trim();
    if (!host) { msg('Enter the printer IP above first (usually 192.168.1.100), then click Fix.', 'err'); return; }
    msg('Applying the connection fix \\u2014 accept the Windows permission prompt\\u2026');
    $('fixlink').disabled = true;
    fetch('/setup/link', {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ printerHost: host })
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        $('fixlink').disabled = false;
        if (res.status === 200 && res.body.ok) {
          msg('Connection fixed. Click Test print to confirm it works.', 'ok');
          $('fixbox').classList.add('hidden');
        } else {
          msg('Fix did not apply: ' + (res.body.message || res.body.error || res.status), 'err');
        }
      })
      .catch(function () { $('fixlink').disabled = false; msg('Could not reach the bridge.', 'err'); });
  });

  refresh();
})();
</script>
</body>
</html>`;
}

module.exports = { renderSetupPage };
