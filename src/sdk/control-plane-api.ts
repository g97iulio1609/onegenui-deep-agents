/**
 * Control Plane — HTTP API handlers and HTML rendering.
 *
 * Extracted from control-plane.ts for modularity.
 */

// ── Dashboard HTML ─────────────────────────────────────────────────

export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gauss Control Plane</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 24px; background: #0b1020; color: #f5f7ff; }
    h1 { margin-top: 0; }
    .muted { color: #a9b4d0; margin-bottom: 12px; }
    pre { background: #111935; border: 1px solid #25315f; padding: 16px; border-radius: 8px; overflow: auto; max-height: 70vh; }
  </style>
</head>
<body>
  <h1>Gauss Control Plane</h1>
  <div class="muted">Live snapshot refreshes every 2s • filter: <code>?section=metrics</code> • auth via <code>?token=...</code></div>
  <pre id="out">loading...</pre>
  <script>
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const section = params.get('section');
    const qs = new URLSearchParams();
    if (token) qs.set('token', token);
    if (section) qs.set('section', section);
    async function refresh() {
      const target = '/api/snapshot' + (qs.toString() ? ('?' + qs.toString()) : '');
      const r = await fetch(target);
      if (!r.ok) {
        document.getElementById('out').textContent = 'HTTP ' + r.status + ': ' + await r.text();
        return;
      }
      const j = await r.json();
      document.getElementById('out').textContent = JSON.stringify(j, null, 2);
    }
    setInterval(refresh, 2000);
    refresh();
  </script>
</body>
</html>`;
}

// ── Hosted Ops Console HTML ────────────────────────────────────────

export function renderHostedOpsHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gauss Hosted Ops Console</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 20px; background: #0b1020; color: #f5f7ff; }
    .row { margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input, button { background: #111935; color: #f5f7ff; border: 1px solid #25315f; border-radius: 6px; padding: 8px; }
    pre { background: #111935; border: 1px solid #25315f; padding: 12px; border-radius: 8px; max-height: 60vh; overflow: auto; }
    .muted { color: #a9b4d0; }
  </style>
</head>
<body>
  <h1>Gauss Hosted Ops Console</h1>
  <div class="muted">Live stream viewer with multiplex channels + replay cursor support.</div>
  <div class="row"><a href="/ops/tenants" style="color:#9cc3ff">Open tenant dashboard →</a></div>
  <div class="row">
    <label>Token <input id="token" placeholder="optional" /></label>
    <label>Last Event ID <input id="lastEventId" placeholder="optional" /></label>
    <button id="connect">Connect</button>
  </div>
  <div class="row">
    <label><input type="checkbox" class="ch" value="snapshot" checked /> snapshot</label>
    <label><input type="checkbox" class="ch" value="timeline" checked /> timeline</label>
    <label><input type="checkbox" class="ch" value="dag" /> dag</label>
  </div>
  <pre id="out">idle</pre>
  <script>
    let source;
    const out = document.getElementById('out');
    function selectedChannels() {
      return [...document.querySelectorAll('.ch:checked')].map((node) => node.value);
    }
    function append(message) {
      out.textContent = message + "\\n" + out.textContent;
    }
    document.getElementById('connect').addEventListener('click', () => {
      if (source) source.close();
      const token = document.getElementById('token').value.trim();
      const lastEventId = document.getElementById('lastEventId').value.trim();
      const channels = selectedChannels();
      const qs = new URLSearchParams();
      if (channels.length > 0) qs.set('channels', channels.join(','));
      if (token) qs.set('token', token);
      if (lastEventId) qs.set('lastEventId', lastEventId);
      source = new EventSource('/api/stream?' + qs.toString());
      source.onmessage = (event) => append(event.data);
      source.onerror = () => append('stream disconnected');
      append('stream connected');
    });
    fetch('/api/ops/capabilities')
      .then((r) => r.json())
      .then((j) => append('capabilities: ' + JSON.stringify(j)))
      .catch(() => append('capabilities: fetch error'));
  </script>
</body>
</html>`;
}

// ── Hosted Tenant Ops HTML ─────────────────────────────────────────

export function renderHostedTenantOpsHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gauss Hosted Tenant Ops</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 20px; background: #0b1020; color: #f5f7ff; }
    .row { margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input, button { background: #111935; color: #f5f7ff; border: 1px solid #25315f; border-radius: 6px; padding: 8px; }
    pre { background: #111935; border: 1px solid #25315f; padding: 12px; border-radius: 8px; max-height: 60vh; overflow: auto; }
    a { color: #9cc3ff; }
    .muted { color: #a9b4d0; }
  </style>
</head>
<body>
  <h1>Gauss Hosted Tenant Ops</h1>
  <div class="muted">Tenant-level operational metrics powered by <code>/api/ops/tenants</code>.</div>
  <div class="row"><a href="/ops">← Back to stream console</a></div>
  <div class="row">
    <label>Token <input id="token" placeholder="optional" /></label>
    <label>Tenant <input id="tenant" placeholder="optional filter" /></label>
    <button id="refresh">Refresh</button>
  </div>
  <pre id="out">loading...</pre>
  <script>
    const out = document.getElementById('out');
    async function refresh() {
      const token = document.getElementById('token').value.trim();
      const tenant = document.getElementById('tenant').value.trim();
      const qs = new URLSearchParams();
      if (token) qs.set('token', token);
      if (tenant) qs.set('tenant', tenant);
      const target = '/api/ops/tenants' + (qs.toString() ? ('?' + qs.toString()) : '');
      const r = await fetch(target);
      if (!r.ok) {
        out.textContent = 'HTTP ' + r.status + ': ' + await r.text();
        return;
      }
      const j = await r.json();
      out.textContent = JSON.stringify(j, null, 2);
    }
    document.getElementById('refresh').addEventListener('click', refresh);
    refresh();
  </script>
</body>
</html>`;
}
