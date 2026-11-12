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
  if (type === 'bonus') return (v >= 0 ? '+' : '') + num(v) + ' (added at the end)';
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
      vt = first !== null && levels ? ` (level ${first})` : '';
    } else if (levels) {
      const a = safe(v, levels.min ?? 1), b = levels.max > 1 ? safe(v, levels.max) : null;
      vt = ' ' + effVal(e.type, a) + (b !== null && b !== a ? ` → ${effVal(e.type, b)} (level ${levels.max})` : '');
    } else vt = ' ' + effVal(e.type, safe(v, 1));
  } else vt = ' ' + effVal(e.type, v);
  let txt;
  switch (e.type) {
    case 'unlock': txt = `Unlocks ${L('unl:' + e.name)}${vt}`; idxAdd('unl:' + e.name, src, `unlocks it${vt}`); break;
    case 'keepUpgrade': txt = `Keeps ${L('upg:' + e.name)} when you prestige${vt}`; idxAdd('upg:' + e.name, src, 'keeps it when you prestige' + vt); break;
    case 'uncapUpgrade': txt = `Removes the level cap of ${L('upg:' + e.name)}${vt}`; idxAdd('upg:' + e.name, src, 'removes its level cap' + vt); break;
    case 'findConsumable': txt = `Unlocks the consumable ${L('cons:' + e.name)}${vt}`; idxAdd('cons:' + e.name, src, 'unlocks it' + vt); break;
    case 'gainConsumable': txt = `Gives ${L('cons:' + e.name)}${vt}`; idxAdd('cons:' + e.name, src, 'gives' + vt); break;
    case 'villageCraft': txt = `Unlocks the recipe ${L('craft:' + e.name)}${vt}`; idxAdd('craft:' + e.name, src, 'unlocks it' + vt); break;
    case 'farmSeed': txt = `Unlocks the seed ${L('crop:' + e.name)}${vt}`; idxAdd('crop:' + e.name, src, 'unlocks it' + vt); break;
    case 'galleryIdea': txt = `Unlocks the idea ${L('idea:' + e.name)}${vt}`; idxAdd('idea:' + e.name, src, 'unlocks it' + vt); break;
    case 'galleryShape': txt = `Unlocks the shape ${L('shape:' + e.name)}${vt}`; idxAdd('shape:' + e.name, src, 'unlocks it' + vt); break;
    case 'villageJob': txt = `Job slots for ${L('job:' + e.name)}${vt}`; idxAdd('job:' + e.name, src, 'job slots' + vt); break;
    case 'tag': txt = `Special effect: ${strip(str(get('tag.' + e.name))) || e.name}`; break;
    case 'text': txt = strip(str(get('mult.' + e.name)) || e.name); break;
    case 'currency': txt = `Gives ${L(curId(e.name))}${vt}`; idxAdd(curId(e.name), src, 'gives' + vt); break;
    case 'consumable': txt = `Gives ${L('cons:' + e.name)}${vt}`; idxAdd('cons:' + e.name, src, 'gives' + vt); break;
    case 'addRareDrop': txt = `Adds the rare drop ${L(curId(e.name))}${vt}`; idxAdd(curId(e.name), src, 'rare drop'); break;
    case 'addRareDropAmount': txt = `More of the rare drop ${L(curId(e.name))}${vt}`; break;
    case 'farmTile': txt = `More field cells in the Farm${vt}`; break;
    case 'farmBuilding': txt = `One more ${L('fbuild:' + e.name)} to place on the field${vt}`; idxAdd('fbuild:' + e.name, src, 'gives' + vt); break;
    case 'farmBuildingPremium': txt = `Premium ${L('fbuild:' + e.name)}${vt}`; idxAdd('fbuild:' + e.name, src, 'premium' + vt); break;
    case 'farmCareImprove': txt = `Better ${e.name} care${vt}`; break;
    case 'farmCareDisable': txt = `Turns off ${e.name} care`; break;
    case 'farmCareAdd': txt = `Adds ${e.name} care`; break;
    default: {
      const t = multTarget(e.name);
      const label = t.kind === 'gain' ? 'gain' : t.kind === 'cap' ? 'capacity' : t.kind === 'upcap' ? 'max level' : '';
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
  if (ul && glUnlock[ul] !== undefined) sec(id, 'Como destrava', `Reach ${L('concept:gl')} ${glUnlock[ul]}.`);
  else if (!ul) sec(id, 'Como destrava', 'Open from the start.');
  const subs = get('subfeature.' + f);
  if (subs && typeof subs === 'object') sec(id, 'Subfeatures', Object.entries(subs).map(([i, n]) => `${n} (${i})` + (fd.subfeatures[i - 1] && glUnlock[fd.subfeatures[i - 1]] ? ` — opens at GL ${glUnlock[fd.subfeatures[i - 1]]}` : '')));
}

// ---------- 2. Currencies ----------
const priceIdx = {};
for (const [k, u] of Object.entries(st.upgrade.item)) { const p = safe(u.price, 0) || {}; for (const c of Object.keys(p)) (priceIdx[c] = priceIdx[c] || []).push(k); }
const PRESTIGE_SRC = {
  mining_crystalGreen: 'Ore mine prestige: you get it from the Depth dweller.', mining_crystalYellow: 'Gas giant prestige: you get it from the Depth dweller.',
  mining_ember: 'Mining prestige: ⌊Ember gain × dweller depth⌋.', village_blessing: 'Village (Workers) prestige: you get as much as the Faith you hold.',
  village_shares: 'Crafters guild prestige: Copper coin ÷ 1000 × multiplier (needs at least 10).', horde_soulEmpowered: 'Horde (Equipment) prestige: you get as many as the Corrupted souls you hold.',
  horde_courage: 'Horde (Classes) prestige: this run\'s courage score × multiplier.', gallery_cash: 'Gallery prestige: 10^(log₈(beauty ÷ 1e11)^0.7) × multiplier. This run needs 1e12 beauty.',
};
for (const [k, c] of Object.entries(st.currency)) {
  const [f] = k.split('_');
  const isGem = f === 'gem';
  const id = curId(k);
  add(id, { c: isGem ? 'Gema' : 'Moeda', n: curName(k), k, f, d: strip(get('currency.' + k + '.description')) });
  const info = [];
  info.push(`Feature: ${st.system.features[f] ? L('feat:' + f) : featName(f)}${c.type === 'prestige' ? ' · **prestige** currency (you keep it)' : c.type === 'regular' ? ' · goes back to 0 when you prestige this feature' : ''}.`);
  if (c.cap !== null && c.cap !== undefined) info.push(`It has a capacity. ${c.overcapMult > 0 ? `Above it you still gain, but less: ×${num(c.overcapMult)} for the first step over, then ×${num(c.overcapScaling)} more for each further step (${L('concept:overcap')}).` : 'Above it you gain nothing.'}`);
  sec(id, 'O que é', info);
  if (PRESTIGE_SRC[k]) sec(id, 'De onde vem', PRESTIGE_SRC[k]);
}

// ---------- 3. Upgrades ----------
const statName = (k) => {
  if (k === 'custom_hordeBattlepass') return `${L('concept:battlepass')} level`;
  if (k === 'farm_seedBox') return `highest level of ${L('upg:farm_seedBox')}`;
  const d = str(get('stat.' + k + '.description')); if (d) return d;
  if (st.currency[k]) return `total ${L(curId(k))} ever gained`;
  return k;
};
const statReq = (k, op, v) => (st.currency[k] && (op === '>' && +v === 0)) ? `having gained ${L(curId(k))} at least once` : `${statName(k)}${k.startsWith('custom') || k === 'farm_seedBox' ? '' : ' (record)'} ${op === '>=' ? '≥' : op} ${num(+v)}`;
const reqText = (u) => {
  if (u.requirementStat) return statReq(u.requirementStat, '>=', u.requirementValue);
  const src = u.requirement.toString().replace(/\s+/g, ' ').replace(/store_default/g, 'store');
  if (/=> true/.test(src) || /return true/.test(src)) return null;
  let m;
  if ((m = src.match(/unlock\.(\w+)\.(see|use)/))) return `${L('unl:' + m[1])} is unlocked`;
  if ((m = src.match(/stat(?:\.|\[")([\w-]+)"?\]?\.total\s*(>=|>)\s*(\d+)/))) return statReq(m[1], m[2], m[3]);
  if ((m = src.match(/upgrade\.item\.(\w+)\.(\w+)\s*(>=|>)\s*(\d+)/))) return `${L('upg:' + m[1])} level ${m[3]} ${m[4]}`;
  if ((m = src.match(/gallery\.shape\.(\w+)\.unlocked/))) return `you have the shape ${L('shape:' + m[1])}`;
  return 'a special condition';
};
const TYPE_PT = { regular: 'Upgrade', building: 'Building', prestige: 'Upgrade de prestige', premium: 'Upgrade premium', shape: 'Upgrade de shapes' };
for (const [k, u] of Object.entries(st.upgrade.item)) {
  const id = 'upg:' + k;
  const n = str(get('upgrade.' + k)) || k;
  const cat = u.feature === 'event' ? 'Upgrade de evento' : (TYPE_PT[u.type] || 'Upgrade');
  add(id, { c: cat, n, k, f: u.feature, d: strip(get('upgrade.description.' + k)) });
  const sub = get('subfeature.' + u.feature)?.[u.subfeature];
  const what = [`${{ 'Upgrade': 'Upgrade', 'Building': 'Building', 'Upgrade de prestige': 'Prestige upgrade', 'Upgrade premium': 'Premium upgrade', 'Upgrade de shapes': 'Shape upgrade', 'Upgrade de evento': 'Event upgrade' }[cat] || cat} in ${L('feat:' + u.feature)}${sub && u.feature !== 'event' ? ' · ' + sub : ''}. ${u.cap === null ? 'No level cap.' : 'Max level ' + u.cap + '.'}`];
  if (u.type === 'prestige') what.push('Bought with a prestige currency; you **keep it** when you prestige.');
  if (u.type === 'premium') what.push('Bought with gems; you keep it forever.');
  if (u.type === 'regular' || u.type === 'building') what.push(u.persistent ? 'Persistent: you keep it when you prestige.' : 'Goes back to 0 when you prestige this feature.');
  if (u.mode === 'queue') what.push('Built in a queue, so each level takes time.');
  sec(id, 'O que é', what);
  const r = reqText(u); sec(id, 'Como destrava', r ? `Shows up when ${r}.` : 'Shows up as soon as its feature or tab is open.');
  const p = safe(u.price, 0);
  if (p && Object.keys(p).length) {
    const p2 = u.cap === null || u.cap >= 2 ? safe(u.price, Math.min(u.cap ?? 10, 10) - 1) : null;
    sec(id, 'Custo', [`Level 1: ${Object.entries(p).map(([c, v]) => num(v) + ' ' + L(curId(c))).join(' + ')}`].concat(p2 ? [`Level ${Math.min(u.cap ?? 10, 10)}: ${Object.entries(p2).map(([c, v]) => num(v) + ' ' + L(curId(c))).join(' + ')}`] : []));
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
  const what = [`A value in ${st.system.features[m.feature] ? L('feat:' + m.feature) : featName(m.feature)}. It starts at ${num(m.baseValue)} (some parts of the game add their own base, like pickaxe power for Damage).` + (m.min !== null ? ` Lowest value: ${num(m.min)}.` : '') + (m.max !== null ? ` Highest value: ${num(m.max)}.` : '')];
  if (m.unlock) what.push(`Only shows up after ${L('unl:' + m.unlock)}.`);
  sec(id, 'O que é', what);
  if (m.group && m.group.length) sec(id, 'Grupo', `Anything that raises this value also raises: ${m.group.map(g => L(multTarget(g).id)).join(', ')}.`);
}

// ---------- 5. Unlocks ----------
const gatedBy = {}; // unlock -> [ids]
for (const [k, u] of Object.entries(st.unlock)) {
  const id = 'unl:' + k;
  add(id, { c: 'Unlock', n: str(get('unlock.' + k)) || (k.endsWith('Feature') ? featName(k.replace('Feature', '')) : k), k, f: (k.match(/^(mining|village|horde|farm|gallery|gem|school|relic|card|general|event|treasure|cryolab|achievement)/) || [, 'meta'])[1] });
  const trig = (D.unlockTriggers[k] || []).filter(x => x.source !== 'cardPack(usa)').map(x => {
    if (x.source === 'globalLevel') return `${L('concept:gl')} ${x.detail.replace('GL ', '')}`;
    if (x.source === 'upgrade') { const [uk, , lv] = x.detail.split(' '); return `${L('upg:' + uk)} level ${lv}`; }
    if (x.source === 'relic') return `Relic ${L('relic:' + x.detail)}`;
    if (x.source === 'hordeBattlePass') return `${L('concept:battlepass')} ${x.detail.replace(/.*nível /, 'level ')}`;
    if (x.source === 'hordeTower') { const m = x.detail.match(/Torre (\w+) andar (\d+)/); return `${L('tower:' + m[1])} floor ${m[2]}`; }
    if (x.source === 'hordeBoss') { const m = x.detail.match(/área (\w+)/); return `Beat the final boss of ${L('area:' + m[1])}`; }
    let m;
    if ((m = x.detail.match(/^Horde maxZone total ([>=]+) (\d+)(.*)$/))) return `Highest ${L('feat:horde')} zone ever ${m[1]} ${m[2]}${m[3]}`;
    if ((m = x.detail.match(/^Mining maxDepth0 >= (\d+)$/))) return `Deepest ${L('feat:mining')} depth ever ≥ ${m[1]}`;
    if ((m = x.detail.match(/^Ganhar (\w+) pela primeira vez$/))) return `Gain ${L(curId(m[1]))} for the first time`;
    if ((m = x.detail.match(/^Converter cor para (\w+)/))) return `Convert to ${L(curId('gallery_' + m[1]))} for the first time`;
    if ((m = x.detail.match(/^Golden Rose nível >= (\d+)/))) return `${L('crop:goldenRose')} level ${m[1]}`;
    if ((m = x.detail.match(/^stat village_faith\.total >= (\d+)/))) return `Total ${L('cur:village_faith')} ever gained ≥ ${m[1]}`;
    if (/^villageLootGain/.test(x.detail)) return `${L('mult:villageLootGain')} above 0 (from explorers or loot upgrades)`;
    if ((m = x.detail.match(/^Qualquer crop atinge nível (\d+)/))) return `Any crop reaches level ${m[1]}`;
    return x.detail;
  });
  if (!trig.length && /Event$/.test(k)) trig.push(`When this event starts on the calendar (${L('concept:events')}).`);
  sec(id, 'Como destrava', trig.length ? trig : 'Nothing unlocks it in this version of the game (future content).');
}
for (const [p, pk] of Object.entries(st.card.pack)) if (pk.unlock) (gatedBy[pk.unlock] = gatedBy[pk.unlock] || []).push('pack:' + p);
for (const [g, gen] of Object.entries(st.general)) for (const [q, qu] of Object.entries(gen.quests)) if (qu.unlock) (gatedBy[qu.unlock] = gatedBy[qu.unlock] || []).push('quest:' + g + '.' + q);
for (const [k, u] of Object.entries(st.upgrade.item)) { const m = u.requirement.toString().match(/unlock\.(\w+)\.(see|use)/); if (m) (gatedBy[m[1]] = gatedBy[m[1]] || []).push('upg:' + k); }

// ---------- 6. Relics & glyphs ----------
const relicSrc = {};
for (const [a, ach] of Object.entries(st.achievement)) for (const [lv, r] of Object.entries(ach.relic || {})) relicSrc[r] = `Achievement ${L('ach:' + a)} level ${+lv + 1}`;
for (const [g, gen] of Object.entries(st.general)) for (const [q, qu] of Object.entries(gen.quests)) if (qu.reward) relicSrc[qu.reward] = `Questline ${L('quest:' + g + '.' + q)} (stage ${qu.stageLength})`;
for (const [f, fo] of Object.entries(st.gem.forge || {})) if (fo.relic) relicSrc[fo.relic] = relicSrc[fo.relic] || `${L('cur:gem_diamond')} forge (${fo.price} diamonds)`;
relicSrc.friendlyBat = `${L('concept:gl')} 40`; relicSrc.notebook = `${L('concept:gl')} 100`;
for (const [k, r] of Object.entries(st.relic.item)) {
  const id = 'relic:' + k;
  add(id, { c: 'Relic', n: str(get('relic.' + k)) || k, k, f: r.feature.find(x => x !== 'general' && x !== 'achievement') || r.feature[0], d: strip(get('relic.' + k + '.description')) });
  sec(id, 'O que é', `A permanent bonus${r.active ? ' with an active ability' : ''}. Features: ${r.feature.map(x => L('feat:' + x)).join(', ')}.`);
  sec(id, 'De onde vem', relicSrc[k] || 'An event prize or an event shop.');
  const eff = safe(r.effect, r.level || 1) || [];
  sec(id, 'Efeitos', eff.map(e => describeEff(e, id, null)));
  if (r.active) sec(id, 'Habilidade ativa', strip(get('relic.' + k + '.formula')) || 'Yes.');
  const gl = safe(r.glyph, r.level || 1);
  if (gl && Object.keys(gl).length) sec(id, 'Glyphs no Museum', Object.entries(gl).map(([gk, v]) => `${L('glyph:' + gk)} +${v}`));
}
for (const [k, g] of Object.entries(st.relic.glyph)) {
  const id = 'glyph:' + k;
  add(id, { c: 'Glyph', n: 'Glyph: ' + (str(get('relic.glyph.' + k)) || k), k, f: 'relic' });
  sec(id, 'O que é', `The glyph levels up over time while relics with this glyph sit on the pedestals of the ${L('concept:museum')}.`);
  sec(id, 'Efeitos por nível', (g.effect || []).map(e => describeEff(e, id, { min: 1, max: 10 })));
}

// ---------- 7. Cards ----------
for (const [id0, c] of Object.entries(st.card.card)) {
  const id = 'card:' + id0;
  add(id, { c: 'Card', n: str(get('card.card.' + id0)) || id0, k: id0, f: c.feature });
  sec(id, 'O que é', [`A ${L('feat:' + c.feature)} card in the collection ${L('col:' + c.collection)}. Power ${c.power === 'adaptive' ? 'adaptive (your highest card power in this feature − 2)' : c.power}.${c.instant ? ' Instant: extra copies give their reward right away.' : ''}`, `See ${L('concept:cards')}.`]);
  const packs = Object.entries(st.card.pack).filter(([, p]) => p.content[id0]).map(([p, pk]) => `${L('pack:' + p)} — ${(pk.content[id0] / pk.cacheWeightTotal * 100).toFixed(1)}% per card drawn`);
  sec(id, 'De onde vem', packs.length ? packs : (c.collection === 'specialGadgets' ? `${L('concept:general')} questlines give 6 copies; the Merchant sells more.` : 'No source in this version.'));
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
  sec(id, 'O que é', [`A ${L('feat:' + p.feature)} pack with ${p.amount} card${p.amount === 1 ? '' : 's'}. ${p.price ? `Costs ${p.price} ${L('cur:gem_emerald')}.` : 'You get it as an event prize.'}`, p.shinyPrice ? `Shiny version: ${p.shinyPrice} ${L('cur:card_shinyDust')}; it always gives a new shiny.` : null].filter(Boolean));
  if (p.unlock) sec(id, 'Como destrava', `Needs ${L('unl:' + p.unlock)}.`);
  sec(id, 'Conteúdo', Object.entries(p.content).sort((a, b) => b[1] - a[1]).map(([cid, w]) => `${L('card:' + cid)} ${(w / p.cacheWeightTotal * 100).toFixed(1)}%`));
}
for (const [f, cf] of Object.entries(st.card.feature)) {
  const fid = 'feat:' + f; if (!E[fid]) continue;
  sec(fid, 'Bônus de cards', [`Per different card: ${cf.reward.map(e => describeEff(e, fid, { min: 1, max: 10 })).join('; ')}`, `Per shiny: ${cf.shinyReward.map(e => describeEff(e, fid, { min: 1, max: 10 })).join('; ')}`].concat(cf.powerReward.length ? [`Per card power: ${cf.powerReward.map(e => describeEff(e, fid, { min: 1, max: 10 })).join('; ')}`] : []));
}

// ---------- 8. Achievements ----------
for (const [k, a] of Object.entries(st.achievement)) {
  const id = 'ach:' + k;
  add(id, { c: 'Achievement', n: str(get('stat.' + k + '.achievement')) || k, k, f: a.feature });
  sec(id, 'O que mede', `${str(get('stat.' + k + '.description')) || k}. ${a.secret ? 'Secret (gives no gem bonus).' : `Each level makes ${L('cur:gem_ruby')} and ${L('cur:gem_emerald')} grow 1% faster.`}`);
  sec(id, 'Níveis', Array.from({ length: Math.min(a.cap ?? 8, 8) }, (_, i) => `Level ${i + 1}: ${num(safe(a.milestones, i))}` + (a.relic?.[i] ? ` → relic ${L('relic:' + a.relic[i])}` : '')));
}

// ---------- 9. Books ----------
for (const [k, b] of Object.entries(st.school.book)) {
  const id = 'book:' + k;
  const effs = b.effect.map(e => e.type === 'uncapUpgrade' ? `${str(get('gooboo.uncap'))}: ${str(get('upgrade.' + e.name)) || e.name}` : e.type === 'keepUpgrade' ? `${str(get('gooboo.keep'))}: ${str(get('upgrade.' + e.name)) || e.name}` : multName(e.name));
  add(id, { c: 'Livro', n: effs.join(' / '), k, f: b.feature });
  sec(id, 'O que é', `A ${L('concept:library')} book for ${L('feat:' + b.feature)} (${get('subfeature.' + b.feature)?.[b.subfeature] || 'sub ' + b.subfeature}). ${b.alwaysActive ? 'It always works.' : 'It only works while that subfeature is open.'}`);
  sec(id, 'Como destrava', `Shows up when the ${b.feature}_${b.subfeature} part of your ${L('concept:gl')} reaches ${b.minGL}.`);
  sec(id, 'Como é calculado', b.scalesWithGL ? `Level = that part's GL − ${b.minGL} + 1${b.maxGL ? `, up to ${b.maxGL}` : ''}.` : 'A fixed effect.');
  sec(id, 'Efeitos', b.effect.map(e => describeEff(e, id, { min: 1, max: 50 })));
}

// ---------- 10. Generals / questlines / notes ----------
for (const [g, gen] of Object.entries(st.general)) {
  const gid = 'gen:' + g;
  add(gid, { c: 'General', n: str(get('general.' + g)) || cap1(g), k: g, f: 'general' });
  sec(gid, 'Como destrava', gen.unlock ? `${L('unl:' + gen.unlock)}${glUnlock[gen.unlock] ? ' (GL ' + glUnlock[gen.unlock] + ')' : ''}.` : `Comes with the ${L('feat:general')} feature.`);
  sec(gid, 'Questlines', Object.keys(gen.quests).length ? Object.keys(gen.quests).map(q => L('quest:' + g + '.' + q)) : 'None in this version.');
}
for (const [g, gq] of Object.entries(D.generalsFull)) for (const [q, qu] of Object.entries(gq.quests)) {
  const id = 'quest:' + g + '.' + q;
  add(id, { c: 'Questline', n: str(get('general.' + g + '.' + q)) || q, k: g + '.' + q, f: 'general' });
  sec(id, 'O que é', [`A questline from ${L('gen:' + g)} with ${qu.stages.length} stages. You get the relic ${L('relic:' + qu.reward)} at stage ${qu.stageLength}; every ${qu.stageLength} stages after that give +20 ${L('cur:relic_power')} capacity.`, `You do the stages in order, and all tasks of a stage must be true at the same time. ⚔ = inside one run.`]);
  if (qu.unlock) sec(id, 'Como destrava', `Needs ${L('unl:' + qu.unlock)}.`);
  sec(id, 'Estágios', qu.stages.map(sg => `${sg.n}${sg.isChallenge ? ' ⚔' : ''}: ${sg.tasks.join(' · ')}${sg.note ? ' → ' + L('note:' + sg.note) : ''}`));
}
for (const [k, n] of Object.entries(D.notes)) {
  const id = 'note:' + k;
  const t = get('note.text.' + k);
  const text = typeof t === 'string' ? t : (t && t.text) || null;
  const title = t && typeof t === 'object' && t.title ? t.title : null;
  add(id, { c: 'Note', n: title || `Note ${k}`, k, f: n.feature, d: strip(text) });
  sec(id, 'Como destrava', n.sources.length ? n.sources.map(x => x.upgrade ? `Buy the first level of ${L('upg:' + x.upgrade)}` : x.general ? `${L('quest:' + x.general + '.' + x.quest)} · stage ${x.stage}` : x.crop ? `Harvest ${L('crop:' + x.crop)} for the first time (${featName('farm')})` : x.how) : 'You cannot get it in this version.');
}

// ---------- 11. Feature-specific entities ----------
const ent = (prefix, cat, f, obj, nameFn, cb) => { for (const [k, v] of Object.entries(obj || {})) { const id = prefix + ':' + k; add(id, { c: cat, n: nameFn(k, v) || k, k, f }); cb && cb(id, k, v); } };
// Mining
ent('enh', 'Enhancement', 'mining', st.mining.enhancement, k => str(get('mining.enhancement.' + k)), (id, k, v) => { sec(id, 'O que é', `A pickaxe upgrade paid with ${L('cur:mining_' + k)}. Each level costs 10 + 5 × current level bars. It goes back to 0 when you prestige. See ${L('concept:enhancement')}.`); sec(id, 'Efeitos por nível', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 10 }))); });
ent('beacon', 'Beacon', 'mining', st.mining.beacon, k => str(get('mining.beacon.' + k)), (id, k, v) => { sec(id, 'O que é', `You place it at one depth of the mine${v.range ? `; it affects the ${v.range} depths below it` : ''}. After removing it you wait 20 h.`); sec(id, 'Efeitos', (v.effect || []).map(e => describeEff(e, id, { min: 0, max: 10 }))); });
ent('smelt', 'Smeltery', 'mining', st.mining.smeltery, k => curName('mining_bar' + cap1(k)), (id, k, v) => { const p = safe(v.price, 0) || {}; sec(id, 'O que é', [`A ${L('unl:miningSmeltery')} recipe that makes ${L(curId(v.output))}.`, `The first bar costs ${Object.entries(p).map(([c, x]) => num(x) + ' ' + L(curId(c))).join(' + ')}.`, `Base time ${num(v.timeNeeded)} s, lowest temperature ${v.minTemperature}°. Each bar made this run makes the next one take ×1.045 longer; a higher temperature makes it faster.`]); });
// Village
ent('job', 'Job', 'village', st.village.job, k => str(get('village.job.' + k)), (id, k, v) => { sec(id, 'O que é', 'A Village job. Villagers without a job pay taxes instead. Buildings give the job slots.'); sec(id, 'Produz por trabalhador', (v.rewards || []).map(r => describeEff({ name: r.name, type: r.type, value: r.amount }, id, null))); });
ent('policy', 'Policy', 'village', st.village.policy, k => str(get('village.policy.' + k)), (id, k, v) => { sec(id, 'O que é', 'A Village setting you can move up or down. Upgrades set how far it goes. It goes back to 0 when you prestige.'); sec(id, 'Efeitos (nível 1 → 3)', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 3 }))); });
ent('offer', 'Offering', 'village', st.village.offering, k => curName('village_' + k), (id, k, v) => { sec(id, 'O que é', [`Sacrifice ${L(curId('village_' + k))} to get ${L('cur:village_offering')}.`, `Unlocked by ${L('unl:' + v.unlock)}.`]); });
ent('craft', 'Receita', 'village', st.village.crafting, k => str(get('village.crafting.' + k)), (id, k, v) => { sec(id, 'O que é', `An item of the ${L('concept:crafting')}${v.isSpecial ? ' (special: a permanent bonus)' : ''}.`); const ms = Object.entries(v.milestone || {}); sec(id, 'Milestones (cada um = +1 GL)', ms.map(([n, r]) => `${num(+n)} crafts: ${r.type === 'changeStat' ? (r.name === 'timeNeeded' ? 'takes less time' : 'sells for more') : r.type === 'villageCraft' ? 'unlocks ' + L('craft:' + r.name) : describeEff(r, id, null)}`)); });
// Horde
ent('equip', 'Equipamento', 'horde', st.horde.items, k => str(get('horde.equipment.' + k)), (id, k, v) => { sec(id, 'O que é', [`Horde equipment (max level ${v.cap ?? '∞'}).`, v.findZone ? `Drops from zone ${v.findZone} (chance ${num(v.findChance)} per enemy).` : (v.unlock ? `Unlocked by ${L('unl:' + v.unlock)}.` : 'Available from the start.'), `See ${L('concept:mastery')}.`]); const stt = safe(v.stats, 1) || []; sec(id, 'Atributos (nível 1)', stt.map(e => describeEff(e, id, null))); });
ent('heir', 'Heirloom', 'horde', st.horde.heirloom, k => str(get('horde.heirloom.' + k)), (id, k, v) => { sec(id, 'O que é', `A permanent Horde bonus that grows with each copy you find (rare loot from zone 31, or towers).`); sec(id, 'Efeito por cópia', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 10 }))); });
ent('trinket', 'Trinket', 'horde', st.horde.trinket, k => str(get('horde.trinket.' + k)), (id, k, v) => { sec(id, 'O que é', 'A Horde Classes item with a rarity. It turns on after your next prestige.'); sec(id, 'Efeitos', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 10 }))); });
ent('sigil', 'Sigil', 'horde', st.horde.sigil, k => str(get('horde.sigil.' + k)), (id, k, v) => { sec(id, 'O que é', isFinite(v.minZone ?? 0) ? `An enemy modifier (from zone ${v.minZone ?? 0}). It gets stronger with its level.` : 'An enemy modifier that only some enemies and bosses have (not rolled by zone).'); });
ent('class', 'Classe', 'horde', st.horde.fighterClass, k => str(get('horde.classes.' + k + '.name')), (id, k, v) => { E[id].d = strip(get('horde.classes.' + k + '.description')); sec(id, 'Como destrava', v.unlock ? L('unl:' + v.unlock) : 'A starting class.'); sec(id, 'Atributos base', Object.entries(v.baseStats).map(([a, b]) => `${a}: ${num(b)}`)); sec(id, 'Habilidades', Object.keys(v.skills || {}).map(sk => str(get('horde.classes.skillName.' + sk)) || sk)); });
ent('area', 'Área', 'horde', st.horde.area, k => str(get('horde.area.' + k)), (id, k, v) => { sec(id, 'O que é', `A Horde Classes area with ${Object.keys(v.zones).length} zones.`); const b = Object.values(v.zones).find(z => z.reward); if (b) sec(id, 'Boss final', `${(b.boss || []).map(x => str(get('horde.bossName.' + x)) || x).join(' → ')} unlocks ${L('unl:' + b.reward)}.`); });
ent('tower', 'Torre', 'horde', st.horde.tower, k => str(get('horde.tower.' + k)), (id, k, v) => { sec(id, 'Como destrava', L('unl:' + v.unlock)); sec(id, 'Recompensas por andar', Object.entries(v.reward || {}).map(([fl, r]) => `Floor ${fl}: ${describeEff(r, id, null)}`)); });
// Farm
ent('crop', 'Crop', 'farm', st.farm.crop, k => str(get('farm.crop.' + k)), (id, k, v) => { sec(id, 'O que é', [`A ${v.type} crop: it grows in ${num(v.grow)} min and gives ${num(v.yield)} per harvest (base).`, v.type !== 'special' ? `It counts for the Farm ${L('concept:gl')} up to level 40 (25 GL at most).` : 'A special crop: each level gives its own bonus.', `Exp for the next level: ${num(v.baseExp)} × 1.785^level.`]); sec(id, 'Drops raros', (v.rareDrop || []).map(r => r.type === 'consumable' ? L('cons:' + r.name) : L(curId(r.name)))); sec(id, 'Efeito especial', (v.specialEffect || []).map(e => describeEff(e, id, { min: 1, max: 10 }))); });
ent('gene', 'Gene', 'farm', st.farm.gene, k => str(get('farm.gene.' + k)) || cap1(k), (id, k, v) => { const tier = Object.entries(st.farm.geneLevels).find(([, g]) => g.includes(k)); sec(id, 'Como destrava', tier ? `You pick it when a crop reaches level ${tier[0]} (${L('unl:farmGeneLevel' + tier[0])}).` : ''); sec(id, 'Efeitos', (v.effect || []).map(e => describeEff(e, id, null))); });
ent('fbuild', 'Farm building', 'farm', st.farm.building, k => str(get('farm.building.' + k + '.name')), (id, k) => { E[id].d = strip(get('farm.building.' + k + '.description')); });
// Gallery
ent('idea', 'Ideia', 'gallery', st.gallery.idea, k => str(get('gallery.idea.' + k)), (id, k, v) => { sec(id, 'O que é', `A tier ${v.tier} idea. Levels cost ${L('cur:gallery_inspiration')} and go back to 0 when you prestige.`); sec(id, 'Efeitos (nível 1 → 5)', (v.effect || []).map(e => describeEff(e, id, { min: 1, max: 5 }))); });
ent('shape', 'Shape', 'gallery', st.gallery.shape, k => str(get('gallery.shapes.' + k)) || cap1(k), (id, k, v) => { sec(id, 'O que é', v.isSpecial ? 'A special piece on the shapes board.' : `A piece on the shapes board. Collect 5 or more connected ones to get ${L(curId('gallery_' + k))}.`); });
// School
ent('subject', 'Matéria', 'school', st.school.subject, k => str(get('school.' + k + '.name')), (id, k, v) => { E[id].d = strip(get('school.' + k + '.description')); sec(id, 'Como destrava', v.unlock ? `${L('unl:' + v.unlock)} (GL ${glUnlock[v.unlock]})` : `Comes with ${L('feat:school')}.`); });
// Treasure
for (const [k, t] of Object.entries(st.treasure.effect)) { const id = 'tre:' + k; add(id, { c: 'Efeito de treasure', n: multName(k), k, f: 'treasure' }); sec(id, 'O que é', [`An effect treasures can have (${t.type === 'prestige' ? 'Prestigious treasures only' : 'regular'}, lowest tier ${t.minTier}).`, `It raises ${L(multTarget(k).id)}.`]); idxAdd(multTarget(k).id, id, 'treasure effect'); }
// Consumables
for (const [k, c] of Object.entries(st.consumable)) { const id = 'cons:' + k; add(id, { c: 'Consumível', n: str(get('consumable.' + k)) || k, k, f: c.feature, d: strip(get('consumable.' + k + '.description')) }); if (c.price && Object.keys(c.price).length) sec(id, 'Custo', Object.entries(c.price).map(([cc, v]) => num(v) + ' ' + L(curId(cc)))); }

// ---------- 12. Other effect sources (indexed into "Afetado por") ----------
const fold = (owner, arr, lv) => (arr || []).forEach(e => describeEff(e, owner, lv));
for (const [k, j] of Object.entries(st.village.job)) (j.rewards || []).forEach(r => idxAdd(multTarget(r.name).id, 'job:' + k, `${r.type} ${effVal(r.type, r.amount)} per worker`));
for (const [lvl, bp] of Object.entries(st.horde.battlePassEffect)) fold('concept:battlepass', bp.effect, null);
for (const [k, b] of Object.entries(st.cryolab)) b.effect.forEach((arr, i) => fold('concept:cryolab', arr, { min: 1, max: 10 }));
for (const [k, c] of Object.entries(st.village.crafting)) for (const [, r] of Object.entries(c.milestone || {})) if (!['changeStat', 'villageCraft'].includes(r.type)) describeEff(r, 'craft:' + k, null);
for (const [k, c] of Object.entries(st.horde.fighterClass)) for (const [sk, skd] of Object.entries(c.skills || {})) fold('class:' + k, skd.effect, { min: 1, max: skd.max ?? 1 });

// ---------- 13. Hand-written concepts ----------
const C = (k, n, f, secs) => { const id = 'concept:' + k; add(id, { c: 'Conceito', n, k, f }); for (const [h, b] of secs) sec(id, h, b); };
C('gl', str(get('globalLevel.name')) || 'Global level', 'meta', [
  ['O que é', `The sum of 8 parts, one per feature or subfeature. Each part only keeps its record, so it never goes down. It opens new features and the ${L('concept:library')}.`],
  ['Como é calculado', ['Ore mine: highest depth − 1', 'Gas giant: highest depth − 1', 'Workers: the levels (up to 25 each) of the 10 housing buildings, added up', 'Crafters guild: crafting milestones reached', 'Horde Equipment: highest zone − 1', 'Horde Classes: ' + L('concept:battlepass') + ' level', 'Farm: for each crop, min(level, level ÷ 2 + 5, 25)', 'Gallery: ⌊log₄(total beauty)⌋']],
  ['Destrava', Object.entries(glUnlock).map(([u, v]) => `GL ${v}: ${L('unl:' + u)}`)],
  ['Também', `Every 10 GL: +1 ${L('cur:school_examPass')}. Above 150: a bonus to Snowdown event resources.`],
]);
C('prestige', str(get('gooboo.prestige')) || 'Prestige', 'meta', [
  ['O que é', 'Restart a feature and trade this run\'s progress for a currency you keep. Each feature has its own prestige, separate from the others.'],
  ['O que cada um gera', [`${L('feat:mining')}: ${L('cur:mining_crystalGreen')} / ${L('cur:mining_crystalYellow')} + ${L('cur:mining_ember')}`, `${L('feat:village')}: ${L('cur:village_blessing')} / ${L('cur:village_shares')}`, `${L('feat:horde')}: ${L('cur:horde_soulEmpowered')} / ${L('cur:horde_courage')}`, `${L('feat:farm')}: one prestige per crop (each record level gives ×1.04 crop gain to all crops)`, `${L('feat:gallery')}: ${L('cur:gallery_cash')}`]],
  ['Detalhes', ['You keep prestige and premium upgrades.', `The cards you selected get equipped when you prestige (${L('concept:cards')}).`, `Your best prestige feeds the ${L('concept:cryolab')}.`]],
]);
C('overcap', 'Overcap', 'meta', [['O que é', 'When a currency goes over its capacity, some keep growing, but more slowly. Between 1× and 2× the cap, gain is multiplied by the overcap factor; between 2× and 3× it is multiplied again by the scaling factor, and so on. Each currency page shows its own factors.']]);
C('mult', 'Stat breakdown', 'meta', [['Fórmula', ['Value = (start value + all "base" effects) × all "mult" effects + all "bonus" effects.', 'Then the lowest/highest limits and rounding apply, if any.', 'An effect on a group (like Resource gain in the Village) works for every member of the group.'], ], ['Na wiki', 'Every stat and currency has a "Gain affected by" list with all known sources: upgrades, relics, cards, books, genes, heirlooms and more.']]);
C('dweller', str(get('mining.depthDweller')) || 'Depth dweller', 'mining', [
  ['O que é', `It goes down the mine on its own and sets your ${L('feat:mining')} prestige. Unlocked by ${L('upg:mining_depthDweller')} (Ore mine) and ${L('upg:mining_gasDweller')} (Gas giant).`],
  ['Como é calculado', ['Limit = your highest depth THIS run × Maximum dweller depth (base 10%, at most 50%).', 'It moves fast at first and slows down near the limit.', 'Past the limit it keeps going, but very slowly.', 'Crystals = 7 × s × 1.15^(s/2) × multiplier, where s = 2 × dweller depth.']],
]);
C('enhancement', str(get('mining.enhancement.title')) || 'Enhancements', 'mining', [['O que é', `Spend smeltery bars to improve your pickaxe. Each bar has its own enhancement. While any enhancement is active, no obsidian drops. It goes back to 0 when you prestige.`], ['Lista', Object.keys(st.mining.enhancement).map(k => L('enh:' + k))]]);
C('combo', 'Combo', 'horde', [['O que é', 'Each kill raises the combo. Enemies get stronger (attack ×1.025 and health ×1.01 per combo), and you get +1.2% bone per combo.'], ['Boss', 'The boss shows up at combo = 2 × zone + 20 (lower if your record is above zone 20). Beating the boss moves you to the next zone.']]);
C('rareloot', str(get('horde.rareLoot')) || 'Rare loot', 'horde', [['O que é', `Special drops from zone 21: ${L('cur:horde_soulCorrupted')} and a chance of ${L('concept:heirlooms')}.`], ['Como é calculado', 'Souls per drop = 1.1^(zone − 21) × (zone − 20) × multiplier, using this run\'s highest zone. The soul capacity uses your all-time record.']]);
C('heirlooms', str(get('horde.heirloom.tabName')) || 'Heirlooms', 'horde', [['O que é', 'Permanent bonuses that grow with each copy. Base chance 1% + 0.1% per zone above 30.'], ['Lista', Object.keys(st.horde.heirloom).map(k => L('heir:' + k))]]);
C('mastery', str(get('horde.itemMastery.name')) || 'Mastery', 'horde', [['O que é', 'Unlocks after zone 74. Equipment gains mastery above zone 75. At mastery 1 you keep the item found when you prestige; at mastery 3 you also keep its level.']]);
C('battlepass', str(get('horde.battlePass.name')) || 'Battle pass', 'horde', [['O que é', `Level = class quests done (a boss quest counts as 2). It is the "Classes" part of your ${L('concept:gl')}.`], ['Recompensas', Object.entries(st.horde.battlePassEffect).map(([l, bp]) => `Level ${l}: ${(bp.effect || []).map(e => e.type === 'unlock' ? L('unl:' + e.name) : multName(e.name)).join(', ')}`)]]);
C('crafting', get('subfeature.village')[1], 'village', [['O que é', `The second subfeature of the ${L('feat:village')} (GL 800). You craft items from resources and sell them for Copper coin, which becomes ${L('cur:village_shares')} when you prestige.`], ['Milestones', `Each recipe has milestones for how many you have crafted (they never reset). Each milestone is +1 ${L('concept:gl')}.`]]);
C('cards', featName('card'), 'card', [
  ['O que é', `Cards for each feature. Unlocks at GL 80. They come from ${L('concept:cardpack')}.`],
  ['Bônus', ['Feature collection: a bonus for each different card you found.', 'Shiny: a bonus for each shiny card you found.', 'Full collection: a fixed bonus, sometimes +1 slot.', 'Equipped: the card\'s own effect, plus a bonus that grows fast with total card power.']],
  ['Equipar', ['Slots per feature: 1, plus more from collections and relics.', 'Selected cards only get equipped at your next prestige, and that uses up 1 copy of each (you must have one to spare).', 'The selection clears after each prestige, so select again before the next one.']],
]);
C('cardpack', str(get('card.cardPack')) || 'Card pack', 'card', [['O que é', `Bought with ${L('cur:gem_emerald')}. Each pack draws cards for one feature and needs an unlock.`], ['Lista', Object.keys(st.card.pack).map(k => L('pack:' + k))]]);
C('shiny', str(get('card.shinyTitle')) || 'Shiny cards', 'card', [['O que é', `Unlocked by the relic ${L('relic:deckOfCards')}. Each card you open has a 1.5% chance to be shiny. A shiny you already have becomes ${L('cur:card_shinyDust')}.`]]);
C('general', featName('general'), 'general', [['O que é', `Characters with questlines that span several features. Each questline ends with a relic that often opens a new system.`], ['Generals', Object.keys(st.general).map(g => L('gen:' + g))]]);
C('library', str(get('school.library')) || 'Library', 'school', [['O que é', `Part of ${L('feat:school')}, unlocked by the relic ${L('relic:dustyBook')}. Books show up as each feature\'s part of your ${L('concept:gl')} grows.`]]);
C('museum', str(get('relic.museum')) || 'Museum', 'relic', [['O que é', `Unlocked by the relic ${L('relic:museumKey')}. It has 3 pedestals; relics placed on them level up their glyphs over time.`]]);
C('cryolab', featName('cryolab'), 'cryolab', [['O que é', 'Freeze a feature (GL 290). It stops, but it earns prestige currency every day from your best prestige, and it gains cryolab exp.'], ['Como é calculado', ['Frozen: 20% + 1% per level of your best prestige per day (Village: 8% + 0.4%).', 'Not frozen: 0.5% per level per day.', 'Exp per day = 1.015^GL × GL × 2, using that feature\'s part of your GL.', 'Each level also gives ×1.15 prestige gain in that feature.']]]);
C('events', featName('event'), 'event', [['O que é', `Events that follow the calendar (GL 150). Big ones: Cinders (Jan 15), Bloom (Mar 9), Weather Chaos (May 22), Summer Festival (Jul 26), Night Hunt (Oct 4), Snowdown (Nov 25). Small ones: Merchant, Casino, Bank.`], ['Detalhes', `During big events, ${L('cur:gem_topaz')} turns into the event currency.`]]);

// ---------- 14. "Afetado por" + "Usado em" + "Bloqueia" sections ----------
const groupsOf = {}; for (const [n, m] of Object.entries(st.mult.items)) (m.group || []).forEach(g => (groupsOf[g] = groupsOf[g] || []).push(n));
const ancestors = (n, seen = new Set()) => { (groupsOf[n] || []).forEach(p => { if (!seen.has(p)) { seen.add(p); ancestors(p, seen); } }); return [...seen]; };
const fmtIdx = (target) => (effectIndex[target] || []).map(x => `${L(x.src)}: ${x.txt}`);
for (const [id, e] of Object.entries(E)) {
  if (id.startsWith('cur:')) {
    const k = id.slice(4); const [f, n] = [k.split('_')[0], k.split('_').slice(1).join('_')];
    const gainName = G['currency/gainMultName'] ? safe(G['currency/gainMultName'], f, n) : null;
    const capName = G['currency/capMultName'] ? safe(G['currency/capMultName'], f, n) : null;
    const gainSrc = (effectIndex[id] || []).filter(x => x.txt.startsWith('gain')).map(x => `${L(x.src)}: ${x.txt.replace(/^gain /, '')}`);
    const capSrc = (effectIndex[id] || []).filter(x => x.txt.startsWith('capacity')).map(x => `${L(x.src)}: ${x.txt.replace(/^capacity /, '')}`);
    const grp = [gainName, capName].filter(Boolean).flatMap(nm => ancestors(nm)).map(a => `Also through the group ${L(multTarget(a).id)}`);
    if (gainSrc.length || capSrc.length) sec(id, 'Como é calculado', `Gain and capacity follow the ${L('concept:mult')}: (base) × multipliers + bonuses.`);
    if (gainSrc.length) sec(id, 'Ganho afetado por', gainSrc);
    if (capSrc.length) sec(id, 'Capacidade afetada por', capSrc);
    if (grp.length) sec(id, 'Grupos', [...new Set(grp)]);
    const used = priceIdx[k] || [];
    if (used.length) sec(id, 'Usada para comprar', used.slice(0, 60).map(u => L('upg:' + u)).concat(used.length > 60 ? [`… and ${used.length - 60} more`] : []));
  } else if (id.startsWith('mult:')) {
    const n = id.slice(5);
    const src = fmtIdx(id);
    const grp = ancestors(n).map(a => `Also anything that raises the group ${L(multTarget(a).id)}`);
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
for (const e of Object.values(E)) if (e.id.startsWith('heir:')) e.s.forEach(x => { x.b = x.b.map(t => t.replace(/\(level (\d+)\)/, '($1 copies)')); });
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
