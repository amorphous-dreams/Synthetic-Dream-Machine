/**
 * system-invariants — FFZ pono constitutional law for the Lararium causal-island system.
 *
 * Fontany-Fuller-Zelenka local-first model.  Confidence: C~0.99.
 * These encode design-time laws and named exceptions — no runtime validators.
 * All arrays are `as const satisfies` so IDs survive tree-shaking.
 */

export interface SystemInvariantEntry {
  readonly id:          string;
  readonly label:       string;
  readonly description: string;
}

// ---------------------------------------------------------------------------
// MIND_LAWS — the Automerge store functions as the mind; disk and HTTP project from it
//
// FFZ disk projection law (2026-05-01):
//   Disk files project from the Automerge store. The store holds the mind.
//   No server-rendered CRDT projections served as HTML.
// ---------------------------------------------------------------------------

export const MIND_LAWS = [
  {
    id:          "MIND_1_STORE_IS_MIND",
    label:       "Store is mind; disk and HTTP are projections",
    description: "The Automerge store functions as the live source of truth. Disk files, HTTP responses, and canvas shapes function as unidirectional read artifacts derived from it — never the reverse.",
  },
  {
    id:          "MIND_2_NO_SNAPSHOT_SEED",
    label:       "A projection MUST NOT seed an Automerge doc",
    description: "Snapshot/HTTP/disk lanes are read artifacts. Seeding a CRDT doc from an HTTP snapshot or disk projection violates the causal-island boundary and reintroduces server authority over local state.",
  },
  {
    id:          "MIND_3_SW_SHELL",
    label:       "sw-shell, not server-rendered snapshot",
    description: "App shell serves from the Service Worker cache. Automerge islands hydrate in background. `sw-shell` readiness lights when SW controls the page — not when a server-rendered HTML response arrives.",
  },
] as const satisfies readonly SystemInvariantEntry[];

// ---------------------------------------------------------------------------
// ISLAND_LAWS — causal island identity, boundary, and boot origin
//
// FFZ island law (2026-05-01):
//   "Each causal island starts from its own history."
//   Islands: auth · catalog · engine · corpus · room · presence · draft · projection
// ---------------------------------------------------------------------------

export const ISLAND_LAWS = [
  {
    id:          "ISLAND_1_OWN_HISTORY",
    label:       "Each causal island starts from its own history",
    description: "The room doc starts empty; the corpus doc carries its own seeded content; the engine island carries TW5 core. No island inherits initial state from another island's projection.",
  },
  {
    id:          "ISLAND_2_GENESIS_ROOT",
    label:       "Genesis artifact is the causal root of the engine island",
    description: "@phase: S2+  The engine island boots from genesis/island.bin — an Automerge.save() binary embedded at build time. No peer reads engine content from a filesystem path at runtime. A peer whose artifact is absent or whose grammar tiddler hash diverges MUST halt, not fall back.",
  },
  {
    id:          "ISLAND_3_AUTHORITY_FIRST",
    label:       "Authority graph reconciles before content",
    description: "Before a peer receives content deltas it MUST reconcile the authority graph. Order: authenticate → authority graph → visible room recipe → collection manifest → causal islands → projections.",
  },
  {
    id:          "ISLAND_4_DOCURL_NOT_AUTHORITY",
    label:       "DocUrl is a locator, not authority",
    description: "Automerge document IDs function as locators. Knowing a DocUrl does not grant read or write access. Authority requires a capability receipt, signature, or policy.",
  },
  {
    id:          "ISLAND_5_PRESENCE_FATE",
    label:       "Presence does not share fate with content",
    description: "Presence behaves like weather. Losing it MUST NOT damage memory. Presence MUST NOT appear in durable cold-start payloads or be required for corpus readiness.",
  },
] as const satisfies readonly SystemInvariantEntry[];

// ---------------------------------------------------------------------------
// AUTHORITY_LAWS — carrier canon, promotion ceremony, trust ladder
//
// Source: lares/lararium-research/PRINCIPLES.md (C~0.99)
//         lares/memes/docs/pono/tagspace-trust.md
//         lares/memes/docs/pono/canon-promotion-boundary.md
// ---------------------------------------------------------------------------

export const AUTHORITY_LAWS = [
  {
    id:          "AUTH_1_CARRIER_CANON_FIRST",
    label:       "Carrier canon first",
    description: "Hostless lar:/// carriers under lares/ carry canon. The operator can boot, inspect, edit, and recover locally. Network sync serves local agency; it does not define truth.",
  },
  {
    id:          "AUTH_2_PROJECTION_NEVER_PROMOTES",
    label:       "Projection never promotes itself",
    description: "TW5, tldraw, HUD, MCP, DreamDeck, and Kowloon surfaces render and draft — they do not silently promote. A surface write that reaches lares/ MUST pass through an explicit promotion ceremony.",
  },
  {
    id:          "AUTH_3_FORK_BEFORE_OVERWRITE",
    label:       "Fork before overwrite",
    description: "Live and session material may fork, annotate, propose, and request merge. It MUST NOT silently override invariant loci. Every mutation carries a visible origin class.",
  },
  {
    id:          "AUTH_4_CEREMONY",
    label:       "Ceremony marks canon promotion",
    description: "Any write that reaches lares/ MUST carry: actor, origin URI, target URI, diff, receipt, and rollback path. Without this crossing the system cannot distinguish a draft from a promotion.",
  },
  {
    id:          "AUTH_5_TRUST_LADDER",
    label:       "Weaker record surfaces drift; it does not overwrite",
    description: "Trust order (strongest first): hostless invariant memes → hostless interface memes → hostless data/docs → branch-local artifacts → hostful live exchange → generated trajectory. A weaker record discovering drift in a stronger record surfaces a trust-boundary event — it does not silently merge upward.",
  },
] as const satisfies readonly SystemInvariantEntry[];

// ---------------------------------------------------------------------------
// CODEC_LAWS — format, grammar, and round-trip laws
// ---------------------------------------------------------------------------

export const CODEC_LAWS = [
  {
    id:          "CODEC_1_GRAMMAR_AS_MEMES",
    label:       "All grammar rules live as carrier memes",
    description: "Grammar rules, parse patterns, and template definitions SHALL live as carrier memes in lares/memes/api/v0.1/pono/.  The TypeScript parser is a thin interpreter; it MUST NOT hard-code sigil semantics.",
  },
  {
    id:          "CODEC_2_ROUND_TRIP",
    label:       "Round-trip or refuse",
    description: "Any carrier → tiddler/widget/shape → carrier path MUST preserve law-bearing structure or emit explicit loss residue. Regex may assist parsing; it MUST NOT rule carrier semantics.",
  },
  {
    id:          "CODEC_3_CANONICAL_BYTES",
    label:       "Hash canonical bytes, not JS objects",
    description: "Convert semantic records into canonical bytes before hashing. JSON key order must be stable; text via TextEncoder (UTF-8). Non-canonical serialization produces non-reproducible hashes silently.",
  },
  {
    id:          "CODEC_4_NO_CUSTOM_CRYPTO",
    label:       "No hand-rolled cryptographic primitives",
    description: "No hand-rolled hash functions, no djb2, no custom PRNG, no homegrown auth. All portable code depends on a minimal CryptoProvider interface; runtime adapters call globalThis.crypto.",
  },
  {
    id:          "CODEC_5_BAG_PRIORITY",
    label:       "Recipe is the routing table; highest-priority bag wins",
    description: "Tiddler conflict resolution uses highest-priority bag wins. The TW5 vm MUST enforce this on every incoming delta. The recipe functions as the routing table — not registration order.",
  },
] as const satisfies readonly SystemInvariantEntry[];

// ---------------------------------------------------------------------------
// CODEC_EXCEPTIONS — named deliberate deviations from codec and mind laws
//
// Adding an entry here acknowledges the deviation and names the responsible
// party. It does not waive the underlying law.
// ---------------------------------------------------------------------------

export const CODEC_EXCEPTIONS = [
  {
    id:          "CODEC_EX_CATALOG_URL",
    label:       "catalog-url disk write",
    description: "The node peer writes a DocUrl to disk to reconnect after restart. Deliberate codec-layer exception (persisting a handle, not content). NOT a web2 server-authoritative write path.",
  },
  {
    id:          "CODEC_EX_BOOTSTRAP_SCANS",
    label:       "BOOTSTRAP_SCANS reads raw carrier text",
    description: "Grammar bootstrap reads raw carrier text from the grammar tiddler (.text) rather than pre-deserialized fragment tiddlers, breaking the bootstrap circle. See grammar-invariants.ts Invariant 2.",
  },
  {
    id:          "CODEC_EX_PRE_S2_COLD_BOOT",
    label:       "Pre-S2 cold-boot filesystem read",
    description: "@remove: S2  Until genesis/island.bin exists, the node peer reads lares/memes/api/v0.1/pono/memetic-wikitext.md at cold-boot to seed the engine doc. Transitional exception to ISLAND_2_GENESIS_ROOT. Disappears when build-genesis-island.ts ships.",
  },
  {
    id:          "CODEC_EX_BINARY_BLOBS",
    label:       "Binary blobs for large immutable assets",
    description: "TW5 core JS and vendored plugin bundles live in LarariumDoc.blobs (binary), not as tiddlers. Referenced by blob-descriptor tiddlers. Intended exception class to the tiddler format law.",
  },
] as const satisfies readonly SystemInvariantEntry[];

// ---------------------------------------------------------------------------
// SYSTEM_LAWS — the five architecture laws (witnessing constants, not runtime gates)
//
// Named so any agent, test, or operator can import and reference by ID.
// These encode the design-time heuristics that governed the web3 refactor.
// They are witnessed here; enforcement is structural, not procedural.
// ---------------------------------------------------------------------------

export const SYSTEM_LAWS = [
  {
    id:          "SYS_1_WEB3_SMELL_TEST",
    label:       "Web2 smell test: redesign from web3 local-first principles",
    description: "If a design requires a privileged server to write the first byte, or relies on reconcile-on-read patterns, treat it as web2 residue. Throw it aside and redesign from Ink & Switch local-first ideals: no spinners, network optional, ultimate ownership.",
  },
  {
    id:          "SYS_2_TW5_VM_PRIMACY",
    label:       "TW5 vm primacy: if it can happen in the vm pool, it must",
    description: "Any operation that can run inside the TW5 vm pool (parse, render, filter, transform) MUST run there. Moving logic outside the vm introduces a parallel authority track and breaks projection fidelity.",
  },
  {
    id:          "SYS_3_TS_AS_PLUGIN_PROJECTION",
    label:       "TypeScript files as TW5 plugin projections",
    description: "Vite translates TypeScript to TW5 plugin bundles at build time. TypeScript source is the design surface for JavaScript tiddlers. Runtime JS tiddlers derive from TS source; the reverse does not hold.",
  },
  {
    id:          "SYS_4_TIDDLER_FORMAT",
    label:       "Tiddler format law: all data as { title, text, fields, bag, authority }",
    description: "All durable data in the Lararium system takes the tiddler shape: { title, text, fields, bag, authority }. Binary assets live as blob-descriptor tiddlers. Nothing bypasses this shape except named codec exceptions.",
  },
  {
    id:          "SYS_5_MEME_AS_TIDDLER_PROJECTION",
    label:       "Meme files as tiddler-package projections",
    description: "*.md carrier files are projections of parent + fragment tiddler packages. Deserialization runs in the vm via deserializeCarrier(); writes run via renderTiddler(). No agent reads meme files as raw strings at runtime except BOOTSTRAP_SCANS (named exception).",
  },
] as const satisfies readonly SystemInvariantEntry[];

// ---------------------------------------------------------------------------
// GENESIS_INVARIANTS — causal origin, content-addressed identity, and quine semantics
//
// These cover what the genesis artifact *means* — its identity and causal role —
// rather than its structural position in the island topology (see ISLAND_LAWS).
// Accumulation point: S5 quine verification adds entries here as they are proved.
// ---------------------------------------------------------------------------

export const GENESIS_INVARIANTS = [
  {
    id:          "GEN_1_CAUSAL_ROOT",
    label:       "Genesis is the causal root; no peer holds an earlier history",
    description: "The genesis artifact establishes the zero point. Every live doc is a causal fork from it. No peer may introduce content that predates the genesis root into a room doc without explicit promotion ceremony.",
  },
  {
    id:          "GEN_2_CONTENT_ADDRESSED",
    label:       "Genesis identity is content-addressed, not server-assigned",
    description: "The genesis DocUrl derives from the content bytes via Automerge's document identity. The CID stored in genesis/island.sha256 provides independent verifiability. Knowing the CID is sufficient to verify any copy; no server or registry is authoritative.",
  },
  {
    id:          "GEN_3_IMMUTABLE_SEED",
    label:       "Genesis bytes are immutable; updates produce a new genesis",
    description: "The genesis artifact does not mutate in place. A grammar version bump, tiddler update, or blob change produces a new build with a new CID. There is no in-place upgrade path until signed migration receipts are available (see grammar-invariants.ts Invariant 6).",
  },
  {
    id:          "GEN_4_QUINE_PROPERTY",
    label:       "@phase: S5  Quine property: engine inside boots the system it boots",
    description: "@phase: S5 — declared now; proved in Sprint 5.  The genesis artifact carries the TW5 engine tiddlers that deserialize it. Boot a vm from the artifact, render the engine tiddlers, and the output matches the source. This is the quine closure. A genesis that cannot regenerate itself is incomplete.",
  },
] as const satisfies readonly SystemInvariantEntry[];

// ---------------------------------------------------------------------------
// PEER_INVARIANTS — peer symmetry at boot and post-boot authority boundaries
// ---------------------------------------------------------------------------

export const PEER_INVARIANTS = [
  {
    id:          "PEER_1_BOOT_SYMMETRY",
    label:       "All peers import the same genesis bytes; no privileged seeder",
    description: "Node peer, browser peer, and worker all call repo.import(genesisBytes) with the same Uint8Array baked into the bundle. No peer holds a seeding role. The CRDT merge protocol handles divergence from genesis forward; no peer is authoritative by virtue of being first.",
  },
  {
    id:          "PEER_2_OPERATIONAL_DIVERGENCE",
    label:       "Post-boot operational differences are not authority grants",
    description: "The node peer writes catalog-url to disk; the browser peer does not. This is an operational codec exception (CODEC_EX_CATALOG_URL), not a seeding authority. Operational differences after genesis-boot do not elevate a peer's causal or authority standing.",
  },
  {
    id:          "PEER_3_AUTHORITY_FROM_CAPABILITY",
    label:       "Authority flows from capability receipts, not boot order",
    description: "No peer gains write or promote authority by being first online, by holding more history, or by writing genesis. Authority requires a capability receipt, signature, or policy (Keyhive, future work). Until Keyhive lands, all peers operate at parity below the canon promotion boundary.",
  },
] as const satisfies readonly SystemInvariantEntry[];
