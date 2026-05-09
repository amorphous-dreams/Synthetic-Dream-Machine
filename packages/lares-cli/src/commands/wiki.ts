/**
 * `lares wiki <verb> [args...]` — operator surface for whole-wiki operations.
 *
 * Subcommand-style dispatcher. Mirrors `lares bag` shape; operates at the
 * recipe / room granularity rather than individual bags. End-user UI may
 * still call these "wikis" while the architectural noun stays "room"
 * (Kowloon room=Group mapping).
 *
 * Verbs (E.4 ships read-only; E.5+ adds write/composition/GC):
 *   list                     — enumerate rooms registered in the catalog
 *   which <uri>              — recipe-presence query for a tiddler
 *
 * Coming in E.5+: init, open, sync, pin, unpin, add-bag, remove-bag,
 * epoch, rotate-recipe, prune-stale.
 */

import { join } from "node:path";
import { loadOperatorVerifyingKey } from "@lararium/node";
import { repoRoot } from "@lares/lares";
import { connectAdminPeer, submitCommand } from "../admin-peer.js";
import type { ParsedArgs } from "../parse-args.js";

type WikiSubcommand = (args: ParsedArgs) => Promise<number>;

async function operatorDid(): Promise<string> {
  const dataDir = join(repoRoot, "packages", "lararium-node", ".lararium");
  return "0x" + (await loadOperatorVerifyingKey(dataDir));
}

async function tryConnect() {
  try {
    return await connectAdminPeer({});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`lares wiki: ${msg}`);
    console.error("  Start the daemon with `lares serve` and try again.");
    return null;
  }
}

export async function cmdWikiList(_args: ParsedArgs): Promise<number> {
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "list-wikis", {}, did);
    if (r.status === "error") {
      console.error(`list failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const wikis = (r.result?.["wikis"] ?? []) as Array<{
      slug: string;
      uri: string;
      automergeUrl: string | null;
    }>;
    console.log("");
    if (wikis.length === 0) {
      console.log("(no wikis registered)");
      console.log("");
      return 0;
    }
    console.log(`wikis (${wikis.length}):`);
    for (const w of wikis) {
      const url = w.automergeUrl ? w.automergeUrl.slice(0, 40) + "…" : "(no doc)";
      console.log(`  ${w.slug.padEnd(20)} ${w.uri}`);
      console.log(`    ↳ ${url}`);
    }
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

export async function cmdWikiWhich(args: ParsedArgs): Promise<number> {
  const tiddler = args.positional[0];
  if (!tiddler) {
    console.error("usage: lares wiki which <tiddler-uri>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "where", { tiddler }, did);
    if (r.status === "error") {
      console.error(`which failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const bags    = (r.result?.["bags"]       ?? []) as string[];
    const primary = (r.result?.["primaryBag"] ?? null) as string | null;
    console.log("");
    console.log(`tiddler:    ${tiddler}`);
    console.log(`primary:    ${primary ?? "(not found)"}`);
    if (bags.length > 0) {
      console.log(`all bags:`);
      for (const b of bags) console.log(`  ${b}`);
    }
    console.log("");
    return primary ? 0 : 5;
  } finally {
    await peer.disconnect();
  }
}

const SUBCOMMANDS: Readonly<Record<string, { handler: WikiSubcommand; summary: string }>> = {
  "list":  { handler: cmdWikiList,  summary: "Enumerate rooms registered in the catalog. Needs `lares serve`." },
  "which": { handler: cmdWikiWhich, summary: "Recipe-presence query — list bags holding a tiddler. Needs `lares serve`." },
};

function printWikiHelp(): void {
  console.log("lares wiki <verb> [args...]\n");
  console.log("Verbs:");
  for (const [verb, entry] of Object.entries(SUBCOMMANDS)) {
    console.log(`  ${verb.padEnd(10)} ${entry.summary}`);
  }
  console.log("\nMore verbs land in E.5+ (init, open, sync, pin, unpin,");
  console.log("add-bag, remove-bag, epoch, rotate-recipe, prune-stale).");
}

export async function cmdWiki(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  if (!verb || verb === "help" || args.flags["help"]) {
    printWikiHelp();
    return verb ? 0 : 2;
  }
  const entry = SUBCOMMANDS[verb];
  if (!entry) {
    console.error(`lares wiki: unknown verb "${verb}". Run \`lares wiki help\` for the list.`);
    return 2;
  }
  const inner: ParsedArgs = {
    command:    "wiki",
    positional: args.positional.slice(1),
    options:    args.options,
    flags:      args.flags,
  };
  return await entry.handler(inner);
}
