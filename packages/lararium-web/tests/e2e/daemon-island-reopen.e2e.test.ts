/**
 * e2e/daemon-island-reopen — A BROWSER VESSEL RE-OPENS ITS DAEMON ISLAND IN PROCESS: the worker respawns, the page port reattaches.
 *
 * One boot of a WALK BUILD of the Pronaos (`LAR_WALK_DOOR=1 vite build` into a scratch dir). Only that build carries
 * `window.__larRestartDaemonIsland`; the shipped build never contains the symbol (the node weld greps the default dist for it).
 * The door answers `{ restarts }` once the new island stands.
 *
 *   D0 CONTROL  the page reaches live, the daemon worker stands, and the door is installed.
 *   D1 RED      a restart closes the old daemon worker and spawns a new one (Playwright's worker events), the mirror stays shown
 *               (the page port reattached), and a tiddler written AFTER the restart paints through the new island.
 *   D2          four restarts in a row keep answering, and the live daemon worker count returns to one each time.
 *   D3 CONTROL  the default build's served page carries no door: the same probe reads `undefined` there.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const root = resolve(import.meta.dirname, "../../../..");
const port = Number(process.env.LAR_WEB_DAEMON_REOPEN_PORT ?? 5423);
const baseUrl = `http://127.0.0.1:${port}`;
let preview: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

let walkOut = "";
let preview2: ReturnType<typeof spawn> | undefined;
const port2 = port + 1;
const vite = resolve(root, "packages/lararium-web/node_modules/vite/bin/vite.js");
const serve = async (outDir: string | null, at: number): Promise<ReturnType<typeof spawn>> => {
  const child = spawn(process.execPath, [vite, "preview", "--host", "127.0.0.1", "--port", String(at), "--strictPort", ...(outDir ? ["--outDir", outDir] : [])],
    { cwd: resolve(root, "packages/lararium-web"), stdio: "ignore" });
  let last: unknown;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${at}`)).ok) { last = undefined; break; } } catch (error) { last = error; }
    await new Promise((r) => setTimeout(r, 125));
  }
  assert.equal(last, undefined, `preview did not open on ${at}`);
  return child;
};

beforeAll(async () => {
  walkOut = mkdtempSync(resolve(tmpdir(), "lar-walk-door-"));
  execFileSync(process.execPath, [vite, "build", "--outDir", walkOut, "--emptyOutDir"],
    { cwd: resolve(root, "packages/lararium-web"), env: { ...process.env, LAR_WALK_DOOR: "1" }, stdio: "ignore" });
  preview = await serve(walkOut, port);                // the WALK build carries the door
  preview2 = await serve(null, port2);                 // the default build's dist carries none
  browser = await chromium.launch({ headless: true });
}, 300_000);
afterAll(async () => { await browser?.close(); preview?.kill("SIGTERM"); preview2?.kill("SIGTERM"); if (walkOut) rmSync(walkOut, { recursive: true, force: true }); });

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>;
const live = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll("#phases .phase")].some((p) => p.textContent === "live"), undefined, { timeout: 60_000 });
const restart = (page: Page, reason: string) =>
  page.evaluate((r) => (window as unknown as { __larRestartDaemonIsland: (r: string) => Promise<{ restarts: number }> }).__larRestartDaemonIsland(r), reason);

test("D0-D2 — the worker respawns and the page port reattaches; CONTROL: the door and the first worker stand", { timeout: 300_000 }, async () => {
  const context = await browser.newContext();
  await armTestCustody(context, "daemon-island-reopen");
  const page = await context.newPage();
  const workers = new Set<ReturnType<Page["workers"]>[number]>();
  const closed: string[] = [];
  const opened: string[] = [];
  page.on("worker", (w) => { workers.add(w); opened.push(w.url()); w.on("close", () => { workers.delete(w); closed.push(w.url()); }); });
  const faults: string[] = [];
  page.on("pageerror", (e) => faults.push(`[page] ${e.message}`));
  try {
    await page.goto(baseUrl);
    await live(page);
    await page.waitForFunction(() => document.querySelector("#mirror")?.getAttribute("data-lar-shown") === "mirror", undefined, { timeout: 60_000 });
    assert.equal(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>)["__larRestartDaemonIsland"]), "function", "D0: the loopback page installs the door");
    const daemonUrls = () => opened.filter((u) => /daemon/i.test(u));
    const before = daemonUrls().length;
    assert.ok(before >= 1, "D0: the first daemon worker stood");

    const one = await restart(page, "e2e");
    assert.equal(one.restarts, 1);
    assert.ok(daemonUrls().length > before, "D1: a NEW daemon worker spawned");
    assert.ok(closed.some((u) => /daemon/i.test(u)), "D1: the old daemon worker closed");
    assert.equal(await page.locator("#mirror").getAttribute("data-lar-shown"), "mirror", "D1: the page port reattached, the mirror stays shown");
    const wiki = page.locator("#mirror");
    await wiki.evaluate((host) => (host.shadowRoot!.querySelector('button[title="Create a new tiddler"]') as HTMLElement).click());
    await wiki.locator("input.tc-titlebar").fill("After Island Reopen");
    await page.frameLocator("#mirror iframe").first().locator("textarea").fill("written through the new island");
    await wiki.locator('button[title="Confirm changes to this tiddler"]').click();
    await page.waitForFunction(() => document.querySelector("#mirror")?.shadowRoot?.querySelector(".lar-mirror")?.textContent?.includes("After Island Reopen") ?? false, undefined, { timeout: 30_000 });

    for (let i = 2; i <= 5; i++) {
      const r = await restart(page, `loop-${i}`);
      assert.equal(r.restarts, i);
      const daemons = [...workers].filter((w) => /daemon/i.test(w.url()));
      assert.equal(daemons.length, 1, `D2: exactly one daemon worker stands after restart ${i}`);
    }
    assert.deepEqual(faults, [], "no page error across the restarts");
  } finally { await context.close(); }
});

test("D3 CONTROL — the default build's served page carries no door", { timeout: 120_000 }, async () => {
  const context = await browser.newContext();
  await armTestCustody(context, "daemon-island-reopen-default");
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port2}`);
    await live(page);
    assert.equal(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>)["__larRestartDaemonIsland"]), "undefined");
  } finally { await context.close(); }
});
