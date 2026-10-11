/**
 * store-door — ONE door for a command that touches the vessel's store.
 *
 * A standing vessel HOLDS its store: the Repo its peers sync, the records its own clients write. A command that
 * opened the store beside it would change bytes the running replica never sees, or race a write the vessel is
 * making. So a command routes its verb THROUGH the vessel whenever one stands, over the owner-only local socket,
 * and the vessel runs it against what it holds; with no vessel standing, the command runs the same door itself
 * and owns the store for that moment. One holder at a time, either way.
 *
 * The verb's answer comes back as the door's own payload. A door that REFUSES answers `{ refused }`, which the
 * caller names exactly as it names a refusal on the direct path.
 */

import { storeDoorDirect, type StoreDoorVerb } from "@lararium/node";
import { vesselDid, larSealHome } from "./env.js";
import { DaemonUnreachable } from "./verb-call.js";
import { udsAlive, udsSocketPresent, udsSocketPath, whoHolds, invokeLocal, UdsUnreachable } from "./local-connector.js";
import { waitForResourceBudgeted, SlowBootTimeout, type BootPhase } from "./port-control.js";
import { summaryOutput } from "./verb-result.js";
import type { SubmitResult } from "./verb-result.js";

/**
 * Run `verb` over the local socket exactly as `verb-call.ts`'s `runVerb` does (same presence check, same
 * `UdsUnreachable` → `DaemonUnreachable` mapping), but passing `signal` straight through to `invokeLocal` so
 * THIS door's own budgeted wait can abort the socket at its own decision (H1), rather than let the verb's
 * flat `timeoutMs` hold it open for the rest of a budget nobody is still waiting on.
 */
async function invokeAbortable(
  verb: string, args: Record<string, unknown>, requestedBy: string,
  opts: { readonly timeoutMs: number; readonly signal: AbortSignal },
): Promise<SubmitResult> {
  if (!udsSocketPresent()) throw new DaemonUnreachable(udsSocketPath());
  try { return await invokeLocal(verb, args, requestedBy, opts); }
  catch (e) {
    if (e instanceof UdsUnreachable) throw new DaemonUnreachable(udsSocketPath());
    throw e;
  }
}

/** Where a routed door ran: inside the standing vessel, or in this process. */
export type StoreDoorVia = "daemon" | "direct";

/**
 * This door's own patience for a store it cannot yet reach serving verbs: the rendezvous name may stand with
 * no answer at all yet (the vessel still opening its claim), stand PARKED (claimed, but its boot has not yet
 * opened a verb channel — `owned-store.ts`'s `park`), or stand WEDGED (M4: something accepted the connection
 * and then never answered at all — frozen, not merely slow-but-live). Each phase spends its OWN budget, so a
 * slow-but-live boot earns more patience than a name nothing answers at all, a wedged holder earns its own
 * bounded patience distinct from both, and a timeout NAMES the pid still holding rather than a flat "timed
 * out after 30000ms".
 */
export const STORE_DOOR_PHASES: readonly BootPhase[] = [
  { name: "unbound", budgetMs: 10_000 },
  { name: "parked",  budgetMs: 45_000 },
  { name: "wedged",  budgetMs: 10_000 },
];

/** The pid(s) named in a `heldAs`/`whoHolds` message (`"a vessel (pid 1234) holds…"`, or M4's wedged
 *  `"…still held by pid(s) 1234, 5678"`), or none. */
const pidsNamedIn = (message: string): readonly number[] => {
  const m = /pid\(?s?\)?\s+([\d, ]+)/.exec(message);
  if (!m) return [];
  return m[1]!.split(",").map((s) => Number(s.trim())).filter(Number.isFinite);
};

/**
 * Run `verb` through the standing vessel, or `direct()` here when none stands. `daemonUp` is read once by a
 * caller routing several verbs; absent, the socket is probed.
 */
export async function throughStoreDoor(opts: {
  readonly verb:      string;
  readonly args:      Record<string, unknown>;
  readonly direct:    () => Record<string, unknown> | Promise<Record<string, unknown>>;
  readonly daemonUp?: boolean;
  /** Test seam — defaults to {@link STORE_DOOR_PHASES}. A real caller never overrides this. */
  readonly phases?:   readonly BootPhase[];
}): Promise<{ readonly output: Record<string, unknown>; readonly via: StoreDoorVia }> {
  if (opts.daemonUp ?? (await udsAlive())) {
    const phases = opts.phases ?? STORE_DOOR_PHASES;
    const totalBudgetMs = phases.reduce((sum, p) => sum + p.budgetMs, 0);
    let settled = false;
    let lastMessage = "";
    const controller = new AbortController();
    const verbPromise = invokeAbortable(opts.verb, opts.args, await vesselDid(), { timeoutMs: totalBudgetMs, signal: controller.signal })
      .finally(() => { settled = true; });
    // RACE the actual verb against a budgeted wait that NAMES the holder — never a flat clock that hangs mute.
    // The waiter never resolves on its own (its `probe` never reads true); it only ever throws `SlowBootTimeout`
    // once a phase's own budget is spent, or stops quietly the instant `until` sees the verb has settled.
    const named = waitForResourceBudgeted("the vessel's store door", phases, {
      until: () => settled,
      probe: async () => settled,
      phase: async () => {
        const met = await whoHolds();
        lastMessage = met?.message ?? "";
        return met === null ? "unbound" : met.phase;
      },
      holderPids: () => pidsNamedIn(lastMessage),
    }).then((): { readonly quiet: true } => ({ quiet: true }));
    let raced: { readonly quiet: true } | { readonly quiet: false; readonly v: SubmitResult };
    try {
      raced = await Promise.race([verbPromise.then((v): { readonly quiet: false; readonly v: SubmitResult } => ({ quiet: false, v })), named]);
    } catch (err) {
      // THIS DOOR'S OWN DECISION CLOSES THE SOCKET AT ONCE (H1). A budgeted wait that names a holder and
      // gives up must not leave the verb's own flat timer holding a channel open for the rest of ITS budget
      // while nobody is still listening on this end — the vessel sees the hang-up as an `end` right then
      // (`owned-store.ts`'s `park`, once it stops masking EOF behind a paused, unshifted socket), rather than
      // running the verb on a late thaw against a caller that already told its operator this failed.
      controller.abort();
      await verbPromise.catch(() => { /* the abort's own rejection is not a second fault; `err` already is one */ });
      throw err;
    }
    const r = raced.quiet ? await verbPromise : raced.v;
    if (r.status === "error") throw new Error(r.errorMessage ?? "verb failed");
    return { output: summaryOutput(r) ?? {}, via: "daemon" };
  }
  return { output: await opts.direct(), via: "direct" };
}

export { SlowBootTimeout };

/** A door's refusal, when the calling command names no refusal class of its own. */
export class StoreDoorRefusal extends Error {}

/**
 * Run one row of the store's door table: through the standing vessel when one stands, or here, holding the
 * store for the moment of the act (`storeDoorDirect`). A row's `{ refused }` answer throws as `Refusal`, so the
 * command names it exactly as it names a refusal on either path; the answer comes back as the row's own result,
 * with the door's `verb` echo set aside.
 */
export async function storeVerb(
  verb: StoreDoorVerb,
  args: Record<string, unknown>,
  Refusal: new (message: string) => Error = StoreDoorRefusal,
): Promise<{ readonly output: Record<string, unknown>; readonly via: StoreDoorVia }> {
  const r = await throughStoreDoor({ verb, args, direct: () => storeDoorDirect(verb, args, { sealHome: larSealHome() }) });
  if (typeof r.output["refused"] === "string") throw new Refusal(r.output["refused"]);
  const { verb: _echo, ...output } = r.output;
  return { output, via: r.via };
}

/**
 * What a `pokeSealHomeRefold` call reports (L3): `"done"` — the hook truthfully claimed this write's
 * refold landed; `"pending"` — a vessel stood and the row ran, but the refold is still running past its
 * own budget (`store-door-verbs.ts`'s `awaitOnRolled`); `"none"` — nothing to poke (no vessel standing),
 * or the row ran and the hook made no truthful claim either way. A caller that only logged this before
 * now carries it: discarding the answer is exactly how H2's live readings could stay stale with nobody
 * able to tell from the CLI's own JSON.
 */
export type SealHomeRefold = "done" | "pending" | "none";

/**
 * Poke a STANDING vessel to refold right after a write that landed beside the seal home rather than through
 * this door (`accept-carriage`'s consent, `carry-for`'s carrier seal, a carried `seal import`'s grown set) —
 * H2. Those writes touch no Repo, so they earn no door row of their own; but a standing vessel's live
 * readings (`readCarried`, the board/antigen folds its dial presents against) refold only on the SAME hook
 * every door-row write already fires, so this names the one no-op row that fires it. With no vessel standing
 * there is nothing to refold — the next boot reads the fresh bytes on its own, so this is skipped entirely
 * rather than opening a direct `ownedStore` act for nothing.
 */
export async function pokeSealHomeRefold(): Promise<SealHomeRefold> {
  if (!(await udsAlive())) return "none";
  try {
    const r = await storeVerb("seal-home-refold", {});
    const refolded = r.output["refolded"];
    if (refolded === true) return "done";
    if (refolded === "pending") return "pending";
    return "none";
  } catch { return "none"; }               // a refusal here names nothing broken — the write itself already landed
}
