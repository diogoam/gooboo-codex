# Gooboo Codex

Fan wiki clicável do [Gooboo](https://tendsty.github.io/gooboo/) que roda **dentro do jogo**, como userscript do Tampermonkey.

- Todo termo do jogo (moedas, upgrades, relics, cards, notes, generals, achievements, livros, crops…) com o **nome que aparece na interface**, o que é, de onde vem e como destrava. O id interno aparece só como apoio de busca.
- **Calculadoras ligadas ao seu jogo ao vivo**: de onde vem cada multiplicador, qual o próximo nível que mais rende, simulação de −/+ níveis, fórmulas de prestige (cash, almas, faith, crops, GL…) e o planejador de run por feature.
- **O que falta**: notes, unlocks, upgrades, cards, relics e questlines que você ainda não pegou, com como pegar e o seu progresso.

O Codex **só lê** o jogo: não despacha ação, não cria moeda e não mexe em unlock — nada que o anticheat do Gooboo possa marcar.

## Instalar

1. Instale o [Tampermonkey](https://www.tampermonkey.net/) no navegador.
2. Abra **[dist/gooboo-codex.user.js](https://raw.githubusercontent.com/diogoam/gooboo-codex/main/dist/gooboo-codex.user.js)**; o Tampermonkey oferece a instalação.
3. Recarregue o jogo. Aparece o botão **📖 Codex** no topo (ao lado dos botões dos outros scripts Gooboo Assist, se você usa).

O Tampermonkey checa atualizações pelo mesmo endereço.

## Usar

| Ação | Resultado |
|---|---|
| Clique em **📖 Codex** | Abre/fecha o painel lateral dentro do jogo |
| **Shift+clique** ou botão do meio em 📖 Codex, ou **⧉** no painel | Abre o Codex numa **janela separada** (bom para segundo monitor) |
| Arrastar a borda esquerda do painel | Muda a largura (estreito = modo lista/página) |
| **↻** | Atualiza a página com os valores atuais do jogo |
| **←** | Volta para a página anterior |
| **Esc** | Fecha o painel |

A página aberta se atualiza sozinha a cada 5 s — menos quando você está mexendo numa calculadora, para não apagar sua simulação (use ↻).
Continua atualizando com a aba do jogo em segundo plano ou minimizada (timers em Web Worker do núcleo GooAssist v2), então a janela separada pode ficar na frente enquanto o jogo roda atrás.

Os dados (~1,5 MB) são baixados deste repositório na primeira vez que você abre o Codex e ficam guardados no navegador (IndexedDB); só baixa de novo quando a versão dos dados muda.

## Estrutura

```
dist/gooboo-codex.user.js   script pronto (gerado)
data/codex-data.json        verbetes, generals, fontes dos notes e cores (gerado)
src/                        código do script: main.js (painel, janela, dados), app.js (navegação e páginas),
                            calc.js (calculadoras), core.js (núcleo GooAssist v2), style.css/extra.css
tools/build.js              empacota src/ + dados → dist/ e data/
tools/pipeline/             extrai os dados do código do jogo (store Vuex rodando headless em Node)
```

## Regerar quando o jogo atualizar

```bash
git clone --depth 1 https://github.com/Tendsty/gooboo.git
mkdir gbx && cd gbx && npm init -y && npm i esbuild vue@2.7.14 vuex@3.6.2 seedrandom semver color@4
ln -s $PWD/node_modules ../gooboo/node_modules
mkdir stubs && echo "module.exports={};module.exports.default={};" > stubs/empty.js
cp ../gooboo-codex/tools/pipeline/* .
bash build.sh            # bundle.js do store do jogo
node extract.js          # data/gooboo-data.json
node extract2.js         # notes, cards, generals
npx esbuild colentry.js --bundle --platform=node --outfile=colbundle.js && node -e "require('./colbundle.js');require('fs').writeFileSync('colors.json',JSON.stringify(globalThis.__colors))"   # colors.json
node glossary.js         # glossary.json (~2.900 verbetes)
node enrich.js           # moedas/gemas EN-first: How to get it / What it does, seções Prestige
node guides.js           # guias de evento (EN) e o conceito Tick
cd ../gooboo-codex && node tools/build.js ../gbx
```

Sem argumento, `node tools/build.js` só reempacota o script com os dados que já estão em `data/`.
Ao mudar `data/codex-data.json`, o hash embutido no script muda junto — publique os dois no mesmo commit.

Projeto de fã, sem relação oficial com o Gooboo.
