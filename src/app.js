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
const CAT_ORDER = ['Guide','Conceito','Feature','Prestige','Event','Moeda','Gema','Estatística','Upgrade','Building','Upgrade de prestige','Upgrade premium','Upgrade de shapes','Unlock','Relic','Glyph','Card','Coleção de cards','Card pack','Achievement','Livro','General','Questline','Note','Enhancement','Beacon','Smeltery','Job','Policy','Offering','Receita','Equipamento','Heirloom','Trinket','Sigil','Classe','Área','Torre','Crop','Gene','Farm building','Ideia','Shape','Matéria','Efeito de treasure','Consumível','Upgrade de evento'];
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

/*__CALC__*/

// ---------- busca ----------
let activeCat = null; let currentId = null; let currentRoute = null;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// texto pesquisável de cada verbete: seções com os nomes no lugar dos {{id}}
const plain = t => String(t || '').replace(/\{\{([^}]+)\}\}/g, (m, id) => BY[id]?.n || id).replace(/\*\*|«|»/g, '');
const INDEX = DATA.map(e => {
  const secs = e.s.map(s => ({ h: s.h, t: plain(s.b.join(' · ')) }));
  return { e, n: norm(e.n), k: norm(e.k), c: norm(e.c), d: norm(plain(e.d)), dRaw: plain(e.d), secs, t: secs.map(x => norm(x.t)) };
});
// guia do evento de cada verbete: pelo id (cinders…, bloom…, event_summerFestivalToken) ou por ser citado por um guia só
const EVENT_KEYS = DATA.filter(x => x.c === 'Event').map(x => x.k);
const guideFor = e => {
  if (!e || e.c === 'Event') return null;
  const k = String(e.k).replace(/^event_/, '');
  let g = EVENT_KEYS.find(ek => new RegExp('^' + ek + '(?=[A-Z_]|$)').test(k));
  if (!g) { const from = [...(BACK[e.id] || [])].filter(id => id.startsWith('event:')); if (from.length === 1) g = from[0].slice(6); }
  return g ? BY['event:' + g] : null;
};
const TOOLS = [{ id: 'guides', n: 'Guides', c: 'Tool', words: 'guides guias events eventos beginner iniciante concepts conceitos' }, { id: 'missing', n: "What's missing (O que falta)", c: 'Tool', words: "what's missing o que falta closest to getting mais perto de sair everything tudo notes unlocks upgrades cards relics questlines achievements" }];
const snip = (raw, nq) => {
  const i = norm(raw).indexOf(nq); if (i < 0) return '';
  const a = Math.max(0, i - 40), b = Math.min(raw.length, i + nq.length + 60);
  return (a > 0 ? '…' : '') + raw.slice(a, b) + (b < raw.length ? '…' : '');
};
let lastHits = new Map();
function search(q){
  const nq = norm(q.trim());
  lastHits = new Map();
  let rows = INDEX.filter(r => !activeCat || r.e.c === activeCat);
  if (!nq) return rows.map(r => r.e).sort((a,b) => a.n.localeCompare(b.n, undefined, {numeric: true}));
  const scored = [];
  for (const r of rows) {
    let sc = 0, hit = null;
    if (r.n === nq) sc = 100; else if (r.n.startsWith(nq)) sc = 80; else if (r.n.includes(nq)) sc = 60;
    else if (r.k.includes(nq)) sc = 40;
    else if (r.d.includes(nq)) { sc = 15; hit = { h: 'Game text', s: snip(r.dRaw, nq) }; }
    else { const i = r.t.findIndex(t => t.includes(nq)); if (i >= 0) { sc = 12; hit = { h: r.secs[i].h, s: snip(r.secs[i].t, nq) }; } else if (r.c.includes(nq)) sc = 10; }
    if (!sc) continue;
    // guias e conceitos primeiro quando empatam
    sc += r.e.c === 'Event' ? 8 : (r.e.c === 'Conceito' || r.e.c === 'Moeda' || r.e.c === 'Gema') ? 5 : 0;
    if (hit) lastHits.set(r.e.id, hit);
    scored.push([sc, r.e]);
  }
  // o guia do evento vai primeiro quando a busca é o nome do evento (ou um termo que só aparece nele)
  for (const x of scored) if (x[1].c === 'Event' && (norm(x[1].n).includes(nq) || nq.includes(norm(x[1].n)) || norm(x[1].k).includes(nq))) x[0] = 200;
  if (!activeCat) for (const t of TOOLS) if (norm(t.n + ' ' + t.words).includes(nq)) scored.push([70, t]);
  return scored.sort((a,b) => b[0]-a[0] || a[1].n.localeCompare(b[1].n, undefined, {numeric: true})).map(x => x[1]);
}
const listEl = $('list'), countEl = $('count'), qEl = $('q');
function renderList(){
  const res = search(qEl.value); const shown = res.slice(0, 400);
  countEl.textContent = `${res.length.toLocaleString('en-US')} entries${res.length > 400 ? ' · showing 400' : ''}`;
  listEl.innerHTML = shown.map(e => `<li><button type="button" data-id="${esc(e.id)}"${e.id === currentId ? ' aria-current="true"' : ''}><span class="dot" style="background:${swatch(e) || featColor(e.f)}"></span><span class="nm">${esc(e.n)}</span><span class="ct">${esc(e.c)}</span>${lastHits.has(e.id) ? `<span class="hit"><b>${esc(SEC_SLOT[lastHits.get(e.id).h] ? (SEC_TITLE[slotOf(lastHits.get(e.id).h)[0]] || lastHits.get(e.id).h) : lastHits.get(e.id).h)}:</b> ${esc(lastHits.get(e.id).s)}</span>` : ''}</button></li>`).join('');
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
    ${e.c === 'Feature' && BY['guide:' + e.k] ? `<div class="banner guide">📘 New here? <a class="x" href="#${tok('guide:' + e.k)}">Read the ${esc(e.n)} guide</a>: the loop, what limits you, what to prioritize and what the helpers measured.</div>` : ''}
    ${(g => g ? `<div class="banner guide">📘 Part of the <b>${esc(g.n)}</b> event. <a class="x" href="#${tok(g.id)}">Read the event guide</a>: what it is, what you'll see, the goal, strategy, bottlenecks and the shop.</div>` : '')(guideFor(e))}
    ${sectionsHTML(e)}
    ${appearsHTML(e, back)}`;
  $('copyKey').onclick = ev => { navigator.clipboard?.writeText(e.k).then(() => ev.target.textContent = 'copied ✓', () => {}); };
  $('toList').onclick = () => { appEl.classList.remove('reading'); };
  try { LAB.bindEntry(pageEl); } catch (err) { console.warn('[Codex]', err); }
}
// Order (decided with the player): What it is (game text inside) → How to get it → What it does (+ specific sections)
// → How it's calculated → Gain affected by → Capacity affected by → Calculators → Groups → Appears in.
// The data keeps its original headings (calc.js reads them); here they are mapped to the canonical order and merged.
const SEC_SLOT = {
  'O que é': [1, null], 'What it is': [1, null], 'O que mede': [1, 'What it measures'],
  'De onde vem': [2, 'Source'], 'Como destrava': [2, 'Unlock'], 'When to prestige': [8, null], 'Destrava': [2, 'Unlock'], 'Custo': [2, 'Cost'], 'How to get it': [2, null],
  'Efeitos': [3, 'Effects'], 'What it does': [3, null], 'Efeito quando equipada': [3, 'When equipped'], 'Usada para comprar': [3, 'Used to buy'],
  'O que este unlock libera': [3, 'What it unlocks'], 'Níveis': [3, 'Levels'], 'Efeitos por nível': [3, 'Per level'], 'Efeito por cópia': [3, 'Per copy'],
  'Atributos (nível 1)': [3, 'Stats (level 1)'], 'Atributos base': [3, 'Base stats'], 'Habilidades': [3, 'Skills'], 'Produz por trabalhador': [3, 'Per worker'],
  'Drops raros': [3, 'Rare drops'], 'Boss final': [3, 'Final boss'], 'Recompensas por andar': [3, 'Floor rewards'], 'Conteúdo': [3, 'Contents'], 'Questlines': [3, 'Questlines'],
  'Estágios': [3, 'Stages'], 'Milestones (cada um = +1 GL)': [3, 'Milestones (each = +1 GL)'], 'Subfeatures': [3, 'Subfeatures'], 'Ao repetir': [3, 'Extra copies'],
  'Glyphs no Museum': [3, 'Glyphs in the Museum'], 'Cartas': [2, 'Cards needed'], 'O que mede': [1, 'What it measures'],
  'Bônus ao completar': [3, 'On completion'], 'Efeito especial': [3, 'Special effect'], 'Habilidade ativa': [3, 'Active ability'], 'Bônus de cards': [3, 'Card bonus'],
  'Como é calculado': [5, null], "How it's calculated": [5, null], 'Fórmula': [5, 'Formula'],
  'Afetado por': [6, null], 'Gain affected by': [6, null], 'Capacity affected by': [7, null],
  'Groups': [9, null], 'Grupos': [9, null], 'Grupo': [9, null], 'Mencionado por': [10, null],
};
const SEC_TITLE = { 8: 'When to prestige', 10: 'Appears in', 1: 'What it is', 2: 'How to get it', 3: 'What it does', 5: "How it's calculated", 6: 'Gain affected by', 7: 'Capacity affected by', 9: 'Groups' };
const slotOf = h => SEC_SLOT[h] || (/^Efeitos \(nível/.test(h) ? [3, h.replace('Efeitos (nível', 'Effects (level')] : [4, null]);
function appearsHTML(e, back){
  const men = e.s.filter(s => s.h === 'Mencionado por').flatMap(s => s.b);
  if (!back.length && !men.length) return '';
  const n = back.length;
  return `<details class="back"${n <= 12 ? ' open' : ''}><summary>Appears in${n ? ` ${n} entr${n > 1 ? 'ies' : 'y'}` : ''}</summary>${men.length ? `<ul class="men">${men.map(x => `<li>${rich(x)}</li>`).join('')}</ul>` : ''}${n ? `<ul>${back.slice(0, 300).map(b => `<li><a class="x" href="#${tok(b.id)}">${esc(b.n)}</a> <span class="key">${esc(b.c)}</span></li>`).join('')}</ul>` : ''}</details>`;
}
function sectionsHTML(e){
  const lis = b => `<ul>${b.map(x => `<li>${rich(x)}</li>`).join('')}</ul>`;
  const desc = e.d ? `<div class="desc"><small>Game text</small>${rich(e.d)}</div>` : '';
  // guides (Event) keep their narrative order
  if (e.c === 'Event' || e.c === 'Guide') return desc + e.s.map(s => `<section class="s"><h3>${esc(s.h)}</h3>${lis(s.b)}</section>`).join('') + labHTML(e);
  const slots = {};
  for (const s of e.s.filter(x => x.h !== 'Guide')) { const [n, sub] = slotOf(s.h); (slots[n] = slots[n] || []).push({ s, sub }); }
  const merged = n => {
    const parts = slots[n] || [];
    if (n === 1 && !parts.length && !desc) return '';
    if (n !== 1 && !parts.length) return '';
    const body = parts.map(({ s, sub }) => (parts.length > 1 && sub ? `<h4 class="sub">${esc(sub)}</h4>` : (sub && n !== 1 ? `<h4 class="sub">${esc(sub)}</h4>` : '')) + lis(s.b)).join('');
    return `<section class="s"><h3>${SEC_TITLE[n]}</h3>${n === 1 ? desc : ''}${body}</section>`;
  };
  const other = (slots[4] || []).map(({ s }) => `<section class="s"><h3>${esc(s.h)}</h3>${lis(s.b)}</section>`).join('');
  if (e.c === 'Prestige') return merged(1) + labHTML(e) + merged(2) + merged(3) + merged(8) + merged(5) + other + merged(6) + merged(7) + merged(9);
  return merged(1) + merged(2) + merged(3) + other + merged(5) + merged(8) + merged(6) + merged(7) + labHTML(e) + merged(9);
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
    <div class="chips"><a href="#guides" title="Beginner guides: every feature, every event and the core concepts">📘 Guides</a><a href="#concept~prestige" title="One page per prestige: formula, what resets and what stays, your live gain and when to prestige">⟳ Prestige</a><a href="#concept~cryolab" title="Cryo lab: what freezing pays, days to each level and where it gives the most Global level">❄ Cryo lab</a><a href="#guides" data-events="1" title="Event guides: Cinders, Bloom, Weather chaos, Summer festival, Night hunt, Snowdown, Merchant, Casino, Bank">🎪 Events</a></div>
    <div class="start" style="margin-top:14px"><a href="#missing">O que falta em cada feature (notes, unlocks, upgrades, cards…)</a></div>
    <h3 style="font:800 20px var(--f-display);margin:20px 0 6px">Planejar a próxima run</h3>
    <div class="start">${['mining','village','horde','farm','gallery'].map(f => `<a href="#feat~${f}">${esc(FEAT_NAMES[f] || f)}</a>`).join('')}</div>
    <h3 style="font:800 20px var(--f-display);margin:20px 0 6px">Comece por</h3>
    <div class="start">${starts.map(id => `<a href="#${tok(id)}">${esc(BY[id].n)}</a>`).join('')}</div>
    <div class="grid">${cats.map(c => `<button type="button" class="tile" data-c="${esc(c)}"><b>${esc(c)}</b><span>${counts[c]} verbetes</span></button>`).join('')}</div></div>`;
  pageEl.querySelectorAll('.tile').forEach(b => b.onclick = () => { activeCat = b.dataset.c; renderCats(); renderList(); qEl.focus(); appEl.classList.remove('reading'); });
  $('toList').onclick = () => appEl.classList.remove('reading');
}
function renderGuides(){
  const first = e => { const s = e.s.find(x => /^(O que é|What it is)/.test(x.h)) || e.s[0]; return s ? plain(s.b[0] || '').slice(0, 140) : ''; };
  const tile = e => `<a class="tile" href="#${tok(e.id)}"><b>${esc(e.n)}</b><span>${esc(first(e))}${first(e).length >= 140 ? '…' : ''}</span></a>`;
  const evs = DATA.filter(e => e.c === 'Event'), cons = DATA.filter(e => e.c === 'Conceito').sort((a, b) => a.n.localeCompare(b.n));
  pageEl.innerHTML = `<div class="guides"><button type="button" class="back-btn" id="toList">← Índice</button>
    <div class="crumbs"><span class="tag">Tool</span></div><h2>Guides</h2>
    <p class="hint">Start here. Feature guides explain each feature's loop, what limits you and what to prioritize; event guides explain each event from zero (what it is, what you'll see, goal, strategy, bottlenecks, shop, reset); concept guides explain the systems every feature shares. Names as the game shows them.</p>
    <h3>🗺 Features</h3><div class="grid">${DATA.filter(e => e.c === 'Guide').map(tile).join('')}${BY['concept:cryolab'] ? tile(BY['concept:cryolab']) : ''}</div>
    <h3 id="g-events">🎪 Events</h3><div class="grid">${evs.map(tile).join('')}</div>
    <h3>🧭 Concepts</h3><div class="grid">${cons.map(tile).join('')}</div></div>`;
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
    f.oninput = () => { const q = norm(f.value); pageEl.querySelectorAll('.miss-item, .tudo tbody tr').forEach(a => { a.hidden = q && !norm(a.textContent).includes(q); }); pageEl.querySelectorAll('details.mgroup').forEach(d => { if (q) d.open = [...d.querySelectorAll('.miss-item')].some(x => !x.hidden); }); };
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
  if (id === 'guides') { currentId = null; renderGuides(); appEl.classList.add('reading'); mainEl.scrollTop = 0; return; }
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
  if (a.dataset.events) $('g-events')?.scrollIntoView();
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
  else if (currentRoute === 'guides') renderGuides();
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
show(startRoute && (startRoute === 'missing' || startRoute === 'guides' || BY[startRoute]) ? startRoute : null, false);
return { show, refresh, back, get route(){ return currentRoute; } };
}
