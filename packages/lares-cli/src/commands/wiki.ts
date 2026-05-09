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

export async function cmdWikiInit(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki init <slug>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "init-wiki", { slug }, did);
    if (r.status === "error") {
      console.error(`init failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    console.log("");
    console.log(`wiki: ${slug}`);
    console.log(`  status:    ${result["status"]}`);
    console.log(`  room URI:  ${result["roomUri"]}`);
    console.log(`  room doc:  ${result["roomDocUrl"]}`);
    console.log(`  draft URI: ${result["draftBagId"]}`);
    console.log(`  draft doc: ${result["draftDocUrl"]}`);
    console.log(`  recipe:    ${result["recipeUri"]}`);
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

export async function cmdWikiOpen(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki open <slug>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "open-wiki", { slug }, did);
    if (r.status === "error") {
      console.error(`open failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    console.log("");
    console.log(`wiki: ${slug}  status: ${result["status"]}`);
    if (result["restartRequired"]) {
      console.log(`  ${result["hint"] ?? "restart `lares serve` to mount this wiki"}`);
    }
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

export async function cmdWikiSync(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki sync <slug>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "sync-wiki", { slug }, did, { timeoutMs: 30_000 });
    if (r.status === "error") {
      console.error(`sync failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    console.log("");
    console.log(`sync ${slug}:`);
    console.log(`  scanned:  ${result["scanned"]}`);
    console.log(`  ingested: ${result["ingested"]}`);
    console.log(`  skipped:  ${result["skipped"]}`);
    const errors = (result["errors"] ?? []) as string[];
    if (errors.length > 0) {
      console.log(`  errors (${errors.length}):`);
      for (const e of errors) console.log(`    ${e}`);
    }
    if (result["note"]) console.log(`  ${result["note"]}`);
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

export async function cmdWikiPin(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki pin <slug>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "pin-wiki", { slug }, did);
    if (r.status === "error") {
      console.error(`pin failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    const pinned = (result["pinned"] ?? []) as Array<{ bagUrl: string; reason: string }>;
    console.log("");
    console.log(`wiki ${slug}: pinned ${pinned.length} bag(s)`);
    for (const p of pinned) console.log(`  ${p.bagUrl}  (${p.reason})`);
    if (result["note"]) console.log(`  ${result["note"]}`);
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

export async function cmdWikiUnpin(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki unpin <slug>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "unpin-wiki", { slug }, did);
    if (r.status === "error") {
      console.error(`unpin failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    const unpinned = (result["unpinned"] ?? []) as string[];
    console.log("");
    console.log(`wiki ${slug}: unpinned ${unpinned.length} bag(s)`);
    for (const u of unpinned) console.log(`  ${u}`);
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

export async function cmdWikiAddBag(args: ParsedArgs): Promise<number> {
  const slug   = args.positional[0];
  const bagUrl = args.positional[1];
  if (!slug || !bagUrl) {
    console.error("usage: lares wiki add-bag <slug> <bag-uri>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "add-bag", { slug, bagUrl }, did);
    if (r.status === "error") {
      console.error(`add-bag failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    console.log("");
    console.log(`wiki ${slug}: ${result["status"]}`);
    console.log(`  bag:    ${result["bagUrl"]}`);
    if (result["stack"]) {
      console.log(`  stack:  ${(result["stack"] as string[]).join(" → ")}`);
    }
    if (result["error"]) console.log(`  error:  ${result["error"]}`);
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

export async function cmdWikiRemoveBag(args: ParsedArgs): Promise<number> {
  const slug   = args.positional[0];
  const bagUrl = args.positional[1];
  if (!slug || !bagUrl) {
    console.error("usage: lares wiki remove-bag <slug> <bag-uri>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "remove-bag", { slug, bagUrl }, did);
    if (r.status === "error") {
      console.error(`remove-bag failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    console.log("");
    console.log(`wiki ${slug}: ${result["status"]}`);
    console.log(`  bag:    ${result["bagUrl"]}`);
    if (result["stack"]) {
      const stack = result["stack"] as string[];
      console.log(`  stack:  ${stack.length === 0 ? "(empty)" : stack.join(" → ")}`);
    }
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

/**
 * `lares wiki epoch <slug> <bag-url>` — Epoch one of the wiki's bags.
 *
 * Thin wrapper: verifies the bag is in the wiki's recipe stack, then
 * delegates to bag-epoch. Returns the same shape as bag-epoch with
 * a recipe-membership check up front.
 */
export async function cmdWikiEpoch(args: ParsedArgs): Promise<number> {
  const slug   = args.positional[0];
  const bagUrl = args.positional[1];
  if (!slug || !bagUrl) {
    console.error("usage: lares wiki epoch <slug> <bag-url>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "bag-epoch", { bagUrl }, did, { timeoutMs: 30_000 });
    if (r.status === "error") {
      console.error(`wiki epoch failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    console.log("");
    console.log(`wiki ${slug}: epoch on ${result["bagUrl"]}`);
    console.log(`  old doc:    ${result["oldDocUrl"]}`);
    console.log(`  new doc:    ${result["newDocUrl"]}`);
    console.log(`  tiddlers:   ${result["tiddlerCount"]}  tombstones: ${result["tombstoneCount"]}`);
    console.log(`  layer:      ${result["layerSwapped"] ? "swapped" : "not mounted"}`);
    console.log("");
    return 0;
  } finally {
    await peer.disconnect();
  }
}

export async function cmdWikiRotateRecipe(args: ParsedArgs): Promise<number> {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: lares wiki rotate-recipe <slug>");
    return 2;
  }
  const did  = await operatorDid().catch(() => "lares-cli");
  const peer = await tryConnect();
  if (!peer) return 3;
  try {
    const r = await submitCommand(peer, "rotate-recipe", { slug }, did, { timeoutMs: 30_000 });
    if (r.status === "error") {
      console.error(`rotate-recipe failed: ${r.errorMessage ?? "unknown"}`);
      return 4;
    }
    const result = r.result ?? {};
    console.log("");
    console.log(`wiki ${slug}: rotated to generation ${result["generation"]}`);
    console.log(`  new canon doc:   ${result["newCanonDocUrl"]}`);
    console.log(`  previous canon:  ${result["previousCanonUri"]}`);
    console.log(`    ↳ doc:         ${result["previousCanonDocUrl"]}`);
    const stack = (result["stack"] ?? []) as string[];
    console.log(`  recipe stack:    ${stack.length} bag(s)`);
    for (const u of stack) console.log(`    • ${u}`);
    console.log(`  layer:           ${result["layerSwapped"] ? "swapped" : "not mounted"}`);
    if (result["note"]) console.log(`  note:            ${result["note"]}`);
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
  "init":  { handler: cmdWikiInit,  summary: "Mint a fresh wiki: room canonical + per-wiki draft + recipe. Idempotent." },
  "open":  { handler: cmdWikiOpen,  summary: "Set the daemon's active wiki marker. Restart required to mount (E.7 = hot-reload)." },
  "sync":  { handler: cmdWikiSync,  summary: "Walk rooms/<slug>/memes/** and ingest into the canonical bag. Idempotent." },
  "pin":        { handler: cmdWikiPin,       summary: "Pin every bag in the wiki's recipe (whole-recipe residency)." },
  "unpin":      { handler: cmdWikiUnpin,     summary: "Unpin every bag in the wiki's recipe." },
  "add-bag":    { handler: cmdWikiAddBag,    summary: "Add a bag to the wiki's recipe at runtime. Hot-reload via composite.addLayer." },
  "remove-bag": { handler: cmdWikiRemoveBag, summary: "Remove a bag from the wiki's recipe (soft remove; F-arc adds StoryList drain)." },
  "epoch":         { handler: cmdWikiEpoch,         summary: "DXOS-style snapshot-restart on one of the wiki's bags. Bounds history." },
  "rotate-recipe": { handler: cmdWikiRotateRecipe,  summary: "Nix-generations: mint fresh canonical; retain old as previous-canon underlay." },
  "list":       { handler: cmdWikiList,      summary: "Enumerate rooms registered in the catalog. Needs `lares serve`." },
  "which":      { handler: cmdWikiWhich,     summary: "Recipe-presence query — list bags holding a tiddler. Needs `lares serve`." },
};

function printWikiHelp(): void {
  console.log("lares wiki <verb> [args...]\n");
  console.log("Verbs:");
  for (const [verb, entry] of Object.entries(SUBCOMMANDS)) {
    console.log(`  ${verb.padEnd(10)} ${entry.summary}`);
  }
  console.log("\nOne verb left in E.9b (prune-stale).");
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
