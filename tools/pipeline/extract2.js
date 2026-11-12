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
for (const [d, n] of Object.entries(parseMap('js/modules/mining.js'))) add(n, `Mining (Ore mine): break the ${d} m layer for the first time`, +d, 'mining');
for (const [z, n] of Object.entries(parseMap('store/horde.js'))) add(n, `Horde (Equipment): beat the zone ${z} boss`, +z, 'horde');
for (const [c, n] of Object.entries(parseMap('store/farm.js'))) add(n, `Farm: harvest ${(en.farm.crop || {})[c] || c} for the first time`, 0, 'farm', { crop: c });
for (const [k, u] of Object.entries(st.upgrade.item)) if (u.note) add(u.note, `Buy the first level of ${en.upgrade[k] || k}`, u.requirementValue ?? 0, 'upgrade', { upgrade: k });
for (const [g, gen] of Object.entries(st.general)) for (const [q, qu] of Object.entries(gen.quests)) qu.stages.forEach((sg, i) => { if (sg.note) add(sg.note, `${en.general[g]?.name || g} · ${en.general[g]?.[q] || q} · stage ${i + 1}`, i, 'general', { general: g, quest: q, stage: i + 1 }); });
[
  ['event_1', 'Any big event starts'], ['event_2', 'During a big event, other gems turn into the event currency'],
  ['event_3', 'The Merchant event starts'], ['event_4', 'A Bingo casino'], ['event_5', 'A Wheel of fortune casino'], ['event_6', 'The Bank event starts'],
  ['event_7', 'Cinders starts'], ['event_8', 'Cinders: gain light'], ['event_9', 'Cinders: use a candle'], ['event_10', 'Cinders: earn tokens (light ≥ 10K)'],
  ['event_11', 'Bloom starts'], ['event_12', 'Bloom: breed flowers (breeder)'], ['event_13', 'Bloom: sell or harvest a flower from a slot'], ['event_14', 'Bloom: reach a new highest flower tier (tokens)'],
  ['event_15', 'Weather Chaos starts'], ['event_16', 'Weather Chaos: catch a fish'], ['event_17', 'Weather Chaos: a treasure opens the next location'], ['event_18', 'Weather Chaos: a new fish size record'],
  ['event_19', 'Summer Festival starts'], ['event_20', 'Summer Festival: build a Collector'], ['event_21', 'Summer Festival: finish 4 or more quests'], ['event_22', 'Summer Festival: build the Main Stage'],
  ['event_23', 'Summer Festival: every 5th quest (free expansion)'], ['event_24', 'Summer Festival: build a Sawmill or a Kitchen'], ['event_25', 'Summer Festival: finish a quest'],
  ['event_26', 'Night Hunt starts'], ['event_27', 'Night Hunt: trade a currency'], ['event_28', 'Night Hunt: a ritual that improves a potion'], ['event_29', 'Night Hunt: a ritual that works without a potion'],
  ['event_30', 'Snowdown starts'], ['event_31', 'Snowdown: win a pet as a reward'], ['event_32', 'Snowdown: win the 4th fight or later'], ['event_33', 'Snowdown: win a fight'],
  ['card_1', 'Card: finish a whole collection'], ['school_1', 'School: finish a study or exam that gives golden dust'], ['cryolab_1', 'Cryolab: reach the first cryolab level'], ['school_2', 'School: open the Library screen'],
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
      if (t.subtype === 'current') label += ' (this run)';
      break;
    case 'unlock': return `${T('gooboo.unlock')}: ${T('unlock.' + t.name) || t.name}`;
    case 'cardEquipped': return `${T('general.questEquipCard')}: ${t.name}${T('card.card.' + t.name) ? ' (' + T('card.card.' + t.name) + ')' : ''}${t.giveCard ? ' — the game gives you 6 copies' : ''}`;
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
