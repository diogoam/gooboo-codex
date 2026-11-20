// inline.js — runs after english.js. Pages that only said "Needs {{unl:X}}." made you click through to learn the
// condition, and for the 7 card packs whose unlock has the same name as the pack the link pointed back to itself.
// Here the condition is written inline. When the condition is "Gain {{cur:Y}} for the first time", the ways to get Y
// are added too (skipping sources that need something from this same page, like a card from this pack).
const fs = require('fs');
const GL = JSON.parse(fs.readFileSync('glossary.json', 'utf8'));
const BY = Object.fromEntries(GL.map(e => [e.id, e]));
const sec = (e, h) => e && e.s.find(s => s.h === h);
const cond = id => { const b = sec(BY[id], 'How it unlocks')?.b || []; const i = b.findIndex(x => /^How to get /.test(x)); return (i < 0 ? b : b.slice(0, i)).filter(x => !/^Needs \{\{unl:/.test(x)); };
const strip = t => t.replace(/\.$/, '');
// ways to get a currency, minus lines that mention anything listed on `self` (cards in the pack, the pack itself)
function howToGet(curId, self) {
  const refs = x => (JSON.stringify(x.s).match(/\{\{[^}]+\}\}/g) || []).map(r => r.replace(/[{}]/g, ''));
  const own = new Set([self.id, ...refs(self)]);
  for (const id of (sec(self, 'What it unlocks')?.b || []).join(' ').match(/\{\{[^}]+\}\}/g) || []) { const t = BY[id.replace(/[{}]/g, '')]; if (t) refs(t).forEach(r => own.add(r)); }
  return (sec(BY[curId], 'How to get it')?.b || []).filter(x => !(x.match(/\{\{([^}]+)\}\}/g) || []).some(m => own.has(m.replace(/[{}]/g, '')) && m !== `{{${curId}}}`));
}
// the unlock pages of "first time you gain X" also get the ways to get X
for (const e of GL) {
  if (e.c !== 'Unlock') continue;
  const s = sec(e, 'How it unlocks'); if (!s) continue;
  const g = s.b.join(' ').match(/^Gain \{\{(cur:[^}]+)\}\} for the first time/);
  if (!g || s.b.some(x => x.startsWith('How to get'))) continue;
  const how = howToGet(g[1], e);
  if (how.length) s.b.push(`How to get {{${g[1]}}}:`, ...how);
}
let n = 0, packs = 0;
for (const e of GL) {
  for (const s of e.s) {
    s.b = s.b.flatMap(line => {
      const m = line.match(/^Needs \{\{(unl:[^}]+)\}\}\.?$/);
      if (!m || !BY[m[1]]) return [line];
      const c = cond(m[1]);
      if (!c.length) return [line];
      n++;
      const same = BY[m[1]].n === e.n;
      const out = same ? c.map(x => `Unlock condition: ${strip(x)}.`) : [`Needs {{${m[1]}}}. Unlock condition: ${strip(c[0])}.`, ...c.slice(1)];
      if (e.c === 'Card pack') packs++;
      const g = c.join(' ').match(/^Gain \{\{(cur:[^}]+)\}\} for the first time/);
      if (g) { const how = howToGet(g[1], e); if (how.length) out.push(`How to get {{${g[1]}}}:`, ...how); }
      return out;
    });
  }
}
fs.writeFileSync('glossary.json', JSON.stringify(GL));
console.log('inline ok', n, 'lines,', packs, 'card packs');
