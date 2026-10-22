// Gera data/codex-data.json e dist/gooboo-codex.user.js
// Uso: node tools/build.js [pasta-gbx]
//   pasta-gbx = onde ficam glossary.json, colors.json e data/gooboo-data.json gerados pelo pipeline
//   (tools/pipeline/*, ver README). Sem argumento, usa os arquivos já em data/ (só reempacota o script).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const VERSION = JSON.parse(rd('package.json')).version;

// ---------- dados ----------
const gbx = process.argv[2];
let data;
if (gbx) {
  const G = f => JSON.parse(fs.readFileSync(path.join(gbx, f), 'utf8'));
  const colors = Object.assign(G('colors.json'), { 'darker-grey': '#424242', 'dark-grey': '#616161', 'lighter-grey': '#bdbdbd', 'light-grey': '#9e9e9e', 'lightest-grey': '#e0e0e0' });
  const D = G('data/gooboo-data.json');
  const gbf = {};
  for (const [g, gen] of Object.entries(D.generalsFull)) {
    gbf[g] = { quests: {} };
    for (const [q, qu] of Object.entries(gen.quests)) gbf[g].quests[q] = { stages: qu.stages.map(s => ({ features: s.features, tasks: s.tasks, isChallenge: s.isChallenge })) };
  }
  const meta = { notes: Object.fromEntries(Object.entries(D.notes).map(([k, n]) => [k, { sources: n.sources }])), unlockTriggers: D.unlockTriggers };
  data = { game: D.version || '1.6.3', glossary: G('glossary.json'), gbf, meta, colors };
  const body = JSON.stringify({ ...data, hash: undefined });
  data.hash = crypto.createHash('sha1').update(body).digest('hex').slice(0, 12);
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data/codex-data.json'), JSON.stringify(data));
} else {
  data = JSON.parse(rd('data/codex-data.json'));
}

// ---------- CSS ----------
const base = rd('src/style.css') + '\n' + rd('src/extra.css');
const cssDoc = base;
let cssShadow = base
  .replace(/:root:not\(\[data-theme="light"\]\)\{/g, ':host(:not([data-theme="light"])){')
  .replace(/:root\[data-theme="dark"\]\{/g, ':host([data-theme="dark"]){')
  .replace(/:root\{/g, ':host{')
  .replace(/^html,body\{[^}]*\}$/m, '')
  .replace(/^body\{[^}]*\}$/gm, '')
  .replace(/^body::before\{[^}]*\}$/m, '')
  .replace(/@media \(max-width:760px\)\{[\s\S]*?\n\}\n/, '');
cssShadow += `
/* painel embutido no jogo */
:host{display:block;font:15px/1.55 var(--f-body);color:var(--ink)}
.root{height:100%}
.grip{position:absolute;left:-3px;top:0;bottom:0;width:7px;cursor:ew-resize;z-index:2}
.grip:hover{background:color-mix(in srgb,var(--accent) 35%,transparent)}
.wrap{container:codex/inline-size;overflow:hidden;border-left:1px solid var(--line)}
.app{height:100%}
@container codex (max-width:680px){
  .app{grid-template-columns:1fr}
  .app:not(.reading) .main{display:none}
  .app.reading .rail{display:none}
  .rail{border-right:0}
  .back-btn{display:inline-block;all:unset;cursor:pointer;color:var(--link);font-weight:700;margin-bottom:6px}
  details.back ul{columns:1}
}`;
if (/:root|^body/m.test(cssShadow)) throw new Error('CSS do shadow ainda tem :root/body');

// ---------- app ----------
const app = rd('src/app.js').replace('/*__CALC__*/', () => rd('src/calc.js'));
const indent = s => s.split('\n').map(l => (l ? '  ' + l : l)).join('\n');
const header = `// ==UserScript==
// @name         Gooboo Codex
// @namespace    gooboo-assist
// @version      ${VERSION}
// @description  Fan wiki clicável do Gooboo dentro do jogo: todo termo com o nome da interface, de onde vem, como destrava, calculadoras ligadas ao seu jogo ao vivo, planejador de run e "o que falta" por feature. Só lê o jogo.
// @author       diogoam
// @homepageURL  https://github.com/diogoam/gooboo-codex
// @match        https://tendsty.github.io/gooboo/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/diogoam/gooboo-codex/main/dist/gooboo-codex.user.js
// @downloadURL  https://raw.githubusercontent.com/diogoam/gooboo-codex/main/dist/gooboo-codex.user.js
// ==/UserScript==
`;
const out = header + '\n' + rd('src/main.js')
  .replace('/*__CORE__*/', () => rd('src/core.js').replace(/\n$/, ''))
  .replace('/*__APP__*/', () => indent(app))
  .replace('__VERSION__', VERSION)
  .replace('__DATAHASH__', data.hash)
  .replace('__CSSDOC__', () => JSON.stringify(cssDoc))
  .replace('__CSSSHADOW__', () => JSON.stringify(cssShadow));
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/gooboo-codex.user.js'), out);
new Function(out.replace(/^\/\/.*$/gm, '')); // checa sintaxe
console.log(`ok · script ${(out.length / 1024).toFixed(0)} KB · dados ${(JSON.stringify(data).length / 1e6).toFixed(2)} MB · hash ${data.hash} · ${data.glossary.length} verbetes`);
