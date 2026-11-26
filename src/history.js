  // ─── Histórico de progresso (1.10) ─────────────────────────────────────────
  // A cada 20 s (timer do Worker, roda com o painel fechado e o jogo minimizado) tira uma foto pequena do save e
  // compara com a anterior. Cada diferença vira um registro: de onde veio cada ponto de Global level (as 8 partes do
  // meta.globalLevelParts e a causa de cada uma) e o resto que mudou (achievement, relic, note, card, shiny, livro,
  // unlock, prestige). Na 1ª foto depois de abrir o jogo, a diferença é o que aconteceu com o jogo fechado.
  // 1.10.2: um log por save (playerId). Quando um save é carregado (abrir o jogo, importar, outro save), compara a hora
  // em que aquele save foi gravado (agora − system.offlineTime) com a última foto: mais antigo → os registros depois dele
  // são marcados como linha do tempo abandonada (não apaga, sai dos totais); mais novo → "save from elsewhere".
  // Só lê o jogo; guarda em localStorage (gcodex_hsnap2 = última foto por save, gcodex_hist2 = registros por save, 600 cada).
  const HISTORY = (() => {
    const K_SNAP = 'gcodex_hsnap', K_LOG = 'gcodex_hist', K_SINCE = 'gcodex_hsince', MAX = 600;
    const lsJ = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
    const lsP = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço: segue */ } };
    let log = lsJ(K_LOG, []);
    const cropGL = l => Math.min(l, Math.floor(l / 2) + 5, 25);
    function snap() {
      const S = GA.store()?.state;
      if (!S?.meta?.globalLevel || !S.system?.playerId) return null;
      const st = k => S.stat[k]?.total ?? 0;
      const o = { t: Date.now(), pid: S.system.playerId, gl: S.meta.globalLevel, parts: { ...S.meta.globalLevelParts } };
      o.depth = [st('mining_maxDepth0'), st('mining_maxDepth1')];
      o.zone = st('horde_maxZone');
      o.beauty = st('gallery_beauty') > 0 ? Math.floor(Math.log(st('gallery_beauty')) / Math.log(4)) : 0;
      o.crop = {}; for (const [k, c] of Object.entries(S.farm?.crop || {})) if (c.type !== 'special') o.crop[k] = Math.max(c.level, c.levelMax);
      o.house = {}; for (const [k, u] of Object.entries(S.upgrade?.item || {})) if (u.feature === 'village' && u.type === 'building' && u.subtype === 'housing') o.house[k] = Math.min(25, u.level);
      o.mile = {}; for (const [k, c] of Object.entries(S.village?.crafting || {})) o.mile[k] = Object.keys(c.milestone || {}).filter(n => c.crafted >= +n).length;
      o.bp = {}; for (const [k, c] of Object.entries(S.horde?.fighterClass || {})) for (const [q, n] of Object.entries(c.questsCompleted || {})) if (n) o.bp[k + '.' + q] = n;
      o.ach = {}; for (const [k, a] of Object.entries(S.achievement || {})) if (a.level) o.ach[k] = a.level;
      o.relic = Object.keys(S.relic?.item || {}).filter(k => S.relic.item[k].found);
      o.note = Object.keys(S.note || {}).filter(k => S.note[k].found);
      o.card = Object.keys(S.card?.card || {}).filter(k => S.card.card[k].amount > 0);
      o.shiny = Object.keys(S.card?.card || {}).filter(k => S.card.card[k].foundShiny);
      o.book = Object.keys(S.school?.book || {}).filter(k => S.school.book[k].owned);
      o.unl = Object.keys(S.unlock || {}).filter(k => S.unlock[k].use);
      o.pres = {}; for (const k of Object.keys(S.stat || {})) if (/_prestigeCount$/.test(k)) o.pres[k] = st(k);
      o.off = S.system.offlineTime ?? 0; // muda a cada save carregado (abrir o jogo ou importar)
      o.tot = {}; for (const [k, v] of Object.entries(S.stat || {})) if (v.total > 0) o.tot[k] = v.total; // totais só sobem numa mesma linha do tempo
      o.scr = S.system.screen;
      o.asv = S.system.settings?.general?.items?.autosaveTimer?.value ?? 30;
      return o;
    }
    // causas de cada parte do Global level
    // as partes do GL só sobem: uma queda é um save mais antigo carregado e não entra
    function diff(a, b) {
      const parts = {}, items = [];
      for (const p of new Set([...Object.keys(a.parts || {}), ...Object.keys(b.parts || {})])) { const x = a.parts?.[p] ?? 0, y = b.parts?.[p] ?? 0; if (y > x) parts[p] = [x, y]; }
      const add = (kind, part, id, x, y, extra) => items.push({ k: kind, p: part, id, a: x, b: y, ...(extra || {}) });
      [0, 1].forEach(i => { if (b.depth[i] > a.depth[i]) add('depth', 'mining_' + i, 'mining_maxDepth' + i, a.depth[i] - 1, b.depth[i] - 1); });
      if (b.zone > a.zone) add('zone', 'horde_0', 'horde_maxZone', a.zone - 1, b.zone - 1);
      if (b.beauty > a.beauty) add('beauty', 'gallery_0', 'gallery_beauty', a.beauty, b.beauty);
      for (const [k, v] of Object.entries(b.crop)) { const u = a.crop?.[k] ?? 0; if (v > u) { const g = cropGL(v) - cropGL(u); add('crop', g > 0 ? 'farm_0' : null, k, u, v, { g }); } }
      // housing e milestones voltam a 0 no prestige da Village: a parte do GL guarda o recorde, então só contam quando ela sobe
      if (parts.village_0) for (const [k, v] of Object.entries(b.house)) { const u = a.house?.[k] ?? 0; if (v > u) add('house', 'village_0', k, u, v); }
      if (parts.village_1) for (const [k, v] of Object.entries(b.mile)) { const u = a.mile?.[k] ?? 0; if (v > u) add('mile', 'village_1', k, u, v); }
      for (const [k, v] of Object.entries(b.bp)) { const u = a.bp?.[k] ?? 0; if (v > u) add('bp', 'horde_1', k, u, v); }
      for (const [k, v] of Object.entries(b.ach)) { const u = a.ach?.[k] ?? 0; if (v > u) add('ach', null, k, u, v); }
      for (const [k, v] of Object.entries(b.pres)) { const u = a.pres?.[k] ?? 0; if (v > u) add('pres', null, k, u, v); }
      const news = (kind, key) => { const old = new Set(a[key] || []); for (const k of b[key] || []) if (!old.has(k)) add(kind, null, k); };
      news('relic', 'relic'); news('note', 'note'); news('card', 'card'); news('shiny', 'shiny'); news('book', 'book'); news('unl', 'unl');
      return { parts, items };
    }
    // ── um log por save (playerId). Formato: gcodex_hist2 = { pid: { since, ev: [...] } }, gcodex_hsnap2 = { pid: última foto }
    const K_LOGS = 'gcodex_hist2', K_SNAPS = 'gcodex_hsnap2';
    let books = lsJ(K_LOGS, null), snaps = lsJ(K_SNAPS, null);
    if (!books) { // migra a 1.10.0/1.10.1 (um log só) para o save da última foto
      books = {}; snaps = {};
      const old = lsJ(K_SNAP, null);
      if (old && old.pid) { books[old.pid] = { since: lsJ(K_SINCE, old.t), ev: log }; snaps[old.pid] = old; }
      lsP(K_LOGS, books); lsP(K_SNAPS, snaps);
      try { localStorage.removeItem(K_LOG); localStorage.removeItem(K_SNAP); localStorage.removeItem(K_SINCE); } catch { /* ignore */ }
    }
    let curPid = null;
    const book = pid => (books[pid] = books[pid] || { since: Date.now(), ev: [] });
    const saveAll = () => { lsP(K_LOGS, books); lsP(K_SNAPS, snaps); };
    const pushEv = (pid, e) => { const b = book(pid); b.ev.push(e); if (b.ev.length > MAX) b.ev = b.ev.slice(-MAX); };
    // algum total de estatística caiu = estado de antes do último registro (save mais antigo)
    const wentBack = (a, b) => { for (const [k, v] of Object.entries(a.tot || {})) if ((b.tot?.[k] ?? 0) < v * (1 - 1e-9) - 1e-9) return true; return b.gl < a.gl; };
    // 1.10.3: a aba sabe se o jogo está salvando. O jogo não salva numa aba duplicada ("already open", main.js) nem com o
    // resumo offline aberto (js/tick.js). Lê a hora do último save gravado no navegador (goobooSavefile) para confirmar.
    const st = { dup: false, summarySince: null, lastSave: null, savePid: null };
    const readSave = () => { try { const raw = localStorage.getItem('goobooSavefile'); if (!raw) return; const f = JSON.parse(raw[0] === '{' ? raw : atob(raw)); st.lastSave = (f.timestamp || 0) * 1000; st.savePid = f.playerId ?? null; } catch { /* ignore */ } };
    function tick() {
      const S0 = GA.store()?.state;
      st.dup = S0?.system?.screen === 'tab-duplicate';
      st.summarySince = S0?.system?.screen === 'offlineSummary' ? (st.summarySince ?? Date.now()) : null;
      readSave();
      // aba duplicada: não grava nada (o progresso dela não é salvo e o log é dividido com a outra aba)
      if (st.dup) return;
      // relê o que outra aba possa ter gravado antes de mexer
      books = lsJ(K_LOGS, books) || books; snaps = lsJ(K_SNAPS, snaps) || snaps;
      const s = snap(); if (!s) return;
      const first = !tick.ran; tick.ran = true;
      const prev = snaps[s.pid];
      const switched = curPid !== null && curPid !== s.pid;
      curPid = s.pid;
      if (!prev) { book(s.pid); snaps[s.pid] = s; saveAll(); return; } // save novo: só a base
      // um save foi carregado: abrir o jogo, importar um arquivo ou trocar de save
      const loaded = first || switched || s.off !== prev.off;
      let src;
      if (loaded) {
        const tSave = s.t - (s.off || 0) * 1000;           // quando aquele save foi gravado
        const tol = Math.max(90, (s.asv || 30) + 30) * 1000; // intervalo de autosave + folga
        const older = tSave < prev.t - tol || wentBack(prev, s);
        if (older) {
          // save mais antigo: o que foi registrado depois dele ficou numa linha do tempo abandonada (não apaga)
          const cut = Math.min(tSave, prev.t);
          for (const e of book(s.pid).ev) if (e.t > cut && !e.gone && !e.mark) e.gone = s.t;
          pushEv(s.pid, { t: s.t, t0: cut, gl: [prev.gl, s.gl], mark: 'older', parts: {}, items: [] });
          snaps[s.pid] = s; saveAll(); return;
        }
        src = tSave > prev.t + tol ? 'elsewhere' : first ? 'closed' : 'load';
      } else if (s.gl < prev.gl) { snaps[s.pid] = s; saveAll(); return; } // queda sem save carregado: só rebase
      const d = diff(prev, s);
      if (Object.keys(d.parts).length || d.items.length) pushEv(s.pid, { t: s.t, t0: prev.t, gl: [prev.gl, s.gl], src: loaded ? src : undefined, summary: s.scr === 'offlineSummary' ? 1 : undefined, parts: d.parts, items: d.items.slice(0, 200) });
      // registro confirmado quando o jogo grava um save com hora igual ou depois dele
      if (st.lastSave && st.savePid === s.pid) for (const e of book(s.pid).ev) if (!e.saved && !e.mark && !e.gone && e.t <= st.lastSave + 1000) e.saved = 1;
      snaps[s.pid] = s; saveAll();
    }
    const cur = () => curPid ? book(curPid) : { since: null, ev: [] };
    return { tick, status: () => ({ ...st, pid: curPid }), events: () => cur().ev, since: () => cur().since, clear: () => { if (curPid) { books[curPid] = { since: Date.now(), ev: [] }; saveAll(); } }, others: () => Object.keys(books).filter(p => p !== curPid && books[p].ev.length).length };
  })();
  GA.every(20000, () => { try { HISTORY.tick(); } catch (e) { console.warn('[Codex] history', e); } });
  setTimeout(() => { try { HISTORY.tick(); } catch (e) { /* ignore */ } }, 8000);
