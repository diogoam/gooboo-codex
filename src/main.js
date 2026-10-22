(function () {
  'use strict';
  if (window.__goobooCodex) return; // já carregado (script instalado duas vezes)
  window.__goobooCodex = true;

  // ════════════════════════════════════════════════════════════════════════
  // NÚCLEO COMPARTILHADO GooAssist v2 (idêntico aos scripts de Mining/Gallery/School)
  // O Codex não automatiza nada; usa o núcleo para os timers em Worker (seguem rodando com a
  // aba do jogo em 2º plano enquanto a janela do Codex está na frente) e para o dock no topo.
  // ════════════════════════════════════════════════════════════════════════
/*__CORE__*/

  const VERSION = '__VERSION__';
  const DATA_HASH = '__DATAHASH__';
  const DATA_URLS = [
    'https://raw.githubusercontent.com/diogoam/gooboo-codex/main/data/codex-data.json',
    'https://cdn.jsdelivr.net/gh/diogoam/gooboo-codex@main/data/codex-data.json',
  ];
  const CSS_DOC = __CSSDOC__;
  const CSS_SHADOW = __CSSSHADOW__;
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
/*__APP__*/

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
