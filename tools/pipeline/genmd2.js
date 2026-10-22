// Generates 07-notes, 97-cards, 95-generals (v2) and 98-generals-por-feature + per-feature general blocks
const fs = require('fs');
const d = require('./data/gooboo-data.json');
const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
fs.mkdirSync('wiki', { recursive: true });

// ---------- 07 NOTES ----------
const featOrder = ['meta', 'mining', 'village', 'horde', 'farm', 'gallery', 'gem', 'achievement', 'school', 'relic', 'card', 'general', 'event', 'treasure', 'cryolab'];
let md = `# Notes (diálogos) — como destravar todos\n\n> Gerado do código v1.6.3. ${Object.keys(d.notes).length} notes no total. Notes são só lore/dicas (não dão bônus), mas vários marcam marcos de progressão — bons para um checklist "100%".\n\n`;
md += `## Como notes são encontrados\n\n> **Numeração:** o jogo mostra o número do note como id + 1 (ex.: \`farm_20\` aparece como Farm 21).\n\n- **Global Level** (\`meta.globalLevelNotes\`).\n- **Mining**: primeira quebra de certas profundidades na mina (sub 0).\n- **Horde**: derrotar o boss de certas zonas (sub 0).\n- **Farm**: primeira colheita de certas crops.\n- **Upgrades/buildings com campo \`note\`**: comprar/terminar o 1º nível (vale também ao carregar um save que já tem o upgrade).\n- **Generals**: cada estágio de questline pode ter um note.\n- **Eventos e sistemas**: ações específicas (início do evento, primeira ação X).\n- Notificação e "hint" aparecem só se a opção *notification → note* estiver ligada.\n\n`;
md += `**Inalcançáveis na v1.6.3:** ${d.notesWithoutSource.map(n => '`' + n + '`').join(', ')} (notes de Orladee sem estágio associado).\n\n`;
for (const f of featOrder) {
  const list = Object.entries(d.notes).filter(([, n]) => n.feature === f);
  if (!list.length) continue;
  list.sort((a, b) => (+a[0].split('_')[1]) - (+b[0].split('_')[1]));
  md += `## ${f} (${list.length})\n\n| Nº no jogo | Note (id) | Autor | Como destravar |\n|---|---|---|---|\n`;
  for (const [k, n] of list) md += `| ${+k.split('_')[1] + 1} | \`${k}\` | ${esc(n.author)} | ${n.sources.length ? esc(n.sources.map(s => s.how).join(' **ou** ')) : '*inalcançável nesta versão*'} |\n`;
  md += '\n';
}
fs.writeFileSync('wiki/07-notes.md', md);

// ---------- 97 CARDS (generated table) ----------
md = `# Cards — tabela completa (gerada do código v1.6.3)\n\n${Object.keys(d.cards).length} cartas. **Power** soma no card power da feature quando equipada (shiny +1). *adaptive* = maior power entre suas cartas daquela feature − 2. **Instant** = cópias extras viram recurso/consumível na hora. Chance = probabilidade de cada carta sorteada do pack ser esta.\n\n`;
md += `## Packs\n\n| Pack | Feature | Exige unlock | Preço (emerald) | Cartas/pack | Shiny pack (shiny dust) | Conteúdo |\n|---|---|---|---|---|---|---|\n`;
for (const [k, p] of Object.entries(d.cardPacksFull)) md += `| ${k} | ${p.feature} | \`${p.unlock ?? '—'}\` | ${p.price ?? 'evento/prêmio'} | ${p.cardsPerPack} | ${p.shinyPrice ?? '—'} | ${Object.keys(p.content).length} cartas |\n`;
md += `\n## Coleções\n\n| Coleção | Cartas | Bônus ao completar |\n|---|---|---|\n`;
for (const [k, c] of Object.entries(d.cardCollections)) md += `| ${k} | ${c.cards.length} | ${esc(c.reward.join('; ') || '— (cartas de quest)')} |\n`;
for (const f of ['mining', 'village', 'horde', 'farm', 'gallery', 'gem', 'event']) {
  const list = Object.entries(d.cards).filter(([, c]) => c.feature === f);
  md += `\n## Cartas — ${f} (${list.length})\n\n| ID | Nome | Coleção | Power | Efeito equipada | Onde cai |\n|---|---|---|---|---|---|\n`;
  for (const [id, c] of list) md += `| ${id} | ${esc(c.name)}${c.instant ? ' *(instant)*' : ''} | ${c.collection} | ${c.power} | ${esc(c.reward.join('; '))} | ${esc(c.packs.join(', ') || (c.collection === 'specialGadgets' ? 'questline Grobodal (6 cópias) / Merchant "card_quest"' : 'sem fonte na v1.6.3'))} |\n`;
}
fs.writeFileSync('wiki/97-cards.md', md);

// ---------- 95 GENERALS (v2) ----------
md = `# Generals — Questlines completas (gerado do código v1.6.3)\n\n**Regras (js/modules/general.js):**\n- O jogo checa a questline a cada segundo; os estágios são **sequenciais** e todas as tarefas do estágio atual precisam ser verdadeiras **ao mesmo tempo**. Vários estágios podem completar no mesmo tick.\n- Tarefas "nesta run" usam o stat da run atual (\`value\`) → precisam acontecer dentro de uma mesma run (marcadas ⚔); as restritivas (tempo ≤, actives de relic = 0, crafting ≤ N) exigem um prestige dedicado, jogando "com a mão amarrada". "recorde" usa o valor all-time (\`total\`).\n- A relic sai no estágio = \`stageLength\`. Os estágios depois disso são **ciclos bônus**: cada ciclo completo dá +20 de cap de relic power.\n- Tarefas "carta X equipada" com *giveCard* entregam 6 cópias da carta de quest se você não tiver nenhuma.\n- Questlines com "exige" só começam após aquele unlock (\`see\`).\n\n`;
for (const [g, gen] of Object.entries(d.generalsFull)) {
  md += `## ${g}${gen.unlock ? ` (exige \`${gen.unlock}\`)` : ''}\n\n`;
  if (!Object.keys(gen.quests).length) { md += '*Sem questlines nesta versão.*\n\n'; continue; }
  for (const [q, qu] of Object.entries(gen.quests)) {
    md += `### ${q} → relic \`${qu.reward}\` no estágio ${qu.stageLength}${qu.unlock ? ` · exige \`${qu.unlock}\`` : ''}\n\n| # | Features | Tarefas (todas juntas) | Recompensa |\n|---|---|---|---|\n`;
    for (const sg of qu.stages) md += `| ${sg.n}${sg.isChallenge ? ' ⚔' : ''} | ${sg.features.join(', ')} | ${esc(sg.tasks.join(' · '))} | ${[sg.note ? 'note ' + sg.note : '', sg.relic ? '**relic ' + sg.relic + '**' : '', sg.bonus || ''].filter(Boolean).join(' · ')} |\n`;
    md += '\n';
  }
}
fs.writeFileSync('wiki/95-generals-questlines.md', md);

// ---------- 98 GENERALS POR FEATURE ----------
const byF = d.generalByFeature;
const blockFor = (f) => {
  const list = byF[f] || [];
  if (!list.length) return '';
  const qs = {};
  list.forEach(x => (qs[x.general + ' · ' + x.quest] = qs[x.general + ' · ' + x.quest] || []).push(x));
  let b = `| Questline | Estágios que envolvem ${f} | Tarefas desta feature |\n|---|---|---|\n`;
  for (const [q, xs] of Object.entries(qs)) {
    const [g, qn] = q.split(' · ');
    const qd = d.generalsFull[g].quests[qn];
    b += `| ${q} → \`${qd.reward}\`${qd.unlock ? ` (exige \`${qd.unlock}\`)` : ''} | ${xs.map(x => x.stage + (x.isChallenge ? '⚔' : '')).join(', ')} de ${xs[0].of} | ${esc([...new Set(xs.flatMap(x => x.tasks))].slice(0, 12).join(' · '))}${new Set(xs.flatMap(x => x.tasks)).size > 12 ? ' …' : ''} |\n`;
  }
  return b;
};
md = `# Generals por feature — mapa para tooltips (gerado do código v1.6.3)\n\nPara cada feature: quais estágios de questline dependem dela. Use em tooltip de progressão: "este stat/upgrade conta para General X, estágio Y". Dados estruturados em \`data/gooboo-data.json → generalByFeature\` (cada item: general, quest, stage, isChallenge, tasks da feature, allTasks).\n\n**Algoritmo sugerido para o tooltip** (por feature): para cada questline ativa, ler \`store.state.general[g].quests[q].stage\`; se o estágio atual tem tarefa desta feature, mostrar a tarefa, o valor atual vs alvo e se é ⚔ (exige run dedicada). Mostrar também o próximo estágio que toca esta feature.\n\n`;
for (const f of ['mining', 'village', 'horde', 'farm', 'gallery', 'card', 'school', 'gem', 'meta']) if (byF[f]) md += `## ${f}\n\n${blockFor(f)}\n`;
fs.writeFileSync('wiki/98-generals-por-feature.md', md);
fs.writeFileSync('wiki/_blocks.json', JSON.stringify(Object.fromEntries(['mining', 'village', 'horde', 'farm', 'gallery'].map(f => [f, blockFor(f)]))));
console.log('ok', Object.keys(byF));
