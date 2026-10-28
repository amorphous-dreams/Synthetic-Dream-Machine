/**
 * sealed-act-door — THE ONE DOOR a command takes to an act over the vessel's sealed rows.
 *
 * A vessel's private rows rest sealed under its vessel key, and ONE key session opens them. A standing vessel
 * holds that session after `lares vault unlock`, so a command that reads a roster, a pet-name, a handle-book or
 * an admission asks the vessel: one `act` frame on the owner-only socket, answered by the vessel's custody door
 * (`custody-frames` in the node package), and no second prompt. With no vessel standing, the command runs the
 * SAME act of the same table in its own process, and its own key session opens at the first sealed row the act
 * touches (`offline-custody`).
 *
 * ── WHY NEVER A STORE VERB ──────────────────────────────────────────────────────────────────────
 * A store verb's output rests in the daemon's document in the clear, and the digest of its arguments rests in a
 * receipt. An act's arguments and its answer ride the custody frame alone: no receipt, no outcome, no log line
 * carries either. This module logs nothing it sends or receives.
 *
 * ── AN ACT THAT ACTS AS A FACE ──────────────────────────────────────────────────────────────────
 * `persona.reissue`, `walk.take` and `host.roll` sign or write under one face's key, and `handle-book.load` and
 * `handle-book.save` read and write one face's handle book (`SESSION_ACTS`), so on a running
 * vessel each rides a session of that face (`session:act`): the vessel binds the session's face to the act, and the
 * receipt it leaves names the act and the face alone, never an argument or the answer.
 *
 * ── WHAT A VESSEL'S ANSWER MEANS ────────────────────────────────────────────────────────────────
 *   · an `act` answer with a `result`       the act ran inside the vessel; the result returns to the caller.
 *   · an `act` answer with a refusal        the same refusal the act throws in process, under its own class:
 *                                           `CustodyLocked` (the vessel stands locked: `lares vault unlock`),
 *                                           `CustodyRowUnavailable`, `SealedActRefused`, or a plain error.
 *   · any other answer, or none             no vessel's custody door stands at the socket (nothing listens, or
 *                                           another command holds the store for one act): the act runs here.
 */
import {
  CustodyLocked, CustodyRowUnavailable, SealedActRefused, SESSION_ACTS, runSealedAct, readHearthDialPin, larBootstrapPath, ownedStore, larDataDir,
  type SealedActContext, type SealedActName, type SealedActRefusalReason,
} from "@lararium/node";
import { sendCustodyFrame } from "./custody-door.js";
import { storeVerb } from "./store-door.js";
import { openLocalSession, SessionRefused, type LocalSession } from "./session-connector.js";
import { UdsUnreachable, udsAlive } from "./local-connector.js";

/** Where an act ran: inside the standing vessel, or in this process. */
export type SealedActVia = "vessel" | "direct";

/**
 * What an act reads from its surroundings when it runs in this process: the KEL head comes off the store's one
 * holder, no persona plane stands (a command mounts no face's plane, so a name stays on its sealed row until a
 * vessel carries it), the hearth dial reads as the pin a stopped vessel would dial by, and a hosting roll lands
 * on the store this command holds for the moment of its act.
 */
const directContext: SealedActContext = {
  personaSelves: null,
  // No composition stands in a command's own process, so no island takes a bundle's memory section: an import
  // there refuses by name and names the standing vessel.
  backup: null,
  // The gate key a stopped vessel's hearth dial would pin at its next stand (an admit's pin);
  // no walk dial stands in a command's own process, so a kept invite waits for the next stand.
  walk: { dialGate: () => readHearthDialPin(larBootstrapPath())?.gatePubKey ?? null, represent: null },
  // A roll with no vessel standing holds the store for the moment of its act, and no live reading stands to refold.
  hosting: { withRepo: (act) => ownedStore(larDataDir(), act), rolled: async () => {} },
  kelHead: async (prefix) => {
    const out = (await storeVerb("persona-kel-head", { prefix })).output;
    return { head: typeof out["head"] === "string" ? out["head"] : null, seq: typeof out["seq"] === "number" ? out["seq"] : null };
  },
};

const ACT_REASONS: ReadonlySet<string> = new Set(["unknown-act", "bad-args", "act-refused"]);

/** The refusal a vessel answered, rebuilt under the class the same act throws in process. */
function refusalOf(answer: Readonly<Record<string, unknown>>): Error {
  const refusal = (answer["refusal"] ?? {}) as { reason?: unknown; home?: unknown; file?: unknown; reading?: unknown };
  const message = typeof answer["errorMessage"] === "string" ? answer["errorMessage"] : "the vessel refused the act";
  const reason = typeof refusal.reason === "string" ? refusal.reason : "";
  if (reason === "custody-locked") return new CustodyLocked();
  if (reason === "row-unavailable" && (refusal.home === "identity" || refusal.home === "storage" || refusal.home === "seal")
      && typeof refusal.file === "string" && typeof refusal.reading === "string") {
    return new CustodyRowUnavailable(refusal.home, refusal.file, refusal.reading);
  }
  if (ACT_REASONS.has(reason)) return new SealedActRefused(reason as SealedActRefusalReason, message);
  return new Error(message);
}

/**
 * AN ACT THAT ACTS AS A FACE RIDES A SESSION of that face (`SESSION_ACTS`): the face the act names, else the one the vessel
 * resolves (`face.resolve`, which stays at the custody door). Answers the vessel's answer, or null where no vessel stands.
 */
async function actInSession(act: SealedActName, args: Readonly<Record<string, unknown>>): Promise<Record<string, unknown> | null> {
  if (!(await udsAlive())) return null;
  const named = args["face"];
  const face = typeof named === "number" ? named : (await sealedAct<{ face: number }>("face.resolve", {})).face;
  let session: LocalSession;
  try { session = await openLocalSession({ faceRef: `h${face}`, hand: "cli" }); }
  catch (e) {
    if (e instanceof UdsUnreachable) return null;
    if (e instanceof SessionRefused) throw new SealedActRefused("act-refused", e.message);
    throw e;
  }
  try { return await session.act(act, { ...args, face }); }
  catch (e) {
    if (e instanceof SessionRefused) throw new SealedActRefused("act-refused", e.message);
    throw e;
  } finally { await session.close().catch(() => { /* the socket already went */ }); }
}

/**
 * Run one act of the sealed-act table: inside the standing vessel when its custody door answers, in this process
 * otherwise. Answers the act's result and where it ran; a refusal throws under its own class on either path.
 */
export async function sealedActVia(act: SealedActName, args: Readonly<Record<string, unknown>> = {}): Promise<{ readonly result: Record<string, unknown>; readonly via: SealedActVia }> {
  const answer = SESSION_ACTS.has(act) ? await actInSession(act, args) : await sendCustodyFrame({ op: "act", act, args });
  if (answer !== null && answer["op"] === "act") {
    if (answer["status"] === "error") throw refusalOf(answer);
    const result = answer["result"];
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error(`the vessel answered the act "${act}" with no result`);
    return { result: result as Record<string, unknown>, via: "vessel" };
  }
  return { result: await runSealedAct(act, args, directContext), via: "direct" };
}

/** Run one act of the sealed-act table and answer its result, typed by the caller. */
export async function sealedAct<T = Record<string, unknown>>(act: SealedActName, args: Readonly<Record<string, unknown>> = {}): Promise<T> {
  return (await sealedActVia(act, args)).result as T;
}
