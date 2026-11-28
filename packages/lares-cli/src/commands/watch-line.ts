/**
 * `lares watch filter=<filter> [until=<filter>] [hold=<ms>] [id=<id>] [as-of=<digest>]` and `lares watch id=<id> mu=unask` — THE
 * LONG LINE (lar:///engine.filter.watches, comms-ux-enacts landing 16).
 *
 * The VM holds the watch: a tiddler (`$:/state/lares/watch/<id>`) the wiki's own change event moves. This line loops HELD CALLS,
 * each `call` naming `watch` with the last answer's `id` and `as-of`, so no change between two calls goes unseen (the watch
 * tiddler keeps moving while no call holds it, and a stale cursor answers at once). It prints one has line per change, and ends
 * when `until` answers (`band/ended`), when the watch leaves (`band/removed`), or when the caller stops it: an interrupt closes
 * the socket, and the vessel withdraws the held ask, which drops the watch and its record.
 *
 * ONE SESSION: a line opens one session of the face `face=N` names (else the face the vessel resolves) and holds every call on
 * it; the watch answers to that face alone. Nothing here polls a filter on a timer: each call holds in the VM until its watch moves
 * or its `hold` (pacing alone) runs out, and an `unchanged` answer re-arms the next call with the same cursor.
 *
 * Meme: lar:///ha.ka.ba/lares/afford/engine.filter.watches
 */

import { openLocalSession } from "../session-connector.js";
import { readVerbOutcome, type SubmitResult } from "../verb-result.js";
import { actingFace, faceOption, FaceOptionMalformed } from "../face-option.js";
import { emit, exitFor } from "../render.js";
import { DoorUsage, type DoorPlan } from "./door-call.js";
import type { ParsedArgs } from "../parse-args.js";

/** The hold a call keeps when the line names none (the VM's own default), and the slack the line's wait adds beyond it. */
export const WATCH_LINE_HOLD_MS = 25_000;
const WATCH_WAIT_SLACK_MS = 15_000;

/** One held call's ask: the `call` verb's args, and how long this side waits for its answer. */
export type WatchAsk = (args: Record<string, unknown>, timeoutMs: number) => Promise<SubmitResult>;

/**
 * The asker a line rides: ONE session of the face it names, else of the face the vessel resolves (the worn face). A watch answers
 * to the face its session door verified, so a line never rides a one-shot call (the vessel refuses one `watch-faceless`).
 */
export async function watchAsker(args: ParsedArgs): Promise<{ readonly ask: WatchAsk; readonly close: () => Promise<void> }> {
  let face: number;
  try { face = faceOption(args).face ?? await actingFace(args); }
  catch (error) { if (error instanceof FaceOptionMalformed) throw new DoorUsage(error.message); throw error; }
  const session = await openLocalSession({ faceRef: `h${face}`, hand: "cli" });
  return {
    ask: async (callArgs, timeoutMs) => {
      const { kind: _kind, ...rest } = await session.call("call", callArgs, { timeoutMs });
      return rest as unknown as SubmitResult;
    },
    close: () => session.close().catch(() => { /* the socket already went */ }),
  };
}

/** The bands a watch answers. */
type WatchBand = "changed" | "unchanged" | "ended" | "removed" | "absent";

/**
 * THE LOOP: one held call after another on the asker, each carrying the last `id` and `as-of`, printing one has line per change.
 * An unask answers once and ends. A refusal prints the vessel's words and its exit.
 */
export async function watchLine(args: ParsedArgs, plan: DoorPlan, asker: { readonly ask: WatchAsk }): Promise<number> {
  const params = { ...((plan.args["params"] as Record<string, unknown> | undefined) ?? {}) };
  const hold = typeof params["hold"] === "string" && /^[0-9]+$/.test(params["hold"]) ? Number(params["hold"]) : WATCH_LINE_HOLD_MS;
  const unask = typeof params["mu"] === "string" && /^(0+|unask)$/.test(params["mu"].trim());
  let announced = false;
  for (;;) {
    const result = await asker.ask({ ...plan.args, params }, hold + WATCH_WAIT_SLACK_MS);
    const outcome = readVerbOutcome(result);
    if (!outcome.ok) {
      const message = outcome.error ?? "the watch refused";
      emit(args, { ok: false, requestId: result.requestId, error: { code: "verb-error", message }, human: () => console.error(`lares watch: ${message}`) });
      return exitFor("verb-error");
    }
    const out = outcome.output;
    const band = String(out["band"] ?? "") as WatchBand;
    const id = typeof out["id"] === "string" ? out["id"] : null;
    const asOf = typeof out["asOf"] === "string" ? out["asOf"] : null;
    if (!announced && id !== null && !unask) {
      announced = true;
      console.error(`watch ${id} stands on ${String(out["filter"] ?? params["filter"] ?? "")}; drop it with \`lares watch id=${id} mu=unask\``);
    }
    if (band === "changed" || band === "ended" || band === "removed" || band === "absent" || unask) {
      emit(args, { ok: true, requestId: result.requestId, data: out, human: () => console.log(String(out["has"] ?? `band/${band} id/${id ?? "?"}`)) });
    }
    if (unask || band === "ended" || band === "removed" || band === "absent") return 0;
    if (id !== null) params["id"] = id;
    if (asOf !== null) params["as-of"] = asOf;
  }
}

/** `lares watch …`: the plan's call held in a loop until the watch ends or the caller stops it. */
export async function cmdWatchLine(args: ParsedArgs, plan: DoorPlan): Promise<number> {
  const asker = await watchAsker(args);
  try { return await watchLine(args, plan, asker); }
  finally { await asker.close(); }
}
