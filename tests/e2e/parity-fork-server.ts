/**
 * parity-fork-server — the OTHER door: a stock `tiddlywiki --listen` from the fork, carrying the
 * packed plugin, for the parity witnesses that hold a lararium island and a TiddlyWiki server to
 * the same answer.
 *
 * The server boots from a wiki folder the witness assembles (`tiddlers/` + `tiddlywiki.info` + the
 * plugin `.tid`), speaks HTTP on a free port, and is killed by its own PID at the end. Nothing here
 * touches a live hearth or the shared tree.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

export const REPO_ROOT  = new URL("../..", import.meta.url).pathname;
export const TW5_JS     = join(REPO_ROOT, "TiddlyWiki5/tiddlywiki.js");
export const PLUGIN_TID = join(REPO_ROOT, "packages/lararium-tw5/dist-plugin/lares-memetic-wikitext.tid");

/** What the fork door needs before it can open; empty when everything stands. */
export function forkMissing(): string[] {
  const out: string[] = [];
  if (!existsSync(TW5_JS))     out.push(`the fork at ${TW5_JS}`);
  if (!existsSync(PLUGIN_TID)) out.push(`the packed plugin at ${PLUGIN_TID} (pnpm --filter @lararium/tw5 build:plugin)`);
  return out;
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const address = s.address();
      const port = typeof address === "object" && address ? address.port : 0;
      s.close(() => (port ? resolve(port) : reject(new Error("no port"))));
    });
  });
}

export interface Reply { status: number; headers: Headers; body: string }

export interface ForkServer {
  readonly root: string;
  readonly wiki: string;
  readonly base: string;
  readonly http: (method: string, p: string, init?: { body?: string; headers?: Record<string, string> }) => Promise<Reply>;
  readonly log: () => string;
  /** Kill the server by its own PID. The wiki folder stays — a one-shot command may still read it. */
  readonly stop: () => Promise<void>;
  /** Remove the root the witness laid. */
  readonly remove: () => void;
}

/**
 * Lay a wiki folder at `<root>/wiki`: the plugin, the server switches the witnesses ask for
 * (external filters, system tiddlers on the wire), and any tiddler files the caller adds under
 * `tiddlers/` before the server boots.
 */
export function layWikiFolder(root: string, extraTiddlerFiles: Record<string, string> = {}): string {
  const wiki = join(root, "wiki");
  mkdirSync(join(wiki, "tiddlers"), { recursive: true });
  // `retain-original-tiddler-path` is the stock switch that makes the folder loader keep
  // `$:/config/OriginalTiddlerPaths` (boot.js:2348, :2369) — the aside the island keeps always.
  writeFileSync(join(wiki, "tiddlywiki.info"), JSON.stringify({ description: "parity witness", plugins: [], themes: [], build: {}, config: { "retain-original-tiddler-path": true } }));
  copyFileSync(PLUGIN_TID, join(wiki, "tiddlers/lares-memetic-wikitext.tid"));
  writeFileSync(join(wiki, "tiddlers/allow-filters.tid"), "title: $:/config/Server/AllowAllExternalFilters\n\nyes");
  writeFileSync(join(wiki, "tiddlers/sync-system.tid"), "title: $:/config/SyncSystemTiddlersFromServer\n\nyes");
  for (const [rel, text] of Object.entries(extraTiddlerFiles)) {
    const abs = join(wiki, "tiddlers", rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, text);
  }
  return wiki;
}

/** Boot the fork server over a laid wiki folder and wait for its listener. */
export async function bootForkServer(root: string, wiki: string): Promise<ForkServer> {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const log: string[] = [];
  const child: ChildProcess = spawn(process.execPath, [TW5_JS, wiki, "--listen", `port=${port}`, "host=127.0.0.1"], { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (d: Buffer) => log.push(String(d)));
  child.stderr?.on("data", (d: Buffer) => log.push(String(d)));
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`fork server died before listening:\n${log.join("")}`);
    try {
      const r = await fetch(`${base}/status`);
      if (r.ok) break;
    } catch { /* listener not up yet */ }
    if (Date.now() > deadline) throw new Error(`fork server never listened:\n${log.join("")}`);
    await new Promise((res) => setTimeout(res, 100));
  }
  const http = async (method: string, p: string, init: { body?: string; headers?: Record<string, string> } = {}): Promise<Reply> => {
    const headers: Record<string, string> = { ...init.headers };
    if (method !== "GET") headers["x-requested-with"] = "TiddlyWiki";
    const r = await fetch(base + p, { method, headers, body: init.body });
    return { status: r.status, headers: r.headers, body: await r.text() };
  };
  return {
    root, wiki, base, http,
    log: () => log.join(""),
    stop: async () => {
      if (child.exitCode === null) {
        const gone = new Promise<void>((res) => child.once("exit", () => res()));
        child.kill("SIGTERM");
        await Promise.race([gone, new Promise<void>((res) => setTimeout(res, 5_000))]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    },
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}

/** Run a one-shot fork command (`--savetiddlers`, `--render`, …) over a wiki folder; throws on a non-zero exit. */
export function runFork(wiki: string, args: readonly string[]): string {
  const ran = spawnSync(process.execPath, [TW5_JS, wiki, ...args], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(`tiddlywiki ${args.join(" ")} exited ${ran.status}:\n${ran.stderr}`);
  return ran.stdout;
}
