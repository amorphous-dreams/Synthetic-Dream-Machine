/**
 * custody-frames — THE CUSTODY DOOR on the vessel's owner-only verb socket: `unlock`, `lock`, `custody` and `act`.
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
 *
 * ── A SEALED ROW'S ACT RIDES THIS DOOR, NEVER A STORE VERB ──────────────────────────────────────
 * A store verb's output rests in the daemon's document as an outcome, in the clear, and the digest of its
 * arguments rests in a receipt. A roster key, a pet-name or a handle-book snapshot on that road would leave its
 * sealed row for an unsealed document. An `act` frame never becomes an invocation: no digest, no receipt, no
 * outcome and no worker message carries its arguments or its answer. The frame names an act of the table and
 * that act's typed arguments and nothing else: a key beside `op`, `act` and `args` refuses the frame, an act the
 * table does not name refuses by name, and no act takes a credential. The door logs the act's NAME and how it
 * ended, and never an argument, an answer or a refusal's own words.
 */
import type { Socket } from "node:net";
import type { Credential } from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable, type CustodyHolder, type HolderUnlock } from "./custody-holder.js";
import { SealedActRefused, isSealedActName } from "./sealed-acts.js";

export type CustodyFrame =
  | { readonly op: "unlock"; readonly credentials: readonly Credential[] }
  | { readonly op: "lock" }
  | { readonly op: "custody" }
  | { readonly op: "act"; readonly act: string; readonly args?: Readonly<Record<string, unknown>> };

/** What stands after a custody act: the composition's standing, or the fault that left the floor standing. */
export interface CustodyStanding {
  readonly standing: string;
  /** Present when the sovereign composition refused and the vessel stands at the floor instead. */
  readonly refused?: string;
}

export type CustodyAnswer =
  | ({ readonly op: "unlock"; readonly held?: boolean } & HolderUnlock & Partial<CustodyStanding>)
  | ({ readonly op: "lock"; readonly locked: true; readonly was: "unlocked" | "locked" } & Partial<CustodyStanding>)
  | { readonly op: "custody"; readonly unlocked: boolean; readonly slot: string | null; readonly attemptsLeft: number; readonly standing: string; readonly testScratch: boolean }
  | { readonly op: "act"; readonly act: string; readonly result: Record<string, unknown> }
  | { readonly op: string; readonly status: "error"; readonly errorMessage: string; readonly refusal: { readonly reason: string; readonly home?: string; readonly file?: string; readonly reading?: string } };

export interface CustodyFrameDeps {
  readonly holder: CustodyHolder;
  /** Tear the standing composition down and compose again: `sovereign` true with the private rows, false at the floor. */
  readonly recompose: (sovereign: boolean) => Promise<CustodyStanding>;
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
}

const OPS: ReadonlySet<string> = new Set(["unlock", "lock", "custody", "act"]);
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

/**
 * The custody door's handler, in the shape the socket front's `onFrame` takes: `true` when the frame was a
 * custody frame (answered here, never seen by a verb seat), `false` for every other frame.
 */
export function custodyFrameHandler(deps: CustodyFrameDeps): (parsed: unknown, sock: Socket) => boolean {
  const { holder } = deps;
  let chain: Promise<void> = Promise.resolve();
  let waiting = 0;
  const answer = (sock: Socket, a: CustodyAnswer): void => {
    try { sock.end(JSON.stringify(a) + "\n"); } catch { /* the caller went away */ }
  };

  const unlock = async (credentials: readonly Credential[]): Promise<CustodyAnswer> => {
    const u = await holder.unlock(credentials);
    if (u.reading !== "opens") {
      deps.onLog(`unlock: ${u.reading}${u.reading === "no-slot-opens" ? ` (${u.attemptsLeft} attempt(s) left this boot)` : ""}`);
      return { op: "unlock", ...u, standing: deps.standing() };
    }
    deps.onLog(`unlocked: slot ${u.slot} opened the vessel key`);
    const stood = await deps.recompose(true);
    // A KEY NEVER RESTS OVER A FLOOR. When the composition that should have stood on the key refused, the vessel
    // stands at the floor and the holder drops what it opened: held and standing never disagree.
    if (stood.refused !== undefined) {
      await holder.lock();
      deps.onLog("the sovereign composition did not stand; the vessel key dropped again");
      return { op: "unlock", ...u, ...stood, held: false };
    }
    return { op: "unlock", ...u, ...stood, held: true };
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

  return (parsed, sock) => {
    if (!isCustodyFrame(parsed)) return false;
    const op = parsed.op;
    let act: () => Promise<CustodyAnswer>;
    if (op === "act") {
      const frame = parsed as Record<string, unknown>;
      const stray = Object.keys(frame).find((k) => !ACT_FRAME_KEYS.has(k));
      if (stray !== undefined || typeof frame["act"] !== "string") {
        deps.onLog("act: refused (bad-custody-frame)");
        answer(sock, { op, status: "error", errorMessage: "an act frame carries `op`, `act` and `args`, and nothing beside them", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      act = runAct(frame["act"], frame["args"]);
    } else if (op === "unlock") {
      const credentials = credentialsOf((parsed as { credentials?: unknown }).credentials);
      if (!credentials) {
        answer(sock, { op, status: "error", errorMessage: "an unlock frame carries one or more credentials (a passphrase or paper sheets)", refusal: { reason: "bad-custody-frame" } });
        return true;
      }
      act = () => unlock(credentials);
    } else if (op === "lock") {
      act = lock;
    } else {
      act = async () => ({
        op: "custody", unlocked: holder.isUnlocked(), slot: holder.openedSlot(), attemptsLeft: holder.attemptsLeft(),
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
}
