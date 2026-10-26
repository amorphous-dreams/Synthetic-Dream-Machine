/**
 * node-vessel-identity — device Ed25519 keypair lifecycle.
 *
 * Local-first identity root (Brooklyn Zelenka / UCAN / Keyhive alignment):
 *   - keypair is generated device-local, persists to disk with mode 0o600
 *   - verifyingKey (hex 32 bytes) feeds did:key derivation
 *   - did:key derivation happens in the TW5 VM (cold-boot-ceremony module)
 *   - displayName derives from `git config user.name` — local truth, no network call
 *
 * The TRUE NAME MODEL — three parts that bind without merging (#has-stack ontology: a
 * nameless entity carries a stack of capabilities, never a numbered plane):
 *   · the VESSEL key — THIS file's keypair — belongs to the PLACE. Founding mints it
 *     per-install off the local CSPRNG; it NEVER travels to another vessel. It names a
 *     *somewhere*, and it signs only AS ITSELF.
 *   · the PERSONA ROOT — the PersonaGroup root, custodied further down this file — belongs
 *     to the HUMAN. A DISTINCT key in its own slot: never derived from the vessel seed,
 *     never the same bytes, never copied outward.
 *   · the DELEGATION EDGE binds the two without collapsing them. The persona root signs
 *     "Operator O delegates to Device D AT PLACE P" (mesh/device-delegation, v2), and
 *     `hearthTrueName` carries P — the hearth's True Name. The edge IS the relationship;
 *     the vessel's stack #has it.
 *
 * Why the split carries weight: one key copied across a user's vessels presents the SAME
 * collector to every verifier, so a single bit links every self. Holding vessel apart from
 * persona is what makes the veil → PersonaGroup → Handle architecture implementable at all.
 * See lar:///ha.ka.ba/lares/docs/federation and api/pono/has-stack-ontology.
 *
 * Storage law — identity lives beside the runtime store:
 *   the keypair + card persist to `<lares>/identity` (`larIdentityDir`), in the XDG data
 *   home BESIDE — never inside — the runtime `<lares>/vessel` store. No storage operation
 *   can reach it (they rmSync the substrate store, never the home that holds it). This realizes the
 *   law below (the key MUST NOT sit inside an Automerge doc storage path) and the
 *   keypair-wipe lesson: a destructive storage verb cannot reach identity.
 *
 * Custody law — the FLOOR reads the vessel key, its inception and its card, and nothing else here:
 *   the vessel keypair, the inception and the ContactCard rest in the clear (mode 0o600), since a vessel stands and
 *   answers its public name before any person unlocks it. Every other row this module writes rests sealed under
 *   the vessel key and passes through the custody seat: the persona roster, the selector, the three name maps
 *   (hot) and each persona root (cold). The persona section below states that law.
 *
 * Key file naming (inside the identity dir):
 *   git email configured:  .vessel-key-{email-slug}.json
 *   git email absent:      .vessel-key.json
 *
 * Different developers on the same machine each get their own keypair.
 * The keypair derives from a local CSPRNG — fully device-local, no external service.
 *
 * MUST NOT be placed inside any Automerge doc storage path — MUST NOT sync.
 * Mode 0o600 at write time; caller must ensure the identity dir is not world-readable.
 */

import { createPrivateKey, createPublicKey, generateKeyPairSync, hkdfSync } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, renameSync, openSync, writeSync, fsyncSync, closeSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { faceFileNames } from "./face-index.js";
import { larIdentityDir } from "./vessel-paths.js";
import {
  generateOrLoadKeypair,
  signingSeedFromHex,
  assertHandleIndex,
  wearPersona as coreWearPersona,
  loadActivePersona as coreLoadActivePersona,
  type KeypairStore,
  type KeypairCrypto,
  type PersistedKeypair,
  type PersonaVault,
  type ActivePersonaStore,
  type PersonaRoot,
  type OwnPersonaPetnameStore,
  type PersonaDeclaration,
  type PersonaDeclarationStore,
  type OwnPublicHandleStore,
  type PersonaPublicHandleRecord,
  armPlaceInception, PlaceFoundingCardUnread, type PlaceFoundingCard, mintPlaceRotation, placeNextDigest, verifyPlaceKel, decodePlaceKelEvent,
  mintColdKey, canonicalJson, hex, type PlaceKelEvent, type PlaceRotation, type RandomProvider,
  ALL_DOMAINS,
  GATE_BUNDLE_INFO,
  floorKeyDoor,
  type FloorKeyDoor,
} from "@lararium/mesh";
import { readBackStandsIn } from "./seal-ceremony.js";
import { nodeAnchorStore } from "./identity-anchors.js";
import { nodeRecoveryShareStore } from "./recovery-share-store.js";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readFaceIndexSync } from "./face-index.js";
import {
  openedCustody, exclusiveCustody, unlockedFaceOrdinals, standingCustody, readCustodyRow, updateCustodyRow, openColdCustodyRow, updateColdCustodyRow,
} from "./custody-seat.js";

/**
 * The identity dir — the ONE resolver, `<lares>/identity` (`larIdentityDir`), in the XDG
 * data home beside the `<lares>/vessel` store; the key + card + anchors are separate from vessel
 * documents and unreachable by store operations. An empty home re-derives a fresh device key — no migration arm, no legacy spelling.
 *
 * TAKES NO `dataDir`: this resolver answers off `LAR_ROOT`/XDG env vars alone (`larIdentityDir`), never
 * off a caller-supplied path. A `dataDir` parameter it ignored would be the footgun measured live
 * (`persona-ring-cross-operator-admit.test.ts`): a caller isolating a `dataDir` per simulated vessel,
 * in-process, with no matching `LAR_ROOT` mutation, silently reads/writes the REAL
 * `~/.local/share/lares/identity` home instead of its intended isolated one. Removing the parameter
 * (rather than honoring it) preserves the tested invariant "ONE resolver, no second spelling"
 * (`vessel-identity-home.test.ts`) — honoring it would need a SECOND address-derivation scheme to
 * keep identity separate from a caller-supplied store path, which is exactly the thing this file's storage
 * law forbids. The ONE sanctioned in-process isolation pattern is now `tests/harness/with-lar-root.ts`.
 */
function identityDir(): string {
  return larIdentityDir();
}


// ── Local operator identity hint ──────────────────────────────────────────
// Fully local-first: reads git config only. No network calls, no server tokens.
// Email slug derived from git email (email-prefix, lowercased, sanitized) for
// per-developer key file naming on shared machines. DisplayName from git user.name.
//
// Causal-island law: operator identity derives from local keys — not from any
// server-conferred session. Git config supplies local truth; no external registry.

const exec = promisify(execFile);

interface LocalOperatorHint { login: string | null; displayName: string | null }

async function readLocalOperatorHint(): Promise<LocalOperatorHint> {
  let displayName: string | null = null;
  let login:       string | null = null;
  try {
    const { stdout } = await exec("git", ["config", "--global", "user.name"], { timeout: 2_000 });
    displayName = stdout.trim() || null;
  } catch { /* git absent or user.name unset */ }
  try {
    const { stdout } = await exec("git", ["config", "--global", "user.email"], { timeout: 2_000 });
    const email = stdout.trim();
    if (email) {
      // Stable, filesystem-safe slug: email prefix, lowercased, non-alnum→dash.
      login = email.split("@")[0]!.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    }
  } catch { /* git absent or user.email unset */ }
  return { login, displayName };
}

interface PersistedKey {
  /** Hex-encoded 32-byte Ed25519 public key. Input to did:key derivation. */
  verifyingKey: string;
  /** Hex-encoded 32-byte Ed25519 private key seed. Local signing only. Never synced. */
  signingKey:   string;
  /** Git email prefix at key-generation time. Informational only — drives key file naming. */
  gitEmail?: string;
}

export interface VesselIdentity {
  /** Hex-encoded 32-byte Ed25519 verifying key. */
  verifyingKey: string;
  /** Display name from git config user.name. Enriches IdentityTiddler only. */
  displayName?: string;
}

function keyFileName(login: string | null): string {
  return login ? `.vessel-key-${login}.json` : ".vessel-key.json";
}

// ── Platform shores for the shared keypair lifecycle (vessel-identity-core) ────
// node mints via the local CSPRNG (generateKeyPairSync) and persists each keypair
// as a 0o600 JSON file in the runtime-store-sibling identity dir, stamping the git
// email hint. The core (mesh) owns the generate-or-load control flow over these.

const nodeKeypairCrypto: KeypairCrypto = {
  async generate() {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubJwk  = publicKey.export({ format: "jwk" })  as { x: string };
    const privJwk = privateKey.export({ format: "jwk" }) as { d: string };
    return {
      verifyingKey: Buffer.from(pubJwk.x,  "base64url").toString("hex"),
      signingKey:   Buffer.from(privJwk.d, "base64url").toString("hex"),
    };
  },
};

/** A single 0o600 JSON keypair slot at `keyFile`; save() stamps the git-email hint. */
function fileKeypairStore(keyFile: string, login: string | null): KeypairStore {
  return {
    async load() {
      if (!existsSync(keyFile)) return undefined;
      const raw = JSON.parse(readFileSync(keyFile, "utf8")) as PersistedKey;
      return { verifyingKey: raw.verifyingKey, signingKey: raw.signingKey };
    },
    async save(kp) {
      const persisted: PersistedKey = {
        verifyingKey: kp.verifyingKey,
        signingKey:   kp.signingKey,
        ...(login ? { gitEmail: login } : {}),
      };
      writeFileSync(keyFile, JSON.stringify(persisted, null, 2), { mode: 0o600, encoding: "utf8" });
      chmodSync(keyFile, 0o600);
    },
  };
}

// ── THE PLACE KEL: an armed inception, rotated by the founding card ───────────
//
// The place KEL (`packages/lararium-mesh/src/vessel-kel.ts`) seats the online signer and commits the digest of a cold
// next key that rests on the founding card alone. A founding reads that card back before any byte lands; a rotation
// reveals it, seats a replacement signer and commits the following cold key. The chain rests in the clear beside the
// key (a `floor` row), and every load of a standing key verifies the chain to its head: a chain that fails to prove
// the key refuses by name (`VesselInceptionRefused`), and nothing writes one over a standing key.
function kelFileName(login: string | null): string {
  return login ? `.vessel-kel-${login}.json` : ".vessel-kel.json";
}
function stagedFileName(login: string | null): string {
  return login ? `.vessel-rotating-${login}.json` : ".vessel-rotating.json";
}

/** A standing vessel key whose own files fail to prove it (its inception, or a seed that derives another key); nothing gets written over either file. */
export class VesselInceptionRefused extends Error {
  override readonly name = "VesselInceptionRefused";
  constructor(readonly kelFile: string, readonly reading: "absent" | "malformed" | "old-shape" | "unarmed" | "names-another-key" | "signature-fails" | "seed-names-another-key" | "chain-refused", readonly chainRefusal?: string) {
    super(
      `the place KEL at ${kelFile} reads ${reading}${chainRefusal ? `: ${chainRefusal}` : ""}; no standing key gets overwritten`,
    );
  }
}

/** Read the inception standing at `kelFile` and hold it to `verifyingKey`; refuse by name where it fails. */
function readPlaceChain(kelFile: string): PlaceKelEvent[] {
  if (!existsSync(kelFile)) throw new VesselInceptionRefused(kelFile, "absent");
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(kelFile, "utf8")); } catch { throw new VesselInceptionRefused(kelFile, "malformed"); }
  if (!Array.isArray(raw)) {
    if (raw && typeof raw === "object" && (raw as { t?: unknown }).t === "icp")
      throw new VesselInceptionRefused(kelFile, "old-shape");
    throw new VesselInceptionRefused(kelFile, "malformed");
  }
  return raw as PlaceKelEvent[];
}

function verifiedPlaceChain(kelFile: string) {
  const chain = readPlaceChain(kelFile);
  const reading = verifyPlaceKel(chain);
  if (!reading.ok) {
    const named = reading.refusal === "old-shape-inception" ? "old-shape" : reading.refusal === "unarmed-inception" ? "unarmed" :
      reading.refusal === "bad-signature" ? "signature-fails" : reading.refusal === "malformed" ? "malformed" : "chain-refused";
    throw new VesselInceptionRefused(kelFile, named, reading.refusal);
  }
  return reading;
}

function proveInception(kelFile: string, verifyingKey: string): void {
  const reading = verifiedPlaceChain(kelFile);
  if (reading.signerKey !== verifyingKey) throw new VesselInceptionRefused(kelFile, "names-another-key");
}

/**
 * Hold the keypair a key file carries to itself and to its inception: the seed derives the public key the file
 * names (`seed-names-another-key` where it does not), and the inception proves that key. Every load of a standing
 * key passes here, so no door signs or derives under a seed its inception never named.
 */
function proveStandingKey(kelFile: string, raw: { readonly verifyingKey?: unknown; readonly signingKey?: unknown }): void {
  if (typeof raw.signingKey !== "string" || !/^[0-9a-f]{64}$/.test(raw.signingKey)
    || typeof raw.verifyingKey !== "string" || verifyingKeyOfSeed(raw.signingKey) !== raw.verifyingKey) {
    throw new VesselInceptionRefused(kelFile, "seed-names-another-key");
  }
  proveInception(kelFile, raw.verifyingKey);
}

/**
 * Land `bytes` at `file` whole or not at all (mode 0o600), and durably: a sidecar written and synced, a rename,
 * then the directory synced. No reader meets half a file, and a file landed here outlives a power loss before the
 * next one lands, so the inception a key answers to never trails the key.
 */
function publishFile(file: string, bytes: string | Uint8Array): void {
  const side = `${file}.landing`;
  const data = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;
  const fd = openSync(side, "w", 0o600);
  try {
    for (let off = 0; off < data.length;) off += writeSync(fd, data, off, data.length - off);
    fsyncSync(fd);
  } finally { closeSync(fd); }
  chmodSync(side, 0o600);
  renameSync(side, file);
  let dir: number | undefined;
  try { dir = openSync(dirname(file), "r"); fsyncSync(dir); }
  catch { /* a filesystem that syncs no directory still holds the rename */ }
  finally { if (dir !== undefined) closeSync(dir); }
}

interface StagedPlaceRotation { readonly event: PlaceRotation; readonly signingKey: string; readonly cardRead: true }
function placeFiles(login: string | null) {
  const dir = identityDir();
  return { key: join(dir, keyFileName(login)), kel: join(dir, kelFileName(login)), stage: join(dir, stagedFileName(login)) };
}
function stagedRotation(file: string): StagedPlaceRotation {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(file, "utf8")); } catch { throw new Error("place-rotation-torn"); }
  if (!raw || typeof raw !== "object" || (raw as { cardRead?: unknown }).cardRead !== true ||
      typeof (raw as { signingKey?: unknown }).signingKey !== "string" ||
      !/^[0-9a-f]{64}$/.test((raw as { signingKey: string }).signingKey) ||
      decodePlaceKelEvent((raw as { event?: unknown }).event)?.t !== "rot") throw new Error("place-rotation-torn");
  return raw as StagedPlaceRotation;
}
function reconcileFiles(files: ReturnType<typeof placeFiles>, login: string | null): void {
  if (!existsSync(files.stage)) return;
  const staged = stagedRotation(files.stage);
  const chain = readPlaceChain(files.kel);
  const reading = verifiedPlaceChain(files.kel);
  const extended = verifyPlaceKel([...chain, staged.event]);
  const already = chain.at(-1)?.t === "rot" && canonicalJson(chain.at(-1)) === canonicalJson(staged.event);
  if (!already && (!extended.ok || extended.seq !== reading.seq + 1)) throw new Error("place-rotation-torn");
  if (verifyingKeyOfSeed(staged.signingKey) !== staged.event.key) throw new Error("place-rotation-torn");
  if (already && reading.signerKey !== staged.event.key) throw new Error("place-rotation-torn");
  const raw = JSON.parse(readFileSync(files.key, "utf8")) as PersistedKey;
  if (!already && raw.verifyingKey !== reading.signerKey) throw new Error("place-rotation-torn");
  if (!already) publishFile(files.kel, canonicalJson([...chain, staged.event]));
  if (raw.verifyingKey !== staged.event.key) publishFile(files.key, JSON.stringify({ verifyingKey: staged.event.key, signingKey: staged.signingKey, ...(login ? { gitEmail: login } : {}) }, null, 2));
  unlinkSync(files.stage);
}

/** Finish a fully read-back card's staged rotation under the custody claim. */
export async function reconcilePlaceRotation(): Promise<void> {
  const hint = await readLocalOperatorHint();
  const files = placeFiles(hint.login);
  if (existsSync(files.stage)) await exclusiveCustody(async () => reconcileFiles(files, hint.login));
}

export async function loadPlaceKelChain(): Promise<readonly PlaceKelEvent[]> {
  await reconcilePlaceRotation();
  const hint = await readLocalOperatorHint();
  return verifiedPlaceChain(placeFiles(hint.login).kel).chain;
}
export async function loadPlaceAid(): Promise<string> {
  await reconcilePlaceRotation();
  const hint = await readLocalOperatorHint();
  return verifiedPlaceChain(placeFiles(hint.login).kel).aid;
}

/** Rotate a place only after the replacement cold card reads back. */
export async function rotatePlace(opts: { card: Uint8Array; placeFoundingCard: PlaceFoundingCard; entropy?: RandomProvider }):
  Promise<{ event: PlaceRotation; aid: string; seq: number }> {
  await openedCustody();
  const hint = await readLocalOperatorHint();
  const files = placeFiles(hint.login);
  // A staged rotation finishes (or refuses) before another begins.
  await reconcilePlaceRotation();
  const reading = verifiedPlaceChain(files.kel);
  if (!(opts.card instanceof Uint8Array) || opts.card.length !== 32) throw new Error("place-card-refused");
  let reveal: string;
  try { reveal = verifyingKeyOfSeed(hex(opts.card)); }
  catch { throw new Error("place-card-refused"); }
  if (placeNextDigest(reveal) !== reading.nextDigest) throw new Error("place-card-refused");
  const next = await mintColdKey(opts.entropy);
  const signer = new Uint8Array(32);
  (opts.entropy ?? globalThis.crypto).getRandomValues(signer);
  try {
    const signingKey = hex(signer);
    const event = mintPlaceRotation({ chain: reading.chain, coldSeed: opts.card, newSignerKey: verifyingKeyOfSeed(signingKey), nextColdVerifyingKey: next.verifyingKey });
    // THE REPLACEMENT CARD READS BACK BEFORE THE CLAIM (a read-back may ask the custody its own questions), and no event
    // stages until it has: the chain, the key file and the stage change only inside the claim below.
    await opts.placeFoundingCard.readBack({ seed: next.seed, digest: event.next, verifyingKey: next.verifyingKey }, reading.aid.slice(-16), reading.seq + 1);
    return await exclusiveCustody(async () => {
      if (existsSync(files.stage)) throw new Error("place-rotation-torn");
      if (verifiedPlaceChain(files.kel).headDigest !== reading.headDigest) throw new Error("place-rotation-raced");
      publishFile(files.stage, canonicalJson({ event, signingKey, cardRead: true }));
      reconcileFiles(files, hint.login);
      return { event, aid: reading.aid, seq: event.seq };
    });
  } finally { next.seed.fill(0); signer.fill(0); }
}

/**
 * Generate or load the device Ed25519 operator keypair.
 *
 * Key file naming uses git email slug — different developers on the same machine
 * each hold separate keys. Falls back to a shared file when git email is absent.
 *
 * Causal-islands alignment: keypair generation runs as a device-local operation that
 * MUST complete before any Automerge doc opens. The verifyingKey flows into the
 * cold-boot ceremony which writes the IdentityTiddler into IdentitiesDoc via
 * direct handle.change() — not through the TW5 sync adaptor (wrong island).
 */
/** A vessel key that could not mint: no custody stands open, so no founding holds this place. */
export class VesselKeyMintRefused extends Error {
  override readonly name = "VesselKeyMintRefused";
  constructor(keyFile: string, cause: unknown) {
    super(
      `no vessel key stands at ${keyFile}, and a vessel key mints only inside a held custody (a founding seals its ` +
      `custody first, and the mint lands under its one claim): found the vessel with \`lares vessel found\` — ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
  }
}

export async function generateOrLoadVesselIdentity(opts: { placeFoundingCard?: PlaceFoundingCard; entropy?: RandomProvider } = {}): Promise<VesselIdentity> {
  const idDir = identityDir();
  mkdirSync(idDir, { recursive: true });

  const hint     = await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }));
  // Keep both identity files beside the runtime store on every boot/init — the card
  // is re-mintable but still identity, and belongs beside its key.
  const keyFile  = join(idDir, keyFileName(hint.login));
  const base     = fileKeypairStore(keyFile, hint.login);
  if (existsSync(join(idDir, stagedFileName(hint.login)))) await reconcilePlaceRotation();

  // THE MINT: the inception, then the key file, and THE KEY FILE COMMITS THE MINT. Both land inside ONE hold of the
  // custody claim (`exclusiveCustody`), the same claim every sealed write in every process takes, so two racing acts
  // never interleave: the first lands both files, and the later act meets the key that stands, writes nothing and
  // answers that key. A mint runs only inside a held custody and refuses by name outside one, before any byte lands:
  // a founding seals its custody first (`lares vessel found`), so the place's key mints inside the act that holds
  // its custody open. A key file that stands always stands beside the inception that names it; an act that stops
  // between the two leaves an inception no key answers to, and the next mint writes it afresh.
  let lostTo: PersistedKeypair | undefined;
  const kelFile = join(idDir, kelFileName(hint.login));
  const minting: KeypairStore = {
    load: () => base.load(),
    async save(keypair) {
      try { await openedCustody(); } catch (err) { throw new VesselKeyMintRefused(keyFile, err); }
      // THE CARD READS BACK BEFORE THE CLAIM: a read-back may ask the custody its own questions (a staged root's stand-in
      // proves the test route), and the claim admits one holder. Nothing lands until the card reads back.
      const seed = signingSeedFromHex(keypair.signingKey);
      let inception: PlaceKelEvent;
      try {
        const card: PlaceFoundingCard | null = opts.placeFoundingCard ?? ((await readBackStandsIn()) ? { readBack: async () => {} } : null);
        if (card === null) throw new PlaceFoundingCardUnread();
        inception = (await armPlaceInception({ signerSeed: seed, card, ...(opts.entropy ? { entropy: opts.entropy } : {}) })).event;
      } finally { seed.fill(0); }
      const committed = await exclusiveCustody(async () => {
        if (existsSync(keyFile)) return false;
        publishFile(kelFile, canonicalJson([inception]));
        const persisted: PersistedKey = { verifyingKey: keypair.verifyingKey, signingKey: keypair.signingKey, ...(hint.login ? { gitEmail: hint.login } : {}) };
        publishFile(keyFile, JSON.stringify(persisted, null, 2));
        return true;
      });
      if (committed) return;
      lostTo = await base.load();   // another act's key stands: this act's keypair goes nowhere
      if (!lostTo) throw new VesselKeyMintRefused(keyFile, new Error("the key another act landed vanished before this act read it; run the founding again"));
    },
  };
  const crypto = opts.entropy ? { generate: async () => {
    const seed = new Uint8Array(32);
    opts.entropy!.getRandomValues(seed);
    try { const signingKey = hex(seed); return { signingKey, verifyingKey: verifyingKeyOfSeed(signingKey) }; }
    finally { seed.fill(0); }
  } } : nodeKeypairCrypto;
  const minted = await generateOrLoadKeypair(minting, crypto);
  const verifyingKey = lostTo ? lostTo.verifyingKey : minted.verifyingKey;
  const created = minted.created && !lostTo;

  if (!created) {
    // A standing key proves itself by its own inception, or the act refuses by name and writes nothing.
    const standing = JSON.parse(readFileSync(keyFile, "utf8")) as PersistedKey;
    if (standing.verifyingKey !== verifyingKey) throw new VesselInceptionRefused(kelFile, "names-another-key");
    proveStandingKey(kelFile, standing);
    console.log(`[vessel-identity] loaded keypair${hint.login ? ` for ${hint.login}` : ""}`);
  } else {
    console.log(`[vessel-identity] generated place signer and armed KEL${hint.login ? ` for ${hint.login}` : ""}`);
  }

  const base2: VesselIdentity = { verifyingKey };
  return hint.displayName ? { ...base2, displayName: hint.displayName } : base2;
}

/**
 * The vessel's identity as a BOOT reads it: the public key off the key file and the display name off git config.
 * Load-only. A boot mints no key (a key mints only inside a held custody, and a boot holds none), so a vessel
 * with no key file refuses here by name and points at the founding.
 */
export async function loadVesselIdentity(): Promise<VesselIdentity> {
  const verifyingKey = await loadVesselVerifyingKey();
  const hint = await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }));
  return hint.displayName ? { verifyingKey, displayName: hint.displayName } : { verifyingKey };
}

/**
 * Load the operator's 32-byte Ed25519 SIGNING seed (private key bytes).
 *
 * Separate from `generateOrLoadVesselIdentity` — that function returns only
 * the public verifying key (sufficient for IdentityTiddler), while this one
 * surfaces the private seed needed by KeyhiveProvider.init({ seed }) and any
 * other capability layer that signs on the operator's behalf.
 *
 * SECURITY: the returned bytes ARE the operator's private signing key. Treat
 * with care: don't log it, don't write it anywhere outside the vessel-identity
 * file, and don't pass it across process boundaries that aren't already
 * inside the operator's trust domain.
 *
 * Throws when no key file exists — caller must call
 * `generateOrLoadVesselIdentity()` first to ensure one is on disk.
 */
/**
 * Load the operator's hex-encoded Ed25519 PUBLIC verifying key from disk, proven: the file's seed derives it and
 * its inception signs it (`proveStandingKey`; one key derivation and one signature check). Returns the same
 * `verifyingKey` field generateOrLoadVesselIdentity surfaces, without regenerating if missing.
 *
 * Used by the CLI to populate verb-tiddler `requested-by` with a
 * Keyhive-recognizable DID (`0x` + verifyingKey hex). Throws when no key
 * file exists, and refuses `VesselInceptionRefused` by name where the key fails its proof.
 */
export async function loadVesselVerifyingKey(): Promise<string> {
  await reconcilePlaceRotation();
  const hint    = await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }));
  const keyFile = join(identityDir(), keyFileName(hint.login));
  if (!existsSync(keyFile)) {
    throw new Error(
      `[vessel-identity] no key file at ${keyFile} — run \`lares vessel found\` first to generate the keypair`,
    );
  }
  const raw = JSON.parse(readFileSync(keyFile, "utf8")) as PersistedKey;
  if (typeof raw.verifyingKey !== "string" || raw.verifyingKey.length !== 64) {
    throw new Error(`[vessel-identity] malformed verifyingKey in ${keyFile}`);
  }
  proveStandingKey(join(identityDir(), kelFileName(hint.login)), raw);
  return raw.verifyingKey;
}

function cardFileName(login: string | null): string {
  return login ? `.vessel-card-${login}.json` : ".vessel-card.json";
}

/**
 * Persist the operator's pre-minted Keyhive ContactCard JSON beside the keypair
 * (mode 0o600). The founding ceremony mints it once; a short-lived LEAF actor
 * (CLI run / agent turn) re-presents this cached card on every peer handshake
 * WITHOUT booting keyhive — the light-identity path (operator-peer #actor-parity
 * OP-AP5). The card carries no expiry/nonce, so the cache never goes stale; proof
 * freshness rides the per-challenge nonce, never the card.
 */
export async function persistVesselCard(contactCardJson: string): Promise<void> {
  const idDir = identityDir();
  mkdirSync(idDir, { recursive: true });
  const hint     = await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }));
  const cardFile = join(idDir, cardFileName(hint.login));
  writeFileSync(cardFile, contactCardJson, { mode: 0o600, encoding: "utf8" });
  chmodSync(cardFile, 0o600);
  console.log(`[vessel-identity] persisted ContactCard${hint.login ? ` for ${hint.login}` : ""}`);
}

/**
 * Load the operator's cached ContactCard JSON. Throws when absent — the caller
 * must run `lares vessel found` (which mints + persists it during the founding ceremony).
 */
export async function loadVesselCard(): Promise<string> {
  const hint     = await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }));
  const cardFile = join(identityDir(), cardFileName(hint.login));
  if (!existsSync(cardFile)) {
    throw new Error(
      `[vessel-identity] no ContactCard at ${cardFile} — run \`lares vessel found\` (it mints the card during the founding ceremony)`,
    );
  }
  return readFileSync(cardFile, "utf8");
}

export async function loadVesselSigningSeed(): Promise<Uint8Array> {
  await reconcilePlaceRotation();
  const hint    = await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }));
  const keyFile = join(identityDir(), keyFileName(hint.login));
  if (!existsSync(keyFile)) {
    throw new Error(
      `[vessel-identity] no key file at ${keyFile} — run \`lares vessel found\` first to generate the keypair`,
    );
  }
  const raw = JSON.parse(readFileSync(keyFile, "utf8")) as PersistedKey;
  if (typeof raw.signingKey !== "string" || raw.signingKey.length !== 64) {
    throw new Error(`[vessel-identity] malformed signingKey in ${keyFile}`);
  }
  proveStandingKey(join(identityDir(), kelFileName(hint.login)), raw);
  return signingSeedFromHex(raw.signingKey);
}

/** The floor key's door refused: a name the registry never declared, or a child that belongs to the sealed custody root. */
export class FloorKeyDoorRefused extends Error {
  override readonly name = "FloorKeyDoorRefused";
}

/**
 * THE FLOOR KEY'S DERIVE DOOR: one child of the vessel's floor key under one registered domain.
 *
 * The floor key rests outside the vessel key, so this door answers while the vessel stands LOCKED: a floor
 * gate's bundle derives through it at every standing. Each call reads the key file, proves its inception
 * (`VesselInceptionRefused` by name where it fails), derives (RFC 5869
 * HKDF-SHA256, empty salt, the domain's address as `info`, 32 bytes), overwrites the seed it read, and answers
 * a FRESH buffer its caller owns and overwrites. The door never answers the floor key itself, and the seed
 * rests in no closure between two calls.
 *
 * It derives no child the sealed custody root owns: the sovereign gate bundle's name refuses here, so a floor
 * key never stands in for the custody root. The custody seat's own door refuses the floor bundle's name the
 * same way (`custodyGateDoor`), and the two doors carry two types no composer can swap.
 */
export async function vesselFloorKeyDoor(): Promise<FloorKeyDoor> {
  await reconcilePlaceRotation();
  const hint    = await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }));
  const keyFile = join(identityDir(), keyFileName(hint.login));
  const kelFile = join(identityDir(), kelFileName(hint.login));
  return floorKeyDoor({
    derive(domain: string): Uint8Array {
      if (!ALL_DOMAINS.includes(domain)) {
        throw new FloorKeyDoorRefused(`refused domain ${JSON.stringify(domain)}: a floor child derives only under a domain the registry declares`);
      }
      if (domain === GATE_BUNDLE_INFO) {
        throw new FloorKeyDoorRefused("refused the sovereign gate bundle's name: that child derives from the sealed custody root alone");
      }
      if (!existsSync(keyFile)) {
        throw new FloorKeyDoorRefused(`no vessel key stands at ${keyFile}: found the vessel with \`lares vessel found\``);
      }
      const raw = JSON.parse(readFileSync(keyFile, "utf8")) as PersistedKey;
      if (typeof raw.signingKey !== "string" || raw.signingKey.length !== 64) {
        throw new FloorKeyDoorRefused(`the vessel key at ${keyFile} reads malformed`);
      }
      proveStandingKey(kelFile, raw);
      const seed = signingSeedFromHex(raw.signingKey);
      try { return new Uint8Array(hkdfSync("sha256", seed, new Uint8Array(0), domain, 32)); }
      finally { seed.fill(0); }
    },
  });
}

// ── PersonaGroup root key custody — the sealed PersonaVault (over @lararium/mesh) ─────────────────
//
// Two DISTINCT capabilities, never two numbered planes (#has-stack ontology — a nameless entity carries a stack
// of capabilities, not a layer index):
//   · the per-vessel device key above = the capability a vessel #has to sign AS ITSELF (its own leaf).
//   · the PersonaGroup root here        = the operator-root capability that SIGNS the device-delegation
//     edges granting vessels membership. Its public key is the operator-root DID (`0x`+hex) peers PIN
//     to verify those edges offline at the Binding Gate. A vessel joins the PersonaGroup by holding a signed
//     edge from this root — membership is a capability the stack #has, not a plane.
//
// ROOT-ON-FOUNDER: `generateOrLoadPersonaGroupRoot` mints founder-side only; a joinee holds the founder's public
// DID + a signed edge at admit, so its roster reads empty. UNIFORM KEYING — every persona-root spells `-h${N}`.
//
// ── AT REST: SIX ROWS, ONE CUSTODY BOUNDARY ────────────────────────────────────────────────────
// Every row of this family rests sealed under the vessel key and passes through the custody seat
// (`custody-seat`): the one sealed writer on the way down, the sealed open on the way up.
//   HOT (read while the vessel stays unlocked): the persona ROSTER, the active-persona selector, the private
//       pet-name map, the declaration map, the published-face record.
//   COLD (opened for one act, then dropped): each persona ROOT (`…-h<N>.json`).
// At the floor every door here refuses `CustodyLocked`. A hot row with nothing at its path reads as holding
// nothing (no root, no worn face, no label), which states a fact about a vessel that never wrote it. A row that
// stands and does not open (torn, bare, another key's) refuses `CustodyRowUnavailable`, and so does one that
// opens to another shape. No reader folds a refusal to empty, so no act writes over a row it could not read.
//
// ── THE ROSTER COMMITS A ROOT ────────────────────────────────────────────────────────────────────
// A mint writes the root row first and the roster line second, and the roster line makes the root HELD. Each
// line carries its root's public key, so every reader that wants only the public face (`listPersonaRoots`,
// `loadPersonaGroupRootVerifyingKey`, `personaRootExists`) reads the hot roster and opens no cold row.
//   · A root row with no roster line reads as an ORPHAN: an act that stopped between its two writes. No reader
//     holds it; `orphanPersonaRoots` names it; the same mint run again adopts it (its key opens under this
//     vessel's own key, so this vessel wrote it) and records its line.
//   · A roster line whose root row went missing, or whose root row names another key, REFUSES by name at the act
//     that needs the seed. Nothing mints over it.
// The root's mint reads, decides and writes under one custody holder (`updateColdCustodyRow`), so two acts in two
// processes converge on one root and never write over each other's.

const utf8 = new TextEncoder();
const HEX64 = /^[0-9a-f]{64}$/;
const isIndex = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const malformed = (file: string): CustodyRowUnavailable => new CustodyRowUnavailable("identity", file, "malformed");
const encodeRow = (value: unknown): Uint8Array => utf8.encode(JSON.stringify(value, null, 2));

/** The JSON a row's plaintext carries; bytes that hold no JSON refuse `malformed`. */
function parseRow(bytes: Uint8Array, file: string): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw malformed(file); }
}

/** A plain JSON object, or the row refuses `malformed`. */
function objectOf(value: unknown, file: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw malformed(file);
  return value as Record<string, unknown>;
}

/** The persona-root keypair filename — uniform `-h${N}` per handle-index, login-scoped so developers on
 *  one machine hold separate roots. No founding special-case (uniform keying). */
function personaGroupRootFileName(login: string | null, handleIndex: number): string {
  return login ? `.persona-group-root-${login}-h${handleIndex}.json` : `.persona-group-root-h${handleIndex}.json`;
}

/** The persona-root ROSTER filename — the EXPLICIT written record of every handle-index this vessel
 *  holds a root for, each beside its root's public key. */
function personaRosterFileName(login: string | null, handleIndex: number): string {
  return login ? `.persona-roster-${login}-h${handleIndex}.json` : `.persona-roster-h${handleIndex}.json`;
}

/** One held root, as the roster records it: its handle-index and its public verifying key. */
export interface PersonaRosterLine {
  readonly handleIndex:  number;
  readonly verifyingKey: string;
}

/** The roster a row's plaintext carries (ascending); nothing standing reads as no root held, any other shape refuses. */
function parseRoster(bytes: Uint8Array | null, file: string): PersonaRosterLine[] {
  if (bytes === null) return [];
  const roots = objectOf(parseRow(bytes, file), file)["roots"];
  if (!Array.isArray(roots)) throw malformed(file);
  const seen = new Set<number>();
  const out: PersonaRosterLine[] = [];
  for (const raw of roots as unknown[]) {
    const line = objectOf(raw, file);
    const handleIndex = line["handleIndex"];
    const verifyingKey = line["verifyingKey"];
    if (!isIndex(handleIndex) || typeof verifyingKey !== "string" || !HEX64.test(verifyingKey) || seen.has(handleIndex)) throw malformed(file);
    seen.add(handleIndex);
    out.push({ handleIndex, verifyingKey });
  }
  return out.sort((a, b) => a.handleIndex - b.handleIndex);
}

/** One face's roster line (its own row, in its own directory); null where it holds none. */
async function readRosterLine(login: string | null, handleIndex: number): Promise<PersonaRosterLine | null> {
  const file = personaRosterFileName(login, handleIndex);
  return parseRoster(await readCustodyRow("identity", file), file).find((l) => l.handleIndex === handleIndex) ?? null;
}

/** The roster of the faces standing UNLOCKED, ascending: each face keeps its own line, so a locked face names itself by the floor index alone. */
async function readRoster(login: string | null): Promise<PersonaRosterLine[]> {
  const out: PersonaRosterLine[] = [];
  for (const handleIndex of await unlockedFaceOrdinals()) {
    const line = await readRosterLine(login, handleIndex);
    if (line) out.push(line);
  }
  return out;
}

/** The Ed25519 public key (hex) a 32-byte signing seed (hex) derives. */
function verifyingKeyOfSeed(signingKeyHex: string): string {
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(signingKeyHex, "hex")]);
  const jwk = createPublicKey(createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" })).export({ format: "jwk" }) as { x: string };
  return Buffer.from(jwk.x, "base64url").toString("hex");
}

/**
 * The keypair a root row's plaintext carries; any other shape refuses `malformed`, and so does a row whose public
 * key differs from the one its own seed derives: a root signs under its seed, so the two name one key or the row
 * names none.
 */
function parseRootRow(bytes: Uint8Array, file: string): PersistedKeypair {
  const raw = objectOf(parseRow(bytes, file), file);
  const verifyingKey = raw["verifyingKey"];
  const signingKey = raw["signingKey"];
  if (typeof verifyingKey !== "string" || !HEX64.test(verifyingKey) || typeof signingKey !== "string" || !HEX64.test(signingKey)) throw malformed(file);
  if (verifyingKeyOfSeed(signingKey) !== verifyingKey) throw malformed(file);
  return { verifyingKey, signingKey };
}

/**
 * Open the root row the roster line `line` commits, for one act. A row that went missing refuses `absent`; a row
 * that names another key than the line refuses `names-another-key`; every other reading refuses by its own name.
 */
async function openCommittedRoot(login: string | null, line: PersonaRosterLine): Promise<PersistedKeypair> {
  const file = personaGroupRootFileName(login, line.handleIndex);
  return openColdCustodyRow("identity", file, (bytes) => {
    const root = parseRootRow(bytes, file);
    if (root.verifyingKey !== line.verifyingKey) throw new CustodyRowUnavailable("identity", file, "names-another-key");
    return root;
  });
}

/**
 * Land `keypair` as the root at `handleIndex`, or keep the root already standing there, then record the roster
 * line that commits it. Answers the keypair that stands and whether this call wrote it. A roster line that names
 * another key at this index refuses and moves nothing further.
 */
async function commitRoot(login: string | null, handleIndex: number, keypair: PersistedKeypair): Promise<{ root: PersistedKeypair; wrote: boolean }> {
  const idDir = larIdentityDir();
  mkdirSync(idDir, { recursive: true, mode: 0o700 });
  const rootFile = personaGroupRootFileName(login, handleIndex);
  const kept = await updateColdCustodyRow("identity", rootFile, (bytes) => {
    if (bytes !== null) return { plaintext: null, value: { root: parseRootRow(bytes, rootFile), wrote: false } };
    const persisted = { verifyingKey: keypair.verifyingKey, signingKey: keypair.signingKey, ...(login ? { gitEmail: login } : {}) };
    return { plaintext: encodeRow(persisted), value: { root: keypair, wrote: true } };
  });
  const rosterFile = personaRosterFileName(login, handleIndex);
  await updateCustodyRow("identity", rosterFile, (bytes) => {
    const roster = parseRoster(bytes, rosterFile);
    const standing = roster.find((l) => l.handleIndex === handleIndex);
    if (standing) {
      if (standing.verifyingKey !== kept.root.verifyingKey) throw new CustodyRowUnavailable("identity", rootFile, "names-another-key");
      return { plaintext: null, value: undefined };
    }
    const next = [...roster, { handleIndex, verifyingKey: kept.root.verifyingKey }].sort((a, b) => a.handleIndex - b.handleIndex);
    return { plaintext: encodeRow({ roots: next }), value: undefined };
  });
  return kept;
}

/**
 * LAND A CARRIED ROOT at `handleIndex` and record the roster line that commits it (a restore). Nothing standing
 * takes the root; the same root standing changes nothing; any other root row or roster line at the index refuses
 * `names-another-key` with its bytes untouched. The keypair's public half must derive from its seed.
 */
export async function landPersonaRoot(handleIndex: number, keypair: { readonly signingKey: string; readonly verifyingKey: string }): Promise<void> {
  assertHandleIndex(handleIndex);
  const login = await loginHint();
  const file = personaGroupRootFileName(login, handleIndex);
  if (!HEX64.test(keypair.signingKey) || !HEX64.test(keypair.verifyingKey) || verifyingKeyOfSeed(keypair.signingKey) !== keypair.verifyingKey) throw malformed(file);
  // EVERY STANDING ROW READS BEFORE ANY WRITE: a roster line or an orphan root under another key refuses here, so
  // a refused landing adopts no orphan and records no line.
  const line = await readRosterLine(login, handleIndex) ?? undefined;
  if (line && line.verifyingKey !== keypair.verifyingKey) throw new CustodyRowUnavailable("identity", file, "names-another-key");
  const orphan = line ? null : await orphanPersonaRootKey(handleIndex);
  if (orphan !== null && orphan !== keypair.verifyingKey) throw new CustodyRowUnavailable("identity", file, "names-another-key");
  const kept = await commitRoot(login, handleIndex, { signingKey: keypair.signingKey, verifyingKey: keypair.verifyingKey });
  if (kept.root.verifyingKey !== keypair.verifyingKey) throw new CustodyRowUnavailable("identity", file, "names-another-key");
}

/**
 * The public key of the ORPHAN root row at `handleIndex`: a root row that stands while the roster holds no line
 * for it. Null where no such row stands. Opens that one cold row for the length of this read.
 */
export async function orphanPersonaRootKey(handleIndex: number): Promise<string | null> {
  assertHandleIndex(handleIndex);
  if (!(await orphanPersonaRoots()).includes(handleIndex)) return null;
  const file = personaGroupRootFileName(await loginHint(), handleIndex);
  return openColdCustodyRow("identity", file, (bytes) => parseRootRow(bytes, file).verifyingKey);
}

/**
 * The worn face is SESSION STATE, never a pointer at rest. A running vessel wears the face its unlock named; nothing persists a choice
 * across a restart, so the person names the face again at each boot (`lares vault unlock --face N`). With no choice recorded and
 * exactly one face standing unlocked, that face is the one worn.
 */
let wornInSession: number | undefined;
export function setWornFaceInSession(handleIndex: number | undefined): void { wornInSession = handleIndex; }

/**
 * WHETHER THE SOVEREIGN COMPOSITION MAY STAND: the node key (S) held AND the worn face unlocked. A pure query: it reads the
 * seated holder and the floor index and changes nothing, so a preflight reads the same answer the composition does. A place
 * the floor index names no face for needs S alone; a place with faces and no face worn (none, or several and none chosen) stands
 * at the floor.
 */
export function sovereignStands(): boolean {
  const holder = standingCustody();
  if (holder === null || !holder.isUnlocked()) return false;
  const faces = readFaceIndexSync(larIdentityDir()).faces;
  const named = faces.flatMap((f, ordinal) => ("fcid" in f ? [{ ordinal, fcid: f.fcid }] : []));
  if (named.length === 0) return true;
  const open = new Set(holder.unlockedFaces());
  const openOrdinals = named.filter((f) => open.has(f.fcid)).map((f) => f.ordinal);
  const worn = wornInSession ?? (openOrdinals.length === 1 ? openOrdinals[0] : undefined);
  return worn !== undefined && openOrdinals.includes(worn);
}

/** The face this session wears when one stands open, or undefined: the session's choice, else the one face standing open. */
export function wornFaceOrdinal(): number | undefined { return wornInSession; }

function nodeActivePersonaStore(_login: string | null): ActivePersonaStore {
  return {
    async load() {
      if (wornInSession !== undefined) return wornInSession;
      const open = await unlockedFaceOrdinals();
      return open.length === 1 ? open[0] : undefined;   // no inference beyond the one face standing open
    },
    async save(handleIndex) { wornInSession = handleIndex; },
  };
}

/**
 * Build the node PersonaVault over the sealed rows. Resolves the git-email hint ONCE (login-scoped filenames).
 * `rootSlot(i).load` answers a HELD root's keypair (the roster names it, and its row opens to the key the roster
 * records) and `undefined` when the roster holds no line there; `save` lands a root and commits its roster line.
 * `hasRoot`/`listRoots` read the roster alone. `anchors`/`recovery` ride their own sealed stores.
 */
export async function makeNodeFsPersonaVault(): Promise<PersonaVault> {
  const hint  = await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }));
  const login = hint.login;
  return {
    rootSlot(handleIndex) {
      return {
        async load() {
          const line = await readRosterLine(login, handleIndex) ?? undefined;
          return line ? openCommittedRoot(login, line) : undefined;
        },
        async save(keypair) {
          const kept = await commitRoot(login, handleIndex, keypair);
          if (kept.root.verifyingKey !== keypair.verifyingKey) {
            throw new CustodyRowUnavailable("identity", personaGroupRootFileName(login, handleIndex), "names-another-key");
          }
        },
      };
    },
    async listRoots() { return (await readRoster(login)).map((l) => l.handleIndex); },
    async hasRoot(handleIndex) { return (await readRosterLine(login, handleIndex)) !== null; },
    selector: nodeActivePersonaStore(login),
    anchors:  nodeAnchorStore,
    recovery: nodeRecoveryShareStore,
  };
}

async function loginHint(): Promise<string | null> {
  return (await readLocalOperatorHint().catch(() => ({ login: null, displayName: null }))).login;
}

/** A persona-root's public face + whether THIS call minted it (the mesh core's PersonaRoot). */
export type PersonaGroupRoot = PersonaRoot;

/**
 * Generate or load the PersonaGroup-root keypair at `handleIndex` (the operator-root delegation capability).
 * FOUNDER-ONLY — a joining vessel receives the founder's public DID + a signed delegation edge at admit instead.
 *
 * A HELD root (the roster names it) loads: its row opens to the key the roster records, or the act refuses by
 * name. With no roster line, the root row decides under one custody holder: nothing standing takes a fresh
 * keypair, and a root already standing (an orphan an earlier act left, or another process's mint a moment ago)
 * gets adopted and named. The roster line lands last and commits it.
 */
export async function generateOrLoadPersonaGroupRoot(handleIndex = 0): Promise<PersonaGroupRoot> {
  assertHandleIndex(handleIndex);
  const login = await loginHint();
  const line = await readRosterLine(login, handleIndex) ?? undefined;
  if (line) {
    await openCommittedRoot(login, line);
    console.log(`[vessel-identity] loaded PersonaGroup root (persona h${handleIndex})`);
    return { verifyingKey: line.verifyingKey, created: false };
  }
  const kept = await commitRoot(login, handleIndex, await nodeKeypairCrypto.generate());
  if (kept.wrote) {
    console.log(`[vessel-identity] minted PersonaGroup root (persona h${handleIndex})`);
  } else {
    console.log(`[vessel-identity] persona root h${handleIndex} stood with no roster line (an act stopped between its two writes); the roster now records it`);
  }
  return { verifyingKey: kept.root.verifyingKey, created: kept.wrote };
}

/**
 * Load the PersonaGroup-root 32-byte Ed25519 SIGNING seed at `handleIndex` (founder-only). SECURITY: the
 * returned bytes ARE the operator-root private key — the most sensitive secret on the vessel. The root row opens
 * for this one act. Throws when the roster holds no line there (a joinee never holds this), and refuses by name
 * when the line's root row went missing or names another key.
 */
export async function loadPersonaGroupRootSeed(handleIndex = 0): Promise<Uint8Array> {
  assertHandleIndex(handleIndex);
  const login = await loginHint();
  const line = await readRosterLine(login, handleIndex) ?? undefined;
  if (!line) {
    throw new Error(
      `[persona-vault] no persona-root at h${handleIndex} — mint it via the founding ceremony first ` +
      `(founder-only; a joining vessel never holds the root seed)`,
    );
  }
  return signingSeedFromHex((await openCommittedRoot(login, line)).signingKey);
}

/**
 * Read the PersonaGroup-root's PUBLIC verifying key at `handleIndex` — the HUMAN's face, distinct from
 * `loadVesselVerifyingKey` (the PLACE's face). Reads the roster line alone: it opens no root row and never mints,
 * so a caller that merely wants to SHOW the persona root cannot stand one up by accident. Reads undefined when
 * this vessel holds no root there (a joinee pins the founder's DID + a signed edge instead of custodying a root).
 */
export async function loadPersonaGroupRootVerifyingKey(
  handleIndex = 0,
): Promise<string | undefined> {
  assertHandleIndex(handleIndex);
  return (await readRosterLine(await loginHint(), handleIndex))?.verifyingKey;
}

/** True when this vessel HOLDS a persona-root at `handleIndex` (founder-side custody). A joinee holds none. */
export async function personaRootExists(handleIndex: number): Promise<boolean> {
  assertHandleIndex(handleIndex);
  return (await readRosterLine(await loginHint(), handleIndex)) !== null;
}

/** Load the active-persona handle-index the vessel currently WEARS, or undefined when it wears none yet
 *  (no inference from an empty home — the caller decides any default). */
export async function loadActivePersonaIndex(): Promise<number | undefined> {
  return coreLoadActivePersona(await makeNodeFsPersonaVault());
}

/** WEAR a persona — set the active handle-index ("put on a mask"). The custody-by-TYPE wall (uniform,
 *  no founding special-case): wearing REQUIRES that this vessel HOLD that persona-root. */
export async function wearPersona(handleIndex: number): Promise<void> {
  await coreWearPersona(await makeNodeFsPersonaVault(), handleIndex);
  console.log(`[vessel-identity] wearing persona h${handleIndex}`);
}

/** The persona ROSTER — every handle-index this vessel HOLDS a root for, ascending, from the explicit
 *  written record. A one-persona vessel returns `[0]`; a joinee returns `[]`. */
export async function listPersonaRoots(): Promise<number[]> {
  return (await readRoster(await loginHint())).map((l) => l.handleIndex);
}

/** The roster's lines: each held handle-index beside its root's public key, ascending. Opens no root row. */
export async function listPersonaRosterLines(): Promise<readonly PersonaRosterLine[]> {
  return readRoster(await loginHint());
}

/**
 * The ORPHAN roots: every handle-index whose root row stands in the identity home while the roster holds no line
 * for it. An act that stopped between the root's write and the roster's line leaves one; no reader holds it, and
 * `generateOrLoadPersonaGroupRoot` at that index adopts it. Reads the roster and the directory's names, never a
 * root row.
 */
export async function orphanPersonaRoots(): Promise<number[]> {
  const login = await loginHint();
  const held = new Set((await readRoster(login)).map((l) => l.handleIndex));
  const escaped = (login ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const spelled = new RegExp(login ? `^\\.persona-group-root-${escaped}-h(0|[1-9]\\d*)\\.json$` : "^\\.persona-group-root-h(0|[1-9]\\d*)\\.json$");
  let names: string[];
  try { names = faceFileNames(larIdentityDir()); } catch { return []; }
  const out: number[] = [];
  for (const name of names) {
    const m = spelled.exec(name);
    if (m && isIndex(Number(m[1])) && !held.has(Number(m[1]))) out.push(Number(m[1]));
  }
  return out.sort((a, b) => a - b);
}

// ── The two-layer PET-NAME stores — the own-side private label + the own-side public face ────────────
//
// Two DISTINCT sealed rows in `<lares>/identity`, login-scoped like the vault's slots so developers on one
// machine keep separate identity homes:
//   · the PRIVATE pet-name map (`.persona-petnames-${login}.json`) — the human's own label for their own
//     personas, freely renamable, never PUBLICLY federated (persona-petname).
//   · the PUBLIC handle record (`.persona-public-handles-${login}.json`) — the vessel's memory of ITS OWN
//     published glamour faces (index → nym/glamour/causal heads), so a re-publish extends the local frontier
//     (persona-glamour). Distinct from the pet-name map and from the handle-book (others' nyms).
// Each map changes under one custody holder (`updateCustodyRow`): a set or a clear reads the map, changes one
// entry and writes it, so two acts in two processes never drop each other's entry.

/** The private pet-name map filename — login-scoped. */
function personaPetnameFileName(login: string | null, handleIndex: number): string {
  return login ? `.persona-petnames-${login}-h${handleIndex}.json` : `.persona-petnames-h${handleIndex}.json`;
}

/** The public published-face record filename — login-scoped. */
function personaPublicHandleFileName(login: string | null, handleIndex: number): string {
  return login ? `.persona-public-handles-${login}-h${handleIndex}.json` : `.persona-public-handles-h${handleIndex}.json`;
}

/** A `{ <field>: { handleIndex -> entry } }` map row: nothing standing reads as an empty map, and a row that
 *  opens to another shape, or carries an entry `shaped` turns away, refuses `malformed`. */
function parseIndexMap<T>(bytes: Uint8Array | null, file: string, field: string, shaped: (entry: unknown) => entry is T): Record<string, T> {
  const out: Record<string, T> = Object.create(null) as Record<string, T>;
  if (bytes === null) return out;
  const map = objectOf(objectOf(parseRow(bytes, file), file)[field], file);
  for (const [key, entry] of Object.entries(map)) {
    if (!/^(0|[1-9]\d*)$/.test(key) || !isIndex(Number(key)) || !shaped(entry)) throw malformed(file);
    out[key] = entry;
  }
  return out;
}

/** The entries of an index map, ascending by handle-index. */
function sortedEntries<T>(map: Record<string, T>): Array<readonly [number, T]> {
  return Object.entries(map).map(([k, v]) => [Number(k), v] as const).sort((a, b) => a[0] - b[0]);
}

/** Read an index-map row, change it, and write it under one custody holder. */
function changeIndexMap<T>(
  file: string, field: string, shaped: (entry: unknown) => entry is T, change: (map: Record<string, T>) => void,
): Promise<void> {
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  return updateCustodyRow("identity", file, (bytes) => {
    const map = parseIndexMap(bytes, file, field, shaped);
    change(map);
    return { plaintext: encodeRow({ [field]: map }), value: undefined };
  });
}

const isLabel = (entry: unknown): entry is string => typeof entry === "string";

/**
 * Build the node OwnPersonaPetnameStore — the PRIVATE own-persona pet-name map, one sealed row. The map holds
 * only the human's own labels for their own personas; nothing here reaches a board (the never-federates wall
 * stays structural — no board write exists in this shore).
 */
export async function makeNodePersonaPetnameStore(): Promise<OwnPersonaPetnameStore> {
  const login = await loginHint();
  const fileOf = (handleIndex: number): string => personaPetnameFileName(login, handleIndex);
  const read = async (handleIndex: number): Promise<Record<string, string>> => parseIndexMap(await readCustodyRow("identity", fileOf(handleIndex)), fileOf(handleIndex), "names", isLabel);
  return {
    async get(handleIndex) { return (await read(handleIndex))[String(handleIndex)]; },
    set(handleIndex, petname) { return changeIndexMap(fileOf(handleIndex), "names", isLabel, (names) => { names[String(handleIndex)] = petname; }); },
    clear(handleIndex) { return changeIndexMap(fileOf(handleIndex), "names", isLabel, (names) => { delete names[String(handleIndex)]; }); },
    async entries() { return gatherEntries(read); },
  };
}

/** The entries of the faces standing unlocked, each read from its own face's row, ascending by handle-index. */
async function gatherEntries<T>(read: (handleIndex: number) => Promise<Record<string, T>>): Promise<Array<readonly [number, T]>> {
  const out: Array<readonly [number, T]> = [];
  for (const handleIndex of await unlockedFaceOrdinals()) out.push(...sortedEntries(await read(handleIndex)));
  return out.sort((a, b) => a[0] - b[0]);
}

// ── The DECLARATION store — what a persona declares outward, before any announce ─────────────────────
//
// The third own-side store (persona-declare): the Handle a persona answers to + whether it stands for a Kahu
// seat. It sits between the private pet-name and the published record so neither welds to the other — a
// declared Handle stays a private intent until an announce binds it (the binding law).

/** The declaration map filename — login-scoped, beside the pet-name map. */
function personaDeclarationFileName(login: string | null, handleIndex: number): string {
  return login ? `.persona-declarations-${login}-h${handleIndex}.json` : `.persona-declarations-h${handleIndex}.json`;
}

/** A declaration's shape: an object whose `handle` and `chair`, where present, read as strings and whose `seat` reads as a boolean. */
const isDeclaration = (entry: unknown): entry is PersonaDeclaration => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const d = entry as Record<string, unknown>;
  return (d["handle"] === undefined || typeof d["handle"] === "string")
    && (d["seat"] === undefined || typeof d["seat"] === "boolean")
    && (d["chair"] === undefined || typeof d["chair"] === "string");
};

/**
 * Build the node PersonaDeclarationStore — what each persona declares outward, one sealed row. Nothing here
 * reaches a board: a declaration says what the human MEANS to wear, and only an announce (persona-glamour)
 * binds a persona to a public glamour.
 */
export async function makeNodePersonaDeclarationStore(): Promise<PersonaDeclarationStore> {
  const login = await loginHint();
  const fileOf = (handleIndex: number): string => personaDeclarationFileName(login, handleIndex);
  const read = async (handleIndex: number): Promise<Record<string, PersonaDeclaration>> =>
    parseIndexMap(await readCustodyRow("identity", fileOf(handleIndex)), fileOf(handleIndex), "declarations", isDeclaration);
  return {
    async get(handleIndex) { return (await read(handleIndex))[String(handleIndex)]; },
    set(handleIndex, declaration) { return changeIndexMap(fileOf(handleIndex), "declarations", isDeclaration, (all) => { all[String(handleIndex)] = declaration; }); },
    clear(handleIndex) { return changeIndexMap(fileOf(handleIndex), "declarations", isDeclaration, (all) => { delete all[String(handleIndex)]; }); },
    async entries() { return gatherEntries(read); },
  };
}

/** A published-face record's whole shape. The map's reader also holds each record to the index its key names. */
const isPublicHandle = (entry: unknown): entry is PersonaPublicHandleRecord => {
  const r = entry as Partial<PersonaPublicHandleRecord> | null;
  return !!r && typeof r === "object" && isIndex(r.handleIndex) && isIndex(r.contextIndex)
    && typeof r.nym === "string" && typeof r.glamour === "string"
    && Array.isArray(r.heads) && r.heads.every((head) => typeof head === "string");
};

/**
 * Build the node OwnPublicHandleStore — the vessel's memory of ITS OWN published glamour faces, one sealed row.
 * A record names a face this vessel published, and the row lists every face of every persona on this vessel
 * side by side, so it rests under the vessel key with the rest of the family. A re-publish reads it to keep
 * extending the causal frontier a peer's HandleBook holds to.
 */
export async function makeNodePublicHandleStore(): Promise<OwnPublicHandleStore> {
  const login = await loginHint();
  const fileOf = (handleIndex: number): string => personaPublicHandleFileName(login, handleIndex);
  const keyed = (map: Record<string, PersonaPublicHandleRecord>, file: string): Record<string, PersonaPublicHandleRecord> => {
    for (const [key, record] of Object.entries(map)) if (String(record.handleIndex) !== key) throw malformed(file);
    return map;
  };
  const read = async (handleIndex: number): Promise<Record<string, PersonaPublicHandleRecord>> =>
    keyed(parseIndexMap(await readCustodyRow("identity", fileOf(handleIndex)), fileOf(handleIndex), "handles", isPublicHandle), fileOf(handleIndex));
  return {
    async load(handleIndex) { return (await read(handleIndex))[String(handleIndex)] ?? null; },
    save(record) { return changeIndexMap(fileOf(record.handleIndex), "handles", isPublicHandle, (handles) => { keyed(handles, fileOf(record.handleIndex)); handles[String(record.handleIndex)] = record; }); },
    async list() { return (await gatherEntries(read)).map(([k]) => k); },
  };
}
