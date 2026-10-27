// guides.js — runs after enrich.js. Newcomer guides (EN-first) for every event + the game tick.
// Official names come from the game (links {{id}} or lang/en.js via nm()); only connecting text is written here.
require('./bundle.js');
const fs = require('fs');
const en = globalThis.__en;
globalThis.__newGame(false);
const st = globalThis.__store.state;
const GL = JSON.parse(fs.readFileSync('glossary.json', 'utf8'));
const BY = Object.fromEntries(GL.map(e => [e.id, e]));
const L = id => `{{${id}}}`;
const C = k => L('cur:' + k);
const U = k => L('upg:event_' + k);
const R = k => L('relic:' + k);
const get = p => { let o = en; for (const k of p.split('.')) { if (o == null) return null; o = o[k]; } return o; };
const nm = (p, f) => { const v = get(p); return typeof v === 'string' ? v : (v && typeof v.name === 'string' ? v.name : f ?? p.split('.').pop()); };
const ev = e => nm(`event.${e}.name`, e);
const num = v => v >= 1e6 ? v.toExponential(1).replace('e+', 'e') : Math.round(v).toLocaleString('en-US');
const big = st.event.big;
const dates = e => { const b = big[e]; const md = s => { const [m, d] = s.split('-').map(Number); return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`; }; const days = Math.round((new Date(`2026-${b.end}`) - new Date(`2026-${b.start}`)) / 864e5) + 1; return `${md(b.start)} – ${md(b.end)} (${days} days)`; };
const prizeLabel = p => p.type === 'relic' ? R(p.item) : p.type === 'cardPack' ? L('pack:' + p.item) : p.type === 'theme' ? `the theme ${nm('theme.' + p.item, p.item)}` : p.type === 'consumable' ? (BY['cons:' + p.item] ? L('cons:' + p.item) : p.item) : p.type === 'currency' ? C(p.item) : p.item;
const shop = e => {
  const fixed = [], rnd = [];
  for (const p of Object.values(st.event.prize)) { const po = p.pool[e]; if (!po) continue; const b = { ...p, ...po }; const price = Object.entries(b.price || {}).map(([c, a]) => `${a}`).join('+'); const s = `${prizeLabel(b)}${b.amount > 1 ? ` ×${b.amount}` : ''} — ${price} token${price === '1' ? '' : 's'}${b.cap ? ` (up to ${b.cap})` : ''}`; (b.weight === null ? fixed : rnd).push(s); }
  return { fixed, rnd };
};
const add = (id, o) => { const e = BY[id] || { id, s: [], k: id.split(':')[1], f: 'event', d: null, col: null }; Object.assign(e, o); if (!BY[id]) { GL.push(e); BY[id] = e; } return e; };
const S = (h, ...b) => ({ h, b: b.flat().filter(Boolean) });

// ─────────────────────────── shared pieces ───────────────────────────
const tokenNote = e => `Tokens (${C('event_' + big[e].token)}) are what this event is really about: they buy the event shop. Unspent tokens stay after the event ends and are only cleared when the next big event starts — so you can finish shopping after the event, but not later than that.`;
const resetNote = e => `When the event ends, its currencies, its upgrades (including the ones bought with ${C('gem_topaz')}) and its stats reset. What you keep: tokens (until the next big event), and everything you bought in the shop (relics, cards, theme, items).`;
const shopSec = e => { const s = shop(e); return S('The shop (what tokens buy)',
  `Always offered: ${s.fixed.join('; ')}.`,
  `Plus 3 random offers rolled when the event starts, from: ${s.rnd.join('; ')}. Relics you already own are never offered.`,
  `Priority for a newcomer: the 2 event relics first (they are permanent and only sold here, once a year), then the theme if you care about cosmetics, then the card pack (30 tokens, 1 card each) until you have its cards, then ${L('cons:treasure_eventStar')} (adds event power to a treasure). ${C('farm_cactusSeed')} and ${C('farm_mixedSeeds')} are cheap fillers for the Farm.`); };
const currencyNote = e => `${C('event_' + big[e].currency)} is this event's "gem": during a big event the secondary gem progress that normally gives ${C('gem_topaz')} gives ${C('event_' + big[e].currency)} instead (about 1 per hour at base, faster with more achievement levels). So no topaz income while a big event runs.`;
const glNote = (mult, what) => `Global level helps: every ${L('concept:gl')} above 150 multiplies ${what} by ×${mult} (compounding).`;

// ─────────────────────────── TICK ───────────────────────────
add('concept:tick', { c: 'Conceito', n: 'Tick', k: 'tick', f: 'meta', s: [
  S('What it is', `The tick is the game's clock step. Every frame the game compares the current time (in whole seconds) with the time it last processed; if seconds passed, it runs each feature's tick for exactly that many seconds. Everything that "happens over time" — production, timers, combat, crops growing, event progress — happens inside a tick.`),
  S('How it operates',
    `Order of the tick: meta (Global level) → Mining → Village → Horde → Farm → Gallery → Gems → School → Event → Achievements → Relics → Generals → Treasure → Cryo lab. A feature only ticks once it is unlocked, and not while it is frozen in the ${L('concept:cryolab')} (some timers like Horde keys still run).`,
    `Ticks are whole seconds. If 1 hour passed (the tab was closed, the computer slept, or the browser paused the page), the next tick processes 3,600 seconds at once — that is offline progress. There is no offline cap: you get the full time.`,
    `Large ticks are split where precision matters: the Horde averages combat over simulated fights, Gallery splits colors into segments, the Weather chaos and other events step hour by hour, Bloom steps breeder by breeder.`,
    `Most production is linear in time, so a 10-hour tick equals 10 hours of play. Things that need a click (spending, buying, collecting summer festival drops, claiming night hunt ingredients, choosing a reward) do not happen during offline ticks — currencies with a capacity just stop or slow at the cap.`,
    `The pause setting stops ticks completely (time while paused is lost, not banked). Daily things (Horde raid keys, weekly tower keys, events changing) are computed from the real date inside the tick.`,
    `Browsers stop animation frames for minimized/background tabs, so the game catches up in one big tick when you come back; the result is the same as having it open, except anything that needed your click.`),
  S('Why it matters', `Caps are the main loss while away: check what hits its capacity before leaving. Spend-or-lose resources (event currencies, motivation, converters, keys) should be used before long absences.`),
] });

// ─────────────────────────── OVERVIEW ───────────────────────────
add('concept:events', { c: 'Conceito', n: nm('feature.event', 'Event'), k: 'events', f: 'event', s: [
  S('What it is', `Events are a calendar-based feature unlocked at ${L('concept:gl')} 150. The calendar uses your real date. There are two kinds:`,
    `Big events (once a year, 2–4 weeks): ${['cinders', 'bloom', 'weatherChaos', 'summerFestival', 'nightHunt', 'snowdown'].map(e => `${L('event:' + e)} ${dates(e)}`).join(' · ')}. Each one is its own minigame with its own currency, upgrades and token shop.`,
    `Small events (weekends without a big event, Saturday–Sunday): ${L('event:merchant')}, ${L('event:casino')} and ${L('event:bank')}, in rotation by week number. They all run on ${C('gem_topaz')}.`),
  S('The economy in one paragraph', `${C('gem_topaz')} is earned outside big events (secondary gem speed) and spent on weekends (Merchant, Casino, Bank) and on big-event upgrades. During a big event that same income becomes the event's currency instead. Every big event gives tokens for progress; tokens buy permanent rewards (two exclusive relics, a theme, an event card pack, event stars). You only get one chance per year at each event's exclusive relics.`),
  S('Newcomer rules of thumb',
    `Keep some ${C('gem_topaz')} saved before a big event: its topaz upgrades often double or triple the event's progress. But topaz upgrades reset when the event ends — buy them early in the event, never at the end.`,
    `Tokens are the score. Read each event's page: every event gives tokens differently (log of light, best flower tier, record fish size, quests, rituals, fight wins).`,
    `${L('concept:gl')} above 150 boosts every big event a little (Global event level).`,
    `Event currencies and upgrades reset at the end; tokens survive until the next big event starts; shop purchases are permanent.`),
] });

// ─────────────────────────── SMALL EVENTS ───────────────────────────
add('event:merchant', { c: 'Event', n: ev('merchant'), k: 'merchant', f: 'event', s: [
  S('What it is', `A weekend shop (small event) that sells items for ${C('gem_topaz')}. Its offers are rolled when the weekend starts and disappear when it ends.`),
  S('What you will see', `${st.mult.items.merchantOffers?.baseValue ?? 6} random offers (more with the Bank project Business marketing), plus two fixed ones: a card you do not own yet (1,000 ${C('gem_emerald')}, once) and a missing quest card (100 ${C('gem_topaz')}, up to 5).`,
    `Random offers can be relics (${R('hundredDollarBill')}, ${R('hotAirBalloon')}, ${R('tinfoilHat')}, ${R('cupOfWater')}, ${R('combatStrategy')}), the ${L('pack:goodDeal')} card pack, Farm seeds and fertilizers, ${C('school_examPass')}, ${C('horde_towerKey')}, a ${L('cons:mining_goldenHammer')} or a ${L('cons:gem_prestigeStone')}.`),
  S('Strategy', `Relics are the best buy: permanent and rare. Tower keys (450) and exam passes (90) are good if you use those features. Quest cards are needed for Generals questlines — buy them when a questline asks for one.`, `The rolls are seeded by a counter in your save (not by reloading), so reloading the page does not change the offers.`),
] });
add('event:casino', { c: 'Event', n: ev('casino'), k: 'casino', f: 'event', s: [
  S('What it is', `A weekend gambling event (small event) paid with ${C('gem_topaz')}. Each casino weekend is either Bingo or Wheel of fortune (decided when it starts).`),
  S('How Bingo works', `Buy a card (75 topaz). Numbers are drawn in 4 steps (12 → 17 → 22 → 25 numbers). After 12, 17 and 22 draws you place multipliers on numbers of your card: a number with a multiplier is 3–5× more likely to be drawn. Prize cells you mark win their prize; 1, 2 or 3 complete lines (bingos) win bigger prizes.`, `Strategy: put multipliers on numbers that complete lines through prize cells; a well-placed pair turns one bingo into two.`),
  S('How Wheel of fortune works', `Each spin costs 50 topaz; the segment under the pointer wins and is replaced by a new prize. Bigger segments are more likely. Spin while a prize you want is on the wheel; stop when only common prizes are left.`),
  S('What is worth it', `Rare prizes (relics, card packs, treasure items) are the reason to play. Commons are mostly small currency amounts. All draws are seeded by save counters — reloading does not reroll.`),
] });
const BP = Object.entries(st.event.bank_project).map(([k]) => nm('event.bank.project.' + k, k));
add('event:bank', { c: 'Event', n: ev('bank'), k: 'bank', f: 'event', s: [
  S('What it is', `A weekend event (small event) where you choose exactly one action for your ${C('gem_topaz')}. Using one option disables the others until the next bank weekend; repaying a loan is free and always allowed.`),
  S('The three options',
    `Project: fund the project offered this weekend (one of: ${BP.join(', ')}). Funding carries over between bank weekends until the level is paid (2,000 → 3,000 → 4,500 → 6,500… topaz). Expand vault +200 topaz capacity; Persuade investors +4,000 Golden dust capacity; Improve credit score +200 investment and loan size; Business marketing +1 Merchant offer; Sponsor card tournament raises the chance of a free card pack.`,
    `Invest: lock topaz until the next bank weekend; you get it back plus 5% interest up to your investment size (500 at base, +200 per Improve credit score level) and 1% on the rest.`,
    `Borrow: get topaz now (up to your loan size) and owe 20% more. Topaz you would gain above your topaz capacity pays the loan automatically; you can also repay any time.`),
  S('Strategy', `Projects are permanent and the best long-term use when you have spare topaz — Expand vault first if your topaz is often at its capacity. Invest when you have nothing to buy; borrow only right before a big event or a Merchant relic you really want. Every action also rolls a chance for a free ${L('pack:investorsDream')} card pack.`),
] });

// ─────────────────────────── CINDERS ───────────────────────────
const candles = Object.entries(st.cinders.candle).map(([k, c]) => `${nm('event.cinders.candle.' + k, k)}: ${c.cost} wax, ${c.duration >= 3600 ? c.duration / 3600 + ' h' : c.duration >= 60 ? c.duration / 60 + ' min' : c.duration + ' s'}, light ×${c.lightMult}, leaves ${c.soot} soot`);
add('event:cinders', { c: 'Event', n: ev('cinders'), k: 'cinders', f: 'event', s: [
  S('What it is', `A big event, ${dates('cinders')}: an idle "light" builder. You buy light producers with light, they make more light, and your total light this event decides your tokens.`),
  S('What you will see', `Ten producers in a chain — ${['firefly', 'glowshroom', 'glowfish', 'lantern', 'campfire', 'coral', 'jellyfish', 'nightbloom', 'neonlight', 'sun'].map(U).join(' → ')} — each unlocked by owning the previous one. Each producer gets pricier with every copy (×1.15 to ×1.5 per copy).`,
    `Light upgrades (one per producer, first at 25 copies, then every 50 copies) add base production and, from the 3rd level, ×5 per level to that producer; ${U('moonglow')} triples all light. Soot upgrades (bought with ${C('event_soot')}) add flat production per producer, 6 levels each.`,
    `Candles, bought with ${C('event_wax')}: only one burns at a time and multiplies all light while it burns. ${candles.join(' · ')}.`),
  S('Goal: tokens', `Tokens = ⌊log base 1.2 of (light earned this event ÷ 10,000)⌋ × token multiplier, paid as you go. Every ×1.2 more light is +1 token — so light grows exponentially but tokens grow steadily. Roughly: 1e9 light ≈ 63 tokens, 1e21 ≈ 215, 1e45 ≈ 518, 1e60 ≈ 708.`, tokenNote('cinders')),
  S('Strategy',
    `Light is pure compound growth: buy the cheapest producer that most increases light per second, and always buy the next producer in the chain as soon as you can — every new tier is a big jump.`,
    `Candles: the Scented candle gives the most light per wax (×1.5 for 4 h), the Chandelier is the strongest burst (×7 for 15 min), the Tealight is ×25 for 30 s. Because the bonus multiplies your current production, candles are worth more later in the event; burn the strongest ones when production is highest and when you can come back to buy producers right after.`,
    `Soot only comes from finished candles — candles are your soot income. Spend it on the soot upgrades of your highest producers.`,
    `Topaz "Enlightened" upgrades (400 → 1,300 topaz, one per producer): most of them also give ×1.5 light. The firefly one (×10 fireflies) is the cheapest early boost; the jellyfish one doubles candle power; neonlight halves upgrade costs. Buy them early in the event so they work for the whole event.`,
    glNote(1.015, 'light')),
  S('Bottlenecks', `Early: light for the next producer tier. Mid/late: the 25/50-copy light upgrades (they need copies AND light). Wax is limited (event currency income only), so candles are the only thing you cannot scale.`),
  shopSec('cinders'),
  S('Reset', resetNote('cinders'), currencyNote('cinders')),
] });

// ─────────────────────────── BLOOM ───────────────────────────
const FL = Object.entries(st.bloom.flower).map(([k, f]) => ({ k, n: nm('event.bloom.flower.' + k, k), ...f, t: st.mult.items[`bloom${k[0].toUpperCase() + k.slice(1)}BreedTime`]?.baseValue }));
const fmtT = s => s >= 3600 ? `${+(s / 3600).toFixed(1)} h` : `${s / 60} min`;
add('event:bloom', { c: 'Event', n: ev('bloom'), k: 'bloom', f: 'event', s: [
  S('What it is', `A big event, ${dates('bloom')}: a flower breeding and merging game. Flowers in a breeder make new flowers; two flowers of the same type and tier merge into one of the next tier.`),
  S('What you will see', `An inventory (5 slots at base) and a breeder (1 slot at base, up to 4 with the topaz upgrade ${U('greenhouse')}). You start with one ${FL[0].n}. Flower types: ${FL.map(f => `${f.n} (buy for ${f.humusPrice} humus, breeds every ${fmtT(f.t)}, ${f.tokens} tokens per new tier)`).join(' · ')}. New types are unlocked with ${U('colorfulSeedBag')} (paid in ${C('event_blossom')}).`,
    `Genes (max 3 per flower): ${Object.keys(st.bloom.gene).map(g => `${nm(`event.bloom.gene.${g}.name`, g)} — ${get(`event.bloom.gene.${g}.description`) || ''}`).join(' · ')}.`),
  S('How breeding works', `A flower in the breeder produces a new flower of its type every breed time. The new flower's tier is rolled: each extra tier has a chance of (type chance + 5% per tier of the breeder flower − 20% per tier already reached), so a higher-tier breeder makes higher-tier children. With a full inventory, a child replaces a worse flower of the same type (the worse one is sold), otherwise it is sold.`,
    `Merging: drag a flower onto another of the same type and tier → tier +1 (a Huge flower gives +2). Selling a flower gives ${C('event_blossom')} = base value × 1.75^tier (×3 if Valuable).`),
  S('Goal: tokens', `Tokens come only from reaching a new best tier per flower type: each tier above your record pays that type's tokens per tier (Daisy 2 … Cornflower 27). So higher types are worth far more per tier.`, tokenNote('bloom')),
  S('Strategy',
    `Breed with your highest-tier flower of a type — its children roll higher tiers. Keep merging pairs to climb; sell leftovers for blossom.`,
    `Blossom buys the core upgrades: ${U('flowerPot')} (+1 inventory slot, cheap early), the "Protection" upgrades (+5% tier chance per level) and "Fertilizer" upgrades (faster breeding), and ${U('colorfulSeedBag')} for new flower types — each new type is a new token track.`,
    `Topaz: ${U('greenhouse')} (500/1,000/1,500 for more breeders) multiplies everything; ${U('hugeVase')} doubles inventory; the framed flowers add tier chance (and blossom ×3 for the Iris one). Buy early.`,
    `${C('event_humus')} buys flowers, Wild growth (90 humus: adds a random gene to every flower in the inventory) and Boost (140 humus: 1 day of breeding instantly — only this event's breeders, not the rest of the game). Wild growth on a full inventory of good flowers is the best humus use; Boost is good late, when breeders are fast.`,
    glNote(1.01, 'flower value')),
  S('Bottlenecks', `Inventory space (merging needs room), breeder slots, and breed time of high types (Orchid 4 h, Cornflower 8 h at base). Tier chance drops 20% per tier, so very high tiers come from merging, not luck.`),
  shopSec('bloom'),
  S('Reset', resetNote('bloom'), `Your flowers, inventory and breeders are cleared at the end.`, currencyNote('bloom')),
] });

// ─────────────────────────── WEATHER CHAOS ───────────────────────────
const LOC = Object.entries(st.weatherChaos.location).map(([k, l]) => `${nm('event.weatherChaos.location.' + k, k)}${l.next ? ` (next needs ${l.next.minPower} fishing power)` : ''}`);
const RODS = Object.keys(st.weatherChaos.fishingRod).map(k => nm('event.weatherChaos.fishingRod.' + k, k));
const BAIT = Object.keys(st.weatherChaos.bait).map(k => nm('event.weatherChaos.bait.' + k, k));
add('event:weatherChaos', { c: 'Event', n: ev('weatherChaos'), k: 'weatherChaos', f: 'event', s: [
  S('What it is', `A big event, ${dates('weatherChaos')}: idle fishing under changing weather. You catch something every few minutes; fish sizes give tokens.`),
  S('What you will see', `A location (${LOC.join(' → ')}), a fishing rod, optional bait, and a 24-hour weather forecast that changes every hour. Each fish species (${Object.keys(st.weatherChaos.fish).length} in total, 9 in the first pond) lives in one location, needs a minimum fishing power and often a weather condition (sun, rain, snow, thunder, wind).`),
  S('How fishing works', `One catch every 5 minutes at base (${U('goldenHook')} makes it faster). Each catch: 5% treasure, else 25% fish, else trash (${C('event_algae')}, ${C('event_driftwood')} or ${C('event_plastic')}, 100 each). Treasure is bait, a new fishing rod, or the next location (only when your fishing power is high enough).`,
    `Fish have a random size up to the species' maximum; every catch also gives ${C('event_slime')} equal to its size.`),
  S('Goal: tokens', `Tokens = new size records: the first time you catch a species you get its size in tokens, and every bigger catch later pays the difference. So tokens = the sum of your best size of every species. More species (new locations, the right weather) and bigger sizes (max size and average size) both pay.`, tokenNote('weatherChaos')),
  S('Strategy',
    `Fishing power is the key stat (${U('fishWhistle')}, paid in plastic): it opens rarer fish and lets treasure unlock the next location. Push it to each location's threshold (40, 100, 250, 500, 1,000).`,
    `${U('juicyBait')} (algae) raises maximum fish size; ${U('incubator')} (driftwood) raises average size; ${U('pollution')} (slime) increases trash.`,
    `Rods (${RODS.join(', ')}) each trade something; you find them as treasure or buy them for topaz (400, then +150 each). Twins gives a 20% chance of 2 fish per fish catch, Golden more fish and treasure, Mystical lets you (sometimes) catch fish whose weather is not active.`,
    `Bait (${BAIT.join(', ')}) costs 90 ${C('event_cloud')} for 10 uses (×stack size): Juicy bait guarantees fish and is 10× faster; Rainbow bait ignores weather. Use bait when the forecast shows the weather a rare fish needs.`,
    `Reset the forecast (150 cloud) when the next hours have no useful weather. Check which species you have not caught yet and the weather they need.`,
    glNote(1.0075, 'trash')),
  S('Bottlenecks', `Fishing power (it gates species and locations) and time: one catch per 5 min means ~5,000 catches over the event at base, most of them trash.`),
  shopSec('weatherChaos'),
  S('Reset', resetNote('weatherChaos'), `Rods, locations, bait, records and the forecast reset at the end.`, currencyNote('weatherChaos')),
] });

// ─────────────────────────── SUMMER FESTIVAL ───────────────────────────
const BLD = Object.keys(st.summerFestival.building).map(k => nm(`event.summerFestival.building.${k}`, k));
let sfTok = 0; for (let q = 0; q < st.summerFestival.quest.length; q++) sfTok += Math.floor(Math.pow(q * 0.35, 1.12) + 4);
add('event:summerFestival', { c: 'Event', n: ev('summerFestival'), k: 'summerFestival', f: 'event', s: [
  S('What it is', `A big event, ${dates('summerFestival')}: an island builder with a chain of quests. You collect materials from tiles, construct buildings that produce and process materials, and deliver what quests ask for.`),
  S('What you will see', `A small island of 37 tiles; only the center is unlocked. Tiles: forest (${C('event_log')}), palm (${C('event_coconut')}), beach (${C('event_shell')}), mountain (${C('event_stoneBlock')}), water and plain. Every 10 seconds a random tile gets a drop (up to 10 stacked); you click a tile to collect it (100 material per drop). Drops only land on unlocked tiles without buildings.`,
    `Buildings (${BLD.join(', ')}) have shapes and tile requirements, go through a build queue (3 at a time) and can be upgraded. The ${nm('event.summerFestival.building.collector')} collects nearby tiles automatically.`,
    `Quests: ${st.summerFestival.quest.length} in a fixed order, each asking for materials (they are consumed) or buildings.`),
  S('Goal: tokens', `Each completed quest pays ⌊(quests done × 0.35)^1.12 + 4⌋ tokens, growing from 4 to over 20; all ${st.summerFestival.quest.length} quests pay ${sfTok} tokens in total. Every 5th quest also gives a free tile expansion.`, tokenNote('summerFestival')),
  S('Strategy',
    `Collect drops often early — before a Collector, uncollected tiles stop at 10 drops and waste the rest. Building a Collector early is the biggest quality-of-life step.`,
    `Unlock tiles that produce what the next quests need. Free expansions come from quests; topaz expansions cost 100 +10 each (up to 20). More producing tiles = more drops.`,
    `Follow the quest chain: it introduces the buildings in a sensible order (Main stage → music, Sawmill → plates, Kitchen → food, Mine → salt and coal, Grill, Shell opener → metal parts and pearls…). The ${nm('event.summerFestival.building.lighthouse')} (1 ${C('event_pearl')}) boosts build speed and material gain.`,
    `${C('event_cocktail')} skips build time (cost = √(seconds ÷ 10)) and terraforms plain tiles into forest/palm. Spend it on long builds that block the next quest.`,
    `Topaz upgrades: ${U('extraBuildingSlot')}, ${U('doubleTime')}, ${U('tropicalBlessing')} — bought early they compound over 4 weeks.`,
    glNote(1.005, 'materials')),
  S('Bottlenecks', `Clicking to collect (until Collectors), tile space for buildings, the build queue, and late quests that need processed goods (steel, composite plates, food) whose input chains are slow.`),
  shopSec('summerFestival'),
  S('Reset', resetNote('summerFestival'), `The island, buildings and quests reset; next year's island is generated again.`, currencyNote('summerFestival')),
] });

// ─────────────────────────── NIGHT HUNT ───────────────────────────
const POT = Object.entries(st.nightHunt.potion).map(([k, p]) => ({ n: nm('event.nightHunt.potion.' + k, k), t: (p.recipeSeed || []).length }));
const ING = Object.keys(st.nightHunt.ingredientStat).map(k => C(k.startsWith('event_') ? k : 'event_' + k));
add('event:nightHunt', { c: 'Event', n: ev('nightHunt'), k: 'nightHunt', f: 'event', s: [
  S('What it is', `A big event, ${dates('nightHunt')}: a scavenger hunt across the whole game plus an alchemy puzzle. Magic marks random currencies in your other features; clicking them gives ingredients; you combine ingredients in rituals to discover potion recipes.`),
  S('What you will see', `Over time, ${C('event_magic')} "changes" currencies you own anywhere in the game (Mining, Village, Horde…): they look different in their feature's screen. Clicking a changed currency claims ingredients (8 at base). Up to √(magic ÷ 10) changes exist at once (max 20); with more than 1,000 magic some become sacks that give a bit of every ingredient.`,
    `Ingredients: ${ING.join(', ')}. At the start you can find ${st.mult.items.nightHuntFindableIngredients?.baseValue ?? 4}; ${U('potionShelf')} adds more.`,
    `Potions (${POT.map(p => `${p.n} (${p.t} ingredient${p.t > 1 ? 's' : ''})`).join(', ')}) each have a secret recipe, rolled when the event starts.`),
  S('How rituals work', `Put 1 ingredient (more with ${U('biggerCauldron')}) into the ritual and perform it. Each ritual has a stability (chance to keep ingredients or fail) and a success chance; more ingredients = lower chances. A success with a new combination is recorded; if the combination is a potion recipe, that potion levels up and boosts ${C('event_essence')} production. Failed rituals build familiarity with that combination (easier next time), and successes can give hints toward an undiscovered recipe.`),
  S('Goal: tokens', `Tokens: +1 for each new combination of 1–2 ingredients that succeeds, and +2 × (number of ingredients) every time a potion levels up. Discovering recipes and then repeating them (the cost grows by 1 of each ingredient per potion level) is the token engine.`, tokenNote('nightHunt')),
  S('Strategy',
    `Visit your features regularly and claim changed currencies — this is the only ingredient income, and marks do not claim themselves while you are away. Letting magic build up raises how many marks can exist and unlocks sacks.`,
    `Try every single ingredient first (cheap, +1 token each), then every pair. Use hints and the potion list to narrow down recipes.`,
    `Essence buys the core upgrades: ${U('essenceCondenser')} (×1.25 essence per level), ${U('luckyCharm')} (+3% success), ${U('biggerCauldron')} (more ingredients per ritual), ${U('potionShelf')} (more findable ingredients), ${U('stabilizer')}, ${U('ritualChalk')} and ${U('pedestals')} (bonus ingredients).`,
    `Topaz: ${U('mystifier')} (×3 essence per level), ${U('bundle')} (bigger claims), ${U('bagOfCandy')}.`,
    glNote(1.01, 'essence')),
  S('Bottlenecks', `Ingredients (they only come from clicking marks), the success/stability chances of 3+ ingredient rituals, and the length of the event (16 days, the shortest).`),
  shopSec('nightHunt'),
  S('Reset', resetNote('nightHunt'), `Recipes are new every year; potions, marks and hints reset at the end.`, currencyNote('nightHunt')),
] });

// ─────────────────────────── SNOWDOWN ───────────────────────────
const SDI = t => Object.entries(st.snowdown.item).filter(([, i]) => i.type === t).map(([k]) => nm(`event.snowdown.item.${k}`, k));
add('event:snowdown', { c: 'Event', n: ev('snowdown'), k: 'snowdown', f: 'event', s: [
  S('What it is', `A big event, ${dates('snowdown')}: a snowball-fight auto-battler. You fight a fixed ladder of enemy teams; wins give tokens, producers and items that make you stronger.`),
  S('What you will see', `A fight button (8 ${C('event_snowball')} per fight), your fighter's stats (attack, health, defense, crit and block rating), the next enemy team, and an item inventory.`,
    `After each win you pick +1 level of one producer (${SDI('producer').join(', ')}): they produce ${C('event_sapling')}, ${C('event_yarn')}, ${C('event_dough')} and ${C('event_snow')} over time. In the first 5 fights and every 5th fight after that (until fight 50) you also pick 1 of 3 items: pets (${SDI('pet').join(', ')}; up to 3), pet boosts, tank items and crit items.`),
  S('Goal: tokens', `Each win pays ⌊(fight × 0.15 + 1)^0.6 + 3⌋ tokens: 3–4 early, about 6 by fight 50. Roughly 44 tokens after 11 wins, 90 after 21, 196 after 41, 310 after 60.`, tokenNote('snowdown')),
  S('Strategy',
    `Win as many fights as possible — the ladder is fixed and gets ×1.1 stronger per fight. Losing is not wasted: each loss in a row adds "revenge" (more attack, health, crit and block) until you win.`,
    `Producers: spread levels — sapling buys ${U('pineTrees')} (attack), yarn buys ${U('woolHat')} (health), dough buys ${U('cookies')} (stronger revenge). Snow buys extra items (cost grows fast).`,
    `Pets fight beside you; 3 pets plus pet boosts is the strongest setup for most players. Reroll an item (30 snowballs) to swap a weak one.`,
    `Topaz: ${U('attackBoost')} and ${U('healthBoost')} (+50% each per level) — the biggest topaz value of the event, buy early.`,
    `Boost (55 snowballs) = 1 day of producer income instantly (only this event).`,
    glNote(1.01, 'snowdown resources')),
  S('Bottlenecks', `Snowballs (8 per fight, from the event currency income only) and the ladder's ×1.1 growth per fight.`),
  shopSec('snowdown'),
  S('Reset', resetNote('snowdown'), `Fights, items, pets and producers reset at the end.`, currencyNote('snowdown')),
] });

// link from feature page and unlock entries
const fe = BY['feat:event']; if (fe) { fe.s = fe.s.filter(x => x.h !== 'Guides'); fe.s.unshift(S('Guides', `Start with ${L('concept:events')}, then each event: ${['cinders', 'bloom', 'weatherChaos', 'summerFestival', 'nightHunt', 'snowdown', 'merchant', 'casino', 'bank'].map(e => L('event:' + e)).join(', ')}. How time passes in the game: ${L('concept:tick')}.`)); }
for (const e of ['cinders', 'bloom', 'weatherChaos', 'summerFestival', 'nightHunt', 'snowdown']) { const u = BY[`unl:${e}Event`]; if (u) { u.s = u.s.filter(x => x.h !== 'Guide'); u.s.unshift(S('Guide', `Full newcomer guide: ${L('event:' + e)}.`)); } }

const missing = new Set();
for (const e of GL) e.s = e.s.map(x => ({ h: x.h, b: x.b.map(t => t.replace(/\{\{([^}]+)\}\}/g, (m, id) => { if (BY[id]) return m; missing.add(id); return `«${id.split(':').slice(1).join(':')}»`; })) }));
fs.writeFileSync('glossary.json', JSON.stringify(GL));
console.log('guides ok · entries', GL.length, '· missing links', missing.size, [...missing].join(', '));
