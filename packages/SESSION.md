# Session State — Lararium Web3 Refactor

> Updated: 2026-05-05
> Branch: feature/lararium-node-3
> Purpose: Resume artifact — enough state to continue without prior chat context

---

## Bootstrap Paste

```text
Resume from /home/joshu/Synthetic-Dream-Machine/SESSION.md.
Branch: feature/lararium-node-3.
Active sprint: S5 — quine round-trip verification, .tw5.js CJS integration, genesis CID self-ref tiddler.
Architecture laws in memory: feedback_architecture_principles.md.
Do not re-decide the five architecture laws or the BOOTSTRAP_SCANS / Path α grammar decision.
Sprints 0–4 complete. Social tiga renamed Groups→Circles. Packaging model: CJS (not IIFE). Kowloon bridge question open — see ROADMAP.md § S8.
Research docs: packages/lares/lararium-research/PROTOCOL-STACK-IDENTITY-CIRCLES-SESSIONS.md
```

---

## What Just Happened (S0–S4 + Protocol Design Complete)

### S4 Complete — Peer Factory Rewrites

- `openNodeLarPeer` rewritten: uses `loadGenesisIsland()`, removes `seedLarariumDoc` disk-walk body
- `lararium-island.ts` deleted entirely (605 → 0 lines)
- All satellite doc seeders moved to `genesis-island.ts`
- `reconcileWellKnownTiddlers` + 4 satellite seeders (`seedLaresDoc`, `seedIdentitiesDoc`, `seedCirclesDoc`, `seedSessionsDoc`) now in `genesis-island.ts`

### Protocol Stack Design Session (same day)

**Social tiga renamed:** `GroupsDoc` / `GROUPS_DOC_URI` / `@groups` → `CirclesDoc` / `CIRCLES_DOC_URI` / `@circles` everywhere (source, dist stubs, memes, research docs).

**Kowloon Circles seeded:**
- `CircleTiddler` now has `kind: "Circle" | "System"`, `addressingScope`, full Kowloon JSDoc
- `seedCirclesDoc()` auto-seeds 5 system circles (Following, All Following, Circles, Blocked, Muted)
- Reference meme: `packages/lares/memes/api/v0.1/pono/circles-kowloon.md`

**Protocol stack research docs:**
- `packages/lares/lararium-research/PROTOCOL-STACK-IDENTITY-CIRCLES-SESSIONS.md` — full 7-research-thread synthesis; 6-doc model; Keyhive + UCAN + ERA + Seitan + Kowloon inversion

**Packaging model fixed:**
- All IIFE references replaced with CJS across all source TS files, vite configs, and meme `.md` files (32 files)
- `.tw5.js` CJS outputs already exist in `dist-widgets/`; format was always CJS — only labels were stale

**EPIC updated:** `packages/CURRENT-EPIC.md` reflects S0–S4 complete, S5 active, S6–S7 designed.

---

## Open Question: Kowloon Bridge (S8 design)

We want `elyncia.app` to serve a Kowloon node (ActivityPub, Node.js + MongoDB) alongside the Lares web3 stack. DreamDeck users draft and publish Kowloon posts from within the local-first app.

**The tension:** Kowloon = server-authoritative (ActivityPub actor lives on server). Lares = keypair-authoritative (DID/UCAN). These must coexist without one undermining the other.

**Three bridge options under consideration** (research pending):
- **A)** `SessionsDoc` (social tiga ba) replaced by a `KowloonDoc` — Automerge mirror of user's Kowloon outbox/drafts/circles. Social tiga ba slot becomes the Kowloon bridge.
- **B)** `SessionsDoc` stays ba; `KowloonDoc` is a 4th satellite doc outside the social tiga.
- **C)** No Automerge doc for Kowloon — DreamDeck uses a lightweight HTTP adapter; Automerge stack stays pure.

Research results expected in: `packages/lares/lararium-research/KOWLOON-BRIDGE.md` (to be created on research return).

---

## Four-Layer Stack

```
elyncia.app               — public domain; reverse proxy (web2 Kowloon ↔ web3 Lares)
  ├── DreamDeck           — first app on DreamNet; memetic-wikitext wiki; mobile Lares node
  │     ├── Lares         — Agent alignment + HUD; personal workspace (MemeStoreDoc)
  │     └── Lararium      — "where the lares lives"; isomorphic identity + TW5/Automerge quine
  └── Kowloon Node        — web2 ActivityPub gateway; Node.js + MongoDB; @user@elyncia.app
```

DreamDeck is the first *application* built on Lares + Lararium — not the architecture itself. Other node types on the DreamNet are possible.

## Three-Tiga Doc Model

### Content Tiga (genesis-artifact-authoritative)

| Slot | Doc | URI |
|---|---|---|
| ha | `LarariumDoc` | `lar:///ha.ka.ba/@lararium` |
| ka | `CatalogDoc` | `lar:///ha.ka.ba/@catalog` |
| ba | `MemeStoreDoc` | `lar:///ha.ka.ba/@lares` |

### Local Social Tiga (keypair-authoritative, never federates)

| Slot | Doc | URI |
|---|---|---|
| ha | `IdentitiesDoc` | `lar:///ha.ka.ba/@identities` |
| ka | `CirclesDoc` | `lar:///ha.ka.ba/@circles` |
| ba | `SessionsDoc` | `lar:///ha.ka.ba/@sessions` |

Dynamic children: `SessionEventLog` (one per session, AutomergeUrl in session tiddler).
Ephemeral channel: `docHandle.broadcast()` for presence — not a doc.

### Federated Social Tiga (server-authoritative at publish boundary, S8)

| Slot | Doc | Role |
|---|---|---|
| ha | `KowloonProfile` (outbox) | Your authorial voice going out — drafts → published activities |
| ka | `KowloonFeed` (inbox) | Collective signal coming in — discovery, followed servers |
| ba | `KowloonActivity` (notifications) | Live state — mentions, replies, pending invites |

The publish step is a deliberate authority handoff: user keypair authorizes the draft; server keypair signs the federation activity. These are sequential, not concurrent. The local social tiga is unaffected.

---

## Five Architecture Laws (Do Not Re-Derive)

1. **Web2 smell test** — if it smells like web2, throw it aside and redesign from web3 local-first principles
2. **TW5 vm primacy** — if it CAN happen in the TW5 vm pool, it MUST happen there
3. **TS files as TW5 plugin projections** — vite translates TS to TW5 plugin; keep TS to design JS tiddlers
4. **Tiddler format law** — all data as `{ title, text, fields, bag, authority }`
5. **Meme files as tiddler-package projections** — `*.md` = projection of parent+fragment tiddlers; deserialize in vm; write via `renderTiddler`

---

## BOOTSTRAP_SCANS Decision (Grammar Invariant 2)

- Path α: raw carrier text functions as the deliberate exception to Law 5
- BOOTSTRAP_SCANS = codec layer (not web2); Grammar Invariant 1
- Path β (store grammar as fragment tiddlers) rejected: tightens the bootstrap circle

---

## Do Not Re-Decide

- Five architecture laws (above)
- Path α for grammar bootstrap
- `catalog-url` as named codec-layer exception (not web2)
- Vendored plugins optional via `RecipeTiddler.plugins`; no default recipe auto-loads them
- CJS format (not IIFE) for TW5 plugin modules — `exports` object provided by TW5's CJS wrapper
- `Groups` → `Circles` rename complete and settled; `GroupsDoc` is now `CirclesDoc` everywhere
- Adding to a circle IS the follow (Kowloon model); circle membership never federates

---

## Open Work, In Order

| # | Item | Sprint | Status |
|---|---|---|---|
| 1 | `grammar-invariants.ts` Invariant 3 | S1 | ✅ Done |
| 2 | `system-invariants.ts` constitutional declaration | S1 | ✅ Done |
| 3 | `build-genesis-island.ts` — build-time genesis builder | S2 | ✅ Done |
| 4 | `loadGenesisIsland()` runtime function | S3 | ✅ Done |
| 5 | Rewrite `openNodeLarPeer` to use genesis artifact | S4 | ✅ Done |
| 6 | Wire `.tw5.js` CJS outputs into genesis; quine round-trip | S5 | 🔴 Active |
| 7 | `SessionEventLog` per-session append-only doc | S6 | ⬜ Designed |
| 8 | Circles + Identities capability layer (Keyhive/UCAN) | S7 | ⬜ Designed |
| 9 | Kowloon bridge — `KowloonDoc` or HTTP adapter | S8 | ⬜ Research pending |

---

## Likely Next Files To Touch (S5)

- `packages/lararium-node/scripts/build-genesis-island.ts` — wire `.tw5.js` CJS blobs into genesis
- `packages/lararium-tw5/scripts/write-tiddler-memes.ts` — verify CJS splicing pipeline
- `packages/lararium-core/src/system-invariants.ts` — complete quine invariant stub
- `pnpm test:quine` script — new file, boot vm + render + hash check
