const root = document.querySelector('#app');
const esc = (text = '') => String(text).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const page = location.pathname.replace(/\/$/, '') || '/';

function home() {
  root.innerHTML = `<section class="hero"><div class="eyebrow">Federal legislation, machine readable</div><h1>German law.<br><i>Clear tools.</i></h1><p>Ein schlanker MCP-Server für die Recherche in Bundesgesetzen. Menschenlesbare Gesetzes- und Normreferenzen hinein, kompakte offizielle Quelleninformationen heraus.</p><div class="button-row"><a class="button" href="/docs">MCP Dokumentation</a><a class="button alt" href="/login">Login</a></div><div class="stats"><div class="stat"><strong>7</strong><span>LLM-orientierte Tools</span></div><div class="stat"><strong>0</strong><span>interne IDs als Input</span></div><div class="stat"><strong>NeuRIS</strong><span>offizielle Quelle</span></div></div><div class="legal-note">Der Dienst stellt offizielle Quellen bereit und ersetzt keine Rechtsberatung. Der Datenbestand von NeuRIS ist ein Preview-Service.</div></section>`;
}

async function docs() {
  root.innerHTML = `<section class="doc-page"><div class="eyebrow">Live tool catalog</div><h1>API & MCP<br>Dokumentation</h1><p class="lede">Diese Seite wird direkt aus derselben Tool-Definition erzeugt, die der laufende MCP-Server registriert. Sie kann nicht unabhängig vom Tool-Katalog veralten.</p><div class="endpoint"><span>POST /mcp</span><small>Streamable HTTP · MCP Remote Endpoint</small></div><div id="tool-list" class="loading">Lade Tool-Katalog …</div></section>`;
  try {
    const spec = await fetch('/api/spec').then((r) => r.json());
    const list = document.querySelector('#tool-list');
    list.className = 'tool-list';
    list.innerHTML = spec.tools.map((tool) => `<article class="tool"><div class="tool-name">${esc(tool.name)}</div><div><p>${esc(tool.description)}</p><div class="params">${Object.entries(tool.input_schema.properties).map(([name, config]) => `<span class="param ${(tool.input_schema.required || []).includes(name) ? 'req' : ''}">${esc(name)}${(tool.input_schema.required || []).includes(name) ? ' required' : ''}${config.example ? ` · ${esc(config.example)}` : ''}</span>`).join('')}</div></div></article>`).join('');
  } catch { document.querySelector('#tool-list').textContent = 'Tool-Katalog konnte nicht geladen werden.'; }
}

async function loginPage() {
  root.innerHTML = `<section class="login-page"><div class="eyebrow">Account</div><h1>Login</h1><p class="lede">Ein Account wird für spätere persönliche Funktionen und Nutzungseinstellungen vorbereitet. Der MCP-Endpunkt bleibt während des öffentlichen MVP-Launches ohne Account nutzbar.</p><div id="account-content" class="login-card"><form id="login-form"><label for="email">E-Mail</label><input id="email" name="email" autocomplete="email" type="email" required><label for="password">Passwort</label><input id="password" name="password" autocomplete="current-password" type="password" required><button class="button" type="submit">Einloggen</button><p class="form-note">Registrierung ist nur mit Einladung möglich.</p><p id="form-message" class="message"></p></form></div></section>`;
  const me = await fetch('/api/me').then((r) => r.ok ? r.json() : null);
  if (me?.user) { document.querySelector('#account-content').innerHTML = `<div class="account">Angemeldet als ${esc(me.user.email)}</div><button id="logout" class="button alt" type="button">Ausloggen</button>`; document.querySelector('#logout').onclick = async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.reload(); }; return; }
  document.querySelector('#login-form').onsubmit = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const message = document.querySelector('#form-message'); message.className = 'message'; message.textContent = 'Login wird geprüft …'; const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) }); const data = await response.json().catch(() => ({})); if (response.ok) location.reload(); else { message.className = 'message error'; message.textContent = data?.error?.message || 'Login fehlgeschlagen.'; } };
}

if (page === '/docs') docs(); else if (page === '/login') loginPage(); else home();
