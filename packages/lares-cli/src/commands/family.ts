/**
 * THE FAMILY LISTING: what `lares tiddler get --meme` (no title) runs. It reads the meme roots a seat holds through the daemon's
 * `meme-list` verb, page by page, and prints one root per line. A family's writes ride the plain tiddler verbs (`tiddler put`
 * lands a root's carrier or one slot, `tiddler delete --family` removes one), so this door lists and writes nothing.
 */
import { vesselDid } from "../env.js";
import { containerArgs } from "../container-target.js";
import { verbFailure } from "../verb-call.js";
import { LocalWaitExpired } from "../local-connector.js";
import { readVerbOutcome } from "../verb-result.js";
import { emit, exitFor } from "../render.js";
import { UsageError, faceNamed, targetNamed, dispatch } from "./meme-shared.js";
import type { ParsedArgs } from "../parse-args.js";

/** The listing addresses the SEAT, never one meme: the container alone, `tree` on request. */
export function listPlan(args: ParsedArgs): { readonly verb: "meme-list"; readonly args: Record<string, string | boolean>; readonly face?: number } {
  const face = faceNamed(args);
  const out: Record<string, string | boolean> = { ...containerArgs(args, "tiddler get --meme"), ...targetNamed(args) };
  if (args.flags["tree"]) out["tree"] = true;
  return { verb: "meme-list", args: out, ...face };
}

/** One listed root, as the verb answers it. */
interface ListedRoot { uri: string; canonicalHash: string; bag?: string; floor?: boolean; slots?: ListedSlot[] }

/** The line a read prints on stderr where a house canon bag's floor snapshot answered it. */
const FLOOR_READ_NOTE = "read from the floor snapshot: this face holds no read on the live house canon document (the Kahu steward's face reads it live)";
interface ListedSlot { slot: string; uri: string; slots: ListedSlot[] }

/**
 * THE LISTING ARRIVES IN PAGES. One outcome carries a bounded number of rows, so the verb answers a page
 * and names the cursor of the next (`next`); this door hands each cursor back as `after` until none
 * remains, and a person reads every root. An answer whose `roots` holds no array (an outcome that carried
 * a count where the rows belong) refuses by name: an empty listing over a full seat would state a thing
 * nobody measured. A cursor that fails to advance refuses the same way.
 */
async function memeList(args: ParsedArgs): Promise<number> {
  const plan = listPlan(args);
  const did = await vesselDid();
  const roots: ListedRoot[] = [];
  let head: Record<string, unknown> = {};
  let requestId = "";
  const refuse = (code: "cap-denied" | "verb-error", message: string): number => {
    emit(args, { ok: false, requestId, error: { code, message }, human: () => console.error(`tiddler get --meme: ${message}`) });
    return exitFor(code);
  };
  for (let after: string | null = null; ;) {
    const result = await dispatch(plan, after === null ? plan.args : { ...plan.args, after }, did);
    requestId = result.requestId;
    const outcome = readVerbOutcome(result);
    if (!outcome.ok) return refuse(/cap-denied/.test(outcome.error ?? "") ? "cap-denied" : "verb-error", outcome.error ?? "the verb refused");
    const page = outcome.output["roots"];
    if (!Array.isArray(page)) {
      const count = (page as { boundedArrayCount?: unknown } | null | undefined)?.boundedArrayCount;
      return refuse("verb-error", typeof count === "number"
        ? `the listing arrived as a count of ${count} roots and named none of them; this vessel answers an unpaged listing`
        : "the listing named no roots array");
    }
    roots.push(...(page as ListedRoot[]));
    if (after === null) head = outcome.output;
    const next = outcome.output["next"];
    if (typeof next !== "string" || next === "") break;
    if (after !== null && next <= after) return refuse("verb-error", `the listing's cursor stood still at ${next}`);
    after = next;
  }
  const slotLines = (slots: ListedSlot[] | undefined, depth: number): void => {
    for (const s of slots ?? []) { console.log(`${"  ".repeat(depth)}${s.slot}`); slotLines(s.slots, depth + 1); }
  };
  // The seat as the verb named it: one bag, or a recipe with the bags its stack read and any it could not reach.
  const seat: Record<string, unknown> = {};
  for (const key of ["has", "bag", "floor", "recipe", "bags", "unreached"]) if (head[key] !== undefined) seat[key] = head[key];
  const unreached = Array.isArray(head["unreached"]) ? (head["unreached"] as string[]) : [];
  emit(args, {
    ok: true,
    requestId,
    data: { ...seat, roots },
    // One root per line — the base first so a shell reads it, the uri after; slots indent beneath.
    human: () => {
      if (typeof head["has"] === "string") console.log(head["has"]);
      for (const r of roots) { console.log(`${r.canonicalHash}  ${r.uri}`); slotLines(r.slots, 1); }
      for (const bag of unreached) console.error(`tiddler get --meme: ${bag} stands unreached; its roots stay unlisted`);
      if (head["floor"] === true || roots.some((r) => r.floor === true)) console.error(FLOOR_READ_NOTE);
    },
  });
  return 0;
}

/** Run the family listing, as the tiddler door parsed the line (`positional[0]` reads `list`). */
export async function cmdFamily(args: ParsedArgs): Promise<number> {
  try {
    return await memeList(args);
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "no-container") {
      const msg = err instanceof Error ? err.message : String(err);
      emit(args, { ok: false, error: { code: "no-container", message: msg }, human: () => console.error(msg) });
      return 2;
    }
    if (err instanceof UsageError) {
      const msg = err.message;
      const code = msg.startsWith("face-malformed:") ? "face-malformed" : "usage";
      emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`tiddler get --meme: ${msg}`) });
      return exitFor("usage");
    }
    if (err instanceof LocalWaitExpired) {
      // A local wait ending tells itself apart from an absent daemon by type, never by message.
      const w = verbFailure(err);
      emit(args, {
        ok: false, ...(w.requestId !== undefined ? { requestId: w.requestId } : {}),
        error: { code: w.code, message: w.message, ...(w.hint !== undefined ? { hint: w.hint } : {}) },
        human: () => console.error(`tiddler get --meme: ${w.message}`),
      });
      return exitFor(w.code);
    }
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => console.error(`tiddler get --meme: ${f.message}`),
    });
    return exitFor(f.code);
  }
}
