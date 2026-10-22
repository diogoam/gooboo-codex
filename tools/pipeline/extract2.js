// Notes, cards and general↔feature mapping. Merges into data/gooboo-data.json
require('./bundle.js');
const fs = require('fs');
const s = globalThis.__store; const en = globalThis.__en;
globalThis.__newGame(false);
const st = s.state;
const SRC = '/root/gooboo/src/';
const data = JSON.parse(fs.readFileSync('data/gooboo-data.json'));
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 1e4 ? v.toExponential(2) : +v.toFixed(4)) : v;

const parseMap = (file) => {
  const txt = fs.readFileSync(SRC + file, 'utf8');
  const m = txt.match(/const notes = \{([\s\S]*?)\};/);
  const out = {};
  for (const mm of m[1].matchAll(/(\w+):\s*'(\w+)'/g)) out[mm[1]] = mm[2];
  return out;
};

// ---------------- NOTES ----------------
const noteSrc = {}; // note -> [{feature, how, sort}]
const add = (n, how, sortKey = 0, group = null, extra = {}) => { (noteSrc[n] = noteSrc[n] || []).push({ how, sortKey, group, ...extra }); };
for (const [k, v] of Object.entries(st.meta.globalLevelNotes)) add(k, `Global Level ≥ ${v}`, v, 'GL');
for (const [d, n] of Object.entries(parseMap('js/modules/mining.js'))) add(n, `Mining (Ore mine): quebrar a camada de ${d} m pela 1ª vez`, +d, 'mining');
for (const [z, n] of Object.entries(parseMap('store/horde.js'))) add(n, `Horde (Equipment): derrotar o boss da zona ${z}`, +z, 'horde');
for (const [c, n] of Object.entries(parseMap('store/farm.js'))) add(n, `Farm: colher ${(en.farm.crop || {})[c] || c} pela 1ª vez`, 0, 'farm', { crop: c });
for (const [k, u] of Object.entries(st.upgrade.item)) if (u.note) add(u.note, `Comprar o 1º nível de ${en.upgrade[k] || k}`, u.requirementValue ?? 0, 'upgrade', { upgrade: k });
for (const [g, gen] of Object.entries(st.general)) for (const [q, qu] of Object.entries(gen.quests)) qu.stages.forEach((sg, i) => { if (sg.note) add(sg.note, `${en.general[g]?.name || g} · ${en.general[g]?.[q] || q} · estágio ${i + 1}`, i, 'general', { general: g, quest: q, stage: i + 1 }); });
[
  ['event_1', 'Início de qualquer evento grande'], ['event_2', 'Gems secundárias convertidas em moeda de evento grande (durante evento)'],
  ['event_3', 'Início do evento Merchant'], ['event_4', 'Casino tipo Bingo'], ['event_5', 'Casino tipo Roda da Fortuna'], ['event_6', 'Início do evento Bank'],
  ['event_7', 'Início do Cinders'], ['event_8', 'Cinders: ganhar light'], ['event_9', 'Cinders: usar uma vela'], ['event_10', 'Cinders: ganhar tokens (light ≥ 10K)'],
  ['event_11', 'Início do Bloom'], ['event_12', 'Bloom: cruzar flores (breeder)'], ['event_13', 'Bloom: vender/colher flor de um slot'], ['event_14', 'Bloom: novo tier máximo de flor (tokens)'],
  ['event_15', 'Início do Weather Chaos'], ['event_16', 'Weather Chaos: pescar um peixe'], ['event_17', 'Weather Chaos: tesouro libera próxima localização'], ['event_18', 'Weather Chaos: novo recorde de tamanho de peixe'],
  ['event_19', 'Início do Summer Festival'], ['event_20', 'Summer Festival: construir Collector'], ['event_21', 'Summer Festival: 4+ quests concluídas'], ['event_22', 'Summer Festival: construir Main Stage'],
  ['event_23', 'Summer Festival: quest múltipla de 5 (expansão grátis)'], ['event_24', 'Summer Festival: construir Sawmill ou Kitchen'], ['event_25', 'Summer Festival: concluir uma quest'],
  ['event_26', 'Início do Night Hunt'], ['event_27', 'Night Hunt: trocar moeda'], ['event_28', 'Night Hunt: ritual que melhora uma poção'], ['event_29', 'Night Hunt: ritual bem-sucedido sem poção'],
  ['event_30', 'Início do Snowdown'], ['event_31', 'Snowdown: ganhar um pet como recompensa'], ['event_32', 'Snowdown: vencer a 4ª+ luta'], ['event_33', 'Snowdown: vencer uma luta'],
  ['card_1', 'Card: completar uma coleção inteira'], ['school_1', 'School: concluir estudo/exame que dá golden dust'], ['cryolab_1', 'Cryolab: primeiro nível de cryolab'], ['school_2', 'School: abrir a tela da Library (BookLibrary)'],
].forEach(([n, h]) => add(n, h, 0, 'hardcoded'));
const notes = {};
for (const [k, n] of Object.entries(st.note)) {
  const title = en.note?.[k]?.title ?? en.note?.[k] ?? null;
  notes[k] = { feature: n.feature, author: n.author, title: typeof title === 'string' ? title : null, sources: noteSrc[k] || [] };
}
data.notes = notes;
data.notesWithoutSource = Object.keys(notes).filter(k => !notes[k].sources.length);

// ---------------- CARDS ----------------
const cardName = id => en.card?.card?.[id] ?? null;
const cards = {};
const packOf = {};
for (const [p, pk] of Object.entries(st.card.pack)) for (const [id, w] of Object.entries(pk.content)) (packOf[id] = packOf[id] || []).push({ pack: p, chance: w / pk.cacheWeightTotal });
for (const [id, c] of Object.entries(st.card.card)) {
  cards[id] = {
    name: typeof cardName(id) === 'string' ? cardName(id) : null, feature: c.feature, collection: c.collection, power: c.power, instant: c.instant,
    reward: c.reward.map(e => `${e.type} ${e.name} ${fmt(typeof e.value === 'function' ? e.value(1) : e.value)}`),
    packs: (packOf[id] || []).map(x => `${x.pack} ${(x.chance * 100).toFixed(1)}%`),
  };
}
data.cards = cards;
data.cardCollections = Object.fromEntries(Object.entries(st.card.collection).map(([k, c]) => [k, { cards: c.cards, reward: c.reward.map(e => `${e.type} ${e.name} ${fmt(e.value)}`) }]));
data.cardPacksFull = Object.fromEntries(Object.entries(st.card.pack).map(([k, p]) => [k, { feature: p.feature, unlock: p.unlock, price: p.price, shinyPrice: p.shinyPrice, cardsPerPack: p.amount, content: Object.fromEntries(Object.entries(p.content).map(([id, w]) => [id, +(w / p.cacheWeightTotal).toFixed(4)])) }]));

// ---------------- GENERAL ↔ FEATURE ----------------
const featOfTask = t => {
  if (t.feature) return t.feature;
  if (t.type === 'cropLevel') return 'farm';
  if (t.type === 'equipmentMastery') return 'horde';
  if (t.type === 'subfeature') return t.name;
  if (t.type === 'unlock') return (t.name.match(/^(mining|village|horde|farm|gallery|school|card|gem|relic|treasure|event|cryolab)/) || [, 'meta'])[1];
  return (t.name || '').split('_')[0];
};
// Mesmo texto que o jogo mostra (components/partial/general/QuestTask.vue)
const T = (p) => { let o = en; for (const k of p.split('.')) { if (o == null) return null; o = o[k]; } return typeof o === 'string' ? o : (o && o.name) || null; };
const fmtTime = (sec) => { const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s2 = sec % 60; return [h ? h + 'h' : '', m ? m + 'm' : '', (s2 || (!h && !m)) ? s2 + 's' : ''].filter(Boolean).join(' '); };
const taskStr = t => {
  const feat = t.feature || null;
  let label;
  switch (t.type) {
    case 'subfeature': return `${T('feature.subfeature')}: ${T('subfeature.' + t.name + '.' + t.value)}`;
    case 'stat':
      if (st.currency[t.name]) label = T('general.questGained').replace('{0}', T('currency.' + t.name));
      else if (t.name.slice(-3) === 'Max' && st.currency[t.name.slice(0, -3)]) label = T('general.questHighestAmount').replace('{0}', T('currency.' + t.name.slice(0, -3)));
      else label = (en.stat[t.name] && en.stat[t.name].description) || t.name;
      if (t.subtype === 'current') label += ' (nesta run)';
      break;
    case 'unlock': return `${T('gooboo.unlock')}: ${T('unlock.' + t.name) || t.name}`;
    case 'cardEquipped': return `${T('general.questEquipCard')}: ${t.name}${T('card.card.' + t.name) ? ' (' + T('card.card.' + t.name) + ')' : ''}${t.giveCard ? ' — o jogo dá 6 cópias' : ''}`;
    case 'upgrade': label = `${T('upgrade.' + t.name) || t.name} ${T('gooboo.level')}`; break;
    case 'cropLevel': label = `${T('farm.crop.' + t.name) || t.name} ${T('gooboo.level')}`; break;
    case 'equipmentMastery': label = `${T('horde.equipment.' + t.name) || t.name} ${T('gooboo.level')}`; break;
    default: return JSON.stringify(t);
  }
  const op = t.operator ? ' ' + (en.gooboo.operator[t.operator] || t.operator) : '';
  const disp = t.type === 'stat' ? st.stat[t.name]?.display : null;
  const val = t.value === undefined ? '' : ' ' + (disp === 'time' ? fmtTime(t.value) : disp === 'percent' ? fmt(t.value * 100) + '%' : fmt(t.value));
  return label + op + val;
};
const generalByFeature = {};
const generalsFull = {};
for (const [g, gen] of Object.entries(st.general)) {
  generalsFull[g] = { unlock: gen.unlock, quests: {} };
  for (const [q, qu] of Object.entries(gen.quests)) {
    const stages = qu.stages.map((sg, i) => {
      const feats = [...new Set(sg.tasks.map(featOfTask))];
      const isChallenge = !!sg.isChallenge || sg.tasks.some(t => t.type === 'stat' && t.subtype === 'current');
      const o = { n: i + 1, isChallenge, note: sg.note ?? null, features: feats, tasks: sg.tasks.map(taskStr), raw: sg.tasks.map(t => ({ ...t })) };
      if (i + 1 === qu.stageLength) o.relic = qu.reward;
      if (i + 1 > qu.stageLength && (i + 1) % qu.stageLength === 0) o.bonus = '+20 cap de relic power';
      feats.forEach(f => (generalByFeature[f] = generalByFeature[f] || []).push({ general: g, quest: q, stage: i + 1, of: qu.stages.length, isChallenge, tasks: o.tasks.filter((_, j) => featOfTask(sg.tasks[j]) === f), allTasks: o.tasks }));
      return o;
    });
    generalsFull[g].quests[q] = { unlock: qu.unlock, reward: qu.reward, stageLength: qu.stageLength, stages };
  }
}
data.generalsFull = generalsFull;
data.generalByFeature = generalByFeature;
fs.writeFileSync('data/gooboo-data.json', JSON.stringify(data, null, 1));
console.log('notes', Object.keys(notes).length, 'without source:', data.notesWithoutSource.join(', '));
console.log('cards', Object.keys(cards).length, 'genByFeature', Object.fromEntries(Object.entries(generalByFeature).map(([k, v]) => [k, v.length])));
