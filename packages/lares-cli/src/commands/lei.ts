/**
 * `lares lei show | kui | unstring | restring` — the lei door on the CLI.
 *
 * A lei grants one rite (`push` · `kukulu` · `keep`) at one branch under one reach. Each sub-verb plans one row of the store door and the
 * args it carries (`leiPlan`); the row runs in the vessel, where the hand-only gate, the ward and the co-sign stand:
 *
 *   show       `swarm-show`          reads the board; with `--rite --branch [--head]` it also reads one rite's standing lei (`data.lei`)
 *   kui        `swarm-lei-kui`       strings a lei: wide by default (`--returns <n>`), or `--reach head --head <h>` to pin one head;
 *                                    `--after <lei cid>` names the lei it follows, absent for the first on the line; more than
 *                                    twelve returns asks `--yes`
 *   unstring   `swarm-lei-unstring`  revokes a lei that still holds returns (`--lei <cid>`): a signed record, nothing deleted
 *   restring   `swarm-lei-restring`  supersedes the standing lei with a newer one; the door fills `after` from the line's tip
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { storeFailure, storeVerb } from "../store-door.js";

export class LeiUsage extends Error {}

export type LeiVerb = "swarm-show" | "swarm-lei-kui" | "swarm-lei-unstring" | "swarm-lei-restring";
export interface LeiPlan { readonly verb: LeiVerb; readonly args: Record<string, unknown> }

const ACTS: Readonly<Record<string, LeiVerb>> = { show: "swarm-show", kui: "swarm-lei-kui", unstring: "swarm-lei-unstring", restring: "swarm-lei-restring" };

/** One sub-verb's store row and args, or a `LeiUsage` naming what the line lacks. The vessel's door judges the values. */
export function leiPlan(args: ParsedArgs): LeiPlan {
  const sub = args.positional[0];
  const verb = sub === undefined ? undefined : ACTS[sub];
  if (verb === undefined) throw new LeiUsage("name a sub-verb: show, kui, unstring or restring");
  // Each flag reads by its own literal name, so the accepts law walks them.
  const word = (raw: string | undefined): string | undefined => (typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined);
  const count = (name: string, raw: string | undefined, from: number): number | undefined => {
    if (raw === undefined) return undefined;
    if (!/^(?:0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < from) throw new LeiUsage(`--${name} takes a whole count from ${from}`);
    return Number(raw);
  };
  const out: Record<string, unknown> = {};
  const rite = word(args.options["rite"]), branch = word(args.options["branch"]);
  const head = word(args.options["head"]);
  const face = count("face", word(args.options["face"]), 0);
  if (sub === "show") {
    // The board reads with no line named; one rite's line reads by rite and branch, and a head rides along to ask after one head.
    if ([rite, branch, head].some((x) => x !== undefined)) {
      if (rite === undefined || branch === undefined) throw new LeiUsage("show reads one rite's line by --rite and --branch together (--head asks after one head)");
      Object.assign(out, { rite, branch, ...(head !== undefined ? { head } : {}) });
    }
  } else {
    if (rite === undefined) throw new LeiUsage("name the lei's rite: --rite push | kukulu | keep");
    if (branch === undefined) throw new LeiUsage("name the lei's branch: --branch <name>");
    Object.assign(out, { rite, branch });
    if (sub === "unstring") {
      const lei = word(args.options["lei"]);
      if (lei === undefined) throw new LeiUsage("name the lei to unstring by its cid: --lei <cid>");
      out["lei"] = lei;
    } else if (sub === "kui" || sub === "restring") {
      const reach = word(args.options["reach"]);
      const returns = count("returns", word(args.options["returns"]), 1);
      if (reach !== undefined) out["reach"] = reach;
      if (returns !== undefined) out["returns"] = returns;
      if (head !== undefined) out["head"] = head;
      const after = word(args.options["after"]);
      if (sub === "restring") { if (after !== undefined) throw new LeiUsage("a restring follows the line's tip; it names no --after"); }
      else out["after"] = after ?? null;
      // A count above twelve strings only with the hand's explicit confirm (`--yes`).
      if (args.flags["yes"] === true) out["confirm"] = true;
    }
  }
  if (face !== undefined) out["face"] = face;
  return { verb, args: out };
}

export async function cmdLei(args: ParsedArgs): Promise<number> {
  let plan: LeiPlan;
  try { plan = leiPlan(args); }
  catch (err) {
    if (err instanceof LeiUsage) return refuseUsage(args, "lei", helpLines("lei"), err.message);
    throw err;
  }
  try {
    const { output } = await storeVerb(plan.verb, plan.args);
    emit(args, { ok: true, data: output, human: () => console.log(JSON.stringify(output)) });
    return 0;
  } catch (err) {
    const failure = storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares lei: ${failure.message}`) });
    return exitFor(failure.code);
  }
}
