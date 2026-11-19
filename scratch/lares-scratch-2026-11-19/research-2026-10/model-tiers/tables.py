import json,collections,statistics as st
from datetime import datetime,timezone
R=json.load(open('rows2.json'))
T=datetime(2026,10,29,7,0,tzinfo=timezone.utc).timestamp()
def m(r): return (r['model'] or '').replace('claude-','')
def tot(r): return sum(r['cost'].values()) if r['cost'] else 0
for r in R: r['era']='fable-day' if r['t0']>=T else 'prior'
g=collections.defaultdict(list)
for r in R: g[(r['era'],m(r),r['role'])].append(r)
out=[]
P=lambda *a: out.append(' '.join(str(x) for x in a))
P('|era|model|role|n|API calls|tool calls|tools/call|out tok|visible-out est tok|hidden-think est %|narr chars/tool call|hand-back words (median)|Edit files|Write files|git commit cmds|tool errors %|idle>5m h|API-eq $|$/agent|cache-read % of $|cache-write % of $|output % of $|')
P('|'+'---|'*22)
for k in sorted(g):
  L=g[k]; s=lambda f: sum(f(r) for r in L)
  outt=s(lambda r:r['usage']['output_tokens']); vis=s(lambda r:(r['text_chars']+r['tool_chars']+r['think_chars']))/4
  c=collections.Counter()
  for r in L:
    for kk,v in (r['cost'] or {}).items(): c[kk]+=v
  ct=sum(c.values()) or 1
  tools=s(lambda r:r['ntools'])
  P('|'+'|'.join(str(x) for x in [k[0],k[1],k[2],len(L),s(lambda r:r['calls']),tools,round(tools/max(1,s(lambda r:r['calls'])),2),outt,int(vis),round(100*max(0,outt-vis)/max(1,outt)),round(s(lambda r:r['narr_chars'])/max(1,tools),1),st.median([r['handback_words'] for r in L]),s(lambda r:r['edit_files']),s(lambda r:r['write_files']),s(lambda r:r['commits']),round(100*s(lambda r:r['tool_errors'])/max(1,s(lambda r:r['tool_results'])),1),round(s(lambda r:r['idle_sec'])/3600,1),round(ct),round(ct/len(L),1),round(100*c['hit']/ct),round(100*(c['w5m']+c['w1h'])/ct),round(100*c['out']/ct)])+'|')
# tool mix
P('\n|era|model|role|'+'|'.join(['Bash','Read','Edit','Write','Grep','Glob','Agent','SendMessage','WebSearch','WebFetch','SubagentHandback','other'])+'|')
P('|'+'---|'*15)
for k in sorted(g):
  L=g[k]; c=collections.Counter()
  for r in L: c.update(r['tools'])
  t=sum(c.values()) or 1
  named=['Bash','Read','Edit','Write','Grep','Glob','Agent','SendMessage','WebSearch','WebFetch','SubagentHandback']
  oth=t-sum(c[n] for n in named)
  P('|'+'|'.join([k[0],k[1],k[2]]+[f"{round(100*c[n]/t)}%" for n in named]+[f"{round(100*oth/t)}%"])+'|')
# named leads
P('\n|agent|id|model|role|start UTC|wall h|API calls|tool calls|out tok|hidden-think est %|Edit/Write files|git commit cmds|w5m write tok|w1h write tok|cache read tok|API-eq $|hand-back words|')
P('|'+'---|'*17)
for r in sorted(R,key=lambda r:r['t0']):
  if r['name'] or (r['role']=='lead' and r['era']=='fable-day'):
    u=r['usage']; vis=(r['text_chars']+r['tool_chars']+r['think_chars'])/4
    P('|'+'|'.join(str(x) for x in [r['name'] or r['desc'][:30],r['id'][:9],m(r),r['role'],datetime.fromtimestamp(r['t0'],timezone.utc).strftime('%m-%d %H:%M'),round((r['t1']-r['t0'])/3600,1),r['calls'],r['ntools'],u['output_tokens'],round(100*max(0,u['output_tokens']-vis)/max(1,u['output_tokens'])),f"{r['edit_files']}/{r['write_files']}",r['commits'],u.get('w5m',0),u.get('w1h',0),u['cache_read_input_tokens'],round(tot(r),1),r['handback_words']])+'|')
open('tables.md','w').write('\n'.join(out))
