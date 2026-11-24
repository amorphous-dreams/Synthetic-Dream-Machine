/**
 * custody-frames — THE CUSTODY DOOR on the vessel's owner-only verb socket: `unlock`, `lock`, `custody`, `act` and
 * `backup`.
 *
 * ── A CREDENTIAL NEVER RIDES A VERB ─────────────────────────────────────────────────────────────
 * A verb's arguments get hashed into a durable receipt fact, handed to the daemon island and recorded with its
 * outcome. A credential on that road leaves a digest any reader of the daemon's document tests guesses against,
 * offline. So the custody door stands AHEAD of the verb seat: the socket's front hands each parsed frame here
 * first, and a custody frame never becomes an invocation — no digest, no receipt, no outcome, no worker message
 * carries it. The handler logs the slot id that opened and the name of a refusal, and nothing of what was sent.
 *
 * ── ONE ACT AT A TIME ───────────────────────────────────────────────────────────────────────────
 * Every custody frame runs on one chain: an unlock finishes its recomposition before the next frame starts, so
 * two unlocks stand one sovereign composition and a lock never interleaves a recomposition in flight.
 *
 * ── WHAT EACH FRAME DOES ────────────────────────────────────────────────────────────────────────
 *   unlock   hand the credentials to the holder; when the key opens, tear the standing composition down and
 *            compose again with the sovereign rows. A composition that refuses leaves the floor standing and the
 *            answer says so.
 *   lock     drop the key, tear the composition down, compose at the floor.
 *   custody  read: unlocked or not, the slot that opened, attempts left, what stands. Opens nothing.
 *   act      run one act of the sealed-act table (`sealed-acts`) against the key a person already opened, and
 *            answer its caller alone. A locked vessel refuses `custody-locked`: an act never opens a key.
 *   wear     move the mount to a face already standing open (under a pūlama, one inside the lent set) and compose again.
 *            It carries no route and hands none to the composition: unlock opens custody, wear chooses the face.
 *   backup   cut one face's backup bundle body (`face-bundle-cut`) and answer it SEALED under the bundle key the
 *            frame carries. The frame also carries the vessel's own route: see below.
 *   rehive   stand a SHUT face's hive again from its own seed, where its veil-archive row holds another identity's Archive
 *            (`face-rehive`). The frame carries the face's own route and the face; the door refuses a face worn or lit
 *            (`face-open`) and opens the face's key for this act alone, outside the holder, so no composition hears it.
 *   recard   light a face whose Archive fell behind its own cards (its last light here refused `FaceHoldsNoPrekeySecret`)
 *            with its card minted before its bags, keeping its identity (`face-recard`). The frame carries the vessel's own
 *            route and the face; the door refuses any face whose last light did not refuse for want of a prekey secret.
 *
 * ── A BACKUP ASKS THE VESSEL'S ROUTE AGAIN ──────────────────────────────────────────────────────
 * An unlocked vessel's door answers any process of its own user, and no act of the table hands out a root. A
 * bundle rebuilds a face's root for whoever holds its route, so the cut rides a frame of its own, apart from the
 * act table: it carries the vessel's own route, and the holder proves that route opens the key it holds before
 * any row opens (`CustodyHolder.proves`). A route that opens no slot spends one of the boot's unlock attempts and
 * refuses `no-slot-opens`; spent attempts refuse `attempts-spent`. The frame carries `op`, `credentials`, `face`
 * and `key`, and nothing beside them. The door logs how the cut ended, by name, and nothing of the route, the
 * key, the face's rows or the sealed body.
 *
 * ── A SEALED ROW'S ACT RIDES THIS DOOR, NEVER A STORE VERB ──────────────────────────────────────
 * A store verb's output rests in the daemon's document as an outcome, in the clear, and the digest of its
 * arguments rests in a receipt. A roster key, a pet-name or a handle-book snapshot on that road would leave its
 * sealed row for an unsealed document. An `act` frame never becomes an invocation: no digest, no receipt, no
 * outcome and no worker message carries its arguments or its answer. The frame names an act of the table and
 * that act's typed arguments and nothing else: a key beside `op`, `act` and `args` refuses the frame, an act the
 * table does not name refuses by name, and no act takes a credential of this vessel. The door logs the act's NAME and how it
 * ended, and never an argument, an answer or a refusal's own words.
 */
import { dropWardTickets, parkWardTicket, wardCredential, type WardCredential } from "./ward-credential.js";
import type { Socket } from "node:net";
import { attemptWarning, type Credential, type DocCensusReading, type HeldSaves, type SlotSpec } from "@lararium/mesh";
import { parkFaceRoute } from "./face-route.js";
import { clearDaemonMount, daemonMountOrdinal, daemonMountState, mountedFaceOrdinal, restoreDaemonMount, setMountedFace, sovereignStands } from "./node-vessel-identity.js";
import { listFaceOrdinals, listFaceCustodyIds } from "./identity-anchors.js";
import { CustodyLocked, CustodyRecordUnavailable, UNLOCK_ATTEMPTS_PER_BOOT, type CustodyHolder, type HolderUnlock } from "./custody-holder.js";

/** A face's refusal carries its own tries left and the climbing words (attempt-budget.ts); any other reading carries none. */
const faceTries = (r: { readonly reading: string; readonly attemptsLeft?: number }): { attemptsLeft?: number; warning?: string } => {
  const left = r.reading === "no-slot-opens" && typeof r.attemptsLeft === "number" ? r.attemptsLeft : r.reading === "attempts-spent" ? 0 : undefined;
  return left === undefined ? {} : { attemptsLeft: left, warning: attemptWarning(left, "face", UNLOCK_ATTEMPTS_PER_BOOT) };
};
import { BackupRefused, type FaceBundleCut } from "./face-bundle-cut.js";
import { SESSION_ACTS, SealedActRefused, isSealedActName } from "./sealed-acts.js";
import { RehiveRefused, type RehiveOutcome } from "./face-rehive.js";
import { readHand } from "./hand-act-gate.js";
import type { PeerKind } from "./uds-peer.js";
import { shoreFlushLines, type ShoreFlushReading } from "./shore-verb.js";

export type CustodyFrame =
  | { readonly op: "unlock"; readonly credentials: readonly Credential[]; readonly face?: number; readonly all?: boolean }
  | { readonly op: "lock"; readonly face?: number }
  /** Wear face `face`: the session's choice among the faces standing open. No credential rides it; `seat: "ai"` marks a frame
   *  an AI seat sent, which the door answers as it answers the operator's own. */
  | { readonly op: "wear"; readonly face: number; readonly seat?: "ai"; readonly yes?: true }
  | { readonly op: "custody" }
  /** The census of saves held in memory, read before a stop: no credential, no act, no chain. */
  | { readonly op: "census" }
  /** The document census: every document the stores hold and who names it, read-only (`lares vessel census --docs`). */
  | { readonly op: "doc-census" }
  | { readonly op: "act"; readonly act: string; readonly args?: Readonly<Record<string, unknown>> }
  /** Cut face `face`'s bundle body, sealed under `key` (a bundle key, 64 lower hex), once `credentials` prove the vessel's own route. */
  | { readonly op: "backup"; readonly credentials: readonly Credential[]; readonly face: number; readonly key: string }
  /** Rehive SHUT face `face` from its own seed, under that face's own route (`credentials`). */
  | { readonly op: "rehive"; readonly credentials: readonly Credential[]; readonly face: number }
  /** Recard face `face`, served here and dark for want of a prekey secret, once `credentials` prove the vessel's own route. */
  | { readonly op: "recard"; readonly credentials: readonly Credential[]; readonly face: number }
  /** Park the human route a NEW face will ask for, for the next face this vessel founds (one use). */
  | { readonly op: "face-route"; readonly slots: readonly SlotSpec[]; readonly purpose: "persona-new" | "bundle.restore"; readonly argsDigest: string }
  /** One ward act's route: the door parks it under a one-use ticket a store verb then names (`ward-credential`). */
  | { readonly op: "ward"; readonly credentials: readonly Credential[]; readonly verb: string; readonly argsDigest: string };

/** What stands after a custody act: the composition's standing, or the fault that left the floor standing. */
export interface CustodyStanding {
  readonly standing: string;
  /** Present when the sovereign composition refused and the vessel stands at the floor instead. */
  readonly refused?: string;
}

export type CustodyAnswer =
  | ({
      readonly op: "unlock"; readonly held?: boolean;
      /** `--all`: each standing face's reading under the presented route, `opened` or `stayed-shut:<reading>`. */
      readonly faceReadings?: ReadonlyArray<{ readonly face: number; readonly reading: string }>;
      /** `--all`: the face the composition wears after it. */
      readonly wears?: number;
      /** A switch whose composition refused: the face it named, why, and the face worn again with the node key held. */
      readonly switchRefused?: string; readonly face?: number; readonly wornAgain?: number;
    } & HolderUnlock & Partial<CustodyStanding>)
  /** The node key opened and a face did not (`face-refused`), or the vessel holds several faces and none was named (`face-not-named`): nothing stays open. */
  | { readonly op: "unlock"; readonly reading: "face-refused" | "face-not-named"; readonly standing: string; readonly face?: number; readonly faceReading?: string; readonly faces?: readonly unknown[]; readonly faceReadings?: ReadonlyArray<{ readonly face: number; readonly reading: string }> }
  /** A wear that stood: the face it wears, or (`switchRefused`) the face it named, why, and the face worn again. */
  | ({ readonly op: "wear"; readonly face: number; readonly held: boolean; readonly already?: true; readonly switchRefused?: string; readonly wornAgain?: number; readonly shore?: ShoreFlushReading } & Partial<CustodyStanding>)
  | ({ readonly op: "lock"; readonly locked: true; readonly was: "unlocked" | "locked"; readonly face?: number } & Partial<CustodyStanding>)
  | { readonly op: "custody"; readonly pulama?: { readonly session: boolean; readonly waits: string | null }; readonly unlocked: boolean; readonly slot: string | null; readonly attemptsLeft: number; readonly standing: string; readonly wikiAwaits: string | null; readonly testScratch: boolean; readonly composing: boolean; readonly facesOpen?: number }
  | { readonly op: "act"; readonly act: string; readonly result: Record<string, unknown> }
  /** Each document with saves held in memory (`SealedDocumentStore.held`), by id and never by body; `standing` names
   *  the composition that answered ("recomposing" while none sits, when `held` reads null). */
  | { readonly op: "census"; readonly held: readonly HeldSaves[] | null; readonly standing: string; readonly locked: boolean; readonly facesLocked?: readonly number[]; readonly facesLit?: readonly number[]; readonly facesDark?: readonly ServedDark[]; readonly worn?: number }
  /** Each document by id, its store, counts and class, and the names that reach it; never a body. */
  | { readonly op: "doc-census"; readonly census: DocCensusReading; readonly standing: string }
  | { readonly op: "face-route"; readonly ref: string }
  | { readonly op: "ward"; readonly ref: string }
  | { readonly op: "backup"; readonly sealedBody: string; readonly holds: FaceBundleCut["holds"]; readonly face: FaceBundleCut["face"]; readonly carries: FaceBundleCut["carries"] }
  | ({ readonly op: "rehive"; readonly face: number } & RehiveOutcome)
  /** A recard whose light stood: the face lit again under its own identity. What it reminted reads on the vessel's log. */
  | { readonly op: "recard"; readonly face: number; readonly recarded: true }
  | { readonly op: string; readonly status: "error"; readonly errorMessage: string; readonly refusal: { readonly reason: string; readonly home?: string; readonly file?: string; readonly reading?: string; readonly attemptsLeft?: number } };

/** A face its custody serves that stands dark here: its last light refused. The note names the cause and the clearing line. */
export interface ServedDark { readonly face: number; readonly cause: string; readonly note: string }

/** The served-but-dark line: the face, why its light refused, and the act that lights it again (the lend's replay). */
export const servedDarkNote = (face: number, cause: string): string =>
  `h${face} served by custody, dark here: its light refused (${cause}); clear it with \`lares vault unlock\` (it replays the lend), or the next custody event`;

/** The served-but-dark set: each face whose light refused here that its custody serves (the lit set), with its note. */
export const servedDark = (refused: ReadonlyArray<{ readonly ordinal: number; readonly cause: string }>, lit: readonly number[]): ServedDark[] =>
  refused.filter((r) => lit.includes(r.ordinal)).map((r) => ({ face: r.ordinal, cause: r.cause, note: servedDarkNote(r.ordinal, r.cause) }));

export interface CustodyFrameDeps {
  readonly holder: CustodyHolder;
  /** Tear the standing composition down and compose again: `sovereign` true with the private rows, false at the floor. */
  readonly recompose: (sovereign: boolean, ward?: WardCredential) => Promise<CustodyStanding>;
  readonly lightFace?: (ordinal: number) => Promise<void>;
  /** Close a face through its actor, holding it dark (no relight) until `releaseFace`; answers at CLOSED. */
  readonly dropFace?: (ordinal: number) => Promise<void>;
  /** Lift the hold `dropFace` set, once the lock locked the key or let it be. */
  readonly releaseFace?: (ordinal: number) => void;
  /** Lift every hold `closeFaces` set (a whole lock that did not lock its key). */
  readonly releaseFaces?: () => void;
  /** Hold a face past CLOSED, right before its key locks; false where it stands lit (the key stays open). */
  readonly holdFace?: (ordinal: number) => boolean;
  /** Hold every face the standing composition knows past CLOSED, right before the vessel key locks; false where any stands lit. */
  readonly holdFaces?: () => boolean;
  /** Each face dark here because its last light refused, with its cause. */
  readonly refusedLights?: () => ReadonlyArray<{ readonly ordinal: number; readonly cause: string }>;
  /** Replay the lend now (the served-but-dark clearing line), awaited. */
  readonly replayLend?: () => Promise<void>;
  /** Close every face through its actor (a whole lock): resolves once each closed; rejects where one did not close whole. */
  readonly closeFaces?: () => Promise<void>;
  /** What stands now. */
  readonly standing: () => string;
  /** The wiki the standing composition holds waiting on a face (its `wiki-awaits-face` line), or null. */
  readonly wikiAwaits?: () => string | null;
  /** Whether this vessel's root carries the harness's scratch marker. */
  readonly testScratch: boolean;
  /** The saves the standing composition holds in memory, by document; null while no composition sits. Absent: every
   *  `census` frame answers `held: null`. */
  readonly heldSaves?: () => readonly HeldSaves[] | null;
  /** The standing composition's document census (`readDocCensus`); null while no composition sits. Absent: every
   *  `doc-census` frame refuses `census-unavailable`. */
  readonly docCensus?: () => Promise<DocCensusReading> | null;
  readonly onLog: (line: string) => void;
  /**
   * Present where a pūlama holds this vessel's custody (`pulama-seat`). `standing` reads whether a session stands and what the
   * pūlama last refused; `dial` asks the pūlama again and composes on what it serves. With it seated, an `unlock` frame
   * carries no credential and reads none: the route belongs at the pūlama's own hand door.
   */
  readonly pulama?: {
    readonly standing: () => { readonly session: boolean; readonly waits: string | null };
    /** `refused` names the composition's own fault where the vessel refused to compose over the session it was served. */
    readonly dial: () => Promise<{ readonly session: boolean; readonly waits: string | null; readonly refused?: string }>;
    /** The faces the pūlama lends this vessel (`PulamaHolder.lends`): a wear chooses among them alone. */
    readonly lent: () => readonly number[];
    /** Tell the pūlama the face a wear just wore (`PulamaHolder.tellWorn`), so a vessel that restarts wears it again. The
     *  wear door alone calls it, with the ordinal alone. */
    readonly tellWorn: (ordinal: number) => Promise<void>;
  };
  /**
   * Run one act of the sealed-act table against the seated holder (`runSealedAct`, bound to what the standing
   * composition lends an act). Absent, every `act` frame refuses `acts-unavailable`.
   */
  readonly runAct?: (act: string, args: unknown) => Promise<Record<string, unknown>>;
  /**
   * Cut one face's bundle body under the bundle key handed in (`cutFaceBundle`, bound to what the standing
   * composition lends a cut). Absent, every `backup` frame refuses `backup-unavailable`.
   */
  /** Cut a face's bundle; the cut hands the root off the vessel, so it opens under the face's ward (`ward`, one act). */
  readonly backup?: (face: number, bundleKey: Uint8Array, ward: WardCredential) => Promise<FaceBundleCut>;
  /** Rehive one SHUT face under its own route (`rehiveShutFace`). Absent, every `rehive` frame refuses `rehive-unavailable`. */
  readonly rehive?: (face: number, credentials: readonly Credential[]) => Promise<RehiveOutcome>;
  /** Arm face `ordinal`'s NEXT light as a recard (`face-recard`), one use. Absent, every `recard` frame refuses `recard-unavailable`. */
  readonly armRecard?: (ordinal: number) => void;
  /**
   * Ask every island of the standing composition that mounts a disk shore to flush (`flushEveryShore`, the same flush the
   * teardown's flush phase runs). A wear that turns the face asks it first, in this process. Absent, or null while no
   * composition sits, a wear turns with no flush reading.
   */
  readonly shoreFlush?: () => Promise<ShoreFlushReading> | null;
  /** Who sent a hand act's frame (`hand-act-gate`); the test seam alone replaces it. */
  readonly peerOf?: (sock: Socket) => Promise<PeerKind>;
}

const OPS: ReadonlySet<string> = new Set(["unlock", "lock", "wear", "custody", "census", "doc-census", "act", "backup", "face-route", "ward", "prove", "rehive", "recard"]);
/** The keys a `recard` frame may carry: the vessel's own route and the face, nothing beside them. */
const RECARD_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "credentials", "face"]);
/** A light refused for want of a prekey secret, read by the refusal's NAME (`FaceHoldsNoPrekeySecret`, as `String(error)` leads
 *  with it), never by its prose: the one dark a recard cures. */
export const STALE_LIGHT = /\bFaceHoldsNoPrekeySecret:/;
/** The keys a `rehive` frame may carry: the face's own route and the face, nothing beside them. */
const REHIVE_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "credentials", "face"]);
/** The keys a `wear` frame may carry: a face, and the seat's mark; no route ever rides a wear. */
const WEAR_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "face", "seat", "yes"]);
const WARD_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "credentials", "verb", "argsDigest"]);
/** The keys a `face-route` frame may carry. */
const FACE_ROUTE_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "slots", "purpose", "argsDigest"]);
/** The keys a `backup` frame may carry. */
const BACKUP_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "credentials", "face", "key", "ward"]);
const BUNDLE_KEY_HEX = /^[0-9a-f]{64}$/;
/** The keys an `act` frame may carry. Any other key refuses the frame, so nothing rides beside an act's own arguments. */
const ACT_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "act", "args"]);

/** The refusal reason a fault of an act answers under, and what the door may log of it: a name, never a message. */
function actFault(e: unknown): { readonly reason: string; readonly extra: { home?: string; file?: string; reading?: string } } {
  if (e instanceof SealedActRefused) return { reason: e.reason, extra: {} };
  if (e instanceof CustodyLocked) return { reason: "custody-locked", extra: {} };
  if (e instanceof CustodyRecordUnavailable) return { reason: "row-unavailable", extra: { home: e.home, file: e.file, reading: e.reading } };
  return { reason: "act-failed", extra: {} };
}

/** How many custody acts may wait their turn at once. */
export const CUSTODY_LINE = 8;

/** A frame this door owns: its `op` names a custody act. A frame with any other shape belongs to the verb seat. */
export function isCustodyFrame(v: unknown): v is { op: string } {
  return !!v && typeof v === "object" && typeof (v as { op?: unknown }).op === "string" && OPS.has((v as { op: string }).op);
}

function credentialsOf(v: unknown): readonly Credential[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: Credential[] = [];
  for (const c of v as unknown[]) {
    const k = (c as { kind?: unknown } | null)?.kind;
    if (k === "passphrase" && typeof (c as { passphrase?: unknown }).passphrase === "string") {
      out.push({ kind: "passphrase", passphrase: (c as { passphrase: string }).passphrase });
    } else if (k === "paper" && Array.isArray((c as { sheets?: unknown }).sheets) && (c as { sheets: unknown[] }).sheets.every((s) => typeof s === "string")) {
      out.push({ kind: "paper", sheets: [...(c as { sheets: string[] }).sheets] });
    } else {
      return null;
    }
  }
  return out;
}

function slotsOf(v: unknown): readonly SlotSpec[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: SlotSpec[] = [];
  for (const slot of v as unknown[]) {
    const t = (slot as { t?: unknown } | null)?.t;
    const pins = (slot as { pins?: unknown } | null)?.pins;
    if (!Number.isSafeInteger(t) || (t as number) < 1 || !Array.isArray(pins) || pins.length === 0) return null;
    const keep: SlotSpec["pins"][number][] = [];
    for (const pin of pins as unknown[]) {
      const k = (pin as { kind?: unknown } | null)?.kind;
      if (k === "passphrase" && typeof (pin as { passphrase?: unknown }).passphrase === "string") keep.push({ kind: "passphrase", passphrase: (pin as { passphrase: string }).passphrase });
      else return null;
    }
    out.push({ t: t as number, pins: keep });
  }
  return out;
}

/**
 * The custody door: the socket front's frame handler, and `act`, the door's one chain for an act that rides a session
 * (`session:act`, `SESSION_ACTS`): the act runs in turn with every unlock, lock and act, and answers as an `act` frame does.
 */
export type CustodyDoor = ((parsed: unknown, sock: Socket) => boolean) & {
  readonly act: (act: string, args: unknown) => Promise<CustodyAnswer>;
};

/**
 * The custody door's handler, in the shape the socket front's `onFrame` takes: `true` when the frame was a
 * custody frame (answered here, never seen by a verb seat), `false` for every other frame.
 */
export function custodyFrameHandler(deps: CustodyFrameDeps): CustodyDoor {
  const { holder } = deps;
  let chain: Promise<void> = Promise.resolve();
  let waiting = 0;
  const answer = (sock: Socket, a: CustodyAnswer): void => {
    try { sock.end(JSON.stringify(a) + "\n"); } catch { /* the caller went away */ }
  };

  /**
   * ONE TYPED CREDENTIAL, TRIED WHERE IT IS NAMED. The node key (S) opens alone; a face opens by its own tree: the face the
   * frame names, or every face (`all`), or (naming none) the vessel's one face. A vessel holding several faces and told none refuses
   * `face-not-named`, so a credential never opens a sibling by luck. The composition stands sovereign when S and the mounted face
   * both stand open (a place with no face needs S alone).
   */
  /**
   * THE COMPOSING FLAG: true from an unlock's (or a lock's) first step to its recomposition's end. The holder reads
   * unlocked BEFORE the recomposition stands, so `unlocked` alone would call a vessel ready that has no verb channel
   * yet. The state query answers outside the chain with this flag, so a caller asking mid-unlock hears it at once.
   */
  let composingDepth = 0;
  /**
   * Whether the standing mount came by the opening rule (`unlock --all` mounting the lowest face it opened) rather than a face
   * a person named (`--face N`, `wear`). Such a mount slides: locking it moves the mount to the next face standing open, as the
   * unnamed daemon mount did, and never drops the vessel to the floor while another face stands open.
   */
  let mountByOpening = false;
  /**
   * WHETHER A FACE HOLDS ANCHORS: a face whose join still waits (its handle reserved, its anchors absent) never takes the mount,
   * by an opening, a lock's slide or a held selection. The boot would read its anchors empty while the daemon names the face that
   * landed, and stand at the floor.
   */
  const holdsAnchors = async (ordinal: number): Promise<boolean> =>
    (await holder.readRecord("identity", `anchors-h${ordinal}.json`).catch(() => null))?.reading === "opens";
  /** The lowest face of `ordinals` that holds anchors, or undefined where none does. */
  const lowestAnchored = async (ordinals: readonly number[]): Promise<number | undefined> => {
    for (const ordinal of [...ordinals].sort((x, y) => x - y)) if (await holdsAnchors(ordinal)) return ordinal;
    return undefined;
  };
  const composing = <A extends unknown[], T>(act: (...args: A) => Promise<T>) => async (...args: A): Promise<T> => {
    composingDepth += 1;
    try { return await act(...args); } finally { composingDepth -= 1; }
  };
  const unlock = composing(async (credentials: readonly Credential[], sel: { readonly face?: number; readonly all?: boolean }): Promise<CustodyAnswer> => {
    const u = await holder.unlock(credentials);
    if (u.reading !== "opens" && u.reading !== "already-unlocked") {
      // THE COUNT RIDES THE REFUSAL (attempt-budget.ts): a miss carries the tries left, the spent reading carries 0, and both
      // carry the climbing words, so every surface (the CLI, the MCP door) speaks the same tier.
      const tries = u.reading === "no-slot-opens" ? u.attemptsLeft : u.reading === "attempts-spent" ? 0 : undefined;
      deps.onLog(`unlock: ${u.reading}${tries !== undefined ? ` (${tries} of ${UNLOCK_ATTEMPTS_PER_BOOT} tries left this boot)` : ""}`);
      return { op: "unlock", ...u, ...(tries !== undefined ? { attemptsLeft: tries, warning: attemptWarning(tries, "vessel", UNLOCK_ATTEMPTS_PER_BOOT) } : {}), standing: deps.standing() };
    }
    const freshly = u.reading === "opens";
    const openBefore = new Set(holder.unlockedFaces());
    const mountedBefore = mountedFaceOrdinal();
    const mountedWasOpen = mountedBefore !== undefined && (await holder.faceStanding({ ordinal: mountedBefore }))?.unlocked === true;
    // A second unlock that names no face finds the key held and the composition standing: nothing to open, nothing to compose;
    // it replays the lend, so a served face whose light refused lights again (the served-but-dark clearing line).
    if (!freshly && sel.face === undefined && sel.all !== true) { await deps.replayLend?.(); return { op: "unlock", ...u, standing: deps.standing() }; }
    const standing = listFaceOrdinals();
    // A pūlama's vessel never reaches here: its unlock frame dials the pūlama (the `deps.pulama` branch), so this direct
    // `lockFace` only ever drops a key this vessel's own holder opened.
    const refuseFaces = async (reading: "face-refused" | "face-not-named", detail: object): Promise<CustodyAnswer> => {
      if (freshly) await holder.lock();           // a key never rests over a floor
      else for (const fcid of holder.unlockedFaces()) if (!openBefore.has(fcid)) await holder.lockFace(fcid);
      deps.onLog(`unlock: ${reading}`);
      return { op: "unlock", reading, ...detail, standing: deps.standing() };
    };
    let mounted: number | undefined = sel.face;
    let chosenByOpening = false;
    const byOpeningBefore = mountByOpening;
    let openedOrdinals: number[] = [];
    /** `--all` answers per face: which faces this route opened, and which stayed shut under it (each by its own reading). */
    let faceReadings: Array<{ readonly face: number; readonly reading: string }> | undefined;
    if (sel.all) {
      const readings = await holder.unlockFaces(credentials);
      const opened = readings.filter((r) => r.reading === "opens" || r.reading === "already-unlocked").map((r) => (r as { ordinal: number }).ordinal);
      openedOrdinals = opened;
      const byFcid = new Map(readings.flatMap((r) => ("fcid" in r ? [[r.fcid, r.reading] as const] : [])));
      faceReadings = [];
      for (const ordinal of standing) {
        const at = await holder.faceStanding({ ordinal });
        const reading = opened.includes(ordinal) ? "opened" : at !== null && at.unlocked ? "opened" : at !== null ? (byFcid.get(at.fcid) ?? "stayed-shut") : "stayed-shut";
        faceReadings.push({ face: ordinal, reading: reading === "opened" ? "opened" : `stayed-shut:${reading}` });
      }
      if (standing.length > 0 && opened.length === 0) return refuseFaces("face-refused", { faces: readings.map((r) => r.reading), faceReadings });
      // `--all --face N` wears N where this route opened it; where N stayed shut, or stands nowhere, the unlock refuses by name.
      if (sel.face !== undefined && !opened.includes(sel.face)) {
        const named = faceReadings.find((r) => r.face === sel.face);
        return refuseFaces("face-refused", { face: sel.face, faceReading: named === undefined ? "not-standing" : named.reading.replace(/^stayed-shut:/, "") });
      }
      // THE MOUNT AFTER AN OPENING: the one face this route opened, else the lowest of those it opened; `lares wear N` switches.
      // A FACE WHOSE ANCHORS STAND ABSENT (a join still pending, its handle reserved) never takes the mount: the boot would read
      // its anchors empty while the daemon names the face that landed. The opening mounts the lowest opened face holding anchors.
      // A HELD SELECTION THAT NAMES A FACE HOLDING NO ANCHORS is no selection: the opening chooses again, as a fresh one does.
      const keepsBefore = mountedBefore !== undefined && await holdsAnchors(mountedBefore);
      if (mounted === undefined && !keepsBefore && opened.length > 0) {
        mounted = (await lowestAnchored(opened)) ?? [...opened].sort((x, y) => x - y)[0]!;
        chosenByOpening = true;
      }
    } else if (sel.face !== undefined) {
      const r = await holder.unlockFace({ ordinal: sel.face }, credentials);
      if (r.reading !== "opens" && r.reading !== "already-unlocked") return refuseFaces("face-refused", { face: sel.face, faceReading: r.reading, ...faceTries(r) });
      openedOrdinals = [sel.face];
    } else if (standing.length === 1) {
      mounted = standing[0]!;
      const r = await holder.unlockFace({ ordinal: mounted }, credentials);
      if (r.reading !== "opens" && r.reading !== "already-unlocked") return refuseFaces("face-refused", { face: mounted, faceReading: r.reading, ...faceTries(r) });
      openedOrdinals = [mounted];
    } else if (standing.length > 1) {
      return refuseFaces("face-not-named", { faces: standing });
    }
    const perFace = faceReadings !== undefined ? { faceReadings, ...(mounted !== undefined ? { wears: mounted } : {}) } : {};
    deps.onLog(`unlocked: slot ${u.reading === "opens" ? u.slot : "(held)"} opened the node key${mounted !== undefined ? `; face h${mounted} open` : ""}`);
    // The unlock NAMES the face the composition MOUNTS for the life of the unlock: the composition's own state, never a pointer at
    // rest, and never a face a command defaults to (a command names `--face N`, or resolves the one face standing open).
    if (mounted !== undefined) { setMountedFace(mounted); mountByOpening = chosenByOpening; }
    // An unlock over a held key that opens no new face and changes no mounted face stands nothing new.
    if (!freshly && holder.unlockedFaces().every((f) => openBefore.has(f)) && (mounted === undefined || mounted === mountedBefore)) {
      await deps.replayLend?.();
      return { op: "unlock", ...u, ...perFace, standing: deps.standing() };
    }
    if (!freshly && mountedWasOpen && mountedBefore !== undefined && (mounted === undefined || mounted === mountedBefore) && deps.lightFace) {
      for (const ordinal of openedOrdinals) {
        const face = await holder.faceStanding({ ordinal });
        if (ordinal !== mountedBefore && face?.unlocked && !openBefore.has(face.fcid)) await deps.lightFace(ordinal);
      }
      return { op: "unlock", ...u, ...perFace, standing: deps.standing(), held: true };
    }
    // THE UNLOCK IS A HAND ACT: its route rides, AS AN ARGUMENT, into the composition it stands, whose boot dial alone may issue the
    // founder's own certificate at a new scope (a ward act); no module holds it, and the composition drops it once that dial settles.
    const stood = await deps.recompose(true, wardCredential(credentials));
    if (stood.refused !== undefined) {
      // A SWITCH THAT FAILS WEARS THE FACE IT LEFT. Over a held key with a face worn and standing, an unlock that names another
      // face to wear and whose composition refused puts the mount back, composes onto it again, and keeps the node key: the
      // operator's standing vessel never drops to the floor because a sibling would not stand.
      if (!freshly && mountedWasOpen && mountedBefore !== undefined && mounted !== undefined && mounted !== mountedBefore) {
        setMountedFace(mountedBefore);
        mountByOpening = byOpeningBefore;
        deps.onLog(`the composition wearing h${mounted} did not stand; h${mountedBefore} worn again, the node key held`);
        const back = await deps.recompose(true, wardCredential(credentials));
        // The answer names the face the vessel wears: `wears` follows the mount back, and `face` names the one that refused.
        const wornBack = faceReadings !== undefined ? { wears: mountedBefore } : {};
        if (back.refused === undefined) return { op: "unlock", ...u, ...perFace, ...wornBack, ...back, held: true, switchRefused: stood.refused, face: mounted, wornAgain: mountedBefore };
      }
      // A KEY NEVER RESTS OVER A FLOOR. When the composition that should have stood on the key refused, the vessel
      // stands at the floor and the holder drops what it opened: held and standing never disagree.
      await holder.lock();
      deps.onLog("the sovereign composition did not stand; the node key dropped again");
      return { op: "unlock", ...u, ...perFace, ...stood, held: false };
    }
    return { op: "unlock", ...u, ...perFace, ...stood, held: true };
  });

  /**
   * WEAR CHOOSES THE FACE; UNLOCK OPENED IT. The face must stand open already (under a pūlama, inside the lent set); the mount
   * moves first, so the sovereign gate reads it, and the composition stands again with NO ward credential: a wear is no ward
   * act, so a face that would need a fresh certificate at a new scope waits for an act that carries its own route. A wear whose
   * composition refuses wears the face it left, and the node key stays held either way: wear never opened it.
   *
   * Under a pūlama, a wear that stands (or finds the face worn already) tells the pūlama the ordinal, which it keeps in
   * memory and hands back to this vessel's next session. The wear answers without waiting on the tell, so a pūlama that
   * never answers holds no custody act behind it; a tell the pūlama refuses names itself and leaves the wear standing.
   *
   * A WEAR THAT TURNS THE FACE FLUSHES EVERY SHORE FIRST (`shoreFlush`), while the face it leaves still stands mounted. Where
   * the flush leaves a carrier unwritten, or an island gives no answer, the wear refuses `shore-unwritten` and names each one:
   * those records rest in the store, and their mirrors stay behind until the face is worn again. The same frame carrying
   * `yes: true` turns anyway. Either answer carries the flush's reading (`shore`).
   */
  const wear = composing(async (face: number, yes = false): Promise<CustodyAnswer> => {
    const tellWorn = (): void => {
      if (!deps.pulama) return;
      deps.pulama.tellWorn(face).catch((e: unknown) => deps.onLog(`wear h${face}: the pūlama did not keep the worn face (${(e as { reading?: unknown }).reading ?? (e instanceof Error ? e.name : "refused")}); a restart wears the lowest face served`));
    };
    const refuse = (reason: string, errorMessage: string, extra: object = {}): CustodyAnswer => {
      deps.onLog(`wear h${face}: refused (${reason})`);
      return { op: "wear", status: "error", errorMessage, refusal: { reason, ...extra } };
    };
    if (!holder.isUnlocked()) return refuse("custody-locked", "this vessel holds no key: open it first (`lares vault unlock`); a wear opens nothing");
    if (deps.pulama) {
      const lent = [...deps.pulama.lent()];
      if (!lent.includes(face)) return refuse("face-not-lent", `the pūlama lends this vessel ${lent.length > 0 ? lent.map((o) => `h${o}`).join(", ") : "no face"}, and h${face} stands outside that set`, { lent });
    }
    const at = await holder.faceStanding({ ordinal: face });
    if (at === null || !at.unlocked) {
      return refuse("face-not-open", at === null
        ? `no face h${face} stands on this vessel`
        : `face h${face} stands shut: open it under its own route (\`lares vault unlock --all\`), then wear it`);
    }
    const before = mountedFaceOrdinal();
    // A wear that names the face already worn names it by choice: the mount reads as named, and a lock of that face never slides it on as an opening's mount slides.
    if (before === face) { mountByOpening = false; tellWorn(); return { op: "wear", face, held: true, already: true, standing: deps.standing() }; }
    // THE ROLLBACK RESTORES THE MOUNT EXACTLY: a named face, the default rule, or NO MOUNT (never the default rule in NO MOUNT's place).
    const shore = (await deps.shoreFlush?.()) ?? undefined;
    if (shore !== undefined) {
      for (const line of shoreFlushLines(shore)) deps.onLog(`wear h${face}: ${line}`);
      if (!shore.whole && !yes) {
        const strands = shoreFlushLines(shore).filter((_, i) => { const part = shore.islands[i]!; return !part.answered || part.unwrittenCount > 0; });
        return refuse("shore-unwritten", `the shore's flush left records unwritten on the face this wear turns away from (${strands.join(" · ")}); they rest in the store, and their mirrors stay behind until that face is worn again: wear again with --yes to turn anyway`, { shore });
      }
    }
    const priorMount = daemonMountState();
    const byOpeningBefore = mountByOpening;
    setMountedFace(face);
    mountByOpening = false;
    deps.onLog(`wear: h${face} worn${before !== undefined ? ` (h${before} before)` : ""}; composing again`);
    let stood: CustodyStanding;
    // A RECOMPOSE THAT THROWS puts the mount back on the face it left before the fault names itself to the caller.
    try { stood = await deps.recompose(true); }
    catch (e) { restoreDaemonMount(priorMount); mountByOpening = byOpeningBefore; throw e; }
    const read = shore !== undefined ? { shore } : {};
    if (stood.refused === undefined) { tellWorn(); return { op: "wear", face, held: true, ...stood, ...read }; }
    restoreDaemonMount(priorMount);
    mountByOpening = byOpeningBefore;
    const back = await deps.recompose(true);
    if (back.refused !== undefined) {
      // A SECOND REFUSAL DROPS NO KEY: a wear opened no key, so the vessel stands at the floor with every key it held (NO MOUNT),
      // and the answer says so.
      clearDaemonMount();
      const floor = await deps.recompose(true);
      deps.onLog(`the composition wearing h${face} did not stand, nor ${before !== undefined ? `h${before} again` : "the mount before it"}; the vessel stands at the floor, every key held`);
      return { op: "wear", face, held: true, ...floor, switchRefused: stood.refused, ...read };
    }
    deps.onLog(`the composition wearing h${face} did not stand; ${before !== undefined ? `h${before} worn again` : "no face named"}, the node key held`);
    return { op: "wear", face, held: true, ...back, switchRefused: stood.refused, ...(before !== undefined ? { wornAgain: before } : {}), ...read };
  });

  /**
   * `lock --face N`: one face drops its key. The mounted face's lock stands the vessel back at the floor through the same gate the
   * unlock reads (`sovereignStands`); a sibling's lock leaves the sovereign composition standing.
   */
  const lockFaceOf = composing(async (ordinal: number): Promise<CustodyAnswer> => {
    // The hold the door's close set lifts once this lock locked the key or let it be.
    try { return await lockFaceHeld(ordinal); } finally { deps.releaseFace?.(ordinal); }
  });
  const lockFaceHeld = async (ordinal: number): Promise<CustodyAnswer> => {
    const named = await holder.faceStanding({ ordinal });
    if (named === null) return { op: "lock", locked: true, was: "locked", face: ordinal, standing: deps.standing() };
    const wasOpen = named.unlocked;
    // THE FACE STANDS PAST CLOSED RIGHT BEFORE ITS KEY LOCKS, in this line, whether or not a close ran ahead: a composition that
    // stood again while this lock waited (a wear, an unlock queued ahead of it, whose face read shut when this frame arrived) may
    // have lit the face, and no close of this lock reached that life. The lock then leaves the key open and says so, never closing
    // that life here, where its work could wait on this very line. A pūlama's face lock lands nowhere here, so its holder answers.
    if (wasOpen && !deps.pulama && deps.holdFace && !deps.holdFace(ordinal)) {
      deps.onLog(`face h${ordinal} stands lit before its key locked; the key stays open`);
      throw new Error(`face h${ordinal} stands lit (a composition lit it after this lock's close, or before any close of it ran) before its key locked, so the key stays open; send the lock again`);
    }
    const wasMounted = sovereignStands();
    // The face the composition wears now, by the unlock's name or the default rule: a lock of THAT face composes again, always.
    const mountBefore = wasOpen ? await daemonMountOrdinal() : undefined;
    const namedMount = mountedFaceOrdinal() === ordinal && !mountByOpening;
    // A LOCAL LOCK RUNS THE TWO PHASES IN ONE PROCESS, the mounted face's as every sibling's: the door closed the face through its
    // actor AHEAD of its line (`dropFace` answered at CLOSED: no visit or work admits, its saves drained, its island told, its
    // host side down, the face held dark), so no act queued behind this lock holds that close, and only now does the key lock.
    // A PŪLAMA HOLDS THIS VESSEL'S FACE KEYS: a face lock lands at the pūlama alone (its hand's `close`), never here.
    if (deps.pulama) throw new Error(`face h${ordinal}'s key rests with this vessel's pūlama: close it there, by its hand`);
    await holder.lockFace(named.fcid);
    deps.onLog(`locked: face h${ordinal} key dropped`);
    // A MOUNT THE OPENING (OR THE DEFAULT RULE) CHOSE SLIDES: locked, it moves to the next open face holding anchors, and the
    // vessel composes there. With none, NO MOUNT stands: the vessel composes at the floor (no default rule picks a pending face),
    // and the next opening chooses afresh. A mount a person named does not slide: its lock leaves the floor.
    if (wasOpen && ordinal === mountBefore && !namedMount) {
      const open = new Set(holder.unlockedFaces());
      const next = await lowestAnchored(listFaceCustodyIds().filter((f) => open.has(f.fcid)).map((f) => f.ordinal));
      if (next !== undefined) { setMountedFace(next); mountByOpening = true; } else clearDaemonMount();
      deps.onLog(next !== undefined ? `the mount slides to h${next}, the next face standing open that holds anchors` : `no open face holding anchors takes h${ordinal}'s mount; the vessel stands at the floor`);
      const stood = await deps.recompose(true);
      return { op: "lock", locked: true, was: "unlocked", face: ordinal, ...stood };
    }
    // A LOCK CLEARS THE SELECTION IT ENDS: a named face whose key dropped leaves NO MOUNT behind, never a selection a door reads worn.
    if (wasOpen && namedMount) clearDaemonMount();
    if (wasOpen && wasMounted && !sovereignStands()) {
      const stood = await deps.recompose(true);
      return { op: "lock", locked: true, was: "unlocked", face: ordinal, ...stood };
    }
    return { op: "lock", locked: true, was: wasOpen ? "unlocked" : "locked", face: ordinal, standing: deps.standing() };
  };

  const lock = composing(async (): Promise<CustodyAnswer> => {
    // A WHOLE LOCK THAT DID NOT LOCK LETS EVERY FACE BE: the holds its close set lift (a key already shut, a lock that threw);
    // a lock that lands stands the vessel at the floor, and no hold outlives the composition it stood in.
    let landed = false;
    try {
      if (!holder.isUnlocked()) return { op: "lock", locked: true, was: "locked", standing: deps.standing() };
      // EVERY FACE STANDS PAST CLOSED RIGHT BEFORE THE VESSEL KEY LOCKS: a composition that stood again while this lock waited may
      // have lit a face its close never reached, and the key then stays open.
      if (deps.holdFaces && !deps.holdFaces()) {
        deps.onLog("a face stands lit before the vessel key locked; the key stays open");
        throw new Error("a face stands lit (a composition lit it after this lock's close) before the vessel key locked, so the key stays open; send the lock again");
      }
      await holder.lock();
      landed = true;
    } finally { if (!landed) deps.releaseFaces?.(); }
    dropWardTickets();
    deps.onLog("locked: the vessel key dropped");
    const stood = await deps.recompose(false);
    return { op: "lock", locked: true, was: "unlocked", ...stood };
  });

  /** One act of the table, run on the door's one chain: an unlock or a lock never interleaves it. */
  const runAct = (name: string, args: unknown) => async (): Promise<CustodyAnswer> => {
    // The log names an act only where the table names it: a caller's own text never reaches the log.
    const logged = isSealedActName(name) ? name : "(an act the table does not name)";
    const refuse = (reason: string, errorMessage: string, extra: object = {}): CustodyAnswer => {
      deps.onLog(`act ${logged}: refused (${reason})`);
      return { op: "act", status: "error", errorMessage, refusal: { reason, ...extra } };
    };
    if (!deps.runAct) return refuse("acts-unavailable", "this vessel's custody door runs no acts");
    if (!holder.isUnlocked()) return refuse("custody-locked", new CustodyLocked().message);
    try {
      const result = await deps.runAct(name, args);
      deps.onLog(`act ${logged}: done`);
      return { op: "act", act: name, result };
    } catch (e) {
      const fault = actFault(e);
      return refuse(fault.reason, e instanceof Error ? e.message : String(e), fault.extra);
    }
  };

  /** One cut, run on the door's one chain. The route proves first; nothing of a row opens before it does. */
  const runBackup = (credentials: readonly Credential[], face: number, keyHex: string, wardRoute: readonly Credential[]) => async (): Promise<CustodyAnswer> => {
    const refuse = (reason: string, errorMessage: string, extra: object = {}): CustodyAnswer => {
      deps.onLog(`backup: refused (${reason})`);
      return { op: "backup", status: "error", errorMessage, refusal: { reason, ...extra } };
    };
    if (!deps.backup) return refuse("backup-unavailable", "this vessel's custody door cuts no bundle");
    if (!holder.isUnlocked()) return refuse("custody-locked", new CustodyLocked().message);
    const proof = await holder.proves(credentials);
    if (proof.reading !== "proves") {
      if (proof.reading === "locked") return refuse("custody-locked", new CustodyLocked().message);
      if (proof.reading === "no-slot-opens") return refuse("no-slot-opens", `no slot of this vessel opens under what was presented; nothing was cut. ${attemptWarning(proof.attemptsLeft, "vessel", UNLOCK_ATTEMPTS_PER_BOOT)}`, { attemptsLeft: proof.attemptsLeft });
      if (proof.reading === "attempts-spent") return refuse("attempts-spent", `nothing was cut. ${attemptWarning(0, "vessel", UNLOCK_ATTEMPTS_PER_BOOT)}`, { attemptsLeft: 0 });
      return refuse(proof.reading, `the vessel's slot tree reads ${proof.reading}; nothing was cut`);
    }
    const bundleKey = Uint8Array.from(Buffer.from(keyHex, "hex"));
    try {
      const cut = await deps.backup(face, bundleKey, wardCredential(wardRoute));
      deps.onLog("backup: done");
      return { op: "backup", sealedBody: Buffer.from(cut.sealedBody).toString("base64"), holds: cut.holds, face: cut.face, carries: cut.carries };
    } catch (e) {
      if (e instanceof BackupRefused) return refuse(e.reason, e.message);
      const fault = actFault(e);
      return refuse(fault.reason === "act-failed" ? "backup-failed" : fault.reason, e instanceof Error ? e.message : String(e), fault.extra);
    } finally { bundleKey.fill(0); }
  };

  /**
   * One rehive, run on the door's one chain. THE FACE STANDS SHUT: worn or lit (its key open in the holder) refuses
   * `face-open`, so no composition reads a row this act moves. The face's own route opens its key for this act alone.
   */
  const runRehive = (credentials: readonly Credential[], face: number, sock: Socket) => async (): Promise<CustodyAnswer> => {
    const refuse = (reason: string, errorMessage: string): CustodyAnswer => {
      deps.onLog(`rehive h${face}: refused (${reason})`);
      return { op: "rehive", status: "error", errorMessage, refusal: { reason } };
    };
    // A HAND ACT: the peer reads first, before any credential the frame carries reaches the holder.
    // An unknown peer stands only because this act proves a person itself: the face's own route, checked against its budget.
    const hand = await readHand(sock, { proveRoute: true }, deps.peerOf);
    if ("refusal" in hand) return refuse(hand.refusal, "a rehive is a person's own act at their terminal: a detected AI seat refuses, and the face's own route is the gate; nothing moved");
    if (!deps.rehive) return refuse("rehive-unavailable", "this vessel's custody door rehives no face");
    // UNDER A PŪLAMA the face's custody rests with the pūlama, which lights faces on its own hand: the rehive runs where it rests.
    if (deps.pulama) return refuse("rehive-under-pulama", `this vessel's custody rests with its pūlama: rehive the face at the pūlama's own hand door, which holds its keys and lights faces on one chain: tools/lares-container.sh pulama lock (it shuts every face), then tools/lares-container.sh pulama rehive ${face}; nothing moved`);
    // A COLD VESSEL REHIVES TOO: the face's own route opens its key for the act, and the node key never needs to stand, so a
    // single-face vessel whose one face's row mismatches never waits on an unlock that would mount that face and refuse.
    const at = await holder.faceStanding({ ordinal: face });
    if (at === null) return refuse("face-not-standing", `no face h${face} stands on this vessel; nothing moved`);
    // A FACE IS OPEN WHEN ITS KEY IS: a selection a lock left behind names no face the composition wears.
    if (at.unlocked) {
      return refuse("face-open", `face h${face} stands open (worn or lit): a rehive moves its rows only while it stands shut. Lock it first (\`lares vault lock --face ${face}\`), wearing another face if it is the worn one, then rehive; nothing moved`);
    }
    try {
      const out = await deps.rehive(face, credentials);
      deps.onLog(`rehive h${face}: ${out.outcome}`);
      return { op: "rehive", face, ...out };
    } catch (e) {
      if (e instanceof RehiveRefused) return refuse(e.reason, e.message);
      return refuse("rehive-failed", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * One recard, run on the door's one chain. THE FACE STANDS SERVED AND DARK for want of a prekey secret: its last light here
   * refused `FaceHoldsNoPrekeySecret`. A face lit, shut, or dark for another cause refuses before anything moves. The vessel's
   * own route proves a person stands here; the door arms the face's next light as a recard and replays the lend, which lights it.
   */
  const runRecard = (credentials: readonly Credential[], face: number, sock: Socket) => async (): Promise<CustodyAnswer> => {
    const refuse = (reason: string, errorMessage: string, extra: { attemptsLeft?: number } = {}): CustodyAnswer => {
      deps.onLog(`recard h${face}: refused (${reason})`);
      return { op: "recard", status: "error", errorMessage, refusal: { reason, ...extra } };
    };
    const hand = await readHand(sock, { proveRoute: true }, deps.peerOf);
    if ("refusal" in hand) return refuse(hand.refusal, "a recard asks a person at their terminal: a detected AI seat refuses, and the vessel's own route gates it; nothing moved");
    if (!deps.armRecard || !deps.refusedLights || !deps.replayLend) return refuse("recard-unavailable", "this vessel's custody door recards no face; nothing moved");
    if (deps.pulama) return refuse("recard-under-pulama", `this vessel's custody rests with its pūlama, which lights faces on its own hand; nothing moved. Read the face there: tools/lares-container.sh pulama status`);
    if (!holder.isUnlocked()) return refuse("custody-locked", `${new CustodyLocked().message}: unlock it (\`lares vault unlock\`), then \`lares vault recard --face ${face}\`; nothing moved`);
    const at = await holder.faceStanding({ ordinal: face });
    if (at === null) return refuse("face-not-standing", `no face h${face} stands on this vessel (\`lares vessel roster\` names each face); nothing moved`);
    // THE NO-OP GUARD: only a face whose last light here refused for want of a prekey secret recards.
    const dark = deps.refusedLights().find((r) => r.ordinal === face);
    if (!at.unlocked) return refuse("face-shut", `face h${face} stands shut: open it (\`lares vault unlock --face ${face}\`); a face whose Archive fell behind its cards refuses its light by name, and the recard follows; nothing moved`);
    if (dark === undefined) return refuse("face-not-stale", `the last light of face h${face} here did not refuse for want of a prekey secret (it stands lit, or still lighting): nothing needs a recard. Read it with \`lares vault status\`; nothing moved`);
    if (!STALE_LIGHT.test(dark.cause)) return refuse("face-not-stale", `face h${face} stands dark for another cause (${dark.cause}): a recard cures only a face that holds no prekey secret; clear it with \`lares vault unlock\`; nothing moved`);
    const proof = await holder.proves(credentials);
    if (proof.reading !== "proves") {
      if (proof.reading === "no-slot-opens") return refuse("no-slot-opens", `no slot of this vessel opens under what the holder presented; nothing moved (${proof.attemptsLeft} attempt(s) left this boot)`, { attemptsLeft: proof.attemptsLeft });
      if (proof.reading === "attempts-spent") return refuse("attempts-spent", "this vessel's unlock attempts for this boot stand spent; nothing moved. Stand the vessel again (`lares vessel stand`)");
      return refuse(proof.reading, `the vessel's slot tree reads ${proof.reading}; nothing moved. Read it with \`lares vault status\``);
    }
    deps.armRecard(face);
    try { await deps.replayLend(); }
    catch (e) { return refuse("recard-failed", `the lend did not replay (${e instanceof Error ? e.message : String(e)}): the recard stands armed for face h${face}'s next light; \`lares vault unlock\` replays it`); }
    const after = deps.refusedLights().find((r) => r.ordinal === face);
    if (after !== undefined) return refuse("recard-refused", `face h${face} stayed dark and the recard spent its arm: ${after.cause}. Clear what that names, then \`lares vault recard --face ${face}\` again (read the face with \`lares vault status\`)`);
    deps.onLog(`recard h${face}: lit`);
    return { op: "recard", face, recarded: true };
  };

  const handler = (parsed: unknown, sock: Socket): boolean => {
    if (!isCustodyFrame(parsed)) return false;
    const op = parsed.op;
    let act: () => Promise<CustodyAnswer>;
    /** A close that runs ahead of the line, before the act takes its turn (a lock), or none. */
    let ahead: (() => Promise<void>) | null = null;
    if (op === "recard") {
      const frame = parsed as Record<string, unknown>;
      const stray = Object.keys(frame).find((k) => !RECARD_FRAME_KEYS.has(k));
      const credentials = credentialsOf(frame["credentials"]);
      const face = frame["face"];
      if (stray !== undefined || !credentials || !Number.isSafeInteger(face) || (face as number) < 0) {
        deps.onLog("recard: refused (bad-custody-frame)");
        answer(sock, { op, status: "error", errorMessage: "a recard frame carries `op`, the vessel's own `credentials` and the `face` (a handle-index), and nothing beside them", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      act = runRecard(credentials, face as number, sock);
    } else if (op === "rehive") {
      const frame = parsed as Record<string, unknown>;
      const stray = Object.keys(frame).find((k) => !REHIVE_FRAME_KEYS.has(k));
      const credentials = credentialsOf(frame["credentials"]);
      const face = frame["face"];
      if (stray !== undefined || !credentials || !Number.isSafeInteger(face) || (face as number) < 0) {
        deps.onLog("rehive: refused (bad-custody-frame)");
        answer(sock, { op, status: "error", errorMessage: "a rehive frame carries `op`, the face's own `credentials` and the `face` (a handle-index), and nothing beside them", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      act = runRehive(credentials, face as number, sock);
    } else if (op === "backup") {
      const frame = parsed as Record<string, unknown>;
      const stray = Object.keys(frame).find((k) => !BACKUP_FRAME_KEYS.has(k));
      const credentials = credentialsOf(frame["credentials"]);
      const face = frame["face"];
      const key = frame["key"];
      if (stray !== undefined || !credentials || !Number.isSafeInteger(face) || (face as number) < 0 || typeof key !== "string" || !BUNDLE_KEY_HEX.test(key)) {
        deps.onLog("backup: refused (bad-custody-frame)");
        answer(sock, { op, status: "error", errorMessage: "a backup frame carries `op`, the vessel's own `credentials`, a `face` (a handle-index) and a `key` (a bundle key, 64 lower hex), and nothing beside them", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      // The face's ward route rides `ward` where the face asks its own; absent, the vessel's route presented for this act.
      const wardRoute = frame["ward"] === undefined ? credentials : credentialsOf(frame["ward"]);
      if (!wardRoute) { answer(sock, { op, status: "error", errorMessage: "a backup frame's `ward` carries one or more credentials (a passphrase or paper sheets)", refusal: { reason: "bad-custody-frame" } }); return true; }
      act = runBackup(credentials, face as number, key, wardRoute);
    } else if (op === "act") {
      const frame = parsed as Record<string, unknown>;
      const stray = Object.keys(frame).find((k) => !ACT_FRAME_KEYS.has(k));
      if (stray !== undefined || typeof frame["act"] !== "string") {
        deps.onLog("act: refused (bad-custody-frame)");
        answer(sock, { op, status: "error", errorMessage: "an act frame carries `op`, `act` and `args`, and nothing beside them", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      // AN ACT THAT ACTS AS A FACE RIDES A SESSION of that face (`session:act`), so its receipt binds to the face; with no
      // vessel standing the command runs it in its own process.
      if (SESSION_ACTS.has(frame["act"])) {
        deps.onLog(`act ${frame["act"]}: refused (face-act-rides-a-session)`);
        answer(sock, { op, status: "error", errorMessage: `the act "${frame["act"]}" acts as a face: it rides a session of that face`, refusal: { reason: "face-act-rides-a-session" } });
        return true;
      }
      act = runAct(frame["act"], frame["args"]);
    } else if (op === "ward") {
      const frame = parsed as Record<string, unknown>;
      const credentials = credentialsOf(frame["credentials"]);
      const verb = frame["verb"], argsDigest = frame["argsDigest"];
      if (Object.keys(frame).some((k) => !WARD_FRAME_KEYS.has(k)) || !credentials || typeof verb !== "string" || !verb || typeof argsDigest !== "string" || !/^[0-9a-f]{64}$/.test(argsDigest)) {
        answer(sock, { op, status: "error", errorMessage: "a ward frame carries `op`, `credentials` (a passphrase or paper sheets), the `verb` it binds and its `argsDigest`, and nothing beside them", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      // THE ROUTE RIDES THIS FRAME AND NO VERB: the door parks it under a one-use ref bound to the act it names (verb, arguments).
      act = async () => { deps.onLog("ward: a route parked for one act"); return { op: "ward", ref: parkWardTicket(wardCredential(credentials), { verb, digest: argsDigest }) }; };
    } else if (op === "face-route") {
      const frame = parsed as Record<string, unknown>;
      const stray = Object.keys(frame).find((k) => !FACE_ROUTE_FRAME_KEYS.has(k));
      const slots = slotsOf(frame["slots"]);
      if (stray !== undefined || slots === null || typeof frame["argsDigest"] !== "string" || !BUNDLE_KEY_HEX.test(frame["argsDigest"]) || (frame["purpose"] !== "persona-new" && frame["purpose"] !== "bundle.restore")) {
        deps.onLog("face-route: refused (bad-custody-frame)");
        answer(sock, { op, status: "error", errorMessage: "a face-route frame carries `op`, `purpose`, `argsDigest` and `slots` (one or more slots of passphrase pins), and nothing beside them", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      const purpose = frame["purpose"] as "persona-new" | "bundle.restore";
      act = async () => { const ref = parkFaceRoute(slots, purpose, frame["argsDigest"] as string); deps.onLog("face-route: parked for one operation"); return { op: "face-route", ref }; };
    } else if (op === "wear") {
      const frame = parsed as Record<string, unknown>;
      const face = frame["face"];
      if (Object.keys(frame).some((k) => !WEAR_FRAME_KEYS.has(k)) || !Number.isSafeInteger(face) || (face as number) < 0 || (frame["seat"] !== undefined && frame["seat"] !== "ai") || (frame["yes"] !== undefined && frame["yes"] !== true)) {
        deps.onLog("wear: refused (bad-custody-frame)");
        answer(sock, { op, status: "error", errorMessage: "a wear frame carries `op`, a `face` (a handle index, a whole number from 0) at most `seat: \"ai\"` and `yes: true` (turn over records the shore's flush left unwritten), and nothing beside them: no route rides a wear", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      // A WEAR MOVES THE MOUNT FOR ANY SEAT: it asks no route and carries no key, and reaches only a face already standing open;
      // unlock and custody stay the operator's own acts.
      act = () => wear(face as number, frame["yes"] === true);
    } else if (op === "unlock" && deps.pulama) {
      // A PŪLAMA HOLDS THIS VESSEL'S CUSTODY: the frame's credentials go unread (no route opens anything here), the vessel
      // dials the pūlama again, and the answer names a session or what the pūlama waits on.
      const pulama = deps.pulama;
      act = composing(async (): Promise<CustodyAnswer> => {
        const was = pulama.standing().session;
        const dialed: { readonly session: boolean; readonly waits: string | null; readonly refused?: string } = was ? pulama.standing() : await pulama.dial();
        // A session already standing replays the lend: a lent face whose light refused lights again (the served-but-dark line).
        if (was) await deps.replayLend?.();
        // THE ANSWER NAMES THE FAULT: a composition refused over the session names its own reason to the caller who asked,
        // beside the `composition-refused` reading, so no probe of the door and no read of the vessel's log stands between.
        const { refused, ...now } = dialed;
        deps.onLog(now.session ? "unlock: this vessel stands by its pūlama" : `unlock: the pūlama serves no session (${now.waits ?? "unknown"}${refused !== undefined ? `: ${refused}` : ""})`);
        return { op: "unlock", reading: now.session ? (was ? "already-unlocked" : "opens") : "pulama-waits", pulama: now, held: now.session, standing: deps.standing(), ...(refused !== undefined ? { refused } : {}) } as unknown as CustodyAnswer;
      });
    } else if (op === "unlock") {
      const credentials = credentialsOf((parsed as { credentials?: unknown }).credentials);
      if (!credentials) {
        answer(sock, { op, status: "error", errorMessage: "an unlock frame carries one or more credentials (a passphrase or paper sheets)", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      const named = (parsed as { face?: unknown }).face;
      if (named !== undefined && (!Number.isSafeInteger(named) || (named as number) < 0)) {
        answer(sock, { op, status: "error", errorMessage: "an unlock frame's `face` names a handle index (a whole number from 0)", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      const all = (parsed as { all?: unknown }).all;
      if (all !== undefined && typeof all !== "boolean") {
        answer(sock, { op, status: "error", errorMessage: "an unlock frame's `all` is true or false", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      act = () => unlock(credentials, { ...(named !== undefined ? { face: named as number } : {}), ...(all === true ? { all: true } : {}) });
    } else if (op === "prove") {
      // A PROOF THAT A PERSON HOLDS A ROUTE OF THIS VESSEL, over a held key: it opens nothing new and names its opener (by index),
      // so a CLI act that seats something under the route (`lares vault reseat`) seats under the proved credentials alone. A miss
      // spends an unlock attempt, as an unlock's does. A pūlama's lent holder proves nothing here: its route rides the pūlama.
      const credentials = credentialsOf((parsed as { credentials?: unknown }).credentials);
      if (!credentials) {
        answer(sock, { op, status: "error", errorMessage: "a prove frame carries one or more credentials (a passphrase or paper sheets)", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      act = async () => {
        try { return { op: "prove", ...(await holder.proves(credentials)) } as unknown as CustodyAnswer; }
        catch (e) { return { op: "prove", reading: "prove-refused", errorMessage: e instanceof Error ? e.message : String(e) } as unknown as CustodyAnswer; }
      };
    } else if (op === "lock") {
      const face = (parsed as { face?: unknown }).face;
      if (face !== undefined && (!Number.isSafeInteger(face) || (face as number) < 0)) {
        answer(sock, { op, status: "error", errorMessage: "a lock frame's `face` names a handle index (a whole number from 0)", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      // THE CLOSE RUNS AHEAD OF THE LINE: a face's actor closes (and the whole lock's faces close) before the lock takes its
      // turn, so the line never waits on a drain whose work (a session act) waits on the line behind this very lock.
      // A drop that faults leaves the key open and the answer an error, and lifts the face's hold.
      // A FACE LOCK THAT CANNOT LAND CLOSES NOTHING: a pūlama holds this vessel's face keys (its lent holder refuses every face
      // lock, the person's own act at the pūlama), so no close runs ahead of a lock that will refuse.
      act = face === undefined ? lock : () => lockFaceOf(face as number);
      ahead = face === undefined
        ? (deps.closeFaces ? async () => {
          try { await deps.closeFaces!(); }
          catch (error) { deps.releaseFaces?.(); throw error; }
        } : null)
        : (deps.dropFace && !deps.pulama ? async () => {
          const standing = await holder.faceStanding({ ordinal: face as number });
          if (standing?.unlocked !== true) return;
          try { await deps.dropFace!(face as number); }
          catch (error) { deps.releaseFace?.(face as number); deps.onLog(`face h${String(face)} provider drop refused: ${String(error)}`); throw error; }
        } : null);
    } else if (op === "doc-census") {
      // THE DOCUMENT CENSUS IS READ-ONLY: it reads the stores beside the chain, opens nothing for writing, removes nothing,
      // and names each document by id, never by body. No composition sitting refuses by name, never as an empty census.
      const read = deps.docCensus?.() ?? null;
      if (read === null) {
        answer(sock, { op, status: "error", errorMessage: "no composition sits to read its stores; stand the vessel, then ask again", refusal: { reason: "census-unavailable" } });
        return true;
      }
      void read.then(
        (census) => answer(sock, { op: "doc-census", census, standing: deps.standing() }),
        (e) => {
          const why = e instanceof Error ? e.message : String(e);
          deps.onLog(`doc-census: refused — ${why}`);
          answer(sock, { op, status: "error", errorMessage: why, refusal: { reason: "census-failed" } });
        },
      );
      return true;
    } else if (op === "census") {
      // THE CENSUS IS READ-ONLY, like the state query: it answers at once, beside the chain, so a stop that asks it
      // while an unlock recomposes never waits behind the recomposition. It names documents and never a body.
      let held: readonly HeldSaves[] | null = null;
      try { held = deps.heldSaves?.() ?? null; } catch { held = null; }
      // `locked` names a shut key, so a stop's census can say "unlock, then down" instead of "could not answer".
      // `facesLocked` names each standing face whose key stays shut under a held node key: its memory reads nowhere, so a
      // stop's census names it unanswered ("h2 stands locked; unlock it") rather than counting it clean.
      // `facesLit` names each standing face whose key stands open: THE LIT SET, each face sealing its own memory under its own key.
      let facesLocked: number[] = [];
      let facesLit: number[] = [];
      if (holder.isUnlocked()) {
        try {
          const open = new Set(holder.unlockedFaces());
          const faces = listFaceCustodyIds();
          facesLocked = faces.filter((f) => !open.has(f.fcid)).map((f) => f.ordinal);
          facesLit = faces.filter((f) => open.has(f.fcid)).map((f) => f.ordinal);
        } catch { facesLocked = []; facesLit = []; }
      }
      // `worn` names the daemon mount under a held key, absent where none wears: a stop over faces lit and none worn names the
      // wear that lets the house settle, never an unlock the key already holds.
      const worn = holder.isUnlocked() ? mountedFaceOrdinal() : undefined;
      // `facesDark` names each face the custody serves (lit set) that stands dark here, its light refused, with its clearing line.
      let facesDark: ServedDark[] = [];
      try { facesDark = servedDark(deps.refusedLights?.() ?? [], facesLit); } catch { facesDark = []; }
      answer(sock, { op: "census", held, standing: deps.standing(), locked: !holder.isUnlocked(), ...(facesLocked.length > 0 ? { facesLocked } : {}), ...(facesLit.length > 0 ? { facesLit } : {}), ...(facesDark.length > 0 ? { facesDark } : {}), ...(worn !== undefined ? { worn } : {}) });
      return true;
    } else {
      // THE STATE QUERY IS READ-ONLY: it answers at once, beside the chain, so a caller asking while an unlock
      // recomposes hears `composing: true` instead of waiting behind the recomposition.
      answer(sock, {
        op: "custody", unlocked: holder.isUnlocked(), slot: holder.openedSlot(), attemptsLeft: holder.attemptsLeft(), facesOpen: holder.unlockedFaces().length,
        ...(deps.pulama ? { pulama: deps.pulama.standing() } : {}),
        standing: deps.standing(), wikiAwaits: deps.wikiAwaits?.() ?? null, testScratch: deps.testScratch, composing: composingDepth > 0,
      });
      return true;
    }
    // THE DOOR HOLDS A SHORT LINE. Past `CUSTODY_LINE` acts waiting, a frame refuses at once by name, and an act
    // whose caller left before its turn never runs: no caller builds a backlog a later lock must wait behind.
    if (waiting >= CUSTODY_LINE) {
      answer(sock, { op, status: "error", errorMessage: `the custody door holds ${CUSTODY_LINE} acts waiting; send this one again once they settle`, refusal: { reason: "custody-door-busy" } });
      return true;
    }
    waiting += 1;
    // AN ACT WHOSE CLOSE RAN AHEAD RUNS TO ITS END though its caller left: it locks the key or lifts the holds its close set, so
    // no face stays dark behind a caller who went away. Its answer goes nowhere.
    const committed = ahead !== null;
    const turn = async (): Promise<CustodyAnswer | null> => {
      waiting -= 1;
      if (sock.destroyed && !committed) return null;
      return act();
    };
    const refused = (e: unknown): void => {
      const why = e instanceof Error ? e.message : String(e);
      // An act's own fault never reaches this arm (`runAct` answers it by name); what does names no argument.
      deps.onLog(`${op}: refused — ${why}`);
      answer(sock, { op, status: "error", errorMessage: why, refusal: { reason: "custody-act-failed" } });
    };
    // The fault of one act names itself to its own caller and never breaks the chain for the next.
    const enqueue = (): void => { chain = chain.then(turn).then((a) => { if (a) answer(sock, a); }, refused); };
    if (ahead === null) enqueue();
    else ahead().then(enqueue, (e: unknown) => {
      waiting -= 1;
      deps.onLog(`${op}: the face's close faulted, so the key stays open — ${e instanceof Error ? e.message : String(e)}`);
      answer(sock, { op, status: "error", errorMessage: `the face's close faulted, so the key stays open: ${e instanceof Error ? e.message : String(e)}`, refusal: { reason: "face-close-held" } });
    });
    return true;
  };
  const sessionAct = async (name: string, args: unknown): Promise<CustodyAnswer> => {
    if (waiting >= CUSTODY_LINE) {
      return { op: "act", status: "error", errorMessage: `the custody door holds ${CUSTODY_LINE} acts waiting; send this one again once they settle`, refusal: { reason: "custody-door-busy" } };
    }
    waiting += 1;
    const run = chain.then(() => { waiting -= 1; return runAct(name, args)(); });
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
  return Object.assign(handler, { act: sessionAct });
}
