/**
 * e2e/mcp-seat-binds-the-hearth — the MCP seat a harness registers reaches THIS hearth (road L3, walk gap G4).
 *
 * A harness spawns the seat from the entry `lares home tend` writes, with nothing of its own in the
 * environment. So the walk spawns exactly what `resolveLaresMcp` hands back, under a process env that names
 * NO root, and speaks MCP to it over stdio as a harness does: `meme_put` with `recipe="default"` lands a
 * meme, and the CLI's `lares meme get --recipe default` reads the same bytes back from the staged hearth.
 *
 * CONTROLS: before the put the CLI answers `not-found`; and the same seat spawned WITHOUT the entry's
 * `LAR_ROOT` reaches no daemon at all (it binds the default vessel, which no one stood), the exact gap the
 * row names.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { openStaged, awaitRendezvous, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const RESOLVER = join(REPO_ROOT, "packages/lares-cli/dist/src/mcp-resolve.js");
const NODE_DIST = join(REPO_ROOT, "packages/lararium-node/dist/src/index.js");

const PATH = "t.witness.seat/hearth";
const URI = `lar:///${PATH}`;
const MEME =
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${PATH}"\n\`\`\`\n\n` +
  `<<~ ahu #/seat>>\n\n! the seat reached the hearth\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

const gaps = [CLI_BIN, RESOLVER, NODE_DIST].filter((p) => !existsSync(p)).map((p) => `built ${p} (pnpm build)`);
if (process.env["LAR_TARGET"] === "live") gaps.push("a STAGED target — this walk writes, and never writes to a live hearth");
if (gaps.length > 0) console.error(`mcp-seat-binds-the-hearth: SKIPPED — missing ${gaps.join("; ")}`);

interface Entry { command: string; args: string[]; env: Record<string, string> }

/** A harness's environment: the box's own, with no root of its own named. */
function harnessEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env["LAR_ROOT"];
  return { ...env, ...extra };
}

/** Speak MCP over stdio to one spawned seat: initialize, then each call in turn; resolves the results. */
async function speak(entry: Entry, env: NodeJS.ProcessEnv, calls: Array<{ name: string; arguments: Record<string, unknown> }>):
  Promise<{ results: unknown[]; stderr: string; code: number | null }> {
  const child = spawn(entry.command, entry.args, { env, stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (b) => { stderr += String(b); });
  const pending = new Map<number, (msg: Record<string, unknown>) => void>();
  createInterface({ input: child.stdout }).on("line", (line) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(line) as Record<string, unknown>; } catch { return; }
    const id = msg["id"];
    if (typeof id === "number" && pending.has(id)) { pending.get(id)!(msg); pending.delete(id); }
  });
  const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
  let next = 1;
  const request = (method: string, params: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    const id = next++;
    const answer = new Promise<Record<string, unknown>>((resolve) => pending.set(id, resolve));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    // A seat that dies answers nothing: the exit settles the request instead, and the caller reads stderr.
    return Promise.race([answer, exited.then(() => null)]);
  };
  const results: unknown[] = [];
  const init = await request("initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-seat-walk", version: "0" },
  });
  if (init !== null) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    for (const c of calls) {
      const r = await request("tools/call", c);
      results.push(r?.["error"] ?? r?.["result"] ?? null);
      if (r === null) break;
    }
  }
  child.stdin.end();
  const code = await Promise.race([exited, new Promise<number | null>((r) => setTimeout(() => { child.kill("SIGKILL"); r(null); }, 15_000))]);
  return { results, stderr, code };
}

/** A tool result's structured payload (the seat answers JSON). */
function payload(result: unknown): Record<string, unknown> {
  const r = result as { structuredContent?: Record<string, unknown>; content?: Array<{ type: string; text?: string }>; isError?: boolean };
  if (r.isError) throw new Error(`the tool refused: ${JSON.stringify(r.content)}`);
  if (r.structuredContent) return (r.structuredContent["result"] ?? r.structuredContent) as Record<string, unknown>;
  const text = r.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error(`the tool answered no payload: ${JSON.stringify(result)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

let lar: LarInstance;
let entry: Entry;

describe.skipIf(gaps.length > 0)("★ THE MCP SEAT BINDS THE HEARTH — a harness's seat writes the wiki the CLI reads ★", () => {
  beforeAll(async () => {
    lar = await openStaged({ tag: "mcp-seat" });
    if (!(await awaitRendezvous(lar))) throw new Error(`the staged daemon reached live but bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
    // Resolve the seat as `lares home tend` does, for THIS hearth. The native form gates on a stood memory
    // sensorium (`lares sense setup`); the seat itself opens no store, so the walk stands the directory.
    const prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = lar.root;
    try {
      const { memorySensoriumDir } = await import(NODE_DIST) as { memorySensoriumDir: () => string };
      mkdirSync(memorySensoriumDir(), { recursive: true });
      const { resolveLaresMcp } = await import(RESOLVER) as { resolveLaresMcp: (clone: string) => Entry | null };
      const resolved = resolveLaresMcp(REPO_ROOT);
      if (resolved === null) throw new Error("the resolver found no seat (no interpreter holding mempalace?)");
      entry = resolved;
    } finally {
      if (prior === undefined) delete process.env["LAR_ROOT"];
      else process.env["LAR_ROOT"] = prior;
    }
  }, 180_000);

  afterAll(async () => { await lar?.stop(); });

  test("the entry names this hearth's root", () => {
    expect(entry.env["LAR_ROOT"]).toBe(lar.root);
  });

  test("control: before the put, the CLI answers not-found", async () => {
    const r = await lar.cli(["meme", "get", URI, "--recipe", "default", "--json"]);
    expect(r.code).not.toBe(0);
    expect(`${r.stdout}${r.stderr}`).toMatch(/not-found/);
  });

  test("meme_put with recipe=default through the seat, and `lares meme get --recipe default` read the same bytes", async () => {
    const said = await speak(entry, harnessEnv(entry.env), [
      { name: "meme_put", arguments: { uri: URI, text: MEME, recipe: "default" } },
      { name: "meme_get", arguments: { uri: URI, recipe: "default" } },
    ]);
    expect(said.results.length, `the seat answered ${said.results.length} of 2 calls; stderr:\n${said.stderr.slice(-1500)}`).toBe(2);
    const put = payload(said.results[0]);
    const seatGet = payload(said.results[1]);
    expect(put["decision"], JSON.stringify(put)).not.toBe("conflict");

    const r = await lar.cli(["meme", "get", URI, "--recipe", "default", "--json"]);
    expect(r.code, r.stderr).toBe(0);
    const cli = (JSON.parse(r.stdout) as { data: { text: string; canonicalHash: string } }).data;
    expect(cli.text).toBe(seatGet["text"]);
    expect(cli.canonicalHash).toBe(seatGet["canonicalHash"]);
    expect(cli.canonicalHash).toBe(put["canonicalHash"]);
  }, 120_000);

  test("control: the same seat without the entry's LAR_ROOT reaches no daemon", async () => {
    const said = await speak(entry, harnessEnv({ ...entry.env, LAR_ROOT: "" }), [
      { name: "meme_get", arguments: { uri: URI, recipe: "default" } },
    ]);
    expect(said.code).not.toBe(0);
    expect(said.stderr).toMatch(/no lares daemon/);
  }, 60_000);
});
