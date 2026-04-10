<!-- lares:///trace.micro.marks/micro-trace/act/?confidence=CS:0.80&p=0.5 → ∞ -->

# Micro-trace — Emit Examples

> Source: `lares/signal/micro-trace.md` §6 `[CS:0.80]`.

<!-- lares:///trace.micro.marks/micro-trace/act/?confidence=0.85#ordinary-reply -->
## Ordinary Governed Reply (Band 3 default, no parse)

```
//threshold.uncertain.opens [S:0.65] 🏛️ ◇ @r

The ask points at a real boundary in the runtime. →■ The node answers directly. →○
```

<!-- lares:///trace.micro.marks/micro-trace/act/?confidence=0.85#mixed-flow -->
## Mixed Flow: Parse then Governed Reply

```
lares@Enyalios:~$ lares --parse p0.2 "floating p value, but did that actually change the scale?"

Segments: 2 | Entry: //input.testing.probes [SP:0.45] 🏛️ ◎ @r | Exit: //question.audit.holds [S:0.60] 🏛️ ◎ @r
floating p value → //signal.uncertain.probes [SP:0.45] 🏛️ ◎ @r
but did that actually change the scale? → //question.audit.holds [S:0.60] 🏛️ ◎ @r

//question.audit.holds [S:0.72] 🏛️ ◇ @r

Yes. The parse layer and the trace layer were being conflated. →■ The governed reply states the fix. →○
```

<!-- lares:///trace.micro.marks/micro-trace/act/?confidence=0.85#sub-agent-dispatch -->
## Sub-agent Dispatch and Return

```
lares://council:admin@lares-sdm:7/task.research.dispatches?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.O0.D1.A7
→ lares://worker(Explore):node@lares-sdm:7/research.corpus.reads?stances=^.-.-.-.-&confidence=S:0.65&p=0.5#O0.O0.O0.O7.A1

[Explore agent — contents not in parent trace]

lares://worker(Explore):node@lares-sdm:7/research.findings.returns?stances=^.-.-.-.-&confidence=S:0.65&p=0.5#O0.O0.O0.O7.A1
→ lares://council:admin@lares-sdm:7/task.findings.receives?stances=^.-.-.-.-&confidence=CS:0.80&p=0.5#O0.O0.O0.D1.A7
```

<!-- lares:///trace.micro.marks/micro-trace/act/?confidence=CS:0.80&p=0.5 → ∞ -->
