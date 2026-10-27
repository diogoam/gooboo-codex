// enrich.js — runs after glossary.js. Rewrites every currency/gem entry EN-first with
// "What it is / How to get it / What it does / How it's calculated / Gain affected by / Capacity affected by / Groups",
// adds "Prestige" sections to the feature pages and rewrites the Prestige concept.
// Official game terms always come from the game (links {{id}} or names from lang/en.js) — never typed by hand.
require('./bundle.js');
const fs = require('fs');
const S = globalThis.__store; const en = globalThis.__en;
globalThis.__newGame(false);
const st = S.state;
const GL = JSON.parse(fs.readFileSync('glossary.json', 'utf8'));
const BY = Object.fromEntries(GL.map(e => [e.id, e]));
const D = JSON.parse(fs.readFileSync('data/gooboo-data.json', 'utf8'));
const L = id => `{{${id}}}`;
const has = id => !!BY[id];
const LL = (id, fallback) => has(id) ? L(id) : (fallback ?? id.split(':').slice(1).join(':'));
const get = p => { let o = en; for (const k of p.split('.')) { if (o == null) return null; o = o[k]; } return o; };
const str = v => typeof v === 'string' ? v : (v && typeof v.name === 'string' ? v.name : null);
const num = v => { if (typeof v !== 'number' || !isFinite(v)) return String(v); const a = Math.abs(v); if (a && (a >= 1e6 || a < 1e-3)) return v.toExponential(2).replace('e+', 'e'); if (a >= 1000) return Math.round(v).toLocaleString('en-US'); return String(+v.toFixed(3)); };
const safe = (f, d = null) => { try { return f(); } catch { return d; } };
const C = k => L('cur:' + k);
const featName = f => str(get('feature.' + f)) || f;
const subName = (f, i) => str(get(`subfeature.${f}.${i}`)) || `${featName(f)} ${i}`;
const evName = e => str(get(`event.${e}.name`)) || e;
const list = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

const SRC = {}; const USE = {}; const NOTE = {};
const push = (o, k, t) => { if (!st.currency[k]) throw new Error('unknown currency ' + k); (o[k] = o[k] || []).push(t); };
const src = (k, t) => push(SRC, k, t); const use = (k, t) => push(USE, k, t); const note = (k, t) => push(NOTE, k, t);
const keys = re => Object.keys(st.currency).filter(k => re.test(k));

// ═══════════════ 1. HOW TO GET IT (curated from the code, v1.6.3) ═══════════════
// --- Mining
for (const [k, ing] of Object.entries(st.mining.ingredient)) {
  src('mining_' + k, `Dropped by every rock you break in the ${subName('mining', 0)} from ${ing.minDepth} m on (full amount down to ${ing.maxDepth} m; deeper only on depths divisible by ${ing.modulo}, or at half amount with a torch). Amount grows ×${num(ing.amountMult)} per meter.`);
}
src('mining_scrap', `Dropped by every rock you break (4× per break, plus 1 per hit on depths you already passed), in both mines.`);
src('mining_smoke', `Dropped while mining once smoke is unlocked (amount from Smoke gain), alongside scrap.`);
const RARE = { granite: `Breaking rocks at 50 m or deeper once the depth already has 1,000+ breaks (doubles every ×10 breaks).`, salt: `Breaking rocks at 70 m or deeper on depths with a single ore type (half amount on torch depths).`, coal: `The first break of each depth at 90 m or deeper.`, sulfur: `Each hit on a depth at 110 m or deeper that had no breaks yet.`, niter: `At 130 m or deeper: each time the depth's break count reaches a new power of 10 (1, 10, 100, 1,000…). Value grows with depth.`, obsidian: `Breaking rocks at 150 m or deeper while no enhancement is active.`, deeprock: `Breaking rocks at 275 m or deeper on depths whose digits add up to 14 or more.` };
for (const [k, t] of Object.entries(RARE)) src('mining_' + k, `${subName('mining', 0)}: ${t}`);
src('mining_limestone', `${subName('mining', 1)}: breaking rocks on prime-number depths.`);
src('mining_moonshard', `${subName('mining', 1)}: breaking rocks at 20 m or deeper, but only within your ${L('concept:dweller')} limit.`);
src('mining_phosphorus', `${subName('mining', 1)}: breaking rocks at 150 m or deeper on every 25th meter.`);
src('mining_glowshard', `Not obtainable in v1.6.3: its drop depth is disabled in the code (9999 m).`);
for (const [k, d] of Object.entries(st.mining.gas)) src('mining_' + k, `${subName('mining', 1)}: received the first time you break a depth from ${d} m on (only on new record depths).`);
for (const [k, sm] of Object.entries(st.mining.smeltery)) src(sm.output, `Smelted in the Smeltery (${LL('smelt:' + k, k)}) from ore; takes time and needs the right temperature.`);
src('mining_resin', `Produced over time in the ${subName('mining', 0)} after unlocking resin (Resin gain per second).`);
src('mining_ember', `Prestige of either mine: ⌊Ember gain × ${L('concept:dweller')} depth⌋. Not reset by prestige.`);
src('mining_crystalGreen', `Prestige of the ${subName('mining', 0)}: based on your ${L('concept:dweller')} (7 × s × 1.15^(s/2) × multiplier, s = 2 × dweller depth).`);
src('mining_crystalYellow', `Prestige of the ${subName('mining', 1)}: same ${L('concept:dweller')} formula as green crystals.`);
// --- Village
for (const [j, job] of Object.entries(st.village.job)) (job.rewards || []).forEach(r => { const m = r.name.match(/^currencyVillage(\w+)Gain$/); if (!m) return; const k = 'village_' + m[1][0].toLowerCase() + m[1].slice(1); if (st.currency[k]) src(k, `Produced by the ${LL('job:' + j, j)} job: +${num(r.amount)} per second per worker (before multipliers).`); });
src('village_coin', `Taxes: every second, employed workers × Tax rate of each food is eaten and turned into gold coins.`);
src('village_faith', `Produced over time by Faith gain (buildings and upgrades of the ${subName('village', 0)}).`);
src('village_joy', `Produced over time from happiness (Joy gain) in the ${subName('village', 0)}.`);
src('village_offering', `Bought in the Offering menu by paying a resource (cost grows ×1.5 per purchase), plus a passive 1% per second of the offerings bought this run.`);
src('village_copperCoin', `${subName('village', 1)}: selling crafted items (each item sells over time for its sell price).`);
for (const k of keys(/^village_loot\d$/)) src(k, `Found by the Explorer job (each exploration rolls one loot rarity).`);
for (const k of ['village_acidVial', 'village_snowflake', 'village_chiliBundle', 'village_gears']) if (st.currency[k]) src(k, `Special crafting ingredient: rolled from the ${LL('cons:village_ingredientBox', 'Ingredient box')} (you get 1 box per day; a prestige upgrade gives 3 more).`);
src('village_blessing', `Prestige of the ${subName('village', 0)}: equal to the ${C('village_faith')} you have at that moment.`);
src('village_shares', `Prestige of the ${subName('village', 1)}: needs at least 10,000 ${C('village_copperCoin')}; Shares gain applied to copper coins ÷ 1,000.`);
// --- Horde
src('horde_bone', `Killing enemies in both Horde modes (more per zone), and some active item skills.`);
src('horde_monsterPart', `${subName('horde', 0)}: from zone 10 on while your combo is above 0 (0.2 × 1.1^(zone − 10) per second before multipliers); also some active item skills.`);
src('horde_blood', `Killing enemies (amount from enemy difficulty), critical-hit effects and some skills.`);
src('horde_soulCorrupted', `${L('concept:rareloot')} in the ${subName('horde', 0)}: enemies from zone 21 on drop souls. Base per drop = 1.1^(zone − 21) × (zone − 20) using this run's highest zone, × Corrupted soul gain. Raids give souls too.`);
src('horde_corruptedFlesh', `Produced every second once ${L('unl:hordeCorruptedFlesh')} is unlocked (bought with the upgrade ${L('upg:horde_purifier')}, zone 42).`);
src('horde_mysticalShard', `${subName('horde', 0)}: random drop over time from items with high mastery; stops at its capacity.`);
src('horde_soulEmpowered', `Prestige of the ${subName('horde', 0)}: equal to the ${C('horde_soulCorrupted')} you have (so your soul capacity limits it).`);
src('horde_courage', `Prestige of the ${subName('horde', 1)}: Courage gain applied to this run's courage score.`);
src('horde_crown', `Beating floors of the towers (spend a ${C('horde_towerKey')} to enter).`);
src('horde_raidKey', `${subName('horde', 0)}: 1 per day once raids are visible, and rewards for clearing new zones.`);
src('horde_towerKey', `1 per week once towers are visible, plus one-time rewards for reaching certain zones.`);
src('horde_lockpick', `${subName('horde', 1)}: produced over time while playing the ${LL('class:pirate')} class.`);
for (const k of keys(/^horde_\w+Essence$/)) src(k, `${subName('horde', 0)}: dropped by enemies of that element while the item ${L('equip:essenceExtractor')} is equipped (rare loot).`);
for (const k of keys(/^horde_monsterTooth/)) src(k, `${subName('horde', 1)}: random drop from enemies of its area (chance drops after each tooth; stops at capacity).`);
// --- Farm
for (const t of ['vegetable', 'berry', 'grain', 'flower']) src('farm_' + t, `Harvesting ${t} crops (yield × multipliers).`);
src('farm_gold', `Harvesting crops (chance for gold on each harvest) and some care effects.`);
src('farm_rainwater', `Collected over time (Rainwater gain) after unlocking it; used for crop care.`);
// --- Gallery
src('gallery_beauty', `Produced every second (Beauty gain). Each produced paint color adds base beauty gain.`);
for (const col of st.gallery.color) { const k = 'gallery_' + col; if (!st.currency[k]) continue; src(k, `Produced every second (its gain comes from the next color in the chain), and by converting with ${C('gallery_converter')}s.`); if (st.currency[k + 'Drum']) src(k + 'Drum', `Opening ${C('gallery_package')}s: each package rolls a chain of drum chances, color by color.`); }
src('gallery_converter', `Grows on its own every second (base gain plus 0.25% of what you have per second) up to its capacity.`);
src('gallery_package', `Produced over time once drums are unlocked (Package gain), up to capacity.`);
src('gallery_inspiration', `Earned over time: each new inspiration takes longer than the last.`);
src('gallery_motivation', `Produced over time once Shapes is unlocked (Motivation gain); above capacity gain is halved.`);
for (const s of Object.keys(st.gallery.shape)) if (st.currency['gallery_' + s] && !st.gallery.shape[s].isSpecial) src('gallery_' + s, `Shapes: clicking a group of 5+ connected ${s} pieces gives n² of it (× gain multiplier), and special shapes give it too.`);
src('gallery_mysteryShape', `Shapes: clicking the special ${L('shape:chest')} when the 10 cells around it hold 10 different normal shapes ("full chest"). Amount = Mystery shape gain, whose base comes from the idea ${L('idea:beMysterious')} (+1 per level).`);
src('gallery_cash', `Prestige of the ${L('feat:gallery')}: 10^(log₈(beauty ÷ 1e11)^0.7) × Cash gain; needs at least 1e12 beauty this run.`);
// --- Gems & meta
src('gem_ruby', `Generated over time with ${C('gem_emerald')} (1 per hour at base, +1% speed per achievement level), × Ruby gain. 50 when Gems unlock.`);
src('gem_emerald', `Generated over time (1 per hour at base, +1% speed per achievement level). 100 when Cards unlock, 300 when Treasure unlocks.`);
src('gem_sapphire', `Generated over time with ${C('gem_amethyst')} (1 per hour at base, +0.5% speed per achievement level).`);
src('gem_amethyst', `Generated over time with ${C('gem_sapphire')} (1 per hour at base, +0.5% speed per achievement level). 800 when Gems unlock.`);
src('gem_topaz', `Generated at the secondary gem speed on days without a big event (during big events that progress becomes event currency instead). 500 when Events unlock; Bank interest and loans.`);
src('gem_diamond', `Generated once ${L('unl:gemDiamond')} is unlocked: 1 per day.`);
src('gem_onyx', `Not obtainable in v1.6.3 (no source in the code).`);
src('relic_power', `Generated over time once relics are unlocked (Relic energy gain), up to capacity.`);
src('treasure_fragment', `Destroying treasures, bought with ${C('gem_emerald')}, and some treasure modifiers.`);
src('school_examPass', `Generated over time by the School and gained with Global level.`);
src('school_goldenDust', `Finishing studies/exams, converting exam passes, and extra card copies.`);
src('card_shinyDust', `Getting a card copy you already have as shiny, and extra shiny copies.`);
// --- Events (big events produce their own currencies)
const EVENT_SRC = {
  cinders: `${evName('cinders')} event: ${C('event_light')} is produced by light producers; ${C('event_soot')} comes from light; tokens come from light milestones.`,
  bloom: `${evName('bloom')} event: grow and breed flowers; selling flowers gives ${C('event_blossom')}.`,
  weatherChaos: `${evName('weatherChaos')} event: fishing (fish, trash and ${C('event_slime')} from catches).`,
  summerFestival: `${evName('summerFestival')} event: produced by island buildings and collected as drops.`,
  nightHunt: `${evName('nightHunt')} event: ingredients come in over time and from rituals.`,
  snowdown: `${evName('snowdown')} event: produced over time and from snowball fights.`,
};
const evOf = {};
for (const [ev, o] of Object.entries(st.event.big)) { if (o.currency) evOf['event_' + o.currency] = ev; }
for (const k of keys(/^event_/)) {
  const tk = k.match(/^event_(\w+)Token$/);
  if (tk) { src(k, `Reward of the ${evName(tk[1])} event (from its progress milestones); its shop is available while the event runs.`); continue; }
  if (evOf[k]) src(k, `During the ${evName(evOf[k])} event the secondary gem progress becomes this currency (instead of ${C('gem_topaz')}).`);
}
// generic: anything that adds BASE gain to a currency produces it over time (event producers, buildings…)
const gainBase = {}; // currencyKey -> [source text]
const gainKey = name => { const m = name.match(/^currency([A-Z][a-z]+)(\w+)Gain$/); if (!m) return null; const k = m[1].toLowerCase() + '_' + m[2][0].toLowerCase() + m[2].slice(1); return st.currency[k] ? k : null; };
// Summer festival
const SF = st.summerFestival;
for (const [b, o] of Object.entries(SF.building)) {
  const p = Object.assign({}, ...[0, 1, 2, 3, 4, 5].map(l => safe(() => o.price(l)) || {}));
  const bn = str(get(`event.summerFestival.building.${b}`)) || b;
  for (const c of Object.keys(p)) if (st.currency[c]) use(c, `${evName('summerFestival')}: building cost of ${bn}.`);
  for (const [a, ac] of Object.entries(o.action || {})) {
    for (const c of Object.keys(ac.input || {})) if (st.currency[c]) use(c, `${evName('summerFestival')}: input of ${bn} (${Object.keys(ac.output || {}).map(C).join(', ')}).`);
    for (const c of Object.keys(ac.output || {})) if (st.currency[c]) src(c, `${evName('summerFestival')}: made by ${bn} from ${Object.entries(ac.input || {}).map(([x, n]) => `${num(n)} ${C(x)}`).join(' + ')}.`);
  }
  (o.effect || []).forEach(e => { const k = gainKey(e.name); if (k && e.type === 'base') src(k, `${evName('summerFestival')}: produced over time by the building ${bn}.`); });
}
for (const [ct, o] of Object.entries(SF.cellType)) if (o.produces && st.currency['event_' + o.produces]) src('event_' + o.produces, `${evName('summerFestival')}: collected from ${ct} cells on the island.`);
for (const req of Object.values(SF.quest || {})) (Array.isArray(req) ? req : []).forEach(r => { if (r.type === 'currency' && st.currency[r.name]) use(r.name, `${evName('summerFestival')}: delivered to complete quests.`); });
// Snowdown items, Night hunt potions, event upgrades
for (const [i, o] of Object.entries(st.snowdown.item)) (o.effect || []).forEach(e => { const k = gainKey(e.name); if (k && e.type === 'base') src(k, `${evName('snowdown')}: produced over time by the item ${str(get(`event.snowdown.item.${i}`)) || i}.`); });
for (const [i, o] of Object.entries(st.nightHunt.potion)) (o.effect || []).forEach(e => { const k = gainKey(e.name); if (k && e.type === 'base') src(k, `${evName('nightHunt')}: produced over time by the ${str(get(`event.nightHunt.potion.${i}`)) || i} potion.`); });
for (const [u, o] of Object.entries(st.upgrade.item)) (o.effect || []).forEach(e => { const k = gainKey(e.name); if (k && e.type === 'base' && k.startsWith('event_')) src(k, `Produced over time by the upgrade ${LL('upg:' + u)}.`); });
const NOTE_EVENT = {
  nightHunt: `${evName('nightHunt')}: ingredients for rituals and potions; changed into tokens and other ingredients.`,
  bloom: `${evName('bloom')}: grown and used to breed flowers.`,
  weatherChaos: `${evName('weatherChaos')}: fishing catches; used for fishing upgrades.`,
};
use('event_humus', `${evName('bloom')}: buying flowers and using Wildgrowth/boosts.`);
use('event_snowball', `${evName('snowdown')}: snowball fights and rerolling items.`);
use('event_snow', `${evName('snowdown')}: buying snow items.`);
use('event_wax', `${evName('cinders')}: lighting candles.`);
use('event_cloud', `${evName('weatherChaos')}: buying bait and resetting the weather cycle.`);
use('event_cocktail', `${evName('summerFestival')}: skipping building time.`);
use('event_magic', `${evName('nightHunt')}: spent every second to produce ${C('event_essence')}.`);
use('event_blossom', `${evName('bloom')}: currency of the event (upgrades).`);
for (const k of keys(/^event_/)) if (!SRC[k]) {
  const f = /fish|algae|driftwood|plastic|slime/i.test(k) ? 'weatherChaos' : /lavender|mapleLeaf|fourLeafClover|charredSkull|mysticalWater|cheese|spiderWeb|strangeEgg|puzzlePiece|wizardHat|cactus|feather|essence/.test(k) ? 'nightHunt' : null;
  if (f === 'weatherChaos') src(k, `${evName('weatherChaos')}: caught while fishing.`);
  if (f === 'nightHunt') src(k, `${evName('nightHunt')}: ritual/potion ingredient you receive over time and when you change ingredients.`);
}
for (const k of keys(/^event_/)) if (!USE[k] && /lavender|mapleLeaf|fourLeafClover|charredSkull|mysticalWater|cheese|spiderWeb|strangeEgg|puzzlePiece|wizardHat|cactus|feather/.test(k)) use(k, `${evName('nightHunt')}: put into rituals (finding potion recipes and raising potions).`);
// Gallery color chain and drums
st.gallery.color.forEach((col, i) => { const k = 'gallery_' + col; if (!st.currency[k]) return; const prev = i === 0 ? 'gallery_beauty' : 'gallery_' + st.gallery.color[i - 1]; use(k, `Gives base gain to ${C(prev)}: f(v) = v up to 100, then √(100·v) — every color feeds the one before it, down to beauty.`); if (i + 1 < st.gallery.color.length) use(k, `Spent (with ${C('gallery_converter')}s) to convert into ${C('gallery_' + st.gallery.color[i + 1])}.`); if (st.currency[k + 'Drum']) use(k + 'Drum', `Each drum speeds up the canvas of ${C(k)} by 10%.`); });
// Farm crop costs and village food
for (const [cr, c] of Object.entries(st.farm.crop)) for (const [k, n] of Object.entries(c.cost || {})) if (st.currency[k]) use(k, `Planting ${LL('crop:' + cr, cr)} costs ${num(n)}.`);
for (const [k, c] of Object.entries(st.currency)) if (c.subtype === 'food') use(k, `Food: eaten by taxpayers every second and turned into ${C('village_coin')} (taxes).`);
src('event_light', EVENT_SRC.cinders); src('event_soot', EVENT_SRC.cinders);
src('event_blossom', `${evName('bloom')}: selling flowers.`);
src('event_pearl', `${evName('summerFestival')}: chance to find one when the Shell opener opens shells.`);
for (const [u, o] of Object.entries(st.upgrade.item)) (o.effect || []).forEach(e => { const k = gainKey(e.name); if (k && e.type === 'base' && !k.startsWith('event_') && !SRC[k]) src(k, `Produced over time by ${LL('upg:' + u)} (adds base gain).`); });
use('mining_smoke', `Spent entirely when you craft a pickaxe: more smoke = more crafting power.`);

// ═══════════════ 2. WHAT IT DOES (uses) ═══════════════
const upgLabel = { regular: 'upgrades', prestige: 'prestige upgrades', premium: 'premium upgrades (gem shop)', building: 'buildings', shape: 'shape upgrades' };
const priceGroups = {}; // key -> {group -> [ids]}
for (const [k, u] of Object.entries(st.upgrade.item)) {
  const seen = new Set();
  for (let lv = 0; lv < Math.min(u.cap ?? 25, 25); lv++) { const p = safe(() => u.price(lv)); if (!p) break; Object.keys(p).forEach(c => seen.add(c)); }
  const grp = (u.feature === 'event' ? `${evName(u.type.replace(/Producer$/, ''))} event upgrades` : `${featName(u.feature)} ${upgLabel[u.type] || u.type + ' upgrades'}`);
  for (const c of seen) if (st.currency[c]) ((priceGroups[c] = priceGroups[c] || {})[grp] = (priceGroups[c][grp] || [])).push('upg:' + k);
}
for (const [c, g] of Object.entries(priceGroups)) for (const [grp, ids] of Object.entries(g)) use(c, `Buys ${grp}: ${ids.slice(0, 25).map(i => LL(i)).join(', ')}${ids.length > 25 ? ` … and ${ids.length - 25} more` : ''}.`);
for (const [k, r] of Object.entries(st.village.crafting)) for (const c of Object.keys(r.price || {})) if (st.currency[c]) use(c, `Ingredient of the crafting recipe ${LL('craft:' + k, k)}.`);
for (const [k, o] of Object.entries(st.village.offering)) if (st.currency['village_' + k]) use('village_' + k, `Sacrificed for ${C('village_offering')} (offering ${LL('offer:' + k, k)}).`);
for (const [k, sm] of Object.entries(st.mining.smeltery)) { const p = safe(() => sm.price(0)) || {}; for (const c of Object.keys(p)) if (st.currency[c]) use(c, `Smelted into ${C(sm.output)} (${LL('smelt:' + k, k)}).`); }
for (const [k, p] of Object.entries(st.card.pack)) { if (p.price) use('gem_emerald', null); }
use('gem_emerald', `Buys card packs (${Object.values(st.card.pack).filter(p => p.price).length} packs, 5–60 emeralds each), treasures, treasure fragments and skipping School books.`);
use('card_shinyDust', `Buys shiny card packs (each pack's shiny price).`);
for (const [k, c] of Object.entries(st.consumable)) if (c.price) for (const [pc, amt] of Object.entries(c.price)) if (st.currency[pc]) use(pc, `Buys the consumable ${LL('cons:' + k, k)} (${num(amt)}).`);
const POOL = p => p === 'merchant' ? `${evName('merchant')}` : /^bingo/.test(p) ? `${evName('casino')} bingo` : /^wheelOfFortune/.test(p) ? `${evName('casino')} wheel` : `${evName(p)} event shop`;
const prizeName = (pz) => pz.type === 'currency' ? C(pz.item) : pz.type === 'cardPack' ? LL('pack:' + pz.item, `card pack ${str(get('card.pack.' + pz.item)) || pz.item}`) : pz.type === 'relic' ? LL('relic:' + pz.item) : pz.type === 'consumable' ? LL('cons:' + pz.item) : pz.type === 'card' ? LL('card:' + pz.item, pz.item === 'quest' ? `a missing quest card (${LL('col:specialGadgets', 'quest cards')})` : pz.item) : `${pz.type} ${pz.item}`;
const poolBuys = {};
for (const pz of Object.values(st.event.prize)) for (const [pool, po] of Object.entries(pz.pool || {})) {
  if (pz.type === 'currency' && st.currency[pz.item]) src(pz.item, `Prize in the ${POOL(pool)}${po.price ? ` (costs ${Object.entries(po.price).map(([c, a]) => `${num(a)} ${C(c)}`).join(' + ')})` : ''}.`);
  for (const c of Object.keys(po.price || {})) ((poolBuys[c] = poolBuys[c] || {})[POOL(pool)] = (poolBuys[c][POOL(pool)] || new Set())).add(prizeName(pz));
}
for (const [c, g] of Object.entries(poolBuys)) for (const [pool, s] of Object.entries(g)) if (st.currency[c]) use(c, `Spent in the ${pool} on: ${[...s].slice(0, 20).join(', ')}${s.size > 20 ? ' …' : ''}.`);
// action spends (from currency/spend call sites)
const SPEND = {
  gem_topaz: [`Casino bingo cards and wheel spins, Bank projects, investments and loan repayments, Weather chaos fishing rods, Snowdown items and Summer festival island cells.`],
  gem_sapphire: [`Farm fertilizers, extra School exam attempts and treasure modifiers.`],
  gem_amethyst: [`Buys themes (cosmetic).`],
  gem_diamond: [`The gem forge.`],
  gallery_motivation: [`Every Shapes action: swapping two pieces (1), clicking a group or a special (1), the reroll (35).`],
  gallery_inspiration: [`Buying a level of an idea (1 per level).`],
  gallery_package: [`Opening packages turns them into drums.`],
  gallery_converter: [`Converting colors: each conversion spends all converters plus 1000·10^i of the previous color.`],
  school_examPass: [`Starting an exam; converting into ${C('school_goldenDust')}.`],
  school_goldenDust: [`Time skips in the Golden dust menu.`],
  treasure_fragment: [`Upgrading treasures.`],
  horde_monsterPart: [`Upgrading item levels in the ${subName('horde', 0)}.`],
  horde_raidKey: [`Entering (or slaying) a raid.`], horde_towerKey: [`Entering a tower.`],
  horde_lockpick: [`Opening chests in the ${subName('horde', 1)}.`], horde_mysticalShard: [`Item mastery/abilities that consume shards.`],
  mining_resin: [`Adding resin to a pickaxe craft (better quality).`],
  farm_rainwater: [`Caring for crops (watering).`],
  village_offering: [`Upgrading offerings.`],
  relic_power: [`Using active relics.`],
};
for (const k of keys(/^horde_\w+Essence$/)) use(k, `Buys the elemental upgrade of its element.`);
for (const b of Object.keys(st.mining.enhancement)) if (st.currency['mining_' + b]) use('mining_' + b, `Ingredient for pickaxe enhancements (${LL('enh:' + b, b)}).`);
for (const [k, a] of Object.entries(SPEND)) a.forEach(t => use(k, t));
// conversions to prestige
use('village_faith', `Becomes ${C('village_blessing')} 1:1 when you prestige the ${subName('village', 0)} — the faith you hold at that moment is your prestige gain.`);
use('village_copperCoin', `Becomes ${C('village_shares')} when you prestige the ${subName('village', 1)}.`);
use('horde_soulCorrupted', `Becomes ${C('horde_soulEmpowered')} 1:1 when you prestige the ${subName('horde', 0)} — what you hold (limited by capacity) is your prestige gain.`);
use('horde_corruptedFlesh', `Buys ${L('upg:horde_cleansingRitual')}: each level lowers Corruption by 0.08 (cost 2,000 × 1.12^level). Corruption makes enemies stronger, so flesh is how you keep pushing zones.`);
use('gallery_beauty', `Decides the ${C('gallery_cash')} you get at prestige (needs 1e12 this run) and gives Gallery Global level (⌊log₄ of all-time beauty⌋).`);
// questlines & achievements that count it
const pretty = s => s;
for (const [g, gen] of Object.entries(D.generalsFull)) for (const [q, qu] of Object.entries(gen.quests)) qu.stages.forEach(sg => sg.raw.forEach((t, i) => {
  if (t.type !== 'stat') return; const k = st.currency[t.name] ? t.name : (t.name.endsWith('Max') && st.currency[t.name.slice(0, -3)] ? t.name.slice(0, -3) : null);
  if (k) note(k, `Counts toward the questline ${LL(`quest:${g}.${q}`, q)}, stage ${sg.n}: ${sg.tasks[i].replace(' (nesta run)', ' (this run)').replace(' — o jogo dá 6 cópias', ' — the game gives 6 copies')}${sg.relic ? ` (stage reward: relic ${LL('relic:' + sg.relic, sg.relic)})` : ''}.`);
}));
for (const [k, a] of Object.entries(st.achievement)) { const s = safe(() => String(a.value), ''); for (const m of s.matchAll(/stat\.(\w+)\.(total|value)/g)) if (st.currency[m[1]]) note(m[1], `Tracked by the achievement ${LL('ach:' + k, k)}.`); }
// rewards: cards
for (const [id, c] of Object.entries(st.card.card)) (c.reward || []).forEach(r => { if (r.type === 'currency' && st.currency[r.name]) src(r.name, `Extra copies of the card ${LL('card:' + id, id)} (instant card) give ${num(typeof r.value === 'function' ? safe(() => r.value(1)) : r.value)} each.`); if (r.type === 'addRareDrop' && st.currency[r.name]) src(r.name, `Rare drop added to farm crops by the card ${LL('card:' + id, id)} while equipped.`); });
// rare drops: crops & genes
const cropDrops = {};
for (const [cr, c] of Object.entries(st.farm.crop)) (c.rareDrop || []).forEach(r => { const k = r.name; if (st.currency[k]) (cropDrops[k] = cropDrops[k] || []).push(LL('crop:' + cr, cr)); });
for (const [k, l] of Object.entries(cropDrops)) src(k, `Rare drop when harvesting: ${list(l)} (chance grows with crop level and grow time; Rare drop chance, care and genes raise it).`);
for (const [g, ge] of Object.entries(st.farm.gene)) (ge.effect || []).forEach(e => { if (e.type === 'addRareDrop' && st.currency[e.name]) src(e.name, `Rare drop on any crop with the gene ${LL('gene:' + g, g)}.`); });
// special notes
note('farm_mysteryStone', `No use in v1.6.3 — the game text itself asks "What uses does it have?". It only matters for the questline ${L('quest:grobodal.discoveringTheMystery')}, whose reward is the relic ${L('relic:museumKey')} that unlocks the ${L('concept:museum')}. Upgrading the ${L('gene:mystery')} gene has no effect in this version.`);
note('gallery_mysteryShape', `No use in v1.6.3 besides the questline ${L('quest:grobodal.discoveringTheMystery')} (relic ${L('relic:museumKey')} → ${L('concept:museum')}).`);
note('gem_onyx', `Exists in the code but has no source and no use in v1.6.3.`);
note('mining_glowshard', `Disabled in v1.6.3.`);

// ═══════════════ 3. PRESTIGE per feature ═══════════════
const PRESTIGE = {
  mining: [`${subName('mining', 0)} → ${C('mining_crystalGreen')}; ${subName('mining', 1)} → ${C('mining_crystalYellow')}. The amount comes from your ${L('concept:dweller')} (the depth dweller settles at up to a % of this run's max depth): 7 × s × 1.15^(s/2) × multiplier, s = 2 × dweller depth.`,
    `Both mines also give ${C('mining_ember')}: ⌊Ember gain × dweller depth⌋.`,
    `Resets: regular upgrades, regular currencies (ores, bars, scrap, rare earths…), run stats, depth and enhancements. Keeps: prestige and premium upgrades, records (max depth), gases and other prestige currencies.`,
    `When: the dweller grows fast at first and slows near its limit — prestige when the crystal gain per hour stops rising, or when you need crystals for the next prestige upgrade.`],
  village: [`${subName('village', 0)} → ${C('village_blessing')} = the ${C('village_faith')} you hold. ${subName('village', 1)} → ${C('village_shares')} from ${C('village_copperCoin')} (needs 10,000+).`,
    `Resets: regular upgrades and buildings, regular currencies (materials, food, coins, faith), run stats. Keeps: prestige and premium upgrades, offerings, policies' unlocks.`,
    `When: faith accumulates over time, so prestige when the next blessing upgrade is affordable or faith/hour flattens.`],
  horde: [`${subName('horde', 0)} → ${C('horde_soulEmpowered')} = the ${C('horde_soulCorrupted')} you hold (limited by soul capacity, which grows with your record zone). ${subName('horde', 1)} → ${C('horde_courage')} from the run's courage score.`,
    `Resets: regular upgrades, regular currencies (bone, monster parts, blood, flesh, souls), run stats, equipped items, item levels of items with mastery below 3, found items with mastery below 1, per-run item effects. Keeps: mastery 3+ levels, heirlooms, prestige/premium upgrades, crowns, keys.`,
    `When: soul gain per drop grows ×1.1 per zone but capacity caps what you keep — prestige when you are near capacity or soul gain per hour drops below the run average.`],
  farm: [`No feature-wide prestige: each crop prestiges on its own. A crop prestige resets that crop's level and raises its record; every level above the record gives ×1.04 to that crop.`,
    `Crop records also feed Farm Global level (per crop: min(level, level÷2+5, 25)).`],
  gallery: [`${L('feat:gallery')} → ${C('gallery_cash')} = 10^(log₈(beauty ÷ 1e11)^0.7) × Cash gain; needs at least 1e12 beauty this run.`,
    `Resets: regular upgrades, regular currencies (beauty, paints, drums, shapes, motivation), run stats, idea levels (owned ideas stay owned), canvas spaces and the shape board. Keeps: prestige and premium upgrades, shape upgrades.`,
    `When: ×8 beauty gives much less than ×2 cash, so short frequent runs usually win; prestige when cash/hour stops rising.`],
};
for (const [f, lines] of Object.entries(PRESTIGE)) { const e = BY['feat:' + f]; if (!e) continue; e.s = e.s.filter(x => x.h !== 'Prestige'); e.s.splice(1, 0, { h: 'Prestige', b: lines }); }
const pc = BY['concept:prestige'];
if (pc) pc.s = [
  { h: 'What it is', b: [`Resetting one feature to turn this run's progress into a permanent prestige currency. Each feature (and subfeature) prestiges on its own; nothing else resets.`] },
  { h: 'What each one gives', b: [`${L('feat:mining')}: ${C('mining_crystalGreen')} / ${C('mining_crystalYellow')} + ${C('mining_ember')}`, `${L('feat:village')}: ${C('village_blessing')} (from ${C('village_faith')}) / ${C('village_shares')} (from ${C('village_copperCoin')})`, `${L('feat:horde')}: ${C('horde_soulEmpowered')} (from ${C('horde_soulCorrupted')}) / ${C('horde_courage')}`, `${L('feat:farm')}: per crop (×1.04 per level above the record)`, `${L('feat:gallery')}: ${C('gallery_cash')} (from ${C('gallery_beauty')})`] },
  { h: 'Details', b: [`Prestige and premium upgrades never reset. Selected cards are equipped at the moment you prestige (${L('concept:cards')}). Your best prestige feeds the ${L('concept:cryolab')}. Each feature page has a Prestige section with what resets and when to prestige.`] },
];

// ═══════════════ 4. Rewrite currency entries (EN) ═══════════════
const enLine = t => t.replace(/\(nível (\d+)\)/g, '(level $1)').replace(/\(bônus final\)/g, '(final bonus)').replace(/^Também via grupo /, 'Also via group ').replace(/ \(ainda bloqueado\)/g, ' (still locked)');
const HEAD = { 'Ganho afetado por': 'Gain affected by', 'Capacidade afetada por': 'Capacity affected by', 'Grupos': 'Groups' };
let stats = { noSrc: [], noUse: [] };
for (const e of GL) {
  if (!e.id.startsWith('cur:')) continue;
  const k = e.k; const c = st.currency[k]; const [f] = k.split('_');
  const what = [];
  const feat = st.system.features[f] ? L('feat:' + f) : featName(f);
  const PRES = ['mining', 'village', 'horde', 'gallery'];
  if (f === 'event') what.push(c.type === 'token' ? `Event token of ${feat}: kept after its event ends, but cleared when the next big event starts. Spend it in the event's shop.` : st.event.big[c.type] ? `Currency of the ${evName(c.type)} event (${feat}): reset when the event ends.` : `Currency of ${feat}.`);
  else if (c.type === 'prestige') what.push(`Prestige currency of ${feat}: never reset by prestige.`);
  else if (c.type === 'regular' && PRES.includes(f)) what.push(`Run currency of ${feat}: reset when you prestige ${feat}.`);
  else what.push(`Currency of ${feat}: never reset (${f === 'farm' ? 'the Farm prestiges each crop, not its currencies' : 'this feature has no prestige'}).`);
  if (c.cap !== null && c.cap !== undefined) what.push(c.overcapMult > 0 ? `Has a capacity. Above it you still gain, but less: ×${num(c.overcapMult)} for the first excess, then ×${num(c.overcapScaling)} for each further multiple of the cap (${L('concept:overcap')}).` : `Has a capacity; gain stops at the cap.`);
  const old = Object.fromEntries(e.s.map(x => [x.h, x.b]));
  const s = [{ h: 'What it is', b: what }];
  const get_ = (SRC[k] || []).filter(Boolean);
  s.push({ h: 'How to get it', b: get_.length ? [...new Set(get_)] : ['No source found in the v1.6.3 code.'] });
  let uses = [...new Set((USE[k] || []).filter(Boolean))];
  uses = uses.filter(u => { if (!/^Buys .* upgrades/.test(u)) return true; const ids = [...u.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]); return !ids.every(id => uses.some(o => o !== u && o.includes(L(id)))); });
  const notes = [...new Set(NOTE[k] || [])];
  s.push({ h: 'What it does', b: uses.length ? uses.concat(notes) : [`Not spent on anything in v1.6.3.`].concat(notes) });
  if (old['Ganho afetado por'] || old['Capacidade afetada por']) s.push({ h: "How it's calculated", b: [`Gain and capacity follow ${L('concept:mult')}: (base + base bonuses) × multipliers + final bonuses. Multipliers stack by multiplication, so the cheapest ×1.x usually pays off more than another +base once the base is large.`] });
  for (const h of ['Ganho afetado por', 'Capacidade afetada por', 'Grupos']) if (old[h]) s.push({ h: HEAD[h], b: old[h].map(enLine) });
  e.s = s;
  if (!get_.length) stats.noSrc.push(k); if (!uses.length && !notes.length) stats.noUse.push(k);
}

// ═══════════════ 5. finalize links ═══════════════
const missing = new Set();
const fix = t => t.replace(/\{\{([^}]+)\}\}/g, (m, id) => { if (BY[id]) return m; missing.add(id); return `«${id.split(':').slice(1).join(':')}»`; });
for (const e of GL) e.s = e.s.map(x => ({ h: x.h, b: x.b.filter(Boolean).map(fix) })).filter(x => x.b.length);
fs.writeFileSync('glossary.json', JSON.stringify(GL));
console.log('currencies without source:', stats.noSrc.length, stats.noSrc.join(', '));
console.log('currencies without use/note:', stats.noUse.length, stats.noUse.join(', '));
console.log('missing links', missing.size, [...missing].slice(0, 40).join(', '));
