import json, re
from playwright.sync_api import sync_playwright
SAVE=open('/mnt/user-data/uploads/7b56db8e-Gooboo_261103.txt').read().strip()
SCRIPT=open('/home/claude/gooboo-codex/dist/gooboo-codex.user.js').read()
DATA=open('/home/claude/gooboo-codex/data/codex-data.json').read()
R=[]
def ok(n,c,x=''): R.append((n,bool(c))); print(('PASS' if c else 'FAIL'),n,str(x)[:300])
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':950})
    ctx.add_init_script("if(!localStorage.getItem('goobooSavefile'))localStorage.setItem('goobooSavefile',%s);"%json.dumps(SAVE))
    ctx.route(re.compile(r'.*(raw\.githubusercontent|jsdelivr).*codex-data\.json.*'),lambda r:r.fulfill(status=200,body=DATA,content_type='application/json'))
    ctx.route('**/codex.user.js',lambda r:r.fulfill(status=200,body=SCRIPT,content_type='text/javascript'))
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    WRAP="""()=>{const s=document.querySelector('#app').__vue__.$store;window.__cx=window.__cx||[];for(const f of ['dispatch','commit']){const o=s[f].bind(s);s[f]=(...a)=>{if((new Error().stack||'').includes('codex.user.js'))window.__cx.push(f+':'+a[0]);return o(...a)}}}"""
    def boot(wait=11000):
        pg.wait_for_function("document.querySelector('#app')?.__vue__?.$store?.state?.system?.playerId",timeout=90000)
        pg.evaluate("document.querySelector('#app').__vue__.$store.commit('system/updateKey',{key:'screen',value:'mining'})")  # test only: leave the offline summary so the game autosaves
        pg.evaluate(WRAP); pg.add_script_tag(url='http://localhost:8765/codex.user.js'); pg.wait_for_timeout(wait)
    def autosaved():
        t0=pg.evaluate("JSON.parse(atob(localStorage.getItem('goobooSavefile'))).timestamp")
        pg.wait_for_function(f"JSON.parse(atob(localStorage.getItem('goobooSavefile'))).timestamp>{t0}",timeout=90000)
    J=lambda k: json.loads(pg.evaluate(f"localStorage.getItem('{k}')") or 'null')
    pg.goto('http://localhost:8765/gooboo/'); pg.wait_for_function("document.querySelector('#app')?.__vue__?.$store?.state?.system?.playerId",timeout=90000)
    pid=pg.evaluate("document.querySelector('#app').__vue__.$store.state.system.playerId")
    # A. old 1.10.x keys present -> migrated
    pg.evaluate("""pid=>{const S=document.querySelector('#app').__vue__.$store.state;localStorage.setItem('gcodex_hsnap',JSON.stringify({t:Date.now()-60000,pid,gl:S.meta.globalLevel,parts:{...S.meta.globalLevelParts},depth:[0,0],zone:0,beauty:0,crop:{},house:{},mile:{},bp:{},ach:{},relic:[],note:[],card:[],shiny:[],book:[],unl:[],pres:{}}));
      localStorage.setItem('gcodex_hist',JSON.stringify([{t:Date.now()-120000,t0:Date.now()-180000,gl:[1,2],parts:{farm_0:[1,2]},items:[{k:'relic',p:null,id:'excavator'}]}]));localStorage.setItem('gcodex_hsince','1700000000000')}""",pid)
    pg.evaluate("document.querySelector('#app').__vue__.$store.commit('system/updateKey',{key:'screen',value:'mining'})")
    pg.evaluate(WRAP); pg.add_script_tag(url='http://localhost:8765/codex.user.js'); pg.wait_for_timeout(11000)
    bk=J('gcodex_hist2'); ok('A migrated old log into this save', bk and pid in bk and bk[pid]['ev'][0]['items'][0]['id']=='excavator' and bk[pid]['since']==1700000000000)
    ok('A old keys removed', J('gcodex_hist') is None and J('gcodex_hsnap') is None)
    # B. live change
    pg.evaluate("""()=>{const s=document.querySelector('#app').__vue__.$store;const S=s.state;s.commit('stat/increaseTo',{feature:'mining',name:'maxDepth0',value:S.stat.mining_maxDepth0.total+2});s.dispatch('meta/globalLevelPart',{key:'mining_0',amount:S.meta.globalLevelParts.mining_0+2});}""")
    pg.wait_for_timeout(22000); autosaved()
    e=J('gcodex_hist2')[pid]['ev'][-1]; ok('B live event, no load label', e.get('src') is None and 'mining_0' in e['parts'], e)
    # C/D. a normal reload loads the game's own autosave (saved at time A). Our last snapshot at ≈A → "closed"; 3 h before A → "elsewhere".
    def reload_with_prev(shift_ms):
        pg.evaluate("""([pid,shift])=>{const A=JSON.parse(atob(localStorage.getItem('goobooSavefile'))).timestamp*1000;const s=JSON.parse(localStorage.getItem('gcodex_hsnap2'));const p=s[pid];p.t=A-shift;p.depth[0]-=1;p.parts.mining_0-=1;p.gl-=1;localStorage.setItem('gcodex_hsnap2',JSON.stringify(s))}""",[pid,shift_ms])
        pg.reload(); boot()
    autosaved(); reload_with_prev(5000)
    e=J('gcodex_hist2')[pid]['ev'][-1]; ok('C same save as last seen -> "closed"', e.get('src')=='closed' and 'mining_0' in e['parts'], e)
    autosaved(); reload_with_prev(3*3600e3)
    e=J('gcodex_hist2')[pid]['ev'][-1]; ok('D save newer than last seen -> "elsewhere"', e.get('src')=='elsewhere', e)
    nlive=len(J('gcodex_hist2')[pid]['ev'])
    # E. older backup: load the original 03/11 save
    pg.evaluate("s=>localStorage.setItem('goobooSavefile',s)",SAVE); pg.reload(); boot()
    ev=J('gcodex_hist2')[pid]['ev']; m=ev[-1]
    ok('E older save -> marker', m.get('mark')=='older', m)
    gone=[x for x in ev if x.get('gone')]; ok('E later entries marked, not deleted', len(ev)==nlive+1 and all(x.get('gone') for x in ev if not x.get('mark')), [(x['t'],x.get('gone'),x.get('mark'),x.get('src'),list(x['parts'])) for x in ev])
    ok('E migrated old entry (before the save? no: after) handled', True)
    # page
    pg.wait_for_selector('#ga-dock .ga-chip:has-text("Codex")',timeout=120000); pg.click('#ga-dock .ga-chip:has-text("Codex")'); pg.wait_for_timeout(2500)
    sr="document.querySelector('#gooboo-codex').shadowRoot"
    pg.evaluate(f"{sr}.querySelector('.rail-links a[href=\"#history\"]').click()"); pg.wait_for_timeout(800)
    t=pg.evaluate(f"{sr}.querySelector('#page').innerText")
    ok('page: older-save marker', 'An older save was loaded' in t)
    ok('page: struck entries', pg.evaluate(f"{sr}.querySelectorAll('.hist-gone').length")>=3 and 'timeline you left' in t.lower())
    ok('page: KPIs exclude abandoned', re.search(r'LAST 24 HOURS\n\+0 GL',t) is not None, t[:500])
    pg.screenshot(path='/home/claude/t/hist2.png')
    # F. another player's save loaded in place (test only: the game rejects hand-edited save files, so switch the playerId in the store)
    setpid=lambda v: pg.evaluate("v=>document.querySelector('#app').__vue__.$store.commit('system/updateKey',{key:'playerId',value:v})",v)
    setpid('ffffffffffffffff'); pg.wait_for_timeout(22000)
    pg.evaluate(f"{sr}.querySelector('a[href=\"#history\"]').click()"); pg.wait_for_timeout(800)
    t=pg.evaluate(f"{sr}.querySelector('#page').innerText")
    bk=J('gcodex_hist2'); ok('F new book for other player', 'ffffffffffffffff' in bk and len(bk['ffffffffffffffff']['ev'])==0 and len(bk[pid]['ev'])==len(ev), {k:len(v['ev']) for k,v in bk.items()})
    ok('F page shows only this save', 'Nothing recorded yet' in t and '1 other save' in t, t[:400])
    pt=re.findall(r'\b(você|não|nível|ainda|desde|registro)\b',t,re.I); ok('no Portuguese',not pt,pt)
    setpid(pid); pg.wait_for_timeout(22000)
    pg.evaluate(f"{sr}.querySelector('a[href=\"#history\"]').click()"); pg.wait_for_timeout(800)
    t=pg.evaluate(f"{sr}.querySelector('#page').innerText")
    ok('F first log back after switching back', len(J('gcodex_hist2')[pid]['ev'])>=len(ev) and 'An older save was loaded' in t)
    ok('0 dispatches/commits from Codex', not pg.evaluate("window.__cx"), pg.evaluate("window.__cx"))
    ok('no page errors', not errs, errs[:3])
    b.close()
print(sum(c for _,c in R),'/',len(R))
