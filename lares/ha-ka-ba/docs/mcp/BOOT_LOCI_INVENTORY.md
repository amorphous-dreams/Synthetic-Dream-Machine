# Boot Loci Inventory — Lararium MCP

Status date: **April 23, 2026**
Source of truth: `lares/AGENTS.md` `#iam.required-core` + disk verification.

Deliverable for: `MCP-TASK-001`

---

## Required-core closure

The boot closure begins at `lar:///AGENTS`.
`AGENTS` names its `required-core` explicitly.
Every locus below must resolve and hydrate before the threshold yields.

| URI | File path | Role | Hydration socket |
|---|---|---|---|
| `lar:///AGENTS` | `lares/AGENTS.md` | threshold constitution, operator-agent alignment membrane, boot router | entry |
| `lar:///ha.ka.ba/api/v0.1/pono/e-prime` | `lares/ha-ka-ba/api/v0.1/pono/e-prime.md` | E-Prime grammar preload | `AGENTS#preload-e-prime` |
| `lar:///ha.ka.ba/api/v0.1/pono/ooda-ha` | `lares/ha-ka-ba/api/v0.1/pono/ooda-ha.md` | OODA-HA orientation preload | `AGENTS#preload-ooda-ha` |
| `lar:///ha.ka.ba/api/v0.1/pono/lar-uri` | `lares/ha-ka-ba/api/v0.1/pono/lar-uri.md` | lar-uri address law preload | `AGENTS#preload-lar-uri` |
| `lar:///ha.ka.ba/api/v0.1/mu` | `lares/ha-ka-ba/api/v0.1/mu.md` | Mu root | `AGENTS#threshold-to-mu` |
| `lar:///ha.ka.ba/api/v0.1/mu/chao` | `lares/ha-ka-ba/api/v0.1/mu/chao.md` | Mu child: chao | Mu internal hydration |
| `lar:///ha.ka.ba/api/v0.1/mu/the-four-tools` | `lares/ha-ka-ba/api/v0.1/mu/the-four-tools.md` | Mu child: the four tools | Mu internal hydration |
| `lar:///ha.ka.ba/api/v0.1/mu/the-law-of-5s` | `lares/ha-ka-ba/api/v0.1/mu/the-law-of-5s.md` | Mu child: the law of 5s | Mu internal hydration |
| `lar:///ha.ka.ba/api/v0.1/mu/the-syad-perspectives` | `lares/ha-ka-ba/api/v0.1/mu/the-syad-perspectives.md` | Mu child: syad perspectives | Mu internal hydration |
| `lar:///ha.ka.ba/api/v0.1/lararium` | `lares/ha-ka-ba/api/v0.1/lararium.md` | Lararium root | `AGENTS#threshold-to-lararium` |
| `lar:///ha.ka.ba/api/v0.1/lararium/hud` | `lares/ha-ka-ba/api/v0.1/lararium/hud.md` | Lararium child: HUD | Lararium internal hydration |
| `lar:///ha.ka.ba/api/v0.1/lararium/voices` | `lares/ha-ka-ba/api/v0.1/lararium/voices.md` | Lararium child: voices | Lararium internal hydration |
| `lar:///ha.ka.ba/api/v0.1/lararium/continuity` | `lares/ha-ka-ba/api/v0.1/lararium/continuity.md` | Lararium child: continuity | Lararium internal hydration |
| `lar:///LARES` | `lares/LARES.md` | session configuration surface, dial room | `AGENTS#continue-to-lares` |

All 14 loci verified present on disk as of status date.

---

## Hydration sockets — AGENTS entry sequence

1. `AGENTS#preload-e-prime` → resolves e-prime, then continues to `AGENTS#after-e-prime-preload`
2. `AGENTS#preload-ooda-ha` → resolves ooda-ha, then continues to `AGENTS#after-ooda-ha-preload`
3. `AGENTS#preload-lar-uri` → resolves lar-uri, then continues to `AGENTS#after-lar-uri-preload`
4. `AGENTS#threshold-to-mu` → hands off to Mu; Mu hydrates its own declared core then yields
5. `AGENTS#threshold-to-lararium` → hands off to Lararium; Lararium hydrates its own declared core then yields
6. `AGENTS#continue-to-lares` → forwards to LARES, which holds session configuration

---

## Mu child hydration sockets

Mu hydrates its declared core before yielding.
Current Mu children named in `AGENTS#iam.required-core`:

- `mu/chao`
- `mu/the-four-tools`
- `mu/the-law-of-5s`
- `mu/the-syad-perspectives`

The Mu source (`lares/ha-ka-ba/api/v0.1/mu.md`) is the authoritative source for its own internal hydration order.

---

## Lararium child hydration sockets

Lararium hydrates its declared core before yielding.
Current Lararium children named in `AGENTS#iam.required-core`:

- `lararium/hud`
- `lararium/voices`
- `lararium/continuity`

The Lararium source (`lares/ha-ka-ba/api/v0.1/lararium.md`) is the authoritative source for its own internal hydration order.

---

## Submodule attachment loci

Submodules contribute named lanes to the MCP adapter layer; they do not enter the boot required-core.
See `SUBMODULE_INTEGRATION_MATRIX.md` for the full attachment map.

---

## Residue

- Pranala family-to-graph-plane alignment table lives in `EDGE_TAXONOMY.md`.
- Edge class detail for each boot-critical locus is a compiler-planning concern; the inventory stays flat.
- Additional loci reachable beyond required-core (guest-grammar, grammars, masks, pono children) are SPRINT-01 closure-compiler territory.
