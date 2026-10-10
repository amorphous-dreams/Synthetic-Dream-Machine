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
import { runVerb } from "./verb-call.js";
import { udsAlive, whoHolds } from "./local-connector.js";
import { waitForResourceBudgeted, SlowBootTimeout, type BootPhase } from "./port-control.js";
import { summaryOutput } from "./verb-result.js";
import type { SubmitResult } from "./verb-result.js";

/** Where a routed door ran: inside the standing vessel, or in this process. */
export type StoreDoorVia = "daemon" | "direct";

/**
 * This door's own patience for a store it cannot yet reach serving verbs: the rendezvous name may stand with
 * no answer at all yet (the vessel still opening its claim), or stand PARKED (claimed, but its boot has not
 * yet opened a verb channel — `owned-store.ts`'s `park`). Each phase spends its OWN budget, so a slow-but-live
 * boot earns more patience than a name nothing answers at all, and a timeout NAMES the pid still holding
 * rather than a flat "timed out after 30000ms".
 */
export const STORE_DOOR_PHASES: readonly BootPhase[] = [
  { name: "unbound", budgetMs: 10_000 },
  { name: "parked",  budgetMs: 45_000 },
];

/** The pid named in a `heldAs`/`whoHolds` message (`"a vessel (pid 1234) holds…"`), or none. */
const pidsNamedIn = (message: string): readonly number[] => {
  const m = /pid (\d+)/.exec(message);
  return m ? [Number(m[1])] : [];
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
    const verbPromise = runVerb(opts.verb, opts.args, await vesselDid(), { timeoutMs: totalBudgetMs })
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
        return met === null ? "unbound" : "parked";
      },
      holderPids: () => pidsNamedIn(lastMessage),
    }).then((): { readonly quiet: true } => ({ quiet: true }));
    const raced = await Promise.race([verbPromise.then((v): { readonly quiet: false; readonly v: SubmitResult } => ({ quiet: false, v })), named]);
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
 * Poke a STANDING vessel to refold right after a write that landed beside the seal home rather than through
 * this door (`accept-carriage`'s consent, `carry-for`'s carrier seal, a carried `seal import`'s grown set) —
 * H2. Those writes touch no Repo, so they earn no door row of their own; but a standing vessel's live
 * readings (`readCarried`, the board/antigen folds its dial presents against) refold only on the SAME hook
 * every door-row write already fires, so this names the one no-op row that fires it. With no vessel standing
 * there is nothing to refold — the next boot reads the fresh bytes on its own, so this is skipped entirely
 * rather than opening a direct `ownedStore` act for nothing.
 */
export async function pokeSealHomeRefold(): Promise<void> {
  if (!(await udsAlive())) return;
  try { await storeVerb("seal-home-refold", {}); } catch { /* best-effort — a refusal here names nothing broken */ }
}
