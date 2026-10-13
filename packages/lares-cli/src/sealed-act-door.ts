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
 * ── WHAT A VESSEL'S ANSWER MEANS ────────────────────────────────────────────────────────────────
 *   · an `act` answer with a `result`       the act ran inside the vessel; the result returns to the caller.
 *   · an `act` answer with a refusal        the same refusal the act throws in process, under its own class:
 *                                           `CustodyLocked` (the vessel stands locked: `lares vault unlock`),
 *                                           `CustodyRowUnavailable`, `SealedActRefused`, or a plain error.
 *   · any other answer, or none             no vessel's custody door stands at the socket (nothing listens, or
 *                                           another command holds the store for one act): the act runs here.
 */
import {
  CustodyLocked, CustodyRowUnavailable, SealedActRefused, runSealedAct,
  type SealedActContext, type SealedActName, type SealedActRefusalReason,
} from "@lararium/node";
import { sendCustodyFrame } from "./custody-door.js";
import { storeVerb } from "./store-door.js";

/** Where an act ran: inside the standing vessel, or in this process. */
export type SealedActVia = "vessel" | "direct";

/** What an act reads from its surroundings when it runs in this process: the KEL head comes off the store's one holder. */
const directContext: SealedActContext = {
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
 * Run one act of the sealed-act table: inside the standing vessel when its custody door answers, in this process
 * otherwise. Answers the act's result and where it ran; a refusal throws under its own class on either path.
 */
export async function sealedActVia(act: SealedActName, args: Readonly<Record<string, unknown>> = {}): Promise<{ readonly result: Record<string, unknown>; readonly via: SealedActVia }> {
  const answer = await sendCustodyFrame({ op: "act", act, args });
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
