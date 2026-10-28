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
 *   backup   cut one face's backup bundle body (`face-bundle-cut`) and answer it SEALED under the bundle key the
 *            frame carries. The frame also carries the vessel's own route: see below.
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
import type { Socket } from "node:net";
import type { Credential, SlotSpec } from "@lararium/mesh";
import { parkFaceRoute } from "./face-route.js";
import { mountedFaceOrdinal, setMountedFace, sovereignStands } from "./node-vessel-identity.js";
import { listFaceOrdinals } from "./identity-anchors.js";
import { CustodyLocked, CustodyRowUnavailable, type CustodyHolder, type HolderUnlock } from "./custody-holder.js";
import { BackupRefused, type FaceBundleCut } from "./face-bundle-cut.js";
import { SESSION_ACTS, SealedActRefused, isSealedActName } from "./sealed-acts.js";

export type CustodyFrame =
  | { readonly op: "unlock"; readonly credentials: readonly Credential[]; readonly face?: number; readonly all?: boolean }
  | { readonly op: "lock"; readonly face?: number }
  | { readonly op: "custody" }
  | { readonly op: "act"; readonly act: string; readonly args?: Readonly<Record<string, unknown>> }
  /** Cut face `face`'s bundle body, sealed under `key` (a bundle key, 64 lower hex), once `credentials` prove the vessel's own route. */
  | { readonly op: "backup"; readonly credentials: readonly Credential[]; readonly face: number; readonly key: string }
  /** Park the human route a NEW face will ask for, for the next face this vessel founds (one use). */
  | { readonly op: "face-route"; readonly slots: readonly SlotSpec[] };

/** What stands after a custody act: the composition's standing, or the fault that left the floor standing. */
export interface CustodyStanding {
  readonly standing: string;
  /** Present when the sovereign composition refused and the vessel stands at the floor instead. */
  readonly refused?: string;
}

export type CustodyAnswer =
  | ({ readonly op: "unlock"; readonly held?: boolean } & HolderUnlock & Partial<CustodyStanding>)
  /** The node key opened and a face did not (`face-refused`), or the vessel holds several faces and none was named (`face-not-named`): nothing stays open. */
  | { readonly op: "unlock"; readonly reading: "face-refused" | "face-not-named"; readonly standing: string; readonly face?: number; readonly faceReading?: string; readonly faces?: readonly unknown[] }
  | ({ readonly op: "lock"; readonly locked: true; readonly was: "unlocked" | "locked"; readonly face?: number } & Partial<CustodyStanding>)
  | { readonly op: "custody"; readonly unlocked: boolean; readonly slot: string | null; readonly attemptsLeft: number; readonly standing: string; readonly testScratch: boolean }
  | { readonly op: "act"; readonly act: string; readonly result: Record<string, unknown> }
  | { readonly op: "face-route"; readonly parked: true }
  | { readonly op: "backup"; readonly sealedBody: string; readonly holds: FaceBundleCut["holds"]; readonly face: FaceBundleCut["face"]; readonly carries: FaceBundleCut["carries"] }
  | { readonly op: string; readonly status: "error"; readonly errorMessage: string; readonly refusal: { readonly reason: string; readonly home?: string; readonly file?: string; readonly reading?: string; readonly attemptsLeft?: number } };

export interface CustodyFrameDeps {
  readonly holder: CustodyHolder;
  /** Tear the standing composition down and compose again: `sovereign` true with the private rows, false at the floor. */
  readonly recompose: (sovereign: boolean) => Promise<CustodyStanding>;
  readonly lightFace?: (ordinal: number) => Promise<void>;
  readonly dropFace?: (ordinal: number) => Promise<void>;
  /** What stands now. */
  readonly standing: () => string;
  /** Whether this vessel's root carries the harness's scratch marker. */
  readonly testScratch: boolean;
  readonly onLog: (line: string) => void;
  /**
   * Run one act of the sealed-act table against the seated holder (`runSealedAct`, bound to what the standing
   * composition lends an act). Absent, every `act` frame refuses `acts-unavailable`.
   */
  readonly runAct?: (act: string, args: unknown) => Promise<Record<string, unknown>>;
  /**
   * Cut one face's bundle body under the bundle key handed in (`cutFaceBundle`, bound to what the standing
   * composition lends a cut). Absent, every `backup` frame refuses `backup-unavailable`.
   */
  readonly backup?: (face: number, bundleKey: Uint8Array) => Promise<FaceBundleCut>;
}

const OPS: ReadonlySet<string> = new Set(["unlock", "lock", "custody", "act", "backup", "face-route"]);
/** The keys a `face-route` frame may carry. */
const FACE_ROUTE_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "slots"]);
/** The keys a `backup` frame may carry. */
const BACKUP_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "credentials", "face", "key"]);
const BUNDLE_KEY_HEX = /^[0-9a-f]{64}$/;
/** The keys an `act` frame may carry. Any other key refuses the frame, so nothing rides beside an act's own arguments. */
const ACT_FRAME_KEYS: ReadonlySet<string> = new Set(["op", "act", "args"]);

/** The refusal reason a fault of an act answers under, and what the door may log of it: a name, never a message. */
function actFault(e: unknown): { readonly reason: string; readonly extra: { home?: string; file?: string; reading?: string } } {
  if (e instanceof SealedActRefused) return { reason: e.reason, extra: {} };
  if (e instanceof CustodyLocked) return { reason: "custody-locked", extra: {} };
  if (e instanceof CustodyRowUnavailable) return { reason: "row-unavailable", extra: { home: e.home, file: e.file, reading: e.reading } };
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
  const unlock = async (credentials: readonly Credential[], sel: { readonly face?: number; readonly all?: boolean }): Promise<CustodyAnswer> => {
    const u = await holder.unlock(credentials);
    if (u.reading !== "opens" && u.reading !== "already-unlocked") {
      deps.onLog(`unlock: ${u.reading}${u.reading === "no-slot-opens" ? ` (${u.attemptsLeft} attempt(s) left this boot)` : ""}`);
      return { op: "unlock", ...u, standing: deps.standing() };
    }
    const freshly = u.reading === "opens";
    const openBefore = new Set(holder.unlockedFaces());
    const mountedBefore = mountedFaceOrdinal();
    const mountedWasOpen = mountedBefore !== undefined && (await holder.faceStanding({ ordinal: mountedBefore }))?.unlocked === true;
    // A second unlock that names no face finds the key held and the composition standing: nothing to open, nothing to compose.
    if (!freshly && sel.face === undefined && sel.all !== true) return { op: "unlock", ...u, standing: deps.standing() };
    const standing = listFaceOrdinals();
    const refuseFaces = async (reading: "face-refused" | "face-not-named", detail: object): Promise<CustodyAnswer> => {
      if (freshly) await holder.lock();           // a key never rests over a floor
      deps.onLog(`unlock: ${reading}`);
      return { op: "unlock", reading, ...detail, standing: deps.standing() };
    };
    let mounted: number | undefined = sel.face;
    let openedOrdinals: number[] = [];
    if (sel.all) {
      const readings = await holder.unlockFaces(credentials);
      const opened = readings.filter((r) => r.reading === "opens" || r.reading === "already-unlocked").map((r) => (r as { ordinal: number }).ordinal);
      openedOrdinals = opened;
      if (standing.length > 0 && opened.length === 0) return refuseFaces("face-refused", { faces: readings.map((r) => r.reading) });
      if (mounted === undefined && mountedBefore === undefined && opened.length === 1) mounted = opened[0];
    } else if (sel.face !== undefined) {
      const r = await holder.unlockFace({ ordinal: sel.face }, credentials);
      if (r.reading !== "opens" && r.reading !== "already-unlocked") return refuseFaces("face-refused", { face: sel.face, faceReading: r.reading });
      openedOrdinals = [sel.face];
    } else if (standing.length === 1) {
      mounted = standing[0]!;
      const r = await holder.unlockFace({ ordinal: mounted }, credentials);
      if (r.reading !== "opens" && r.reading !== "already-unlocked") return refuseFaces("face-refused", { face: mounted, faceReading: r.reading });
      openedOrdinals = [mounted];
    } else if (standing.length > 1) {
      return refuseFaces("face-not-named", { faces: standing });
    }
    deps.onLog(`unlocked: slot ${u.reading === "opens" ? u.slot : "(held)"} opened the node key${mounted !== undefined ? `; face h${mounted} open` : ""}`);
    // The unlock NAMES the face the composition MOUNTS for the life of the unlock: the composition's own state, never a pointer at
    // rest, and never a face a command defaults to (a command names `--face N`, or resolves the one face standing open).
    if (mounted !== undefined) setMountedFace(mounted);
    // An unlock over a held key that opens no new face and changes no mounted face stands nothing new.
    if (!freshly && holder.unlockedFaces().every((f) => openBefore.has(f)) && (mounted === undefined || mounted === mountedBefore)) {
      return { op: "unlock", ...u, standing: deps.standing() };
    }
    if (!freshly && mountedWasOpen && mountedBefore !== undefined && (mounted === undefined || mounted === mountedBefore) && deps.lightFace) {
      for (const ordinal of openedOrdinals) {
        const face = await holder.faceStanding({ ordinal });
        if (ordinal !== mountedBefore && face?.unlocked && !openBefore.has(face.fcid)) await deps.lightFace(ordinal);
      }
      return { op: "unlock", ...u, standing: deps.standing(), held: true };
    }
    const stood = await deps.recompose(true);
    // A KEY NEVER RESTS OVER A FLOOR. When the composition that should have stood on the key refused, the vessel
    // stands at the floor and the holder drops what it opened: held and standing never disagree.
    if (stood.refused !== undefined) {
      await holder.lock();
      deps.onLog("the sovereign composition did not stand; the node key dropped again");
      return { op: "unlock", ...u, ...stood, held: false };
    }
    return { op: "unlock", ...u, ...stood, held: true };
  };

  /**
   * `lock --face N`: one face drops its key. The mounted face's lock stands the vessel back at the floor through the same gate the
   * unlock reads (`sovereignStands`); a sibling's lock leaves the sovereign composition standing.
   */
  const lockFaceOf = async (ordinal: number): Promise<CustodyAnswer> => {
    const named = await holder.faceStanding({ ordinal });
    if (named === null) return { op: "lock", locked: true, was: "locked", face: ordinal, standing: deps.standing() };
    const wasOpen = named.unlocked;
    const wasMounted = sovereignStands();
    if (wasOpen && ordinal !== mountedFaceOrdinal() && deps.dropFace) {
      try { await deps.dropFace(ordinal); }
      catch (error) {
        // Closing the key takes precedence; the provider still needs a drop, with no retry here.
        deps.onLog(`face h${ordinal} provider drop refused: ${String(error)}`);
      }
    }
    await holder.lockFace(named.fcid);
    deps.onLog(`locked: face h${ordinal} key dropped`);
    if (wasOpen && wasMounted && !sovereignStands()) {
      const stood = await deps.recompose(true);
      return { op: "lock", locked: true, was: "unlocked", face: ordinal, ...stood };
    }
    return { op: "lock", locked: true, was: wasOpen ? "unlocked" : "locked", face: ordinal, standing: deps.standing() };
  };

  const lock = async (): Promise<CustodyAnswer> => {
    if (!holder.isUnlocked()) return { op: "lock", locked: true, was: "locked", standing: deps.standing() };
    await holder.lock();
    deps.onLog("locked: the vessel key dropped");
    const stood = await deps.recompose(false);
    return { op: "lock", locked: true, was: "unlocked", ...stood };
  };

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
  const runBackup = (credentials: readonly Credential[], face: number, keyHex: string) => async (): Promise<CustodyAnswer> => {
    const refuse = (reason: string, errorMessage: string, extra: object = {}): CustodyAnswer => {
      deps.onLog(`backup: refused (${reason})`);
      return { op: "backup", status: "error", errorMessage, refusal: { reason, ...extra } };
    };
    if (!deps.backup) return refuse("backup-unavailable", "this vessel's custody door cuts no bundle");
    if (!holder.isUnlocked()) return refuse("custody-locked", new CustodyLocked().message);
    const proof = await holder.proves(credentials);
    if (proof.reading !== "proves") {
      if (proof.reading === "locked") return refuse("custody-locked", new CustodyLocked().message);
      if (proof.reading === "no-slot-opens") return refuse("no-slot-opens", `no slot of this vessel opens under what was presented; nothing was cut (${proof.attemptsLeft} attempt(s) left this boot)`, { attemptsLeft: proof.attemptsLeft });
      if (proof.reading === "attempts-spent") return refuse("attempts-spent", "this vessel's unlock attempts for this boot stand spent; nothing was cut");
      return refuse(proof.reading, `the vessel's slot tree reads ${proof.reading}; nothing was cut`);
    }
    const bundleKey = Uint8Array.from(Buffer.from(keyHex, "hex"));
    try {
      const cut = await deps.backup(face, bundleKey);
      deps.onLog("backup: done");
      return { op: "backup", sealedBody: Buffer.from(cut.sealedBody).toString("base64"), holds: cut.holds, face: cut.face, carries: cut.carries };
    } catch (e) {
      if (e instanceof BackupRefused) return refuse(e.reason, e.message);
      const fault = actFault(e);
      return refuse(fault.reason === "act-failed" ? "backup-failed" : fault.reason, e instanceof Error ? e.message : String(e), fault.extra);
    } finally { bundleKey.fill(0); }
  };

  const handler = (parsed: unknown, sock: Socket): boolean => {
    if (!isCustodyFrame(parsed)) return false;
    const op = parsed.op;
    let act: () => Promise<CustodyAnswer>;
    if (op === "backup") {
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
      act = runBackup(credentials, face as number, key);
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
    } else if (op === "face-route") {
      const frame = parsed as Record<string, unknown>;
      const stray = Object.keys(frame).find((k) => !FACE_ROUTE_FRAME_KEYS.has(k));
      const slots = slotsOf(frame["slots"]);
      if (stray !== undefined || slots === null) {
        deps.onLog("face-route: refused (bad-custody-frame)");
        answer(sock, { op, status: "error", errorMessage: "a face-route frame carries `op` and `slots` (one or more slots of passphrase pins), and nothing beside them", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      act = async () => { parkFaceRoute(slots); deps.onLog("face-route: parked for the next face founding"); return { op: "face-route", parked: true }; };
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
    } else if (op === "lock") {
      const face = (parsed as { face?: unknown }).face;
      if (face !== undefined && (!Number.isSafeInteger(face) || (face as number) < 0)) {
        answer(sock, { op, status: "error", errorMessage: "a lock frame's `face` names a handle index (a whole number from 0)", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      act = face === undefined ? lock : () => lockFaceOf(face as number);
    } else {
      act = async () => ({
        op: "custody", unlocked: holder.isUnlocked(), slot: holder.openedSlot(), attemptsLeft: holder.attemptsLeft(), facesOpen: holder.unlockedFaces().length,
        standing: deps.standing(), testScratch: deps.testScratch,
      });
    }
    // THE DOOR HOLDS A SHORT LINE. Past `CUSTODY_LINE` acts waiting, a frame refuses at once by name, and an act
    // whose caller left before its turn never runs: no caller builds a backlog a later lock must wait behind.
    if (waiting >= CUSTODY_LINE) {
      answer(sock, { op, status: "error", errorMessage: `the custody door holds ${CUSTODY_LINE} acts waiting; send this one again once they settle`, refusal: { reason: "custody-door-busy" } });
      return true;
    }
    waiting += 1;
    const turn = async (): Promise<CustodyAnswer | null> => {
      waiting -= 1;
      if (sock.destroyed) return null;
      return act();
    };
    // The fault of one act names itself to its own caller and never breaks the chain for the next.
    chain = chain.then(turn).then(
      (a) => { if (a) answer(sock, a); },
      (e) => {
        const why = e instanceof Error ? e.message : String(e);
        // An act's own fault never reaches this arm (`runAct` answers it by name); what does names no argument.
        deps.onLog(`${op}: refused — ${why}`);
        answer(sock, { op, status: "error", errorMessage: why, refusal: { reason: "custody-act-failed" } });
      },
    );
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
