/**
 * face-bundle-restore — THE RESTORE: one face returns from its backup bundle onto a vessel that never held it,
 * as a RECOVERY ACT and never a row copy.
 *
 * ── WHAT A RESTORE DOES ─────────────────────────────────────────────────────────────────────────
 * The fresh vessel derives its OWN veil from its own custody root and takes a NEW seat. The bundle hands it the
 * face's root and the lines that let the face stand again; no seat of the lost vessel stands again, and nothing
 * in the bundle could make one (`face-bundle` gives a veil key no home).
 *
 *   1  OPEN        the body's tag verifies before any field reads.
 *   2  PREFLIGHT   every target row and every relation, before any write (each refusal below).
 *   3  COMMIT      ONE cold row, `restore-pending`, holds everything the restore will land. Before it nothing
 *                  moved; after it the restore completes, in this run or the next.
 *   4  LAND        each row from the pending row: the provisional mark, the proof keys, the names, the handle-book
 *                  records, the guardian set, the root and its roster line. Each lands only where nothing stands or where the same bytes stand.
 *   5  RE-ADMIT    the carried key history seats on this vessel's own board and the face lights under this
 *                  vessel's own veil: a fresh key group, the same fixed prefix, a device edge the root signs for
 *                  this vessel's key. The pending row leaves once the face stands lit.
 *
 * ── THE KEY HISTORY CHECK ───────────────────────────────────────────────────────────────────────
 * The root must derive the bundle's own inception, and the carried log must verify whole from it. Then every event
 * this vessel reads for the face, off its own board and off the carried log, folds through the one KEL reader, and
 * the NEWEST event of that lineage must still name the root as the operating key and still commit recovery to the
 * root's own recovery key; any other head, a rotation still open to contest among them, refuses `root-superseded`,
 * and so does a history that forks. A vessel reads no head it never received: the answer names the head the check
 * read and where it read it, and every honest reader that holds a newer head refuses the edge a superseded root
 * signed, at its own gate.
 *
 * ── AFTER GUARDIAN ENROLMENT ───────────────────────────────────────────────────────────────────
 * A face's own bundle restores after it enrols guardians (stable-founding-road#/rulings, "A restore after guardian
 * enrolment"), so long as the newest event still reads as the typed first enrolment the root itself signed: the
 * root still operates, and the rolling commitment names the set that event committed. A guardians' rotation that
 * moves the set ends that reach for every earlier bundle (`root-superseded`). A bundle cut after the enrolment
 * carries the set, and its own log must commit it; the restore checks its keys against this vessel's other faces
 * (no key guards two faces) and lands the face's sealed set row. A bundle cut before the enrolment still restores
 * where the board holds the event, and says the set rode no bundle.
 *
 * ── A RESTORE LANDS ADDITIVELY ──────────────────────────────────────────────────────────────────
 * It never replaces a name, a label, a record or a key the vessel holds. A name fills only where the vessel holds
 * none; a handle-book record this vessel holds keeps its cards and its label.
 *
 * ── A STOPPED RESTORE COMPLETES ─────────────────────────────────────────────────────────────────
 * A pending row that names this same root resumes at step 4, from the row and never from the bundle handed in. The
 * key history check runs again first, over the row's log, the handed bundle's log and the board. A pending row that
 * names another face refuses `restore-pending`, and so does another index named over a restore that stands pending.
 *
 * Node-main only: a worker never imports this module.
 * Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-restore
 */
import { createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync } from "node:fs";
import type { Repo } from "@automerge/automerge-repo";
import {
  GUARDIAN_ENROLMENT_KIND, HANDLE_BOOK_SNAPSHOT_ERA, bundleMemoryKeypair, canonicalJsonBytes, deriveSelfRecoveryKey,
  foldPersonaContests, guardianCompartmentCheck, mintPersonaInception, openFaceBundleBody, readFaceBundleBody, sealKeySetHash,
  sealMemorySecret, verifyPersonaKelFull,
  type FaceBundleBody, type FaceBundleHolding, type PersonaKelEvent,
} from "@lararium/mesh";
import { faceStands, runFoundTheFace } from "./commands/init.js";
import type { BackupDoor } from "./face-bundle-cut.js";
import { IslandVerbRefused } from "./island-verb-ask.js";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openColdCustodyRow, removeColdCustodyRow, updateColdCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { guardianKeysOfOtherFaces, guardianSetFile, readGuardianSet, type GuardianSetRecord } from "./guardian-enrolment.js";
import { couldConfirm, markProvisional } from "./face-provisional.js";
import { faceProofKeyStanding, landFaceProofKey } from "./face-key-custody.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import { loadNodeHandleBook, saveNodeHandleBook } from "./node-circle-store.js";
import {
  landPersonaRoot, listPersonaRosterLines, makeNodePersonaDeclarationStore, makeNodePersonaPetnameStore, orphanPersonaRootKey,
} from "./node-vessel-identity.js";
import { readLocalPersonaKelEvents, seatLocalPersonaKelChain } from "./local-persona-kel.js";
import { RESTORE_PENDING_FILE, restorePendingFile } from "./vault-carriers.js";
import { faceFileNames } from "./face-index.js";
import { ensureFaceCustodyAtHandle } from "./face-route.js";
import { larIdentityDir } from "./vessel-paths.js";
import { hearthAid } from "./hearth-aid.js";
import { larBootstrapPath } from "./vessel-paths.js";

/** The names a restore refuses under (custody#/the-restore). `bundle-malformed` and `no-slot-opens` belong to the command, which opens the file. */
export const RESTORE_REFUSALS = [
  "bundle-refused", "bundle-inconsistent", "root-superseded", "face-already-held", "restore-pending", "place-unfounded",
  "founding-face-unlit", "no-hearth", "index-held", "roster-names-another-key", "orphan-names-another-key", "row-conflict",
  "guardian-key-serves-another-face", "hearth-stands",
] as const;
export type RestoreRefusal = (typeof RESTORE_REFUSALS)[number];

/** A restore that refuses. Every refusal lands before the commit row, so before any row moves. */
export class RestoreRefused extends Error {
  override readonly name = "RestoreRefused";
  constructor(readonly reason: RestoreRefusal, message: string) { super(message); }
}

/** What a restore answers its one caller. Nothing secret. */
export interface FaceBundleRestored {
  readonly face:     { readonly handleIndex: number; readonly verifyingKey: string };
  readonly prefix:   string;
  /** True where this run found a pending row of this same face and completed it. */
  readonly resumed:  boolean;
  /** The head the key history check read: its sequence, and whether this vessel's own board held a history for the face. */
  readonly checked:  { readonly seq: number; readonly from: "board" | "bundle" };
  /**
   * The face's guardian set: `none` where its log still stands one-of-one; `landed` where the bundle carried the set
   * the log commits and its row landed here; `held` where this vessel already held that same row; `absent` where the
   * log commits a set no part of this bundle carried (a bundle cut before the enrolment).
   */
  readonly guardianSet: "none" | "landed" | "held" | "absent";
  /** The face stands PROVISIONAL (custody#/the-restore): who could confirm it, in words a person reads. */
  readonly provisional: { readonly couldConfirm: readonly string[] };
  readonly landed:   {
    readonly faceProofKeys: number; readonly petname: boolean; readonly handle: boolean;
    readonly handleBook: { readonly landed: number; readonly kept: number };
  };
  /** What the bundle's memory section holds, for the command's own words: an import lands it (`bundle.import`). */
  readonly holds:    readonly FaceBundleHolding[];
}

/** The pending row's plaintext: the target index and the whole body the restore lands. */
interface Pending { readonly target: number; readonly body: FaceBundleBody }

const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");
/** The Ed25519 public key (lower hex) a 32-byte seed (lower hex) derives. */
function publicOfSeed(seedHex: string): string {
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, Buffer.from(seedHex, "hex")]), format: "der", type: "pkcs8" });
  return Buffer.from((createPublicKey(key).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
}
const bare = (did: string): string => did.trim().toLowerCase().replace(/^0x/, "");
const refuse = (reason: RestoreRefusal, message: string): never => { throw new RestoreRefused(reason, message); };

/** Open and read a bundle's body, or refuse: `bundle-refused` where the tag fails, `bundle-inconsistent` where the bytes read as no body. */
export function openRestoreBody(sealedBody: Uint8Array, bundleKey: Uint8Array): FaceBundleBody {
  const plain = openFaceBundleBody(sealedBody, bundleKey);
  if (plain === null) return refuse("bundle-refused", "the bundle's body failed its tag: altered bytes, or another bundle's key. Nothing was read and nothing moved.");
  try {
    return readFaceBundleBody(plain) ?? refuse("bundle-inconsistent", "the bundle's body opened and reads as no bundle body. Nothing moved.");
  } finally { plain.fill(0); }
}

/**
 * THE BODY AGREES WITH ITSELF: the root's public key derives from its seed, the roster line names that key, the
 * signer's name and the prefix read as the root itself derives them, and the carried log verifies whole from the
 * inception that root derives. Answers that inception's recovery commitment, which the head check reads.
 */
async function consistent(body: FaceBundleBody): Promise<{ readonly signerDid: string; readonly recoveryCommit: string }> {
  const inconsistent = (why: string): never => refuse("bundle-inconsistent", `the bundle's own parts disagree (${why}). Nothing moved.`);
  if (publicOfSeed(body.root.signingKey) !== body.root.verifyingKey) inconsistent("the root's key differs from the one its seed derives");
  if (body.rosterLine.verifyingKey !== body.root.verifyingKey) inconsistent("the roster line names another key than the root");
  if (bare(body.anchors.signerDid) !== body.root.verifyingKey) inconsistent("the signer's name differs from the root's key");
  const signerDid = `0x${body.root.verifyingKey}`;
  const seed = Uint8Array.from(Buffer.from(body.root.signingKey, "hex"));
  let recoveryCommit: string;
  try { recoveryCommit = sealKeySetHash([(await deriveSelfRecoveryKey(seed)).verifyingKey], 1); } finally { seed.fill(0); }
  const inception = mintPersonaInception(signerDid, recoveryCommit);
  if (inception.prefix !== body.anchors.personaKelPrefix) inconsistent("the prefix differs from the one the root derives");
  if (body.kel.length === 0 || body.kel[0]!.eventCid !== inception.eventCid) inconsistent("the carried key history does not begin at the root's own inception");
  if (body.kel.some((e) => e.prefix !== inception.prefix)) inconsistent("the carried key history names another prefix");
  const verified = await verifyPersonaKelFull(body.kel);
  if (!verified.ok) inconsistent(`the carried key history fails to verify: ${verified.reason ?? "unverified"}`);
  // A CARRIED GUARDIAN SET recomputes the digest it names, and the carried log's own typed first enrolment commits it.
  const set = body.guardianSet;
  if (set !== null) {
    const keys = set.guardians.map((g) => g.recoveryPubKey);
    if (new Set(keys).size !== keys.length || sealKeySetHash(keys, set.threshold) !== set.guardianSetHash) inconsistent("the carried guardian set does not recompute the digest it names");
    if (!body.kel.some((e) => e.kind === GUARDIAN_ENROLMENT_KIND && e.nextRecoverySetHash === set.guardianSetHash)) inconsistent("the carried guardian set names a digest no enrolment in the carried key history commits");
  }
  return { signerDid, recoveryCommit };
}

/**
 * THE FACE'S CURRENT KEY HISTORY STILL ACCEPTS THE ROOT. Every event this vessel reads for the face, off its own
 * board and off the carried log, folds through the ONE reader (`foldPersonaContests`): an event that does not
 * verify moves nothing, and two verified events at one seat read as a fork the fold never settles. The lineage
 * must begin at the root's own inception and must not fork; its newest event, a rotation still open to contest
 * among them, must name the root as the operating key and commit recovery to the root's own recovery key.
 */
async function currentHead(body: FaceBundleBody, carried: readonly PersonaKelEvent[], repo: Repo, signerDid: string, recoveryCommit: string): Promise<FaceBundleRestored["checked"] & { readonly enrolledSet: string | null; readonly eventCid: string }> {
  const board = await readLocalPersonaKelEvents(repo, body.anchors.personaKelPrefix);
  const fold = foldPersonaContests([...board, ...carried].sort((a, b) => a.seq - b.seq));
  const head = fold.kel[fold.kel.length - 1];
  if (!head || fold.kel[0]!.eventCid !== body.kel[0]!.eventCid) return refuse("bundle-inconsistent", "the key history this vessel reads for the face does not begin at the root's own inception. Nothing moved.");
  if (fold.fork !== null) {
    return refuse("root-superseded", `the key history this vessel reads for the face FORKS at sequence ${fold.fork.seq}: two verified events claim one seat, and no reader settles that by order. Nothing moved.`);
  }
  // THE ROOT STILL ANSWERS: it operates, and recovery rests with its own key, or with the set the root itself enrolled
  // by the typed first event, which the one reader admits only over a one-of-one head under the same op-key.
  const enrolled = head.kind === GUARDIAN_ENROLMENT_KIND;
  if (bare(head.opKeyDid) !== bare(signerDid) || (!enrolled && head.nextRecoverySetHash !== recoveryCommit)) {
    return refuse("root-superseded", `the newest key event this vessel reads for the face (sequence ${head.seq}) names another operating key or commits recovery to another key set: the face's current key history no longer accepts this root. Nothing moved.`);
  }
  if (body.guardianSet !== null && body.guardianSet.guardianSetHash !== head.nextRecoverySetHash) {
    return refuse("root-superseded", `the newest key event this vessel reads for the face (sequence ${head.seq}) commits another guardian set than the one this bundle carries. Nothing moved.`);
  }
  // WHERE THE HEAD CAME FROM: this vessel's own board where the board itself holds that event, the bundle otherwise.
  return {
    seq: head.seq, from: board.some((event) => event.eventCid === head.eventCid) ? "board" : "bundle",
    enrolledSet: enrolled ? head.nextRecoverySetHash : null, eventCid: head.eventCid,
  };
}

/** Read the pending row, or null where none stands. A row that stands and reads as no pending row refuses by name. */
async function readPending(): Promise<Pending | null> {
  // The pending row rests in its target face: the one file name any face holds names the target.
  const standing = faceFileNames(larIdentityDir()).filter((n) => RESTORE_PENDING_FILE.test(n));
  if (standing.length === 0) return null;
  if (standing.length > 1) throw new RestoreRefused("restore-pending", "more than one face holds a restore pending on this vessel; run each face's own restore again, lowest handle index first. Nothing moved.");
  const file = standing[0]!;
  return await openColdCustodyRow("identity", file, (bytes) => {
    let raw: { target?: unknown; body?: unknown };
    try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as typeof raw; }
    catch { throw new CustodyRowUnavailable("identity", file, "malformed"); }
    const body = raw.body === undefined ? null : readFaceBundleBody(canonicalJsonBytes(raw.body));
    if (!Number.isSafeInteger(raw.target) || (raw.target as number) < 0 || body === null || restorePendingFile(raw.target as number) !== file) throw new CustodyRowUnavailable("identity", file, "malformed");
    return { target: raw.target as number, body };
  });
}

/** The root key of the face whose restore stands pending on this vessel, or null where none stands. Writes nothing. */
export async function restorePendingRoot(): Promise<string | null> {
  return (await readPending())?.body.root.verifyingKey ?? null;
}

/** PREFLIGHT every target row and relation. Writes nothing. */
async function preflight(body: FaceBundleBody, target: number, founding = false): Promise<void> {
  if (!existsSync(larBootstrapPath())) refuse("place-unfounded", "no founded place stands here: a restore lands a face onto a vessel `lares vessel found` already stood. Nothing moved.");
  // A RESTORED FACE BINDS THE HEARTH IT LANDS ON: its device edge names this vessel's seed charter, so a place with
  // none holds no hearth for it. The person founds the fresh hearth first (`lares vessel found --hearth`), and the
  // restore lands beside persona zero at a free index.
  // The founding act's own restore seats that charter itself, after the root lands and before the face lights.
  if (founding && hearthAid() !== null) refuse("hearth-stands", "a seed charter already stands on this vessel, so the founding act lands no restored face as its persona zero here. Nothing moved; restore beside persona zero with `lares vault restore <file> --as <N>`.");
  if (!founding && hearthAid() === null) refuse("no-hearth", "no seed charter stands on this vessel, so no hearth stands for the restored face to bind to. Nothing moved; found the hearth FROM this bundle, its face as persona zero (`lares vessel found --hearth --restore <file>`), or found it with `lares vessel found --hearth --name '<label>'`, then restore at a free index (--as <N>).");
  const roster = await listPersonaRosterLines();
  if (roster.some((l) => l.verifyingKey === body.root.verifyingKey)) {
    refuse("face-already-held", "this vessel already holds this face's root, and no restore of it stands pending: a second restore over it. Nothing moved.");
  }
  const line = roster.find((l) => l.handleIndex === target);
  if (line) refuse("roster-names-another-key", `this vessel's roster names another root at h${target}. Nothing moved; name a free index with --as <N>.`);
  const orphan = await orphanPersonaRootKey(target);
  if (orphan !== null && orphan !== body.root.verifyingKey) refuse("orphan-names-another-key", `a root row stands at h${target} under another key, with no roster line. Nothing moved.`);
  if ((await loadIdentityAnchors(target)) !== null || (target === 0 && faceStands())) refuse("index-held", `a face already stands lit at h${target}. Nothing moved; name a free index with --as <N>.`);
  if (target > 0 && !faceStands()) refuse("founding-face-unlit", `no founding face stands on this vessel, and a face at h${target} rides beside one. Nothing moved; restore at index 0 (--as 0), or light the founding face first.`);
  // EVERY ROW THE LANDING WILL READ, read now: a names row or a handle-book that stands and does not read whole
  // refuses here, by its own name, before the commit row. The landing then meets no row it has not already read.
  await (await makeNodePersonaPetnameStore()).get(target);
  await (await makeNodePersonaDeclarationStore()).get(target);
  await loadNodeHandleBook();
  for (const key of body.faceProofKeys) {
    const secret = Uint8Array.from(Buffer.from(key.secret, "hex"));
    try {
      if ((await faceProofKeyStanding(key.scope, secret, target)) === "conflict") refuse("row-conflict", "a face proof key row the restore would write stands under other bytes, or under another face. Nothing moved.");
    } finally { secret.fill(0); }
  }
  // THE GUARDIAN SET: no key guards two faces of one vessel (persona-policy#/distinct-recovery), and a set row at the
  // target stands only for this same set.
  if (body.guardianSet !== null) {
    const apart = guardianCompartmentCheck({ offered: body.guardianSet.guardians.map((g) => g.recoveryPubKey), heldByOtherFaces: await guardianKeysOfOtherFaces(target) });
    if (!apart.ok) refuse("guardian-key-serves-another-face", `the carried guardian key ${apart.key.slice(0, 16)}… already guards the face at h${apart.handleIndex} on this vessel: a guardian holds a fresh key for each face. Nothing moved.`);
  }
  const standing = await readGuardianSet(target);
  if (standing !== null && (body.guardianSet === null || standing.guardianSetHash !== body.guardianSet.guardianSetHash || standing.prefix !== body.anchors.personaKelPrefix)) {
    refuse("row-conflict", `a guardian-set row stands at h${target} for another set or another face. Nothing moved.`);
  }
}

/** The face's set row as the restore lands it: the carried set under the face's own prefix. */
function guardianRecordOf(body: FaceBundleBody): GuardianSetRecord | null {
  const set = body.guardianSet;
  return set === null ? null : { prefix: body.anchors.personaKelPrefix, guardianSetHash: set.guardianSetHash, threshold: set.threshold, guardians: set.guardians };
}

/** LAND each row a pending restore holds. Each lands only where nothing stands or where the same bytes stand. */
async function land(pending: Pending, head: { readonly seq: number; readonly eventCid: string; readonly from: "board" | "bundle" }): Promise<FaceBundleRestored["landed"] & { readonly guardianSet: "landed" | "held" | null }> {
  const { body, target } = pending;
  // THE PROVISIONAL MARK lands first among the rows: a face never stands restored here without it.
  await markProvisional(target, { prefix: body.anchors.personaKelPrefix, head: { seq: head.seq, eventCid: head.eventCid }, from: head.from });
  for (const key of body.faceProofKeys) {
    const secret = Uint8Array.from(Buffer.from(key.secret, "hex"));
    try { await landFaceProofKey(key.scope, secret, target); } finally { secret.fill(0); }
  }
  // A NAME FILLS ONLY WHERE THE VESSEL HOLDS NONE.
  let petname = false, handle = false;
  if (body.names.petname !== undefined) {
    const store = await makeNodePersonaPetnameStore();
    if ((await store.get(target)) === undefined) { await store.set(target, body.names.petname); petname = true; }
  }
  if (body.names.handle !== undefined) {
    const store = await makeNodePersonaDeclarationStore();
    const standing = await store.get(target);
    if (standing?.handle === undefined) { await store.set(target, { ...(standing ?? {}), handle: body.names.handle }); handle = true; }
  }
  const book = await loadNodeHandleBook();
  const handleBook = await book.landFor(body.root.verifyingKey, { era: HANDLE_BOOK_SNAPSHOT_ERA, records: body.handleBook.records });
  if (handleBook.landed > 0 || handleBook.kept > 0) await saveNodeHandleBook(book);
  // THE GUARDIAN SET lands where none stands; the same set there stays as it stands.
  let guardianSet: "landed" | "held" | null = null;
  const record = guardianRecordOf(body);
  if (record !== null) {
    guardianSet = await updateCustodyRow("identity", guardianSetFile(target), (standing) => {
      if (standing === null) return { plaintext: new TextEncoder().encode(JSON.stringify(record)), value: "landed" as const };
      const held = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(standing)) as GuardianSetRecord;
      if (held.guardianSetHash !== record.guardianSetHash || held.prefix !== record.prefix) {
        throw new RestoreRefused("row-conflict", `a guardian-set row appeared at h${target} for another set while this restore landed; the pending row stays for a person to read`);
      }
      return { plaintext: null, value: "held" as const };
    });
  }
  // THE ROOT AND ITS ROSTER LINE LAND LAST among the rows: every reader that asks "does this vessel hold the face"
  // reads the roster, so a restore that stopped sooner still reads as one that owes.
  await landPersonaRoot(target, { signingKey: body.root.signingKey, verifyingKey: body.root.verifyingKey });
  return { faceProofKeys: body.faceProofKeys.length, petname, handle, handleBook, guardianSet };
}

/**
 * Restore one face from its bundle. `withRepo` runs one act against the store's one holder: the standing vessel's
 * own Repo, or the one a command holds for the moment of its act. The caller owns `bundleKey` and zero-fills it.
 */
export async function restoreFaceBundle(args: {
  readonly sealedBody: Uint8Array;
  readonly bundleKey:  Uint8Array;
  /** The handle-index the face lands at here; absent, the index the bundle's own roster line named. */
  readonly as?:        number;
  readonly withRepo:   <T>(act: (repo: Repo) => Promise<T>) => Promise<T>;
  readonly genesisDir?: string;
  readonly founding?:   () => Promise<void>;
}): Promise<FaceBundleRestored> {
  const { sealedBody, bundleKey, ...rest } = args;
  return restoreFaceBody({ body: openRestoreBody(sealedBody, bundleKey), ...rest });
}

/**
 * Restore one face from a body already opened: the steps after OPEN, for every door that hands the restore a
 * face (a bundle's sealed body, or a body another reader built). The body still passes every check a bundle's
 * body passes, and lands through the same one commit row.
 */
export async function restoreFaceBody(args: {
  readonly body:     FaceBundleBody;
  readonly as?:      number;
  readonly withRepo: <T>(act: (repo: Repo) => Promise<T>) => Promise<T>;
  /** The genesis the face's rite reads (the founding's own, where a founding act runs the restore). */
  readonly genesisDir?: string;
  /**
   * THE FOUNDING ACT'S OWN STEP (a restore as persona zero, `found --hearth` from a bundle). Present, the face lands
   * at h0 on a place that holds no seed charter yet, and this step runs after the rows land and the history seats
   * and before the face lights: it seats the seed charter over the restored root, so the face lights bound to that
   * charter's AID. A resumed restore runs it again, and it answers what an earlier run already wrote.
   */
  readonly founding?: () => Promise<void>;
}): Promise<FaceBundleRestored> {
  const { body } = args;
  const { signerDid, recoveryCommit } = await consistent(body);

  let pending = await readPending();
  const resumed = pending !== null;
  if (pending !== null && pending.body.root.verifyingKey !== body.root.verifyingKey) {
    refuse("restore-pending", "another face's restore stands pending on this vessel. Run that face's own restore again first: it completes, and this one follows. Nothing moved.");
  }

  return args.withRepo(async (repo) => {
    // The head check runs on every run, a resumed one too, over EVERY event in reach: this vessel's board, the
    // pending row's log, and the log of the bundle handed in now (another cut of the face may carry a newer head).
    const checked = await currentHead(body, [...(pending?.body.kel ?? []), ...body.kel], repo, signerDid, recoveryCommit);
    if (pending !== null && args.as !== undefined && args.as !== pending.target) {
      refuse("restore-pending", `a restore of this face already stands pending at h${pending.target}: run the same restore again with no other index, and it completes there. Nothing moved.`);
    }
    if (pending === null) {
      const target = args.as ?? body.rosterLine.handleIndex;
      if (args.founding && target !== 0) refuse("index-held", `the founding act lands its restored face as persona zero, at h0, never at h${target}. Nothing moved.`);
      await preflight(body, target, args.founding !== undefined);
      // ONE DURABLE COMMIT. Before this write nothing moved; after it the restore completes, in this run or the next.
      pending = { target, body };
      const row = canonicalJsonBytes(pending);
      // THE TARGET FACE'S CUSTODY COMES FIRST: its slot and owner binding stand (reserved at the handle index, under the route
      // the face asks for), and the pending row rests under that face's own key.
      await ensureFaceCustodyAtHandle(target, `h${target}`);
      try {
        await updateColdCustodyRow("identity", restorePendingFile(target), (standing) => {
          if (standing !== null) throw new RestoreRefused("restore-pending", "a restore's commit row appeared while this one checked its rows. Run the restore again.");
          return { plaintext: row, value: undefined };
        });
      } finally { row.fill(0); }
    }
    const { guardianSet: setLanded, ...landed } = await land(pending, checked);
    // RE-ADMIT. The carried history seats on this vessel's own board, then the face lights under this vessel's own
    // veil. `runFoundTheFace` reads the root the roster now names and founds: the same fixed prefix, a fresh key
    // group, a device edge the root signs for this vessel's key. A face that already stands lit reads so and moves nothing.
    await seatLocalPersonaKelChain(repo, pending.body.kel);
    if (args.founding) await args.founding();
    const lit = await runFoundTheFace({ repo, handleIndex: pending.target, ...(args.genesisDir ? { genesisDir: args.genesisDir } : {}) });
    if (!lit.alreadyStood && lit.personaKelPrefix !== pending.body.anchors.personaKelPrefix) {
      throw new Error(`face-bundle-restore: the face lit under prefix ${lit.personaKelPrefix}, and the bundle carried ${pending.body.anchors.personaKelPrefix}; the pending row stays for a person to read`);
    }
    await removeColdCustodyRow("identity", restorePendingFile(pending.target));
    return {
      face: { handleIndex: pending.target, verifyingKey: pending.body.root.verifyingKey },
      prefix: pending.body.anchors.personaKelPrefix, resumed, checked: { seq: checked.seq, from: checked.from }, landed,
      guardianSet: checked.enrolledSet === null ? "none" : setLanded ?? "absent", holds: pending.body.memory.holds,
      provisional: { couldConfirm: await couldConfirm(pending.target) },
    };
  });
}

// ── The import: the bundle's memory section lands on the restored seat ───────────────────────────────────────────

/** The names an import refuses under before the island's own door judges an entry (custody#/the-restore). */
export const IMPORT_REFUSALS = ["bundle-refused", "bundle-inconsistent", "face-not-worn", "another-face", "memory-unavailable"] as const;
export type ImportRefusal = (typeof IMPORT_REFUSALS)[number];

/** An import that refuses whole. `reason` names the refusal; an island's own refusal rides under its own name. */
export class ImportRefused extends Error {
  override readonly name = "ImportRefused";
  constructor(readonly reason: string, message: string) { super(message); }
}

/** One entry's outcome, as the island's import door names it (`MEMORY_OUTCOMES`). */
export interface MemoryImported { readonly bagId: string; readonly keyVersion: string; readonly outcome: string; readonly cause?: string }

/**
 * Import a bundle's memory section through the standing vessel's daemon island (`lares vault restore --memory`).
 * The vessel stands unlocked and WEARS the face the bundle carries: the island wraps each key for this vessel's own
 * seat in that face's key group. The section's secret half derives from the bundle key on this thread and crosses
 * to the island sealed to a key the island named for this one import; no bare content key crosses the port.
 * The caller owns `bundleKey` and zero-fills it.
 */
export async function importFaceBundleMemory(args: {
  readonly sealedBody: Uint8Array;
  readonly bundleKey:  Uint8Array;
  readonly door:       BackupDoor | null;
}): Promise<{ readonly face: { readonly handleIndex: number; readonly verifyingKey: string }; readonly results: readonly MemoryImported[] }> {
  let body: FaceBundleBody;
  try { body = openRestoreBody(args.sealedBody, args.bundleKey); }
  catch (err) { if (err instanceof RestoreRefused) throw new ImportRefused(err.reason, err.message); throw err; }
  const door = args.door;
  const worn = door?.wornFace() ?? null;
  if (door === null || worn === null) {
    throw new ImportRefused("face-not-worn", "this vessel stands wearing no face: an import wraps each key for this vessel's own seat in the face's key group. Stand the vessel wearing the restored face, unlock it, then import.");
  }
  const line = (await listPersonaRosterLines()).find((l) => l.handleIndex === worn);
  if (!line || line.verifyingKey !== body.root.verifyingKey) {
    throw new ImportRefused("another-face", `the bundle carries another face than the one this vessel wears (h${worn}): its keys would land on another face's seat. Nothing imported.`);
  }
  if (door.memoryDoor === null || door.importMemory === null) {
    throw new ImportRefused("memory-unavailable", "no daemon island stands in this vessel, so no content-key holder takes the memory section. Nothing imported.");
  }
  const pair = bundleMemoryKeypair(args.bundleKey);
  try {
    const named = await door.memoryDoor();
    const sealedSecret = sealMemorySecret(pair.secret, named);
    const results = await door.importMemory(body.memory.section, Buffer.from(sealedSecret).toString("base64"));
    return { face: { handleIndex: worn, verifyingKey: line.verifyingKey }, results };
  } catch (err) {
    if (err instanceof IslandVerbRefused) throw new ImportRefused(err.reason ?? "memory-unavailable", err.message);
    throw err;
  } finally { pair.secret.fill(0); }
}
