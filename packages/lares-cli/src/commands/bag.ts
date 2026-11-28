/**
 * `lares bag <verb> [args...]` — operator surface for individual bag operations.
 *
 * Subcommand-style dispatcher. Operates on a single Automerge bag (one doc,
 * one sync surface). Wiki-level operations (whole-recipe pins, composition,
 * Epoch-on-the-stack) live under `lares wiki <verb>`; bag-level lives here.
 *
 * TWO HALVES, and they answer different questions. The RUNTIME half (pin · unpin · stats · register-cold ·
 * epoch) answers //is this doc in RAM//. The LIFECYCLE half (list · show · declare · home · repo) answers
 * what a bag IS, who may read it, where it belongs, and how to move it — none of which a bag could answer
 * about itself until it carried a declaration of its own.
 *
 * Verbs:
 *   pin <url> [reason=<text>]   — never evict this bag from RAM
 *   unpin <url>                   — remove the cooling exemption (bag rejoins the LRU sweep)
 *   stats                         — pinned / wela / anu residency snapshot
 *   register-cold <url>           — mark URL as known-but-not-loaded (the oracle entry alone)
 *   compact <url>                 — DXOS-style snapshot-restart; bounds history
 *   cas [all=true] [fetch=<cid>] [pin=<cid>] [release=<cid>] [sweep=true [dry-run=true]]
 *                                 — the cid/ CAS tier: blobs · referenced · unreferenced · bytes; fetch · pin · release · sweep
 *   show                          — every bag: declared tier + home, and whether it sits where it belongs
 *   show <bag>                    — one bag's declaration, resolved on this vessel
 *   declare <bag> tier= home=   — write/amend the declaration (moves no bytes)
 *   home <bag> to=<home> approve=true  — MOVE the bytes and re-anchor the declaration together
 *   repo <list|add|drop>          — the repo registry; bags name IDs, never paths
 */

import { vesselDid } from "../env.js";
import {
  cmdRegisterCold,
} from "./residency.js";
import {
  cmdBagList, cmdBagShow, cmdBagDeclare, cmdBagHome, cmdBagRepo, bagLifecycle,
} from "./bag-declare-cmd.js";
import { cmdCas } from "./cas.js";
import { summaryOutput } from "../verb-result.js";
import { runVerb, verbFailure } from "../verb-call.js";
import { exitFor } from "../render.js";
import { cmdShare } from "./share-cmd.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";

/** `lares bag compact <bag-url>` — DXOS-style snapshot-restart on one bag.
 *
 *  NAMED FOR WHAT IT DOES, and for whose word it borrows. The ceremony is DXOS's, and `epoch` in this
 *  house is RESERVED for the monotone fencing frontier a grant binds to. A compaction CUTS history and
 *  fences nobody, so it carries the qualifier and leaves the bare word to the fence
 *  (lar:///ha.ka.ba/lararium/mesh/epoch-binding-surfaces#/the-five). */
export async function cmdBagCompact(args: ParsedArgs): Promise<number> {
  const bagUrl = args.positional[0];
  if (!bagUrl) {
    console.error("usage: lares bag compact <bag-url>");
    return 2;
  }
  const did = await vesselDid();
  let r;
  try {
    // UDS fast path, WS fallback (the lares↔lararium binding).
    r = await runVerb("bag-compact", { bagUrl }, did, { timeoutMs: 30_000 });
  } catch (err) {
    // M3′: told apart by the error's own TYPE — a LOCAL WAIT ENDING (the write door `watch apply=true`
    // uses this verb through) is not an absent daemon.
    const f = verbFailure(err);
    console.error(`lares bag: ${f.message}`);
    if (f.hint !== undefined) console.error(`  ${f.hint}`);
    return exitFor(f.code);
  }
  if (r.status === "error") {
    console.error(`bag compact failed: ${r.errorMessage ?? "unknown"}`);
    return 4;
  }
  const result = summaryOutput(r) ?? {};
  console.log("");
  console.log(`bag compact: ${result["bagUrl"]}`);
  console.log(`  old doc:  ${result["oldDocUrl"]}`);
  console.log(`  new doc:  ${result["newDocUrl"]}`);
  console.log(`  tiddlers: ${result["tiddlerCount"]}  tombstones: ${result["tombstoneCount"]}`);
  console.log(`  layer:    ${result["layerSwapped"] ? "swapped in composite" : "not mounted"}`);
  if (result["note"]) console.log(`  note:     ${result["note"]}`);
  console.log("");
  return 0;
}

type BagSubcommand = (args: ParsedArgs) => Promise<number>;

const SUBCOMMANDS: Readonly<Record<string, { handler: BagSubcommand }>> = {
  "register-cold": { handler: cmdRegisterCold },
  "compact":       { handler: cmdBagCompact },
  "cas":           { handler: async (a) => cmdCas(a) },
  // ── The LIFECYCLE half. Everything above answers a RUNTIME question (is this doc in RAM); these answer
  // what a bag IS, who may read it, where it belongs, and how to move it — the questions a bag could not
  // answer about itself at all until it carried a declaration.
  "show":          { handler: bagLifecycle(async (a) => a.positional[0] ? cmdBagShow(a) : cmdBagList(a)) },
  "declare":       { handler: bagLifecycle(cmdBagDeclare) },
  "home":          { handler: bagLifecycle(cmdBagHome) },
  "repo":          { handler: bagLifecycle(cmdBagRepo) },
  "share":         { handler: cmdShare("bag") },
};

/** Every verb the bag door answers (`help` prints this table). */
export const BAG_VERBS: readonly string[] = ["help", ...Object.keys(SUBCOMMANDS)];

/** The door's lines, drawn from the carriers `lares bag --help` prints; `lares bag help` and a refusal print the same. */
function printBagHelp(out: (line: string) => void): void {
  for (const line of helpLines("bag")) out(line);
}

export async function cmdBag(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  if (!verb || verb === "help" || args.flags["help"]) {
    printBagHelp((line) => console.log(line));
    return verb ? 0 : 2;
  }
  // The dispatcher's one MOVED table answers `bag pin`, `bag list` and kin before this door runs.
  const entry = SUBCOMMANDS[verb];
  if (!entry) {
    console.error(`lares bag: unknown verb "${verb}"`);
    printBagHelp((line) => console.error(line));
    return 2;
  }
  // Shift positional so the inner handler sees args without the verb.
  const inner: ParsedArgs = {
    command:    "bag",
    positional: args.positional.slice(1),
    options:    args.options,
    flags:      args.flags,
  };
  return await entry.handler(inner);
}
