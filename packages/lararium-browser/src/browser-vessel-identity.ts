/**
 * browser-vessel-identity — WebCrypto Ed25519 keypair lifecycle for browser vessels.
 *
 * Browser analog of node-vessel-identity.ts (Node). Platform deltas:
 *   - crypto.subtle.generateKey({name:"Ed25519"}) instead of Node generateKeyPairSync
 *   - IndexedDB for persistence instead of NodeFS (mode 0o600)
 *   - No git-config lookup; displayName passed by caller
 *
 * Key material rests only in the origin's IndexedDB under `<idbName>` / "keystore": in the clear until a slot
 * binds, sealed under the vessel key once one does (`browser-custody.ts`). The page that opens the vessel hands
 * the selected face atom and its veil Archive to its daemon island's manifest, so a lock drops this page's unlock alone.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-vessel-identity
 */

import {
  generateOrLoadKeypair,
  signingSeedFromHex,
  readIdentityAnchors,
  generateOrLoadPersonaRoot,
  loadPersonaRootSeed,
  wearPersona as coreWearPersona,
  loadActivePersona as coreLoadActivePersona,
  personaRootExists as corePersonaRootExists,
  listPersonaRoots as coreListPersonaRoots,
  type KeypairStore,
  type KeypairCrypto,
  type PersonaVault,
  type PersonaRoot,
  type ActivePersonaStore,
  type AnchorStore,
  type IdentityAnchors,
  type OwnPersonaPetnameStore,
  type PersonaDeclaration,
  type PersonaDeclarationStore,
  type OwnPublicHandleStore,
  type PersonaPublicHandleRecord,
  armPlaceInception, verifyPlaceKel, foldPlaceKel, acceptPlaceHead, PlaceFoundingCardUnread,
  type PlaceFoundingCard, type PlaceKelEvent, type PlaceKelReading, type RandomProvider,
} from "@lararium/mesh";
import type { SeedWrapRecord } from "./seed-wrap-prf.js";

import { assertCanMint } from "./secure-context-gate.js";
import { readKeystoreRow, writeKeystoreRow } from "./browser-custody.js";
const KEY_RECORD = "vessel-key";
const IDENTITY_CONTINUITY_PREFIX = "lares:vessel:continuity:";

/** Origin-local companion marker: it survives an IndexedDB-only clear and lets the next open refuse a re-found key. */
export function browserIdentityContinuityKey(idbName: string): string {
  return `${IDENTITY_CONTINUITY_PREFIX}${idbName}`;
}

// The keystore holds device and persona secrets; bootstrap holds the founding floor. The worn face is session state of one tab
// and rests in no store.
const IDB_VERSION       = 11;
const ANCHORS_STORE        = "anchors";           // per-index veiled-Handle anchors (public doc-ids)
const ANCHOR_ROSTER_STORE  = "anchor-roster";     // the EXPLICIT anchored-index record
// The two-layer pet-names (#64 stage 4): the PRIVATE own-persona label map (fleet-only; never PUBLICLY
// federates) + the PUBLIC own-published-face record. Per-index, keyed by `h${N}` like the persona-root slots.
const PERSONA_PETNAME_STORE      = "persona-petnames";        // handleIndex → the human's PRIVATE label
const PERSONA_PUBLIC_HANDLE_STORE = "persona-public-handles"; // handleIndex → the vessel's OWN published face
// The DECLARATION store — the Handle a persona answers to + whether it stands for a Kahu seat. It sits
// between the two above so a private compartment label never becomes a public commitment by accident.
const PERSONA_DECLARATION_STORE  = "persona-declarations";    // handleIndex → PersonaDeclaration
// v4 additive stores (all causal-island-LOCAL, never federated):
export const CIRCLE_STORE           = "circles-follow";      // circleId → nym[] (the IoC follow-graph, private)
export const HANDLE_BOOK_STORE      = "handle-book";         // "snapshot" → HandleBookSnapshot (others' nyms + labels)
// The optional PRF wrap uses the persona's `h${N}` key; custody still gates the root row.
export const SEED_WRAP_STORE        = "seed-wrap";           // handleIndex → SeedWrapRecord
// The fleet-join store carries signed public material for each joined face.
export const FLEET_JOIN_STORE       = "fleet-join";          // `record:${group}` · `dial:${group}`
const ROSTER_RECORD        = "roster";            // the anchor roster key

/** A per-handle-index key shared by persona rows and their adjacent stores. */
function personaRootKey(handleIndex: number): string { return `h${handleIndex}`; }

interface PersistedBrowserKey {
  /** Hex-encoded 32-byte Ed25519 verifying key. */
  verifyingKey: string;
  /** Hex-encoded 32-byte Ed25519 private seed. Never synced or transferred. */
  signingKey: string;
}

export interface BrowserVesselIdentity {
  verifyingKey: string;
  displayName?: string;
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

export function openVesselIdb(idbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(idbName, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("keystore"))         db.createObjectStore("keystore");
      if (!db.objectStoreNames.contains("bootstrap"))        db.createObjectStore("bootstrap");
      if (!db.objectStoreNames.contains(ANCHORS_STORE))        db.createObjectStore(ANCHORS_STORE);
      if (!db.objectStoreNames.contains(ANCHOR_ROSTER_STORE))  db.createObjectStore(ANCHOR_ROSTER_STORE);
      // v3 additive: the two-layer pet-name stores. A v2 DB gains them empty; no persona names until the
      // human labels one / publishes a glamour.
      if (!db.objectStoreNames.contains(PERSONA_PETNAME_STORE))       db.createObjectStore(PERSONA_PETNAME_STORE);
      if (!db.objectStoreNames.contains(PERSONA_PUBLIC_HANDLE_STORE)) db.createObjectStore(PERSONA_PUBLIC_HANDLE_STORE);
      if (!db.objectStoreNames.contains(PERSONA_DECLARATION_STORE))   db.createObjectStore(PERSONA_DECLARATION_STORE);
      // v4 additive: the IoC follow's private stores (circle-graph + handle-book). Causal-island-LOCAL — none
      // federate. A v3 DB gains them empty; nothing is followed until the vessel acts.
      if (!db.objectStoreNames.contains(CIRCLE_STORE))           db.createObjectStore(CIRCLE_STORE);
      if (!db.objectStoreNames.contains(HANDLE_BOOK_STORE))      db.createObjectStore(HANDLE_BOOK_STORE);
      // The optional seed-wrap store stays distinct from the custody row.
      if (!db.objectStoreNames.contains(SEED_WRAP_STORE))        db.createObjectStore(SEED_WRAP_STORE);
      // The public fleet rows stand beside the custody tree.
      if (!db.objectStoreNames.contains(FLEET_JOIN_STORE))       db.createObjectStore(FLEET_JOIN_STORE);
    };
    req.onsuccess = () => {
      // A newer version opening in another tab closes this connection, so that open never waits on this one.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror   = () => reject(req.error);
    // Blocked waits rather than fails: the older connection may close on its own versionchange.
    req.onblocked = () => console.warn(`[vessel] ${idbName}: another tab holds an older version of this store open; the open waits until it closes.`);
  });
}

export function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror   = () => reject(req.error);
  });
}

export function idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

/** Enumerate one store's keys — the per-index roster read the pet-name + public-handle stores ride (each
 *  keys by `h${N}`, one record per persona, so the key list IS the roster). */
export function idbKeys(db: IDBDatabase, store: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
    req.onerror   = () => reject(req.error);
  });
}

// ── Platform shores for the shared keypair lifecycle (vessel-identity-core) ──────
// The browser mints via WebCrypto (Ed25519 subtle) and persists the keypair to
// IndexedDB. The core (mesh) owns the generate-or-load control flow over these.
// base64urlToHex stays browser-local — it decodes a WebCrypto JWK field via
// `atob`, with no mesh-floor equivalent.

function base64urlToHex(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob(b64);
  let hex = "";
  for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
  return hex;
}

const browserKeypairCrypto: KeypairCrypto = {
  async generate() {
    // Read the context BEFORE any key work. Off a secure context this throws with the cause and the cure;
    // without it, `crypto.subtle` reads undefined and a household meets a TypeError naming neither.
    assertCanMint();
    const keyPair = await crypto.subtle.generateKey(
      { name: "Ed25519" } as EcKeyGenParams,
      true,
      ["sign", "verify"],
    ) as CryptoKeyPair;
    const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey) as JsonWebKey;
    const pubJwk  = await crypto.subtle.exportKey("jwk", keyPair.publicKey)  as JsonWebKey;
    if (!privJwk.d || !pubJwk.x) {
      throw new Error("[browser-vessel-identity] WebCrypto exportKey produced unexpected JWK shape");
    }
    return { verifyingKey: base64urlToHex(pubJwk.x), signingKey: base64urlToHex(privJwk.d) };
  },
};

/** A persona-root slot rides the same custody row door as the device seed. */
function idbPersonaRootSlot(idbName: string, handleIndex: number): KeypairStore {
  const row = `persona-root-${personaRootKey(handleIndex)}`;
  return {
    async load() {
      const existing = await readKeystoreRow(idbName, row) as PersistedBrowserKey | undefined;
      return existing ? { verifyingKey: existing.verifyingKey, signingKey: existing.signingKey } : undefined;
    },
    async save(kp) {
      const record: PersistedBrowserKey = { verifyingKey: kp.verifyingKey, signingKey: kp.signingKey };
      await writeKeystoreRow(idbName, row, record);
    },
  };
}

/** The device keypair slot — the vessel's OWN signing capability (the Individual), distinct from every
 *  persona-root (the two-key atom: device-key ⊥ persona-root). It rides the keystore's custody row door
 *  (`browser-custody.ts`): in the clear until a slot binds, sealed under the vessel key once one does, and a
 *  sealed keystore this page holds no unlock for refuses `sealed-locked`, so nothing mints over a sealed seed. */
function idbKeypairStore(idbName: string): KeypairStore {
  return {
    async load() {
      const existing = await readKeystoreRow(idbName, KEY_RECORD) as PersistedBrowserKey | undefined;
      return existing ? { verifyingKey: existing.verifyingKey, signingKey: existing.signingKey } : undefined;
    },
    async save(kp) {
      const record: PersistedBrowserKey = { verifyingKey: kp.verifyingKey, signingKey: kp.signingKey };
      await writeKeystoreRow(idbName, KEY_RECORD, record);
    },
  };
}

// ── Keypair lifecycle ─────────────────────────────────────────────────────────

/**
 * Generate or load the browser operator Ed25519 keypair.
 *
 * First call: generates a new keypair via WebCrypto, persists to IDB, returns identity.
 * Subsequent calls: loads from IDB.
 *
 * @param idbName  IDB database name (default "lares:vessel")
 * @param displayName  Optional operator display name for identity tiddler.
 */
export async function generateOrLoadBrowserVesselIdentity(
  idbName    = "lares:vessel",
  displayName?: string,
  opts: { readonly placeFoundingCard?: PlaceFoundingCard; readonly entropy?: RandomProvider } = {},
): Promise<BrowserVesselIdentity> {
  let continuity: string | null;
  try {
    continuity = localStorage.getItem(browserIdentityContinuityKey(idbName));
  } catch (error) {
    throw new Error(`[browser-vessel-identity] local-storage-unavailable — refusing to mint before continuity can be recorded: ${String(error)}`);
  }

  const keyStore = idbKeypairStore(idbName);
  const existing = await keyStore.load();
  if (continuity === "founded" && !existing) {
    throw new Error(
      `[browser-vessel-identity] local-storage-lost — origin marker for "${idbName}" remains, but its IndexedDB identity is absent; ` +
      `refusing to found a blank vessel under the old name. Restore the origin data or recover the vessel before opening it.`,
    );
  }
  if (continuity !== null && continuity !== "founded" && continuity !== "founding") {
    throw new Error(`[browser-vessel-identity] local-storage-state-invalid — continuity marker for "${idbName}" has an unknown value.`);
  }

  if (!existing) {
    try {
      localStorage.setItem(browserIdentityContinuityKey(idbName), "founding");
    } catch (error) {
      throw new Error(`[browser-vessel-identity] local-storage-unavailable — refusing to mint before continuity can be recorded: ${String(error)}`);
    }
  }

  const { verifyingKey } = await generateOrLoadKeypair(keyStore, browserKeypairCrypto);
  try {
    localStorage.setItem(browserIdentityContinuityKey(idbName), "founded");
  } catch (error) {
    throw new Error(`[browser-vessel-identity] local-storage-unavailable — identity exists but its continuity marker could not be sealed: ${String(error)}`);
  }
  // A seated founding card arms the place KEL in the same act; with none seated the leaf founds no KEL, and the explicit door
  // below refuses by name until a ceremony seats one.
  if (opts.placeFoundingCard) await foundBrowserPlaceKel(idbName, { placeFoundingCard: opts.placeFoundingCard, ...(opts.entropy ? { entropy: opts.entropy } : {}) });
  const base: BrowserVesselIdentity = { verifyingKey };
  return displayName ? { ...base, displayName } : base;
}

// ── The place KEL — the armed chain the device key signs under ───────────────────────────────────
//
// The chain is public bytes and rests in the plain `bootstrap` store; its cold next key rests on the card alone, so no byte of
// it reaches this store. The leaf reads heads through the one mesh fold (`foldPlaceKel`) that the node reads through.
const PLACE_KEL_RECORD = "place-kel";

/** The chain this leaf founded, verified to its head, or null where it founded none. A chain that fails its proof refuses by name. */
export async function loadBrowserPlaceKel(idbName = "lares:vessel"): Promise<PlaceKelReading | null> {
  const db = await openVesselIdb(idbName);
  try {
    const chain = await idbGet<readonly PlaceKelEvent[]>(db, "bootstrap", PLACE_KEL_RECORD);
    if (chain === undefined) return null;
    const reading = verifyPlaceKel(chain);
    if (!reading.ok) throw new Error(`[browser-vessel-identity] place-kel-refused — the stored place KEL reads ${reading.refusal}`);
    const key = await idbKeypairStore(idbName).load();
    if (!key || reading.signerKey !== key.verifyingKey) throw new Error("[browser-vessel-identity] place-kel-refused — the stored place KEL names another key than this device's");
    return reading;
  } finally { db.close(); }
}

/**
 * Found the leaf's place KEL: draw the cold card, read it back through `placeFoundingCard`, and land the armed inception only
 * after it reads back. With no card seated it refuses `PlaceFoundingCardUnread` before any byte lands. A KEL that stands is kept.
 */
export async function foundBrowserPlaceKel(
  idbName = "lares:vessel",
  opts: { readonly placeFoundingCard?: PlaceFoundingCard; readonly entropy?: RandomProvider } = {},
): Promise<{ readonly aid: string; readonly minted: boolean }> {
  const standing = await loadBrowserPlaceKel(idbName);
  if (standing !== null) { if (!standing.ok) throw new Error("unreachable"); return { aid: standing.aid, minted: false }; }
  if (!opts.placeFoundingCard) throw new PlaceFoundingCardUnread();
  const seed = await loadBrowserSigningSeed(idbName);
  let inception: PlaceKelEvent, aid: string;
  try { ({ event: inception, aid } = await armPlaceInception({ signerSeed: seed, card: opts.placeFoundingCard, ...(opts.entropy ? { entropy: opts.entropy } : {}) })); }
  finally { seed.fill(0); }
  const db = await openVesselIdb(idbName);
  try { await idbPut(db, "bootstrap", PLACE_KEL_RECORD, [inception]); } finally { db.close(); }
  return { aid, minted: true };
}

/** The head this leaf accepts from board or bundle rows: its own chain pins the inception, the one mesh fold reads the rows. */
export async function readBrowserPlaceHead(
  idbName: string, rows: readonly unknown[], lastAccepted: { readonly aid: string; readonly seq: number; readonly headDigest: string } | null,
): Promise<PlaceKelReading> {
  const own = await loadBrowserPlaceKel(idbName);
  if (own === null || !own.ok) return { ok: false, refusal: "gap" };
  return acceptPlaceHead(lastAccepted, foldPlaceKel([...own.chain, ...rows], { aid: own.aid }));
}

/**
 * Load the operator's 32-byte Ed25519 signing seed from IDB.
 * Throws when no keypair exists — call generateOrLoadBrowserVesselIdentity first.
 */
async function loadBrowserSigningSeed(idbName = "lares:vessel"): Promise<Uint8Array> {
  const existing = await idbKeypairStore(idbName).load();
  if (!existing) {
    throw new Error("[browser-vessel-identity] no keypair in IDB — call generateOrLoadBrowserVesselIdentity first");
  }
  return signingSeedFromHex(existing.signingKey);
}

// ── PersonaGroup root custody — the IDB-backed PersonaVault (over @lararium/mesh) ────────────────
//
// The browser twin of the node fs vault (node-vessel-identity: makeNodeFsPersonaVault). Two DISTINCT
// capabilities, never two planes (#has-stack): the device key above arms the place KEL;
// the PersonaGroup root here is the operator-root that SIGNS the device-delegation edges granting
// membership. PLURALITY PONO at the identity layer — a human wears a SET of personas, so the vault holds
// a SET of roots keyed by handle-index, WEARS one at a time, and MAY switch.
//
// The isomorphic control flow (generate/load/wear/custody-refuse/roster) lives platform-blind in mesh's
// persona-vault; THIS adapter supplies the browser shores: per-index custody keypair slots, a JSON active-
// persona selector, the anchor store, and (SURFACED) a NULL recovery store. The at-rest guard stays HERE
// (custody-by-type): each root and its roster pass through the keystore's custody row door.
//
// ROOT-ON-FOUNDER: the founding ceremony mints founder-side only; a joinee's vault holds anchors at its
// admitted index with NO matching root (listRoots()=[]). UNIFORM KEYING — every root spells `h${N}`; the
// ROSTER is an EXPLICIT written record the slot's save maintains, never an IDB keys()-scan (the browser
// twin of the node dir-scan ward).

/** Read the persona-root roster's explicit record (ascending), or [] when none / a torn one reads back. */
async function readPersonaRoster(idbName: string): Promise<number[]> {
  const raw = await readKeystoreRow(idbName, "persona-root-roster") as { roots?: unknown } | undefined;
  if (Array.isArray(raw?.roots)) {
    return [...new Set(raw.roots.filter((n): n is number => Number.isSafeInteger(n) && n >= 0))].sort((a, b) => a - b);
  }
  return [];
}

/** Record a held handle-index into the persona-root roster — the mint's explicit written mark. */
async function recordPersonaRoot(idbName: string, handleIndex: number): Promise<void> {
  const roots = new Set(await readPersonaRoster(idbName));
  roots.add(handleIndex);
  await writeKeystoreRow(idbName, "persona-root-roster", { roots: [...roots].sort((a, b) => a - b) });
}

/**
 * The worn face is SESSION state of this tab: it rests in no store, so a reload asks the unlock again and a second tab wears its own
 * face. With no choice made and exactly one persona root held, that one root is the face worn. No inference past that one.
 */
const wornInTab = new Map<string, number>();
export function forgetWornFaceOfTab(idbName: string): void { wornInTab.delete(idbName); }

function tabActivePersonaStore(idbName: string): ActivePersonaStore {
  return {
    async load() {
      const chosen = wornInTab.get(idbName);
      if (chosen !== undefined) return chosen;
      const roots = await readPersonaRoster(idbName);
      return roots.length === 1 ? roots[0] : undefined;
    },
    async save(handleIndex) { wornInTab.set(idbName, handleIndex); },
  };
}

/**
 * The IDB AnchorStore — over a PRIMED in-memory snapshot.
 *
 * SURFACED FORK (core-shape mismatch, resolved adapter-side): the mesh `AnchorStore` shore is SYNCHRONOUS
 * (`load`/`save`/`list` return values, not Promises) — it was shaped around node's sync fs. IndexedDB is
 * fundamentally async, so the browser cannot read it synchronously mid-call. Rather than churn the core to
 * async (which would force node's sync fs stores async too, across the whole identity surface), this
 * adapter primes an in-memory snapshot from IDB ONCE at vault construction (async) and serves the sync
 * reads from it; a `save` updates the snapshot synchronously and WRITES THROUGH to IDB fire-and-forget.
 * Sound because anchors carry ONLY PUBLIC doc-ids (no secret, no custody risk), the in-process snapshot is
 * authoritative for the vessel's life, and IDB re-primes at the next construction ("live process state is
 * the boundary", the same pattern the active-surface pointer rides).
 */
async function primeIdbAnchorStore(idbName: string): Promise<AnchorStore> {
  const db = await openVesselIdb(idbName);
  const rosterRaw = await idbGet<{ anchors?: unknown }>(db, ANCHOR_ROSTER_STORE, ROSTER_RECORD);
  const roster: number[] = Array.isArray(rosterRaw?.anchors)
    ? [...new Set(rosterRaw.anchors.filter((n): n is number => Number.isSafeInteger(n) && n >= 0))].sort((a, b) => a - b)
    : [];
  const snapshot = new Map<number, IdentityAnchors>();
  for (const i of roster) {
    const parsed = await idbGet<Partial<IdentityAnchors>>(db, ANCHORS_STORE, personaRootKey(i));
    const anchors = readIdentityAnchors(parsed);
    if (anchors) snapshot.set(i, anchors);
  }
  db.close();
  const rosterSet = new Set(roster);
  return {
    load: (handleIndex) => snapshot.get(handleIndex) ?? null,
    list: () => [...rosterSet].sort((a, b) => a - b),
    save: (handleIndex, anchors) => {
      snapshot.set(handleIndex, anchors);   // the in-process snapshot IS authoritative this vessel's life
      rosterSet.add(handleIndex);
      const roots = [...rosterSet].sort((a, b) => a - b);
      // Write through fire-and-forget (public ids — a lost write self-heals at the next founding/admit).
      void (async () => {
        const wdb = await openVesselIdb(idbName);
        await idbPut(wdb, ANCHORS_STORE, personaRootKey(handleIndex), anchors);
        await idbPut(wdb, ANCHOR_ROSTER_STORE, ROSTER_RECORD, { anchors: roots });
        wdb.close();
      })();
    },
  };
}

/**
 * Build the IDB-backed PersonaVault — the browser mirror of makeNodeFsPersonaVault. `rootSlot(i)` vends the
 * per-index IDB keypair slot, wrapping its save to RECORD the index into the explicit roster (the founding
 * mark). `hasRoot`/`listRoots` read that roster — never an IDB keys()-scan. `anchors` rides the primed
 * snapshot above. `recovery` reads NULL — SURFACED below.
 */
export async function makeBrowserIdbPersonaVault(idbName = "lares:vessel"): Promise<PersonaVault> {
  const anchors = await primeIdbAnchorStore(idbName);
  return {
    rootSlot(handleIndex) {
      const base = idbPersonaRootSlot(idbName, handleIndex);
      return {
        load: () => base.load(),
        async save(keypair) {
          await base.save(keypair);
          await recordPersonaRoot(idbName, handleIndex);   // the mint writes the explicit roster mark
        },
      };
    },
    listRoots: () => readPersonaRoster(idbName),
    async hasRoot(handleIndex) { return (await readPersonaRoster(idbName)).includes(handleIndex); },
    selector: tabActivePersonaStore(idbName),
    anchors,
    // SURFACED (identity/security fork, resolved toward null): a device
    // recovery-share is share material of the root; sealing it needs the WebCrypto seal leg (the browser
    // twin of node's archive-seal) FIRST, else it would land a self-only secret cleartext with LESS
    // protection than node's sealed store. Recovery provisioning is a separate operator ceremony (even on
    // node it never runs at boot), so a null store blocks nothing the boot needs. `provisionRecoveryAtFounding`
    // fails LOUD on a null recovery store — the honest failure, never a fake seal. Wire this once the
    // browser seal lands (a stage-4+ follow-on).
    recovery: null,
  };
}

/** A persona-root's public face + whether THIS call minted it (the mesh core's PersonaRoot). */
export type BrowserPersonaRoot = PersonaRoot;

/**
 * Generate or load the PersonaGroup-root at `handleIndex` (the operator-root delegation capability),
 * over WebCrypto + IDB. FOUNDER-ONLY — a joining vessel receives the founder's public DID + a signed
 * delegation edge at admit instead. The browser twin of node's generateOrLoadPersonaGroupRoot.
 */
export async function generateOrLoadBrowserPersonaRoot(idbName = "lares:vessel", handleIndex = 0): Promise<BrowserPersonaRoot> {
  return generateOrLoadPersonaRoot(await makeBrowserIdbPersonaVault(idbName), browserKeypairCrypto, handleIndex);
}

/**
 * Load the PersonaGroup-root 32-byte Ed25519 SIGNING seed at `handleIndex` (founder-only). SECURITY: the
 * returned bytes ARE the operator-root private key — the most sensitive secret on the vessel. Throws when
 * absent — mint via the founding ceremony first (a joinee never holds this).
 */
export async function loadBrowserPersonaRootSeed(idbName = "lares:vessel", handleIndex = 0): Promise<Uint8Array> {
  return loadPersonaRootSeed(await makeBrowserIdbPersonaVault(idbName), handleIndex);
}

/** Read the opt-in PRF wrap standing beside the persona root at `handleIndex`, or undefined (cleartext at rest). */
export async function readBrowserSeedWrap(idbName = "lares:vessel", handleIndex = 0): Promise<SeedWrapRecord | undefined> {
  const db = await openVesselIdb(idbName);
  try { return await idbGet<SeedWrapRecord>(db, SEED_WRAP_STORE, personaRootKey(handleIndex)); } finally { db.close(); }
}

/** Land a PRF wrap beside the persona root at `handleIndex`. The cleartext root stays where it stands — the wrap
 *  rides beside, never replaces; a status line names the class the record carries. */
export async function writeBrowserSeedWrap(idbName: string, handleIndex: number, wrap: SeedWrapRecord): Promise<void> {
  const db = await openVesselIdb(idbName);
  try { await idbPut(db, SEED_WRAP_STORE, personaRootKey(handleIndex), wrap); } finally { db.close(); }
}

/** WEAR a persona — set the active handle-index ("put on a mask"). The custody-by-TYPE wall (uniform, no
 *  founding special-case): wearing REQUIRES that this vessel HOLD that persona-root. */
export async function wearBrowserPersona(idbName = "lares:vessel", handleIndex = 0): Promise<void> {
  return coreWearPersona(await makeBrowserIdbPersonaVault(idbName), handleIndex);
}

/** Load the active-persona handle-index the vessel currently WEARS, or undefined when it wears none yet
 *  (no inference from an empty home — the caller decides any default). */
export async function loadBrowserActivePersona(idbName = "lares:vessel"): Promise<number | undefined> {
  return coreLoadActivePersona(await makeBrowserIdbPersonaVault(idbName));
}

/** True when this vessel HOLDS a persona-root at `handleIndex` (founder-side custody). A joinee holds none. */
export async function browserPersonaRootExists(idbName = "lares:vessel", handleIndex = 0): Promise<boolean> {
  return corePersonaRootExists(await makeBrowserIdbPersonaVault(idbName), handleIndex);
}

/** The persona ROSTER — every handle-index this vessel HOLDS a root for, ascending, from the explicit
 *  written record. A one-persona vessel returns `[0]`; a joinee returns `[]`. */
export async function listBrowserPersonaRoots(idbName = "lares:vessel"): Promise<number[]> {
  return coreListPersonaRoots(await makeBrowserIdbPersonaVault(idbName));
}

/**
 * A joinee's browser holds no root, so it cannot WEAR through the root selector (wearPersona gates on
 * hasRoot). It wears its ONE admitted persona through the ANCHOR/EDGE it received at admit. This read
 * answers "which persona am I, as a joinee" from the ANCHOR roster — the founder-signed binding, not a
 * held root.
 *
 * SURFACED (Coreward's joinee-wear path): resolved as a pure ADAPTER READ, no core change. A joinee's
 * admit lands exactly one anchor set (its admitted index), so the anchored-persona roster names the worn
 * persona directly. When a root IS held (a founder), listRoots is the authority and this falls through to
 * the worn selector; a joinee (listRoots()=[]) reads its single anchored index. Undefined only when the
 * vessel is neither founder nor admitted (a bare anon before any founding) — the caller defaults it.
 */
export async function browserJoineePersonaIndex(idbName = "lares:vessel"): Promise<number | undefined> {
  const vault = await makeBrowserIdbPersonaVault(idbName);
  const worn = await vault.selector.load();
  if (worn !== undefined) return worn;                 // an explicit worn pointer wins
  const roots = await vault.listRoots();
  if (roots.length > 0) return roots[0];               // a founder with no explicit pointer → its founding root
  const anchored = await vault.anchors.list();         // a joinee holds anchors, no root → its admitted index
  return anchored.length > 0 ? anchored[0] : undefined;
}

// ── The two-layer PET-NAME stores — the browser twins of the node fs stores ──────────────────────────
//
// Two DISTINCT IDB stores over the vessel's origin DB (v3 additive), keyed `h${N}` per persona:
//   · the PRIVATE pet-name map (PERSONA_PETNAME_STORE) — the human's own label, freely renamable, NEVER
//     federated (persona-petname). The never-federates wall is structural: no board write exists in this
//     shore. A future device-fleet adapter wraps the SAME shape over a private bag for cross-vessel sync.
//   · the PUBLIC published-face record (PERSONA_PUBLIC_HANDLE_STORE) — the vessel's memory of its OWN
//     glamour faces (nym/glamour/causal heads), so a re-publish extends the local frontier
//     (persona-glamour). Distinct from the pet-name map and from the handle-book (others' nyms).

/** The per-persona IDB key — uniform `h${N}`, mirroring the persona-root slots' spelling. */
function personaPetnameKey(handleIndex: number): string { return `h${handleIndex}`; }

/** Parse a `h${N}` store key back to its handle-index, or null when it does not fit the shape. */
function handleIndexFromKey(key: string): number | null {
  const m = /^h(\d+)$/.exec(key);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/**
 * Build the IDB PersonaDeclarationStore — what each persona declares outward: the Handle it answers to and
 * whether it stands for a Kahu seat. Keyed `h${N}`, the browser twin of the node fs declaration map. Nothing
 * here reaches a board — a declaration carries an intent, and only an announce binds a persona to a glamour.
 */
export async function makeBrowserPersonaDeclarationStore(idbName = "lares:vessel"): Promise<PersonaDeclarationStore> {
  return {
    async get(handleIndex) {
      const db = await openVesselIdb(idbName);
      const v  = await idbGet<PersonaDeclaration>(db, PERSONA_DECLARATION_STORE, personaPetnameKey(handleIndex));
      db.close();
      return v && typeof v === "object" ? v : undefined;
    },
    async set(handleIndex, declaration) {
      const db = await openVesselIdb(idbName);
      await idbPut(db, PERSONA_DECLARATION_STORE, personaPetnameKey(handleIndex), declaration);
      db.close();
    },
    async clear(handleIndex) {
      const db = await openVesselIdb(idbName);
      await idbDelete(db, PERSONA_DECLARATION_STORE, personaPetnameKey(handleIndex));
      db.close();
    },
    async entries() {
      const db = await openVesselIdb(idbName);
      const keys = await idbKeys(db, PERSONA_DECLARATION_STORE);
      const pairs: Array<readonly [number, PersonaDeclaration]> = [];
      for (const key of keys) {
        const i = handleIndexFromKey(key);
        if (i === null) continue;
        const v = await idbGet<PersonaDeclaration>(db, PERSONA_DECLARATION_STORE, key);
        if (v && typeof v === "object") pairs.push([i, v] as const);
      }
      db.close();
      return pairs.sort((a, b) => a[0] - b[0]);
    },
  };
}

/**
 * Build the IDB OwnPersonaPetnameStore — the PRIVATE own-persona pet-name map. Keyed `h${N}`, one label per
 * persona. Holds only the human's own labels; nothing here reaches a board (the never-federates wall).
 */
export async function makeBrowserPersonaPetnameStore(idbName = "lares:vessel"): Promise<OwnPersonaPetnameStore> {
  return {
    async get(handleIndex) {
      const db = await openVesselIdb(idbName);
      const v  = await idbGet<string>(db, PERSONA_PETNAME_STORE, personaPetnameKey(handleIndex));
      db.close();
      return typeof v === "string" ? v : undefined;
    },
    async set(handleIndex, petname) {
      const db = await openVesselIdb(idbName);
      await idbPut(db, PERSONA_PETNAME_STORE, personaPetnameKey(handleIndex), petname);
      db.close();
    },
    async clear(handleIndex) {
      const db = await openVesselIdb(idbName);
      await idbDelete(db, PERSONA_PETNAME_STORE, personaPetnameKey(handleIndex));
      db.close();
    },
    async entries() {
      const db = await openVesselIdb(idbName);
      const keys = await idbKeys(db, PERSONA_PETNAME_STORE);
      const pairs: Array<readonly [number, string]> = [];
      for (const key of keys) {
        const i = handleIndexFromKey(key);
        if (i === null) continue;
        const v = await idbGet<string>(db, PERSONA_PETNAME_STORE, key);
        if (typeof v === "string") pairs.push([i, v] as const);
      }
      db.close();
      return pairs.sort((a, b) => a[0] - b[0]);
    },
  };
}

/**
 * Build the IDB OwnPublicHandleStore — the vessel's memory of ITS OWN published glamour faces. Keyed
 * `h${N}`, one record per persona. Records carry ONLY public data (the veiled nym, the display glamour, the
 * causal frontier), so no seal touches them; they persist so a re-publish keeps extending the frontier a peer's
 * HandleBook holds to.
 */
export async function makeBrowserPublicHandleStore(idbName = "lares:vessel"): Promise<OwnPublicHandleStore> {
  return {
    async load(handleIndex) {
      const db = await openVesselIdb(idbName);
      const r  = await idbGet<PersonaPublicHandleRecord>(db, PERSONA_PUBLIC_HANDLE_STORE, personaPetnameKey(handleIndex));
      db.close();
      if (!r || typeof r.nym !== "string" || !Array.isArray(r.heads) || !r.heads.every((head) => typeof head === "string")) return null;
      return r;
    },
    async save(record) {
      const db = await openVesselIdb(idbName);
      await idbPut(db, PERSONA_PUBLIC_HANDLE_STORE, personaPetnameKey(record.handleIndex), record);
      db.close();
    },
    async list() {
      const db = await openVesselIdb(idbName);
      const keys = await idbKeys(db, PERSONA_PUBLIC_HANDLE_STORE);
      db.close();
      return keys.map(handleIndexFromKey).filter((n): n is number => n !== null).sort((a, b) => a - b);
    },
  };
}
