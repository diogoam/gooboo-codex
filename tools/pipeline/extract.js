// Boots Gooboo headlessly and extracts structured progression data.
require('./bundle.js');
const fs = require('fs');
const s = globalThis.__store; const en = globalThis.__en;
globalThis.__newGame(false);
const st = s.state;
const out = {};

const tr = (path) => { let o = en; for (const p of path.split('.')) { if (o == null) return null; o = o[p]; } return typeof o === 'string' ? o : (o && typeof o === 'object' && o.name ? o.name : null); };
const safe = (f, ...a) => { try { return f(...a); } catch (e) { return '⚠' + e.message.slice(0, 40); } };
const fmt = v => typeof v === 'number' ? (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : +v.toFixed(4)) : v;
const fnSrc = f => typeof f === 'function' ? f.toString().replace(/\s+/g, ' ').replace(/store_default/g, 'store').slice(0, 300) : f;

// ---------- Unlock trigger registry ----------
const unlockTriggers = {}; // key -> [{source, detail}]
const addT = (key, source, detail) => { (unlockTriggers[key] = unlockTriggers[key] || []).push({ source, detail }); };
for (const [k, v] of Object.entries(st.meta.globalLevelUnlocks)) addT(k, 'globalLevel', `GL ${v}`);

// ---------- Upgrades ----------
const upgrades = {};
for (const [key, u] of Object.entries(st.upgrade.item)) {
  const cap = u.cap;
  const maxProbe = cap === null ? 60 : Math.min(cap, 200);
  const effects = u.effect.map(e => {
    const o = { name: e.name, type: e.type };
    if (typeof e.value === 'function') {
      o.lv1 = fmt(safe(e.value, 1));
      if (maxProbe > 1) o.lvMax = fmt(safe(e.value, maxProbe));
      if (['unlock', 'keepUpgrade', 'uncapUpgrade', 'villageCraft', 'farmSeed', 'findConsumable', 'galleryIdea', 'galleryShape'].includes(e.type)) {
        let first = null; for (let l = 0; l <= maxProbe; l++) { if (safe(e.value, l) === true) { first = l; break; } }
        o.atLevel = first;
        if (e.type === 'unlock' && first !== null) addT(e.name, 'upgrade', `${key} nv ${first}`);
      }
    } else o.value = e.value;
    return o;
  });
  upgrades[key] = {
    name: tr('upgrade.' + key) || key,
    feature: u.feature, subfeature: u.subfeature, type: u.type, subtype: u.subtype, mode: u.mode,
    cap, persistent: u.persistent,
    reqStat: u.requirementStat, reqValue: u.requirementValue,
    reqCustom: (!u.requirementStat && !/=> true/.test(fnSrc(u.requirement))) ? fnSrc(u.requirement) : null,
    price1: safe(u.price, 0), priceAt10: cap === null || cap >= 10 ? safe(u.price, 9) : null,
    time1: u.mode !== 'instant' ? safe(u.timeNeeded, 0) : null,
    raiseOtherCap: u.raiseOtherCap, note: u.note,
    effects,
  };
}
out.upgrades = upgrades;

// ---------- Relics ----------
const relics = {};
const relicSource = {};
for (const [ach, a] of Object.entries(st.achievement)) for (const [lvl, r] of Object.entries(a.relic || {})) relicSource[r] = `Achievement ${ach} nível ${+lvl + 1} (milestone ${fmt(safe(a.milestones, +lvl))})`;
for (const [g, gen] of Object.entries(st.general)) for (const [q, quest] of Object.entries(gen.quests)) if (quest.reward) relicSource[quest.reward] = `General ${g} questline ${q}`;
for (const [f, forge] of Object.entries(st.gem.forge || {})) if (forge.relic) relicSource[forge.relic] = `Gem forge ${f}`;
relicSource.friendlyBat = 'GL 40'; relicSource.notebook = 'GL 100';
for (const [k, r] of Object.entries(st.relic.item)) {
  const eff = safe(r.effect) || [];
  if (Array.isArray(eff)) eff.forEach(e => { if (e.type === 'unlock') addT(e.name, 'relic', k); });
  relics[k] = { name: tr('relic.' + k) || k, feature: r.feature, effect: Array.isArray(eff) ? eff.map(e => ({ ...e, value: fmt(typeof e.value === 'function' ? safe(e.value, 1) : e.value) })) : eff, active: r.active ? fnSrc(r.active) : null, source: relicSource[k] || '(evento/prêmio ou desconhecido)' };
}
out.relics = relics;

// ---------- Achievements ----------
out.achievements = Object.fromEntries(Object.entries(st.achievement).map(([k, a]) => [k, {
  cap: a.cap, secret: a.secret, milestones: Array.from({ length: Math.min(a.cap ?? 10, 10) }, (_, i) => fmt(safe(a.milestones, i))), relic: a.relic, reward: a.reward,
}]));

// ---------- Generals (questlines) ----------
out.generals = Object.fromEntries(Object.entries(st.general).map(([g, gen]) => [g, {
  unlock: gen.unlock,
  quests: Object.fromEntries(Object.entries(gen.quests).map(([q, quest]) => [q, { unlock: quest.unlock, reward: quest.reward, stages: quest.stages.map(sg => ({ isChallenge: !!sg.isChallenge, tasks: sg.tasks.map(t => `${t.type}${t.subtype ? '/' + t.subtype : ''} ${t.name ?? ''} ${t.operator} ${fmt(t.value)}`) })) }])),
}]));
for (const [g, gen] of Object.entries(out.generals)) for (const [q, quest] of Object.entries(gen.quests)) if (quest.unlock) addT('(questline) ' + g + '.' + q, 'unlockRequired', quest.unlock);

// ---------- School books ----------
out.books = Object.fromEntries(Object.entries(st.school.book).map(([k, b]) => [k, { feature: b.feature, subfeature: b.subfeature, minGL: b.minGL, maxGL: b.maxGL, scalesWithGL: b.scalesWithGL, effect: b.effect.map(e => `${e.type} ${e.name}`) }]));

// ---------- Cards ----------
out.cardFeatures = Object.fromEntries(Object.entries(st.card.feature).map(([k, f]) => [k, { reward: f.reward.map(e => `${e.type} ${e.name}`), shinyReward: f.shinyReward.map(e => `${e.type} ${e.name}`), powerReward: f.powerReward.map(e => `${e.type} ${e.name}`) }]));
out.cardPacks = Object.fromEntries(Object.entries(st.card.pack).map(([k, p]) => [k, { feature: p.feature, unlock: p.unlock, price: p.price, amount: p.amount, content: Object.keys(p.content || {}).length }]));
for (const [k, p] of Object.entries(st.card.pack)) if (p.unlock) addT(p.unlock, 'cardPack(usa)', k);

// ---------- Systems features ----------
out.features = Object.fromEntries(Object.entries(st.system.features).map(([k, f]) => [k, { unlock: f.unlock, subfeatures: f.subfeatures, main: f.main }]));
out.globalLevel = { unlocks: st.meta.globalLevelUnlocks, notes: st.meta.globalLevelNotes, parts: st.meta.globalLevelList };

// ---------- Unlock keys list + translation ----------
out.unlockKeys = Object.keys(st.unlock).map(k => ({ key: k, name: tr('unlock.' + k) || null }));

// ---------- Mults (names) ----------
out.mults = Object.fromEntries(Object.entries(st.mult.items || {}).map(([k, m]) => [k, { feature: m.feature, display: m.display, group: m.group, unlock: m.unlock }]));

// ---------- Consumables / treasure / cryolab / horde extras ----------
out.consumables = Object.fromEntries(Object.entries(st.consumable).map(([k, c]) => [k, { price: c.price, effect: c.effect }]));
out.treasureEffects = Object.fromEntries(Object.entries(st.treasure.effect).map(([k, e]) => [k, { type: e.type, unlock: e.unlock }]));
out.cryolab = Object.fromEntries(Object.entries(st.cryolab).map(([k, c]) => [k, Object.keys(c)]));

// Horde extras
const h = st.horde;
out.hordeKeys = Object.keys(h);
out.hordeBattlePass = {};
if (h.battlePassEffect) for (const [lvl, bp] of Object.entries(h.battlePassEffect)) { out.hordeBattlePass[lvl] = (bp.effect || []).map(e => `${e.type} ${e.name} ${fmt(typeof e.value === 'function' ? safe(e.value, 1) : e.value)}`); (bp.effect || []).forEach(e => { if (e.type === 'unlock') addT(e.name, 'hordeBattlePass', `Battle pass (Horde Classes) nível ${lvl}`); }); }
out.hordeTowers = {};
for (const [t, tw] of Object.entries(h.tower || {})) { out.hordeTowers[t] = { unlock: tw.unlock, crowns: tw.crowns, statBase: tw.statBase, reward: Object.fromEntries(Object.entries(tw.reward || {}).map(([f, r]) => [f, `${r.type} ${r.name} ${r.value}`])) }; for (const [f, r] of Object.entries(tw.reward || {})) if (r.type === 'unlock') addT(r.name, 'hordeTower', `Torre ${t} andar ${f}`); }
out.hordeClasses = Object.fromEntries(Object.entries(h.fighterClass || {}).map(([c, fc]) => [c, { unlock: fc.unlock ?? null, baseStats: fc.baseStats ?? null, quests: fc.quests ? Object.fromEntries(Object.entries(fc.quests).map(([qt, ql]) => [qt, (ql || []).length])) : null }]));
out.hordeAreas = Object.fromEntries(Object.entries(h.area || {}).map(([a, area]) => [a, { unlockedBy: area.unlockedBy ?? null, zones: Object.fromEntries(Object.entries(area.zones || {}).map(([z, zd]) => [z, { difficulty: zd.difficulty, boss: zd.boss, reward: zd.reward, unlockedBy: zd.unlockedBy ?? null }])) }]));
for (const [lvl, genes] of Object.entries({ 1: 1, 5: 5, 10: 10, 15: 15, 20: 20, 25: 25 })) addT('farmGeneLevel' + lvl, 'hardcoded', `Qualquer crop atinge nível ${genes} (desbloqueia slot de gene)`);
if (h.area) for (const [a, area] of Object.entries(h.area)) for (const [z, zd] of Object.entries(area.zones || {})) if (zd.reward) addT(zd.reward, 'hordeBoss', `área ${a} zona ${z} boss ${(zd.boss || []).join('>')}`);

// Hardcoded unlocks found in source (manual)
[
  ['miningAdvancedCardPack', 'hardcoded', 'Mining maxDepth0 >= 260'],
  ['miningLuxuryCardPack', 'hardcoded', 'Mining maxDepth0 >= 350'],
  ['villageLoot', 'hardcoded', 'villageLootGain > 0 (algum explorer/upgrade de loot)'],
  ['villagePrestige', 'hardcoded', 'stat village_faith.total >= 50'],
  ['hordeEquipment', 'hardcoded', 'Horde maxZone total > 5'],
  ['hordePrestige', 'hardcoded', 'Horde maxZone total > 20'],
  ['hordeDamageTypes', 'hardcoded', 'Horde maxZone total > 24'],
  ['hordeHeirlooms', 'hardcoded', 'Horde maxZone total > 30'],
  ['hordeRaidboss', 'hardcoded', 'Horde maxZone total > 44 (+10 raid keys)'],
  ['hordeEquipmentMastery', 'hardcoded', 'Horde maxZone total > 74'],
  ['hordeBrickTower', 'hardcoded', 'Horde maxZone total >= 140'],
  ['hordeFireTower', 'hardcoded', 'Horde maxZone total >= 170'],
  ['hordeIceTower', 'hardcoded', 'Horde maxZone total >= 200'],
  ['hordeDangerTower', 'hardcoded', 'Horde maxZone total >= 245'],
  ['hordeToxicTower', 'hardcoded', 'Horde maxZone total >= 290'],
  ['hordeForestTower', 'hardcoded', 'Horde maxZone total >= 350'],
  ['farmPowerCardPack', 'hardcoded', 'Golden Rose nível >= 1'],
  ['farmAdvancedCardPack', 'hardcoded', 'Ganhar farm_ladybug pela primeira vez'],
  ['farmLuxuryCardPack', 'hardcoded', 'Ganhar farm_bee pela primeira vez'],
  ['farmSeedCardPack', 'hardcoded', 'Ganhar farm_smallSeed pela primeira vez'],
  ['galleryAdvancedCardPack', 'hardcoded', 'Converter cor para teal pela primeira vez'],
].forEach(([k, a, b]) => addT(k, a, b));
out.unlockTriggers = unlockTriggers;
out.untriggered = Object.keys(st.unlock).filter(k => !unlockTriggers[k]);

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/gooboo-data.json', JSON.stringify(out, null, 1));
console.log('upgrades', Object.keys(upgrades).length, 'relics', Object.keys(relics).length, 'unlocks with trigger', Object.keys(unlockTriggers).length, 'untriggered', out.untriggered.length);
console.log('UNTRIGGERED:', out.untriggered.join(', '));
console.log('horde keys', out.hordeKeys.join(','));
