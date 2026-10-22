
const DATA = JSON.parse(document.getElementById('data').textContent);
const COLORS = __COLORS__;
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

// rich text: **bold**, {{id}} links, numbers
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

// backlinks
const BACK = {};
for (const e of DATA) {
  const txt = JSON.stringify(e.s) + (e.d || '');
  for (const m of txt.matchAll(/\{\{([^}]+)\}\}/g)) { const t = m[1]; if (t !== e.id) (BACK[t] = BACK[t] || new Set()).add(e.id); }
}

__CALC__
// search
let activeCat = null; let currentId = null;
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
const listEl = document.getElementById('list'), countEl = document.getElementById('count'), qEl = document.getElementById('q');
function renderList(){
  const res = search(qEl.value); const shown = res.slice(0, 400);
  countEl.textContent = `${res.length.toLocaleString('pt-BR')} verbetes${res.length > 400 ? ' · mostrando 400' : ''}`;
  listEl.innerHTML = shown.map(e => `<li><button type="button" data-id="${esc(e.id)}"${e.id === currentId ? ' aria-current="true"' : ''}><span class="dot" style="background:${swatch(e) || featColor(e.f)}"></span><span class="nm">${esc(e.n)}</span><span class="ct">${esc(e.c)}</span></button></li>`).join('');
}
listEl.addEventListener('click', ev => { const b = ev.target.closest('button[data-id]'); if (b) go(b.dataset.id); });
let t; qEl.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderList, 80); });
qEl.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const r = search(qEl.value)[0]; if (r) go(r.id); } });
const catsEl = document.getElementById('cats');
function renderCats(){
  catsEl.innerHTML = [`<button type="button" class="cat" aria-pressed="${!activeCat}" data-c="">Tudo</button>`].concat(cats.map(c => `<button type="button" class="cat" aria-pressed="${activeCat === c}" data-c="${esc(c)}">${esc(c)}</button>`)).join('');
}
catsEl.addEventListener('click', ev => { const b = ev.target.closest('button[data-c]'); if (!b) return; activeCat = b.dataset.c || null; try { localStorage.setItem('gcat', activeCat || ''); } catch {} renderCats(); renderList(); });

// pages
const pageEl = document.getElementById('page'), mainEl = document.getElementById('main'), appEl = document.getElementById('app');
function renderEntry(e){
  const fc = featColor(e.f), sw = swatch(e);
  const back = [...(BACK[e.id] || [])].map(id => BY[id]).filter(Boolean).sort((a,b) => a.c.localeCompare(b.c) || a.n.localeCompare(b.n, undefined, {numeric: true}));
  pageEl.innerHTML = `
    <button type="button" class="back-btn" id="toList">← Índice</button>
    <div class="crumbs"><span class="tag">${esc(e.c)}</span>${FEAT_NAMES[e.f] ? `<a class="tag f" style="background:${fc}" href="#feat~${esc(e.f)}">${esc(FEAT_NAMES[e.f])}</a>` : ''}</div>
    <h2>${sw ? `<span class="swatch" style="background:${sw}" title="cor no jogo: ${esc(e.col)}"></span>` : ''}${esc(e.n)}</h2>
    <div class="key">id interno: <button type="button" id="copyKey" title="Copiar">${esc(e.k)}</button>${e.nui ? ' · nome descritivo (o jogo não exibe um nome para isto)' : ''}</div>
    ${e.d ? `<div class="desc"><small>Texto do jogo</small>${rich(e.d)}</div>` : ''}
    ${labHTML(e)}
    ${e.s.map(s => `<section class="s"><h3>${esc(s.h)}</h3><ul>${s.b.map(b => `<li>${rich(b)}</li>`).join('')}</ul></section>`).join('')}
    ${back.length ? `<details class="back"${back.length <= 12 ? ' open' : ''}><summary>Aparece em ${back.length} verbete${back.length > 1 ? 's' : ''}</summary><ul>${back.slice(0, 300).map(b => `<li><a class="x" href="#${tok(b.id)}">${esc(b.n)}</a> <span class="key">${esc(b.c)}</span></li>`).join('')}</ul></details>` : ''}`;
  document.getElementById('copyKey').onclick = ev => { navigator.clipboard?.writeText(e.k).then(() => ev.target.textContent = 'copiado ✓', () => {}); };
  document.getElementById('toList').onclick = () => { appEl.classList.remove('reading'); };
  try { LAB.bindEntry(pageEl); } catch (err) { console.warn(err); }
}
function labHTML(e){ try { return LAB.forEntry(e); } catch (err) { console.warn(err); return `<p class="hint">Calculadora indisponível para este verbete (${esc(err.message)}).</p>`; } }
function rerenderCurrent(){ if (!currentId) return; const y = mainEl.scrollTop, wy = window.scrollY; renderEntry(BY[currentId]); mainEl.scrollTop = y; window.scrollTo(0, wy); }
function renderHome(){
  const counts = {}; DATA.forEach(e => counts[e.c] = (counts[e.c] || 0) + 1);
  const starts = ['concept:gl','concept:prestige','concept:mult','concept:overcap','concept:dweller','concept:cards','concept:general','concept:cryolab','feat:mining','feat:village','feat:horde','feat:farm','feat:gallery'].filter(id => BY[id]);
  pageEl.innerHTML = `<div class="home">
    <button type="button" class="back-btn" id="toList">← Índice</button>
    <h2>Gooboo Codex</h2>
    <p>Todos os termos do jogo com o nome que aparece na interface: o que é, de onde vem, como destrava e o que afeta o valor. Gerado do código do jogo (v1.6.3). Clique em qualquer nome sublinhado para navegar.</p>
    ${LAB.ok ? `<div class="banner">${LAB.info() ? `Mostrando os números do <b>seu save</b> (GL ${LAB.info().gl}). Toda moeda, estatística e upgrade tem uma calculadora; as features têm o planejador de run.` : 'As calculadoras estão usando um <b>jogo novo de exemplo</b>. Carregue seu save no painel à esquerda para ver seus números.'}</div>` : ''}
    <div class="start" style="margin-top:14px"><a href="#missing">O que falta em cada feature (notes, unlocks, upgrades, cards…)</a></div>
    <h3 style="font:800 20px var(--f-display);margin:20px 0 6px">Planejar a próxima run</h3>
    <div class="start">${['mining','village','horde','farm','gallery'].map(f => `<a href="#feat~${f}">${esc(FEAT_NAMES[f] || f)}</a>`).join('')}</div>
    <h3 style="font:800 20px var(--f-display);margin:20px 0 6px">Comece por</h3>
    <div class="start">${starts.map(id => `<a href="#${tok(id)}">${esc(BY[id].n)}</a>`).join('')}</div>
    <div class="grid">${cats.map(c => `<button type="button" class="tile" data-c="${esc(c)}"><b>${esc(c)}</b><span>${counts[c]} verbetes</span></button>`).join('')}</div></div>`;
  pageEl.querySelectorAll('.tile').forEach(b => b.onclick = () => { activeCat = b.dataset.c; renderCats(); renderList(); qEl.focus(); appEl.classList.remove('reading'); });
  document.getElementById('toList').onclick = () => appEl.classList.remove('reading');
}
function go(id){ if (location.hash !== '#' + tok(id)) location.hash = tok(id); else show(id); }
let missTab = 'resumo';
try { missTab = localStorage.getItem('gmiss') || 'resumo'; } catch {}
function renderMissing(){
  pageEl.innerHTML = '<button type="button" class="back-btn" id="toList">← Índice</button>' + LAB.missingPage(missTab);
  document.getElementById('toList').onclick = () => appEl.classList.remove('reading');
  pageEl.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { missTab = b.dataset.tab; renderMissing(); });
  pageEl.querySelectorAll('[data-goto]').forEach(a => a.onclick = ev => { ev.preventDefault(); missTab = a.dataset.goto; renderMissing(); mainEl.scrollTop = 0; });
  try { localStorage.setItem('gmiss', missTab); } catch {}
  const f = document.getElementById('missq'); if (f) f.oninput = () => { const q = norm(f.value); pageEl.querySelectorAll('.miss-item').forEach(a => { a.hidden = q && !norm(a.textContent).includes(q); }); pageEl.querySelectorAll('details.mgroup').forEach(d => { if (q) d.open = [...d.querySelectorAll('.miss-item')].some(x => !x.hidden); }); };
}
function show(id){
  if (id === 'missing') { currentId = null; renderMissing(); appEl.classList.add('reading'); mainEl.scrollTop = 0; window.scrollTo(0, 0); return; }
  const e = BY[id];
  currentId = e ? id : null;
  if (e) { renderEntry(e); appEl.classList.add('reading'); } else renderHome();
  mainEl.scrollTop = 0; window.scrollTo(0, 0);
  listEl.querySelectorAll('button[aria-current]').forEach(b => b.removeAttribute('aria-current'));
  const cur = listEl.querySelector(`button[data-id="${CSS.escape(id || '')}"]`); if (cur) cur.setAttribute('aria-current', 'true');
}
window.addEventListener('hashchange', () => show(untok(location.hash.slice(1))));
document.getElementById('homeBtn').onclick = () => { history.replaceState(null, '', location.pathname); show(null); };
// save panel
const saveStatus = document.getElementById('saveStatus'), saveDot = document.getElementById('saveDot'), saveMsg = document.getElementById('saveMsg');
function refreshSaveUI(){ const i = LAB.info(); if (!LAB.ok) { saveStatus.textContent = 'Calculadoras indisponíveis'; return; } saveStatus.textContent = i ? `Seu save · GL ${i.gl}` + (i.ts ? ` · ${new Date(i.ts * 1000).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})}` : '') : 'Usando jogo novo (exemplo)'; saveDot.classList.toggle('on', !!i); }
document.getElementById('saveLoad').onclick = () => { const v = document.getElementById('saveText').value; if (!v.trim()) { saveMsg.textContent = 'Cole o texto do save primeiro.'; saveMsg.classList.add('err'); return; } try { saveMsg.textContent = 'Carregando…'; LAB.loadSave(v); } catch (err) { saveMsg.textContent = err.message || 'Não consegui ler esse save.'; saveMsg.classList.add('err'); } };
document.getElementById('saveForget').onclick = () => LAB.clearSave();
document.getElementById('saveFile').onchange = ev => { const file = ev.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { document.getElementById('saveText').value = r.result; document.getElementById('saveLoad').click(); }; r.readAsText(file); };
LAB.init(JSON.parse(document.getElementById('gbf').textContent), JSON.parse(document.getElementById('meta').textContent));
refreshSaveUI();
if (LAB.error && LAB.error()) { saveMsg.textContent = 'O save guardado não carregou: ' + LAB.error(); saveMsg.classList.add('err'); document.getElementById('savebox').open = true; }
try { activeCat = localStorage.getItem('gcat') || null; if (activeCat && !cats.includes(activeCat)) activeCat = null; } catch {}
renderCats(); renderList(); show(location.hash ? untok(location.hash.slice(1)) : null);
