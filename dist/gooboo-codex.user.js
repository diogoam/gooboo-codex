// ==UserScript==
// @name         Gooboo Codex
// @namespace    gooboo-assist
// @version      1.2.0
// @description  Fan wiki clicável do Gooboo dentro do jogo: todo termo com o nome da interface, de onde vem, como destrava, calculadoras ligadas ao seu jogo ao vivo, planejador de run e "o que falta" por feature. Só lê o jogo.
// @author       diogoam
// @homepageURL  https://github.com/diogoam/gooboo-codex
// @match        https://tendsty.github.io/gooboo/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/diogoam/gooboo-codex/main/dist/gooboo-codex.user.js
// @downloadURL  https://raw.githubusercontent.com/diogoam/gooboo-codex/main/dist/gooboo-codex.user.js
// ==/UserScript==

(function () {
  'use strict';
  if (window.__goobooCodex) return; // já carregado (script instalado duas vezes)
  window.__goobooCodex = true;

  // ════════════════════════════════════════════════════════════════════════
  // NÚCLEO COMPARTILHADO GooAssist v2 (idêntico aos scripts de Mining/Gallery/School)
  // O Codex não automatiza nada; usa o núcleo para os timers em Worker (seguem rodando com a
  // aba do jogo em 2º plano enquanto a janela do Codex está na frente) e para o dock no topo.
  // ════════════════════════════════════════════════════════════════════════
  const CORE_V = 2;

  function makeCore() {
    const core = { version: 1, modules: {} };

    core.vue = () => document.querySelector('#app')?.__vue__ || null;
    core.store = () => core.vue()?.$store || window.__vue_store__ || null;

    const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'O', 'N', 'D', 'UD', 'DD', 'TD', 'QaD', 'QiD', 'SxD', 'SpD', 'OD', 'ND', 'V', 'UV', 'DV', 'TV'];
    core.fmt = (n, dec = 2) => {
      if (n === null || n === undefined || Number.isNaN(n)) return '?';
      if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
      const s = n < 0 ? '-' : '';
      n = Math.abs(n);
      if (n === 0) return '0';
      if (n < 0.01) return s + n.toExponential(1);
      if (n < 1000) return s + (Number.isInteger(n) ? String(n) : n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));
      const e = Math.floor(Math.log10(n) / 3);
      if (e < SUF.length) return s + (n / Math.pow(1000, e)).toFixed(dec) + SUF[e];
      return s + n.toExponential(2);
    };
    core.fmtTime = secs => {
      if (secs === null || secs === undefined || Number.isNaN(secs)) return '?';
      if (!isFinite(secs)) return '∞';
      if (secs <= 0) return 'agora';
      secs = Math.round(secs);
      const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600),
        m = Math.floor((secs % 3600) / 60), s = secs % 60;
      if (d > 0) return `${d}d ${h}h`;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };
    core.pct = r => (r >= 1 ? '+' : '') + core.fmt((r - 1) * 100, 1) + '%';
    core.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    core.rates = {};
    core.sample = () => {
      const st = core.store();
      if (!st?.state?.currency) return;
      const now = Date.now();
      for (const [key, c] of Object.entries(st.state.currency)) {
        const v = c?.value;
        if (typeof v !== 'number') continue;
        const r = core.rates[key];
        if (!r) { core.rates[key] = { last: v, t: now, ema: null }; continue; }
        const dt = (now - r.t) / 1000;
        if (dt <= 0) continue;
        const delta = (v - r.last) / dt;
        if (dt < 120 && delta >= 0) r.ema = r.ema === null ? delta : r.ema * 0.75 + delta * 0.25;
        r.last = v; r.t = now;
      }
    };
    setInterval(core.sample, 4000);
    core.rate = key => core.rates[key]?.ema ?? null;

    const trCache = {};
    core.humanize = s => String(s).replace(/^[a-z]+_/, '').replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
    core.tr = (paths, fallback) => {
      const key = paths.join('|');
      if (key in trCache) return trCache[key] || fallback;
      let out = null;
      const lang = core.vue()?.$vuetify?.lang;
      for (const p of paths) {
        try {
          const t = lang?.t?.('$vuetify.' + p);
          if (typeof t === 'string' && t && !t.startsWith('$vuetify')) { out = t; break; }
        } catch (e) { /* ignore */ }
      }
      trCache[key] = out;
      return out || fallback;
    };

    core.dockItems = [];
    core.dock = el => { core.dockItems.push(el); core.ensureDock(); };
    core.ensureDock = () => {
      let dock = document.getElementById('ga-dock');
      if (!dock) {
        const spacer = document.querySelector('.v-app-bar .v-toolbar__content > .spacer, .v-app-bar .v-toolbar__content > .v-spacer');
        if (!spacer) return;
        dock = document.createElement('div');
        dock.id = 'ga-dock';
        dock.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:8px;';
        spacer.insertAdjacentElement('afterend', dock);
      }
      for (const el of core.dockItems) if (el.parentElement !== dock) dock.appendChild(el);
    };
    setInterval(core.ensureDock, 1500);
    new MutationObserver(() => core.ensureDock()).observe(document.body, { childList: true, subtree: false });

    return core;
  }

  // ── v2 (idêntico ao script de Mining 2.3): funciona minimizado / em segundo plano ─────────
  // O jogo avança via requestAnimationFrame (src/js/tick.js → advance), que o navegador PAUSA com a
  // janela minimizada, aba em 2º plano ou janela coberta (às vezes até com visibilityState 'visible').
  // Timers comuns também são estrangulados (1/min). Solução:
  //   • timers rodam num Web Worker (não estrangulados) → GA.sleep / GA.every
  //   • watchdog: se o relógio do jogo (system.timestamp) atrasar ≥2s, chama o PRÓPRIO advance() do jogo
  //     com o rAF neutralizado. É exatamente o tick normal (tempo real, com autosave), não cria nada.
  //   • segura um Web Lock para o navegador não "congelar" a aba.
  function upgradeCoreV2(core) {
    if (!core.fmtCountdown) core.fmtCountdown = secs => {
      if (secs === null || secs === undefined || Number.isNaN(secs)) return '?';
      if (!isFinite(secs)) return '∞';
      if (secs <= 0) return '0s';
      secs = Math.ceil(secs);
      const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600),
        m = Math.floor((secs % 3600) / 60), s = secs % 60, p2 = n => String(n).padStart(2, '0');
      if (d > 0) return `${d}d ${p2(h)}h ${p2(m)}m`;
      if (h > 0) return `${h}h ${p2(m)}m ${p2(s)}s`;
      if (m > 0) return `${m}m ${p2(s)}s`;
      return `${s}s`;
    };

    // Timers em Worker
    const waiters = new Map();
    let seq = 0, worker = null;
    try {
      const src = 'const t={};onmessage=e=>{const d=e.data;if(d.op==="set"){t[d.id]=setTimeout(()=>{delete t[d.id];postMessage(d.id)},d.ms)}else if(d.op==="every"){t[d.id]=setInterval(()=>postMessage(d.id),d.ms)}else{clearTimeout(t[d.id]);clearInterval(t[d.id]);delete t[d.id]}}';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = e => { const w = waiters.get(e.data); if (!w) return; if (!w.repeat) waiters.delete(e.data); try { w.fn(); } catch (err) { console.error('[GooAssist]', err); } };
    } catch (e) { worker = null; }
    core.workerTimers = !!worker;
    core.setTimeout = (fn, ms) => {
      if (!worker) return { cancel: (h => () => clearTimeout(h))(setTimeout(fn, ms)) };
      const id = ++seq; waiters.set(id, { fn, repeat: false }); worker.postMessage({ op: 'set', id, ms: Math.max(0, ms) });
      return { cancel: () => { waiters.delete(id); worker.postMessage({ op: 'clear', id }); } };
    };
    core.every = (ms, fn) => {
      if (!worker) return { cancel: (h => () => clearInterval(h))(setInterval(fn, ms)) };
      const id = ++seq; waiters.set(id, { fn, repeat: true }); worker.postMessage({ op: 'every', id, ms });
      return { cancel: () => { waiters.delete(id); worker.postMessage({ op: 'clear', id }); } };
    };
    core.sleep = (ms, signal) => new Promise((res, rej) => {
      if (signal?.aborted) return rej(new DOMException('Aborted', 'AbortError'));
      const h = core.setTimeout(res, ms);
      signal?.addEventListener('abort', () => { h.cancel(); rej(new DOMException('Aborted', 'AbortError')); }, { once: true });
    });

    // Função advance() do jogo, achada pelo runtime do webpack (nomes minificados mudam a cada build)
    core.findAdvance = () => {
      if (core._advance !== undefined) return core._advance;
      core._advance = null;
      try {
        let req = null;
        const chunk = Object.keys(window).find(k => /^webpackChunk/.test(k));
        window[chunk].push([['ga_core_' + Date.now()], {}, r => { req = r; }]);
        for (const id of Object.keys(req?.m || {})) {
          const src = String(req.m[id]);
          if (!src.includes('requestAnimationFrame') || !src.includes('longestOfflineTime')) continue;
          const ex = req(id);
          for (const k of Object.keys(ex)) {
            const f = ex[k];
            if (typeof f === 'function' && f.length === 0 && String(f).includes('requestAnimationFrame')) core._advance = f;
          }
        }
      } catch (e) { /* ignore */ }
      return core._advance;
    };
    core.bg = { enabled: true, ticks: 0, lastLag: 0, last: null, error: null };
    core.bgAdvance = () => {
      const st = core.store();
      const ts = st?.state?.system?.timestamp;
      if (!core.bg.enabled || ts === null || ts === undefined) return;
      const lag = Math.floor(Date.now() / 1000) - ts;
      core.bg.lastLag = lag;
      if (lag < 2) return;
      const adv = core.findAdvance();
      if (!adv) return;
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = () => 0;
      try { adv(); core.bg.ticks++; core.bg.last = Date.now(); } catch (e) { core.bg.error = e.message; } finally { window.requestAnimationFrame = raf; }
    };
    if (!core._bgTimer) core._bgTimer = core.every(1000, core.bgAdvance);
    try { if (navigator.locks && !core._lock) { core._lock = true; navigator.locks.request('gooassist-keepalive', () => new Promise(() => {})); } } catch (e) { /* ignore */ }
    // amostragem de taxas e dock também pelo Worker
    if (!core._sampleTimer) core._sampleTimer = core.every(4000, () => core.sample?.());
    core.version = Math.max(core.version || 0, 2);
    return core;
  }

  if (!window.GooAssist) window.GooAssist = makeCore();
  // Atualiza no lugar (outros scripts guardaram a referência ao objeto)
  if ((window.GooAssist._v2 || 0) < 1) { upgradeCoreV2(window.GooAssist); window.GooAssist._v2 = 1; }
  const GA = window.GooAssist;

  const VERSION = '1.2.0';
  const DATA_HASH = 'e8409260bd8f';
  const DATA_URLS = [
    'https://raw.githubusercontent.com/diogoam/gooboo-codex/main/data/codex-data.json',
    'https://cdn.jsdelivr.net/gh/diogoam/gooboo-codex@main/data/codex-data.json',
  ];
  const CSS_DOC = "\n/* Layout: two-pane codex — searchable index rail on the left, the entry \"page\" on the right; stacks on phones. */\n:root{\n  --bg:#eef1ef; --panel:#f8faf9; --ink:#17201c; --muted:#5b6862; --line:#d5ddd8;\n  --accent:#1d6f62; --accent-ink:#ffffff; --link:#16655a; --chip:#e2e8e5; --hl:#fff3c4;\n  --good:#2c7a3f; --bad:#b0403b; --mining:#a0612a; --village:#3f8a3a; --horde:#b23a3a; --farm:#7a9a1c; --gallery:#7c4bb3; --meta:#4f6a86;\n  --f-display:\"Baloo 2\", \"Trebuchet MS\", system-ui, sans-serif;\n  --f-body:\"Nunito Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif;\n  --f-mono:\"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, monospace;\n  color-scheme:light;\n}\n@media (prefers-color-scheme: dark){ :root:not([data-theme=\"light\"]){\n  --bg:#111614; --panel:#18201d; --ink:#e3ebe7; --muted:#97a69f; --line:#2b3632;\n  --accent:#5cc2ae; --accent-ink:#0b1412; --link:#7fd6c4; --chip:#222c28; --hl:#4a4220;\n  --good:#6fcf86; --bad:#f08a84; --mining:#e0975a; --village:#7cc56f; --horde:#ec7b7b; --farm:#b9d55a; --gallery:#b58ff0; --meta:#93add0;\n  color-scheme:dark; } }\n:root[data-theme=\"dark\"]{\n  --bg:#111614; --panel:#18201d; --ink:#e3ebe7; --muted:#97a69f; --line:#2b3632;\n  --accent:#5cc2ae; --accent-ink:#0b1412; --link:#7fd6c4; --chip:#222c28; --hl:#4a4220;\n  --good:#6fcf86; --bad:#f08a84; --mining:#e0975a; --village:#7cc56f; --horde:#ec7b7b; --farm:#b9d55a; --gallery:#b58ff0; --meta:#93add0;\n  color-scheme:dark; }\n*{box-sizing:border-box}\nhtml,body{height:100%}\nbody{background:var(--bg);color:var(--ink);font:15px/1.55 var(--f-body);}\nbody::before{content:\"\";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}\na{color:var(--link)}\n:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}\n.app{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);height:100%;padding-left:max(0px,env(safe-area-inset-left,0px));padding-right:max(0px,env(safe-area-inset-right,0px))}\n.rail{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line);background:var(--panel)}\n.brand{padding:18px 16px 10px;display:flex;align-items:baseline;gap:10px}\n.brand h1{font:800 26px/1 var(--f-display);margin:0;letter-spacing:-.01em}\n.brand h1 button{all:unset;cursor:pointer}\n.brand span{font-size:12px;color:var(--muted)}\n.search{padding:0 16px 10px}\n.search input{width:100%;font:15px var(--f-body);padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}\n.cats{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 10px;max-height:118px;overflow:auto}\n.cat{font:600 12px var(--f-body);border:1px solid var(--line);background:transparent;color:var(--muted);padding:3px 9px;border-radius:999px;cursor:pointer}\n.cat[aria-pressed=\"true\"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}\n.count{font:12px var(--f-mono);color:var(--muted);padding:0 16px 6px}\n.list{overflow:auto;flex:1;min-height:0;padding:0 8px 16px;list-style:none;margin:0}\n.list li button{all:unset;display:flex;gap:10px;align-items:center;width:100%;box-sizing:border-box;padding:7px 8px;border-radius:8px;cursor:pointer}\n.list li button:hover,.list li button[aria-current=\"true\"]{background:var(--chip)}\n.list .nm{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}\n.list .ct{font-size:11px;color:var(--muted);white-space:nowrap}\n.dot{width:10px;height:10px;border-radius:50%;flex:none;background:var(--meta)}\n.main{overflow:auto;min-width:0}\n.page{max-width:820px;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));margin:0 auto}\n.crumbs{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--muted)}\n.tag{font:700 11px var(--f-body);letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:6px;background:var(--chip);color:var(--ink)}\n.tag.f{color:#fff}\n.page h2{font:800 clamp(28px,5vw,40px)/1.05 var(--f-display);margin:12px 0 4px;text-wrap:balance;display:flex;gap:12px;align-items:center}\n.swatch{width:22px;height:22px;border-radius:7px;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}\n.key{font:12px var(--f-mono);color:var(--muted)}\n.key button{all:unset;cursor:pointer;border-bottom:1px dashed var(--line)}\n.desc{font-size:16px;margin:16px 0 4px;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:12px;max-width:65ch}\n.desc small{display:block;font-size:11px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}\nsection.s{margin-top:22px}\nsection.s h3{font:700 13px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line)}\nsection.s ul{margin:0;padding-left:18px}\nsection.s li{margin:3px 0;max-width:72ch;overflow-wrap:anywhere}\nsection.s li::marker{color:var(--muted)}\n.num{font-family:var(--f-mono);font-size:.92em}\na.x{text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--link) 40%,transparent);font-weight:600}\na.x:hover{border-bottom-color:var(--link)}\n.miss{color:var(--muted);font-style:italic}\ndetails.back{margin-top:26px}\ndetails.back summary{cursor:pointer;font:700 13px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}\ndetails.back ul{columns:2;column-gap:24px;padding-left:18px}\n.home h2{font:800 clamp(34px,6vw,52px)/1 var(--f-display);margin:8px 0 10px}\n.home p{max-width:62ch;color:var(--muted);font-size:16px}\n.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:18px}\n.tile{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}\n.tile:hover{border-color:var(--accent)}\n.tile b{font:700 17px var(--f-display)}\n.tile span{font:12px var(--f-mono);color:var(--muted)}\n.start{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}\n.start a{padding:6px 12px;border-radius:999px;background:var(--chip);text-decoration:none;color:var(--ink);font-weight:600}\nmark{background:var(--hl);color:inherit;border-radius:3px}\n.back-btn{display:none}\n@media (max-width:760px){\n  .app{grid-template-columns:1fr;height:auto}\n  .rail{border-right:0;border-bottom:1px solid var(--line);position:static}\n  .list{max-height:42vh}\n  .app.reading .rail{display:none}\n  .back-btn{display:inline-block;all:unset;cursor:pointer;color:var(--link);font-weight:700;margin-bottom:6px}\n  details.back ul{columns:1}\n}\n@media (prefers-reduced-motion: no-preference){ .tile,.list li button{transition:background .15s,border-color .15s} }\n\n.btn{font:700 13px var(--f-body);border:0;border-radius:8px;padding:6px 12px;cursor:pointer;background:var(--accent);color:var(--accent-ink)}\n.btn.ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}\nsection.lab{margin-top:22px;padding:14px 16px 16px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}\nsection.lab h3{font:800 20px/1.2 var(--f-display);margin:0 0 10px;color:var(--ink)}\nsection.lab h4{font:700 12px var(--f-body);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}\n.kpis{display:flex;flex-wrap:wrap;gap:10px}\n.kpis>div{display:flex;flex-direction:column;gap:1px;padding:8px 12px;border-radius:10px;background:var(--bg);min-width:140px;flex:1 1 140px}\n.kpis small{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}\n.kpis b{font:800 20px/1.2 var(--f-display);font-variant-numeric:tabular-nums}\n.kpis span{font-size:12px;color:var(--muted)}\n.kpis .sim{outline:2px solid var(--accent)}\n.fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-bottom:10px}\n.fld{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}\n.ni,.fld select{font:14px var(--f-mono);padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);width:100%}\n.tbl{overflow-x:auto;margin-top:6px}\n.tbl.tall{max-height:360px;overflow-y:auto}\n.tbl table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}\n.tbl th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel)}\n.tbl td{padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top}\n.tbl tr.dim td{opacity:.55}\n.tbl tr.best td{background:color-mix(in srgb,var(--good) 14%,transparent)}\n.up{color:var(--good)} .down{color:var(--bad)}\n.nowrap{white-space:nowrap}\nbutton.st{font:700 14px var(--f-mono);width:26px;height:26px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;margin-left:4px}\n.reset{margin-top:10px;font:600 12px var(--f-body);background:transparent;border:1px solid var(--line);color:var(--muted);border-radius:8px;padding:4px 10px;cursor:pointer}\n.hint{font-size:12px;color:var(--muted);margin:8px 0 0}\n.verdict{font-weight:700;margin:10px 0 0}\n.advice{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px}\n.advice>div{padding:10px 12px;border-radius:10px;background:var(--bg);border-left:3px solid var(--accent)}\n.advice b{font:700 14px var(--f-display)}\n.advice p{margin:4px 0 0;font-size:13.5px}\nul.plain{margin:0;padding-left:18px}\n.plan .goals{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}\n.plan article{padding:10px 12px;border-radius:10px;background:var(--bg)}\n.plan article h4{margin-top:0;color:var(--ink)}\n.plan article ul{padding-left:18px;margin:4px 0;font-size:13.5px}\n.plan article p{margin:6px 0 2px;font-size:13.5px}\n.mh{font:800 20px var(--f-display);margin:22px 0 8px}\ndetails.mgroup{margin-top:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:0 12px}\ndetails.mgroup>summary{cursor:pointer;padding:10px 0;display:flex;flex-wrap:wrap;gap:10px;align-items:center}\ndetails.mgroup>summary b{font:700 16px var(--f-display)}\ndetails.mgroup .miss-list{padding-bottom:12px}\ndetails.mgroup .miss-item{background:var(--bg)}\n.tag.near{background:var(--good);color:var(--accent-ink)}\n.rail-links{padding:0 16px 10px}\n.rail-links a{display:block;text-align:center;text-decoration:none}\n.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}\n.miss-filter{max-width:320px;margin-bottom:10px}\n.miss-list{display:grid;gap:8px}\n.miss-item{padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);font-size:14px}\n.miss-item h4{margin:0 0 4px;font:700 16px var(--f-display)}\n.pbar{display:inline-block;width:120px;height:8px;border-radius:4px;background:var(--chip);vertical-align:middle;overflow:hidden}\n.pbar i{display:block;height:100%;background:var(--accent)}\n.banner{margin-top:14px;padding:10px 14px;border-radius:10px;background:var(--chip);font-size:14px}\n\n/* Extras do userscript: barra de ferramentas, status ao vivo, mensagens, painel embutido */\n.brand{justify-content:space-between;align-items:center}\n.brand .tools{display:inline-flex;gap:4px}\n.ib{font:700 14px var(--f-body);width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;display:inline-grid;place-items:center;padding:0}\n.ib:disabled{opacity:.35;cursor:default}\n.live{display:flex;gap:8px;align-items:center;margin:0 16px 10px;font:600 13px var(--f-body);color:var(--muted)}\n.st-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex:none}\n.st-dot.on{background:var(--good);box-shadow:0 0 0 3px color-mix(in srgb,var(--good) 25%,transparent)}\n.rail-links{padding:0 16px 10px}\n.msgbox{padding:32px 24px;font:15px/1.55 var(--f-body);color:var(--ink)}\n.wrap{height:100%;background:var(--bg);color:var(--ink);font:15px/1.55 var(--f-body)}\nbody{margin:0}\n.brand h1{font-size:22px}\n";
  const CSS_SHADOW = "\n/* Layout: two-pane codex — searchable index rail on the left, the entry \"page\" on the right; stacks on phones. */\n:host{\n  --bg:#eef1ef; --panel:#f8faf9; --ink:#17201c; --muted:#5b6862; --line:#d5ddd8;\n  --accent:#1d6f62; --accent-ink:#ffffff; --link:#16655a; --chip:#e2e8e5; --hl:#fff3c4;\n  --good:#2c7a3f; --bad:#b0403b; --mining:#a0612a; --village:#3f8a3a; --horde:#b23a3a; --farm:#7a9a1c; --gallery:#7c4bb3; --meta:#4f6a86;\n  --f-display:\"Baloo 2\", \"Trebuchet MS\", system-ui, sans-serif;\n  --f-body:\"Nunito Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif;\n  --f-mono:\"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, monospace;\n  color-scheme:light;\n}\n@media (prefers-color-scheme: dark){ :host(:not([data-theme=\"light\"])){\n  --bg:#111614; --panel:#18201d; --ink:#e3ebe7; --muted:#97a69f; --line:#2b3632;\n  --accent:#5cc2ae; --accent-ink:#0b1412; --link:#7fd6c4; --chip:#222c28; --hl:#4a4220;\n  --good:#6fcf86; --bad:#f08a84; --mining:#e0975a; --village:#7cc56f; --horde:#ec7b7b; --farm:#b9d55a; --gallery:#b58ff0; --meta:#93add0;\n  color-scheme:dark; } }\n:host([data-theme=\"dark\"]){\n  --bg:#111614; --panel:#18201d; --ink:#e3ebe7; --muted:#97a69f; --line:#2b3632;\n  --accent:#5cc2ae; --accent-ink:#0b1412; --link:#7fd6c4; --chip:#222c28; --hl:#4a4220;\n  --good:#6fcf86; --bad:#f08a84; --mining:#e0975a; --village:#7cc56f; --horde:#ec7b7b; --farm:#b9d55a; --gallery:#b58ff0; --meta:#93add0;\n  color-scheme:dark; }\n*{box-sizing:border-box}\n\n\n\na{color:var(--link)}\n:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}\n.app{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);height:100%;padding-left:max(0px,env(safe-area-inset-left,0px));padding-right:max(0px,env(safe-area-inset-right,0px))}\n.rail{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line);background:var(--panel)}\n.brand{padding:18px 16px 10px;display:flex;align-items:baseline;gap:10px}\n.brand h1{font:800 26px/1 var(--f-display);margin:0;letter-spacing:-.01em}\n.brand h1 button{all:unset;cursor:pointer}\n.brand span{font-size:12px;color:var(--muted)}\n.search{padding:0 16px 10px}\n.search input{width:100%;font:15px var(--f-body);padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink)}\n.cats{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 10px;max-height:118px;overflow:auto}\n.cat{font:600 12px var(--f-body);border:1px solid var(--line);background:transparent;color:var(--muted);padding:3px 9px;border-radius:999px;cursor:pointer}\n.cat[aria-pressed=\"true\"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}\n.count{font:12px var(--f-mono);color:var(--muted);padding:0 16px 6px}\n.list{overflow:auto;flex:1;min-height:0;padding:0 8px 16px;list-style:none;margin:0}\n.list li button{all:unset;display:flex;gap:10px;align-items:center;width:100%;box-sizing:border-box;padding:7px 8px;border-radius:8px;cursor:pointer}\n.list li button:hover,.list li button[aria-current=\"true\"]{background:var(--chip)}\n.list .nm{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}\n.list .ct{font-size:11px;color:var(--muted);white-space:nowrap}\n.dot{width:10px;height:10px;border-radius:50%;flex:none;background:var(--meta)}\n.main{overflow:auto;min-width:0}\n.page{max-width:820px;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));margin:0 auto}\n.crumbs{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--muted)}\n.tag{font:700 11px var(--f-body);letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:6px;background:var(--chip);color:var(--ink)}\n.tag.f{color:#fff}\n.page h2{font:800 clamp(28px,5vw,40px)/1.05 var(--f-display);margin:12px 0 4px;text-wrap:balance;display:flex;gap:12px;align-items:center}\n.swatch{width:22px;height:22px;border-radius:7px;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}\n.key{font:12px var(--f-mono);color:var(--muted)}\n.key button{all:unset;cursor:pointer;border-bottom:1px dashed var(--line)}\n.desc{font-size:16px;margin:16px 0 4px;padding:12px 14px;background:var(--panel);border:1px solid var(--line);border-radius:12px;max-width:65ch}\n.desc small{display:block;font-size:11px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}\nsection.s{margin-top:22px}\nsection.s h3{font:700 13px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid var(--line)}\nsection.s ul{margin:0;padding-left:18px}\nsection.s li{margin:3px 0;max-width:72ch;overflow-wrap:anywhere}\nsection.s li::marker{color:var(--muted)}\n.num{font-family:var(--f-mono);font-size:.92em}\na.x{text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--link) 40%,transparent);font-weight:600}\na.x:hover{border-bottom-color:var(--link)}\n.miss{color:var(--muted);font-style:italic}\ndetails.back{margin-top:26px}\ndetails.back summary{cursor:pointer;font:700 13px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}\ndetails.back ul{columns:2;column-gap:24px;padding-left:18px}\n.home h2{font:800 clamp(34px,6vw,52px)/1 var(--f-display);margin:8px 0 10px}\n.home p{max-width:62ch;color:var(--muted);font-size:16px}\n.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:18px}\n.tile{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}\n.tile:hover{border-color:var(--accent)}\n.tile b{font:700 17px var(--f-display)}\n.tile span{font:12px var(--f-mono);color:var(--muted)}\n.start{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}\n.start a{padding:6px 12px;border-radius:999px;background:var(--chip);text-decoration:none;color:var(--ink);font-weight:600}\nmark{background:var(--hl);color:inherit;border-radius:3px}\n.back-btn{display:none}\n@media (prefers-reduced-motion: no-preference){ .tile,.list li button{transition:background .15s,border-color .15s} }\n\n.btn{font:700 13px var(--f-body);border:0;border-radius:8px;padding:6px 12px;cursor:pointer;background:var(--accent);color:var(--accent-ink)}\n.btn.ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}\nsection.lab{margin-top:22px;padding:14px 16px 16px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}\nsection.lab h3{font:800 20px/1.2 var(--f-display);margin:0 0 10px;color:var(--ink)}\nsection.lab h4{font:700 12px var(--f-body);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}\n.kpis{display:flex;flex-wrap:wrap;gap:10px}\n.kpis>div{display:flex;flex-direction:column;gap:1px;padding:8px 12px;border-radius:10px;background:var(--bg);min-width:140px;flex:1 1 140px}\n.kpis small{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}\n.kpis b{font:800 20px/1.2 var(--f-display);font-variant-numeric:tabular-nums}\n.kpis span{font-size:12px;color:var(--muted)}\n.kpis .sim{outline:2px solid var(--accent)}\n.fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-bottom:10px}\n.fld{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--muted)}\n.ni,.fld select{font:14px var(--f-mono);padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);width:100%}\n.tbl{overflow-x:auto;margin-top:6px}\n.tbl.tall{max-height:360px;overflow-y:auto}\n.tbl table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}\n.tbl th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel)}\n.tbl td{padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top}\n.tbl tr.dim td{opacity:.55}\n.tbl tr.best td{background:color-mix(in srgb,var(--good) 14%,transparent)}\n.up{color:var(--good)} .down{color:var(--bad)}\n.nowrap{white-space:nowrap}\nbutton.st{font:700 14px var(--f-mono);width:26px;height:26px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;margin-left:4px}\n.reset{margin-top:10px;font:600 12px var(--f-body);background:transparent;border:1px solid var(--line);color:var(--muted);border-radius:8px;padding:4px 10px;cursor:pointer}\n.hint{font-size:12px;color:var(--muted);margin:8px 0 0}\n.verdict{font-weight:700;margin:10px 0 0}\n.advice{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px}\n.advice>div{padding:10px 12px;border-radius:10px;background:var(--bg);border-left:3px solid var(--accent)}\n.advice b{font:700 14px var(--f-display)}\n.advice p{margin:4px 0 0;font-size:13.5px}\nul.plain{margin:0;padding-left:18px}\n.plan .goals{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}\n.plan article{padding:10px 12px;border-radius:10px;background:var(--bg)}\n.plan article h4{margin-top:0;color:var(--ink)}\n.plan article ul{padding-left:18px;margin:4px 0;font-size:13.5px}\n.plan article p{margin:6px 0 2px;font-size:13.5px}\n.mh{font:800 20px var(--f-display);margin:22px 0 8px}\ndetails.mgroup{margin-top:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:0 12px}\ndetails.mgroup>summary{cursor:pointer;padding:10px 0;display:flex;flex-wrap:wrap;gap:10px;align-items:center}\ndetails.mgroup>summary b{font:700 16px var(--f-display)}\ndetails.mgroup .miss-list{padding-bottom:12px}\ndetails.mgroup .miss-item{background:var(--bg)}\n.tag.near{background:var(--good);color:var(--accent-ink)}\n.rail-links{padding:0 16px 10px}\n.rail-links a{display:block;text-align:center;text-decoration:none}\n.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}\n.miss-filter{max-width:320px;margin-bottom:10px}\n.miss-list{display:grid;gap:8px}\n.miss-item{padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);font-size:14px}\n.miss-item h4{margin:0 0 4px;font:700 16px var(--f-display)}\n.pbar{display:inline-block;width:120px;height:8px;border-radius:4px;background:var(--chip);vertical-align:middle;overflow:hidden}\n.pbar i{display:block;height:100%;background:var(--accent)}\n.banner{margin-top:14px;padding:10px 14px;border-radius:10px;background:var(--chip);font-size:14px}\n\n/* Extras do userscript: barra de ferramentas, status ao vivo, mensagens, painel embutido */\n.brand{justify-content:space-between;align-items:center}\n.brand .tools{display:inline-flex;gap:4px}\n.ib{font:700 14px var(--f-body);width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;display:inline-grid;place-items:center;padding:0}\n.ib:disabled{opacity:.35;cursor:default}\n.live{display:flex;gap:8px;align-items:center;margin:0 16px 10px;font:600 13px var(--f-body);color:var(--muted)}\n.st-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex:none}\n.st-dot.on{background:var(--good);box-shadow:0 0 0 3px color-mix(in srgb,var(--good) 25%,transparent)}\n.rail-links{padding:0 16px 10px}\n.msgbox{padding:32px 24px;font:15px/1.55 var(--f-body);color:var(--ink)}\n.wrap{height:100%;background:var(--bg);color:var(--ink);font:15px/1.55 var(--f-body)}\n\n.brand h1{font-size:22px}\n\n/* painel embutido no jogo */\n:host{display:block;font:15px/1.55 var(--f-body);color:var(--ink)}\n.root{height:100%}\n.grip{position:absolute;left:-3px;top:0;bottom:0;width:7px;cursor:ew-resize;z-index:2}\n.grip:hover{background:color-mix(in srgb,var(--accent) 35%,transparent)}\n.wrap{container:codex/inline-size;overflow:hidden;border-left:1px solid var(--line)}\n.app{height:100%}\n@container codex (max-width:680px){\n  .app{grid-template-columns:1fr}\n  .app:not(.reading) .main{display:none}\n  .app.reading .rail{display:none}\n  .rail{border-right:0}\n  .back-btn{display:inline-block;all:unset;cursor:pointer;color:var(--link);font-weight:700;margin-bottom:6px}\n  details.back ul{columns:1}\n}";
  const SHELL = (popup) => `
<div class="wrap"><div class="app" id="app">
  <aside class="rail">
    <div class="brand">
      <h1><button id="homeBtn" type="button" title="Início">Gooboo Codex</button></h1>
      <span class="tools">
        <button type="button" class="ib" id="backBtn" title="Voltar" disabled>←</button>
        <button type="button" class="ib" id="refreshBtn" title="Atualizar com os valores atuais do jogo">↻</button>
        ${popup ? '' : '<button type="button" class="ib" id="popBtn" title="Abrir em janela separada">⧉</button><button type="button" class="ib" id="closeBtn" title="Fechar (Esc)">✕</button>'}
      </span>
    </div>
    <div class="live"><span class="st-dot" id="liveDot"></span><span id="liveTxt">…</span></div>
    <div class="rail-links"><a href="#missing" class="btn ghost">O que falta (todas as features)</a></div>
    <div class="search"><input id="q" type="search" placeholder="Buscar: Scrap, Depth dweller, Torch…" autocomplete="off" aria-label="Buscar no codex"></div>
    <div class="cats" id="cats" role="group" aria-label="Filtrar por tipo"></div>
    <div class="count" id="count"></div>
    <ul class="list" id="list"></ul>
  </aside>
  <main class="main" id="main"><div class="page" id="page"></div></main>
</div></div>`;

  // ─── app (gerado de src/app.js + src/calc.js) ─────────────────────────────
  // ===== Gooboo Codex · app (montado dentro do jogo: painel em Shadow DOM ou janela separada) =====
  // mountCodex(root, env)
  //   root: ShadowRoot ou Document (precisa de getElementById/querySelector)
  //   env:  { DATA, GBF, META, COLORS, GB, host, onPopout, onClose, isPopup, version }
  // Só LÊ a store do jogo. Nada aqui despacha ação, cria moeda ou mexe em unlock.
  function mountCodex(root, env) {
  const { DATA, COLORS, GB } = env;
  const $ = id => root.getElementById(id);
  const LSK = k => 'gcodex_' + k;
  const lsGet = k => { try { return localStorage.getItem(LSK(k)); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LSK(k), v); } catch {} };

  const BY = Object.fromEntries(DATA.map(e => [e.id, e]));
  const FEAT_NAMES = {};
  DATA.filter(e => e.c === 'Feature').forEach(e => FEAT_NAMES[e.k] = e.n);
  const FEAT_VAR = {mining:'--mining',village:'--village',horde:'--horde',farm:'--farm',gallery:'--gallery'};
  const CAT_ORDER = ['Conceito','Feature','Event','Moeda','Gema','Estatística','Upgrade','Building','Upgrade de prestige','Upgrade premium','Upgrade de shapes','Unlock','Relic','Glyph','Card','Coleção de cards','Card pack','Achievement','Livro','General','Questline','Note','Enhancement','Beacon','Smeltery','Job','Policy','Offering','Receita','Equipamento','Heirloom','Trinket','Sigil','Classe','Área','Torre','Crop','Gene','Farm building','Ideia','Shape','Matéria','Efeito de treasure','Consumível','Upgrade de evento'];
  const cats = [...new Set(DATA.map(e => e.c))].sort((a,b) => (CAT_ORDER.indexOf(a)+1||99) - (CAT_ORDER.indexOf(b)+1||99));
  const tok = id => id.replace(/:/g, '~');
  const untok = t => decodeURIComponent(t).replace(/~/g, ':');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const featColor = f => FEAT_VAR[f] ? `var(${FEAT_VAR[f]})` : 'var(--meta)';
  const swatch = e => e.col ? (COLORS[e.col] || '#9e9e9e') : null;

  function rich(t){
    let h = esc(t);
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/\{\{([^}]+)\}\}/g, (m, id) => {
      const e = BY[id]; if (!e) return `<span class="miss">${esc(id)}</span>`;
      return `<a class="x" href="#${tok(id)}" title="${esc(e.c)}">${esc(e.n)}</a>`;
    });
    h = h.replace(/«([^»]+)»/g, '<span class="miss">$1</span>');
    return h;
  }

  const BACK = {};
  for (const e of DATA) {
    const txt = JSON.stringify(e.s) + (e.d || '');
    for (const m of txt.matchAll(/\{\{([^}]+)\}\}/g)) { const t = m[1]; if (t !== e.id) (BACK[t] = BACK[t] || new Set()).add(e.id); }
  }

  // ===== Gooboo Codex · Laboratório (calculadoras ligadas ao motor real do jogo) =====
  const LAB = (() => {
    const ok = !!GB;
    const store = ok ? GB.store : null;
    const S = ok ? store.state : null;
    const G = ok ? store.getters : null;
    let saveInfo = null;

    // ---------- formatting ----------
    const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    const fmt = (n, d = 2) => {
      if (n === null || n === undefined || Number.isNaN(n)) return '—';
      if (!isFinite(n)) return n > 0 ? '∞' : '−∞';
      const a = Math.abs(n);
      if (a === 0) return '0';
      if (a < 1e-3) return n.toExponential(2);
      if (a < 1000) return String(+n.toFixed(a < 10 ? d + 1 : d));
      const e = Math.floor(Math.log10(a) / 3);
      if (e < SUF.length) return (n / Math.pow(1000, e)).toFixed(2).replace(/\.?0+$/, '') + SUF[e];
      return n.toExponential(2).replace('e+', 'e');
    };
    const pct = (r) => (r >= 1 ? '+' : '') + fmt((r - 1) * 100, 1) + '%';
    const mulx = (r) => '×' + fmt(r, 3);
    const time = (s) => {
      if (s === null || s === undefined || !isFinite(s)) return '∞';
      if (s < 1) return '< 1s';
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = Math.floor(s % 60);
      return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + (d ? '' : m + 'm') + (!d && !h ? ' ' + sec + 's' : '');
    };
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const link = (id, label) => BY[id] ? `<a class="x" href="#${tok(id)}">${esc(label ?? BY[id].n)}</a>` : esc(label ?? id);
    const curLink = (k) => k === 'farm_exp' ? 'exp de crops' : link('cur:' + k, BY['cur:' + k]?.n ?? k);
    const num = (id, v, step = 'any', attrs = '') => `<input class="ni" type="number" id="${id}" value="${v}" step="${step}" ${attrs}>`;

    // ---------- multiplier engine ----------
    const KEYMAP = [
      [/^upgrade_(.+)$/, m => 'upg:' + m[1]], [/^relicGlyph_(.+)$/, m => 'glyph:' + m[1]], [/^relic_(.+)$/, m => 'relic:' + m[1]],
      [/^cardCollection_(.+)$/, m => 'col:' + m[1]], [/^cardPower_(.+)$/, m => ['feat:' + m[1], 'Card power']], [/^cardsShiny_(.+)$/, m => ['feat:' + m[1], 'Shiny cards']],
      [/^cards_(.+)$/, m => ['feat:' + m[1], 'Coleção de cards']], [/^card_(.+)$/, m => 'card:' + m[1]], [/^schoolBook_(.+)$/, m => 'book:' + m[1]],
      [/^villageMilestone_(.+?)_(\d+)$/, m => ['craft:' + m[1], 'milestone ' + m[2]]], [/^villageSpecialCraft_(.+)$/, m => 'craft:' + m[1]], [/^villageJob_(.+)$/, m => 'job:' + m[1]],
      [/^villagePolicy_(.+)$/, m => 'policy:' + m[1]], [/^miningEnhancement_(.+)$/, m => 'enh:' + m[1]], [/^miningBeacon_(.+)$/, m => 'beacon:' + m[1]],
      [/^hordeHeirloom_(.+)$/, m => 'heir:' + m[1]], [/^hordeTower_(.+?)_(\d+)$/, m => ['tower:' + m[1], 'andar ' + m[2]]], [/^hordeBattlePass/, () => 'concept:battlepass'],
      [/^galleryIdea_(.+)$/, m => 'idea:' + m[1]], [/^cryolab_(.+)$/, () => 'concept:cryolab'], [/^farmSpecialCrop_(.+)$/, m => 'crop:' + m[1]], [/^trinket_(.+)$/, m => 'trinket:' + m[1]],
      [/^hordeEquipment_(.+)$/, m => 'equip:' + m[1]], [/^achievementReward_(.+)$/, m => 'ach:' + m[1]], [/^schoolSubject_(.+)$/, m => 'subject:' + m[1]], [/^globalLevel$/, () => 'concept:gl'],
    ];
    const srcLabel = (key) => {
      for (const [re, f] of KEYMAP) { const m = key.match(re); if (m) { const r = f(m); const [id, extra] = Array.isArray(r) ? r : [r, null]; return { id, html: link(id) + (extra ? ` <span class="key">${esc(extra)}</span>` : '') }; } }
      return { id: null, html: `<span class="key">${esc(key)}</span>` };
    };
    const neutral = t => t === 'mult' ? 1 : 0;
    const total = (it, ov = {}) => {
      let b = it.baseValue, m = 1, bo = 0;
      const pick = (dict, t) => { const o = { ...dict }; for (const [k, v] of Object.entries(ov)) if (v.type === t) { if (v.value === null) delete o[k]; else o[k] = v.value; } return o; };
      for (const v of Object.values(pick(it.baseValues, 'base'))) b += v;
      for (const v of Object.values(pick(it.multValues, 'mult'))) m *= v;
      for (const v of Object.values(pick(it.bonusValues, 'bonus'))) bo += v;
      let val = b * m + bo;
      const pureMult = it.baseValue === 0 && !Object.keys(pick(it.baseValues, 'base')).length && !Object.keys(pick(it.bonusValues, 'bonus')).length;
      if (pureMult) val = m; // mults whose base comes from elsewhere (ex.: Damage = pickaxe power × isto)
      if (!pureMult) { if (it.min !== null) val = Math.max(val, it.min); if (it.max !== null) val = Math.min(val, it.max); }
      return { val, base: b, mult: m, bonus: bo, pureMult };
    };
    // groups: which group mults feed this one
    const parentsOf = (name) => Object.entries(S.mult.items).filter(([, it]) => (it.group || []).includes(name)).map(([n]) => n);
    // upgrades that touch a mult (directly or via a group)
    const upgradesFor = (name) => {
      const names = new Set([name, ...parentsOf(name)]);
      const out = [];
      for (const [k, u] of Object.entries(S.upgrade.item)) u.effect.forEach((e, i) => { if (names.has(e.name) && ['mult', 'base', 'bonus'].includes(e.type)) out.push({ k, u, e, i }); });
      return out;
    };

    // ---------- generic multiplier calculator ----------
    const multState = {}; // name -> overlay levels {upgradeKey: level}
    function multCalc(name, title) {
      const it = S.mult.items[name]; if (!it) return '';
      const ov = multState[name] = multState[name] || {};
      const overlay = {};
      const ups = upgradesFor(name);
      for (const { k, u, e } of ups) if (ov[k] !== undefined) { const L = ov[k]; overlay['upgrade_' + k] = { type: e.type, value: L > 0 ? e.value(L) : null }; }
      const now = total(it), sim = total(it, overlay);
      const rows = [];
      const seen = new Set();
      const pushRow = (key, type, value) => {
        seen.add(key);
        const without = total(it, { ...overlay, [key]: { type, value: null } }).val;
        const imp = sim.val !== 0 && without !== 0 ? sim.val / without : null;
        rows.push({ key, type, value, imp });
      };
      for (const [t, dict] of [['base', it.baseValues], ['mult', it.multValues], ['bonus', it.bonusValues]]) for (const [k, v] of Object.entries(dict)) { const o = overlay[k]; if (o && o.type === t && o.value === null) continue; pushRow(k, t, o && o.type === t ? o.value : v); }
      for (const [k, o] of Object.entries(overlay)) if (!seen.has(k) && o.value !== null) pushRow(k, o.type, o.value);
      rows.sort((a, b) => (b.imp ?? 0) - (a.imp ?? 0));
      // next-level suggestions
      const sugg = [];
      for (const { k, u, e } of ups) {
        const L = ov[k] ?? u.level; if (u.cap !== null && L >= u.cap) continue;
        const nv = e.value(L + 1);
        const r = total(it, { ...overlay, ['upgrade_' + k]: { type: e.type, value: nv } }).val / (sim.val || 1);
        const price = (() => { try { return u.price(L); } catch { return {}; } })();
        const req = (() => { try { return u.requirement(L); } catch { return true; } })();
        sugg.push({ k, u, L, r, price, req });
      }
      sugg.sort((a, b) => b.r - a.r);
      const changed = Object.keys(ov).length > 0;
      const formula = now.pureMult ? `multiplicador total ${mulx(sim.mult)}` : `(${fmt(sim.base)}) × ${fmt(sim.mult, 3)} + ${fmt(sim.bonus)}`;
      return `<section class="lab" data-mult="${esc(name)}">
        <h3>Calculadora · ${esc(title || BY['mult:' + name]?.n || name)}</h3>
        <div class="kpis"><div><small>Valor atual</small><b>${fmt(now.val)}</b></div>${changed ? `<div class="sim"><small>Simulado</small><b>${fmt(sim.val)}</b><span>${pct(sim.val / (now.val || 1))}</span></div>` : ''}<div><small>Fórmula</small><span class="num">${formula}</span></div>${!sim.pureMult && sim.mult ? `<div><small>Valor de +1 na base</small><b>${pct(total(it, { ...overlay, __probe: { type: 'base', value: 1 } }).val / (sim.val || 1))}</b><span>um ×1.10 vale +10%</span></div>` : ''}</div>
        ${sugg.length ? `<h4>Próximo nível que mais aumenta este valor</h4><div class="tbl"><table><thead><tr><th>Upgrade</th><th>Nível</th><th>+1 nível</th><th>Custo do próximo</th><th></th></tr></thead><tbody>${sugg.slice(0, 12).map(s => `<tr class="${s.req ? '' : 'dim'}"><td>${link('upg:' + s.k)}${s.req ? '' : ' <span class="key">(ainda bloqueado)</span>'}</td><td class="num">${s.L}${s.u.cap !== null ? '/' + s.u.cap : ''}</td><td class="num ${s.r > 1.0001 ? 'up' : ''}">${pct(s.r)}</td><td class="num">${Object.entries(s.price).map(([c, v]) => fmt(v) + ' ' + curLink(c)).join(' + ')}</td><td class="nowrap"><button type="button" class="st" data-up="${esc(s.k)}" data-d="-1" aria-label="menos">−</button><button type="button" class="st" data-up="${esc(s.k)}" data-d="1" aria-label="mais">+</button></td></tr>`).join('')}</tbody></table></div>` : ''}
        ${rows.length ? `<h4>De onde vem o valor (${rows.length} fontes)</h4><div class="tbl"><table><thead><tr><th>Fonte</th><th>Tipo</th><th>Valor</th><th>Peso no total</th></tr></thead><tbody>${rows.map(r => `<tr><td>${srcLabel(r.key).html}</td><td>${r.type}</td><td class="num">${r.type === 'mult' ? mulx(r.value) : (r.value >= 0 ? '+' : '') + fmt(r.value)}</td><td class="num">${r.imp ? mulx(r.imp) : '—'}</td></tr>`).join('')}</tbody></table></div><p class="hint">"Peso no total" = quanto o valor final cairia sem essa fonte (×2 = metade sem ela). Use os botões − / + para simular níveis; nada é alterado no seu jogo.</p>` : `<p class="hint">Nenhuma fonte ativa${saveInfo ? '' : ' no jogo novo de exemplo — carregue seu save'}.</p>`}
        ${changed ? `<button type="button" class="reset" data-reset="${esc(name)}">Desfazer simulação</button>` : ''}
      </section>`;
    }
    function bindMult(root, rerender) {
      root.querySelectorAll('.lab[data-mult]').forEach(sec => {
        const name = sec.dataset.mult; const ov = multState[name];
        sec.querySelectorAll('button.st').forEach(b => b.onclick = () => { const k = b.dataset.up; const u = S.upgrade.item[k]; const L = (ov[k] ?? u.level) + (+b.dataset.d); ov[k] = Math.max(0, u.cap !== null ? Math.min(u.cap, L) : L); if (ov[k] === u.level) delete ov[k]; rerender(); });
        const r = sec.querySelector('button.reset'); if (r) r.onclick = () => { multState[name] = {}; rerender(); };
      });
    }

    // ---------- upgrade calculator ----------
    const upState = {};
    function upgradeCalc(k) {
      const u = S.upgrade.item[k]; if (!u) return '';
      const cur = u.level, tgt = upState[k] ?? Math.min(u.cap ?? cur + 5, cur + 5);
      const cost = {};
      for (let l = u.bought; l < tgt; l++) { let p = {}; try { p = u.price(l); } catch {} for (const [c, v] of Object.entries(p)) cost[c] = (cost[c] || 0) + v; }
      const effRows = u.effect.filter(e => ['mult', 'base', 'bonus'].includes(e.type)).map(e => {
        const it = S.mult.items[e.name];
        const a = cur > 0 ? e.value(cur) : (e.type === 'mult' ? 1 : 0), b = tgt > 0 ? e.value(tgt) : (e.type === 'mult' ? 1 : 0);
        let r = null; if (it) { const t0 = total(it).val; const t1 = total(it, { ['upgrade_' + k]: { type: e.type, value: tgt > 0 ? b : null } }).val; r = t0 ? t1 / t0 : null; }
        const tgtId = (BY['mult:' + e.name] ? 'mult:' + e.name : null);
        return `<tr><td>${tgtId ? link(tgtId) : esc(BY['mult:' + e.name]?.n || e.name)}</td><td class="num">${e.type === 'mult' ? mulx(a) : fmt(a)}</td><td class="num">${e.type === 'mult' ? mulx(b) : fmt(b)}</td><td class="num ${r > 1.0001 ? 'up' : ''}">${r ? pct(r) : '—'}</td></tr>`;
      });
      const have = Object.entries(cost).map(([c, v]) => { const cu = S.currency[c]; const val = cu ? cu.value : 0; return `<li>${fmt(v)} ${curLink(c)} — você tem ${fmt(val)}${cu && cu.cap ? ` (cap ${fmt(cu.cap)})` : ''}${val >= v ? ' <b class="up">✓ dá para pagar</b>' : ` · faltam ${fmt(v - val)}`}</li>`; });
      return `<section class="lab" data-up="${esc(k)}">
        <h3>Calculadora · comprar níveis</h3>
        <div class="kpis"><div><small>Nível atual</small><b>${cur}${u.cap !== null ? ' / ' + u.cap : ''}</b></div><div><small>Simular até o nível</small>${num('lvl-' + k, tgt, 1, `min="0" ${u.cap !== null ? `max="${u.cap}"` : ''}`)}</div></div>
        ${have.length ? `<h4>Custo total até o nível ${tgt}</h4><ul class="plain">${have.join('')}</ul>` : ''}
        ${effRows.length ? `<h4>Efeito no valor final</h4><div class="tbl"><table><thead><tr><th>Valor</th><th>Agora</th><th>No nível ${tgt}</th><th>Mudança no total</th></tr></thead><tbody>${effRows.join('')}</tbody></table></div>` : ''}
      </section>`;
    }
    function bindUp(root, rerender) {
      root.querySelectorAll('.lab[data-up]').forEach(sec => { const k = sec.dataset.up; const inp = sec.querySelector('input'); if (inp) inp.onchange = () => { upState[k] = Math.max(0, Math.round(+inp.value || 0)); rerender(); }; });
    }

    // ---------- formula calculators ----------
    const F = {}; // id -> {html(state), bind}
    const st = (k, f = 'value') => S.stat[k]?.[f] ?? 0;
    const mg = (n, b) => { try { return G['mult/get'](n, b); } catch { return null; } };
    const field = (id, label, v, step = 'any') => `<label class="fld"><span>${label}</span>${num(id, v, step)}</label>`;
    const read = (root, id) => +(root.querySelector('#' + CSS.escape(id))?.value ?? 0);
    const formState = {};
    const keep = (key, defaults) => formState[key] = Object.assign({}, defaults, formState[key] || {});
    const advice = (items) => `<div class="advice">${items.map(([h, b]) => `<div><b>${h}</b><p>${b}</p></div>`).join('')}</div>`;

    // Gallery cash
    const cashBase = B => B < 1e12 ? 0 : Math.pow(10, Math.pow(Math.log(B / 1e11) / Math.log(8), 0.7));
    F.cash = () => {
      const bps = mg('currencyGalleryBeautyGain') ?? 0;
      const s = keep('cash', { B: st('gallery_beauty') || 1e15, M: mg('currencyGalleryCashGain', 1) ?? 1, T: Math.max(st('gallery_timeSpent') / 3600, 0.1), B1: 0 });
      if (!s.B1) s.B1 = s.B + Math.max(bps, 0) * 3600 || s.B * 2;
      const c0 = Math.floor(cashBase(s.B) * s.M), c1 = Math.floor(cashBase(s.B1) * s.M);
      const x = Math.log(Math.max(s.B, 1e12) / 1e11) / Math.log(8);
      const el = 0.7 / (Math.log10(8) * Math.pow(x, 0.3));
      const avg = c0 / s.T, marg = c1 - c0;
      return `<section class="lab" data-f="cash"><h3>Calculadora · Cash do prestige</h3>
        <div class="fields">${field('cash-B', 'Beauty ganha nesta run', s.B)}${field('cash-M', 'Cash gain (multiplicador)', s.M)}${field('cash-T', 'Horas de run até agora', s.T)}${field('cash-B1', 'Beauty daqui a 1h (padrão: ganho atual/s × 3600)', s.B1)}</div>
        <div class="kpis"><div><small>Cash se prestigiar agora</small><b>${fmt(c0)}</b></div><div><small>Cash/hora médio da run</small><b>${fmt(avg)}</b></div><div><small>Cash extra na próxima 1h</small><b class="${marg > avg ? 'up' : 'down'}">${fmt(marg)}</b></div></div>
        <p class="verdict ${marg > avg ? 'up' : 'down'}">${s.B < 1e12 ? 'Ainda abaixo de 1e12 beauty: prestige não dá cash.' : marg > avg ? 'Continuar: a próxima hora rende mais que a média da run.' : 'Prestigiar: a próxima hora rende menos que a média da run.'}</p>
        ${advice([
          ['Como o cálculo funciona', `cash = 10^(log₈(beauty ÷ 1e11)^0.7) × Cash gain. A beauty usada é a <b>ganha na run</b> (gastar beauty não reduz o cash).`],
          ['Onde intervir', `Agora, dobrar a beauty dá só ${mulx(Math.pow(2, el))} de cash (elasticidade ${fmt(el, 3)}), e essa elasticidade cai a cada run. Dobrar o <b>Cash gain</b> dá ×2. Então: priorize tudo que multiplica Cash gain (${link('idea:advertise')}, ${link('mult:allPrestigeIncome')}, shiny cards de Gallery, ${link('concept:cryolab')}) e use beauty só para chegar rápido à faixa útil.`],
          ['Run para cash', `Runs curtas e frequentes. Compre o que acelera beauty no começo, e prestigie quando "cash extra na próxima 1h" ficar abaixo do "cash/hora médio". Selecione as cards antes.`],
        ])}
        <div class="tbl"><table><thead><tr><th>Beauty</th><th>Cash</th><th>vs agora</th></tr></thead><tbody>${[1, 2, 10, 100, 1e3, 1e6].map(k => { const c = Math.floor(cashBase(s.B * k) * s.M); return `<tr><td class="num">${fmt(s.B * k)}</td><td class="num">${fmt(c)}</td><td class="num">${c0 ? mulx(c / c0) : '—'}</td></tr>`; }).join('')}</tbody></table></div></section>`;
    };
    F.cash.bind = (r) => { const s = formState.cash; ['B', 'M', 'T', 'B1'].forEach(k => { s[k] = read(r, 'cash-' + k); }); };

    // Mining dweller
    const dwellGain = (steps) => Math.pow(1.15, steps / 2) * steps * 7;
    F.dweller = (sub = 0) => {
      const D = st('mining_maxDepth' + sub) || 50;
      const s = keep('dw' + sub, { D, P: mg('miningDepthDwellerMax') ?? 0.1, V: mg('miningDepthDwellerSpeed') ?? 0.000065, X: st('mining_depthDweller' + sub), T: st('mining_timeSpent') / 3600, M: mg(sub ? 'currencyMiningCrystalYellowGain' : 'currencyMiningCrystalGreenGain', 1) ?? 1 });
      const L = s.D * s.P, v = s.V / L;
      const at = (t) => {
        let x = s.X, left = t;
        if (x < L) { const tL = Math.log(5 / (5 + L - x)) / Math.log(1 - v); if (left < tL) return 5 + L - (5 + L - x) * Math.pow(1 - v, left); x = L; left -= tL; }
        let prog = v * 5 * left; // overcap: velocidade cai ×0.9 a cada 10% do limite
        while (prog > 1e-12) { const bp = Math.floor(10 * (x + 1e-12) / L) - 10; const target = ((bp + 1) / 10) * L; const m = Math.pow(0.9, bp + 1); const step = Math.min(prog * m, (bp + 11) / 10 * L - x); x += step; prog -= step / m; if (step <= 1e-12) break; }
        return x;
      };
      const gainAt = (x) => { const cap = Math.min(Math.max(x, Math.min(L, x)), L); const steps = Math.floor(cap * 2); return dwellGain(steps) * s.M * (steps ? Math.floor(x * 2) / steps : 1); };
      const g0 = gainAt(s.X);
      const pts = [0, 0.5, 1, 2, 4, 8, 12, 24, 48].map(h => { const x = at(h * 3600); const g = gainAt(x); return { h, x, g, rate: g / Math.max(s.T + h, 0.01) }; });
      const best = pts.reduce((a, b) => b.rate > a.rate ? b : a);
      const meter = dwellGain(Math.floor(L * 2)) ? dwellGain(Math.floor(L * 2) + 2) / dwellGain(Math.floor(L * 2)) : 1;
      return `<section class="lab" data-f="dw${sub}"><h3>Calculadora · Depth dweller e cristais (${sub ? 'Gas giant' : 'Ore mine'})</h3>
        <div class="fields">${field(`dw${sub}-D`, 'Profundidade máx. desta run', s.D, 1)}${field(`dw${sub}-P`, 'Maximum dweller depth (fração)', s.P)}${field(`dw${sub}-V`, 'Dweller speed', s.V)}${field(`dw${sub}-X`, 'Dweller atual (m)', s.X)}${field(`dw${sub}-T`, 'Horas de run até agora', s.T)}${field(`dw${sub}-M`, 'Crystal gain (mult.)', s.M)}</div>
        <div class="kpis"><div><small>Limite do dweller</small><b>${fmt(L)} m</b></div><div><small>Cristais agora</small><b>${fmt(g0)}</b></div><div><small>Melhor ponto (cristais/h)</small><b>+${best.h}h</b><span>${fmt(best.rate)}/h</span></div></div>
        <div class="tbl"><table><thead><tr><th>Esperar</th><th>Dweller</th><th>Cristais</th><th>Cristais/h da run</th></tr></thead><tbody>${pts.map(p => `<tr class="${p === best ? 'best' : ''}"><td>+${p.h}h</td><td class="num">${fmt(p.x)} m</td><td class="num">${fmt(p.g)}</td><td class="num">${fmt(p.rate)}</td></tr>`).join('')}</tbody></table></div>
        ${advice([
          ['Como o cálculo funciona', `Limite = profundidade máx. da run × Maximum dweller depth. O dweller se aproxima do limite cada vez mais devagar. Cristais = 7·s·1.15^(s/2) × Crystal gain, com s = 2 × metros do dweller.`],
          ['Onde intervir', `Cada metro a mais de dweller vale ${mulx(meter)} nos cristais. Com ${fmt(s.P * 100)}% de máximo, cada ${fmt(1 / s.P)} de profundidade da run = +1 m de limite. Ou seja: <b>empurrar a profundidade antes de deixar o dweller correr</b> rende muito mais do que esperar. Upgrades de Maximum dweller depth são exponenciais para você; Dweller speed só encurta o tempo.`],
          ['Run para cristais', `1) Desça o máximo possível (até cada camada levar minutos). 2) Compre Depth Dweller. 3) Espere até a linha destacada (melhor cristais/h). 4) Selecione cards e prestigie.`],
        ])}</section>`;
    };
    F.dweller.bind = (r, sub = 0) => { const s = formState['dw' + sub]; ['D', 'P', 'V', 'X', 'T', 'M'].forEach(k => s[k] = read(r, `dw${sub}-${k}`)); };

    // Village faith / blessing
    const faithAfter = (F0, g, C, t, om = 0.9, os = 0.9) => {
      let f = F0, left = t;
      while (left > 0) { const stage = Math.floor(f / C); const mult = stage > 0 ? om * Math.pow(os, stage - 1) : 1; const need = (C * (stage + 1) - f) / (g * mult); if (need >= left) { f += g * mult * left; left = 0; } else { f = C * (stage + 1); left -= need; } if (stage > 200) break; }
      return f;
    };
    F.faith = () => {
      const c = S.currency.village_faith;
      const s = keep('faith', { F: c.value, C: c.cap || 200, g: mg('currencyVillageFaithGain', 0) ?? 0.02, H: 4, T: Math.max(st('village_timeSpent') / 3600, 0.1) });
      const after = faithAfter(s.F, s.g, s.C, s.H * 3600);
      const gUp = faithAfter(s.F, s.g * 1.5, s.C, s.H * 3600), cUp = faithAfter(s.F, s.g, s.C * 1.5, s.H * 3600);
      const avg = s.F / s.T, nextH = faithAfter(s.F, s.g, s.C, 3600) - s.F;
      return `<section class="lab" data-f="faith"><h3>Calculadora · Faith → Blessing</h3>
        <div class="fields">${field('faith-F', 'Faith atual', s.F)}${field('faith-C', 'Faith capacity', s.C)}${field('faith-g', 'Faith gain por segundo', s.g)}${field('faith-T', 'Horas de run até agora', s.T)}${field('faith-H', 'Simular por (horas)', s.H)}</div>
        <div class="kpis"><div><small>Blessing se prestigiar agora</small><b>${fmt(s.F)}</b></div><div><small>Em ${fmt(s.H)}h</small><b>${fmt(after)}</b></div><div><small>Próxima 1h vs média</small><b class="${nextH > avg ? 'up' : 'down'}">${fmt(nextH)}</b><span>média ${fmt(avg)}/h</span></div></div>
        ${advice([
          ['Como o cálculo funciona', `Blessing = Faith que você tem. Acima do cap o ganho cai para ×0.9, depois ×0.81, ×0.73… a cada múltiplo do cap. Agora você está no estágio ${Math.floor(s.F / s.C)} (ganho efetivo ${mulx(Math.floor(s.F / s.C) ? 0.9 * Math.pow(0.9, Math.floor(s.F / s.C) - 1) : 1)}).`],
          ['Onde intervir', `Nas próximas ${fmt(s.H)}h: +50% de <b>Faith gain</b> rende ${fmt(gUp)}; +50% de <b>Faith capacity</b> rende ${fmt(cUp)}. ${gUp >= cUp ? 'Agora vale mais aumentar o ganho' : 'Agora vale mais aumentar a capacidade'} (Church/Mosque/Lighthouse e a policy Religion dão ganho; Temple, Lost pages, Holy book e Worship dão cap).`],
          ['Run para Blessing', `Construa a economia, suba a policy Religion no final (troca recursos por fé) e prestigie quando a próxima hora render menos que a média.`],
        ])}</section>`;
    };
    F.faith.bind = (r) => { const s = formState.faith; ['F', 'C', 'g', 'T', 'H'].forEach(k => s[k] = read(r, 'faith-' + k)); };

    // Horde souls
    const soulDrop = z => z < 21 ? 0 : Math.pow(1.1, z - 21) * (z - 20);
    F.souls = () => {
      const inClasses = S.system.features.horde.currentSubfeature === 1;
      const s = keep('souls', { z: (!inClasses && st('horde_maxZone')) || st('horde_maxZone', 'total') || 25, Z: st('horde_maxZone', 'total') || 25, M: mg('currencyHordeSoulCorruptedGain', 1) ?? 1, R: mg('hordeRareLootTime') ?? 60, have: S.currency.horde_soulCorrupted.value, cap: S.currency.horde_soulCorrupted.cap || 200 });
      const per = soulDrop(s.z) * s.M, perH = per * 3600 / s.R;
      return `<section class="lab" data-f="souls"><h3>Calculadora · Almas (Soul Corrupted → Soul Empowered)</h3>${inClasses ? '<p class="hint">Você está em Horde Classes agora; a zona padrão abaixo é o seu recorde (simulação de uma run de Equipment).</p>' : ''}
        <div class="fields">${field('souls-z', 'Zona máx. desta run', s.z, 1)}${field('souls-Z', 'Zona recorde', s.Z, 1)}${field('souls-M', 'Corrupted soul gain (mult.)', s.M)}${field('souls-R', 'Segundos por rare loot', s.R)}${field('souls-have', 'Almas atuais', s.have)}${field('souls-cap', 'Capacidade', s.cap)}</div>
        <div class="kpis"><div><small>Por rare loot</small><b>${fmt(per)}</b></div><div><small>Por hora (matando rápido)</small><b>${fmt(perH)}</b></div><div><small>Até o cap</small><b>${time(Math.max(0, s.cap - s.have) / perH * 3600)}</b></div></div>
        <div class="tbl"><table><thead><tr><th>Zona da run</th><th>Almas/hora</th><th>vs agora</th></tr></thead><tbody>${[0, 1, 2, 5, 10, 20].map(d => { const v = soulDrop(s.z + d) * s.M * 3600 / s.R; return `<tr><td>${s.z + d}</td><td class="num">${fmt(v)}</td><td class="num">${perH ? mulx(v / perH) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
        ${advice([
          ['Como o cálculo funciona', `Cada rare loot dá 1.1^(zona−21) × (zona−20) × gain, usando a zona máx. desta run. O cap usa o recorde: round(1.1^(Z−21)·(Z−20)·200) × cap mult. Prestige = almas atuais.`],
          ['Onde intervir', `Cada zona a mais rende ${mulx(soulDrop(s.z + 1) / Math.max(soulDrop(s.z), 1e-9))}. Empurrar zona é o maior multiplicador; depois, gain mult e reduzir o tempo de rare loot. Bater recorde de zona também sobe o cap para todas as runs seguintes.`],
          ['Run para almas', `Suba até a zona onde o boss fica lento, farme ali até encostar no cap (overcap ×0.75), prestigie. Se uma zona nova estiver perto, ela compensa: +1 zona ≈ ${pct(soulDrop(s.z + 1) / Math.max(soulDrop(s.z), 1e-9))} para sempre no cap.`],
        ])}</section>`;
    };
    F.souls.bind = (r) => { const s = formState.souls; ['z', 'Z', 'M', 'R', 'have', 'cap'].forEach(k => s[k] = read(r, 'souls-' + k)); };

    // Horde class leveling (like the user's sheet)
    F.classes = () => {
      const base = mg('hordeExpBase', 1) ?? 1, incM = mg('hordeExpIncrement', 1) ?? 1;
      const s = keep('cls', { cls: S.horde.selectedClass || 'adventurer', to: Math.floor(S.horde.expLevel || 0) + 10, edu: S.upgrade.item.horde_education?.level ?? 0, uni: S.upgrade.item.horde_university?.level ?? 0, from: Math.floor(S.horde.expLevel || 0) });
      const c = S.horde.fighterClass[s.cls];
      const eduNow = Math.pow(1 / 1.1, S.upgrade.item.horde_education.level), uniNow = Math.pow(1 / 1.05, S.upgrade.item.horde_university.level) / (S.upgrade.item.horde_university.level * 0.05 + 1);
      const eduSim = Math.pow(1 / 1.1, s.edu), uniSim = Math.pow(1 / 1.05, s.uni) / (s.uni * 0.05 + 1);
      const lo = s.cls === 'scholar' ? 1.12 : 1.15;
      const timeTo = (b, inc, from, to) => { let t = 0; for (let l = from; l < to; l++) t += Math.pow(inc, l) * b; return t; };
      const mk = (eduF, uniF) => ({ b: base / eduNow * eduF * c.exp.base, inc: lo + (incM / uniNow * uniF) * (c.exp.increment - lo) });
      const now = mk(eduNow, uniNow), sim = mk(eduSim, uniSim);
      const eduNext = mk(Math.pow(1 / 1.1, s.edu + 1), uniSim), uniNext = mk(eduSim, Math.pow(1 / 1.05, s.uni + 1) / ((s.uni + 1) * 0.05 + 1));
      if (s.to <= s.from) s.to = s.from + 1;
      const T = timeTo(sim.b, sim.inc, s.from, s.to);
      if (s.to <= s.from) s.to = s.from + 1;
      const T2 = timeTo(sim.b, sim.inc, s.from, s.to);
      const eduGain = T2 / timeTo(eduNext.b, eduNext.inc, s.from, s.to), uniGain = T2 / timeTo(uniNext.b, uniNext.inc, s.from, s.to);
      const pe = (() => { try { return S.upgrade.item.horde_education.price(s.edu).horde_courage; } catch { return 0; } })(), pu = (() => { try { return S.upgrade.item.horde_university.price(s.uni).horde_courage; } catch { return 0; } })();
      const rows = []; let acc = 0; for (let l = s.from; l < Math.min(s.to, s.from + 60); l++) { const one = Math.pow(sim.inc, l) * sim.b; acc += one; rows.push(`<tr><td>${l + 1}</td><td class="num">${time(one)}</td><td class="num">${time(acc)}</td></tr>`); }
      return `<section class="lab" data-f="cls"><h3>Calculadora · Nível de classe (Horde Classes)</h3>
        <div class="fields"><label class="fld"><span>Classe</span><select id="cls-cls">${Object.keys(S.horde.fighterClass).map(k => `<option value="${k}"${k === s.cls ? ' selected' : ''}>${esc(BY['class:' + k]?.n || k)}</option>`).join('')}</select></label>${field('cls-from', 'Do nível', s.from, 1)}${field('cls-to', 'Até o nível', s.to, 1)}${field('cls-edu', 'Education (nível)', s.edu, 1)}${field('cls-uni', 'University (nível)', s.uni, 1)}</div>
        <div class="kpis"><div><small>Tempo base / crescimento</small><b>${time(sim.b)}</b><span>×${fmt(sim.inc, 4)} por nível</span></div><div><small>Tempo até o nível ${s.to}</small><b>${time(T)}</b></div><div><small>Agora (seus níveis reais)</small><b>${time(timeTo(now.b, now.inc, s.from, s.to))}</b></div></div>
        ${advice([
          ['Como o cálculo funciona', `Tempo do nível n = Exp base × crescimento^n. ${link('upg:horde_education')} divide a base por 1.1 por nível. ${link('upg:horde_university')} reduz o crescimento acima de ${lo} (÷1.05^n ÷ (1+0.05n)).`],
          ['O que comprar agora', `+1 Education: tempo até o nível ${s.to} ${mulx(1 / eduGain)} (custa ${fmt(pe)} courage). +1 University: ${mulx(1 / uniGain)} (custa ${fmt(pu)} courage). Por courage gasta, ${Math.log(eduGain) / (pe || 1) > Math.log(uniGain) / (pu || 1) ? '<b>Education</b>' : '<b>University</b>'} rende mais. University ganha peso quanto mais alto o nível alvo.`],
        ])}
        <div class="tbl tall"><table><thead><tr><th>Nível</th><th>Tempo deste nível</th><th>Acumulado</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;
    };
    F.classes.bind = (r) => { const s = formState.cls; s.cls = r.querySelector('#cls-cls').value; ['from', 'to', 'edu', 'uni'].forEach(k => s[k] = Math.round(read(r, 'cls-' + k))); r.querySelector('#cls-cls').onchange = () => { s.cls = r.querySelector('#cls-cls').value; rerenderCurrent(); }; };

    // Farm crop prestige
    F.crops = () => {
      const crops = Object.entries(S.farm.crop).filter(([, c]) => c.found || c.levelMax > 0);
      const sum = crops.reduce((a, [, c]) => a + c.levelMax, 0);
      const rows = crops.map(([k, c]) => { const gain = c.level > c.levelMax && c.level >= 4 ? Math.pow(1.04, c.level - c.levelMax) : 1; const gl = Math.min(Math.max(c.level, c.levelMax), Math.floor(Math.max(c.level, c.levelMax) / 2) + 5, 25); let need = null; try { need = G['farm/expNeeded'](k); } catch {} return { k, c, gain, gl, need }; }).sort((a, b) => b.gain - a.gain);
      return `<section class="lab"><h3>Calculadora · Prestige de crops</h3>
        <div class="kpis"><div><small>Σ nível máx. (prestige)</small><b>${sum}</b></div><div><small>Bônus atual em crop gain</small><b>${mulx(Math.pow(1.04, sum))}</b></div></div>
        <div class="tbl"><table><thead><tr><th>Crop</th><th>Nível / recorde</th><th>Prestigiar agora</th><th>GL desta crop</th><th>Exp p/ próximo</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.gain > 1 ? 'best' : ''}"><td>${link('crop:' + r.k)}</td><td class="num">${r.c.level} / ${r.c.levelMax}</td><td class="num">${r.gain > 1 ? mulx(r.gain) + ' em tudo' : r.c.level < 4 ? 'precisa nível 4' : 'abaixo do recorde'}</td><td class="num">${r.gl}/25</td><td class="num">${r.need ? fmt(r.c.exp) + ' / ' + fmt(r.need) : '—'}</td></tr>`).join('')}</tbody></table></div>
        ${advice([
          ['Como o cálculo funciona', 'Bônus global = ×1.04 por nível de recorde somado de todas as crops. Prestigiar uma crop só aumenta o bônus se o nível atual passar o recorde dela.'],
          ['Onde intervir', 'Crops abaixo do nível 10 dão +1 GL por nível (o GL mais barato da Farm). Crops com o gene Prestige voltam com nível −5, então dá para prestigiar com mais frequência. Lembre de reselecionar cards da crop antes.'],
        ])}</section>`;
    };

    // Global level
    F.gl = () => {
      const parts = S.meta.globalLevelParts; const gl = S.meta.globalLevel;
      const next = Object.entries(S.meta.globalLevelUnlocks).filter(([, v]) => v > gl).sort((a, b) => a[1] - b[1]).slice(0, 4);
      return `<section class="lab"><h3>Seu Global level</h3>
        <div class="kpis"><div><small>Global level</small><b>${gl}</b></div>${next[0] ? `<div><small>Próxima feature</small><b>${link('unl:' + next[0][0])}</b><span>faltam ${next[0][1] - gl} GL</span></div>` : ''}<div><small>Exam pass</small><span>próximo em ${10 - gl % 10} GL</span></div></div>
        <div class="tbl"><table><thead><tr><th>Parte</th><th>Valor</th></tr></thead><tbody>${S.meta.globalLevelList.map(p => `<tr><td>${esc(GB.en.globalLevel[p] || p)}</td><td class="num">${parts[p] ?? 0}</td></tr>`).join('')}</tbody></table></div>
        ${next.length ? `<p class="hint">Próximos: ${next.map(([u, v]) => `${link('unl:' + u)} (GL ${v})`).join(' · ')}</p>` : ''}</section>`;
    };

    // Cryolab
    F.cryo = () => {
      const rows = Object.entries(S.cryolab).map(([f, c]) => { const sub = S.system.features[f]?.currentSubfeature ?? 0; let pg = {}, eg = 0, need = 0; try { pg = G['cryolab/prestigeGain'](f); eg = G['cryolab/expGain'](f, sub); need = G['cryolab/expNeeded'](c.level[sub]); } catch {} return `<tr><td>${link('feat:' + f)}</td><td>${c.active ? '❄ congelada' : '—'}</td><td class="num">${c.level.join(' / ')}</td><td class="num">${fmt(c.exp[sub])} / ${fmt(need)}</td><td class="num">${eg ? fmt(eg) + '/dia' : '—'}</td><td class="num">${Object.entries(pg).map(([k, v]) => fmt(v) + ' ' + curLink(k) + '/dia').join('<br>') || '—'}</td></tr>`; });
      return `<section class="lab"><h3>Seu Cryolab</h3><div class="tbl"><table><thead><tr><th>Feature</th><th>Estado</th><th>Níveis</th><th>Exp</th><th>Exp/dia se congelada</th><th>Moeda de prestige/dia</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
        ${advice([['Onde intervir', 'Exp/dia depende só da parte do GL daquela feature. Moeda/dia depende do seu melhor prestige: bater recorde de prestige aumenta a renda passiva para sempre. Congele a feature que você menos precisa jogar e cujo nível de cryolab está mais perto de subir.']])}</section>`;
    };

    // ---------- run planner ----------
    const STATFEAT = { mining: ['mining_maxDepth0', 'mining_maxDepth1', 'mining_depthDwellerCap0', 'mining_depthDwellerCap1'], horde: ['horde_maxZone'], farm: [], village: [], gallery: [] };
    const nextUpgrades = (f) => {
      const out = [];
      for (const [k, u] of Object.entries(S.upgrade.item)) {
        if (u.feature !== f || !u.requirementStat || u.requirementStat.startsWith('custom')) continue;
        let cur = 0; try { cur = u.requirementStat === 'farm_seedBox' ? S.upgrade.item.farm_seedBox.highestLevel : S.stat[u.requirementStat].total; } catch {}
        if (cur < u.requirementValue) out.push({ k, u, cur, need: u.requirementValue });
      }
      return out.sort((a, b) => (a.need - a.cur) / Math.max(a.need, 1) - (b.need - b.cur) / Math.max(b.need, 1)).slice(0, 8);
    };
    const evalTask = (t) => {
      let cur = 0;
      try {
        switch (t.type) {
          case 'subfeature': cur = S.system.features[t.name].currentSubfeature; break;
          case 'stat': cur = S.stat[t.name][t.subtype === 'current' ? 'value' : 'total']; break;
          case 'unlock': cur = S.unlock[t.name].see; break;
          case 'cardEquipped': cur = S.card.feature[t.feature].cardEquipped.includes(t.name); break;
          case 'upgrade': cur = S.upgrade.item[t.name][t.subtype === 'current' ? 'level' : 'highestLevel']; break;
          case 'cropLevel': cur = Math.max(S.farm.crop[t.name].level, S.farm.crop[t.name].levelMax); break;
          case 'equipmentMastery': cur = S.horde.items[t.name].masteryLevel; break;
        }
      } catch {}
      const okk = t.operator === undefined ? !!cur : t.operator === '>=' ? cur >= t.value : t.operator === '>' ? cur > t.value : t.operator === '<=' ? cur <= t.value : t.operator === '<' ? cur < t.value : cur === t.value;
      return { cur, ok: okk };
    };
    const questsFor = (f) => {
      const out = [];
      for (const [g, gen] of Object.entries(S.general)) {
        if (gen.unlock && !S.unlock[gen.unlock]?.see) continue;
        for (const [q, qu] of Object.entries(gen.quests)) {
          if (qu.unlock && !S.unlock[qu.unlock]?.see) continue;
          if (qu.stage >= qu.stages.length) continue;
          const sg = qu.stages[qu.stage];
          const raw = DATA_GBF[g]?.quests?.[q]?.stages?.[qu.stage];
          if (!raw || !raw.features.includes(f)) continue;
          out.push({ g, q, stage: qu.stage + 1, of: qu.stages.length, tasks: sg.tasks.map((t, i) => ({ txt: raw.tasks[i], ...evalTask(t) })), challenge: raw.isChallenge });
        }
      }
      return out;
    };
    const PLAN = {
      mining: { goal: 'cristais (prestige da mina)', calc: () => F.dweller(S.system.features.mining.currentSubfeature || 0), tips: ['Desça até cada camada levar alguns minutos: profundidade da run define o limite do dweller.', 'Compre Depth Dweller assim que possível e deixe correr; veja na calculadora o melhor ponto de cristais/h.', 'Antes do prestige: selecione cards (Mining) e confira se algum recorde de profundidade/dweller está perto.'] },
      village: { goal: 'Blessing (prestige da village)', calc: () => F.faith(), tips: ['Moradias até nível 25 dão GL; priorize as que faltam.', 'Faith continua subindo acima do cap (×0.9 por estágio). Suba Religion no fim da run.', 'Antes do prestige: selecione cards (Village).'] },
      horde: { goal: 'Soul Empowered (prestige da horde)', calc: () => F.souls(), tips: ['Empurre zona: cada zona multiplica almas por ~1.15 e recordes sobem o cap.', 'Itens perto de mastery 3 perdem nível no prestige — espere se estiverem perto.', 'Antes do prestige: selecione cards (Horde).'] },
      farm: { goal: 'Prestige de crops', calc: () => F.crops(), tips: ['Prestigie só crops acima do próprio recorde.', 'Crops abaixo do nível 10 são o GL mais barato.', 'Escolha genes pensando na rotação: os usados agora ficam bloqueados na próxima vez.'] },
      gallery: { goal: 'Cash (prestige da gallery)', calc: () => F.cash(), tips: ['Cash cresce devagar com beauty: runs curtas e frequentes.', 'Priorize multiplicadores de Cash gain.', 'Cores novas liberam sistemas: produzir a próxima cor uma vez vale uma run mais longa.'] },
    };
    function planner(f) {
      const p = PLAN[f]; if (!p) return '';
      const ups = nextUpgrades(f), qs = questsFor(f);
      const statLabel = k => GB.en.stat?.[k]?.description || k;
      return `<section class="lab plan">
        <h3>Planejar a próxima run · ${esc(BY['feat:' + f]?.n || f)}</h3>
        <div class="goals">
          <article><h4>Run para ${esc(p.goal)}</h4><ul>${p.tips.map(t => `<li>${t}</li>`).join('')}</ul></article>
          <article><h4>Run para destravar o próximo upgrade</h4>${ups.length ? `<ul>${ups.map(x => `<li>${link('upg:' + x.k)} — ${esc(statLabel(x.u.requirementStat))}: <span class="num">${fmt(x.cur)} / ${fmt(x.need)}</span>${x.need - x.cur <= Math.max(5, x.need * 0.05) ? ' <b class="up">perto</b>' : ''}</li>`).join('')}</ul><p class="hint">Requisitos usam o recorde de todos os tempos: basta alcançar uma vez.</p>` : '<p class="hint">Nada pendente por recorde nesta feature.</p>'}</article>
          <article><h4>Run para questline (Generals)</h4>${qs.length ? qs.map(q => `<p>${link('quest:' + q.g + '.' + q.q)} · estágio ${q.stage}/${q.of}${q.challenge ? ' <span class="tag">⚔ dentro de uma run</span>' : ''}</p><ul>${q.tasks.map(t => `<li class="${t.ok ? 'up' : ''}">${t.ok ? '✓' : '○'} ${esc(t.txt)} <span class="num key">(agora: ${typeof t.cur === 'boolean' ? (t.cur ? 'sim' : 'não') : fmt(t.cur)})</span></li>`).join('')}</ul>`).join('') : '<p class="hint">Nenhum estágio atual depende desta feature.</p>'}</article>
        </div>
      </section>${p.calc()}`;
    }

    // ---------- which calculators go where ----------
    let DATA_GBF = {};
    const forEntry = (e) => {
      if (!ok) return '';
      const id = e.id; const parts = [];
      if (id.startsWith('mult:')) parts.push(multCalc(e.k));
      if (id.startsWith('cur:')) {
        const [f, ...r] = e.k.split('_'); const n = r.join('_');
        const gn = G['currency/gainMultName'](f, n), cn = G['currency/capMultName'](f, n);
        if (S.mult.items[gn]) parts.push(multCalc(gn, e.n + ' gain'));
        if (S.mult.items[cn]) parts.push(multCalc(cn, e.n + ' capacity'));
      }
      if (id.startsWith('upg:')) parts.push(upgradeCalc(e.k));
      const special = {
        'cur:gallery_cash': F.cash, 'cur:gallery_beauty': F.cash, 'cur:mining_crystalGreen': () => F.dweller(0), 'cur:mining_crystalYellow': () => F.dweller(1), 'concept:dweller': () => F.dweller(S.system.features.mining.currentSubfeature || 0),
        'cur:village_faith': F.faith, 'cur:village_blessing': F.faith, 'cur:horde_soulCorrupted': F.souls, 'cur:horde_soulEmpowered': F.souls, 'concept:rareloot': F.souls,
        'concept:battlepass': F.classes, 'upg:horde_education': F.classes, 'upg:horde_university': F.classes, 'concept:gl': F.gl, 'concept:cryolab': F.cryo,
      };
      if (special[id]) parts.unshift(special[id]());
      if (id.startsWith('class:')) parts.unshift(F.classes());
      if (id.startsWith('crop:')) parts.push(F.crops());
      if (id.startsWith('feat:') && PLAN[e.k]) parts.unshift(planner(e.k));
      return parts.join('');
    };
    const bindEntry = (root) => {
      if (!ok) return;
      bindMult(root, rerenderCurrent); bindUp(root, rerenderCurrent);
      const fs = { cash: () => F.cash.bind(root), dw0: () => F.dweller.bind(root, 0), dw1: () => F.dweller.bind(root, 1), faith: () => F.faith.bind(root), souls: () => F.souls.bind(root), cls: () => F.classes.bind(root) };
      root.querySelectorAll('.lab[data-f]').forEach(sec => { const key = sec.dataset.f; sec.querySelectorAll('input').forEach(inp => inp.onchange = () => { fs[key] && fs[key](); rerenderCurrent(); }); if (key === 'cls') fs.cls(); });
    };


    // ---------- "O que falta": notes, unlocks e relics que você ainda não tem ----------
    let META = {};
    const secText = (id, h) => { const e = BY[id]; const x = e && e.s.find(z => z.h === h); return x ? x.b.map(rich).join('<br>') : ''; };
    const bar = (cur, need) => { const r = need > 0 ? Math.min(1, cur / need) : 0; return `<span class="pbar"><i style="width:${(r * 100).toFixed(1)}%"></i></span> <span class="num">${fmt(cur)} / ${fmt(need)}</span>`; };
    const cropPath = (crop) => {
      const out = [];
      for (const [k, u] of Object.entries(S.upgrade.item)) u.effect.forEach(e => { if (e.type === 'farmSeed' && e.name === crop) { let lv = 1; for (let l = 1; l <= (u.cap ?? 40); l++) { try { if (e.value(l)) { lv = l; break; } } catch {} } out.push(`${link('upg:' + k)} nível ${lv} (você tem ${u.highestLevel})`); } });
      for (const [k, r] of Object.entries(S.relic.item)) { let eff = []; try { eff = r.effect(r.level || 1) || []; } catch {} if (eff.some(e => e.type === 'farmSeed' && e.name === crop)) out.push(`relic ${link('relic:' + k)}${r.found ? ' ✓' : ' — ' + (secText('relic:' + k, 'De onde vem') || 'fonte desconhecida')}`); }
      return out;
    };
    const noteHow = (key) => {
      const srcs = META.notes?.[key]?.sources || [];
      const parts = [];
      for (const sx of srcs) {
        let prog = '';
        try {
          if (sx.group === 'GL') prog = bar(S.meta.globalLevel, sx.sortKey);
          else if (sx.group === 'mining') prog = bar(S.stat.mining_maxDepth0.total, sx.sortKey + 1) + ' de profundidade';
          else if (sx.group === 'horde') prog = bar(S.stat.horde_maxZone.total, sx.sortKey + 1) + ' de zona';
          else if (sx.group === 'farm') {
            const crop = sx.crop || (sx.how.match(/colher (\w+)/) || [])[1];
            const c = S.farm.crop[crop];
            prog = c ? (c.found ? `Você já tem a semente de ${link('crop:' + crop)}: plante e colha uma vez.` : `Primeiro destrave a semente de ${link('crop:' + crop)}: ${cropPath(crop).join(' <b>ou</b> ') || 'fonte desconhecida'}.`) : '';
          } else if (sx.group === 'upgrade') {
            const uk = sx.upgrade || (sx.how.match(/`(\w+)`/) || [])[1]; const u = S.upgrade.item[uk];
            if (u) { let req = true; try { req = u.requirement(u.level); } catch {} let p = {}; try { p = u.price(0); } catch {} prog = `${req ? 'Já disponível para comprar' : 'Ainda bloqueado: ' + (secText('upg:' + uk, 'Como destrava') || '')}. Custo do nível 1: ${Object.entries(p).map(([c, v]) => fmt(v) + ' ' + curLink(c)).join(' + ') || '—'}.`; }
          } else if (sx.group === 'general') {
            const m = sx.general ? [null, sx.general, sx.quest, sx.stage] : sx.how.match(/General (\w+) · (\w+) · estágio (\d+)/); const qu = m && S.general[m[1]]?.quests[m[2]];
            if (qu) prog = `Questline ${link('quest:' + m[1] + '.' + m[2])}: você está no estágio ${qu.stage + 1} de ${qu.stages.length}; o note sai ao concluir o estágio ${m[3]}.`;
          }
        } catch {}
        parts.push(`<div>${sx.upgrade ? 'Comprar o 1º nível de ' + link('upg:' + sx.upgrade) : sx.general ? link('quest:' + sx.general + '.' + sx.quest) + ' · estágio ' + sx.stage : esc(sx.how)}${prog ? '<br>' + prog : ''}</div>`);
      }
      return parts.join('') || '<div>Não dá para pegar nesta versão do jogo.</div>';
    };
    // ---------- "O que falta": por feature, a partir do save ----------
    const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
    const ratio = (cur, need) => need > 0 ? Math.max(0, Math.min(1, cur / need)) : 0;
    const nm = (id) => BY[id]?.n || id.split(':').slice(1).join(':');
    const tryv = (f, d = null) => { try { return f(); } catch { return d; } };
    const priceHtml = (p) => Object.entries(p || {}).map(([c, v]) => { const have = S.currency[c]?.value ?? 0; return `${fmt(v)} ${curLink(c)}${have >= v ? ' ✓' : ''}`; }).join(' + ');
    const canPay = (p) => Object.entries(p || {}).every(([c, v]) => (S.currency[c]?.value ?? 0) >= v);
    const item = (id, how, pct = null, extra = '') => ({ id, name: nm(id), how, pct, extra });
    const group = (key, title, items, total, note = '') => ({ key, title, items, total, note });
    const statT = (k) => S.stat[k]?.total ?? 0;

    // unlock: como destrava + progresso numérico quando dá
    const unlockProg = (k) => {
      let best = null;
      for (const t of META.unlockTriggers?.[k] || []) {
        let m, cur = null, need = null, unit = '';
        if (t.source === 'globalLevel') { cur = S.meta.globalLevel; need = +t.detail.replace('GL ', ''); unit = ' GL'; }
        else if ((m = t.detail.match(/Horde maxZone total ([>=]+) (\d+)/))) { cur = statT('horde_maxZone'); need = +m[2] + (m[1] === '>' ? 1 : 0); unit = ' de zona'; }
        else if ((m = t.detail.match(/Mining maxDepth0 >= (\d+)/))) { cur = statT('mining_maxDepth0'); need = +m[1]; unit = ' m'; }
        else if (t.source === 'hordeBattlePass') { cur = tryv(() => G['horde/battlePassCurrentLevel'], 0); need = +t.detail.replace(/\D+/g, ''); unit = ' de battle pass'; }
        else if (t.source === 'hordeTower') { m = t.detail.match(/Torre (\w+) andar (\d+)/); if (m) { cur = S.horde.tower[m[1]]?.highest ?? 0; need = +m[2]; unit = ' andares'; } }
        else if (t.source === 'upgrade') { const [uk, , lv] = t.detail.split(' '); const u = S.upgrade.item[uk]; if (u) { cur = u.highestLevel; need = +lv; unit = ' níveis'; } }
        if (need !== null && (!best || ratio(cur, need) > best.r)) best = { r: ratio(cur, need), html: bar(cur, need) + unit };
      }
      return best;
    };
    const unlockItem = (k) => { const p = unlockProg(k); const lib = secText('unl:' + k, 'O que este unlock libera'); return item('unl:' + k, (secText('unl:' + k, 'Como destrava') || 'Sem gatilho nesta versão.') + (p ? '<br>' + p.html : ''), p ? p.r : null, lib ? `Libera: ${lib}` : ''); };
    const relicItem = (k) => { const eff = secText('relic:' + k, 'Efeitos'); return item('relic:' + k, secText('relic:' + k, 'De onde vem') || 'Fonte desconhecida.', null, eff ? `Dá: ${eff}` : ''); };
    const noteItem = (k) => item('note:' + k, noteHow(k), null);

    // upgrades nunca comprados de uma feature
    const upgradeGroups = (f) => {
      const types = { regular: 'Upgrades', building: 'Buildings', prestige: 'Prestige upgrades', premium: 'Premium upgrades', shape: 'Shape upgrades' };
      const out = [];
      for (const [t, title] of Object.entries(types)) {
        const all = Object.entries(S.upgrade.item).filter(([, u]) => u.feature === f && u.type === t);
        if (!all.length) continue;
        const miss = all.filter(([, u]) => !(u.highestLevel > 0 || u.level > 0 || u.bought > 0)).map(([k, u]) => {
          const req = tryv(() => u.requirement(u.level), true);
          const p = tryv(() => u.price(u.bought), {});
          if (req) return item('upg:' + k, `Já disponível. Custo do nível 1: ${priceHtml(p) || '—'}${canPay(p) ? ' — <b class="up">dá para comprar agora</b>' : ''}`, canPay(p) ? 1 : 0.99);
          let prog = null;
          if (u.requirementStat && u.requirementValue !== null) {
            const cur = u.requirementStat === 'farm_seedBox' ? S.upgrade.item.farm_seedBox.highestLevel : u.requirementStat === 'custom_hordeBattlepass' ? tryv(() => G['horde/battlePassCurrentLevel'], 0) : statT(u.requirementStat);
            prog = { r: ratio(cur, u.requirementValue), html: bar(cur, u.requirementValue) };
          }
          return item('upg:' + k, (secText('upg:' + k, 'Como destrava') || 'Bloqueado.') + (prog ? '<br>' + prog.html : ''), prog ? prog.r * 0.98 : 0);
        });
        out.push(group('upg-' + t, `${title} nunca comprados`, miss, all.length, t === 'regular' || t === 'building' ? 'Requisitos usam o recorde de todos os tempos.' : ''));
      }
      return out;
    };
    const metaGroups = (f, notesF, relF, unlF) => {
      const notes = Object.entries(S.note).filter(([k, n]) => notesF(n.feature, k));
      const unl = Object.entries(S.unlock).filter(([k]) => k !== 'debugFeature' && unlF(BY['unl:' + k]?.f || 'meta', k));
      const rel = Object.entries(S.relic.item).filter(([k]) => relF(BY['relic:' + k]?.f || 'meta', k));
      return [
        group('unl', 'Unlocks', unl.filter(([, u]) => !u.see).map(([k]) => unlockItem(k)), unl.length),
        group('relic', 'Relics', rel.filter(([, r]) => !r.found).map(([k]) => relicItem(k)), rel.length),
        group('note', 'Notes', notes.filter(([, n]) => !n.found).map(([k]) => noteItem(k)), notes.length),
      ];
    };
    const MAIN = ['mining', 'village', 'horde', 'farm', 'gallery'];

    const builders = {
      mining: () => {
        const gs = [];
        const d0 = statT('mining_maxDepth0'), d1 = statT('mining_maxDepth1');
        const ores = Object.entries(S.mining.ingredient);
        gs.push(group('ore', 'Ores nunca obtidos', ores.filter(([k]) => statT('mining_' + k) <= 0).map(([k, o]) => item('cur:mining_' + k, `Aparece a partir de ${o.minDepth} m na Ore mine.<br>${bar(d0, o.minDepth)} de profundidade recorde`, ratio(d0, o.minDepth))), ores.length));
        const RARE = [['granite', 50, 'camada já quebrada ≥ 1000 vezes', 0], ['salt', 70, 'camada com exatamente 1 tipo de ore', 0], ['coal', 90, '1ª quebra da camada', 0], ['sulfur', 110, '1ª quebra da camada', 0], ['niter', 130, 'quebras da camada = 1, 10, 100…', 0], ['obsidian', 150, 'sem enhancements ativos', 0], ['deeprock', 275, 'soma dos dígitos da profundidade ≥ 14', 0], ['limestone', 2, 'profundidade prima (Gas giant)', 1], ['moonshard', 20, 'até a profundidade do dweller (Gas giant)', 1], ['phosphorus', 150, 'profundidade múltipla de 25 (Gas giant)', 1]];
        gs.push(group('rare', 'Rare earth nunca obtidos', RARE.filter(([k]) => S.currency['mining_' + k] && statT('mining_' + k) <= 0).map(([k, d, how, sub]) => item('cur:mining_' + k, `${how}, a partir de ${d} m.<br>${bar(sub ? d1 : d0, d)} m recorde${sub ? ' no Gas giant' : ''}`, ratio(sub ? d1 : d0, d))), RARE.filter(([k]) => S.currency['mining_' + k]).length));
        const gas = Object.entries(S.mining.gas);
        gs.push(group('gas', 'Gases nunca obtidos', gas.filter(([k]) => statT('mining_' + k) <= 0).map(([k, d]) => item('cur:mining_' + k, `Primeira quebra de cada camada nova no Gas giant a partir de ${d} m.<br>${bar(d1, d)} m recorde no Gas giant`, ratio(d1, d))), gas.length));
        const sm = Object.entries(S.mining.smeltery);
        const temp = tryv(() => G['mult/get']('miningSmelteryTemperature'), 0);
        gs.push(group('bar', 'Barras nunca fundidas', sm.filter(([, v]) => statT(v.output) <= 0).map(([k, v]) => { const p = tryv(() => v.price(0), {}); return item('smelt:' + k, `Smeltery: ${priceHtml(p)}. Temperatura mínima ${v.minTemperature}° (você tem ${fmt(temp)}°).`, ratio(temp, v.minTemperature)); }), sm.length));
        const bc = Object.entries(S.mining.beacon);
        gs.push(group('beacon', 'Beacons sem nenhum', bc.filter(([, b]) => (tryv(() => G['mult/get'](b.ownedMult), 0) || 0) <= 0).map(([k]) => item('beacon:' + k, secText('beacon:' + k, 'O que é') + (secText('mult:' + S.mining.beacon[k].ownedMult, 'Afetado por') ? '<br>Fontes: ' + secText('mult:' + S.mining.beacon[k].ownedMult, 'Afetado por') : ''))), bc.length));
        return gs;
      },
      village: () => {
        const gs = [];
        const housing = Object.entries(S.upgrade.item).filter(([, u]) => u.feature === 'village' && u.subtype === 'housing');
        gs.push(group('house', 'Moradias abaixo do nível 25 (GL)', housing.filter(([, u]) => u.level < 25).map(([k, u]) => item('upg:' + k, `Cada nível até 25 vale +1 GL (conta o nível desta run; o GL guarda o recorde da soma).<br>${bar(u.level, 25)}`, ratio(u.level, 25))), housing.length, `GL atual da parte Workers: ${S.meta.globalLevelParts.village_0 ?? 0} / 250.`));
        const cr = Object.entries(S.village.crafting);
        gs.push(group('recipe', 'Receitas não liberadas', cr.filter(([, c]) => !c.unlocked).map(([k]) => item('craft:' + k, secText('craft:' + k, 'Mencionado por') || 'Liberada por milestone de outra receita.')), cr.length));
        const ms = [];
        let msTot = 0;
        for (const [k, c] of cr) { for (const [n] of Object.entries(c.milestone || {})) { msTot++; if (c.crafted < +n) ms.push(item('craft:' + k, `Próximo milestone: ${fmt(+n)} crafts (+1 GL).<br>${bar(c.crafted, +n)}${c.unlocked ? '' : ' — receita ainda bloqueada'}`, ratio(c.crafted, +n))); } }
        gs.push(group('ms', 'Milestones de crafting (cada um = +1 GL)', ms, msTot, `GL atual da parte Crafting: ${S.meta.globalLevelParts.village_1 ?? 0} / ${msTot}.`));
        const of = Object.entries(S.village.offering);
        gs.push(group('offer', 'Offerings não liberadas', of.filter(([, o]) => !S.unlock[o.unlock]?.see).map(([k, o]) => item('offer:' + k, `Exige ${link('unl:' + o.unlock)}: ${secText('unl:' + o.unlock, 'Como destrava')}`, unlockProg(o.unlock)?.r ?? null)), of.length));
        return gs;
      },
      horde: () => {
        const gs = [];
        const zt = statT('horde_maxZone');
        const it = Object.entries(S.horde.items);
        gs.push(group('equip', 'Equipamentos nunca encontrados', it.filter(([, v]) => !v.found).map(([k, v]) => item('equip:' + k, v.unlock ? `Exige ${link('unl:' + v.unlock)}.${S.unlock[v.unlock]?.see ? ' (já liberado: cai na Horde)' : ''}` : `Cai a partir da zona ${v.findZone} (chance ${fmt(v.findChance * 100)}% por inimigo).<br>${bar(zt, v.findZone)} de zona recorde`, v.unlock ? (S.unlock[v.unlock]?.see ? 0.9 : 0) : ratio(zt, v.findZone))), it.length));
        const mreq = (k, l) => tryv(() => G['horde/masteryRequired'](k, l), null);
        gs.push(group('mastery', 'Mastery abaixo do nível 5', it.filter(([, v]) => v.found && v.masteryLevel < 5).map(([k, v]) => { const need = mreq(k, v.masteryLevel); return item('equip:' + k, `Mastery ${v.masteryLevel}/5. Ganha pontos equipado em zona ≥ 75 (bosses e rare loot).${need ? '<br>' + bar(v.masteryPoint, need) + ' pontos para o próximo nível' : ''}`, (v.masteryLevel + (need ? ratio(v.masteryPoint, need) : 0)) / 5); }), it.filter(([, v]) => v.found).length, 'Mastery 1 mantém o item no prestige; 3 mantém o nível.'));
        const he = Object.entries(S.horde.heirloom);
        gs.push(group('heir', 'Heirlooms nunca encontrados', he.filter(([, h]) => !(h.amount > 0)).map(([k, h]) => { const tw = Object.entries(S.horde.tower).find(([, t]) => (t.heirlooms || []).includes(k)); const z = Math.max(31, h.minZone || 0); return item('heir:' + k, tw ? `Só nas torres: ${link('tower:' + tw[0])}.` : `Rare loot a partir da zona ${z}.<br>${bar(zt, z)} de zona recorde`, tw ? null : ratio(zt, z)); }), he.length));
        const tw = Object.entries(S.horde.tower);
        const twItems = [];
        for (const [k, t] of tw) {
          if (!S.unlock[t.unlock]?.see) { const p = unlockProg(t.unlock); twItems.push(item('tower:' + k, `Torre bloqueada: ${secText('unl:' + t.unlock, 'Como destrava')}${p ? '<br>' + p.html : ''}`, p ? p.r * 0.5 : 0)); continue; }
          const next = Object.keys(t.reward).map(Number).sort((a, b) => a - b).find(fl => fl > t.highest);
          if (next) twItems.push(item('tower:' + k, `Próxima recompensa no andar ${next}: ${secText('tower:' + k, 'Recompensas por andar').split('<br>').find(x => x.startsWith('Andar ' + next + ':'))?.replace(/^Andar \d+: /, '') || ''}<br>${bar(t.highest, next)} andar mais alto`, ratio(t.highest, next)));
        }
        gs.push(group('tower', 'Torres: próximas recompensas', twItems, tw.length));
        const cl = Object.entries(S.horde.fighterClass);
        gs.push(group('class', 'Quests de classe restantes (battle pass)', cl.filter(([, c]) => !c.unlock || S.unlock[c.unlock]?.see).map(([k, c]) => { const left = ['stat', 'zone', 'level', 'boss'].map(q => [q, (c.quests[q]?.length || 0) - (c.questsCompleted[q] || 0)]); const tot = left.reduce((a, [q, n]) => a + n * (q === 'boss' ? 2 : 1), 0); const all = ['stat', 'zone', 'level', 'boss'].reduce((a, q) => a + (c.quests[q]?.length || 0) * (q === 'boss' ? 2 : 1), 0); return tot > 0 ? item('class:' + k, `Faltam ${left.filter(([, n]) => n > 0).map(([q, n]) => `${n} ${q}`).join(', ')} (= ${tot} níveis de battle pass).`, ratio(all - tot, all)) : null; }).filter(Boolean), cl.length, `Battle pass atual: ${tryv(() => G['horde/battlePassCurrentLevel'], 0)}.`));
        const tr = Object.entries(S.horde.trinket);
        gs.push(group('trinket', 'Trinkets nunca obtidos', tr.filter(([, t]) => !(t.amount > 0)).map(([k]) => item('trinket:' + k, 'Cai de bosses na Horde (Classes).')), tr.length));
        return gs;
      },
      farm: () => {
        const gs = [];
        const crops = Object.entries(S.farm.crop);
        gs.push(group('seed', 'Sementes não liberadas', crops.filter(([, c]) => !c.found).map(([k]) => { const paths = cropPath(k); return item('crop:' + k, paths.join(' <b>ou</b> ') || 'Fonte desconhecida.'); }), crops.length));
        const glOf = (c) => { const l = Math.max(c.level, c.levelMax); return Math.min(l, Math.floor(l / 2) + 5, 25); };
        const reg = crops.filter(([, c]) => c.type !== 'special' && c.found);
        gs.push(group('cropgl', 'Crops abaixo de 25 GL', reg.filter(([, c]) => glOf(c) < 25).map(([k, c]) => item('crop:' + k, `GL desta crop ${glOf(c)}/25 (nível ${Math.max(c.level, c.levelMax)}; 25 GL no nível 40).<br>${bar(glOf(c), 25)}`, glOf(c) / 25)), reg.length, `GL atual da Farm: ${S.meta.globalLevelParts.farm_0 ?? 0}.`));
        { const ready = crops.filter(([, c]) => c.level >= 4 && c.level > c.levelMax); gs.push(Object.assign(group('prest', 'Prontas para prestigiar acima do recorde', ready.map(([k, c]) => item('crop:' + k, `Nível ${c.level}, recorde ${c.levelMax}: prestigiar agora dá ×${fmt(Math.pow(1.04, c.level - c.levelMax), 3)} em crop gain.`, 1)), crops.length, 'Ação disponível agora, não pendência. Lembre de selecionar cards da crop antes.'), { info: true })); }
        const fb = Object.entries(S.farm.building);
        gs.push(group('fbuild', 'Farm buildings que você não tem', fb.filter(([, b]) => !(b.max > 0)).map(([k]) => item('fbuild:' + k, secText('fbuild:' + k, 'Mencionado por') || 'Liberado por upgrade.')), fb.length));
        const cons = Object.entries(S.consumable).filter(([k]) => k.startsWith('farm_'));
        gs.push(group('fert', 'Fertilizantes não liberados', cons.filter(([, c]) => !c.found).map(([k]) => item('cons:' + k, secText('cons:' + k, 'Mencionado por') || 'Liberado por upgrade.')), cons.length));
        return gs;
      },
      gallery: () => {
        const gs = [];
        const colors = S.gallery.color.filter(c => S.currency['gallery_' + c] && str2(c));
        gs.push(group('color', 'Cores nunca produzidas', colors.filter(c => statT('gallery_' + c) <= 0).map(c => { const i = S.gallery.color.indexOf(c); const from = i < 1 ? 'beauty' : S.gallery.color[i - 1]; const p = tryv(() => G['gallery/conversionPrice'](c), {}); const fromHave = statT('gallery_' + from) > 0; return item('cur:gallery_' + c, `${fromHave ? 'Converter a partir de ' : 'Primeiro produza '}${curLink('gallery_' + from)}. Custo da conversão: ${priceHtml(p)}.`, fromHave ? 0.8 : 0); }), colors.length, 'Cada cor nova costuma liberar upgrades.'));
        const ideas = Object.entries(S.gallery.idea);
        gs.push(group('idea', 'Ideias não liberadas', ideas.filter(([, v]) => !v.owned).map(([k]) => item('idea:' + k, secText('idea:' + k, 'Mencionado por') || 'Liberada por upgrade.')), ideas.length));
        const sh = Object.entries(S.gallery.shape);
        gs.push(group('shape', 'Shapes não liberadas', sh.filter(([, v]) => !v.unlocked).map(([k]) => item('shape:' + k, secText('shape:' + k, 'Mencionado por') || 'Liberada por upgrade.')), sh.length));
        return gs;
      },
      cards: () => {
        const gs = [];
        for (const f of Object.keys(S.card.feature)) {
          const cs = Object.entries(S.card.card).filter(([, c]) => c.feature === f);
          gs.push(group('card-' + f, nm('feat:' + f), cs.filter(([, c]) => !(c.amount > 0)).map(([id, c]) => { const packs = Object.entries(S.card.pack).filter(([, p]) => p.content[id]); const open = packs.filter(([, p]) => !p.unlock || S.unlock[p.unlock]?.see); const best = Math.max(0, ...open.map(([, p]) => p.content[id] / p.cacheWeightTotal * p.amount)); return item('card:' + id, packs.length ? packs.map(([p, pk]) => `${link('pack:' + p)} ${(pk.content[id] / pk.cacheWeightTotal * 100).toFixed(1)}%/carta${pk.unlock && !S.unlock[pk.unlock]?.see ? ' (pack bloqueado)' : ''}`).join(' · ') + (best ? `<br>~${fmt(1 / best, 1)} packs em média para achar` : '') : (secText('card:' + id, 'De onde vem') || 'Sem fonte.'), best ? Math.min(1, best * 5) : 0); }), cs.length));
        }
        const cols = Object.entries(S.card.collection);
        gs.push(group('col', 'Coleções incompletas', cols.filter(([, c]) => c.cacheCards < c.cards.length).map(([k, c]) => item('col:' + k, `${c.cacheCards}/${c.cards.length} cartas. Ao completar: ${secText('col:' + k, 'Bônus ao completar') || '—'}<br>${bar(c.cacheCards, c.cards.length)}`, ratio(c.cacheCards, c.cards.length))), cols.length));
        if (S.unlock.cardShiny?.see) { const all = Object.values(S.card.card).filter(c => c.feature !== 'event' && c.feature !== 'gem'); gs.push(group('shiny', 'Cards sem versão shiny', Object.entries(S.card.card).filter(([, c]) => c.feature !== 'event' && c.feature !== 'gem' && c.amount > 0 && !c.foundShiny).map(([id]) => item('card:' + id, 'Abra o pack dela (1,5% por carta) ou use o shiny pack (garante uma shiny nova).')), all.length)); }
        return gs;
      },
      meta: () => {
        const gs = [];
        const ach = Object.entries(S.achievement);
        gs.push(group('ach', 'Achievements: próximo nível', ach.filter(([, a]) => a.cap === null || a.level < a.cap).map(([k, a]) => { const v = tryv(() => a.value(), 0), need = tryv(() => a.milestones(a.level), 0); const rel = a.relic?.[a.level]; return item('ach:' + k, `Nível ${a.level}${a.cap ? '/' + a.cap : ''}.${rel ? ` Próximo nível dá a relic ${link('relic:' + rel)}.` : ''}<br>${bar(v, need)}`, ratio(v, need)); }), ach.length, 'Cada nível acelera a geração de gems.'));
        const books = Object.entries(S.school.book);
        gs.push(group('book', 'Livros que você não tem', books.filter(([, b]) => !b.owned).map(([k, b]) => { const part = S.meta.globalLevelParts[b.feature + '_' + b.subfeature] ?? 0; return item('book:' + k, `${nm('feat:' + b.feature)}: aparece com ${b.minGL} de GL nessa parte.<br>${bar(part, b.minGL)}`, ratio(part, b.minGL)); }), books.length));
        const qs = [];
        let qTot = 0;
        for (const [g, gen] of Object.entries(S.general)) for (const [q, qu] of Object.entries(gen.quests)) {
          qTot++;
          if (qu.stage >= qu.stages.length) continue;
          const locked = (gen.unlock && !S.unlock[gen.unlock]?.see) || (qu.unlock && !S.unlock[qu.unlock]?.see);
          const raw = DATA_GBF[g]?.quests?.[q]?.stages?.[qu.stage];
          const tasks = qu.stages[qu.stage].tasks.map((t, i) => { const r = evalTask(t); return `${r.ok ? '✓' : '○'} ${esc(raw?.tasks?.[i] || t.name)} <span class="key">(agora: ${typeof r.cur === 'boolean' ? (r.cur ? 'sim' : 'não') : fmt(r.cur)})</span>`; });
          qs.push(item('quest:' + g + '.' + q, locked ? `Bloqueada: exige ${link('unl:' + (qu.unlock || gen.unlock))}.` : `Estágio ${qu.stage + 1}/${qu.stages.length}${raw?.isChallenge ? ' ⚔ (dentro de uma run)' : ''}:<br>${tasks.join('<br>')}`, locked ? 0 : ratio(qu.stage, qu.stages.length)));
        }
        gs.push(group('quest', 'Questlines incompletas', qs, qTot));
        return gs.concat(metaGroups(null, (f) => !MAIN.includes(f), (f) => !MAIN.includes(f), (f) => !MAIN.includes(f)));
      },
    };
    const str2 = (c) => !!BY['cur:gallery_' + c] && !BY['cur:gallery_' + c].nui;
    const TABS = [['resumo', 'Resumo'], ['mining', null], ['village', null], ['horde', null], ['farm', null], ['gallery', null], ['cards', null], ['meta', 'Outros']];
    const tabTitle = (k) => k === 'cards' ? nm('feat:card') : (TABS.find(t => t[0] === k)[1] || nm('feat:' + k));
    const buildTab = (k) => {
      const gs = builders[k]();
      if (MAIN.includes(k)) gs.unshift(...upgradeGroups(k), ...metaGroups(k, (f) => f === k, (f) => f === k, (f) => f === k));
      return gs.filter(g => g.total > 0);
    };
    const renderItems = (g) => {
      const items = g.items.slice().sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || natural(a.name, b.name));
      return items.map(it => `<article class="miss-item"><h4>${link(it.id)}${it.pct !== null && it.pct >= 0.9 ? ' <span class="tag near">perto</span>' : ''}</h4><div>${it.how}</div>${it.extra ? `<div class="hint">${it.extra}</div>` : ''}</article>`).join('');
    };
    const missingPage = (tab = 'resumo') => {
      if (!ok) return '<p>Calculadoras indisponíveis.</p>';
      const saveInfo = info();
      if (!saveInfo) return `<div class="crumbs"><span class="tag">Ferramenta</span></div><h2>O que falta</h2><div class="banner">Carregue seu save no painel à esquerda para ver o que falta em cada feature.</div>`;
      if (!TABS.some(t => t[0] === tab)) tab = 'resumo';
      const built = {}; for (const [k] of TABS) if (k !== 'resumo') built[k] = tryv(() => buildTab(k), []);
      const missCount = (k) => built[k].reduce((a, g) => a + (g.info ? 0 : g.items.length), 0);
      const tabs = TABS.map(([k]) => `<button type="button" role="tab" class="cat" aria-pressed="${k === tab}" data-tab="${k}">${esc(tabTitle(k))}${k !== 'resumo' ? ` (${missCount(k)})` : ''}</button>`).join('');
      let body;
      if (tab === 'resumo') {
        body = `<div class="tbl"><table><thead><tr><th>Feature</th><th>Categoria</th><th>Falta</th><th>Progresso</th></tr></thead><tbody>${TABS.filter(t => t[0] !== 'resumo').map(([k]) => built[k].map((g, i) => `<tr>${i === 0 ? `<td rowspan="${built[k].length}"><a class="x" href="#missing" data-goto="${k}">${esc(tabTitle(k))}</a></td>` : ''}<td>${esc(g.title)}</td><td class="num">${g.info ? g.items.length + ' prontas' : g.items.length + ' de ' + g.total}</td><td>${g.info ? '' : bar(g.total - g.items.length, g.total)}</td></tr>`).join('')).join('')}</tbody></table></div>`;
        const near = [];
        for (const [k] of TABS) if (k !== 'resumo') for (const g of built[k]) if (!g.info) for (const it of g.items) if (it.pct !== null && it.pct >= 0.9 && it.pct < 1) near.push({ k, g, it });
        near.sort((a, b) => b.it.pct - a.it.pct);
        if (near.length) body = `<h3 class="mh">Mais perto de sair (${near.length})</h3><div class="miss-list">${near.slice(0, 40).map(({ k, g, it }) => `<article class="miss-item"><h4>${link(it.id)} <span class="key">${esc(tabTitle(k))} · ${esc(g.title)}</span></h4><div>${it.how}</div></article>`).join('')}</div><h3 class="mh">Tudo</h3>` + body;
      } else {
        body = built[tab].map(g => `<details class="mgroup"${g.items.length && g.items.length <= 25 ? ' open' : ''}><summary><b>${esc(g.title)}</b> ${g.info ? `<span class="num">${g.items.length} prontas</span>` : `<span class="num">faltam ${g.items.length} de ${g.total}</span> ${bar(g.total - g.items.length, g.total)}`}</summary>${g.note ? `<p class="hint">${g.note}</p>` : ''}<div class="miss-list">${g.items.length ? renderItems(g) : '<p class="hint">Completo.</p>'}</div></details>`).join('');
      }
      return `<div class="crumbs"><span class="tag">Ferramenta</span></div><h2>O que falta</h2>
        <p class="hint">${saveInfo.live ? 'Do seu jogo ao vivo' : 'Do seu save'} (GL ${saveInfo.gl}). Cada item mostra como pegar e o seu progresso; os mais perto aparecem primeiro. Nomes como na interface do jogo.</p>
        <div class="tabs" role="tablist">${tabs}</div>
        <label class="fld miss-filter"><span>Filtrar</span><input class="ni" id="missq" type="search" placeholder="ex.: Farm #21, Golden rose, zona"></label>
        ${body}`;
    };

    // ---------- save loading ----------
    // O motor sobe uma vez por página: com o save guardado (igual ao jogo, sem tempo offline) ou como jogo novo.
    const KEY = 'gooboo-codex-save';
    const loadSave = (str) => {
      const t = str.trim();
      let f; try { f = JSON.parse(t[0] === '{' ? t : atob(t)); } catch { throw new Error('Não consegui ler esse texto como save do Gooboo.'); }
      if (!f || !f.version || !f.timestamp) throw new Error('Isso não parece um save do Gooboo (faltam versão/timestamp).');
      try { localStorage.setItem(KEY, t); } catch { throw new Error('O navegador bloqueou o armazenamento local, então não dá para carregar o save aqui.'); }
      location.reload();
    };
    const clearSave = () => { try { localStorage.removeItem(KEY); } catch {} location.reload(); };
    let bootError = null;
    const init = (gbf, meta) => {
      DATA_GBF = gbf || {}; META = meta || {};
      if (!ok) return;
      if (GB.live) return; // jogo ao vivo: lê a store do próprio jogo, sem save guardado
      let saved = null; try { saved = localStorage.getItem(KEY); } catch {}
      try {
        const f = GB.boot(saved);
        if (f) saveInfo = { gl: S.meta.globalLevel, ts: f.timestamp, version: f.version };
      } catch (e) {
        bootError = e.message; try { localStorage.removeItem(KEY); } catch {}
        try { GB.boot(null); } catch {}
      }
    };
    function info() { return GB && GB.live ? { gl: S.meta.globalLevel, live: true } : saveInfo; }
    return { ok, missingPage, forEntry, bindEntry, loadSave, clearSave, init, info, error: () => bootError, fmt, time };
  })();


  // ---------- busca ----------
  let activeCat = null; let currentId = null; let currentRoute = null;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const INDEX = DATA.map(e => ({e, n: norm(e.n), k: norm(e.k), c: norm(e.c), d: norm(e.d)}));
  function search(q){
    const nq = norm(q.trim());
    let rows = INDEX.filter(r => !activeCat || r.e.c === activeCat);
    if (!nq) return rows.map(r => r.e).sort((a,b) => a.n.localeCompare(b.n, undefined, {numeric: true}));
    const scored = [];
    for (const r of rows) {
      let sc = 0;
      if (r.n === nq) sc = 100; else if (r.n.startsWith(nq)) sc = 80; else if (r.n.includes(nq)) sc = 60;
      else if (r.k.includes(nq)) sc = 40; else if (r.d.includes(nq)) sc = 15; else if (r.c.includes(nq)) sc = 10;
      if (sc) scored.push([sc + (r.e.c === 'Conceito' || r.e.c === 'Moeda' || r.e.c === 'Gema' ? 5 : 0), r.e]);
    }
    return scored.sort((a,b) => b[0]-a[0] || a[1].n.localeCompare(b[1].n, undefined, {numeric: true})).map(x => x[1]);
  }
  const listEl = $('list'), countEl = $('count'), qEl = $('q');
  function renderList(){
    const res = search(qEl.value); const shown = res.slice(0, 400);
    countEl.textContent = `${res.length.toLocaleString('pt-BR')} verbetes${res.length > 400 ? ' · mostrando 400' : ''}`;
    listEl.innerHTML = shown.map(e => `<li><button type="button" data-id="${esc(e.id)}"${e.id === currentId ? ' aria-current="true"' : ''}><span class="dot" style="background:${swatch(e) || featColor(e.f)}"></span><span class="nm">${esc(e.n)}</span><span class="ct">${esc(e.c)}</span></button></li>`).join('');
  }
  listEl.addEventListener('click', ev => { const b = ev.target.closest('button[data-id]'); if (b) go(b.dataset.id); });
  let t; qEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderList, 80); });
  qEl.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') { const r = search(qEl.value)[0]; if (r) go(r.id); } });
  const catsEl = $('cats');
  function renderCats(){
    catsEl.innerHTML = [`<button type="button" class="cat" aria-pressed="${!activeCat}" data-c="">Tudo</button>`].concat(cats.map(c => `<button type="button" class="cat" aria-pressed="${activeCat === c}" data-c="${esc(c)}">${esc(c)}</button>`)).join('');
  }
  catsEl.addEventListener('click', ev => { const b = ev.target.closest('button[data-c]'); if (!b) return; activeCat = b.dataset.c || null; lsSet('cat', activeCat || ''); renderCats(); renderList(); });

  // ---------- páginas ----------
  const pageEl = $('page'), mainEl = $('main'), appEl = $('app');
  let dirty = false; // o usuário mexeu numa calculadora desta página → não sobrescrever com valores ao vivo
  pageEl.addEventListener('input', () => { dirty = true; });
  function renderEntry(e){
    const fc = featColor(e.f), sw = swatch(e);
    const back = [...(BACK[e.id] || [])].map(id => BY[id]).filter(Boolean).sort((a,b) => a.c.localeCompare(b.c) || a.n.localeCompare(b.n, undefined, {numeric: true}));
    pageEl.innerHTML = `
      <button type="button" class="back-btn" id="toList">← Índice</button>
      <div class="crumbs"><span class="tag">${esc(e.c)}</span>${FEAT_NAMES[e.f] ? `<a class="tag f" style="background:${fc}" href="#feat~${esc(e.f)}">${esc(FEAT_NAMES[e.f])}</a>` : ''}</div>
      <h2>${sw ? `<span class="swatch" style="background:${sw}" title="cor no jogo: ${esc(e.col)}"></span>` : ''}${esc(e.n)}</h2>
      <div class="key">internal id: <button type="button" id="copyKey" title="Copy">${esc(e.k)}</button>${e.nui ? ' · descriptive name (the game shows no name for this)' : ''}</div>
      ${sectionsHTML(e)}
      ${back.length ? `<details class="back"${back.length <= 12 ? ' open' : ''}><summary>Appears in ${back.length} entr${back.length > 1 ? 'ies' : 'y'}</summary><ul>${back.slice(0, 300).map(b => `<li><a class="x" href="#${tok(b.id)}">${esc(b.n)}</a> <span class="key">${esc(b.c)}</span></li>`).join('')}</ul></details>` : ''}`;
    $('copyKey').onclick = ev => { navigator.clipboard?.writeText(e.k).then(() => ev.target.textContent = 'copied ✓', () => {}); };
    $('toList').onclick = () => { appEl.classList.remove('reading'); };
    try { LAB.bindEntry(pageEl); } catch (err) { console.warn('[Codex]', err); }
  }
  // Order: What it is (game text inside) → How to get it → What it does → How it's calculated → affected by → calculators → groups
  function sectionsHTML(e){
    const sec = s => `<section class="s"><h3>${esc(s.h)}</h3><ul>${s.b.map(b => `<li>${rich(b)}</li>`).join('')}</ul></section>`;
    const desc = e.d ? `<div class="desc"><small>Game text</small>${rich(e.d)}</div>` : '';
    const isGroup = s => /^(Groups|Grupos|Grupo)$/.test(s.h);
    const main = e.s.filter(s => !isGroup(s)), tail = e.s.filter(isGroup);
    let html = '';
    if (main.length && /^(What it is|O que é)$/.test(main[0].h)) html += `<section class="s"><h3>${esc(main[0].h)}</h3>${desc}<ul>${main[0].b.map(b => `<li>${rich(b)}</li>`).join('')}</ul></section>` + main.slice(1).map(sec).join('');
    else html += desc + main.map(sec).join('');
    return html + labHTML(e) + tail.map(sec).join('');
  }
  function labHTML(e){ try { return LAB.forEntry(e); } catch (err) { console.warn('[Codex]', err); return `<p class="hint">Calculadora indisponível para este verbete (${esc(err.message)}).</p>`; } }
  function rerenderCurrent(){ if (!currentId) return; const y = mainEl.scrollTop; renderEntry(BY[currentId]); mainEl.scrollTop = y; }
  function renderHome(){
    const counts = {}; DATA.forEach(e => counts[e.c] = (counts[e.c] || 0) + 1);
    const starts = ['concept:tick','concept:gl','concept:prestige','concept:events','concept:mult','concept:overcap','concept:dweller','concept:cards','concept:general','concept:cryolab','feat:mining','feat:village','feat:horde','feat:farm','feat:gallery'].filter(id => BY[id]);
    const info = LAB.info();
    pageEl.innerHTML = `<div class="home">
      <button type="button" class="back-btn" id="toList">← Índice</button>
      <h2>Gooboo Codex</h2>
      <p>Todos os termos do jogo com o nome que aparece na interface: o que é, de onde vem, como destrava e o que afeta o valor. Clique em qualquer nome sublinhado para navegar.</p>
      ${LAB.ok ? `<div class="banner">${info && info.live ? `Lendo <b>o seu jogo ao vivo</b> (GL ${info.gl}). Toda moeda, estatística e upgrade tem uma calculadora; as features têm o planejador de run. O Codex só lê o jogo, nunca altera nada.` : 'Jogo não encontrado.'}</div>` : ''}
      <div class="start" style="margin-top:14px"><a href="#missing">O que falta em cada feature (notes, unlocks, upgrades, cards…)</a></div>
      <h3 style="font:800 20px var(--f-display);margin:20px 0 6px">Planejar a próxima run</h3>
      <div class="start">${['mining','village','horde','farm','gallery'].map(f => `<a href="#feat~${f}">${esc(FEAT_NAMES[f] || f)}</a>`).join('')}</div>
      <h3 style="font:800 20px var(--f-display);margin:20px 0 6px">Comece por</h3>
      <div class="start">${starts.map(id => `<a href="#${tok(id)}">${esc(BY[id].n)}</a>`).join('')}</div>
      <div class="grid">${cats.map(c => `<button type="button" class="tile" data-c="${esc(c)}"><b>${esc(c)}</b><span>${counts[c]} verbetes</span></button>`).join('')}</div></div>`;
    pageEl.querySelectorAll('.tile').forEach(b => b.onclick = () => { activeCat = b.dataset.c; renderCats(); renderList(); qEl.focus(); appEl.classList.remove('reading'); });
    $('toList').onclick = () => appEl.classList.remove('reading');
  }
  let missTab = lsGet('miss') || 'resumo';
  function renderMissing(){
    const prevQ = $('missq')?.value || '';
    pageEl.innerHTML = '<button type="button" class="back-btn" id="toList">← Índice</button>' + LAB.missingPage(missTab);
    $('toList').onclick = () => appEl.classList.remove('reading');
    pageEl.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { missTab = b.dataset.tab; renderMissing(); });
    pageEl.querySelectorAll('[data-goto]').forEach(a => a.onclick = ev => { ev.preventDefault(); missTab = a.dataset.goto; renderMissing(); mainEl.scrollTop = 0; });
    lsSet('miss', missTab);
    const f = $('missq');
    if (f) {
      f.oninput = () => { const q = norm(f.value); pageEl.querySelectorAll('.miss-item').forEach(a => { a.hidden = q && !norm(a.textContent).includes(q); }); pageEl.querySelectorAll('details.mgroup').forEach(d => { if (q) d.open = [...d.querySelectorAll('.miss-item')].some(x => !x.hidden); }); };
      f.onkeydown = ev => ev.stopPropagation();
      if (prevQ) { f.value = prevQ; f.oninput(); }
    }
  }

  // ---------- navegação interna (não mexe no endereço da página do jogo) ----------
  const hist = [];
  function show(id, push = true){
    if (push && currentRoute !== null && currentRoute !== id) hist.push(currentRoute);
    if (hist.length > 100) hist.shift();
    currentRoute = id; dirty = false;
    lsSet('route', id || '');
    $('backBtn').disabled = !hist.length;
    if (id === 'missing') { currentId = null; renderMissing(); appEl.classList.add('reading'); mainEl.scrollTop = 0; return; }
    const e = BY[id];
    currentId = e ? id : null;
    if (e) { renderEntry(e); appEl.classList.add('reading'); } else renderHome();
    mainEl.scrollTop = 0;
    listEl.querySelectorAll('button[aria-current]').forEach(b => b.removeAttribute('aria-current'));
    const cur = listEl.querySelector(`button[data-id="${CSS.escape(id || '')}"]`); if (cur) cur.setAttribute('aria-current', 'true');
  }
  function go(id){ show(id); }
  function back(){ if (!hist.length) return; show(hist.pop(), false); }
  appEl.addEventListener('click', ev => {
    const a = ev.target.closest('a[href^="#"]'); if (!a) return;
    ev.preventDefault();
    const h = a.getAttribute('href').slice(1);
    if (h) go(untok(h));
  });
  $('homeBtn').onclick = () => show(null);
  $('backBtn').onclick = back;
  $('refreshBtn').onclick = () => refresh(true);
  if ($('popBtn')) $('popBtn').onclick = () => env.onPopout && env.onPopout(currentRoute);
  if ($('closeBtn')) $('closeBtn').onclick = () => env.onClose && env.onClose();
  // teclas dentro do Codex não vão para os atalhos do jogo
  appEl.addEventListener('keydown', ev => { if (ev.key === 'Escape' && env.onClose && !env.isPopup) env.onClose(); ev.stopPropagation(); });

  // ---------- status do jogo ao vivo ----------
  const liveDot = $('liveDot'), liveTxt = $('liveTxt');
  function refreshStatus(){
    const i = LAB.info();
    if (!LAB.ok || !i) { liveTxt.textContent = 'Jogo não encontrado'; liveDot.classList.remove('on'); return; }
    liveTxt.textContent = `Ao vivo · GL ${i.gl}`; liveDot.classList.add('on');
  }
  // Atualiza a página com os valores atuais do jogo. Não atualiza se você estiver editando uma calculadora.
  function refresh(force){
    refreshStatus();
    if (!force) {
      if (dirty) return;
      const a = root.activeElement; if (a && pageEl.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
      if (pageEl.querySelector('details[open].lab-keep')) return;
    }
    const y = mainEl.scrollTop;
    const openDetails = [...pageEl.querySelectorAll('details')].map(d => d.open);
    if (currentRoute === 'missing') renderMissing();
    else if (currentId) renderEntry(BY[currentId]);
    else renderHome();
    pageEl.querySelectorAll('details').forEach((d, i) => { if (openDetails[i] !== undefined) d.open = openDetails[i]; });
    mainEl.scrollTop = y;
    if (force) dirty = false;
  }

  LAB.init(env.GBF, env.META);
  activeCat = lsGet('cat') || null; if (activeCat && !cats.includes(activeCat)) activeCat = null;
  renderCats(); renderList(); refreshStatus();
  const startRoute = env.route !== undefined ? env.route : (lsGet('route') || null);
  show(startRoute && (startRoute === 'missing' || BY[startRoute]) ? startRoute : null, false);
  return { show, refresh, back, get route(){ return currentRoute; } };
  }


  // ─── jogo ─────────────────────────────────────────────────────────────────
  const vm = () => document.querySelector('#app')?.__vue__ || null;
  const liveGB = () => {
    const v = vm(); const store = v?.$store;
    if (!store?.state?.meta) return null;
    const en = v.$vuetify?.lang?.locales?.en || {};
    return { store, en, live: true };
  };
  const gameDark = () => !!document.querySelector('.v-application.theme--dark');

  // ─── dados (GitHub → cache no IndexedDB) ──────────────────────────────────
  const idb = (mode, fn) => new Promise((res, rej) => {
    const rq = indexedDB.open('gooboo-codex', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => { const tx = rq.result.transaction('kv', mode); const r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); };
  });
  const cacheGet = k => idb('readonly', s => s.get(k)).catch(() => null);
  const cachePut = (k, v) => idb('readwrite', s => s.put(v, k)).catch(() => null);
  let dataPromise = null;
  function loadData() {
    if (dataPromise) return dataPromise;
    dataPromise = (async () => {
      const cached = await cacheGet('data');
      if (cached && cached.hash === DATA_HASH) return cached;
      let lastErr = null;
      for (const url of DATA_URLS) {
        try {
          const r = await fetch(url + '?h=' + DATA_HASH, { cache: 'no-cache' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = await r.json();
          if (!d || !Array.isArray(d.glossary)) throw new Error('arquivo inválido');
          if (d.hash !== DATA_HASH) console.warn('[Codex] dados com hash diferente do script', d.hash, DATA_HASH);
          await cachePut('data', d);
          return d;
        } catch (e) { lastErr = e; }
      }
      if (cached) { console.warn('[Codex] usando dados em cache antigos:', lastErr); return cached; }
      throw new Error('Não consegui baixar os dados do Codex (' + (lastErr?.message || 'erro') + ').');
    })();
    dataPromise.catch(() => { dataPromise = null; });
    return dataPromise;
  }

  function fontsInto(doc) {
    if (doc.getElementById('gcodex-fonts')) return;
    const l = doc.createElement('link');
    l.id = 'gcodex-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=JetBrains+Mono:wght@400;600&family=Nunito+Sans:wght@400;600;700&display=swap';
    doc.head.appendChild(l);
  }

  // ─── painel lateral dentro do jogo ────────────────────────────────────────
  const cfg = Object.assign({ open: false, width: 900 }, (() => { try { return JSON.parse(localStorage.getItem('gcodex_cfg')) || {}; } catch { return {}; } })());
  const saveCfg = () => { try { localStorage.setItem('gcodex_cfg', JSON.stringify(cfg)); } catch {} };
  let host = null, shadow = null, panelApp = null, popWin = null, popApp = null, chip = null;

  function placeHost() {
    if (!host) return;
    const bar = document.querySelector('.v-app-bar');
    const top = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0;
    host.style.top = top + 'px';
    host.style.height = `calc(100vh - ${top}px)`;
    host.style.width = Math.min(cfg.width, window.innerWidth - 40) + 'px';
    host.setAttribute('data-theme', gameDark() ? 'dark' : 'light');
  }

  function message(root, html) {
    root.innerHTML = `<div class="wrap"><div class="msgbox">${html}</div></div>`;
  }

  async function openPanel() {
    if (!host) {
      host = document.createElement('div');
      host.id = 'gooboo-codex';
      host.style.cssText = 'position:fixed;right:0;z-index:99990;box-shadow:-8px 0 30px rgba(0,0,0,.35);display:none';
      document.body.appendChild(host);
      shadow = host.attachShadow({ mode: 'open' });
      const st = document.createElement('style'); st.textContent = CSS_SHADOW; shadow.appendChild(st);
      const root = document.createElement('div'); root.className = 'root'; shadow.appendChild(root);
      const grip = document.createElement('div'); grip.className = 'grip'; grip.title = 'Arraste para mudar a largura'; shadow.appendChild(grip);
      grip.addEventListener('pointerdown', ev => {
        ev.preventDefault(); grip.setPointerCapture(ev.pointerId);
        const mv = e => { cfg.width = Math.max(360, Math.min(window.innerWidth - 40, window.innerWidth - e.clientX)); placeHost(); };
        const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); saveCfg(); };
        grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
      });
      fontsInto(document);
      window.addEventListener('resize', placeHost);
    }
    cfg.open = true; saveCfg();
    host.style.display = '';
    placeHost();
    updateChip();
    if (panelApp) { panelApp.refresh(); return; }
    const root = shadow.querySelector('.root');
    message(root, 'Carregando o Codex…');
    try {
      const d = await loadData();
      const GB = liveGB();
      if (!GB) { message(root, 'O jogo ainda não terminou de carregar. Tente de novo em alguns segundos.'); return; }
      root.innerHTML = SHELL(false);
      // ShadowRoot tem getElementById, querySelector e activeElement — o app usa só isso
      panelApp = mountCodex(shadow, { DATA: d.glossary, GBF: d.gbf, META: d.meta, COLORS: d.colors, GB, isPopup: false, onPopout: route => { openPopup(route); closePanel(); }, onClose: closePanel });
    } catch (e) {
      console.error('[Codex]', e);
      message(root, `${e.message}<br><br>Os dados ficam em <b>github.com/diogoam/gooboo-codex</b> (pasta data). <button type="button" class="btn" id="retry">Tentar de novo</button>`);
      const b = shadow.getElementById('retry'); if (b) b.onclick = () => { panelApp = null; openPanel(); };
    }
  }
  function closePanel() { cfg.open = false; saveCfg(); if (host) host.style.display = 'none'; updateChip(); }

  // ─── janela separada (mesma origem: lê a store do jogo direto) ────────────
  async function openPopup(route) {
    if (popWin && !popWin.closed) { popWin.focus(); if (route !== undefined && popApp) popApp.show(route); return; }
    const w = window.open('', 'gooboo-codex', 'popup=yes,width=1100,height=820');
    if (!w) { alert('O navegador bloqueou a janela do Codex. Permita pop-ups para tendsty.github.io.'); return; }
    popWin = w;
    const doc = w.document;
    doc.open();
    doc.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gooboo Codex</title><style>${CSS_DOC}</style></head><body><div class="wrap"><div class="msgbox">Carregando o Codex…</div></div></body></html>`);
    doc.close();
    fontsInto(doc);
    doc.documentElement.setAttribute('data-theme', gameDark() ? 'dark' : 'light');
    try {
      const d = await loadData();
      const GB = liveGB();
      if (!GB) { doc.body.innerHTML = '<div class="wrap"><div class="msgbox">O jogo ainda não terminou de carregar.</div></div>'; return; }
      doc.body.innerHTML = SHELL(true);
      popApp = mountCodex(doc, { DATA: d.glossary, GBF: d.gbf, META: d.meta, COLORS: d.colors, GB, isPopup: true, route });
      w.addEventListener('beforeunload', () => { popApp = null; });
    } catch (e) {
      doc.body.innerHTML = `<div class="wrap"><div class="msgbox">${String(e.message).replace(/</g, '&lt;')}</div></div>`;
    }
    updateChip();
  }

  // ─── atualização ao vivo (timer do Worker: segue com a aba do jogo em 2º plano) ─
  GA.every(5000, () => {
    try {
      if (host && cfg.open && panelApp) { placeHost(); panelApp.refresh(false); }
      if (popWin && !popWin.closed && popApp) { popWin.document.documentElement.setAttribute('data-theme', gameDark() ? 'dark' : 'light'); popApp.refresh(false); }
      else if (popWin && popWin.closed) { popWin = null; popApp = null; updateChip(); }
    } catch (e) { console.warn('[Codex] refresh', e); }
  });

  function updateChip() {
    if (!chip) return;
    const on = (cfg.open && host && host.style.display !== 'none') || (popWin && !popWin.closed);
    chip.style.background = on ? 'rgba(29,111,98,.85)' : 'rgba(29,111,98,.45)';
  }

  function init() {
    if (!GA.store()) { setTimeout(init, 1000); return; }
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ga-chip';
    chip.textContent = '📖 Codex';
    chip.title = 'Gooboo Codex — clique: painel lateral · Shift+clique ou botão do meio: janela separada';
    chip.style.cssText = 'padding:3px 11px;border-radius:16px;font-size:12px;cursor:pointer;color:#fff;border:1px solid rgba(127,214,196,.7);background:rgba(29,111,98,.45);white-space:nowrap';
    chip.addEventListener('click', ev => { if (ev.shiftKey) { openPopup(); return; } (cfg.open && host && host.style.display !== 'none') ? closePanel() : openPanel(); });
    chip.addEventListener('auxclick', ev => { if (ev.button === 1) { ev.preventDefault(); openPopup(); } });
    GA.dock(chip);
    GA.modules.codex = { version: VERSION, open: openPanel, close: closePanel, popup: openPopup, loadData };
    if (cfg.open) openPanel();
  }
  init();
})();
