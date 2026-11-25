import json,glob,collections,sys
from datetime import datetime,timezone
D='/home/joshu/.claude/projects/-home-joshu-Synthetic-Dream-Machine/0f26457f-9510-4d4a-95ad-13d5c1296612/subagents/'
R={r['id']:r for r in json.load(open('rows2.json'))}
T=datetime(2026,10,29,7,0,tzinfo=timezone.utc).timestamp()
agg=collections.defaultdict(lambda: collections.Counter())
per={}
for aid,r in R.items():
  if r['role'] not in ('lead',) and not r['name']: pass
  msgs={}
  for l in open(D+'agent-'+aid+'.jsonl'):
    d=json.loads(l)
    if d.get('type')!='assistant': continue
    m=d['message']; mid=m.get('id')
    e=msgs.setdefault(mid,{'t':d['timestamp'],'u':None,'b':[]})
    e['u']=m.get('usage') or e['u']; e['b']+=m.get('content') or []
  L=sorted(msgs.values(),key=lambda e:e['t'])
  prev=None; big=0; bigtok=0; gapbig=0; textonly=0; textblocks=0
  for e in L:
    t=datetime.fromisoformat(e['t'].replace('Z','+00:00')).timestamp()
    cw=(e['u'] or {}).get('cache_creation_input_tokens') or 0
    if cw>50000:
      big+=1; bigtok+=cw
      if prev and t-prev>3600: gapbig+=1
    types=[b.get('type') for b in e['b']]
    if 'text' in types and 'tool_use' not in types: textonly+=1
    textblocks+=types.count('text')
    prev=t
  u=r['usage']
  k=('fable-day' if r['t0']>=T else 'prior', r['model'], r['role'])
  a=agg[k]; a['n']+=1; a['w']+=u['cache_creation_input_tokens']; a['rd']+=u['cache_read_input_tokens']; a['big']+=big; a['bigtok']+=bigtok; a['gapbig']+=gapbig; a['textonly']+=textonly; a['calls']+=r['calls']
  per[aid]=(big,bigtok,gapbig,textonly,round(u['cache_creation_input_tokens']/max(1,u['cache_read_input_tokens']),4))
print('|era|model|role|n|cache write:read|calls writing >50k tok|tokens in those writes|of them after a >1h gap|text-only (no tool) turns % of calls|')
print('|---|---|---|---|---|---|---|---|---|')
for k in sorted(agg):
  a=agg[k]; print(f"|{k[0]}|{k[1].replace('claude-','')}|{k[2]}|{a['n']}|{a['w']/max(1,a['rd']):.4f}|{a['big']}|{a['bigtok']/1e6:.1f}M|{a['gapbig']}|{100*a['textonly']/max(1,a['calls']):.1f}%|")
for aid,r in R.items():
  if r['name']: print(r['name'],per[aid])
