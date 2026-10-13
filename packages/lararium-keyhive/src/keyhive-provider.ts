/// <reference path="./keyhive-wasm-base64.d.ts" />
/**
 * KeyhiveProvider — CapabilityProvider implementation atop @keyhive/keyhive
 * (@keyhive/keyhive 0.3.0-alpha.1).
 *
 * Mapping:
 *   - Lararium bag URL ↔ Keyhive Document, 1:1; wrap documents name no bag
 *   - Operator ed25519 seed → Signer.memorySignerFromBytes
 *   - Peer DID = hex-encoded Identifier bytes (matches Keyhive.idString)
 *   - Access "read" / "admin" passes through verbatim
 *
 * Bag URL ↔ DocumentId mapping lives in-memory; TODO: persist it as
 * tiddler fields under each cap event so it survives daemon restart.
 *
 * Caveats (pre-alpha):
 *   - No security audit; not for adversarial multi-peer use
 *   - Archives and events carry no format tag: bytes one keyhive version wrote do not open under
 *     another. Pin @keyhive/keyhive exactly; a version move is a planned re-founding
 *   - PREKEY_ROTATED fires often; production EventStore should batch
 */

// SLIM build (manual init) — NOT the default "." export, whose wasm-bindgen auto-init
// (`new URL(keyhive_wasm_bg.wasm, import.meta.url)`) mis-resolves in a Web Worker bundle
// and kills the module at evaluation. The slim build does NOT auto-init on import; we feed
// its wasm as CONTENT (off the module graph), the same law the engine bytes obey.
import * as KH from "@keyhive/keyhive/slim";
import { wasmBase64 } from "@keyhive/keyhive/wasm-base64";
import { adaptGate, PONO_FLUSH_GATE, hex as hexEncode, hexToBytes as hexDecode, webDigest } from "@lararium/mesh";
import { base64ToBytes } from "./bytes-base64.js";
import { ingestTolerant } from "./ingest-tolerant.js";
import { inSelfSlice } from "./event-store.js";
import type {
  CapabilityProvider, CapabilityProviderInitOpts,
  DelegateArgs, DelegateResult, VerifyArgs, VerifyResult,
  PeerDID,
  ProviderChunkRest,
} from "./capability-provider.js";

/** setPanicHook installs a global Rust→JS error translator. Calling it twice
 *  panics ("a global default trace dispatcher has already been set"). Guard
 *  with a module-level flag so multiple providers in one process play nice. */
let panicHookInstalled = false;
function ensurePanicHook(): void {
  if (panicHookInstalled) return;
  try { (KH as unknown as { setPanicHook?: () => void }).setPanicHook?.(); } catch { /* already installed */ }
  panicHookInstalled = true;
}

/** The keyhive WASM must instantiate before ANY KH call (including setPanicHook). The slim
 *  build is fed content, never an asset URL — default the package's inlined base64; a host MAY feed
 *  content-addressed bytes (CID/CAS, the engine-bytes law) via setKeyhiveWasmBytes() first.
 *  `initSync` answers a second call with the instance already live, so a worker entry that
 *  instantiated this same module first (init-before-chain-eval) and this call agree; a wasm that
 *  fails to instantiate throws here, where the caller sees it. */
let keyhiveWasmBytesOverride: Uint8Array | undefined;
export function setKeyhiveWasmBytes(bytes: Uint8Array): void { keyhiveWasmBytesOverride = bytes; }
export function ensureKeyhiveWasm(): void {
  (KH as unknown as { initSync: (o: { module: Uint8Array }) => unknown })
    .initSync({ module: keyhiveWasmBytesOverride ?? base64ToBytes(wasmBase64) });
}

function bytesToHex(bytes: Uint8Array): string {
  return "0x" + hexEncode(bytes);
}

/**
 * eventIsland (CIV-3) — self-attribute a cap-event's island (the target Document's id hex, the
 * same key-space bagToDocId + list(islandId) route on) off the event's OWN bytes. DELEGATED reads
 * `subjectId`; REVOKED reads `delegation.subjectId`. The subject is the Document the op acts
 * ON (e.g. the MeshCabal a persona is added INTO), so the founding cross-island edges self-stamp
 * for free. CGKA_OPERATION / PREKEY_ROTATED expose no docId at the JS boundary → undefined, and an
 * unattributed event co-loads into every island's slice — exactly the reach a per-principal prekey
 * needs for RESTORE-OR-FRESH replay. Zero timing dependency; the event carries its own scope.
 */
function eventIsland(e: KH.Event): string | undefined {
  try {
    const sd = e.asSignedDelegation();
    if (sd) return bytesToHex(sd.subjectId.toBytes());
    const sr = e.asSignedRevocation();
    if (sr) return bytesToHex(sr.delegation.subjectId.toBytes());
  } catch { /* a variant without a recoverable subject stays cross-cutting */ }
  return undefined;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return hexDecode(clean);
}

/** Stable ChangeId for a bag URL — deterministic so two registrations of
 *  the same URL produce the same Keyhive Document seed. Hash via SHA-256. */
async function changeIdForBag(bagUrl: string): Promise<KH.ChangeId> {
  const bytes = new TextEncoder().encode(bagUrl);
  return new KH.ChangeId(await webDigest("SHA-256", bytes));
}

/** Content-address a chunk by its own bytes — names one encrypted chunk stably. A real Automerge integration
 *  passes the change's actual hash; absent one, the content hash keeps the ref stable and unique per chunk. */
async function contentRefBytes(content: Uint8Array): Promise<Uint8Array> {
  return webDigest("SHA-256", content);
}

/** An Archive that decodes and restores an identity other than the one the seed derives. Nothing stands. */
export class ArchiveIdentityMismatch extends Error {
  override readonly name = "ArchiveIdentityMismatch";
  constructor(readonly restored: string, readonly seed: string) {
    super(`the at-rest archive restores identity ${restored}… and the seed derives ${seed}…: the archive belongs to another identity, and nothing stands over it`);
  }
}

export class KeyhiveProvider implements CapabilityProvider {
  private kh:         KH.Keyhive | null = null;
  private eventStore: CapabilityProviderInitOpts["eventStore"] | null = null;
  /** Durable rest for the tracked chunks (`bagChunks`). Absent: they rest in memory alone. */
  private chunkRest: ProviderChunkRest | undefined;
  /** CIV-3 — the island (target Document hex) a doc-scoped op is CURRENTLY re-keying. The
   *  fire-and-forget handler reads it to attribute CGKA_OPERATION events, which carry no docId of
   *  their own. Safe because keyhive fires the handler SYNCHRONOUSLY within the op (proven) and the
   *  provider awaits each doc-op sequentially (single-writer law), so set-before / clear-after
   *  never straddles two ops; a CGKA firing OUTSIDE any op reads undefined → cross-cutting. */
  private _activeIsland: string | undefined;
  /** The handler's in-flight store writes. It fires SYNCHRONOUSLY inside a keyhive op and persists
   *  fire-and-forget, so a caller that reads the store the instant an op returns can read it before the
   *  write lands. `settleEvents` awaits these; a first-writer-wins store makes that ordering load-bearing
   *  (a record written ahead of the handler's masks the variant it would have stamped). */
  private pendingWrites: Promise<unknown>[] = [];
  /** How many of the handler's store writes failed. A wrap reads it on both sides of its own operations: a
   *  wrap whose operations never rested could not open again, so it answers nothing. */
  private failedWrites = 0;
  /** What leaves when this provider disposes (`whenDisposed`). */
  private readonly leaving: (() => void)[] = [];
  /** bagUrl → DocumentId bytes (hex). DocumentId class wraps bytes; we
   *  keep the hex form to use as a stable string key. */
  private readonly bagToDocId = new Map<string, string>();
  /** Reverse: docId hex → bagUrl. */
  private readonly docIdToBag = new Map<string, string>();
  /** delegationId (hex of SignedDelegation.signature) → signature bytes. */
  private readonly delegations = new Map<string, Uint8Array>();
  /** delegationId → audience DID (so revoke can rebuild the addMember target). */
  private readonly delegationAudience = new Map<string, string>();
  /** delegationId → bag URL (so revoke knows which document's membership to close). */
  private readonly delegationBag = new Map<string, string>();
  /** bagUrl → (contentRef hex → its latest ciphertext). A re-key re-seals these to the current membership:
   *  keyhive reads FORWARD-ONLY, so a member seated after a chunk was sealed reaches it only once the holder
   *  re-encrypts it at the member's epoch (`reSealBag`). Only ciphertext is held — this holder already decrypts
   *  its own chunks, so plaintext never rests here. Where a `chunkRest` stands, each chunk writes through to it
   *  before `encryptContent` answers, and a provider that stands again finds what it held. A lockbox never
   *  enters this map: it wraps into a document of its own (`wrapToReaders`). */
  private readonly bagChunks = new Map<string, Map<string, Uint8Array>>();
  /** The one contact card this stand mints (see `contactCard`): the mint itself, in flight or settled; null until
   *  the first ask. */
  private standCard: Promise<Uint8Array> | null = null;
  /** CIV-2b — islands whose events already sit in keyhive memory: the self slice seeded eagerly at boot,
   *  every island this vessel minted/adopted live, plus any foreign island a first-access materialized.
   *  A resident island's lazy-load noops. */
  private readonly hydratedIslands = new Set<string>();
  /** CIV-2b — the N=1 default boot (no self set) loads EVERY event eagerly, so no island ever defers;
   *  this flag makes `materializeIsland` a pure noop in that path (byte-identical to before CIV-2b). */
  private allEager = false;

  async init(opts: CapabilityProviderInitOpts): Promise<void> {
    if (this.kh) throw new Error("KeyhiveProvider: already initialized");
    if (opts.seed.length !== 32) throw new Error(`seed must be 32 bytes (got ${opts.seed.length})`);
    ensureKeyhiveWasm();
    ensurePanicHook();
    this.eventStore = opts.eventStore;
    this.chunkRest = opts.chunkRest;

    const signer = KH.Signer.memorySignerFromBytes(opts.seed);
    const store  = KH.CiphertextStore.newInMemory();
    // The identity a boot stands is the SEED's — an Individual's Identifier IS its signer's verifying key
    // (`whoami.toBytes()` === `signer.verifyingKey`). An archive that restores a DIFFERENT identity is a cache
    // of some other founding, never this seed's identity.
    const seedIdentity = bytesToHex(signer.verifyingKey);

    const handler = (event: unknown): void => {
      // Fire-and-forget persistence. Errors get swallowed at this shore —
      // the EventStore impl logs its own failures.
      const e = event as KH.Event;
      try {
        const variant = e.variant;
        const bytes   = e.toBytes();
        // The in-memory store uses synthetic hashes here; a
        // tiddler-backed store will compute content hashes itself.
        const hash    = `${variant}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        // CIV-3 — stamp the island (target Document): DELEGATED / REVOKED self-attribute off their
        // own bytes; CGKA_OPERATION borrows the doc-op's `_activeIsland` (synchronous, single-writer
        // safe); PREKEY_ROTATED stays unattributed (per-principal → co-loaded across every slice).
        const island  = eventIsland(e) ?? (variant === "CGKA_OPERATION" ? this._activeIsland : undefined);
        const put = this.eventStore?.put({ hash, variant, bytes, ...(island !== undefined ? { island } : {}) });
        if (put) this.pendingWrites.push(put.catch(() => { this.failedWrites += 1; }));
      } catch (err) {
        // A capture that throws lost its operation as surely as a write that rejects: a wrap reads this count.
        this.failedWrites += 1;
        console.error("[keyhive] event capture failed:", err);
      }
    };

    // Documents carry the CGKA predecessor key chain, so a LATER-admitted device derives the doc key by
    // replaying events (the multi-vessel admit path — each vessel its OWN key) — replayable access, the right default for
    // one operator's own device swarm (threat model = the operator's devices). keyhive fixes this behavior;
    // it retains secrecy of concurrent and future chunks without a per-init forward-secrecy toggle.
    //
    // RESTORE-OR-FRESH: keyhive prekeys generate per-init, so a joinee that was admitted (its membership
    // sealed to its earlier prekeys) MUST restore from its Archive — which carries the prekey SECRETS and the
    // stable card — or a fresh init orphans them and the shared content reads "Key not found". Absent an
    // archive, mint a fresh identity (the founding path, and every not-yet-admitted vessel).
    if (opts.archiveBytes) {
      // AN ARCHIVE THAT DOES NOT DECODE REFUSES THE STAND. These bytes opened under the vessel key, so a decode
      // fault means this build cannot read what the vessel keeps; standing a fresh identity in its place would
      // strand every group the kept one created, silently. The fault names itself and nothing mints over it.
      this.kh = await new KH.Archive(opts.archiveBytes).tryToKeyhive(store, signer, handler);
      // A READABLE ARCHIVE OF ANOTHER IDENTITY REFUSES THE STAND. An Individual's identifier IS its signer's
      // verifying key, so an archive that restores any other identity belongs to another seed. Restoring it would
      // split the provider (`whoami` reads the archive's key while the contact card presents the seed's signer),
      // and standing fresh in its place would let the next export land an empty identity over the kept row. The
      // row and the seed disagree: the fault names itself, the provider holds nothing, and whoever founds a face
      // anew writes that face's own archive in the act that founds it.
      if (bytesToHex(this.kh.whoami.toBytes()) !== seedIdentity) {
        const restored = bytesToHex(this.kh.whoami.toBytes()).slice(0, 20);
        this.kh = null;
        throw new ArchiveIdentityMismatch(restored, seedIdentity.slice(0, 20));
      }
    } else {
      this.kh = await KH.Keyhive.init(signer, store, handler);
    }
  }

  /**
   * Serialize this vessel's WHOLE keyhive identity — prekey secrets, membership/CGKA state, and the stable
   * contact card — for durable restore across reboots (feed the bytes back via `init({ archiveBytes })`).
   *
   * The bytes carry RAW SECRET key material; persist them ENCRYPTED-AT-REST, never in the clear. A joinee
   * exports right after generating the card it hands the founder, so the identity the founder mints-to is the
   * identity that boots. The canonical whole-identity path (probe: `prekey-persist-reboot` — restore keeps
   * both decrypt AND the same card, where `exportPrekeySecrets` alone loses the card).
   */
  async exportArchive(): Promise<Uint8Array> {
    return (await this.requireKh().toArchive()).toBytes();
  }

  private requireKh(): KH.Keyhive {
    if (!this.kh) throw new Error("KeyhiveProvider: not initialized — call init() first");
    return this.kh;
  }

  /** CIV-3 — run a doc-scoped keyhive op with `_activeIsland` set to its Document, so the CGKA
   *  events it emits synchronously attribute to that island; the `finally` clears it so no later
   *  out-of-op CGKA/prekey mis-reads a stale scope. */
  private async withActiveIsland<T>(docIdHex: string, fn: () => Promise<T>): Promise<T> {
    this._activeIsland = docIdHex;
    try { return await fn(); } finally { this._activeIsland = undefined; }
  }

  async whoami(): Promise<PeerDID> {
    // NOT idString — that formatter trims per-byte leading zeros and
    // produces strings of inconsistent length (~60 chars vs the canonical
    // 64). Use the raw bytes via `whoami: IndividualId` and our own hex.
    return bytesToHex(this.requireKh().whoami.toBytes());
  }

  /**
   * This stand's contact card. ONE CARD PER STAND: the first call mints it and every later call answers the same
   * bytes.
   *
   * Minting a card mints a prekey, and a prekey's secret rests in this provider and in whatever Archive leaves
   * AFTER the mint. A stand that minted a card per ask would hand peers prekeys no kept Archive holds: the peer
   * adds this identity under one, the stand ends, and the next stand reads `Key not found`. So a stand mints once,
   * the shore takes the Archive after that mint (`exportArchiveAfterTheCard`), and every prekey this identity ever
   * presented stays openable from the Archive lineage.
   */
  async contactCard(): Promise<Uint8Array> {
    // THE MINT IN FLIGHT IS THE CARD. Two asks that arrive together await one mint: the promise rests here before
    // the wasm answers, so a second ask never passes an empty slot and mints a second prekey.
    this.standCard ??= (async () => {
      // ContactCard serializes as JSON (toJson / fromJson).
      // We wrap it in a UTF-8 byte form so transport layers stay byte-uniform.
      const card = await this.requireKh().contactCard();
      return new TextEncoder().encode(card.toJson());
    })();
    const minting = this.standCard;
    try {
      return (await minting).slice();
    } catch (err) {
      // A mint that refused leaves no card: the next ask mints again.
      if (this.standCard === minting) this.standCard = null;
      throw err;
    }
  }

  /** The Archive of this stand WITH its card's prekey inside: mints the stand's card first when none stands yet. */
  async exportArchiveAfterTheCard(): Promise<Uint8Array> {
    await this.contactCard();
    return this.exportArchive();
  }

  async receiveContactCard(bytes: Uint8Array): Promise<{ id: PeerDID }> {
    const json = new TextDecoder().decode(bytes);
    const card = KH.ContactCard.fromJson(json);
    const individual = await this.requireKh().receiveContactCard(card);
    const idBytes = individual.toBytes();
    return { id: bytesToHex(idBytes) };
  }

  async registerBag(bagUrl: string): Promise<{ docId: string }> {
    const cached = this.bagToDocId.get(bagUrl);
    if (cached) return { docId: cached };

    const cid = await changeIdForBag(bagUrl);
    const docId = await this.requireKh().generateDocument([], cid, []);
    const docIdHex = bytesToHex(docId.toBytes());
    this.bagToDocId.set(bagUrl, docIdHex);
    this.docIdToBag.set(docIdHex, bagUrl);
    this.hydratedIslands.add(docIdHex);   // CIV-2b — a freshly-minted island is live in memory, never deferred
    return { docId: docIdHex };
  }

  /**
   * Whether this provider still holds its hand in a bag's document: the document resolves and this identity rides
   * its key agreement. It reads KEY AGREEMENT, never access grade: a true answer says this stand can derive the
   * document's keys, and `delegate` still judges whether its grant admits the act. Cap events carry a document's membership lattice and never a member's key agreement
   * state, so a document known from replayed events alone, created by a stand whose Archive nobody kept, reads
   * with no member here and answers false; `delegate` and `encryptContent` both refuse on it.
   */
  async holdsHand(bagUrl: string): Promise<boolean> {
    const docIdHex = this.bagToDocId.get(bagUrl);
    if (!docIdHex) return false;
    await this.ensureIsland(docIdHex);
    const kh = this.requireKh();
    // An identity that names no document (bytes that parse as none) holds nobody's hand, this provider's included.
    let docId: KH.DocumentId;
    try { docId = new KH.DocumentId(hexToBytes(docIdHex)); } catch { return false; }
    const doc = await kh.getDocument(docId);
    if (!doc) return false;
    const self = bytesToHex(kh.whoami.toBytes());
    const members = await doc.cgkaMembers();
    return members.some((id) => bytesToHex(id.toBytes()) === self);
  }

  /** Mint a fresh document for `bagUrl`, replacing whatever mapping stood (see `holdsHand`). */
  async remintBag(bagUrl: string): Promise<{ docId: string }> {
    const prior = this.bagToDocId.get(bagUrl);
    if (prior) { this.bagToDocId.delete(bagUrl); this.docIdToBag.delete(prior); }
    // Ciphertext this process remembered for the bag belongs to the document that leaves; a later re-seal reads
    // the chunk cache through the bag's CURRENT document and would refuse on every one of them.
    this.bagChunks.delete(bagUrl);
    if (prior && this.chunkRest) await this.chunkRest.drop(await this.chunkShelf(bagUrl, prior));
    return this.registerBag(bagUrl);
  }

  /**
   * Adopt a bag's document minted by a PEER — the joinee records the founder's `docId` for a shared bag URL
   * instead of generating its own (`registerBag` mints a NEW doc, which would never match). The founder ships
   * the docId; after the joinee ingests the membership events, `requireDoc` resolves it and content decrypts.
   */
  adoptBag(bagUrl: string, docIdHex: string): void {
    this.bagToDocId.set(bagUrl, docIdHex);
    this.docIdToBag.set(docIdHex, bagUrl);
    // CIV-2b — a peer's bag hydrates from the WIRE (ingestPeerEvents), not the deferred local store, so a
    // first access must NOT try to lazy-load it from `list()` — mark it resident the moment we adopt it.
    this.hydratedIslands.add(docIdHex);
  }

  async delegate(args: DelegateArgs): Promise<DelegateResult> {
    const docIdHex = this.bagToDocId.get(args.bagUrl);
    if (!docIdHex) throw new Error(`bag not registered: ${args.bagUrl} (call registerBag first)`);
    await this.ensureIsland(docIdHex);   // CIV-2b — first access materializes a boot-deferred island
    const docId = new KH.DocumentId(hexToBytes(docIdHex));

    const access = KH.Access.tryFromString(args.access);
    if (!access) throw new Error(`invalid access: ${args.access} (Keyhive accepts only "relay", "read", "edit", or "admin")`);

    const audienceId = new KH.Identifier(hexToBytes(args.audience));
    const audienceAgent = await this.requireKh().getAgent(audienceId);
    if (!audienceAgent) throw new Error(`audience not known to this provider — exchange contact cards first`);

    // A grant names a document this provider holds; an id it cannot resolve refuses here, by bag.
    const doc = await this.requireKh().getDocument(docId);
    if (!doc) throw new Error(`document not in scope (lost from local state?): ${args.bagUrl}`);

    // addMember returns the SignedDelegation directly (the group re-keys to the new reader's own prekey).
    const signedDelegation = await this.withActiveIsland(docIdHex, () => this.requireKh().addMember(
      audienceAgent.id, KH.MemberedId.document(docId), access, [],
    ));

    // SignedDelegation exposes .signature: Uint8Array (unique per delegation) — we use
    // its hex as a stable delegationId for revocation. The transport bytes for the
    // audience peer flow through the event_handler (DELEGATED + the CGKA ops addMember
    // also fires) into the EventStore; callers ship those to admit a peer.
    const sigBytes = signedDelegation.signature;
    const delegationId = bytesToHex(sigBytes);
    this.delegations.set(delegationId, sigBytes);
    // Track audience+bag+access for revoke().
    this.delegationAudience.set(delegationId, args.audience);
    this.delegationBag.set(delegationId, args.bagUrl);
    return { delegationId, bytes: sigBytes };
  }

  /** Resolve a registered bag to its live Keyhive Document, or throw with the bag named. */
  private async requireDoc(bagUrl: string): Promise<KH.Document> {
    const docIdHex = this.bagToDocId.get(bagUrl);
    if (!docIdHex) throw new Error(`bag not registered: ${bagUrl} (call registerBag first)`);
    await this.ensureIsland(docIdHex);   // CIV-2b — first access materializes a boot-deferred island
    const doc = await this.requireKh().getDocument(new KH.DocumentId(hexToBytes(docIdHex)));
    if (!doc) throw new Error(`document not in scope (lost from local state?): ${bagUrl}`);
    return doc;
  }

  /**
   * Encrypt content INTO a bag's document — the CGKA keys it to every current member's leaf.
   *
   * ORDER IS LOAD-BEARING: keyhive read runs FORWARD-ONLY, so a member reads only content encrypted AT OR
   * AFTER its own `delegate()`/add. Call `registerBag` then `delegate` (add every reader vessel) BEFORE this,
   * or the fresh reader will hit `Key not found` on `decryptContent`. Granting a member PRE-EXISTING content
   * means re-encrypting each chunk here after the add (the same public-ops path, no secret leaves).
   *
   * `contentRef` names the chunk (a real Automerge integration passes the change hash); absent, the content
   * hashes to its own ref. The returned bytes are the ciphertext blob to ship — E2E, safe on any relay.
   */
  async encryptContent(bagUrl: string, content: Uint8Array, opts?: {
    readonly contentRef?: Uint8Array; readonly predRefs?: readonly Uint8Array[];
  }): Promise<Uint8Array> {
    const doc = await this.requireDoc(bagUrl);
    const refBytes = opts?.contentRef ?? await contentRefBytes(content);
    const cid = new KH.ChangeId(refBytes);
    const preds = (opts?.predRefs ?? []).map((r) => new KH.ChangeId(r));
    const docIdHex = this.bagToDocId.get(bagUrl)!; // requireDoc guaranteed it (throws when absent)
    const result = await this.withActiveIsland(docIdHex, () => this.requireKh().tryEncrypt(doc.docId, cid, preds, content));
    const ciphertext = result.encryptedContent().toBytes();
    // Remember the chunk by its ref so a later re-key can RE-SEAL it — the pre-seat chunk a re-delegate cannot
    // reach on its own (forward-only read). A re-seal overwrites this same entry with the fresh ciphertext.
    let chunks = this.bagChunks.get(bagUrl);
    if (!chunks) { chunks = new Map(); this.bagChunks.set(bagUrl, chunks); }
    chunks.set(bytesToHex(refBytes), ciphertext);
    if (this.chunkRest) await this.chunkRest.put(await this.chunkShelf(bagUrl, docIdHex), bytesToHex(refBytes), ciphertext);
    return ciphertext;
  }

  /**
   * RE-SEAL a bag's standing chunks to the CURRENT membership, returning the fresh ciphertext per chunk.
   *
   * keyhive reads FORWARD-ONLY: a member seated after a chunk was sealed reads `Key not found` on it, and a
   * re-delegate re-keys the bag FORWARD without moving any already-sealed chunk. This decrypts each tracked
   * chunk with this holder's own key and re-encrypts it at the current epoch, so a just-seated member reaches
   * it. Run it AFTER the seat + re-delegate. Plaintext is transient — never held, never returned; the caller
   * persists and ships the fresh ciphertext. Empty when this holder tracks no chunk for the bag.
   */
  async reSealBag(bagUrl: string): Promise<{ contentRef: Uint8Array; ciphertext: Uint8Array }[]> {
    let chunks = this.bagChunks.get(bagUrl);
    if ((!chunks || chunks.size === 0) && this.chunkRest) {
      const docId = this.bagToDocId.get(bagUrl);
      if (docId) {
        const rows = await this.chunkRest.list(await this.chunkShelf(bagUrl, docId));
        if (rows.length) {
          chunks = new Map(rows.map(({ refHex, ciphertext }) => [refHex, Uint8Array.from(ciphertext)]));
          this.bagChunks.set(bagUrl, chunks);
        }
      }
    }
    if (!chunks || chunks.size === 0) return [];
    const out: { contentRef: Uint8Array; ciphertext: Uint8Array }[] = [];
    // Snapshot the entries — encryptContent overwrites this same map as it re-seals each chunk.
    for (const [refHex, ct] of [...chunks.entries()]) {
      const plaintext = await this.decryptContent(bagUrl, ct);
      const refBytes = hexToBytes(refHex);
      const fresh = await this.encryptContent(bagUrl, plaintext, { contentRef: refBytes });
      out.push({ contentRef: refBytes, ciphertext: fresh });
    }
    return out;
  }

  /** The opaque name a bag's tracked chunks rest under: a digest of the bag URL and its document, so the URL
   *  never reaches the rest. A reminted bag takes a fresh shelf, and the old one gets dropped. */
  private async chunkShelf(bagUrl: string, docIdHex: string): Promise<string> {
    return hexEncode(await webDigest("SHA-256", new TextEncoder().encode(`${bagUrl}\n${docIdHex}`)));
  }

  /**
   * WRAP a payload into a FRESH document that seats exactly `readers` beside this identity: the lockbox wrap
   * (lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-records).
   *
   * A wrap document belongs to one lockbox. It takes its members here and never again, seals this one payload
   * under `contentRef` with no predecessor, and names no bag: it never enters the bag maps or the tracked
   * chunks. A removal therefore never has to reach it, and a later seat finds no earlier key in it
   * (`tests/seat-roll-substrate.probe.test.ts` 8 measures why a wrap through a bag's own document fails both).
   *
   * A reader this identity holds no contact card for goes `unreached`, and no member gets added for it. A
   * failure after the document minted throws: no half-wrapped answer leaves.
   *
   * THE WRAP'S OWN OPERATIONS REACH THE EVENT STORE BEFORE IT ANSWERS, and a write that failed there fails the
   * wrap. This identity still opens the wrap only from an Archive taken AFTER it (`lockbox-wrap.test.ts`), so
   * the caller rests that Archive before it rests the lockbox (`keyhive-lockbox`).
   */
  async wrapToReaders(args: { readonly readers: readonly string[]; readonly contentRef: Uint8Array; readonly payload: Uint8Array }):
    Promise<{ docIdHex: string; ciphertext: Uint8Array; served: string[]; unreached: string[] }> {
    if (!(args.contentRef instanceof Uint8Array) || args.contentRef.length !== 32) throw new TypeError("[keyhive] a wrap's content reference rides exactly 32 bytes");
    const kh = this.requireKh();
    const self = bytesToHex(kh.whoami.toBytes());
    const readers = [...new Set(args.readers.map((id) => bytesToHex(hexToBytes(id))))].filter((id) => id !== self);
    const known: { id: string; agent: KH.Agent }[] = [];
    const unreached: string[] = [];
    for (const id of readers) {
      const agent = await kh.getAgent(new KH.Identifier(hexToBytes(id)));
      if (agent) known.push({ id, agent }); else unreached.push(id);
    }
    const read = KH.Access.tryFromString("read");
    if (!read) throw new Error("[keyhive] Access.tryFromString('read') returned undefined");
    await this.settleEvents();
    const failedBefore = this.failedWrites;
    const docId = await kh.generateDocument([], new KH.ChangeId(args.contentRef), []);
    const docIdHex = bytesToHex(docId.toBytes());
    this.hydratedIslands.add(docIdHex);   // minted here: live in memory, never deferred
    const encrypted = await this.withActiveIsland(docIdHex, async () => {
      for (const { agent } of known) await kh.addMember(agent.id, KH.MemberedId.document(docId), read, []);
      return kh.tryEncrypt(docId, new KH.ChangeId(args.contentRef), [], args.payload);
    });
    await this.settleEvents();
    if (this.failedWrites !== failedBefore) throw new Error("[keyhive] the wrap's own operations did not reach the event store, so no lockbox leaves");
    return { docIdHex, ciphertext: encrypted.encryptedContent().toBytes(), served: known.map(({ id }) => id), unreached };
  }

  /**
   * OPEN what a wrap document sealed. Throws where this identity holds no seat in it or cannot name it. A
   * wrapper that booted with the document's island deferred materializes it first.
   */
  async unwrapFromDocument(docIdHex: string, ciphertext: Uint8Array): Promise<Uint8Array> {
    const hexId = bytesToHex(hexToBytes(docIdHex));
    await this.ensureIsland(hexId);
    return this.requireKh().tryDecrypt(new KH.DocumentId(hexToBytes(hexId)), KH.Encrypted.fromBytes(ciphertext));
  }

  /**
   * Decrypt a ciphertext blob a peer shipped for a bag's document. Succeeds only when this vessel already
   * holds membership reaching the chunk's CGKA epoch (it decrypts with its OWN prekey secret — nothing
   * secret ever crossed the wire). A member added AFTER the chunk was encrypted reads `Key not found`.
   */
  async decryptContent(bagUrl: string, encryptedBytes: Uint8Array): Promise<Uint8Array> {
    const doc = await this.requireDoc(bagUrl);
    return this.requireKh().tryDecrypt(doc.docId, KH.Encrypted.fromBytes(encryptedBytes));
  }

  /**
   * The PUBLIC events keyhive routes to a specific peer — the membership + CGKA ops a joinee ingests to
   * reach the group key. Capture this AFTER `encryptContent`, so it carries the PCS update op that keyed the
   * content to the joinee's leaf. Every element is public (encrypted-to-prekey CGKA path ciphertext); no
   * prekey secret, no archive, no application key rides here — the joinee holds only its own prekey secret.
   */
  async eventsForPeer(peerAgentIdHex: string): Promise<Uint8Array[]> {
    const agent = await this.requireKh().getAgent(new KH.Identifier(hexToBytes(peerAgentIdHex)));
    if (!agent) throw new Error(`peer not known to this provider — exchange contact cards first: ${peerAgentIdHex.slice(0, 16)}…`);
    const map = await this.requireKh().eventsForAgent(agent);
    return [...(map as Map<unknown, unknown>).values()] as Uint8Array[];
  }

  /** Ingest the public events a peer shipped (from their `eventsForPeer`) — establishes membership/CGKA state. */
  async ingestPeerEvents(events: readonly Uint8Array[]): Promise<void> {
    await this.requireKh().ingestEventsBytes(events as Uint8Array[]);
  }

  /**
   * Revoke a delegation by its id (the delegation's signature hex from `delegate()`).
   *
   * Bridges our wrapper to Keyhive's live `revokeMember` — the concap promise made real:
   * revocation is a CONVERGENT CRDT op (it fires REVOKED events into the event_handler/
   * EventStore that converge across replicas; offline peers stay authorized locally until
   * they sync the revocation — eventual, per concap, never synchronous). `retain_all_other_
   * members=true` revokes ONLY this audience's membership, leaving the rest intact.
   */
  async revoke(delegationId: string): Promise<{ bytes: Uint8Array }> {
    if (!this.delegations.has(delegationId)) {
      throw new Error(`unknown delegationId: ${delegationId}`);
    }
    const audience = this.delegationAudience.get(delegationId);
    const bagUrl   = this.delegationBag.get(delegationId);
    if (!audience || !bagUrl) {
      throw new Error(`revoke(): no audience/bag tracked for delegationId ${delegationId.slice(0, 16)}…`);
    }
    const docIdHex = this.bagToDocId.get(bagUrl);
    if (!docIdHex) throw new Error(`revoke(): bag not registered: ${bagUrl}`);
    const docId = new KH.DocumentId(hexToBytes(docIdHex));
    const doc   = await this.requireKh().getDocument(docId);
    if (!doc) throw new Error(`revoke(): document not in scope: ${bagUrl}`);

    const audienceId    = new KH.Identifier(hexToBytes(audience));
    const audienceAgent = await this.requireKh().getAgent(audienceId);
    if (!audienceAgent) throw new Error(`revoke(): audience agent not known: ${audience.slice(0, 16)}…`);

    const revocations = await this.withActiveIsland(docIdHex, () => this.requireKh().revokeMember(
      audienceAgent.id, true, KH.MemberedId.document(docId),
    ));
    if (!revocations || revocations.length === 0) {
      throw new Error("revoke(): revokeMember produced no revocation events");
    }
    // Mirror delegate()'s "signature as id"; the events themselves ride the event_handler → EventStore.
    const bytes = revocations[0]!.signature;
    // This delegation is revoked — drop local tracking so a re-revoke fails loud rather than re-firing.
    this.delegations.delete(delegationId);
    this.delegationAudience.delete(delegationId);
    this.delegationBag.delete(delegationId);
    return { bytes };
  }

  async verify(args: VerifyArgs): Promise<VerifyResult> {
    const docIdHex = this.bagToDocId.get(args.bagUrl);
    if (!docIdHex) {
      return { ok: false, reason: `bag not registered: ${args.bagUrl}` };
    }
    await this.ensureIsland(docIdHex);   // CIV-2b — first access materializes a boot-deferred island
    const docId = new KH.DocumentId(hexToBytes(docIdHex));
    const presenterId = new KH.Identifier(hexToBytes(args.presenter));

    const granted = await this.requireKh().accessForDoc(presenterId, docId);
    if (!granted) {
      return { ok: false, reason: "no access granted" };
    }
    const grantedStr = granted.toString().toLowerCase();
    // The gate is binary: ANY grant answers a read, and only an admin grant answers admin.
    if (args.access === "read")  return { ok: true };
    if (args.access === "admin" && grantedStr === "admin") return { ok: true };
    return { ok: false, reason: `granted=${grantedStr}, required=${args.access}` };
  }

  /**
   * Create a sentinel Document used as a membership principal.
   *
   * Keyhive's Group primitive carries the semantically correct shape for a
   * membership cabal (Person-Group, Mesh kahu-cabal), and GroupId round-trips
   * through `constructor(bytes)` / `toBytes()`, so persistence does not decide it.
   *
   * WHICH PRINCIPAL TAKES A GROUP IS RULED, and it is not the cabal. A Group carries one
   * HUMAN'S cloud — a veil, a PersonaGroup, the footprints of a single person — where
   * membership really is nested and `transitiveMembers()` answers a question somebody asks.
   * A CABAL keeps its Document: canon #the-realm names a realm by its content-addressed doc
   * identity, and a cabal IS the shared relation over that realm's resources, so it has no
   * other name to take. Cabals-as-Groups stands OUT OF SCOPE rather than merely unbuilt.
   *
   * Today every principal here is a sentinel Document, PersonaGroup included.
   *
   * Returns both the DocumentId hex (for bag-level accessForDoc checks) and
   * the Document's agent Identifier hex (for adding this sentinel as a member
   * of another sentinel via addMember).
   */
  async createSentinelDoc(sentinelUri: string): Promise<{ docIdHex: string; agentIdHex: string }> {
    const cid = await changeIdForBag(sentinelUri);
    const docId = await this.requireKh().generateDocument([], cid, []);
    const doc = await this.requireKh().getDocument(docId);
    if (!doc) throw new Error("[keyhive] generated sentinel document is not available");
    const docIdHex   = bytesToHex(docId.toBytes());
    const agentIdHex = bytesToHex(doc.id.toBytes());
    return { docIdHex, agentIdHex };
  }

  /**
   * Add an agent (by its Identifier hex) as an Daemon member of a sentinel Document.
   * Used during the founding ceremony to wire vessel Individual → PersonaGroup
   * and PersonaGroup → MeshCabal chains.
   */
  async addSentinelMember(
    memberIdentifierHex: string,
    sentinelDocIdHex:    string,
  ): Promise<void> {
    const docId  = new KH.DocumentId(hexToBytes(sentinelDocIdHex));
    const doc    = await this.requireKh().getDocument(docId);
    if (!doc) throw new Error(`[keyhive] sentinel doc not found: ${sentinelDocIdHex.slice(0, 16)}…`);

    const agentId = new KH.Identifier(hexToBytes(memberIdentifierHex));
    const agent   = await this.requireKh().getAgent(agentId);
    if (!agent) throw new Error(`[keyhive] agent not found for sentinel addMember: ${memberIdentifierHex.slice(0, 16)}…`);

    const access  = KH.Access.tryFromString("admin");
    if (!access) throw new Error("[keyhive] Access.tryFromString('admin') returned undefined");

    await this.withActiveIsland(sentinelDocIdHex, () => this.requireKh().addMember(agent.id, KH.MemberedId.document(docId), access, []));
  }

  /**
   * Revoke an agent's (by Identifier hex) membership on a sentinel Document — the
   * symmetric close of the sentinel trio (createSentinelDoc / addSentinelMember /
   * verifySentinelMembership → +revokeSentinelMember). The public `revoke()` only
   * serves a `delegate()`-tracked delegationId; a sentinel member added via
   * `addSentinelMember` produces no such id, so it needs this audience+doc path.
   *
   * CONVERGENT-REMOVAL (canon cabal-realm#the-tie-break — "malice rides Keyhive
   * convergent-removal, never the counter"): `retain_all_other_members=true`
   * revokes ONLY this audience, leaving the rest intact; the REVOKED events fire
   * into the event_handler/EventStore and converge across replicas (eventual, per
   * concap — an offline peer stays authorized locally until it syncs the tombstone).
   */
  async revokeSentinelMember(
    memberIdentifierHex: string,
    sentinelDocIdHex:    string,
  ): Promise<{ bytes: Uint8Array }> {
    const docId = new KH.DocumentId(hexToBytes(sentinelDocIdHex));
    const doc   = await this.requireKh().getDocument(docId);
    if (!doc) throw new Error(`[keyhive] sentinel doc not found for revoke: ${sentinelDocIdHex.slice(0, 16)}…`);

    const agentId = new KH.Identifier(hexToBytes(memberIdentifierHex));
    const agent   = await this.requireKh().getAgent(agentId);
    if (!agent) throw new Error(`[keyhive] agent not found for sentinel revoke: ${memberIdentifierHex.slice(0, 16)}…`);

    const revocations = await this.withActiveIsland(sentinelDocIdHex, () => this.requireKh().revokeMember(agent.id, true, KH.MemberedId.document(docId)));
    if (!revocations || revocations.length === 0) {
      throw new Error("[keyhive] revokeSentinelMember produced no revocation events");
    }
    return { bytes: revocations[0]!.signature };
  }

  /**
   * Answer one seat on a sentinel Document for the key side of a removal (kapae#/keys), and say HOW it answered.
   *
   *   · `gone`         — the party holds no access here: it left already, or never sat. A revocation that finds
   *                      the party gone reads as done, so this never throws and writes nothing.
   *   · `revoked`      — this identity revoked the seat. The removal converges across replicas.
   *   · `no-authority` — the seat stands, and this identity holds no hand over it. REVOKE AUTHORITY FOLLOWS THE
   *                      SEATING LINEAGE: the hand that seated a party revokes it, and so does a hand upstream of
   *                      that seat; a peer seated beside the party holds none, admin or not. A party seated by
   *                      two hands leaves only under a hand upstream of both, and the refusal covers the whole
   *                      call (`tests/seat-roll-substrate.probe.test.ts` measures each).
   *
   * WHAT A REVOCATION HERE DOES NOT REACH. It closes the lattice and removes the party's leaf from THIS
   * document's key agreement. A bag delegated to this sentinel keeps the party's leaf: the removal travels down
   * to the documents a Keyhive Group reaches and to nothing a Document reaches (the same probe, 8 and 9). A
   * bag's own content key rolls by the subscriber to the seat's roll, never by this call.
   */
  async revokeSentinelSeat(
    memberIdentifierHex: string,
    sentinelDocIdHex:    string,
  ): Promise<{ how: "revoked" | "gone" | "no-authority" }> {
    const kh = this.requireKh();
    const docId = new KH.DocumentId(hexToBytes(sentinelDocIdHex));
    if (!(await kh.getDocument(docId))) throw new Error(`[keyhive] sentinel doc not found for seat revoke: ${sentinelDocIdHex.slice(0, 16)}…`);
    const identifier = new KH.Identifier(hexToBytes(memberIdentifierHex));
    // Standing reads FIRST: a second revocation of a seat already gone produces no event and would throw.
    if (!(await kh.getAgent(identifier)) || !(await kh.accessForDoc(identifier, docId))) return { how: "gone" };
    try {
      await this.revokeSentinelMember(memberIdentifierHex, sentinelDocIdHex);
    } catch (err) {
      const said = err instanceof Error ? err.message : String(err);
      if (/proof missing/i.test(said)) return { how: "no-authority" };
      throw err;
    }
    return { how: "revoked" };
  }

  /**
   * ENUMERATE the individuals reaching a sentinel Document, from its CGKA tree.
   *
   * `verifySentinelMembership` answers "does THIS hex hold access" and so needs a
   * candidate already in hand; this answers "who reaches here" with no candidate at
   * all. A realm whose dwellers arrived through a peer can be read only this way.
   *
   * The tree carries the EFFECTIVE reader set, which a delegation list does not: a
   * member joining a group that already holds access widens this and moves no
   * delegation. Empty where the document has no initialized CGKA.
   *
   * The count is this replica's. An offering that has not synced here is absent, so
   * a caller MUST NOT read the length as a total across the mesh.
   */
  async sentinelCgkaMembers(sentinelDocIdHex: string): Promise<string[]> {
    const docId = new KH.DocumentId(hexToBytes(sentinelDocIdHex));
    const doc   = await this.requireKh().getDocument(docId);
    if (!doc) throw new Error(`[keyhive] sentinel doc not found for cgka read: ${sentinelDocIdHex.slice(0, 16)}…`);
    const ids = await doc.cgkaMembers();
    return ids.map((id) => bytesToHex(id.toBytes()));
  }

  /**
   * Verify that an agent (by Identifier hex) holds any access on a sentinel Document.
   * Gate B: vesselIndividualHex vs personaGroupDocIdHex
   * Gate C: personaGroupAgentIdHex vs meshCabalDocIdHex
   *
   * Returns VerifyResult shape for consistency with verify().
   */
  async verifySentinelMembership(
    agentIdentifierHex: string,
    sentinelDocIdHex:   string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const docId      = new KH.DocumentId(hexToBytes(sentinelDocIdHex));
    const identifier = new KH.Identifier(hexToBytes(agentIdentifierHex));
    const access     = await this.requireKh().accessForDoc(identifier, docId);
    if (!access) return { ok: false, reason: "no access granted in sentinel" };
    return { ok: true };
  }

  /**
   * Whether this provider can name an agent (by Identifier hex) — a delegation to an unknown audience
   * throws, so a caller deciding WHETHER to delegate reads this first. A group agent reads known only
   * once its membership events reached this provider (the seat), never from the pinned id alone.
   */
  async knowsAgent(agentIdentifierHex: string): Promise<boolean> {
    const agent = await this.requireKh().getAgent(new KH.Identifier(hexToBytes(agentIdentifierHex)));
    return agent !== undefined && agent !== null;
  }

  /**
   * Return the operator vessel's IndividualId as a hex Identifier string.
   * Used during init to wire the founding vessel into the PersonaGroup sentinel.
   */
  async vesselIdentifierHex(): Promise<string> {
    const individual = await this.requireKh().individual();
    return bytesToHex(individual.id.toBytes());
  }

  /**
   * Replay persisted events back into Keyhive's in-memory state (boot). CIV-2 boot-flatness: pass
   * `selfIslands` (the vessel's OWN sentinel doc-ids) to hydrate only the self slice eagerly — the
   * self islands PLUS the cross-cutting events every island co-loads — so boot cost tracks the self
   * surface, never the held-principal count. A held/foreign island's events fall outside the eager
   * slice (`deferred`) and materialize lazily on first access (the island IS the ratchet boundary,
   * so deferring it stays decryptability-safe for the self slice). Absent `selfIslands` → every
   * event loads eagerly (the N=1 daemon default, byte-identical to before). `deferred` counts the
   * held-island events left for lazy load (always 0 in the default path).
   *
   * PACED by the homeostatic depth SERVO (#13 — the boot-CPU spike): the replay ingests in chunks whose
   * depth SERVOS toward a per-chunk latency set-point (gate-tuning `adaptGate`, negative feedback) —
   * smaller batches when a chunk runs slow, larger when there is headroom — with an event-loop yield
   * between them. A large N=1 keyhive replay no longer pegs the loop synchronously (243% → the
   * vessel-ready → UDS signal breathes between chunks), and the pace ADAPTS to the load instead of a
   * fixed guess. Keyhive resolves causality internally — order across ingest calls does not matter —
   * so chunking is byte-equivalent to one batch, only kinder to the loop.
   */
  async hydrateFromEventStore(selfIslands?: readonly string[]): Promise<{ ingested: number; skipped: number; deferred: number }> {
    if (!this.eventStore) return { ingested: 0, skipped: 0, deferred: 0 };
    const records = await this.eventStore.list();
    const eager = selfIslands === undefined ? records : records.filter((r) => inSelfSlice(r, selfIslands));
    const deferred = records.length - eager.length;
    // CIV-2b — record what boot already holds, so a first-access lazy-load noops for it. The default
    // (no self set) loads EVERY event → flag allEager, and materializeIsland stays a pure noop. With a
    // self set, the self islands are resident; cross-cutting events (island-undefined) always ride the
    // eager slice too, so only genuinely-foreign islands remain to materialize on demand.
    if (selfIslands === undefined) this.allEager = true;
    else for (const id of selfIslands) this.hydratedIslands.add(id);
    const { ingested, skipped } = await this.ingestChunked(eager.map((r) => r.bytes));
    return { ingested, skipped, deferred };
  }

  /**
   * Replay a slice of event bytes into keyhive, PACED by the homeostatic depth SERVO (#13 — the boot-CPU
   * spike): each chunk's depth SERVOS toward a per-chunk latency set-point (`adaptGate`, negative feedback) —
   * smaller batches when a chunk runs slow, larger with headroom — with an event-loop yield between them, so
   * a large replay never pegs the loop synchronously. Torn-tolerant (CIV-1): a corrupt record degrades its
   * own membership slice (`skipped`), never fells the replay. Keyhive resolves causality internally, so chunk
   * order is byte-equivalent to one batch. Shared by boot (`hydrateFromEventStore`) and CIV-2b lazy first-access.
   */
  private async ingestChunked(byteSlices: readonly Uint8Array[]): Promise<{ ingested: number; skipped: number }> {
    const kh = this.requireKh();
    const TARGET_MS = 40;              // per-chunk ingest set-point; the loop breathes between chunks
    let gate = PONO_FLUSH_GATE;        // depth 32, servoed by adaptGate against observed latency
    let ingested = 0, skipped = 0;
    for (let i = 0; i < byteSlices.length; ) {
      const slice = byteSlices.slice(i, i + gate.depth) as Uint8Array[];
      // A local replay-chunk cost measurement that steers the NEXT chunk's depth — pacing, never
      // admission — so it reads a monotonic clock; a wall-clock jump must not distort the servo.
      const t0 = performance.now();
      const r = await ingestTolerant(slice, (batch) => kh.ingestEventsBytes(batch as Uint8Array[]));
      ingested += r.ingested; skipped += r.skipped;
      i += slice.length;
      gate = adaptGate(gate, performance.now() - t0, TARGET_MS);                     // servo the depth toward the set-point
      if (i < byteSlices.length) await new Promise<void>((res) => setImmediate(res)); // let the loop breathe
    }
    return { ingested, skipped };
  }

  async materializeIsland(islandId: string): Promise<{ ingested: number; skipped: number }> {
    // Resident already — the self slice, the N=1 all-eager boot, or a prior materialization. Cheap noop.
    if (this.allEager || this.hydratedIslands.has(islandId) || !this.eventStore) return { ingested: 0, skipped: 0 };
    // Just THIS island's own deferred events: cross-cutting (island-undefined) rode the eager boot slice,
    // so filter them out here — re-ingesting them would be redundant (keyhive dedups, but no need to pay).
    const own = (await this.eventStore.list(islandId)).filter((r) => r.island === islandId);
    const result = await this.ingestChunked(own.map((r) => r.bytes));
    // Mark resident only after a clean ingest; a throw leaves the island retryable (the provider awaits
    // doc-ops sequentially — single-writer law — so no concurrent access double-loads between here and now).
    this.hydratedIslands.add(islandId);
    return result;
  }

  /** CIV-2b shore — before an op resolves a bag's Document, materialize its island if boot deferred it.
   *  A noop for a resident island; the "first access" that turns a deferred foreign island live. */
  private async ensureIsland(docIdHex: string): Promise<void> {
    await this.materializeIsland(docIdHex);
  }

  /**
   * Await every store write the event handler has started. Call it before reading the store back, or
   * before disposing — a fire-and-forget write that outlives its provider silently loses an event.
   */
  async settleEvents(): Promise<void> {
    // Take the queue before awaiting: a write that starts DURING the await belongs to the next settle,
    // and clearing after would drop it.
    while (this.pendingWrites.length > 0) {
      const inFlight = this.pendingWrites;
      this.pendingWrites = [];
      await Promise.all(inFlight);
    }
  }

  /** Run `leave` when this provider disposes: whatever stands over its identity (a content-key holder, a
   *  subscription) leaves with it, so nothing keeps asking an identity that no longer stands. */
  whenDisposed(leave: () => void): void { this.leaving.push(leave); }

  async dispose(): Promise<void> {
    for (const leave of this.leaving.splice(0)) { try { leave(); } catch { /* one leaver's fault never keeps the next standing */ } }
    await this.settleEvents();
    // Keyhive WASM types support Symbol.dispose; rely on JS GC otherwise.
    this.kh = null;
    this.standCard = null;
    this.bagToDocId.clear();
    this.docIdToBag.clear();
    this.delegations.clear();
    this.delegationAudience.clear();
    this.delegationBag.clear();
    this.bagChunks.clear();
  }
}
