/**
 * e2e/stage-walk — the stage walk's two halves as they stand (road `L4`, measured 2026-11-01): a staged hearth (a scratch
 * `LAR_ROOT`, founded and unlocked through the test door) and a real Chromium joined to its face through the fleet-join door.
 *
 *   S1 — the node half: a CLI `meme put --recipe default` lands in the daemon wiki's working layer, its carrier projects
 *        under `<root>/wikis/daemon/`, and `meme get --recipe default` reads the same bytes; the repo's tree takes no write.
 *        It doubles as the KNOWN POSITIVE for S3's disk instrument: a write under the root reads as a write.
 *   S2 — a fresh browser joins the hearth's face (offer → request → answer → land) and crosses connected.
 *   S3 — the save route: a NEW tiddler saved in the joined page's active wiki paints in the page, and nothing reaches the
 *        hearth: no file under `<root>/bags` or `<root>/wikis` moves, and the hearth's canon `bags/lares` holds no such
 *        title. LOAD never lands in canon; a page save that reached the hearth's canon would read red here.
 *
 * The daemon wiki stays device-local by ruling (each device keeps its own private working wiki), so no step asks the
 * page to mount the hearth's daemon wiki. The node's own reads decide each step; a timeout only bounds a wait.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { foundStagedHearth, openStaged, stageDir, type LarInstance } from "../../../../tests/harness/instance.js";
import { mintStagedNexusKey } from "../../../../tests/harness/vessel-key.js";
// The published test route answers the custody form a fresh vessel raises (a harness door; never a person's passphrase).
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";

const REPO = resolve(import.meta.dirname, "../../../..");
const WEB_ROOT = join(REPO, "packages/lararium-web/dist");
const RECORD = join(REPO, ".pronaos-build/pronaos-artifact.json");
const WAIT = 120_000;

let hearth: LarInstance | null = null;
let browser: Browser | null = null;
let scratch = "";
let bannerUrl = "";
let bannerAnchor = "";
let joined: Page | null = null;
const contexts: BrowserContext[] = [];
const lines: string[] = [];

/** Every file under `dir`, recursively; an absent dir holds none. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]);
}

/** The hearth root's projection trees, file → mtime: the disk instrument S1 proves and S3 reads. */
const projection = (): Map<string, number> =>
  new Map([...filesUnder(join(hearth!.root, "bags")), ...filesUnder(join(hearth!.root, "wikis"))].map((f) => [f, statSync(f).mtimeMs]));

const tail = (): string => lines.filter((l) => !l.startsWith("Warning: Global assignment")).slice(-80).join("\n");

async function awaitLive(page: Page): Promise<string> {
  return page.waitForFunction(() => {
    const rows = [...document.querySelectorAll("#vessel .row")];
    const t = rows.find((r) => r.querySelector(".k")?.textContent === "status")?.querySelector(".v")?.textContent ?? "";
    return t.startsWith("live") || t.startsWith("boot failed") ? t : false;
  }, undefined, { timeout: WAIT }).then((h) => h.jsonValue() as Promise<string>).catch(() => "never live");
}

/** The projected pane's shadow root, read and clicked through one accessor. */
const pane = (page: Page) => page.evaluate(() => document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.innerHTML ?? "");
const clickIn = (page: Page, sel: string) => page.evaluate((s) => {
  const el = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.querySelector(s) as HTMLElement | null;
  if (!el) return false;
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
  return true;
}, sel);
const fillIn = (page: Page, sel: string, value: string) => page.evaluate(([s, v]) => {
  const el = document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.querySelector(s!) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return false;
  el.value = v!;
  el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  return true;
}, [sel, value]);
const waitPane = (page: Page, needle: string) =>
  page.waitForFunction((n) => (document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.innerHTML ?? "").includes(n),
    needle, { timeout: WAIT }).then(() => true).catch(() => false);

beforeAll(async () => {
  scratch = mkdtempSync(join(stageDir(), "stage-walk-"));
  hearth = await openStaged({
    tag: "stage-walk",
    found: async (cli, root) => { await foundStagedHearth(cli, root, "hearth"); await mintStagedNexusKey(root); },
    daemonEnv: { LAR_PRONAOS_WEB_ROOT: WEB_ROOT, LAR_PRONAOS_ARTIFACT_RECORD: RECORD },
  });
  const deadline = performance.now() + WAIT;
  for (;;) {
    bannerUrl = /^\[lararium\] {3}(https?:\/\/\S+) {3}\(/m.exec(hearth.bootLog())?.[1] ?? "";
    bannerAnchor = /^\[lararium\] floor anchor: ([0-9a-f]{64}) /m.exec(hearth.bootLog())?.[1] ?? "";
    if ((bannerUrl && bannerAnchor) || performance.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true, ...(process.env["LAR_CHROMIUM"] ? { executablePath: process.env["LAR_CHROMIUM"] } : {}) });
}, 600_000);

afterAll(async () => {
  if (scratch) {
    writeFileSync(join(scratch, "hearth.log"), hearth?.bootLog() ?? "");
    writeFileSync(join(scratch, "device.log"), lines.join("\n"));
  }
  for (const c of contexts) await c.close().catch(() => undefined);
  await browser?.close();
  await hearth?.stop();
});

describe("the stage walk: the node half, the join, and the page's save route", () => {
  test("S1 — a CLI put to recipe default projects under <root>/wikis/daemon and reads back the same bytes", async () => {
    const uri = "lar:///t.stage.walk/cli-put";
    const file = join(scratch, "cli.txt");
    writeFileSync(file, "hello from the CLI\n");
    const repoBefore = filesUnder(join(REPO, "wikis")).length;
    const put = await hearth!.cli(["meme", "put", uri, "--recipe", "default", "--file", file, "--json"]);
    expect(put.code, `${put.stdout.slice(-400)}\n${put.stderr.slice(-400)}`).toBe(0);
    const carrier = join(hearth!.root, "wikis/daemon/t.stage.walk/cli-put.txt");
    const deadline = performance.now() + 30_000;
    while (!existsSync(carrier) && performance.now() < deadline) await new Promise((r) => setTimeout(r, 250));
    expect(existsSync(carrier), filesUnder(join(hearth!.root, "wikis")).join("\n")).toBe(true);
    expect(readFileSync(carrier, "utf8")).toBe("hello from the CLI\n");
    const got = await hearth!.cli(["meme", "get", uri, "--recipe", "default", "--json"]);
    expect(got.code, got.stderr).toBe(0);
    expect((JSON.parse(got.stdout) as { data: { text: string } }).data.text).toBe("hello from the CLI\n");
    expect(filesUnder(join(REPO, "wikis")).length).toBe(repoBefore);
  });

  test("S2 — a fresh browser joins the hearth's face through the fleet-join door and crosses connected", async () => {
    const context = await browser!.newContext();
    await armTestCustody(context, "stage-walk");
    contexts.push(context);
    const page = await context.newPage();
    page.on("console", (m) => { lines.push(m.text()); });
    page.on("pageerror", (e) => { lines.push(`[pageerror] ${e.message}`); });
    await page.goto(`${bannerUrl}&anchor=${bannerAnchor}`);
    expect(await awaitLive(page), tail()).toMatch(/^live/);
    const offerFile = join(scratch, "offer.json"), requestFile = join(scratch, "request.json"), answerFile = join(scratch, "answer.json");
    const offered = await hearth!.cli(["fleet", "join", "offer", "--out", offerFile]);
    expect(offered.code, offered.stderr).toBe(0);
    await page.locator("#admit-paste").fill(readFileSync(offerFile, "utf8"));
    await page.locator("#admit-apply").click();
    const minted = await page.waitForFunction(() => {
      const s = document.querySelector("#admit-status")?.textContent ?? "";
      if (s.startsWith("✗")) return { refused: s };
      return s.startsWith("✓ request minted") ? { request: (document.querySelector("#admit-paste") as HTMLTextAreaElement).value } : false;
    }, undefined, { timeout: WAIT }).then((h) => h.jsonValue() as Promise<{ refused?: string; request?: string }>);
    expect(minted.refused, tail()).toBeUndefined();
    writeFileSync(requestFile, minted.request!);
    const relay = new URL(bannerUrl).searchParams.get("relay")!;
    const answered = await hearth!.cli(["fleet", "join", "answer", requestFile, "--sync-url", relay, "--out", answerFile]);
    expect(answered.code, answered.stderr).toBe(0);
    await page.evaluate(() => { (globalThis as { __beforeLand?: boolean }).__beforeLand = true; });
    await page.locator("#admit-paste").fill(readFileSync(answerFile, "utf8"));
    await page.locator("#admit-apply").click();
    await page.waitForFunction(() => (globalThis as { __beforeLand?: boolean }).__beforeLand !== true, undefined, { timeout: WAIT, polling: 250 }).catch(() => null);
    expect(await awaitLive(page), tail()).toMatch(/^live/);
    const standing = await page.waitForFunction(() => document.querySelector('[data-live-status="connection"]')?.getAttribute("data-standing") === "connected",
      undefined, { timeout: WAIT }).then(() => "connected").catch(() => "not connected");
    expect(standing, tail()).toBe("connected");
    joined = page;
  });

  test("S3 — a NEW tiddler saved in the joined page paints there, and nothing reaches the hearth's disk or its canon", async () => {
    const page = joined;
    expect(page, "S2 joined no page").not.toBeNull();
    const before = projection();
    const title = "L4/page-new", body = "NEW FROM THE PAGE stage-walk";
    expect(await clickIn(page!, '[class*="Buttons%2Fnew-tiddler"][data-lar-rid]'), "no new-tiddler button in the pane").toBe(true);
    expect(await waitPane(page!, "tc-tiddler-edit-frame"), "the new tiddler's edit frame never opened").toBe(true);
    expect(await fillIn(page!, ".tc-tiddler-edit-frame input.tc-titlebar[data-lar-rid]", title)).toBe(true);
    expect(await fillIn(page!, ".tc-tiddler-edit-frame textarea[data-lar-rid]", body)).toBe(true);
    expect(await clickIn(page!, '.tc-tiddler-edit-frame [class*="Buttons%2Fsave"][data-lar-rid]'), "no save button in the edit frame").toBe(true);
    expect(await waitPane(page!, body), `the saved body never painted\n${tail()}`).toBe(true);
    expect(await pane(page!)).toContain(`data-tiddler-title="${title}"`);
    // A bound for the sync and the projector to act, were the save to reach the hearth at all (S1 proved the instrument).
    await new Promise((r) => setTimeout(r, 8_000));
    const after = projection();
    const moved = [...after].filter(([f, t]) => before.get(f) !== t).map(([f]) => f.slice(hearth!.root.length));
    expect(moved, "a page save moved files under the hearth's projection").toEqual([]);
    const holding = [...after.keys()].filter((f) => { try { return readFileSync(f, "utf8").includes(body); } catch { return false; } });
    expect(holding).toEqual([]);
    for (const args of [["meme", "get", title, "--bag", "lares"], ["meme", "get", title, "--recipe", "default"]] as const) {
      const r = await hearth!.cli(args);
      expect(r.code, `${args.join(" ")}: ${r.stdout.slice(0, 300)}`).toBe(3);
      expect(r.stdout).toMatch(/not-found/);
    }
  });
});
