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
