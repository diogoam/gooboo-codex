// featguides.js — runs after guides.js. Codex lot 3:
//  1) one guide per feature (category "Guide"): what it is, the loop, what limits you, what to prioritize, prestige,
//     numbers measured on the player's saves by the helpers, and which helper covers it;
//  2) the Cryo lab page rewritten (EN) from the cryolab study; its live calculator lives in calc.js (F.cryolab).
// Official game terms always come from the game (links {{id}}) — never typed by hand. Explanations are ours, in English.
require('./bundle.js');
const fs = require('fs');
const GL = JSON.parse(fs.readFileSync('glossary.json', 'utf8'));
const BY = Object.fromEntries(GL.map(e => [e.id, e]));
const L = id => { if (!BY[id]) throw new Error('missing link ' + id); return `{{${id}}}`; };
const add = (id, n, f, secs) => { const e = { id, c: 'Guide', n, k: id.split(':')[1], f, d: null, col: null, s: secs.map(([h, b]) => ({ h, b })) }; const i = GL.findIndex(x => x.id === id); if (i >= 0) GL[i] = e; else GL.push(e); BY[id] = e; };
// pre-register so guides can link each other
['mining', 'village', 'horde', 'farm', 'gallery', 'school', 'gems', 'progress'].forEach(k => BY['guide:' + k] = BY['guide:' + k] || { id: 'guide:' + k });

add('guide:progress', 'Guide · What limits your progress', 'meta', [
  ['What it is', [`One ruler for the whole game: your ${L('concept:gl')}. Every feature part only keeps its record, so the question is which multiplier moves the most Global level per effort.`]],
  ['The rule of thumb', [`A permanent ×m on a channel is worth about E × ln(m) Global level, where E is how many GL that channel still controls. Channels already at their cap or at the GL ceiling are worth 0, however big the number looks.`,
    `Measured on the player's save (late game): ${L('mult:farmExperience')} dominates (~28 GL per ln, because 22 crops level together), then ${L('cur:horde_courage')}, Mining damage, ${L('cur:mining_crystalGreen')}, vegetables, rare earth and ${L('cur:village_faith')} (only until the ${L('upg:village_treehouse')} reaches 25).`,
    `Worth ~0 at that point: scrap, bone, ore, grain/berry/flower, coins and Village materials — they sit at their capacity or their GL part is maxed.`]],
  ['What to do with it', [`Before spending gems, treasure slots or a ${L('concept:cryolab')} freeze, ask which channel it multiplies and whether that channel still has GL to give.`, `The ${L('concept:cryolab')} level of the Farm (Crop experience ×1.15) is the single best permanent multiplier in that save.`]],
  ['Guides', [`${L('guide:mining')} · ${L('guide:village')} · ${L('guide:horde')} · ${L('guide:farm')} · ${L('guide:gallery')} · ${L('guide:school')} · ${L('guide:gems')}`]],
]);

add('guide:mining', 'Guide · Mining', 'mining', [
  ['What it is', [`Break layers with your pickaxe to go deeper; each layer drops ores and ${L('cur:mining_scrap')}. Depth is the main stat: it unlocks ores, raises the ${L('concept:dweller')} and with it your prestige. Two subfeatures: the ore mine and the gas mine.`]],
  ['The loop', [`Scrap buys damage upgrades → you break deeper layers → new ores → the smeltery turns ores into bars → bars buy upgrades and ${L('concept:enhancement')} → deeper again. The ${L('concept:dweller')} slowly settles toward a share of your max depth; at prestige it becomes ${L('cur:mining_crystalGreen')} (gas mine: ${L('cur:mining_crystalYellow')}) plus ${L('cur:mining_ember')}.`]],
  ['What limits you', [`Toughness: from 300 m every layer that is a multiple of 10 is ×100 tougher, and toughness grows ~3× per metre. The 310 wall needed ~×114 more damage on the measured save.`,
    `${L('cur:mining_scrap')} capacity is the real ceiling of damage: the damage upgrades all hit the scrap cap. ×10 capacity ≈ ×7 damage. ${L('cur:mining_helium')} from the gas mine is the biggest capacity source.`,
    `Per run, bars are limited by ore capacity and smelting time (each bar ×1.04 ore and ×1.045 time).`]],
  ['What to prioritize', [`${L('cur:mining_niter')} into ${L('upg:mining_acidVial')}: ×1.2 damage per level for ×1.23 price — damage grows ~niter^0.88, the best lever per resource. Collect niter from fast layers and use the ${L('relic:stonepiercer')} Shatter on the layer that gives the most niter per Shatter.`,
    `${L('cur:mining_barSteel')} enhancements up to the per-run maximum (×12.7 at level 7, ~5 h of smelting).`,
    `Gas runs: push when the next layer breaks within ~1 day, otherwise fill ${L('cur:mining_smoke')} and craft a better pickaxe, and farm ${L('cur:mining_moonshard')} when a Moonstone is ≤ 3 days away. ${L('upg:mining_enrichedCrystal')} to 10 at the start gave +48% yellow crystals. Yellow per day peaks around 45–55 days of run.`,
    `Before each prestige, spend what would be lost (bars, ore, coal) on upgrades the prestige keeps — ${L('upg:mining_titaniumForge')} is the best per bar; ${L('upg:mining_crystalSafe')} 12 makes the Iridium expansion permanent.`]],
  ['Prestige', [`${L('prestige:mining.0')} and ${L('prestige:mining.1')}: formula, what resets, your live gain.`]],
  ['Helper', [`Gooboo Assist – Mining: niter collection in order, Shatter planner, the wall card, enhancements and smeltery plan, gas mine pilot, closing the run with keeper upgrades.`]],
]);

add('guide:village', 'Guide · Village', 'village', [
  ['What it is', [`Build housing and buildings, assign villagers to jobs and turn materials into ${L('cur:village_faith')}. Two subfeatures: the Village (workers) and the ${L('concept:crafting')} (crafting for ${L('cur:village_copperCoin')}).`]],
  ['The loop — workers', [`Jobs produce materials and food; buildings raise caps and unlock more; ${L('cur:village_faith')} accumulates and becomes ${L('cur:village_blessing')} 1:1 at prestige. Housing levels up to 25 give Global level.`,
    `Pollution lowers happiness; sometimes accepting more pollution pays for the bonus of a building. Prices may go above the cap — the game lets you gather past it at a reduced rate (${L('concept:overcap')}).`]],
  ['The loop — Crafters guild', [`Recipes turn materials into items you sell for ${L('cur:village_copperCoin')}. Best sell price ≈ value ÷ √(100 × items made per second), which gives 0.1 × value × √rate copper per second. More material only pays as a square root; copper gain multipliers pay linearly.`,
    `${L('cur:village_shares')} at prestige follow copper (÷1,000), and copper overcap halves past each capacity step, so ${L('upg:village_cashRegister')} and ${L('upg:village_hireAccountants')} matter as much as gain.`]],
  ['What limits you', [`Workers: pollution tolerance, gem/coin/marble/science caps, joy cap, loot. The Village GL part is near its practical ceiling late game (the last ${L('upg:village_treehouse')} levels are very expensive).`,
    `Guild: copper income; on the measured save long runs gave more Shares per day (income keeps accelerating and the ${L('concept:cryolab')} pays a share of the best prestige every day).`]],
  ['What to prioritize', [`Workers: ${L('policy:religion')} late in the run, offerings for caps, questline goals like ${L('relic:copier')}, ${L('relic:torch')} and ${L('relic:consolationPrize')}.`, `Guild: sell at the best price, open the ${L('cons:village_ingredientBox')} early in the run (ingredients vanish at prestige), never sell special crafts.`]],
  ['Prestige', [`${L('prestige:village.0')} and ${L('prestige:village.1')}.`]],
  ['Helper', [`Gooboo Assist – Village: pilot for workers (jobs, buildings, policies, sacrifices) and for the guild (recipes, prices, sales, purchases).`]],
]);

add('guide:horde', 'Guide · Horde', 'horde', [
  ['What it is', [`Combat. In the Equipment subfeature you push zones with items; in Classes you level a class through areas and bosses. Both share upgrades bought with prestige currencies.`]],
  ['The loop — Equipment', [`Kill enemies for bone and monster parts → upgrades and item levels → higher zones. From zone 21 ${L('concept:rareloot')} gives ${L('cur:horde_soulCorrupted')} (×1.1 per zone), which become ${L('cur:horde_soulEmpowered')} at prestige. Items gain ${L('concept:mastery')}; mastery 3 keeps item levels through prestige.`,
    `${L('cur:horde_corruptedFlesh')} (after ${L('upg:horde_purifier')}) buys ${L('upg:horde_cleansingRitual')} to keep corruption down.`]],
  ['The loop — Classes', [`Class level comes from time only. Clearing harder zones raises your best difficulty, and every rare loot adds difficulty × 0.001 × 1.1^difficulty to the courage score, which becomes ${L('cur:horde_courage')} at prestige. Quests of each class form the ${L('concept:battlepass')}.`]],
  ['What limits you', [`Equipment: the boss of each zone and, above ~250, corruption again. Classes: area bosses (the ${L('area:monkeyJungle')} boss gates ${L('area:loveIsland')}).`]],
  ['What to prioritize', [`Use separate builds by phase: an economy build to climb (bone/monster parts), a combo build when the boss is not unlocked, a boss build for the fight; go back to farm a lower zone when income stops. On the measured save this reached the record zone in ~5 h instead of ~47 h.`,
    `Buy ${L('upg:horde_monsterBag')} early; keep ${L('upg:horde_cleansingRitual')} on (except in a corruption challenge).`,
    `Classes: a short run before a long one paid more on the measured save (it buys ${L('upg:horde_determination')}, ${L('upg:horde_education')} and ${L('upg:horde_university')} first). Adventurer, Archer and Mage give about the same Courage per day; choose by quests and the difficulty they clear.`]],
  ['Prestige', [`${L('prestige:horde.0')} and ${L('prestige:horde.1')}.`]],
  ['Helper', [`Gooboo Assist – Horde: exact combat simulator, loadouts by goal, pilots for both subfeatures, Courage planner.`]],
]);

add('guide:farm', 'Guide · Farm', 'farm', [
  ['What it is', [`Plant crops on a field, harvest them for vegetables, berries, grain, flowers, gold and rare drops, and level each crop with exp. The Farm currencies never reset; each crop prestiges on its own.`]],
  ['The loop', [`Harvest → exp levels the crop (exp per level ×1.785) → genes at levels 1/5/10/20/25 → prestige the crop above its record → the Farm prestige level (sum of all records) gives ×1.04 crop gain to every crop per level. Crop levels also give Farm Global level (up to 25 per crop).`]],
  ['What limits you', [`${L('cur:farm_rainwater')} for care (10/h, more with ${L('upg:farm_gutter')}): with short crops the field never gets full care. Gold only comes with a ${L('fbuild:gardenGnome')} on the field.`]],
  ['What to prioritize', [`Short cycles on cheap crops raise records (and GL) fastest; mixed fields only pay in special cases. Giant crops only pay when you will be away long without harvesting.`,
    `Decorations: sprinkler = its row, lectern = its column, flag = the opposite quadrant by crop type, pinwheel = species diversity. Keep at least one gnome for gold.`,
    `Special crops (like ${L('crop:goldenRose')}) only give fixed exp: plant normal, harvest when ready.`,
    `${L('cur:farm_mysteryStone')} has no use in this version besides a questline.`]],
  ['Prestige', [`${L('prestige:farm')}.`]],
  ['Helper', [`Gooboo Assist – Farm: crop queue, field layout calculator, watering, harvest and replant, genes and prestige with switches.`]],
]);

add('guide:gallery', 'Guide · Gallery', 'gallery', [
  ['What it is', [`Produce ${L('cur:gallery_beauty')} and colors, convert colors into the next ones, buy ideas with ${L('cur:gallery_inspiration')}, and later play the shapes board.`]],
  ['The loop', [`Beauty → colors → conversions → new colors unlock new systems (canvas, drums, shapes…). At prestige, this run's beauty becomes ${L('cur:gallery_cash')} = 10^(log₈(beauty ÷ 1e11)^0.7) × Cash gain (needs 1e12 beauty).`]],
  ['What limits you', [`Cash grows very slowly with beauty (×8 beauty ≪ ×2 cash), so beauty alone runs out of steam.`]],
  ['What to prioritize', [`Cash gain multipliers over more beauty; short, frequent runs, except when one longer run reaches a new color or upgrade.`, `Shapes: collect 5+ connected pieces; a full Chest (10 different shapes around it) gives ${L('cur:gallery_mysteryShape')}.`]],
  ['Prestige', [`${L('prestige:gallery')}.`]],
  ['Helper', [`Gooboo Assist – Gallery: goal per run, cash per hour and best prestige time, idea ranking, shapes helper.`]],
]);

add('guide:school', 'Guide · School', 'school', [
  ['What it is', [`Mini-games (subjects). Studying earns ${L('cur:school_goldenDust')}, raises the subject's grade and moves you toward the next book; the ${L('concept:library')} turns books into permanent bonuses. ${L('cur:school_examPass')} come from Global level (one per 10 GL).`]],
  ['What limits you', [`A book can only be read when the Global level part of its feature reaches the book's minimum — not your total GL. Having books left does not mean one is readable.`]],
  ['What to prioritize', [`Study the subject with the shortest time to the next book; read books for the feature you are pushing.`]],
  ['Helper', [`Gooboo Assist – School: automatic Study, subject chooser by time to the next book, Library with read buttons.`]],
]);

add('guide:gems', 'Guide · Gems, treasure, cards and draws', 'gem', [
  ['What it is', [`Gems grow over time and buy card packs, treasures and boosts. Every random draw in these systems (treasure, card packs, casino, merchant) comes from a fixed seed plus a counter saved in your save.`]],
  ['What it means', [`Reloading never changes a draw; the only way past one is to pay for it. What changes a draw that is already fixed: your Global level (treasure tier), shiny chance (cards), bingo multipliers and new unlocks.`]],
  ['What to prioritize', [`${L('cur:gem_emerald')}: judge treasures by the channel they multiply (see ${L('guide:progress')}); on the measured save the first Dual treasure was the best use. Cards: the cheapest pack until the next new card, then shiny.`]],
  ['Helper', [`Gooboo Assist – Eventos e Sorteios: predicts the next draws, the cheapest path to each card, treasure plan by Global level, casino, merchant, bank and event planners.`]],
]);

// feature pages point to their guide
for (const f of ['mining', 'village', 'horde', 'farm', 'gallery', 'school']) { const e = BY['feat:' + f]; if (e && e.s) { e.s = e.s.filter(x => x.h !== 'Guide'); e.s.unshift({ h: 'Guide', b: [`Start with ${L('guide:' + f)}.`] }); } }

// ═══════════════ Cryo lab page ═══════════════
const cl = BY['concept:cryolab'];
cl.s = [
  { h: 'What it is', b: [`Freeze one feature (two with the relic ${L('relic:iridiscentFlower')}). A frozen feature stops completely — no income, growth, combat or run time — and instead earns a share of its best prestige every day plus Cryo lab exp. Unfreezing brings it back exactly where it stopped.`] },
  { h: 'How to get it', b: [`Unlocked at ${L('concept:gl')} 290 (${L('feat:cryolab')}).`] },
  { h: 'What it does', b: [
    `Frozen: prestige currency per day = best prestige of the open subfeature × (0.2 + 0.01 × level) (Village ×0.4).`,
    `Always, frozen or not: best prestige × 0.005 × level per day for every subfeature (Village ×0.4).`,
    `Farm: instead of a currency it pays crop exp (200 × best crop prestige × Farm experience × crop base exp), and only brings each crop back up to its record.`,
    `Each Cryo lab level is permanent: ×1.15 to that subfeature's prestige currency gain (Farm: ${L('mult:farmExperience')} ×1.15), plus the +1% / +0.5% above.`] },
  { h: "How it's calculated", b: [`Cryo lab exp per day (only while frozen, only the open subfeature) = round(1.015^g × g × 2), where g is that subfeature's part of your Global level. Exp for the next level = (L + 2)² × 2^L × 25.`] },
  { h: 'When to freeze', b: [
    `Freezing trades that feature's run (which pauses) for (a) a slice of your record per day and (b) exp toward a permanent level.`,
    `(a) pays when your current run earns less per day than (0.2 + 0.01 × level) × record — typical right after a prestige, or when a run is stuck at a wall.`,
    `(b) is what stays. Rank by Global level per day frozen (see ${L('guide:progress')}): on the measured saves the Farm level (Crop experience ×1.15 ≈ +4 GL long term in ~8–9 days) was by far the best, then Horde Classes (Courage ×1.15 in ~6 days, and ~22% of the record per day — more than a Classes run was making).`,
    `Freezing Mining also pauses the ${L('relic:stonepiercer')}; the helpers never freeze or unfreeze for you.`] },
];

fs.writeFileSync('glossary.json', JSON.stringify(GL));
console.log('featguides ok · entries', GL.length);
