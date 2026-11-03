  // ── Ordem dos chips no dock (peça comum a todos os scripts Gooboo Assist; quem carregar primeiro instala) ──
  // Ordem = ordem das features no menu do jogo; Sorteios logo à esquerda do Codex; Codex sempre o último.
  // Cada chip vale pelo atributo data-ga-order (scripts novos) ou, nos scripts antigos, pelo emoji do texto.
  // Botão ▶/⏸ (classe com "play") anda junto com o chip que ficou antes dele. Idempotente: só mexe se a ordem estiver errada.
  (function installDockSort() {
    const V = 1;
    if ((window.__gaDockSort || 0) >= V) return;
    window.__gaDockSort = V;
    const BY_EMOJI = [['⛏', 10], ['🏘', 20], ['🔨', 21], ['⚔', 30], ['🛡', 30], ['🌾', 40], ['🎨', 50], ['🎓', 60], ['🎲', 90], ['📖', 100]];
    const isPlay = el => /play/.test(el.className || '') || /^[▶⏸]$/.test((el.textContent || '').trim());
    const orderOf = el => {
      if (el.dataset.gaOrder) return +el.dataset.gaOrder;
      const t = (el.textContent || '').trim();
      for (const [e, o] of BY_EMOJI) if (t.startsWith(e)) return o;
      return 80; // chip desconhecido: depois da School, antes de Sorteios/Codex
    };
    let busy = false;
    function sortDock() {
      const dock = document.getElementById('ga-dock');
      if (!dock || busy) return;
      const kids = [...dock.children];
      // grupos: chip + os botões ▶/⏸ que vêm logo depois dele (o par fica marcado para as próximas vezes)
      const groups = [];
      for (const el of kids) if (!isPlay(el)) groups.push({ head: el, els: [el], o: orderOf(el) });
      let prev = null;
      for (const el of kids) {
        if (!isPlay(el)) { prev = el; continue; }
        if (!(el.__gaOwner && kids.includes(el.__gaOwner))) el.__gaOwner = prev;
        const g = groups.find(x => x.head === el.__gaOwner);
        if (g) g.els.push(el); else groups.push({ head: el, els: [el], o: 85 });
      }
      const want = groups.map((g, i) => ({ ...g, i })).sort((a, b) => a.o - b.o || a.i - b.i).flatMap(g => g.els);
      if (want.every((el, i) => el === kids[i])) return;
      busy = true;
      try { for (const el of want) dock.appendChild(el); } finally { busy = false; }
    }
    let obs = null, watched = null;
    function watch() {
      const dock = document.getElementById('ga-dock');
      if (dock && dock !== watched) {
        if (obs) obs.disconnect();
        obs = new MutationObserver(() => { if (!busy) sortDock(); });
        obs.observe(dock, { childList: true });
        watched = dock;
      }
      sortDock();
    }
    setInterval(watch, 1500); // só arruma a UI; o dock é recriado pelo núcleo quando a barra do jogo é refeita
    watch();
  })();
