// Builds the fan-wiki glossary dataset (glossary.json) from the live headless store + en.js
require('./bundle.js');
const fs = require('fs');
const s = globalThis.__store; const en = globalThis.__en; const G = s.getters;
globalThis.__newGame(false);
const st = s.state;
const D = JSON.parse(fs.readFileSync('data/gooboo-data.json'));

// ---------- helpers ----------
const get = (p) => { let o = en; for (const k of p.split('.')) { if (o == null) return null; o = o[k]; } return o; };
const str = (v) => typeof v === 'string' ? v : (v && typeof v === 'object' && typeof v.name === 'string' ? v.name : null);
const strip = (t) => typeof t === 'string' ? t.replace(/\{\d+\}/g, 'X').replace(/<[^>]+>/g, '') : null;
const safe = (f, ...a) => { try { return f(...a); } catch { return null; } };
const num = (v) => {
  if (typeof v !== 'number' || !isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(2).replace('e+', 'e');
  if (a >= 1000) return Math.round(v).toLocaleString('en-US');
  return String(+v.toFixed(3));
};
const cap1 = (x) => x ? x[0].toUpperCase() + x.slice(1) : x;
const FEAT = ['mining', 'village', 'horde', 'farm', 'gallery', 'gem', 'achievement', 'school', 'relic', 'card', 'general', 'event', 'treasure', 'cryolab', 'meta'];
const featName = (f) => str(get('feature.' + f)) || (f === 'meta' ? 'Global' : cap1(f));

const E = {}; // id -> entry
const add = (id, o) => { if (!E[id]) E[id] = { id, s: [], tags: [] }; Object.assign(E[id], o); return E[id]; };
const sec = (id, h, b) => { if (!E[id] || !b || (Array.isArray(b) && !b.length)) return; E[id].s.push({ h, b: Array.isArray(b) ? b : [b] }); };
const L = (id) => `{{${id}}}`;

// ---------- name resolution for mults ----------
const curId = (k) => 'cur:' + k;
const multTarget = (name) => {
  if (G['mult/isCurrencyGain'](name)) { const c = G['mult/getCurrencyName'](name, 4); if (st.currency[c]) return { id: curId(c), kind: 'gain' }; }
  if (G['mult/isCurrencyCap'](name)) { const c = G['mult/getCurrencyName'](name); if (st.currency[c]) return { id: curId(c), kind: 'cap' }; }
  if (G['mult/isUpgradeCap'](name)) { const u = G['mult/getUpgradeName'](name); if (st.upgrade.item[u]) return { id: 'upg:' + u, kind: 'upcap' }; }
  return { id: 'mult:' + name, kind: 'mult' };
};
const curName = (k) => str(get('currency.' + k)) || k.split('_')[1];
const multName = (name) => {
  const t = multTarget(name);
  if (t.kind === 'gain') return `${curName(t.id.slice(4))} gain`;
  if (t.kind === 'cap') return `${curName(t.id.slice(4))} capacity`;
  if (t.kind === 'upcap') return `${str(get('upgrade.' + t.id.slice(4))) || t.id} maximum level`;
  return str(get('mult.' + name)) || name;
};
const effVal = (type, v) => {
  if (v === null || v === undefined || (typeof v === 'object')) return '';
  if (typeof v !== 'number') return String(v);
  if (type === 'mult') return '×' + num(v);
  if (type === 'base') return (v >= 0 ? '+' : '') + num(v);
  if (type === 'bonus') return (v >= 0 ? '+' : '') + num(v) + ' (bônus final)';
  return num(v);
};
const BOOL = ['unlock', 'keepUpgrade', 'uncapUpgrade', 'findConsumable', 'villageCraft', 'farmSeed', 'galleryIdea', 'galleryShape'];
const effectIndex = {}; // target id -> [{src, txt}]
const idxAdd = (target, src, txt) => (effectIndex[target] = effectIndex[target] || []).push({ src, txt });

// describe one effect {name,type,value} with value fn evaluated at levels
const describeEff = (e, src, levels) => {
  const v = e.value;
  let vt = '';
  if (typeof v === 'function') {
    if (BOOL.includes(e.type)) {
      let first = null; for (let l = 0; l <= (levels?.max ?? 1); l++) if (safe(v, l) === true) { first = l; break; }
      vt = first !== null && levels ? ` (nível ${first})` : '';
    } else if (levels) {
      const a = safe(v, levels.min ?? 1), b = levels.max > 1 ? safe(v, levels.max) : null;
      vt = ' ' + effVal(e.type, a) + (b !== null && b !== a ? ` → ${effVal(e.type, b)} (nível ${levels.max})` : '');
    } else vt = ' ' + effVal(e.type, safe(v, 1));
  } else vt = ' ' + effVal(e.type, v);
  let txt;
  switch (e.type) {
    case 'unlock': txt = `Desbloqueia ${L('unl:' + e.name)}${vt}`; idxAdd('unl:' + e.name, src, `desbloqueia${vt}`); break;
    case 'keepUpgrade': txt = `Mantém ${L('upg:' + e.name)} no prestige${vt}`; idxAdd('upg:' + e.name, src, 'mantém no prestige' + vt); break;
    case 'uncapUpgrade': txt = `Remove o nível máximo de ${L('upg:' + e.name)}${vt}`; idxAdd('upg:' + e.name, src, 'remove nível máximo' + vt); break;
    case 'findConsumable': txt = `Libera o consumível ${L('cons:' + e.name)}${vt}`; idxAdd('cons:' + e.name, src, 'libera' + vt); break;
    case 'gainConsumable': txt = `Dá ${L('cons:' + e.name)}${vt}`; idxAdd('cons:' + e.name, src, 'dá' + vt); break;
    case 'villageCraft': txt = `Libera a receita ${L('craft:' + e.name)}${vt}`; idxAdd('craft:' + e.name, src, 'libera' + vt); break;
    case 'farmSeed': txt = `Libera a semente ${L('crop:' + e.name)}${vt}`; idxAdd('crop:' + e.name, src, 'libera' + vt); break;
    case 'galleryIdea': txt = `Libera a ideia ${L('idea:' + e.name)}${vt}`; idxAdd('idea:' + e.name, src, 'libera' + vt); break;
    case 'galleryShape': txt = `Libera a forma ${L('shape:' + e.name)}${vt}`; idxAdd('shape:' + e.name, src, 'libera' + vt); break;
    case 'villageJob': txt = `Vagas do job ${L('job:' + e.name)}${vt}`; idxAdd('job:' + e.name, src, 'vagas' + vt); break;
    case 'tag': txt = `Efeito especial: ${strip(str(get('tag.' + e.name))) || e.name}`; break;
    case 'text': txt = strip(str(get('mult.' + e.name)) || e.name); break;
    case 'currency': txt = `Dá ${L(curId(e.name))}${vt}`; idxAdd(curId(e.name), src, 'dá' + vt); break;
    case 'consumable': txt = `Dá ${L('cons:' + e.name)}${vt}`; idxAdd('cons:' + e.name, src, 'dá' + vt); break;
    case 'addRareDrop': txt = `Adiciona o drop raro ${L(curId(e.name))}${vt}`; idxAdd(curId(e.name), src, 'drop raro'); break;
    case 'addRareDropAmount': txt = `Aumenta a quantidade do drop raro ${L(curId(e.name))}${vt}`; break;
    case 'farmTile': txt = `Mais espaços no campo da Farm${vt}`; break;
    case 'farmBuilding': txt = `Mais um ${L('fbuild:' + e.name)} para colocar no campo${vt}`; idxAdd('fbuild:' + e.name, src, 'dá' + vt); break;
    case 'farmBuildingPremium': txt = `Versão premium de ${L('fbuild:' + e.name)}${vt}`; idxAdd('fbuild:' + e.name, src, 'premium' + vt); break;
    case 'farmCareImprove': txt = `Melhora o care de ${e.name}${vt}`; break;
    case 'farmCareDisable': txt = `Desativa o care de ${e.name}`; break;
    case 'farmCareAdd': txt = `Adiciona care de ${e.name}`; break;
    default: {
      const t = multTarget(e.name);
      const label = t.kind === 'gain' ? 'ganho' : t.kind === 'cap' ? 'capacidade' : t.kind === 'upcap' ? 'nível máximo' : '';
      txt = `${L(t.id)}${label ? ' (' + label + ')' : ''}${vt}`;
      idxAdd(t.id, src, `${label ? label + ' ' : ''}${['mult','base'].includes(e.type) ? '' : e.type}${vt}`.replace(/\s+/g, ' ').trim());
    }
  }
  return txt;
};

// ---------- 1. Features ----------
const glUnlock = st.meta.globalLevelUnlocks;
for (const [f, fd] of Object.entries(st.system.features)) {
  const id = 'feat:' + f;
  add(id, { c: 'Feature', n: featName(f), k: f, f });
  const ul = fd.unlock;
  if (ul && glUnlock[ul] !== undefined) sec(id, 'Como destrava', `Ao atingir ${L('concept:gl')} ${glUnlock[ul]}.`);
  else if (!ul) sec(id, 'Como destrava', 'Disponível desde o início.');
  const subs = get('subfeature.' + f);
  if (subs && typeof subs === 'object') sec(id, 'Subfeatures', Object.entries(subs).map(([i, n]) => `${n} (${i})` + (fd.subfeatures[i - 1] && glUnlock[fd.subfeatures[i - 1]] ? ` — destrava em GL ${glUnlock[fd.subfeatures[i - 1]]}` : '')));
}

// ---------- 2. Currencies ----------
const priceIdx = {};
for (const [k, u] of Object.entries(st.upgrade.item)) { const p = safe(u.price, 0) || {}; for (const c of Object.keys(p)) (priceIdx[c] = priceIdx[c] || []).push(k); }
const PRESTIGE_SRC = {
  mining_crystalGreen: 'Prestige da Mina (Ore mine), pelo Depth Dweller.', mining_crystalYellow: 'Prestige do Gas giant, pelo Depth Dweller.',
  mining_ember: 'Prestige da Mina: ⌊Ember gain × profundidade do dweller⌋.', village_blessing: 'Prestige da Village (Workers): igual ao Faith que você tem.',
  village_shares: 'Prestige do Crafters guild: Copper coin ÷ 1000 × multiplicador (mínimo 10).', horde_soulEmpowered: 'Prestige da Horde (Equipment): igual às Corrupted souls que você tem.',
  horde_courage: 'Prestige da Horde (Classes): pontos de coragem da run × multiplicador.', gallery_cash: 'Prestige da Gallery: 10^(log₈(beauty ÷ 1e11)^0.7) × multiplicador, exige beauty ≥ 1e12 na run.',
};
for (const [k, c] of Object.entries(st.currency)) {
  const [f] = k.split('_');
  const isGem = f === 'gem';
  const id = curId(k);
  add(id, { c: isGem ? 'Gema' : 'Moeda', n: curName(k), k, f, d: strip(get('currency.' + k + '.description')) });
  const info = [];
  info.push(`Feature: ${st.system.features[f] ? L('feat:' + f) : featName(f)}${c.type === 'prestige' ? ' · moeda de **prestige** (não reseta)' : c.type === 'regular' ? ' · reseta no prestige da feature' : ''}.`);
  if (c.cap !== null && c.cap !== undefined) info.push(`Tem capacidade máxima. ${c.overcapMult > 0 ? `Acima do cap o ganho continua reduzido: ×${num(c.overcapMult)} no 1º excesso, depois ×${num(c.overcapScaling)} a cada novo múltiplo do cap (${L('concept:overcap')}).` : 'Acima do cap o ganho para.'}`);
  sec(id, 'O que é', info);
  if (PRESTIGE_SRC[k]) sec(id, 'De onde vem', PRESTIGE_SRC[k]);
}

// ---------- 3. Upgrades ----------
const statName = (k) => {
  if (k === 'custom_hordeBattlepass') return `nível do ${L('concept:battlepass')}`;
  if (k === 'farm_seedBox') return `nível máximo de ${L('upg:farm_seedBox')}`;
  const d = str(get('stat.' + k + '.description')); if (d) return d;
  if (st.currency[k]) return `total de ${L(curId(k))} já ganho`;
  return k;
};
const statReq = (k, op, v) => (st.currency[k] && (op === '>' && +v === 0)) ? `já ter ganho ${L(curId(k))} alguma vez` : `${statName(k)}${k.startsWith('custom') || k === 'farm_seedBox' ? '' : ' (recorde)'} ${op === '>=' ? '≥' : op} ${num(+v)}`;
const reqText = (u) => {
  if (u.requirementStat) return statReq(u.requirementStat, '>=', u.requirementValue);
  const src = u.requirement.toString().replace(/\s+/g, ' ').replace(/store_default/g, 'store');
  if (/=> true/.test(src) || /return true/.test(src)) return null;
  let m;
  if ((m = src.match(/unlock\.(\w+)\.(see|use)/))) return `ter desbloqueado ${L('unl:' + m[1])}`;
  if ((m = src.match(/stat(?:\.|\[")([\w-]+)"?\]?\.total\s*(>=|>)\s*(\d+)/))) return statReq(m[1], m[2], m[3]);
  if ((m = src.match(/upgrade\.item\.(\w+)\.(\w+)\s*(>=|>)\s*(\d+)/))) return `${L('upg:' + m[1])} nível ${m[3]} ${m[4]}`;
  if ((m = src.match(/gallery\.shape\.(\w+)\.unlocked/))) return `ter a forma ${L('shape:' + m[1])}`;
  return 'condição especial';
};
const TYPE_PT = { regular: 'Upgrade', building: 'Building', prestige: 'Upgrade de prestige', premium: 'Upgrade premium', shape: 'Upgrade de shapes' };
for (const [k, u] of Object.entries(st.upgrade.item)) {
  const id = 'upg:' + k;
  const n = str(get('upgrade.' + k)) || k;
  const cat = u.feature === 'event' ? 'Upgrade de evento' : (TYPE_PT[u.type] || 'Upgrade');
  add(id, { c: cat, n, k, f: u.feature, d: strip(get('upgrade.description.' + k)) });
  const sub = get('subfeature.' + u.feature)?.[u.subfeature];
  const what = [`${cat} de ${L('feat:' + u.feature)}${sub && u.feature !== 'event' ? ' · ' + sub : ''}. ${u.cap === null ? 'Sem nível máximo.' : 'Nível máximo ' + u.cap + '.'}`];
  if (u.type === 'prestige') what.push('Comprado com moeda de prestige; **não reseta** no prestige.');
  if (u.type === 'premium') what.push('Comprado com gemas; permanente.');
  if (u.type === 'regular' || u.type === 'building') what.push(u.persistent ? 'Persistente: não reseta no prestige.' : 'Reseta no prestige da feature.');
  if (u.mode === 'queue') what.push('Construído numa fila (leva tempo).');
  sec(id, 'O que é', what);
  const r = reqText(u); sec(id, 'Como destrava', r ? `Aparece quando: ${r}.` : 'Disponível assim que a feature/aba existe.');
  const p = safe(u.price, 0);
  if (p && Object.keys(p).length) {
    const p2 = u.cap === null || u.cap >= 2 ? safe(u.price, Math.min(u.cap ?? 10, 10) - 1) : null;
    sec(id, 'Custo', [`Nível 1: ${Object.entries(p).map(([c, v]) => num(v) + ' ' + L(curId(c))).join(' + ')}`].concat(p2 ? [`Nível ${Math.min(u.cap ?? 10, 10)}: ${Object.entries(p2).map(([c, v]) => num(v) + ' ' + L(curId(c))).join(' + ')}`] : []));
  }
  const mx = u.cap === null ? 10 : Math.min(u.cap, 100);
  sec(id, 'Efeitos', u.effect.map(e => describeEff(e, id, { min: 1, max: mx })));
}

// ---------- 4. Mults (stats) ----------
for (const [name, m] of Object.entries(st.mult.items)) {
  const t = multTarget(name);
  if (t.kind !== 'mult') continue;
  const id = t.id;
  add(id, { c: 'Estatística', n: multName(name), k: name, f: m.feature });
  const what = [`Valor de ${st.system.features[m.feature] ? L('feat:' + m.feature) : featName(m.feature)}. Valor inicial ${num(m.baseValue)} (algumas mecânicas somam uma base própria, como o pickaxe power no Damage).` + (m.min !== null ? ` Mínimo ${num(m.min)}.` : '') + (m.max !== null ? ` Máximo ${num(m.max)}.` : '')];
  if (m.unlock) what.push(`Só aparece depois de ${L('unl:' + m.unlock)}.`);
  sec(id, 'O que é', what);
  if (m.group && m.group.length) sec(id, 'Grupo', `Tudo que afeta este valor afeta também: ${m.group.map(g => L(multTarget(g).id)).join(', ')}.`);
}

// ---------- 5. Unlocks ----------
const gatedBy = {}; // unlock -> [ids]
for (const [k, u] of Object.entries(st.unlock)) {
  const id = 'unl:' + k;
  add(id, { c: 'Unlock', n: str(get('unlock.' + k)) || (k.endsWith('Feature') ? featName(k.replace('Feature', '')) : k), k, f: (k.match(/^(mining|village|horde|farm|gallery|gem|school|relic|card|general|event|treasure|cryolab|achievement)/) || [, 'meta'])[1] });
  const trig = (D.unlockTriggers[k] || []).filter(x => x.source !== 'cardPack(usa)').map(x => {
    if (x.source === 'globalLevel') return `${L('concept:gl')} ${x.detail.replace('GL ', '')}`;
    if (x.source === 'upgrade') { const [uk, , lv] = x.detail.split(' '); return `${L('upg:' + uk)} nível ${lv}`; }
    if (x.source === 'relic') return `Relic ${L('relic:' + x.detail)}`;
    if (x.source === 'hordeBattlePass') return `${L('concept:battlepass')} ${x.detail.replace(/.*nível /, 'nível ')}`;
    if (x.source === 'hordeTower') { const m = x.detail.match(/Torre (\w+) andar (\d+)/); return `${L('tower:' + m[1])} andar ${m[2]}`; }
    if (x.source === 'hordeBoss') { const m = x.detail.match(/área (\w+)/); return `Derrotar o boss final de ${L('area:' + m[1])}`; }
    let m;
    if ((m = x.detail.match(/^Horde maxZone total ([>=]+) (\d+)(.*)$/))) return `Zona máxima da ${L('feat:horde')} (recorde) ${m[1]} ${m[2]}${m[3]}`;
    if ((m = x.detail.match(/^Mining maxDepth0 >= (\d+)$/))) return `Profundidade máxima da ${L('feat:mining')} (recorde) ≥ ${m[1]}`;
    if ((m = x.detail.match(/^Ganhar (\w+) pela primeira vez$/))) return `Ganhar ${L(curId(m[1]))} pela primeira vez`;
    if ((m = x.detail.match(/^Converter cor para (\w+)/))) return `Converter para ${L(curId('gallery_' + m[1]))} pela primeira vez`;
    if ((m = x.detail.match(/^Golden Rose nível >= (\d+)/))) return `${L('crop:goldenRose')} nível ${m[1]}`;
    if ((m = x.detail.match(/^stat village_faith\.total >= (\d+)/))) return `Total de ${L('cur:village_faith')} já ganho ≥ ${m[1]}`;
    if (/^villageLootGain/.test(x.detail)) return `Ter ${L('mult:villageLootGain')} acima de 0 (Explorer ou upgrades de loot)`;
    if ((m = x.detail.match(/^Qualquer crop atinge nível (\d+)/))) return `Qualquer crop chegar ao nível ${m[1]}`;
    return x.detail;
  });
  if (!trig.length && /Event$/.test(k)) trig.push(`Quando esse evento começa pelo calendário (${L('concept:events')}).`);
  sec(id, 'Como destrava', trig.length ? trig : 'Sem gatilho nesta versão do jogo (conteúdo futuro).');
}
for (const [p, pk] of Object.entries(st.card.pack)) if (pk.unlock) (gatedBy[pk.unlock] = gatedBy[pk.unlock] || []).push('pack:' + p);
for (const [g, gen] of Object.entries(st.general)) for (const [q, qu] of Object.entries(gen.quests)) if (qu.unlock) (gatedBy[qu.unlock] = gatedBy[qu.unlock] || []).push('quest:' + g + '.' + q);
for (const [k, u] of Object.entries(st.upgrade.item)) { const m = u.requirement.toString().match(/unlock\.(\w+)\.(see|use)/); if (m) (gatedBy[m[1]] = gatedBy[m[1]] || []).push('upg:' + k); }

// ---------- 6. Relics & glyphs ----------
const relicSrc = {};
for (const [a, ach] of Object.entries(st.achievement)) for (const [lv, r] of Object.entries(ach.relic || {})) relicSrc[r] = `Achievement ${L('ach:' + a)} nível ${+lv + 1}`;
for (const [g, gen] of Object.entries(st.general)) for (const [q, qu] of Object.entries(gen.quests)) if (qu.reward) relicSrc[qu.reward] = `Questline ${L('quest:' + g + '.' + q)} (estágio ${qu.stageLength})`;
for (const [f, fo] of Object.entries(st.gem.forge || {})) if (fo.relic) relicSrc[fo.relic] = relicSrc[fo.relic] || `Forja de ${L('cur:gem_diamond')} (${fo.price} diamonds)`;
relicSrc.friendlyBat = `${L('concept:gl')} 40`; relicSrc.notebook = `${L('concept:gl')} 100`;
for (const [k, r] of Object.entries(st.relic.item)) {
  const id = 'relic:' + k;
  add(id, { c: 'Relic', n: str(get('relic.' + k)) || k, k, f: r.feature.find(x => x !== 'general' && x !== 'achievement') || r.feature[0], d: strip(get('relic.' + k + '.description')) });
  sec(id, 'O que é', `Bônus permanente${r.active ? ' com habilidade ativa' : ''}. Features: ${r.feature.map(x => L('feat:' + x)).join(', ')}.`);
  sec(id, 'De onde vem', relicSrc[k] || 'Prêmio de evento ou loja de evento.');
  const eff = safe(r.effect, r.level || 1) || [];
  sec(id, 'Efeitos', eff.map(e => describeEff(e, id, null)));
  if (r.active) sec(id, 'Habilidade ativa', strip(get('relic.' + k + '.formula')) || 'Sim.');
  const gl = safe(r.glyph, r.level || 1);
  if (gl && Object.keys(gl).length) sec(id, 'Glyphs no Museum', Object.entries(gl).map(([gk, v]) => `${L('glyph:' + gk)} +${v}`));
}
for (const [k, g] of Object.entries(st.relic.glyph)) {
  const id = 'glyph:' + k;
  add(id, { c: 'Glyph', n: 'Glyph: ' + (str(get('relic.glyph.' + k)) || k), k, f: 'relic' });
  sec(id, 'O que é', `Nível do glyph sobe com o tempo quando relics com este glyph estão nos pedestais do ${L('concept:museum')}.`);
  sec(id, 'Efeitos por nível', (g.effect || []).map(e => describeEff(e, id, { min: 1, max: 10 })));
}

// ---------- 7. Cards ----------
for (const [id0, c] of Object.entries(st.card.card)) {
  const id = 'card:' + id0;
  add(id, { c: 'Card', n: str(get('card.card.' + id0)) || id0, k: id0, f: c.feature });
  sec(id, 'O que é', [`Carta de ${L('feat:' + c.feature)}, coleção ${L('col:' + c.collection)}. Power ${c.power === 'adaptive' ? 'adaptive (maior power entre suas cartas desta feature − 2)' : c.power}.${c.instant ? ' Instant: cópias repetidas viram recompensa na hora.' : ''}`, `Ver ${L('concept:cards')}.`]);
  const packs = Object.entries(st.card.pack).filter(([, p]) => p.content[id0]).map(([p, pk]) => `${L('pack:' + p)} — ${(pk.content[id0] / pk.cacheWeightTotal * 100).toFixed(1)}% por carta sorteada`);
  sec(id, 'De onde vem', packs.length ? packs : (c.collection === 'specialGadgets' ? `Questlines do ${L('concept:general')} entregam 6 cópias; cópias extras no Merchant.` : 'Sem fonte nesta versão.'));
  sec(id, c.instant ? 'Ao repetir' : 'Efeito quando equipada', c.reward.map(e => describeEff(e, id, null)));
}
for (const [k, col] of Object.entries(st.card.collection)) {
  const id = 'col:' + k;
  add(id, { c: 'Coleção de cards', n: str(get('card.collection.' + k)) || k, k, f: 'card' });
  sec(id, 'Cartas', col.cards.map(cid => L('card:' + cid)));
  sec(id, 'Bônus ao completar', col.reward.map(e => describeEff(e, id, null)));
}
for (const [k, p] of Object.entries(st.card.pack)) {
  const id = 'pack:' + k;
  add(id, { c: 'Card pack', n: str(get('card.pack.' + k)) || k, k, f: p.feature });
  sec(id, 'O que é', [`Pack de ${L('feat:' + p.feature)} com ${p.amount} carta(s). ${p.price ? `Custa ${p.price} ${L('cur:gem_emerald')}.` : 'Ganho como prêmio de evento.'}`, p.shinyPrice ? `Versão shiny: ${p.shinyPrice} ${L('cur:card_shinyDust')}, garante uma shiny nova.` : null].filter(Boolean));
  if (p.unlock) sec(id, 'Como destrava', `Exige ${L('unl:' + p.unlock)}.`);
  sec(id, 'Conteúdo', Object.entries(p.content).sort((a, b) => b[1] - a[1]).map(([cid, w]) => `${L('card:' + cid)} ${(w / p.cacheWeightTotal * 100).toFixed(1)}%`));
}
for (const [f, cf] of Object.entries(st.card.feature)) {
  const fid = 'feat:' + f; if (!E[fid]) continue;
  sec(fid, 'Bônus de cards', [`Por carta diferente: ${cf.reward.map(e => describeEff(e, fid, { min: 1, max: 10 })).join('; ')}`, `Por shiny: ${cf.shinyReward.map(e => describeEff(e, fid, { min: 1, max: 10 })).join('; ')}`].concat(cf.powerReward.length ? [`Por card power: ${cf.powerReward.map(e => describeEff(e, fid, { min: 1, max: 10 })).join('; ')}`] : []));
}

// ---------- 8. Achievements ----------
for (const [k, a] of Object.entries(st.achievement)) {
  const id = 'ach:' + k;
  add(id, { c: 'Achievement', n: str(get('stat.' + k + '.achievement')) || k, k, f: a.feature });
  sec(id, 'O que mede', `${str(get('stat.' + k + '.description')) || k}. ${a.secret ? 'Secreto (não dá bônus de gemas).' : `Cada nível acelera a geração de ${L('cur:gem_ruby')}/${L('cur:gem_emerald')} em +1%.`}`);
  sec(id, 'Níveis', Array.from({ length: Math.min(a.cap ?? 8, 8) }, (_, i) => `Nível ${i + 1}: ${num(safe(a.milestones, i))}` + (a.relic?.[i] ? ` → relic ${L('relic:' + a.relic[i])}` : '')));
}

// ---------- 9. Books ----------
for (const [k, b] of Object.entries(st.school.book)) {
  const id = 'book:' + k;
  const effs = b.effect.map(e => e.type === 'uncapUpgrade' ? `${str(get('gooboo.uncap'))}: ${str(get('upgrade.' + e.name)) || e.name}` : e.type === 'keepUpgrade' ? `${str(get('gooboo.keep'))}: ${str(get('upgrade.' + e.name)) || e.name}` : multName(e.name));
  add(id, { c: 'Livro', n: effs.join(' / '), k, f: b.feature });
  sec(id, 'O que é', `Livro da ${L('concept:library')} para ${L('feat:' + b.feature)} (${get('subfeature.' + b.feature)?.[b.subfeature] || 'sub ' + b.subfeature}). Só funciona com a feature nesse subfeature${b.alwaysActive ? ', mas este é sempre ativo' : ''}.`);
  sec(id, 'Como destrava', `Aparece quando a parte ${b.feature}_${b.subfeature} do ${L('concept:gl')} chega a ${b.minGL}.`);
  sec(id, 'Como é calculado', b.scalesWithGL ? `Nível = GL da parte − ${b.minGL} + 1${b.maxGL ? `, até ${b.maxGL}` : ''}.` : 'Efeito fixo.');
  sec(id, 'Efeitos', b.effect.map(e => describeEff(e, id, { min: 1, max: 50 })));
}

// ---------- 10. Generals / questlines / notes ----------
for (const [g, gen] of Object.entries(st.general)) {
  const gid = 'gen:' + g;
  add(gid, { c: 'General', n: str(get('general.' + g)) || cap1(g), k: g, f: 'general' });
  sec(gid, 'Como destrava', gen.unlock ? `${L('unl:' + gen.unlock)}${glUnlock[gen.unlock] ? ' (GL ' + glUnlock[gen.unlock] + ')' : ''}.` : `Com a feature ${L('feat:general')}.`);
  sec(gid, 'Questlines', Object.keys(gen.quests).length ? Object.keys(gen.quests).map(q => L('quest:' + g + '.' + q)) : 'Nenhuma nesta versão.');
}
for (const [g, gq] of Object.entries(D.generalsFull)) for (const [q, qu] of Object.entries(gq.quests)) {
  const id = 'quest:' + g + '.' + q;
  add(id, { c: 'Questline', n: str(get('general.' + g + '.' + q)) || q, k: g + '.' + q, f: 'general' });
  sec(id, 'O que é', [`Questline de ${L('gen:' + g)} com ${qu.stages.length} estágios. A relic ${L('relic:' + qu.reward)} sai no estágio ${qu.stageLength}; cada ciclo seguinte de ${qu.stageLength} estágios dá +20 de capacidade de ${L('cur:relic_power')}.`, `Estágios são feitos em ordem e todas as tarefas do estágio precisam valer ao mesmo tempo. ⚔ = dentro de uma mesma run.`]);
  if (qu.unlock) sec(id, 'Como destrava', `Exige ${L('unl:' + qu.unlock)}.`);
  sec(id, 'Estágios', qu.stages.map(sg => `${sg.n}${sg.isChallenge ? ' ⚔' : ''}: ${sg.tasks.join(' · ')}${sg.note ? ' → ' + L('note:' + sg.note) : ''}`));
}
for (const [k, n] of Object.entries(D.notes)) {
  const id = 'note:' + k;
  const t = get('note.text.' + k);
  const text = typeof t === 'string' ? t : (t && t.text) || null;
  const title = t && typeof t === 'object' && t.title ? t.title : null;
  add(id, { c: 'Note', n: title || `Note ${k}`, k, f: n.feature, d: strip(text) });
  sec(id, 'Como destrava', n.sources.length ? n.sources.map(x => x.upgrade ? `Comprar o 1º nível de ${L('upg:' + x.upgrade)}` : x.general ? `${L('quest:' + x.general + '.' + x.quest)} · estágio ${x.stage}` : x.crop ? `Colher ${L('crop:' + x.crop)} pela 1ª vez (${featName('farm')})` : x.how) : 'Inalcançável nesta versão.');
}

// ---------- 11. Feature-specific entities ----------
const ent = (prefix, cat, f, obj, nameFn, cb) => { for (const [k, v] of Object.entries(obj || {})) { const id = prefix + ':' + k; add(id, { c: cat, n: nameFn(k, v) || k, k, f }); cb && cb(id, k, v); } };
// Mining
ent('enh', 'Enhancement', 'mining', st.mining.enhancement, k => str(get('mining.enhancement.' + k)), (id, k, v) => { sec(id, 'O que é', `Melhoria da picareta paga com ${L('cur:mining_' + k)}. Custo em barras: 10 + 5 × nível atual. Reseta no prestige. Ver ${L('concept:enhancement')}.`); sec(id, 'Efeitos por nível', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 10 }))); });
ent('beacon', 'Beacon', 'mining', st.mining.beacon, k => str(get('mining.beacon.' + k)), (id, k, v) => { sec(id, 'O que é', `Colocado em uma profundidade da mina${v.range ? `; afeta ${v.range} profundidades abaixo` : ''}. Remover tem espera de 20h.`); sec(id, 'Efeitos', (v.effect || []).map(e => describeEff(e, id, { min: 0, max: 10 }))); });
ent('smelt', 'Smeltery', 'mining', st.mining.smeltery, k => curName('mining_bar' + cap1(k)), (id, k, v) => { const p = safe(v.price, 0) || {}; sec(id, 'O que é', [`Receita da ${L('unl:miningSmeltery')}: gera ${L(curId(v.output))}.`, `Custo da 1ª barra: ${Object.entries(p).map(([c, x]) => num(x) + ' ' + L(curId(c))).join(' + ')}.`, `Tempo base ${num(v.timeNeeded)}s, temperatura mínima ${v.minTemperature}°. Tempo ×1.045 a cada barra já feita na run; temperatura acima do mínimo acelera.`]); });
// Village
ent('job', 'Job', 'village', st.village.job, k => str(get('village.job.' + k)), (id, k, v) => { sec(id, 'O que é', 'Trabalho da Village. Moradores sem trabalho viram pagadores de impostos; as vagas vêm de buildings.'); sec(id, 'Produz por trabalhador', (v.rewards || []).map(r => describeEff({ name: r.name, type: r.type, value: r.amount }, id, null))); });
ent('policy', 'Policy', 'village', st.village.policy, k => str(get('village.policy.' + k)), (id, k, v) => { sec(id, 'O que é', 'Ajuste da Village que pode ir para positivo ou negativo; o limite vem de upgrades. Volta a 0 no prestige.'); sec(id, 'Efeitos (nível 1 → 3)', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 3 }))); });
ent('offer', 'Offering', 'village', st.village.offering, k => curName('village_' + k), (id, k, v) => { sec(id, 'O que é', [`Sacrificar ${L(curId('village_' + k))} gera ${L('cur:village_offering')}.`, `Liberado por ${L('unl:' + v.unlock)}.`]); });
ent('craft', 'Receita', 'village', st.village.crafting, k => str(get('village.crafting.' + k)), (id, k, v) => { sec(id, 'O que é', `Item do ${L('concept:crafting')}${v.isSpecial ? ' (especial: bônus permanente)' : ''}.`); const ms = Object.entries(v.milestone || {}); sec(id, 'Milestones (cada um = +1 GL)', ms.map(([n, r]) => `${num(+n)} crafts: ${r.type === 'changeStat' ? (r.name === 'timeNeeded' ? 'menos tempo' : 'mais valor') : r.type === 'villageCraft' ? 'libera ' + L('craft:' + r.name) : describeEff(r, id, null)}`)); });
// Horde
ent('equip', 'Equipamento', 'horde', st.horde.items, k => str(get('horde.equipment.' + k)), (id, k, v) => { sec(id, 'O que é', [`Equipamento da Horde (nível máximo ${v.cap ?? '∞'}).`, v.findZone ? `Pode cair a partir da zona ${v.findZone} (chance ${num(v.findChance)} por inimigo).` : (v.unlock ? `Liberado por ${L('unl:' + v.unlock)}.` : 'Disponível desde o início.'), `Ver ${L('concept:mastery')}.`]); const stt = safe(v.stats, 1) || []; sec(id, 'Atributos (nível 1)', stt.map(e => describeEff(e, id, null))); });
ent('heir', 'Heirloom', 'horde', st.horde.heirloom, k => str(get('horde.heirloom.' + k)), (id, k, v) => { sec(id, 'O que é', `Bônus permanente da Horde que acumula a cada cópia encontrada (rare loot a partir da zona 31, ou torres).`); sec(id, 'Efeito por cópia', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 10 }))); });
ent('trinket', 'Trinket', 'horde', st.horde.trinket, k => str(get('horde.trinket.' + k)), (id, k, v) => { sec(id, 'O que é', 'Item da Horde (Classes) com raridade; equipado após o prestige.'); sec(id, 'Efeitos', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 10 }))); });
ent('sigil', 'Sigil', 'horde', st.horde.sigil, k => str(get('horde.sigil.' + k)), (id, k, v) => { sec(id, 'O que é', isFinite(v.minZone ?? 0) ? `Modificador de inimigo (aparece a partir da zona ${v.minZone ?? 0}). Fica mais forte com o nível.` : 'Modificador de inimigo usado por inimigos e bosses específicos (não aparece por zona).'); });
ent('class', 'Classe', 'horde', st.horde.fighterClass, k => str(get('horde.classes.' + k + '.name')), (id, k, v) => { E[id].d = strip(get('horde.classes.' + k + '.description')); sec(id, 'Como destrava', v.unlock ? L('unl:' + v.unlock) : 'Classe inicial.'); sec(id, 'Atributos base', Object.entries(v.baseStats).map(([a, b]) => `${a}: ${num(b)}`)); sec(id, 'Habilidades', Object.keys(v.skills || {}).map(sk => str(get('horde.classes.skillName.' + sk)) || sk)); });
ent('area', 'Área', 'horde', st.horde.area, k => str(get('horde.area.' + k)), (id, k, v) => { sec(id, 'O que é', `Área da Horde (Classes) com ${Object.keys(v.zones).length} zonas.`); const b = Object.values(v.zones).find(z => z.reward); if (b) sec(id, 'Boss final', `${(b.boss || []).map(x => str(get('horde.bossName.' + x)) || x).join(' → ')} libera ${L('unl:' + b.reward)}.`); });
ent('tower', 'Torre', 'horde', st.horde.tower, k => str(get('horde.tower.' + k)), (id, k, v) => { sec(id, 'Como destrava', L('unl:' + v.unlock)); sec(id, 'Recompensas por andar', Object.entries(v.reward || {}).map(([fl, r]) => `Andar ${fl}: ${describeEff(r, id, null)}`)); });
// Farm
ent('crop', 'Crop', 'farm', st.farm.crop, k => str(get('farm.crop.' + k)), (id, k, v) => { sec(id, 'O que é', [`Crop do tipo ${v.type}: cresce em ${num(v.grow)} min, rende ${num(v.yield)} por colheita (base).`, v.type !== 'special' ? `Conta para o ${L('concept:gl')} da Farm até nível 40 (máx. 25 GL).` : 'Crop especial: bônus próprio por nível.', `Exp para subir de nível: ${num(v.baseExp)} × 1.785^nível.`]); sec(id, 'Drops raros', (v.rareDrop || []).map(r => r.type === 'consumable' ? L('cons:' + r.name) : L(curId(r.name)))); sec(id, 'Efeito especial', (v.specialEffect || []).map(e => describeEff(e, id, { min: 1, max: 10 }))); });
ent('gene', 'Gene', 'farm', st.farm.gene, k => str(get('farm.gene.' + k)) || cap1(k), (id, k, v) => { const tier = Object.entries(st.farm.geneLevels).find(([, g]) => g.includes(k)); sec(id, 'Como destrava', tier ? `Escolhido quando a crop chega ao nível ${tier[0]} (${L('unl:farmGeneLevel' + tier[0])}).` : ''); sec(id, 'Efeitos', (v.effect || []).map(e => describeEff(e, id, null))); });
ent('fbuild', 'Farm building', 'farm', st.farm.building, k => str(get('farm.building.' + k + '.name')), (id, k) => { E[id].d = strip(get('farm.building.' + k + '.description')); });
// Gallery
ent('idea', 'Ideia', 'gallery', st.gallery.idea, k => str(get('gallery.idea.' + k)), (id, k, v) => { sec(id, 'O que é', `Ideia de tier ${v.tier}; níveis custam ${L('cur:gallery_inspiration')}. Reseta no prestige.`); sec(id, 'Efeitos (nível 1 → 5)', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 5 }))); });
ent('shape', 'Shape', 'gallery', st.gallery.shape, k => str(get('gallery.shapes.' + k)) || cap1(k), (id, k, v) => { sec(id, 'O que é', v.isSpecial ? 'Forma especial do tabuleiro de shapes.' : `Forma do tabuleiro; coletar 5+ conectadas dá ${L(curId('gallery_' + k))}.`); });
// School
ent('subject', 'Matéria', 'school', st.school.subject, k => str(get('school.' + k + '.name')), (id, k, v) => { E[id].d = strip(get('school.' + k + '.description')); sec(id, 'Como destrava', v.unlock ? `${L('unl:' + v.unlock)} (GL ${glUnlock[v.unlock]})` : `Com ${L('feat:school')}.`); });
// Treasure
for (const [k, t] of Object.entries(st.treasure.effect)) { const id = 'tre:' + k; add(id, { c: 'Efeito de treasure', n: multName(k), k, f: 'treasure' }); sec(id, 'O que é', [`Efeito que pode aparecer em treasures (${t.type === 'prestige' ? 'só em treasures prestigious' : 'regular'}, tier mínimo ${t.minTier}).`, `Afeta ${L(multTarget(k).id)}.`]); idxAdd(multTarget(k).id, id, 'efeito de treasure'); }
// Consumables
for (const [k, c] of Object.entries(st.consumable)) { const id = 'cons:' + k; add(id, { c: 'Consumível', n: str(get('consumable.' + k)) || k, k, f: c.feature, d: strip(get('consumable.' + k + '.description')) }); if (c.price && Object.keys(c.price).length) sec(id, 'Custo', Object.entries(c.price).map(([cc, v]) => num(v) + ' ' + L(curId(cc)))); }

// ---------- 12. Other effect sources (indexed into "Afetado por") ----------
const fold = (owner, arr, lv) => (arr || []).forEach(e => describeEff(e, owner, lv));
for (const [k, j] of Object.entries(st.village.job)) (j.rewards || []).forEach(r => idxAdd(multTarget(r.name).id, 'job:' + k, `${r.type} ${effVal(r.type, r.amount)} por trabalhador`));
for (const [lvl, bp] of Object.entries(st.horde.battlePassEffect)) fold('concept:battlepass', bp.effect, null);
for (const [k, b] of Object.entries(st.cryolab)) b.effect.forEach((arr, i) => fold('concept:cryolab', arr, { min: 1, max: 10 }));
for (const [k, c] of Object.entries(st.village.crafting)) for (const [, r] of Object.entries(c.milestone || {})) if (!['changeStat', 'villageCraft'].includes(r.type)) describeEff(r, 'craft:' + k, null);
for (const [k, c] of Object.entries(st.horde.fighterClass)) for (const [sk, skd] of Object.entries(c.skills || {})) fold('class:' + k, skd.effect, { min: 1, max: skd.max ?? 1 });

// ---------- 13. Hand-written concepts ----------
const C = (k, n, f, secs) => { const id = 'concept:' + k; add(id, { c: 'Conceito', n, k, f }); for (const [h, b] of secs) sec(id, h, b); };
C('gl', str(get('globalLevel.name')) || 'Global level', 'meta', [
  ['O que é', `Soma de 8 partes, uma por feature/subfeature. Cada parte guarda só o seu recorde, então nunca cai. Libera features novas e ${L('concept:library')}.`],
  ['Como é calculado', ['Ore mine: profundidade máxima − 1', 'Gas giant: profundidade máxima − 1', 'Workers: soma do nível (até 25) dos 10 prédios de moradia', 'Crafters guild: milestones de crafting atingidos', 'Horde Equipment: zona máxima − 1', 'Horde Classes: nível do ' + L('concept:battlepass'), 'Farm: por crop, min(nível, nível÷2+5, 25)', 'Gallery: ⌊log₄(beauty total)⌋']],
  ['Destrava', Object.entries(glUnlock).map(([u, v]) => `GL ${v}: ${L('unl:' + u)}`)],
  ['Também', `A cada 10 GL: +1 ${L('cur:school_examPass')}. Acima de 150: bônus nos recursos do evento Snowdown.`],
]);
C('prestige', str(get('gooboo.prestige')) || 'Prestige', 'meta', [
  ['O que é', 'Reiniciar uma feature trocando o progresso da run por uma moeda permanente. Cada feature tem o seu, independente das outras.'],
  ['O que cada um gera', [`${L('feat:mining')}: ${L('cur:mining_crystalGreen')} / ${L('cur:mining_crystalYellow')} + ${L('cur:mining_ember')}`, `${L('feat:village')}: ${L('cur:village_blessing')} / ${L('cur:village_shares')}`, `${L('feat:horde')}: ${L('cur:horde_soulEmpowered')} / ${L('cur:horde_courage')}`, `${L('feat:farm')}: prestige por crop (bônus ×1.04 por nível recorde)`, `${L('feat:gallery')}: ${L('cur:gallery_cash')}`]],
  ['Detalhes', ['Upgrades de prestige e premium não resetam.', `As cards selecionadas são equipadas no momento do prestige (${L('concept:cards')}).`, `O melhor prestige alimenta o ${L('concept:cryolab')}.`]],
]);
C('overcap', 'Overcap', 'meta', [['O que é', 'Quando uma moeda passa da capacidade, algumas continuam ganhando, mas menos. Entre 1× e 2× do cap o ganho é multiplicado pelo fator de overcap; entre 2× e 3× é multiplicado de novo pelo fator de escala, e assim por diante. Cada moeda mostra os seus fatores.']]);
C('mult', 'Stat breakdown', 'meta', [['Fórmula', ['Valor = (valor inicial + soma dos efeitos "base") × produto dos efeitos "mult" + soma dos efeitos "bonus".', 'Depois aplica mínimo/máximo e arredondamento, se houver.', 'Efeitos aplicados a um grupo (ex.: Resource gain da Village) valem para todos os membros do grupo.'], ], ['Na wiki', 'Cada estatística e moeda tem uma seção "Afetado por" listando todas as fontes conhecidas: upgrades, relics, cards, livros, genes, heirlooms etc.']]);
C('dweller', str(get('mining.depthDweller')) || 'Depth dweller', 'mining', [
  ['O que é', `Desce sozinho na mina e define o prestige da ${L('feat:mining')}. Destrava com ${L('upg:mining_depthDweller')} (Ore mine) e ${L('upg:mining_gasDweller')} (Gas giant).`],
  ['Como é calculado', ['Limite = profundidade máxima DESTA run × Maximum dweller depth (base 10%, máx. 50%).', 'Corre rápido no começo e desacelera perto do limite.', 'Depois do limite continua bem devagar (overcap linear).', 'Cristais = 7 × s × 1.15^(s/2) × multiplicador, com s = 2 × profundidade do dweller.']],
]);
C('enhancement', str(get('mining.enhancement.title')) || 'Enhancements', 'mining', [['O que é', `Gastar barras da smeltery para melhorar a picareta. Cada barra tem seu enhancement. Enquanto houver enhancements ativos não cai obsidian. Reseta no prestige.`], ['Lista', Object.keys(st.mining.enhancement).map(k => L('enh:' + k))]]);
C('combo', 'Combo', 'horde', [['O que é', 'Cada kill aumenta o combo: inimigos ficam mais fortes (ataque ×1.025, vida ×1.01 por combo) e você ganha +1.2% de bone por combo.'], ['Boss', 'O boss aparece com combo = 2 × zona + 20 (reduzido por recordes acima da zona 20). Derrotar o boss avança a zona.']]);
C('rareloot', str(get('horde.rareLoot')) || 'Rare loot', 'horde', [['O que é', `Drops especiais a partir da zona 21: ${L('cur:horde_soulCorrupted')} e chance de ${L('concept:heirlooms')}.`], ['Como é calculado', 'Almas por drop = 1.1^(zona−21) × (zona−20) × multiplicador, usando a zona máxima da run. O cap de almas usa o recorde de todos os tempos.']]);
C('heirlooms', str(get('horde.heirloom.tabName')) || 'Heirlooms', 'horde', [['O que é', 'Bônus permanentes que crescem a cada cópia. Chance base 1% + 0,1% por zona acima de 30.'], ['Lista', Object.keys(st.horde.heirloom).map(k => L('heir:' + k))]]);
C('mastery', str(get('horde.itemMastery.name')) || 'Mastery', 'horde', [['O que é', 'Destrava depois da zona 74. Equipamentos ganham mastery acima da zona 75. Mastery 1 mantém o item encontrado e mastery 3 mantém o nível no prestige.']]);
C('battlepass', str(get('horde.battlePass.name')) || 'Battle pass', 'horde', [['O que é', `Nível = quests de classe concluídas (boss vale 2). É a parte "Classes" do ${L('concept:gl')}.`], ['Recompensas', Object.entries(st.horde.battlePassEffect).map(([l, bp]) => `Nível ${l}: ${(bp.effect || []).map(e => e.type === 'unlock' ? L('unl:' + e.name) : multName(e.name)).join(', ')}`)]]);
C('crafting', get('subfeature.village')[1], 'village', [['O que é', `Subfeature 1 da ${L('feat:village')} (GL 800). Cria itens com recursos; vender gera Copper coin, que vira ${L('cur:village_shares')} no prestige.`], ['Milestones', `Cada receita tem milestones por quantidade criada (não reseta). Cada milestone vale +1 ${L('concept:gl')}.`]]);
C('cards', featName('card'), 'card', [
  ['O que é', `Cartas de cada feature. Destrava em GL 80. Vêm de ${L('concept:cardpack')}.`],
  ['Bônus', ['Coleção da feature: bônus por carta diferente encontrada.', 'Shiny: bônus por carta shiny encontrada.', 'Coleção completa: bônus fixo, às vezes +1 slot.', 'Equipadas: efeito da carta + bônus exponencial pelo card power somado.']],
  ['Equipar', ['Slots por feature: 1 + coleções/relics.', 'As cartas selecionadas só ficam equipadas no próximo prestige, e isso gasta 1 cópia de cada (precisa sobrar 1).', 'A seleção é zerada depois de cada prestige: selecione de novo antes do próximo.']],
]);
C('cardpack', str(get('card.cardPack')) || 'Card pack', 'card', [['O que é', `Comprados com ${L('cur:gem_emerald')}; cada pack sorteia cartas de uma feature e exige um unlock.`], ['Lista', Object.keys(st.card.pack).map(k => L('pack:' + k))]]);
C('shiny', str(get('card.shinyTitle')) || 'Shiny cards', 'card', [['O que é', `Destrava com a relic ${L('relic:deckOfCards')}. Cada carta aberta tem 1,5% de chance de ser shiny. Shiny repetida vira ${L('cur:card_shinyDust')}.`]]);
C('general', featName('general'), 'general', [['O que é', `Personagens com questlines que cruzam várias features. Cada questline termina numa relic que costuma abrir um sistema novo.`], ['Generals', Object.keys(st.general).map(g => L('gen:' + g))]]);
C('library', str(get('school.library')) || 'Library', 'school', [['O que é', `Parte da ${L('feat:school')} liberada pela relic ${L('relic:dustyBook')}. Livros aparecem conforme a parte da feature no ${L('concept:gl')}.`]]);
C('museum', str(get('relic.museum')) || 'Museum', 'relic', [['O que é', `Liberado pela relic ${L('relic:museumKey')}. 3 pedestais; relics colocadas neles fazem os glyphs subirem de nível com o tempo.`]]);
C('cryolab', featName('cryolab'), 'cryolab', [['O que é', 'Congelar uma feature (GL 290): ela para, mas gera moeda de prestige por dia com base no seu melhor prestige e ganha exp de cryolab.'], ['Como é calculado', ['Ativo (congelada): 20% + 1% por nível do melhor prestige por dia (Village: 8% + 0,4%).', 'Passivo (mesmo sem congelar): 0,5% por nível por dia.', 'Exp por dia = 1.015^GL × GL × 2, usando a parte do GL da feature.', 'Cada nível também dá ×1.15 no ganho de prestige daquela feature.']]]);
C('events', featName('event'), 'event', [['O que é', `Eventos por calendário (GL 150). Grandes: Cinders (15/01), Bloom (09/03), Weather Chaos (22/05), Summer Festival (26/07), Night Hunt (04/10), Snowdown (25/11). Pequenos: Merchant, Casino, Bank.`], ['Detalhes', `Durante eventos grandes, ${L('cur:gem_topaz')} vira moeda do evento.`]]);

// ---------- 14. "Afetado por" + "Usado em" + "Bloqueia" sections ----------
const groupsOf = {}; for (const [n, m] of Object.entries(st.mult.items)) (m.group || []).forEach(g => (groupsOf[g] = groupsOf[g] || []).push(n));
const ancestors = (n, seen = new Set()) => { (groupsOf[n] || []).forEach(p => { if (!seen.has(p)) { seen.add(p); ancestors(p, seen); } }); return [...seen]; };
const fmtIdx = (target) => (effectIndex[target] || []).map(x => `${L(x.src)}: ${x.txt}`);
for (const [id, e] of Object.entries(E)) {
  if (id.startsWith('cur:')) {
    const k = id.slice(4); const [f, n] = [k.split('_')[0], k.split('_').slice(1).join('_')];
    const gainName = G['currency/gainMultName'] ? safe(G['currency/gainMultName'], f, n) : null;
    const capName = G['currency/capMultName'] ? safe(G['currency/capMultName'], f, n) : null;
    const gainSrc = (effectIndex[id] || []).filter(x => x.txt.startsWith('ganho')).map(x => `${L(x.src)}: ${x.txt.replace(/^ganho /, '')}`);
    const capSrc = (effectIndex[id] || []).filter(x => x.txt.startsWith('capacidade')).map(x => `${L(x.src)}: ${x.txt.replace(/^capacidade /, '')}`);
    const grp = [gainName, capName].filter(Boolean).flatMap(nm => ancestors(nm)).map(a => `Também via grupo ${L(multTarget(a).id)}`);
    if (gainSrc.length || capSrc.length) sec(id, 'Como é calculado', `Ganho e capacidade seguem ${L('concept:mult')}: (base) × multiplicadores + bônus.`);
    if (gainSrc.length) sec(id, 'Ganho afetado por', gainSrc);
    if (capSrc.length) sec(id, 'Capacidade afetada por', capSrc);
    if (grp.length) sec(id, 'Grupos', [...new Set(grp)]);
    const used = priceIdx[k] || [];
    if (used.length) sec(id, 'Usada para comprar', used.slice(0, 60).map(u => L('upg:' + u)).concat(used.length > 60 ? [`… e mais ${used.length - 60}`] : []));
  } else if (id.startsWith('mult:')) {
    const n = id.slice(5);
    const src = fmtIdx(id);
    const grp = ancestors(n).map(a => `Também tudo que afeta o grupo ${L(multTarget(a).id)}`);
    sec(id, 'Afetado por', src.concat(grp));
  } else if (id.startsWith('unl:')) {
    const g = gatedBy[id.slice(4)] || [];
    if (g.length) sec(id, 'O que este unlock libera', g.map(x => L(x)));
  } else if (['upg:', 'cons:', 'craft:', 'crop:', 'idea:', 'shape:', 'job:'].some(p => id.startsWith(p))) {
    const src = fmtIdx(id);
    if (src.length) sec(id, 'Mencionado por', src);
  }
}

// ---------- 14b. names exactly as the UI shows them ----------
// Regra: o nome é o texto da interface (lang/en.js). Quando a interface não exibe um nome próprio,
// usa-se o rótulo da interface que aquele item revela (aba, título, pack); só sem nada disso cai num nome descritivo (nui).
const human = (k) => k.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const packNames = (unl) => Object.entries(st.card.pack).filter(([, p]) => p.unlock === unl).map(([k]) => str(get('card.pack.' + k)) || k);
const UNLOCK_UI = {
  villagePrestige: () => str(get('gooboo.prestige')),
  villageLoot: () => str(get('village.loot')),
  villageOffering5: () => str(get('village.offering.name')),
  hordeEquipment: () => str(get('horde.equipment.name')),
  hordeDamageTypes: () => str(get('horde.damageTypes.title')),
  hordePrestige: () => str(get('gooboo.prestige')),
  hordeHeirlooms: () => str(get('horde.heirloom.tabName')),
  hordeRaidboss: () => str(get('horde.raidboss')),
  hordeEquipmentMastery: () => str(get('horde.itemMastery.name')),
  hordeEndOfContent: () => str(get('endOfContent.name')) || (get('endOfContent') || {}).name,
};
const nameUnlock = (k) => {
  if (UNLOCK_UI[k]) { const v = UNLOCK_UI[k](); if (v) return [v, false]; }
  let m;
  if ((m = k.match(/^(\w+)Subfeature$/)) && str(get('feature.' + m[1]))) return [str(get('feature.' + m[1])), false];
  if ((m = k.match(/^horde(\w+)Tower$/)) && str(get('horde.tower.' + m[1].toLowerCase()))) return [str(get('horde.tower.' + m[1].toLowerCase())), false];
  if ((m = k.match(/^farmGeneLevel(\d+)$/))) return [String(get('farm.gene.pickLevel')).replace('{0}', m[1]), false];
  if (/CardPack$/.test(k) && packNames(k).length) return [packNames(k).join(' / '), false];
  if ((m = k.match(/^(\w+?)CasinoEvent$/))) return [str(get('event.casino.name')), false];
  if ((m = k.match(/^(\w+?)Event$/)) && str(get('event.' + m[1] + '.name'))) return [str(get('event.' + m[1] + '.name')), false];
  return [human(k), true];
};
for (const e of Object.values(E)) {
  if (e.n !== e.k) continue;
  let n = null, nui = true, m;
  if (e.id.startsWith('unl:')) [n, nui] = nameUnlock(e.k);
  else if (e.id.startsWith('mult:')) {
    if ((m = e.k.match(/^(\w+)Cryolab(Active|Passive)(\d)$/))) { n = str(get(m[2] === 'Active' ? 'cryolab.activeTitle' : 'cryolab.passiveTitle')); nui = false; }
    else if ((m = e.k.match(/^(\w+)HeirloomEffect$/)) && str(get('horde.heirloom.' + m[1]))) { n = `${str(get('horde.heirloom.' + m[1]))} effect`; nui = false; } // mesmo padrão de "Power effect"
    else if ((m = e.k.match(/^gallery([\w-]+)(Conversion|DrumChance)$/))) { const ck = 'gallery_' + m[1][0].toLowerCase() + m[1].slice(1); const has = !!str(get('currency.' + ck)); const c = has ? curName(ck).replace(/ paint$/, '') : human(m[1]); n = `${c} ${m[2] === 'Conversion' ? 'conversion' : 'drum chance'}`; nui = !has; } // padrão "Red conversion"
    else if (e.k === 'allPrestigeIncome') n = 'All prestige income';
    else n = human(e.k);
  } else n = human(e.k);
  e.n = n || human(e.k); if (nui) e.nui = true;
}
for (const e of Object.values(E)) if (e.id.startsWith('heir:')) e.s.forEach(x => { x.b = x.b.map(t => t.replace(/\(nível (\d+)\)/, '($1 cópias)')); });
for (const e of Object.values(E)) if (e.id.startsWith('cur:') && !str(get('currency.' + e.k))) { e.n = human(e.k.split('_').slice(1).join('_')); e.nui = true; }
// Notes: a interface mostra o botão "#N" (id + 1) dentro da lista da feature.
for (const e of Object.values(E)) if (e.id.startsWith('note:')) { const [nf, nn] = e.k.split('_'); e.n = `${featName(nf)} #${+nn + 1}`; }

// ---------- 15. finalize: resolve dangling links, drop empties ----------
const out = [];
const missing = new Set();
const fixLinks = (t) => t.replace(/\{\{([^}]+)\}\}/g, (m, id) => { if (E[id]) return m; missing.add(id); return `«${id.split(':').slice(1).join(':')}»`; });
for (const e of Object.values(E)) {
  e.s = e.s.map(x => ({ h: x.h, b: x.b.filter(Boolean).map(fixLinks) })).filter(x => x.b.length);
  if (e.d) e.d = fixLinks(e.d);
  let col = null;
  if (e.id.startsWith('cur:')) col = st.currency[e.k]?.color; else if (e.id.startsWith('relic:')) col = st.relic.item[e.k]?.color; else if (e.id.startsWith('card:')) col = st.card.card[e.k]?.color;
  out.push({ id: e.id, c: e.c, n: e.n, k: e.k, f: e.f, d: e.d || null, s: e.s, col: typeof col === 'string' ? col : null, nui: e.nui || undefined });
}
fs.writeFileSync('glossary.json', JSON.stringify(out));
const cats = {}; out.forEach(e => cats[e.c] = (cats[e.c] || 0) + 1);
console.log(out.length, 'entries', (JSON.stringify(out).length / 1e6).toFixed(2) + 'MB'); console.log(cats); console.log('missing links', missing.size, [...missing].slice(0, 30));
