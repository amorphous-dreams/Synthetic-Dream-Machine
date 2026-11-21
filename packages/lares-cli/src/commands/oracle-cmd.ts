/**
 * `lares oracle cast [--coins <six values>] --recipe <slug>` — the CLI skin of the `oracle-cast` verb: one I Ching cast
 * by three coins a line, written by the vessel as one tiddler under `casts/`.
 *
 * A CAST STANDS AS AN ACT. The vessel casts and lands the record once; reading it again never casts again. With no
 * `--coins` the vessel draws the coins through the platform's entropy door (`crypto.getRandomValues`); `--coins` hands
 * it the six values the operator threw with real coins (6, 7, 8 or 9, bottom line first), named
 * `operator:three-coins`. THE CLOCK SEAM sits at this edge: the command reads the time once and the verb reads none.
 *
 * The reading prints plainly by default (the figure, the change, the source of chance, each reading the wiki holds
 * with its attribution and license, and the cast's title); `--json` carries the verb's own answer verbatim as `data`,
 * the same body the MCP seat's `oracle_cast` hands back. The oracle widens attention and never decides.
 *
 * The container law holds: name `--recipe <slug>` (`--recipe default`, the worn face's daemon wiki) or `--bag <slug>`.
 */

import { parseCoins } from "@lararium/mesh/oracle-cast";
import { containerArgs } from "../container-target.js";
import { emit, exitFor } from "../render.js";
import { DoorUsage, guardDoor, runDoor, wordOf, type DoorPlan } from "./door-call.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";

/** The caster a line names none for: the operator at the keyboard. */
const DEFAULT_CASTER = "operator";

/** The verb and its args for `oracle cast`: the argument law, with no vessel in reach. `at` is the time the CLI read. */
export function oraclePlan(args: ParsedArgs, at: string): DoorPlan {
  const out: Record<string, unknown> = { ...containerArgs(args, "oracle cast", "write"), at, caster: wordOf(args.options["caster"]) ?? DEFAULT_CASTER };
  const coins = wordOf(args.options["coins"]);
  if (coins !== null) {
    const lines = parseCoins(coins);
    if (lines === null) throw new DoorUsage(`--coins takes six line values of 6, 7, 8 or 9, bottom line first (e.g. --coins 7,8,9,6,7,7); got "${coins}"`);
    out["coins"] = lines;
  }
  return { verb: "oracle-cast", args: out };
}

interface Reading { title: string; absent?: boolean; caption?: string; attribution?: string; license?: string; source?: string; text?: string }

async function oracleCast(args: ParsedArgs): Promise<number> {
  const plan = oraclePlan(args, new Date().toISOString());
  const ran = await runDoor(args, "oracle cast", plan);
  if (!ran.ok) return ran.exit;
  const answer = ran.output;
  const decision = String(answer["decision"] ?? "");
  const ok = decision === "put";
  const message = decision === "exists" ? `exists: a cast already stands at ${String(answer["title"])}; nothing moved` : `${decision}: ${String(answer["title"])}`;
  emit(args, {
    ok, requestId: ran.requestId, data: answer,
    ...(ok ? {} : { error: { code: decision === "exists" ? "conflict" : "verb-error", message } }),
    human: () => {
      if (!ok) { console.error(`lares oracle cast: ${message}`); return; }
      console.log(String(answer["text"] ?? ""));
      for (const reading of (answer["readings"] as Reading[] | undefined) ?? []) {
        console.log("");
        if (reading.absent) { console.log(`(${reading.title}: this wiki holds no such reading)`); continue; }
        console.log(`── ${reading.caption ?? reading.title}`);
        if (reading.text) console.log(reading.text);
        console.log(`   ${[reading.attribution, reading.license].filter(Boolean).join(" · ")}`);
      }
      console.log("");
      console.log(`cast: ${String(answer["title"])}`);
    },
  });
  return exitFor(ok ? "ok" : decision === "exists" ? "conflict" : "verb-error");
}

export async function cmdOracle(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (sub !== "cast") {
    if (sub) console.error(`lares oracle: unknown sub-verb "${sub}"`);
    for (const line of helpLines("oracle")) console.error(line);
    return 2;
  }
  return guardDoor(args, "oracle cast", () => oracleCast(args));
}

