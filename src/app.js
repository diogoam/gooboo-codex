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
const CAT_ORDER = ['Conceito','Feature','Moeda','Gema','Estatística','Upgrade','Building','Upgrade de prestige','Upgrade premium','Upgrade de shapes','Unlock','Relic','Glyph','Card','Coleção de cards','Card pack','Achievement','Livro','General','Questline','Note','Enhancement','Beacon','Smeltery','Job','Policy','Offering','Receita','Equipamento','Heirloom','Trinket','Sigil','Classe','Área','Torre','Crop','Gene','Farm building','Ideia','Shape','Matéria','Efeito de treasure','Consumível','Upgrade de evento'];
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
  const starts = ['concept:gl','concept:prestige','concept:mult','concept:overcap','concept:dweller','concept:cards','concept:general','concept:cryolab','feat:mining','feat:village','feat:horde','feat:farm','feat:gallery'].filter(id => BY[id]);
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
