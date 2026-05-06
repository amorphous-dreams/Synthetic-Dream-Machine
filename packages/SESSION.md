# Session State — Lararium Web3 Refactor

> Updated: 2026-05-06
> Branch: feature/lararium-node-3
> Purpose: Resume artifact — enough state to continue without prior chat context

---

## Bootstrap Paste

```text
Resume from /home/joshu/Synthetic-Dream-Machine/SESSION.md.
Branch: feature/lararium-node-3.
Active sprint: S6 — SessionEventLog per-session append-only doc; broadcast() presence.
Architecture laws in memory: feedback_architecture_principles.md.
Do not re-decide the five architecture laws or the BOOTSTRAP_SCANS / Path α grammar decision.
Sprints 0–5 complete. Social tiga renamed Groups→Circles. Packaging model: CJS (not IIFE). Kowloon bridge design locked (Option B) — see ROADMAP.md § S8.
Grammar now lives at api/v0.1/pono/memetic-wikitext (not grammars/). grammars/ tree deleted.
Voice-house consolidated: lares/voices.md parents lares/masks/** (all masks moved from masks/).
lararium-app + lararium-tldraw + lararium-web DELETED. Replaced with: lararium-browser, dreamdeck-tldraw, dreamdeck-app (see ROADMAP.md § Package Reboot).
New package namespaces: @lararium/* = infra/protocol; @dreamdeck/* = first app stack on DreamNet.
Research: packages/lares/lararium-research/DREAMNET-FEDERATION-RESEARCH.md (2026-05-06).
Research docs: packages/lares/lararium-research/PROTOCOL-STACK-IDENTITY-CIRCLES-SESSIONS.md
```

---

## What Just Happened (2026-05-06 — Package Reboot + DreamNet Research)

### Package Reboot

- `lararium-app`, `lararium-tldraw`, `lararium-web` deleted — old web2-brained app packages removed entirely
- Stubbed three new blank package dirs: `lararium-browser`, `dreamdeck-tldraw`, `dreamdeck-app` (typo `dreakdeck-app` fixed)
- `packages/AGENTS.md` package map updated to new namespaces
- `lararium-node/package.json` — `@lararium/tldraw` dep dropped
- `lararium-node/scripts/source-memes.ts` — `lararium-app` source entries removed
- `lararium-tw5/memes/canvas/*.md` — `source-file` pointers updated to `dreamdeck-tldraw`
- All src file comments updated (`@lararium/app` → `@dreamdeck/app`, etc.)

**New namespace law:** `@lararium/*` = DreamNet infrastructure/protocol. `@dreamdeck/*` = first app stack on the Lares DreamNet, client UX layer.

### DreamNet Federation Research (four spirits)

Full findings in `packages/lares/lararium-research/DREAMNET-FEDERATION-RESEARCH.md`. Highlights:

- **Nexus = a namespace, not a server.** A Nexus functions as a named group of peers sharing a keypair-rooted identity. `lar://<nexus-pubkey>/<doc-id>` serves as the URI form. No DNS dependency.
- **Keyhive** (Ink & Switch, Brooklyn Zelenka) represents the exact auth substrate we need — convergent capabilities + Beelay E2EE sync co-designed with Automerge. Pre-alpha Rust, no TS yet. Design our capability surface to be Keyhive-compatible now via ucanto-style schemas.
- **Presence** = `DocHandle.broadcast()` + Yjs-awareness-style clock/slot per `(userId, deviceId)`. Never write presence into the Automerge doc. Session-local state never enters broadcast. Schema-level enforcement (tldraw three-tier model) provides the right pattern.
- **Invite token** = SSB-style: `sign_with_operator_key({ iss: nexus_did, cap: "join/nexus", exp, nonce })`. Offline-verifiable. No central registry. Chain of operators possible via UCAN proof chains later.
- **DreamDeck visual principles** (from V.U.E., Kinopio, Verse): spatial position carries semantic weight; canvas nodes act as `lar://` resource containers; edge types function as first-class; no shared mutable state (Verse model, not Blueprint); export to open formats.

### Settled Design Decisions (2026-05-06 talk-story)

**lar:// URI — three families, no grammar change:**
- `lar:///` (triple-slash, hostless) = system/content memes. Stable tagspace: `ha.ka.ba`. Unstable: what3words-style roots.
- `lar://alias:tier@host/` (hostful, existing) = active operators/agents on a machine (VS Code, MCP, etc.)
- NEW: `lar:///ha.ka.ba/@nexus/<nexus-pubkey>` = Nexus identity + registry doc. New `@nexus` scope in resolver. New kind: `"nexus-doc"`. No URI grammar change.

**Presence routing — three-layer:**
`@lararium/core` (PresenceSlot + FfzClock types) → `@lararium/tw5` (`$:/temp/presence/{peerId}` tiddlers, already blocked from sync) → `@lararium/browser` or `@lararium/node` (`DocHandle.broadcast()` wiring) → UX layer. `meme-sync-adaptor.ts:49` already guards `$:/temp/*`.

**FFZ Chronometer — `FfzClock` type to land in `@lararium/core` before S6 closes:**
5-level bounded hierarchical logical clock. L0–L3 bounded (looping/musical time); L4 epoch unbounded (anti-aliasing). `SessionEvent.clock` and `PresenceSlot.clock` both use `FfzClock`, not `number`.
Attention-scale register names now canonical: **Pulse** (L0) / **Beat** (L1) / **Measure** (L2, default band) / **Arc** (L3) / **Theme** (L4). These sit above domain aliases (sub-action/action/session/day/epoch for Lares; Action/Round/Turn/Watch/Week for FTLS/TTRPG). Canonical meme: `lar:///ha.ka.ba/@lares/api/v0.1/pono/attention-scale`.

**NexusRegistryDoc — new doc type, S9 work:**
`lar:///ha.ka.ba/@nexus/<pubkey>`. Fields: `nexusId`, `protocolVersion`, `capabilityFlags` (monotonic set), `allies`, `blocked`, `keyHistory`. Key rotation designed in from day one. Tombstoning eventual; blocked peers starved of capability tokens regardless.

**Nexus naming — three-layer petname model (no global registry):**
- Layer 1: `lar:///ha.ka.ba/@nexus/<pubkey>` — canonical, always
- Layer 2: `NexusRegistryDoc.displayName` — operator-signed self-assertion, not authoritative
- Layer 3: client-local petname map, user-controlled, overrides all
- Disambiguation: truncated pubkey suffix in UI (`DreamDeck [ab3f…]`)
- No ATProto DNS verification, no ENS — both add dependencies we don't need yet
- Keybase lesson: never put naming verification on third-party infrastructure

**FfzClock — CONFIRMED NOVEL, proceed as designed:**
- No prior art in distributed systems for bounded multi-level cyclic hierarchy with unbounded epoch guard
- Closest adjacent: ERA paper (arXiv:2601.22963) — cite if publishing externally
- FfzClock = application-layer rhythmic position. Automerge `<counter, actorID>` OpId = causal total order. COMPLEMENTARY, not substitutable.
- "Total actions taken" as L5: rejected — Automerge already has it, violates Law of Fives
- Beelay uses DAG + wall-clock replay guard only. No conflict. No need to wait on Beelay.
- FfzClock rides alongside Automerge OpId as application-layer annotation on tiddlers/changes

**PENTADIC invariants added to `system-invariants.md`:**
- `PENTA_1_BOUNDED_SCALE` — Law of Fives as structural invariant
- `PENTA_2_CLOCK_ALIGNMENT` — FfzClock L0–L4 maps onto OODA_HA_5
- `PENTA_3_PATTERN_INTEGRITY` — Fuller's FPIs and SYSTEM laws are same invariant in two registers
- `loulou` edge from system-invariants → pattern-integrity now wired

### Research files
- `DREAMNET-FEDERATION-RESEARCH.md` — federation topology, Keyhive, presence, invite-seeding, visual graph
- `NEXUS-REGISTRY-AND-FORK-RESILIENCE.md` — NexusRegistryDoc schema, hostile fork prior art
- `NEXUS-NAMING-PETNAMES.md` — three-layer petname model, Zooko's Triangle, prior art survey
- `FFZ-CHRONOMETER.md` — FfzClock type, deep research findings, novelty confirmed, Lares level mapping

---

## What Just Happened (S5 Complete + Meme Namespace Consolidation)

### S5 Complete — Quine Round-Trip Verification

- `.tw5.js` CJS plugin blobs wired into `build-genesis-island.ts`
- `test-quine.ts` passes: rendered grammar meme hash === source tiddler hash in genesis
- Genesis CID written as `$:/lararium/genesis-cid` self-ref tiddler
- `GEN_4_QUINE_PROPERTY` invariant declared proved in `system-invariants.ts`

### Meme Namespace Consolidation

**Grammar → pono merge (Option B):**
- `api/v0.1/grammars/memetic-wikitext.md` merged into `api/v0.1/pono/memetic-wikitext.md` (single source: law + grammar kernel)
- `api/v0.1/grammars/` tree deleted entirely
- `GRAMMAR_MEME_URI` and `GRAMMAR_GENESIS_REL_PATH` updated to `pono/memetic-wikitext`
- All 25 pono memes upgraded to `⊙` sigils (`<<~⊙&#x0001;` / `<<~⊙&#x0004;`)

**Namespace sigil table (settled):**

| Namespace | Open | Close |
|---|---|---|
| `pono/` | `<<~⊙&#x0001;` | `<<~⊙&#x0004;` |
| `mu/`, `lares/` | `<<~ॐ ँ&#x0001;` | `<<~ॐ ँ&#x0004;` |
| `docs/` | `<<~&#x0001;` | `<<~&#x0004;` |
| `kapu.md` | `<<~⊙&#x0011;` | `<<~⊙&#x0014;` (DC1/DC4 — intentional) |

**Misfile audit — five moves:**
1. `pono/circles-kowloon.md` → `docs/pono/circles-kowloon.md` (doc companion, not binding law)
2. `pono/pattern-integrity.md` → `mu/pattern-integrity.md` (cosmological, not protocol)
3. `docs/grammars/tiddlywiki-filter.md` → `docs/pono/tiddlywiki-filter.md` (docs/grammars/ deleted)
4. `pono/source-module.md` → `docs/lararium/source-module.md` (reference companion)
5. `masks/**` → `lares/masks/**` — voice-house consolidated under `lares/voices.md`

**Voice-house:**
- `lares/voices.md` now functions as the invariant parent of `lares/masks/`
- All mask files upgraded to `ॐ ँ` sigils; URIs updated to `api/v0.1/lares/masks/...`
- Three pending spec rooms: `docs/lares/voices/coordinators`, `/workers`, `/masks` (forward pointers, not yet created)

### Earlier (S0–S4)

- `openNodeLarPeer` rewritten: uses `loadGenesisIsland()`, removes `seedLarariumDoc` disk-walk
- `lararium-island.ts` deleted entirely (605 → 0 lines)
- Social tiga renamed Groups→Circles everywhere; `seedCirclesDoc()` seeds 5 system circles
- All IIFE references replaced with CJS (32 files); packaging model settled

---

## Open Question: Kowloon Bridge (S8 design)

We want `elyncia.app` to serve a Kowloon node (ActivityPub, Node.js + MongoDB) alongside the Lares web3 stack. DreamDeck users draft and publish Kowloon posts from within the local-first app.

**The tension:** Kowloon = server-authoritative (ActivityPub actor lives on server). Lares = keypair-authoritative (DID/UCAN). These must coexist without one undermining the other.

**Three bridge options under consideration** (research pending):
- **A)** `SessionsDoc` (social tiga ba) replaced by a `KowloonDoc` — Automerge mirror of user's Kowloon outbox/drafts/circles. Social tiga ba slot becomes the Kowloon bridge.
- **B)** `SessionsDoc` stays ba; `KowloonDoc` acts as a 4th satellite doc outside the social tiga.
- **C)** No Automerge doc for Kowloon — DreamDeck uses a lightweight HTTP adapter; Automerge stack stays pure.

Research results expected in: `packages/lares/lararium-research/KOWLOON-BRIDGE.md` (to be created on research return).

---

## Settled Terminology (2026-05-06)

| Term | Definition |
|---|---|
| **DreamNet** | The entire distributed network — all nexus-meshes, allied AND oppositional. Opposition designed in. |
| **Nexus** | A *confederation of lararia* sharing a stable internal mesh. Named by community + place. e.g. "Floating Library of Mu, PNW Branch." Cross-Nexus = wild-magic-zone hops: explicitly brokered, potentially unreliable. NOT a single server. NOT a single lararium. |
| **Lararium** | One operator's infrastructure — a `lararium-node` process + their browser peers + devices. The household shrine. Smallest unit. |
| **DreamDeck** | First personal browser app for accessing DreamNet. One UX surface. `@dreamdeck/app`. |
| **Tasked Spirits** | Bounded single-protocol agents — what we spawn for research. Elyncian term, same operational structure. |
| **Named Personas** | Persistent agent identities that follow operator signatures across nodes. Maps to DID/identity system. |
| **Scale ladder** | Lararium (single operator) → Nexus (confederation of lararia, regional mesh) → DreamNet (all Nexuses) |
| **Within-Nexus sync** | Automerge CRDT — stable, reliable internal mesh. |
| **Cross-Nexus federation** | Explicit treaty, astral-sea hops — unreliable, degraded-state-tolerant. Needs `allies` treaty events. |

Canonical grounding: `elyncia/Elyncia_02_The_Lares_DreamNet.md`

## Four-Layer Stack

```
DreamNet                  — entire distributed network of nexus-meshes (allied + oppositional)
  └── Nexus               — threshold space: stable mesh (ha-tiga) + transitory flow (social-tiga)
        ├── lararium-node     — local host peer: filesystem, operator key, canon promotion
        └── lararium-browser  — browser/OPFS peer: IndexedDB, broadcast(), WebSocket sync

elyncia.app               — public domain; reverse proxy (web2 Kowloon ↔ web3 Lares)
  ├── DreamDeck           — first app on DreamNet (@dreamdeck/app); quine-wiki + infinite canvas
  │     ├── Lares         — Agent alignment + HUD; personal workspace (MemeStoreDoc)
  │     └── Lararium      — "where the lares lives"; isomorphic identity + TW5/Automerge quine
  └── Kowloon Node        — web2 ActivityPub gateway; Node.js + MongoDB; @user@elyncia.app
```

`@lararium/*` = DreamNet protocol/infra. `@dreamdeck/*` = DreamDeck app layer. "Myth speaks reality into being." (Elyncia_02)

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
- `Groups` → `Circles` rename complete and settled; `GroupsDoc` now appears as `CirclesDoc` everywhere
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
| 6 | Wire `.tw5.js` CJS outputs into genesis; quine round-trip | S5 | ✅ Done |
| 7 | `SessionEventLog` per-session append-only doc | S6 | 🔴 Active |
| 8 | Circles + Identities capability layer (Keyhive/UCAN) | S7 | ⬜ Designed |
| 9 | Kowloon bridge — `KowloonDoc` or HTTP adapter | S8 | ⬜ Research pending |

---

## Likely Next Files To Touch (S6)

- `packages/lararium-core/src/social-doc.ts` — add `eventLogUrl?`, `eventLogHeads?` to `SessionTiddler`; add `SessionEventLog` doc type + `SessionEvent` entry type
- `packages/lararium-node/src/genesis-island.ts` — add `seedSessionEventLog(repo, sessionId)`
- `packages/lares/memes/api/v0.1/lares/voices.md` — spec-shelf links need companion docs created: `docs/lares/voices/coordinators`, `docs/lares/voices/workers`, `docs/lares/voices/masks`
- `packages/ROADMAP.md` — S6 tasks to check off as they complete
