import json, time, re, sys
from playwright.sync_api import sync_playwright
SAVE=open('/mnt/user-data/uploads/7b56db8e-Gooboo_261103.txt').read().strip()
SCRIPT=open('/home/claude/gooboo-codex/dist/gooboo-codex.user.js').read()
DATA=open('/home/claude/gooboo-codex/data/codex-data.json').read()
R=[]
def ok(n,c,x=''): R.append((n,bool(c))); print(('PASS' if c else 'FAIL'),n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':950})
    ctx.add_init_script("if(!localStorage.getItem('goobooSavefile'))localStorage.setItem('goobooSavefile',%s);"%json.dumps(SAVE))
    ctx.route(re.compile(r'.*(raw\.githubusercontent|jsdelivr).*codex-data\.json.*'),lambda r:r.fulfill(status=200,body=DATA,content_type='application/json'))
    ctx.route('**/codex.user.js',lambda r:r.fulfill(status=200,body=SCRIPT,content_type='text/javascript'))
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    WRAP="""()=>{const s=document.querySelector('#app').__vue__.$store;window.__cx=[];for(const f of ['dispatch','commit']){const o=s[f].bind(s);s[f]=(...a)=>{const st=new Error().stack||'';if(st.includes('codex.user.js'))window.__cx.push(f+':'+a[0]);return o(...a)}}}"""
    def boot():
        pg.goto('http://localhost:8765/gooboo/'); pg.wait_for_function("document.querySelector('#app')?.__vue__?.$store?.state?.system?.playerId",timeout=60000)
        pg.evaluate(WRAP); pg.add_script_tag(url='http://localhost:8765/codex.user.js')
    boot(); pg.wait_for_timeout(11000)
    snap=pg.evaluate("localStorage.getItem('gcodex_hsnap')"); ok('base snapshot taken',snap)
    s=json.loads(snap); ok('snapshot has gl/parts/crops', s['gl']>0 and 'farm_0' in s['parts'] and len(s['crop'])>5, f"GL {s['gl']}")
    ok('no event at baseline', pg.evaluate("JSON.parse(localStorage.getItem('gcodex_hist')||'[]').length")==0)
    # simulate progress (test only): same mutations the game makes
    pg.evaluate("""()=>{const s=document.querySelector('#app').__vue__.$store;const S=s.state;
      const d=S.stat.mining_maxDepth0.total; s.commit('stat/increaseTo',{feature:'mining',name:'maxDepth0',value:d+2});
      s.dispatch('meta/globalLevelPart',{key:'mining_0',amount:S.meta.globalLevelParts.mining_0+2});
      s.commit('relic/updateKey',{name:Object.keys(S.relic.item).find(k=>!S.relic.item[k].found),key:'found',value:true});}""")
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(22000)
    log=json.loads(pg.evaluate("localStorage.getItem('gcodex_hist')"))
    ok('event recorded (game in background-capable timer)', len(log)>=1, str(log[-1] if log else '')[:300])
    e=log[-1] if log else {}
    ok('GL part mining_0 +2 with depth cause', e.get('parts',{}).get('mining_0',[0,0])[1]-e.get('parts',{}).get('mining_0',[0,0])[0]==2 and any(i['k']=='depth' and i['p']=='mining_0' for i in e.get('items',[])))
    ok('non-GL relic recorded', any(i['k']=='relic' for i in e.get('items',[])))
    ok('not flagged as away', e.get('away')==False)
    # offline gap: rewind snapshot and reload
    s=json.loads(pg.evaluate("localStorage.getItem('gcodex_hsnap')"))
    s['t']-=3*3600e3; s['gl']-=3; s['parts']['farm_0']-=3; s['parts']['village_0']-=1
    ck=[k for k,v in s['crop'].items() if 2<v<20][0]; s['crop'][ck]-=2
    s['depth'][0]-=1; s['ach'][list(s['ach'])[0]]-=1
    pg.evaluate("v=>localStorage.setItem('gcodex_hsnap',v)",json.dumps(s))
    boot(); pg.wait_for_timeout(11000)
    log=json.loads(pg.evaluate("localStorage.getItem('gcodex_hist')")); e=log[-1]
    ok('away event after reload', e.get('away') is True and e['t']-e['t0']>3*3600e3-60e3, f"parts {e.get('parts')}")
    ok('farm_0 cause is crop with GL', any(i['k']=='crop' and i['id']==ck and i['p']=='farm_0' for i in e['items']))
    ok('ach recorded', any(i['k']=='ach' for i in e['items']))
    # UI
    pg.click('#ga-dock .ga-chip:has-text("Codex")'); pg.wait_for_timeout(2500)
    sr="document.querySelector('#gooboo-codex').shadowRoot"
    ok('rail link present', pg.evaluate(f"!!{sr}.querySelector('.rail-links a[href=\"#history\"]')"))
    pg.evaluate(f"{sr}.querySelector('.rail-links a[href=\"#history\"]').click()"); pg.wait_for_timeout(800)
    txt=pg.evaluate(f"{sr}.querySelector('#page').innerText")
    print(txt[:1500])
    ok('page title', 'Progress log' in txt)
    ok('KPIs', 'last 24 hours' in txt.lower() and 'last 7 days' in txt.lower())
    ok('away label', 'while the game was closed' in txt.lower())
    ok('GL parts labelled', 'GL' in txt and '→' in txt)
    ok('crop link', pg.evaluate(f"!!{sr}.querySelector('#page a[href=\"#crop~{ck}\"]')"))
    ok('relic link', pg.evaluate(f"!!{sr}.querySelector('#page a[href^=\"#relic~\"]')"))
    pt=re.findall(r'\b(você|não|nível|histórico|desde|jogo|ainda|registro)\b',txt,re.I); ok('no Portuguese',not pt,str(pt))
    pg.screenshot(path='/home/claude/t/hist.png')
    # search finds tool
    pg.evaluate(f"(()=>{{const q={sr}.querySelector('#q');q.value='progress log';q.dispatchEvent(new Event('input'))}})()"); pg.wait_for_timeout(500)
    ok('search finds tool', 'Progress log' in pg.evaluate(f"{sr}.querySelector('#list').innerText"))
    # clear (two clicks)
    pg.evaluate(f"{sr}.querySelector('a[href=\"#history\"]').click()"); pg.wait_for_timeout(300)
    pg.evaluate(f"{sr}.querySelector('#histClear').click()"); ok('first click only arms', len(json.loads(pg.evaluate("localStorage.getItem('gcodex_hist')")))>0)
    pg.evaluate(f"{sr}.querySelector('#histClear').click()"); ok('second click clears', len(json.loads(pg.evaluate("localStorage.getItem('gcodex_hist')")))==0)
    cx=pg.evaluate("window.__cx"); ok('0 dispatches/commits from Codex', not cx, str(cx[:5]))
    ok('no page errors', not errs, str(errs[:3]))
    b.close()
print(sum(c for _,c in R),'/',len(R))
