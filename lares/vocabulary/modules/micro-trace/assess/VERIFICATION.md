<!-- ∞ → lares:///trace.micro.marks/micro-trace/assess/?confidence=CS:0.80&p=0.5 -->

# Micro-trace — Verification

<!-- → ? -->
<!-- ∞ → lares:///trace.micro.marks/micro-trace/assess/?confidence=0.80#well-formedness -->
## Well-formedness Checklist

For any governed response, verify:

- [ ] 1. Phase transitions emitted **at** the transition point, not predicted in advance
- [ ] 2. Stance shift markers fire only on **genuine** local stance shift (not echo of header)
- [ ] 3. At default `p0.5` (Band 3), only `→◇` `→■` `→○` appear inline — not `→✶` or `→◎`
- [ ] 4. Sub-agent dispatch **and** return each carry a full URI → URI pair
- [ ] 5. Todo state transitions do not appear inline (debug-only)
- [ ] 6. Parse layer and micro-trace layer do not substitute for each other

<!-- → ? -->
<!-- ∞ → lares:///trace.micro.marks/micro-trace/assess/?confidence=0.80#common-errors -->
## Common Errors

| Error | Description | Fix |
|---|---|---|
| Predictive trace | Emitting `→◇` before the decision is made | Emit at transition, not in advance |
| Echo stance | `→🏛️` fired when header already declared 🏛️ | Only fire on genuine local shift |
| Band bleed | `→◎` emitted at default p0.5 | Band 3 does not include Orient; raise p or use `--verbose` |
| Missing return pair | Sub-agent returns without URI pair | Every sub-agent boundary requires dispatch + return URI pair |
| Inline todo | Todo state change emitted inline | Move to debug log only |

<!-- → ? -->
<!-- ∞ → lares:///trace.micro.marks/micro-trace/assess/?confidence=0.80#promotion-criteria -->
## Promotion Criteria

`lares/signal/micro-trace.md` is currently `[CS:0.80]`. For promotion to `[C:0.95]`:

- [ ] Density band behavior validated across at least 10 real exchanges
- [ ] Sub-agent URI pair format validated in at least 3 real sub-agent dispatches
- [ ] Layer split rule validated: parse + trace coexist without substitution in at least 5 exchanges
- [ ] `lares/signal/micro-trace.md` promoted to `C:0.95` ☐

<!-- → ? -->
