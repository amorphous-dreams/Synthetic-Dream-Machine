/**
 * e2e/mirror-boot-makes-no-request: the mirror's boot, from the page's goto to its first full paint, makes no OPTIONS or
 * HEAD request (no saver probes the origin); the control serves a stock TW5 HTML of the pinned submodule the same way and
 * waits on the probe request stock's savers make.
 */
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { chromium, type Browser } from "playwright";
import { foundStagedHearth, openStaged, stageDir, type LarInstance } from "../../../../tests/harness/instance.js";
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const WAIT = 120_000;
let hearth: LarInstance | null = null;
let browser: Browser | null = null;
let scratch = "";
let url = "";
let stock: Server;
let stockUrl = "";
const logs: string[] = [];

beforeAll(async () => {
  scratch = mkdtempSync(join(stageDir(), "mirror-no-request-"));
  hearth = await openStaged({
    tag: "mirror-no-request",
    found: async (cli, root) => { await foundStagedHearth(cli, root, "hearth"); },
    daemonEnv: { LAR_PRONAOS_WEB_ROOT: join(REPO, "packages/lararium-web/dist"), LAR_PRONAOS_ARTIFACT_RECORD: join(REPO, ".pronaos-build/pronaos-artifact.json") },
  });
  const deadline = performance.now() + WAIT;
  for (;;) {
    url = /^\[lararium\] {3}(https?:\/\/\S+) {3}\(/m.exec(hearth.bootLog())?.[1] ?? "";
    if (url || performance.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  const output = join(scratch, "stock");
  execFileSync("node", [join(REPO, "TiddlyWiki5/tiddlywiki.js"), join(REPO, "TiddlyWiki5/editions/empty"), "--output", output, "--build", "index"]);
  const html = readFileSync(join(output, "index.html"));
  stock = createServer((_req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(html); });
  await new Promise<void>(resolve => stock.listen(0, "127.0.0.1", resolve));
  stockUrl = `http://127.0.0.1:${(stock.address() as { port: number }).port}/`;
  browser = await chromium.launch({ headless: true });
}, 600_000);

afterAll(async () => {
  if (scratch) { writeFileSync(join(scratch, "hearth.log"), hearth?.bootLog() ?? ""); writeFileSync(join(scratch, "page.log"), logs.join("\n")); }
  await browser?.close();
  await new Promise<void>(resolve => stock ? stock.close(() => resolve()) : resolve());
  await hearth?.stop();
});

test("mirror-boot-makes-no-request", async () => {
 const context = await browser!.newContext(); await armTestCustody(context, "mirror-no-request"); const page = await context.newPage(); const probes: string[] = [];
 page.on("request", request => { if (["OPTIONS", "HEAD"].includes(request.method())) probes.push(`${request.method()} ${request.url()}`); });
 try { await page.goto(url); await page.waitForFunction(() => document.querySelector("#mirror")?.getAttribute("data-lar-mirror") === "full", undefined, { timeout: WAIT }); expect(probes).toEqual([]); } finally { await context.close(); }
});
test("mirror-boot-makes-no-request CONTROL: stock savers probe", async () => {
 const page = await browser!.newPage(); const probes: string[] = []; page.on("request", request => { if (["OPTIONS", "HEAD"].includes(request.method())) probes.push(`${request.method()} ${request.url()}`); });
 try { const probe = page.waitForRequest(request => ["OPTIONS", "HEAD"].includes(request.method()), { timeout: WAIT }); await page.goto(stockUrl); await probe; expect(probes.length).toBeGreaterThan(0); } finally { await page.close(); }
});
