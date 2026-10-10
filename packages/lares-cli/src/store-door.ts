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

import { storeDoorDirect, type HearthDoorVerb } from "@lararium/node";
import { vesselDid, larSealHome } from "./env.js";
import { runVerb } from "./verb-call.js";
import { udsAlive } from "./local-connector.js";
import { summaryOutput } from "./verb-result.js";

/** Where a routed door ran: inside the standing vessel, or in this process. */
export type StoreDoorVia = "daemon" | "direct";

/**
 * Run `verb` through the standing vessel, or `direct()` here when none stands. `daemonUp` is read once by a
 * caller routing several verbs; absent, the socket is probed.
 */
export async function throughStoreDoor(opts: {
  readonly verb:      string;
  readonly args:      Record<string, unknown>;
  readonly direct:    () => Record<string, unknown> | Promise<Record<string, unknown>>;
  readonly daemonUp?: boolean;
}): Promise<{ readonly output: Record<string, unknown>; readonly via: StoreDoorVia }> {
  if (opts.daemonUp ?? (await udsAlive())) {
    const r = await runVerb(opts.verb, opts.args, await vesselDid(), { timeoutMs: 30_000 });
    if (r.status === "error") throw new Error(r.errorMessage ?? "verb failed");
    return { output: summaryOutput(r) ?? {}, via: "daemon" };
  }
  return { output: await opts.direct(), via: "direct" };
}

/** A door's refusal, when the calling command names no refusal class of its own. */
export class StoreDoorRefusal extends Error {}

/**
 * Run one row of the store's door table: through the standing vessel when one stands, or here, holding the
 * store for the moment of the act (`storeDoorDirect`). A row's `{ refused }` answer throws as `Refusal`, so the
 * command names it exactly as it names a refusal on either path; the answer comes back as the row's own result,
 * with the door's `verb` echo set aside.
 */
export async function storeVerb(
  verb: HearthDoorVerb,
  args: Record<string, unknown>,
  Refusal: new (message: string) => Error = StoreDoorRefusal,
): Promise<{ readonly output: Record<string, unknown>; readonly via: StoreDoorVia }> {
  const r = await throughStoreDoor({ verb, args, direct: () => storeDoorDirect(verb, args, { sealHome: larSealHome() }) });
  if (typeof r.output["refused"] === "string") throw new Refusal(r.output["refused"]);
  const { verb: _echo, ...output } = r.output;
  return { output, via: r.via };
}
