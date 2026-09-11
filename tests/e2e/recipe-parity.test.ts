/**
 * recipe-parity — the same meme, placed and read through a RECIPE on both doors, answers the same
 * canonical bytes and the same `canonicalHash`.
 *
 *   server:  PUT /recipes/default/memes/… · GET /recipes/default/memes/…   (a live fork `--listen`)
 *   island:  lares meme put --recipe lares · lares meme get --recipe lares (a staged vessel)
 *
 * On the server the wiki IS the stack; on the island the recipe is a stack of bags and the verb
 * pair writes its designated bag and reads it back (routes/get-meme.ts states the law). The bytes a
 * reader gets MUST NOT depend on which door it came through: the canonical carrier is one text, and
 * its hash is the merge base every writer hands back.
 *
 * Both doors are real. The witness skips LOUDLY when either cannot open.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { targetInstance, awaitRendezvous, stageDir, type LarInstance } from "../harness/instance.js";
import { bootForkServer, forkMissing, layWikiFolder, REPO_ROOT, type ForkServer } from "./parity-fork-server.js";

const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const PATH = "t/parity/recipe";
const URI  = `lar:///${PATH}`;
const SERVER_PATH = `/recipes/default/memes/lar/${PATH}`;

const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "${PATH}"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

function missing(): string[] {
  const out: string[] = [...forkMissing()];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness writes, and never writes to a live hearth");
  return out;
}

const gaps = missing();
if (gaps.length > 0) console.error(`recipe-parity: SKIPPED — missing ${gaps.join("; ")}`);

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

let lar: LarInstance;
let fork: ForkServer;
let scratch = "";

describe.skipIf(gaps.length > 0)("★ RECIPE PARITY — one meme, two doors, one canonical text ★", () => {
  beforeAll(async () => {
    const forkRoot = mkdtempSync(join(stageDir(), "recipe-parity-fork-"));
    fork = await bootForkServer(forkRoot, layWikiFolder(forkRoot));
    lar = await targetInstance();
    scratch = join(lar.root, "witness");
    mkdirSync(scratch, { recursive: true });
    writeFileSync(join(scratch, "ab.mem"), meme(["a", "b"]));
    const bound = await awaitRendezvous(lar);
    if (!bound) throw new Error(`the staged daemon reached live but bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
  }, 200_000);
  afterAll(async () => {
    if (fork) { await fork.stop(); fork.remove(); }
    if (lar) await lar.stop();
  });

  let serverText = "";
  let serverHash = "";
  let islandText = "";
  let islandHash = "";

  test("the server: PUT then GET on recipes/default hands back the canonical carrier under its hash", async () => {
    const put = await fork.http("PUT", SERVER_PATH, { body: meme(["a", "b"]) });
    expect(put.status, put.body).toBe(200);
    const get = await fork.http("GET", SERVER_PATH);
    expect(get.status).toBe(200);
    serverText = get.body;
    serverHash = (get.headers.get("etag") ?? "").replace(/^"|"$/g, "");
    expect(serverHash).toMatch(/^sha256:/);
  });

  test("the island: meme put --recipe then meme get --recipe hands back the canonical carrier under its hash", async () => {
    const put = await lar.cli(["meme", "put", URI, "--recipe", "lares", "--file", join(scratch, "ab.mem"), "--json"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    const get = await lar.cli(["meme", "get", URI, "--recipe", "lares", "--json"]);
    expect(get.json?.["ok"], said(get)).toBe(true);
    const d = get.json?.["data"] as Record<string, unknown>;
    islandText = String(d["text"]);
    islandHash = String(d["canonicalHash"]);
    expect(islandHash).toMatch(/^sha256:/);
  });

  test("★ the two doors answer IDENTICAL bytes and the SAME canonicalHash ★", () => {
    expect(islandText).toBe(serverText);
    expect(islandHash).toBe(serverHash);
  });
});
