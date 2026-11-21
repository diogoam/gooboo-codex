  // ─── Histórico de progresso (1.10) ─────────────────────────────────────────
  // A cada 20 s (timer do Worker, roda com o painel fechado e o jogo minimizado) tira uma foto pequena do save e
  // compara com a anterior. Cada diferença vira um registro: de onde veio cada ponto de Global level (as 8 partes do
  // meta.globalLevelParts e a causa de cada uma) e o resto que mudou (achievement, relic, note, card, shiny, livro,
  // unlock, prestige). Na 1ª foto depois de abrir o jogo, a diferença é o que aconteceu com o jogo fechado.
  // Só lê o jogo; guarda em localStorage (gcodex_hsnap = última foto, gcodex_hist = registros, no máx. 600).
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
    let last = lsJ(K_SNAP, null);
    function tick() {
      const s = snap(); if (!s) return;
      if (!last || last.pid !== s.pid) { last = s; lsP(K_SNAP, s); lsP(K_SINCE, s.t); tick.ran = true; return; }
      if (s.gl < last.gl) { last = s; lsP(K_SNAP, s); tick.ran = true; return; } // save mais antigo importado: nova base, sem registro // 1ª foto (ou outro save): só a base
      const d = diff(last, s);
      if (Object.keys(d.parts).length || d.items.length) {
        // a 1ª comparação depois de abrir o jogo cobre o tempo com o jogo fechado
        log.push({ t: s.t, t0: last.t, gl: [last.gl, s.gl], away: !tick.ran, parts: d.parts, items: d.items.slice(0, 200) });
        if (log.length > MAX) log = log.slice(-MAX);
        lsP(K_LOG, log);
      }
      tick.ran = true;
      last = s; lsP(K_SNAP, s);
    }
    return { tick, events: () => log, clear: () => { log = []; lsP(K_LOG, log); lsP(K_SINCE, Date.now()); }, since: () => lsJ(K_SINCE, null) };
  })();
  GA.every(20000, () => { try { HISTORY.tick(); } catch (e) { console.warn('[Codex] history', e); } });
  setTimeout(() => { try { HISTORY.tick(); } catch (e) { /* ignore */ } }, 8000);
