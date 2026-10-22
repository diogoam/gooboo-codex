// Generates markdown reference tables from data/gooboo-data.json
const fs = require('fs');
const d = require('./data/gooboo-data.json');
fs.mkdirSync('wiki', { recursive: true });

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const price = p => (p && typeof p === 'object') ? Object.entries(p).map(([k, v]) => `${k.split('_').slice(1).join('_')} ${typeof v === 'number' ? (v >= 1e4 ? v.toExponential(1) : +v.toFixed(2)) : v}`).join(', ') : esc(p);
const req = u => {
  if (u.reqStat) return `${u.reqStat} ≥ ${u.reqValue}`;
  if (!u.reqCustom) return '—';
  const src = u.reqCustom;
  let m;
  if ((m = src.match(/unlock\.(\w+)\.(see|use)/))) return `unlock ${m[1]}`;
  if ((m = src.match(/stat\.(\w+)\.total\s*(>=|>)\s*(\d+)/))) return `${m[1]} ${m[2]} ${m[3]}`;
  if ((m = src.match(/upgrade\.item\.(\w+)\.(\w+)\s*(>=|>)\s*(\d+)/))) return `${m[1]}.${m[2]} ${m[3]} ${m[4]}`;
  return '`' + esc(src.replace(/^requirement\(\)\s*\{\s*return\s*/, '').replace(/;\s*\}$/, '').slice(0, 90)) + '`';
};
const effStr = e => {
  if (e.atLevel !== undefined) return `**${e.type}** ${e.name}${e.atLevel !== null ? ' @nv' + e.atLevel : ''}`;
  const v = e.lv1 !== undefined ? `${e.lv1}${e.lvMax !== undefined ? '→' + e.lvMax : ''}` : e.value;
  return `${e.type} ${e.name} (${v})`;
};

// ---- Upgrade tables per feature ----
const features = ['mining', 'village', 'horde', 'farm', 'gallery', 'event', 'gem', 'treasure', 'school'];
for (const f of features) {
  const list = Object.entries(d.upgrades).filter(([, u]) => u.feature === f);
  const groups = {};
  list.forEach(([k, u]) => { const g = `${u.type} · subfeature ${u.subfeature}`; (groups[g] = groups[g] || []).push([k, u]); });
  let md = `# Upgrades — ${f} (tabela gerada do código v1.6.3)\n\n`;
  md += `Legenda: **Req** = condição para o upgrade aparecer (stats usam o valor *total/all-time*, então recordes desbloqueiam permanentemente). Efeitos mostram valor no nível 1 → no cap (ou nv 60 se sem cap). \`unlock X @nvN\` = o upgrade desbloqueia X ao atingir nível N. "persist" = não reseta no prestige.\n\n`;
  for (const [g, items] of Object.entries(groups)) {
    items.sort((a, b) => (a[1].reqValue ?? -1) - (b[1].reqValue ?? -1));
    md += `## ${g} (${items.length})\n\n| Key | Nome | Cap | Req | Preço nv1 | Efeitos |\n|---|---|---|---|---|---|\n`;
    for (const [k, u] of items) md += `| \`${k}\` | ${esc(u.name)}${u.persistent ? ' *(persist)*' : ''} | ${u.cap ?? '∞'} | ${esc(req(u))} | ${esc(price(u.price1))} | ${esc(u.effects.map(effStr).join('; '))} |\n`;
    md += '\n';
  }
  fs.writeFileSync(`wiki/91-upgrades-${f}.md`, md);
}

// ---- Unlock registry ----
let md = `# Registro de Unlocks (gerado do código v1.6.3)\n\nCada unlock do jogo (\`store.state.unlock[key]\` com \`see\`/\`use\`) e o que o dispara. \`see\` = já foi visto alguma vez (persiste); \`use\` = ativo agora (unlocks vindos de upgrades resetáveis voltam a \`use=false\` no prestige e são re-disparados ao recomprar).\n\nTipos de gatilho: **globalLevel** (GL total), **upgrade** (comprar nível N de um upgrade/building), **relic**, **hordeBattlePass** (nível somado das quests de classe), **hordeTower** (andar de torre), **hordeBoss** (derrotar boss de área), **hardcoded** (condição fixa no código).\n\n| Unlock | Nome (en) | Gatilho(s) | Packs de cartas que exigem este unlock |\n|---|---|---|---|\n`;
const names = Object.fromEntries(d.unlockKeys.map(u => [u.key, u.name]));
const packsBy = {};
for (const [k, t] of Object.entries(d.unlockTriggers)) for (const x of t) if (x.source === 'cardPack(usa)') (packsBy[k] = packsBy[k] || []).push(x.detail);
for (const { key } of d.unlockKeys) {
  const t = (d.unlockTriggers[key] || []).filter(x => x.source !== 'cardPack(usa)');
  md += `| \`${key}\` | ${esc(names[key] || '')} | ${t.length ? esc(t.map(x => `${x.source}: ${x.detail}`).join('<br>')) : '*(sem gatilho no código — conteúdo futuro/debug)*'} | ${esc((packsBy[key] || []).join(', '))} |\n`;
}
md += `\n## Questlines de General que exigem um unlock\n\n`;
for (const [k, t] of Object.entries(d.unlockTriggers)) if (k.startsWith('(questline)')) md += `- ${k.replace('(questline) ', '')} → exige \`${t[0].detail}\`\n`;
fs.writeFileSync('wiki/90-registro-unlocks.md', md);

// ---- Relics ----
md = `# Relics (gerado do código v1.6.3)\n\nRelics são bônus permanentes. Fonte = como obter.\n\n| Key | Nome | Features | Fonte | Efeitos |\n|---|---|---|---|---|\n`;
for (const [k, r] of Object.entries(d.relics)) md += `| \`${k}\` | ${esc(r.name)} | ${r.feature.join(', ')} | ${esc(r.source)} | ${esc(Array.isArray(r.effect) ? r.effect.map(e => `${e.type} ${e.name} ${e.value}`).join('; ') : r.effect)}${r.active ? ' · *tem efeito ativo*' : ''} |\n`;
fs.writeFileSync('wiki/92-relics.md', md);

// ---- Achievements ----
md = `# Achievements (gerado do código v1.6.3)\n\nCada nível de achievement soma em \`achievement/totalLevel\`, que acelera a geração de gems (+1%/nível ruby&emerald, +0.5%/nível secundárias) e libera relics via \`meta_totalLevel\`.\n\n| Key | Cap | Primeiros milestones | Relic por nível |\n|---|---|---|---|\n`;
for (const [k, a] of Object.entries(d.achievements)) md += `| \`${k}\`${a.secret ? ' *(secreto)*' : ''} | ${a.cap ?? '∞'} | ${a.milestones.slice(0, 6).join(', ')} | ${esc(Object.entries(a.relic || {}).map(([l, r]) => `nv${+l + 1}: ${r}`).join(', '))} |\n`;
fs.writeFileSync('wiki/93-achievements.md', md);

// ---- Books ----
md = `# Livros da School Library (gerado do código v1.6.3)\n\n**Importante:** \`minGL\` aqui é o GL **da parte da feature** (ex.: \`mining_0\` = maxDepth−1), não o GL total. Livros com *scales* ganham +1 nível por ponto de GL-parte acima do minGL (até maxGL). Só ficam ativos quando a feature está no subfeature do livro (ou se \`alwaysActive\`).\n\n| Livro | GL-parte | minGL | maxGL | Escala | Efeitos |\n|---|---|---|---|---|---|\n`;
const books = Object.entries(d.books).sort((a, b) => (a[1].feature + a[1].subfeature).localeCompare(b[1].feature + b[1].subfeature) || a[1].minGL - b[1].minGL);
for (const [k, b] of books) md += `| \`${k}\` | ${b.feature}_${b.subfeature} | ${b.minGL} | ${b.maxGL ?? '—'} | ${b.scalesWithGL ? 'sim' : 'não'} | ${esc(b.effect.join('; '))} |\n`;
fs.writeFileSync('wiki/94-livros-school.md', md);

// ---- Generals ----
md = `# Generals — Questlines (gerado do código v1.6.3)\n\nQuestlines dão uma **relic** ao final e notes (diálogos) por estágio. Estágios marcados ⚔ são *challenges* (condições numa run específica — normalmente exigem prestigiar e jogar restrito). Questlines com "exige" só aparecem após aquele unlock.\n\n`;
for (const [g, gen] of Object.entries(d.generals)) {
  md += `## ${g}${gen.unlock ? ` (exige \`${gen.unlock}\`)` : ''}\n\n`;
  if (!Object.keys(gen.quests).length) md += '*Sem questlines implementadas nesta versão.*\n\n';
  for (const [q, quest] of Object.entries(gen.quests)) {
    md += `### ${q} → relic \`${quest.reward}\`${quest.unlock ? ` · exige \`${quest.unlock}\`` : ''}\n\n`;
    quest.stages.forEach((sg, i) => { md += `${i + 1}. ${sg.isChallenge ? '⚔ ' : ''}${sg.tasks.map(t => '`' + t.replace(/\s+/g, ' ').trim() + '`').join(' + ')}\n`; });
    md += '\n';
  }
}
fs.writeFileSync('wiki/95-generals-questlines.md', md);

// ---- Horde extras ----
md = `# Horde — Battle Pass, Torres, Classes e Áreas (gerado do código v1.6.3)\n\n## Battle Pass (subfeature Classes)\nNível = soma das quests de classe completadas (boss conta 2x). Também é a GL-parte \`horde_1\`.\n\n| Nível | Recompensa |\n|---|---|\n`;
for (const [l, r] of Object.entries(d.hordeBattlePass)) md += `| ${l} | ${esc(r.join('; '))} |\n`;
md += `\n## Torres\n\n| Torre | Unlock | Coroas | Recompensas por andar |\n|---|---|---|---|\n`;
for (const [t, tw] of Object.entries(d.hordeTowers)) md += `| ${t} | \`${tw.unlock}\` | ${tw.crowns} | ${esc(Object.entries(tw.reward).map(([f, r]) => `${f}: ${r}`).join('<br>'))} |\n`;
md += `\n## Classes\n\n| Classe | Unlock | Stats base | Quests (stat/zone/level/boss) |\n|---|---|---|---|\n`;
for (const [c, fc] of Object.entries(d.hordeClasses)) md += `| ${c} | ${fc.unlock ? '`' + fc.unlock + '`' : 'inicial'} | ${esc(JSON.stringify(fc.baseStats))} | ${fc.quests ? Object.values(fc.quests).join(' / ') : ''} |\n`;
md += `\n## Áreas (Classes)\n\n`;
for (const [a, area] of Object.entries(d.hordeAreas)) {
  md += `### ${a}\n\n| Zona | Dificuldade | Liberada por | Boss / recompensa |\n|---|---|---|---|\n`;
  for (const [z, zd] of Object.entries(area.zones)) md += `| ${z} | ${zd.difficulty ?? ''} | ${esc((zd.unlockedBy || []).join(' ou ') || 'início')} | ${esc(zd.boss ? zd.boss.join(' → ') + (zd.reward ? ' ⇒ `' + zd.reward + '`' : '') : '')} |\n`;
  md += '\n';
}
fs.writeFileSync('wiki/96-horde-extras.md', md);
console.log(fs.readdirSync('wiki'));
