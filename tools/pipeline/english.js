// english.js — last pipeline step. The generators keep internal section/category keys; this renames them to the
// final English titles the Codex shows (Plain English). The app (src/app.js, src/calc.js) reads these English names.
const fs = require('fs');
const GL = JSON.parse(fs.readFileSync('glossary.json', 'utf8'));
const H = {
  'O que é': 'What it is', 'O que mede': 'What it measures', 'De onde vem': 'Where it comes from', 'Como destrava': 'How it unlocks', 'Destrava': 'What it unlocks',
  'Custo': 'Cost', 'Efeitos': 'Effects', 'Efeito quando equipada': 'When equipped', 'Usada para comprar': 'Used to buy', 'O que este unlock libera': 'What it unlocks',
  'Níveis': 'Levels', 'Efeitos por nível': 'Effects per level', 'Efeito por cópia': 'Effect per copy', 'Atributos (nível 1)': 'Stats (level 1)', 'Atributos base': 'Base stats',
  'Habilidades': 'Skills', 'Produz por trabalhador': 'Made per worker', 'Drops raros': 'Rare drops', 'Boss final': 'Final boss', 'Recompensas por andar': 'Floor rewards',
  'Conteúdo': 'Contents', 'Estágios': 'Stages', 'Milestones (cada um = +1 GL)': 'Milestones (+1 GL each)', 'Ao repetir': 'Extra copies', 'Glyphs no Museum': 'Glyphs in the Museum',
  'Cartas': 'Cards needed', 'Bônus ao completar': 'Completion bonus', 'Efeito especial': 'Special effect', 'Habilidade ativa': 'Active ability', 'Bônus de cards': 'Card bonuses',
  'Como é calculado': "How it's calculated", 'Fórmula': 'Formula', 'Afetado por': 'Affected by', 'Ganho afetado por': 'Gain affected by', 'Capacidade afetada por': 'Capacity affected by',
  'Grupo': 'Group', 'Grupos': 'Groups', 'Mencionado por': 'Mentioned by', 'Efeitos (nível 1 → 3)': 'Effects (level 1 → 3)', 'Efeitos (nível 1 → 5)': 'Effects (level 1 → 5)',
  'Bônus': 'Bonuses', 'Equipar': 'Equipping', 'Lista': 'List', 'Recompensas': 'Rewards', 'Também': 'Also', 'Na wiki': 'In the Codex', 'O que cada um gera': 'What each one gives', 'Detalhes': 'Details',
};
const C = {
  'Moeda': 'Currency', 'Gema': 'Gem', 'Estatística': 'Stat', 'Upgrade de prestige': 'Prestige upgrade', 'Upgrade premium': 'Premium upgrade', 'Upgrade de shapes': 'Shape upgrade',
  'Upgrade de evento': 'Event upgrade', 'Coleção de cards': 'Card collection', 'Livro': 'Book', 'Matéria': 'Subject', 'Receita': 'Recipe', 'Ideia': 'Idea', 'Equipamento': 'Equipment',
  'Classe': 'Class', 'Área': 'Area', 'Torre': 'Tower', 'Consumível': 'Consumable', 'Efeito de treasure': 'Treasure effect', 'Conceito': 'Concept',
};
const left = new Set();
for (const e of GL) {
  e.c = C[e.c] || e.c;
  for (const s of e.s) { s.h = H[s.h] || s.h; if (/[ãõçêáíóú]|nível/.test(s.h)) left.add(s.h); }
  // merge duplicated headings created by the rename (e.g. two "What it unlocks")
  const seen = {}; e.s = e.s.filter(s => { if (seen[s.h]) { seen[s.h].b.push(...s.b.filter(x => !seen[s.h].b.includes(x))); return false; } seen[s.h] = s; return true; });
}
fs.writeFileSync('glossary.json', JSON.stringify(GL));
console.log('english ok', left.size ? 'left: ' + [...left].join(', ') : '');
