<!-- ∞ → lares:///grammar.root.maps/grammar/?confidence=CS:0.80&p=0.5 -->

# Lares Grammar

The root primitives of the system. Grammar modules define **how the system thinks** — the OODA-A phases, the addressing system, the transclusion model, the confidence bands. Content modules (in `lares/modules/`) define **what the system thinks about** — URI specs, talk-story protocol, micro-trace marks, sigilization rules.

Grammar loads first. Always. It is the compositional language that content modules are written in.

---

<!-- ahu lares:///grammar.root.maps/grammar/?confidence=CS:0.85#ooda-a -->

## OODA-A Phase Grammar

The five-season attention loop. Every substantive exchange runs inside this cycle.

| Phase | Glyph | Grammar | Confidence | One-line |
|---|---|---|---|---|
| Observe | `✶` | [observe/LOCI.md](observe/LOCI.md) | `[CS:0.85]` | What is here? Gather without analysis. |
| Orient | `◎` | [orient/LOCI.md](orient/LOCI.md) | `[CS:0.85]` | What does this mean? Talk Story lives here. |
| Decide | `◇` | [decide/LOCI.md](decide/LOCI.md) | `[CS:0.85]` | What do we do? Scope locks. Operator confirms. |
| Act | `■` | [act/LOCI.md](act/LOCI.md) | `[CS:0.85]` | Build what was decided. Nothing more. |
| Assess | `○` | [assess/LOCI.md](assess/LOCI.md) | `[CS:0.85]` | Did it work? Close the loop or feed back. |

---

<!-- ahu lares:///grammar.root.maps/grammar/?confidence=CS:0.80#addressing -->

## Addressing + Transclusion Grammar

How content is addressed, referenced, and included.

| Primitive | Grammar | Confidence | One-line |
|---|---|---|---|
| Transclusion | [transclusion/LOCI.md](transclusion/LOCI.md) | `[CS:0.80]` | Locus, ahu, kahea, lares — the four markers. Self-booting. |
| URI Syntax | [uri/LOCI.md](uri/LOCI.md) | `[SP:0.45]` | The `lares:` scheme. RFC 3986 record form. Stub → uri-schema. |
| HA.KA.BA | [hakaba/LOCI.md](hakaba/LOCI.md) | `[SP:0.45]` | Three-slot semantic addressing. Stub → uri-schema. |
| Exchange | [exchange/LOCI.md](exchange/LOCI.md) | `[SP:0.45]` | Five-step mandatory exchange flow. Stub → uri-schema. |

---

<!-- ahu lares:///grammar.root.maps/grammar/?confidence=CS:0.80#signal -->

## Signal Grammar

How state is encoded and communicated.

| Primitive | Grammar | Confidence | One-line |
|---|---|---|---|
| Chronometer | [chronometer/LOCI.md](chronometer/LOCI.md) | `[SP:0.45]` | FFZ scales + phase counters. Stub → uri-schema + FFZ research. |
| Stance | [stance/LOCI.md](stance/LOCI.md) | `[SP:0.45]` | Five stances + Syadasti Reading Rule. Stub → Syadasti discovery. |
| Confidence | [confidence/LOCI.md](confidence/LOCI.md) | `[SP:0.45]` | Register bands C→P. Stance-dependent. Stub → AGENTS.md. |

---

<!-- ahu lares:///grammar.root.maps/grammar/?confidence=CS:0.80#load-order -->

## Load Order

```
1. grammar/LOCI.md          ← THIS FILE (registry, always first)
2. grammar/observe/          ← How to gather
3. grammar/orient/           ← How to sense-make (Talk Story)
4. grammar/decide/           ← How to commit
5. grammar/act/              ← How to execute
6. grammar/assess/           ← How to close the loop
7. grammar/transclusion/     ← How content addresses and includes
8. grammar/{uri,hakaba,...}  ← Signal primitives (on demand)
```

Grammar before content. Phases before signal. The agent learns how to think before it learns what to think about.

---

## Loci Registry

| Path | Status | Contents |
|---|---|---|
| `LOCI.md` | `[CS:0.80]` | This file — grammar root registry |
| `observe/LOCI.md` | `[CS:0.85]` | ✶ Observe phase grammar |
| `orient/LOCI.md` | `[CS:0.85]` | ◎ Orient phase grammar |
| `decide/LOCI.md` | `[CS:0.85]` | ◇ Decide phase grammar |
| `act/LOCI.md` | `[CS:0.85]` | ■ Act phase grammar |
| `assess/LOCI.md` | `[CS:0.85]` | ○ Assess phase grammar |
| `transclusion/LOCI.md` | `[CS:0.80]` | Transclusion model + four markers |
| `uri/LOCI.md` | `[SP:0.45]` | URI syntax — stub |
| `hakaba/LOCI.md` | `[SP:0.45]` | HA.KA.BA addressing — stub |
| `exchange/LOCI.md` | `[SP:0.45]` | Exchange protocol — stub |
| `chronometer/LOCI.md` | `[SP:0.45]` | FFZ chronometer — stub |
| `stance/LOCI.md` | `[SP:0.45]` | Stances + Syadasti — stub |
| `confidence/LOCI.md` | `[SP:0.45]` | Register bands — stub |

---

<!-- → ? -->
