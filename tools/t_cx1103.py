import json, re
from playwright.sync_api import sync_playwright
SAVE=open('/mnt/user-data/uploads/7b56db8e-Gooboo_261103.txt').read().strip()
SCRIPT=open('/home/claude/gooboo-codex/dist/gooboo-codex.user.js').read()
DATA=open('/home/claude/gooboo-codex/data/codex-data.json').read()
R=[]
def ok(n,c,x=''): R.append((n,bool(c))); print(('PASS' if c else 'FAIL'),n,str(x)[:300])
APP="document.querySelector('#app').__vue__.$store"
BUMP=f"()=>{{const s={APP};const S=s.state;s.commit('stat/increaseTo',{{feature:'mining',name:'maxDepth0',value:S.stat.mining_maxDepth0.total+1}});s.dispatch('meta/globalLevelPart',{{key:'mining_0',amount:S.meta.globalLevelParts.mining_0+1}});}}"
sr="document.querySelector('#gooboo-codex').shadowRoot"
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':950})
    ctx.add_init_script("if(!localStorage.getItem('goobooSavefile'))localStorage.setItem('goobooSavefile',%s);"%json.dumps(SAVE))
    ctx.route(re.compile(r'.*codex-data\.json.*'),lambda r:r.fulfill(status=200,body=DATA,content_type='application/json'))
    ctx.route('**/codex.user.js',lambda r:r.fulfill(status=200,body=SCRIPT,content_type='text/javascript'))
    errs=[]
    def page():
        pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('http://localhost:8765/gooboo/'); pg.wait_for_function(f"{APP.replace('.__vue__','?.__vue__')}?.state?.system?.playerId",timeout=90000)
        pg.add_script_tag(url='http://localhost:8765/codex.user.js'); return pg
    J=lambda pg: json.loads(pg.evaluate("localStorage.getItem('gcodex_hist2')") or '{}')
    a=page(); pid=a.evaluate(f"{APP}.state.system.playerId"); a.wait_for_timeout(11000)
    # 1) offline summary open (fresh load of the 03/11 save): change recorded with the summary flag, not saved
    ok('summary screen open', a.evaluate(f"{APP}.state.system.screen")=='offlineSummary')
    a.evaluate(BUMP); a.wait_for_timeout(22000)
    e=J(a)[pid]['ev'][-1]; ok('event flagged "offline summary open", not saved', e.get('summary')==1 and not e.get('saved'), e)
    # 2) close the summary (test only) -> game autosaves -> entry confirmed saved
    a.evaluate(f"{APP}.commit('system/updateKey',{{key:'screen',value:'mining'}})")
    t0=a.evaluate("JSON.parse(atob(localStorage.getItem('goobooSavefile'))).timestamp")
    a.wait_for_function(f"JSON.parse(atob(localStorage.getItem('goobooSavefile'))).timestamp>{t0}",timeout=90000); a.wait_for_timeout(21000)
    e=J(a)[pid]['ev'][-1]; ok('after autosave the entry is confirmed saved', e.get('saved')==1, e)
    # 3) second tab -> tab-duplicate; it keeps running but the Codex there records nothing
    c=page(); c.wait_for_function(f"{APP}.state.system.screen==='tab-duplicate'",timeout=30000); c.wait_for_timeout(11000)
    n0=len(J(a)[pid]['ev'])
    c.evaluate(BUMP); c.wait_for_timeout(22000)
    ok('duplicate tab writes no entry', len(J(c)[pid]['ev'])==n0, len(J(c)[pid]['ev']))
    c.evaluate("window.GooAssist.modules.codex.open()"); c.wait_for_timeout(3000)
    live=c.evaluate(f"{sr}.querySelector('#liveTxt').textContent"); ok('duplicate tab: warning in the panel', 'another Gooboo tab is open' in live, live)
    c.evaluate(f"{sr}.querySelector('.rail-links a[href=\"#history\"]').click()"); c.wait_for_timeout(600)
    t=c.evaluate(f"{sr}.querySelector('#page').innerText"); ok('duplicate tab: log page explains', 'This tab is not saving' in t, t[:300])
    # 4) first tab still records normally
    a.evaluate(BUMP); a.wait_for_timeout(22000)
    ok('original tab still records', len(J(a)[pid]['ev'])==n0+1)
    a.evaluate("window.GooAssist.modules.codex.open()"); a.wait_for_timeout(3000)
    live=a.evaluate(f"{sr}.querySelector('#liveTxt').textContent"); ok('original tab: no warning', live.startswith('Live'), live)
    a.evaluate(f"{sr}.querySelector('.rail-links a[href=\"#history\"]').click()"); a.wait_for_timeout(600)
    t=a.evaluate(f"{sr}.querySelector('#page').innerText"); ok('page shows last game save', 'Last game save' in t, t[:600])
    pt=re.findall(r'\b(você|não|nível|ainda|desde|registro|salv)\w*',t,re.I); ok('no Portuguese',not pt,pt)
    a.screenshot(path='/home/claude/t/hist3.png'); c.screenshot(path='/home/claude/t/dup.png')
    ok('no page errors', not errs, errs[:3])
    b.close()
print(sum(c for _,c in R),'/',len(R))
