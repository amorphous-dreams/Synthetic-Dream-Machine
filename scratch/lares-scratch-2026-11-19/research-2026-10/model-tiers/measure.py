import json, glob, os, sys, re, collections
from datetime import datetime
D = '/home/joshu/.claude/projects/-home-joshu-Synthetic-Dream-Machine/0f26457f-9510-4d4a-95ad-13d5c1296612/subagents/'
OUT = sys.argv[1]

def ts(s):
    try: return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
    except Exception: return None

rows = []
for f in sorted(glob.glob(D + 'agent-*.jsonl')):
    aid = os.path.basename(f)[6:-6]
    meta = {}
    mp = D + 'agent-' + aid + '.meta.json'
    if os.path.exists(mp):
        try: meta = json.load(open(mp))
        except Exception: pass
    msgs = collections.OrderedDict()  # id -> {usage, model, blocks}
    first_user = None
    times = []
    tool_errors = 0; tool_results = 0
    sendmsg_in = 0
    user_turns = 0
    for l in open(f):
        try: d = json.loads(l)
        except Exception: continue
        t = ts(d.get('timestamp', '')) if d.get('timestamp') else None
        if t: times.append(t)
        if d.get('type') == 'user':
            m = d.get('message', {})
            c = m.get('content')
            if first_user is None and not d.get('isMeta'):
                if isinstance(c, str): first_user = c
                elif isinstance(c, list):
                    for b in c:
                        if b.get('type') == 'text': first_user = b.get('text'); break
            if isinstance(c, list):
                for b in c:
                    if b.get('type') == 'tool_result':
                        tool_results += 1
                        if b.get('is_error'): tool_errors += 1
                    elif b.get('type') == 'text' and first_user is not None and not d.get('isMeta'):
                        user_turns += 1
            elif isinstance(c, str) and first_user is not None and c is not first_user:
                user_turns += 1
        elif d.get('type') == 'assistant':
            m = d['message']; mid = m.get('id') or d.get('uuid')
            e = msgs.setdefault(mid, {'blocks': [], 'usage': None, 'model': None, 't': t})
            e['usage'] = m.get('usage') or e['usage']
            e['model'] = m.get('model') or e['model']
            e['blocks'].extend(m.get('content') or [])
    models = collections.Counter(e['model'] for e in msgs.values())
    u = collections.Counter()
    for e in msgs.values():
        us = e['usage'] or {}
        for k in ('input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'):
            u[k] += us.get(k) or 0
        cc = us.get('cache_creation') or {}
        u['w5m'] += cc.get('ephemeral_5m_input_tokens') or 0
        u['w1h'] += cc.get('ephemeral_1h_input_tokens') or 0
    tools = collections.Counter(); text_chars = 0; think_chars = 0; tool_chars = 0
    think_blocks = 0; think_empty = 0
    narr_chars = 0; narr_blocks = 0; commits = 0; edits_files = set(); writes_files = set()
    bash_writes = 0; agents = []
    seq = []  # per message: has_text, has_tool
    for e in msgs.values():
        ht = False; htool = False; tchars = 0
        for b in e['blocks']:
            ty = b.get('type')
            if ty == 'text':
                n = len(b.get('text') or ''); text_chars += n; tchars += n; ht = ht or n > 0
            elif ty == 'thinking':
                think_blocks += 1; n = len(b.get('thinking') or ''); think_chars += n
                if n == 0: think_empty += 1
            elif ty == 'redacted_thinking':
                think_blocks += 1; think_empty += 1
            elif ty == 'tool_use':
                htool = True
                name = b.get('name'); tools[name] += 1
                inp = b.get('input') or {}
                tool_chars += len(json.dumps(inp))
                if name == 'Bash':
                    cmd = inp.get('command', '')
                    if re.search(r'git\b[^|;&]*\bcommit\b', cmd): commits += 1
                    if re.search(r"(cat|tee)\s+[^|]*>\s*\S|<<\s*'?EOF", cmd) and '>' in cmd: bash_writes += 1
                elif name == 'Edit' or name == 'MultiEdit':
                    edits_files.add(inp.get('file_path'))
                elif name == 'Write':
                    writes_files.add(inp.get('file_path'))
                elif name == 'Agent' or name == 'Task':
                    agents.append(inp.get('model') or inp.get('subagent_type'))
        seq.append((ht, htool, tchars))
    # hand-back = text of last message(s) without tool use, or SubagentHandback input
    handback = ''
    last_assist = list(msgs.values())
    for e in reversed(last_assist):
        for b in e['blocks']:
            if b.get('type') == 'tool_use' and b.get('name') == 'SubagentHandback':
                handback = (b.get('input') or {}).get('message', ''); break
        if handback: break
    if not handback:
        for e in reversed(last_assist):
            txt = ''.join(b.get('text', '') for b in e['blocks'] if b.get('type') == 'text')
            if txt.strip(): handback = txt; break
    # narration: text in all messages except the final hand-back message
    hb_idx = None
    for i in range(len(seq) - 1, -1, -1):
        if seq[i][0] or seq[i][1]:
            hb_idx = i; break
    for i, (ht, htool, tc) in enumerate(seq):
        if i == hb_idx and not htool: continue
        if ht: narr_blocks += 1; narr_chars += tc
    narr_chars_adj = narr_chars
    if tools.get('SubagentHandback'):
        pass  # handback text lives in tool input; narr_chars counts only text blocks
    times.sort()
    gaps = [b - a for a, b in zip(times, times[1:])]
    idle5 = sum(1 for g in gaps if g > 300)
    idle_sec = sum(g for g in gaps if g > 300)
    rows.append(dict(
        id=aid, desc=meta.get('description'), meta_model=meta.get('model'), agentType=meta.get('agentType'),
        parent=meta.get('parentAgentId'), stopped=meta.get('stoppedByUser'), finished=meta.get('finished'),
        models=dict(models), calls=len(msgs), usage=dict(u), tools=dict(tools),
        text_chars=text_chars, think_chars=think_chars, think_blocks=think_blocks, think_empty=think_empty,
        tool_chars=tool_chars, narr_chars=narr_chars, narr_blocks=narr_blocks,
        handback_words=len(handback.split()), handback_head=handback[:200],
        commits=commits, edit_files=len(edits_files), write_files=len(writes_files), bash_writes=bash_writes,
        agents=agents, tool_results=tool_results, tool_errors=tool_errors, user_turns=user_turns,
        t0=times[0] if times else None, t1=times[-1] if times else None, idle5=idle5, idle_sec=idle_sec,
        first_user=(first_user or '')[:1500]))
json.dump(rows, open(OUT, 'w'))
print(len(rows))
