const fs=require('fs');const d=require('./data/gooboo-data.json');const blocks=JSON.parse(fs.readFileSync('wiki/_blocks.json'));
const files={mining:'01-mining.md',village:'02-village.md',horde:'03-horde.md',farm:'04-farm.md',gallery:'05-gallery.md'};
const esc=s=>String(s??'').replace(/\|/g,'\\|');
for(const [f,file] of Object.entries(files)){
  let md=fs.readFileSync('wiki/'+file,'utf8').split('\n## Generals ligados a esta feature')[0].trimEnd();
  const notes=Object.entries(d.notes).filter(([,n])=>n.feature===f);
  const packs=Object.entries(d.cardPacksFull).filter(([,p])=>p.feature===f);
  const cols=[...new Set(Object.values(d.cards).filter(c=>c.feature===f).map(c=>c.collection))];
  md+=`\n\n## Generals ligados a esta feature (tooltip de progressão)\n\nEstágios de questline que pedem algo desta feature. ⚔ = precisa acontecer dentro de uma run. Detalhe completo em \`95-generals-questlines\`; dados em \`generalByFeature.${f}\` no JSON. No script: mostrar a tarefa do **estágio atual** de cada questline quando ela for desta feature, com valor atual/alvo.\n\n${blocks[f]}`;
  md+=`\n## Notes desta feature (${notes.length})\n\n${notes.map(([k,n])=>'`'+k+'` — '+(n.sources.map(s=>s.how).join(' ou ')||'inalcançável')).join('  \n')}\n`;
  md+=`\n## Cards desta feature\n\nPacks (emerald → exige unlock): ${packs.map(([k,p])=>`**${k}** (${p.price} · \`${p.unlock??'—'}\`)`).join(', ')}.  \nColeções: ${cols.map(c=>`${c} → ${esc(d.cardCollections[c].reward.join('; ')||'cartas de quest')}`).join(' · ')}.  \nMecânica geral em \`08-cards\`; tabela de cartas em \`97-cards\`.\n`;
  fs.writeFileSync('wiki/'+file,md);
}
// 06: school generals
let m=fs.readFileSync('wiki/06-meta-features.md','utf8').split('\n## Generals ligados')[0].trimEnd();
const sch=(d.generalByFeature.school||[]).map(x=>`- ${x.general} · ${x.quest} estágio ${x.stage}: ${x.tasks.join(' · ')}`).join('\n');
m+=`\n\n## Generals ligados à School\n\n${sch}\n\nNotes de todos os sistemas meta: \`07-notes\`. Cartas: \`08-cards\` e \`97-cards\`.\n`;
fs.writeFileSync('wiki/06-meta-features.md',m);
console.log('done');
