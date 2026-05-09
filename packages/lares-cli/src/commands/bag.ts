/**
 * `lares bag <verb> [args...]` — operator surface for individual bag operations.
 *
 * Subcommand-style dispatcher. Operates on a single Automerge bag (one doc,
 * one sync surface). Wiki-level operations (whole-recipe pins, composition,
 * Epoch-on-the-stack) live under `lares wiki <verb>`; bag-level lives here.
 *
 * Verbs:
 *   pin <url> [--reason <text>]   — never evict this bag from RAM
 *   unpin <url>                   — demote pinned bag to hot LRU
 *   stats                         — pinned / hot / cold residency snapshot
 *   register-cold <url>           — mark URL as known-but-not-loaded (oracle stub)
 *
 * E.1 ships these four; E.8 adds `bag epoch <url>` (DXOS-style snapshot-restart).
 */

import {
  cmdPin, cmdUnpin, cmdRegisterCold, cmdResidency,
} from "./residency.js";
import type { ParsedArgs } from "../parse-args.js";

type BagSubcommand = (args: ParsedArgs) => Promise<number>;

const SUBCOMMANDS: Readonly<Record<string, { handler: BagSubcommand; summary: string }>> = {
  "pin":           { handler: cmdPin,          summary: "Pin a bag URL — daemon never evicts it. Needs `lares serve`." },
  "unpin":         { handler: cmdUnpin,        summary: "Unpin a bag URL — demotes from pinned to hot LRU. Needs `lares serve`." },
  "stats":         { handler: cmdResidency,    summary: "Print the daemon's bag residency snapshot. Needs `lares serve`." },
  "register-cold": { handler: cmdRegisterCold, summary: "Mark a bag URL as known-but-not-loaded (oracle stub). Needs `lares serve`." },
};

function printBagHelp(): void {
  console.log("lares bag <verb> [args...]\n");
  console.log("Verbs:");
  for (const [verb, entry] of Object.entries(SUBCOMMANDS)) {
    console.log(`  ${verb.padEnd(15)} ${entry.summary}`);
  }
}

export async function cmdBag(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  if (!verb || verb === "help" || args.flags["help"]) {
    printBagHelp();
    return verb ? 0 : 2;
  }
  const entry = SUBCOMMANDS[verb];
  if (!entry) {
    console.error(`lares bag: unknown verb "${verb}". Run \`lares bag help\` for the list.`);
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
