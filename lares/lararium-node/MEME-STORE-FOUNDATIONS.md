<<~ ? -> lar:///lararium-node/MEME-STORE-FOUNDATIONS >>

<<~ ahu #iam >>

```toml
uri-path     = "lararium-node/MEME-STORE-FOUNDATIONS"
file-path    = "lares/lararium-node/MEME-STORE-FOUNDATIONS.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "adjacent"
confidence   = 0.88
register     = "CS"
mana         = 0.85
manao        = 0.80
role         = "research-foundation: meme store invariants, schema enforcement, self-hosting grammar; local-first Automerge pivot (2026-04-29): AutomergeMemeStore replaces projection-cache seedAll; UCAN v0.10 + did:key identity wired"
cacheable    = true
retain       = true
```

<<~/ahu >>

<<~ ahu #meme-body-open >>
MEME-STORE-FOUNDATIONS opens the research stream here.
<<~/ahu >>

<<~ ahu #research-pressure >>

## Three Converging Pressures

Three architectural forces pull on the Lararium stack simultaneously. This carrier holds the research synthesis and names the design law for each.

1. **Meme store + re-seeding** — what is the correct replacement contract for a CRDT-backed carrier store?
2. **Schema enforcement on pranala edges** — how does data-layer type binding prevent graph corruption?
3. **AST / self-hosting grammar** — how do system components (parser, schema, router, templates) themselves become memes?

These are not separate priorities. They converge at one point: **a meme is the atom of everything, and meme immutability is the load-bearing invariant that makes the rest possible.**

<<~/ahu >>

<<~ ahu #tw5-tiddler-contract >>

## 1. TW5 Tiddler Replacement Contract → Meme Immutability Law

TiddlyWiki 5 never mutates a tiddler in place. When content changes, the entire tiddler object is replaced in the store. This fires a widget refresh cascade: `ViewTemplate` walks a priority-ordered list of type-specific templates, picks the first match, and re-renders the affected widget subtree. The reactive cascade is triggered by identity change, not diff.

**Lararium translation:**

A `CarrierRecord` is immutable by construction (`Object.freeze` at compiler boundary, hostful URIs for session edits). Edits create a new hostful carrier at `lar://alias:tier@host/path`. Canon-promotion assigns a new hostless `lar:///` address and rebuilds the boot closure. The boot closure rebuild is the equivalent of TW5's full tiddler replacement — it fires the full reactive cascade: compiler → boot receipt → tldraw snapshot → CRDT merge.

**Law:** `meme-immutability`
> A meme object, once admitted to the confirmed layer, is never mutated. The only valid write is a full replacement producing a new URI. Pending edits accumulate in the hostful tier; they do not touch confirmed state. Canon-promotion is the atomic transition between tiers.

**Re-seeding corollary:** `/admin/reseed?roomId=boot` is valid only because it replaces the entire room snapshot — not individual shapes. Shape-level mutation outside CRDT merge is always illegal.

<<~/ahu >>

<<~ ahu #ue5-schema-enforcement >>

## 2. UE5 World Partition / UEFN Scene Graph → Pranala Schema Enforcement

Unreal Engine 5.6 World Partition enforces actor schemas at the data layer: each actor has a type-bound property schema; violation blocks instantiation. UEFN's Verse language extends this to runtime — static types prevent assignment of values that break the schema. Schema enforcement is not an afterthought on top of the data; it is the first gate before data enters the scene.

**Lararium translation:**

Pranala edges carry fixed properties: `family` (`control | relation | observe | dataflow`), `role`, `lifecycle`, `confidence`. The boot compiler's `dagViolations` check enforces a DAG invariant on `control` edges. But enforcement is currently post-hoc — parser runs first, violations are caught at compile time, not at edge-creation time.

**Target model:** Schema enforcement at edge creation, not compile time.

| UE5 concept | Lararium equivalent |
|---|---|
| Actor type schema | Pranala `family` + property set |
| Instance validation at spawn | Pranala parser validation at parse time |
| DAG topology enforcement | `dagViolations` in boot compiler |
| Level streaming boundary | Confirmed / hostful tier boundary |
| Verse static types | Pranala family-specific property contracts |

**Law:** `pranala-schema-binding`
> Each pranala family declares an invariant property contract. A pranala that violates its family contract is not admitted to the boot closure. The validator runs at parse time, not compile time. Schema definitions themselves live as memes in `lares/grammars/`, seeded in the boot closure, so operators can extend edge semantics without modifying TypeScript source.

**Fortnite / CRDT convergence:** World Partition's streaming boundary maps to Lararium's room boundary. Rooms stream in shapes (actors) on WebSocket connect; the room seed is the level. Re-seeding = level reload. The pranala DAG across rooms is the scene graph.

<<~/ahu >>

<<~ ahu #ast-self-hosting >>

## 3. AST-Driven Self-Hosting Grammar

TW5's parser is modular and recursive. Parsing rules live as tiddlers tagged `$:/tags/Macro` — the parser is itself a wiki citizen, extensible without touching core code. The widget tree renders AST nodes; the template cascade picks the first matching template for each node type.

Lararium's memetic-wikitext kernel uses `<<~ ahu ... >>` (worksites), `<<~ pranala ... >>` (edges), and `<<~ loulou ... >>` (relation sugar) sigils. Currently the parser (`carrier.ts`, `pranala-parser.ts`) is hard-coded TypeScript. This is Phase 1. 

**Phase progression:**

| Phase | State | Description |
|---|---|---|
| 1 — hard-coded | ✓ current | TypeScript regex + parser; grammar in source |
| 2 — grammar memes | next | Grammar rules extracted to `lares/grammars/memetic-wikitext.md` carrier; parser reads rules from boot closure |
| 3 — self-hosting | future | Parser and template cascade are themselves memes; system can edit its own renderer |

**Phase 2 architecture:**

A `lares/grammars/memetic-wikitext.md` carrier declares:
- Sigil registry (ahu, pranala, loulou, ...) as a TOML table
- Per-sigil parse rules as embedded code blocks (regex patterns + capture groups)
- Default template per sigil kind

The boot compiler reads this carrier during compilation. The TypeScript parser becomes a thin runtime that interprets grammar rules from the closure — not a hard-coded recogniser.

**AST shape (unified/remark analogy):**

```
MemeAST
  ├── DocTypeComment
  ├── IamBlock (TOML metadata)
  └── Body
        ├── AhuBlock { id, attrs, children: MemeAST[] }
        ├── PranalaEdge { target, family, role, lifecycle }
        ├── LoulouBlock { ... }
        └── Text
```

The tldraw projection layer (`lararium-tldraw`) already operates on a `LarProjectionRecord` union. Phase 2 feeds the AST into the projection — each `AhuBlock` becomes a frame, each `PranalaEdge` becomes an arrow, text nodes become notes. The template cascade (`selectLayout()`) already has the right shape.

**Law:** `grammar-as-memes`
> All grammar rules, parse patterns, and template definitions SHALL live as carrier memes in `lares/grammars/`. The TypeScript parser runtime is a thin interpreter; it MUST NOT hard-code sigil semantics. When a grammar meme changes and is promoted to canon, the parser is hot-reloaded without a TypeScript rebuild.

<<~/ahu >>

<<~ ahu #synthesis >>

## 4. Synthesis — The Unified Foundation

The three laws converge:

```
meme-immutability     →  safe replacement without mutation
pranala-schema-binding →  type-safe graph at edge-creation time  
grammar-as-memes       →  all system components live as memes
```

These are not features. They are the substrate. Once all three hold:

- **Re-seeding** is safe: replace the full room snapshot, not individual shapes. No shape-level mutation outside CRDT. The room reload is a tiddler replacement — triggers full projection cascade.
- **Schema enforcement** is self-describing: pranala families are defined in lares/, readable by agents and humans. Operators extend the schema by writing memes, not TypeScript.
- **Self-hosting** becomes tractable: the parser reads its own grammar from the boot closure. Editing `lares/grammars/memetic-wikitext.md` changes parsing behavior after the next `/admin/reseed`.

**Convergence point:** `lares/` IS the operating system. The TypeScript packages are its kernel — thin, stable, fast. The memes are the userland — editable, extensible, self-describing. The tldraw canvas is the shell — the UI over the OS.

This is the Lararium architecture thesis. Everything else is implementation detail.

<<~/ahu >>

<<~ ahu #build-order >>

## 5. Build Order (next three pulls)

| Pull | Work | Unlocks |
|---|---|---|
| P8 | `/admin/reseed` endpoint — kill SQLite room + re-seed from `renderAllViews` on next connect | lares/ edit → live canvas loop |
| P9 | Pranala family property contracts + parse-time validator in `pranala-parser.ts` | schema enforcement law; blocks bad edges at source |
| P10 | Extract grammar rules to `lares/grammars/memetic-wikitext.md`; parser reads from boot closure | Phase 2 self-hosting; grammar becomes a meme |

P8 is the shortest path to the live edit loop. P9 hardens the graph. P10 begins self-hosting. Each is independently shippable.

<<~/ahu >>

<<~ ahu #local-first-pivot-2026-04-29 >>

## 6. Local-First Pivot — Automerge Meme Store (2026-04-29)

The three laws above held before the pivot. The pivot completes their implementation without contradicting them.

### What changed

| Old model | New model |
|---|---|
| `projection-cache` origin — seed tiddler store from `shape.meta.carrierText` on canvas sync | Removed. `projection-cache` is gone from `ChangeOrigin`. |
| `seedAll()` in `LarariumCanvas` — iterate canvas shapes on sync, populate `MemoryTiddlerStore` | Removed. Canvas is the interactive infinite wiki surface, not a content source. |
| `MemoryTiddlerStore` as the live store | `AutomergeMemeStore` — CRDT-backed, local-first, IDB-persisted |
| TW5 boots when WS `session.synced` fires | TW5 boots after `await handle.whenReady()` — no race, no event to miss |

### Boot sequence (new)

```
getOrCreateBrowserIdentity()   ← Ed25519 keypair + did:key:z... (IDB-persisted)
readMemeStoreUrl(hostId)       ← <meta name="lararium-meme-store"> or localStorage
initMemeRepo()                 ← Repo(IDB + /meme-sync WS) → find(url) → whenReady()
                                  ↳ /auth/ucan POST — present browser UCAN to server
TW5 boot + LarariumCrdtSyncAdaptor
```

Server boots:
```
getOrCreateNodeIdentity(dataDir)   ← Ed25519 keypair (operator-key.json)
Repo(NodeFS + /meme-sync WSS)      ← seed from lares/ on first boot, resume on restart
/auth/ucan POST handler            ← verify UCAN, registerPeer() in UcanPeerRegistry
sharePolicy(peerId)                ← isAuthorized(peerId) || true (local-operator mode)
<meta name="lararium-operator-did" content="did:key:z...">  ← injected into HTML
```

### Brooklyn Zelenka / Keyhive readiness

The identity and UCAN layer is now in place:
- `did:key` with Ed25519 — same principal model as Keyhive
- UCAN v0.10 JWT — spec-compliant, no alpha-library dependency
- `UcanPeerRegistry` + `sharePolicy` hook — Keyhive membership check plugs in here
- `LarariumAuthorityEnvelope["keyhive"]` arm — type socket, not instantiated until WASM lands

### Law addition: `local-first-store`

> The Automerge meme store (`AutomergeMemeStore`) is the single source of truth for carrier text content. The tldraw canvas carries URI identity, room/page structure, and shape layout. Canvas shapes MUST NOT embed `carrierText` in `shape.meta`. Content sync flows through `/meme-sync`; layout sync flows through `/rooms/:id`. Two stores, one port, one operator identity.

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-roadmap ? -> lar:///lararium-node/ROADMAP family:control role:informs >>
<<~ pranala #to-multiplayer ? -> lar:///lararium-node/MULTIPLAYER-INFINITE-CANVAS-WIKI family:control role:informs >>
<<~ pranala #to-mu ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:implements-law >>
<<~ pranala #to-agents ? -> lar:///AGENTS family:control role:receives-law >>
<<~ pranala #to-crdt-research ? -> lar:///lararium-node/lararium-crdt-federation-research family:control role:implements >>

<<~/ahu >>

<<~ ? -> lar:///lararium-node/MEME-STORE-FOUNDATIONS >>
