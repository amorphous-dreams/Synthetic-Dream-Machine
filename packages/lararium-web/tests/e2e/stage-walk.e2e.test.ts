/**
 * e2e/stage-walk — the stage walk's two halves as they stand (road `L4`, measured 2026-11-01): a staged hearth (a scratch
 * `LAR_ROOT`, founded and unlocked through the test door) and a real Chromium joined to its face through the fleet-join door.
 *
 *   S1 — the node half: a CLI `meme put --recipe default` lands in the daemon wiki's working layer, its carrier projects
 *        under `<root>/wikis/kahua/` (the kahua tree the operator works in), and `meme get --recipe default` reads the same bytes; the repo's tree takes no write.
 *        It doubles as the KNOWN POSITIVE for S3's disk instrument: a write under the root reads as a write.
 *   S2 — a fresh browser joins the hearth's face (offer → request → answer → land), crosses connected, and SUMMONS its own
 *        daemon surface: the one wiki whose recipe stacks this device's working top over the face's kahua stage over canon
 *        (`kahuaRecipe`, daemon-vm-core). The pinned `lares` wiki carries neither `bags/daemon` (where a verb's outcome
 *        lands) nor `bags/kahua` (the twin a shadow needs), so every later step authors into the daemon surface.
 *   S3 — the save route: a NEW tiddler saved in the joined page's daemon surface paints in the page, and nothing reaches the
 *        hearth: no file under `<root>/bags` or `<root>/wikis` moves, and the hearth's canon `bags/lares` holds no such
 *        title. LOAD never lands in canon; a page save that reached the hearth's canon would read red here.
 *
 * THE KAHUA STAGE WALK (the lift-only fleet stage; meme lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage):
 *   S4 — the page PROPOSES its draft: a tiddler the page saves carries a TW5 button whose `$action-setfield` writes the
 *        island's verb tiddler (`lar:///lararium.local.vm/verb/kahua-propose`, `verb`, `lares-dispatch`, `arg-titles`), and
 *        a `$list` renders the verb's outcome back into the pane, so the pane hands over the proposal id. Digests only
 *        cross: before any lift, `<root>/bags/kahua` holds no file, `kahua get` answers null, `meme get` misses.
 *   S5 — the OPERATOR'S HAND lifts: `lares kahua lift <title> --proposal <id>` binds the body by digest; the item
 *        projects at `<root>/bags/kahua/<title path>.tid`; `lares kahua get`, `lares meme get --recipe default` and the
 *        MCP seat's `kahua_get` read the same body.
 *   S6 — the stage reaches the page: the joined page re-edits the draft and the `kahua-shadow` mark casts (a mark needs
 *        the kahua twin beneath the draft); a second propose + lift over the new body clears it (bodies equal).
 *   S7 — CONTROL: a faceless device on the same hearth renders no such title; the hearth's projection carries no
 *        control record (checkpoint, persona act, cap event, seal, binding, intent) under `<root>/bags` or `<root>/wikis`.
 *
 * The daemon wiki stays device-local by ruling (each device keeps its own private working wiki), so no step asks the
 * page to mount the hearth's daemon wiki. The node's own reads decide each step; a timeout only bounds a wait.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { foundStagedHearth, openStaged, stageDir, stagedHearthGroup, type LarInstance } from "../../../../tests/harness/instance.js";
import { mintStagedNexusKey } from "../../../../tests/harness/vessel-key.js";
// The published test route answers the custody form a fresh vessel raises (a harness door; never a person's passphrase).
import { armTestCustody } from "../../../lararium-node/dist/probes/browser-test-custody.js";
import { kahuaFaceFolder, kahuaFaceTag } from "../../../lararium-node/dist/src/bag-paths.js";

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

/** The worn face's folder (`kahua-<tag>`), its tag derived from the hearth's founding group as its persona plane derives it. */
const faceFolder = (): string => kahuaFaceFolder(kahuaFaceTag(stagedHearthGroup(hearth!.root)));
/**
 * WHERE A NODE-SIDE DRAFT PROJECTS: the worn face's kahua working top under the state root (`<root>/wikis/kahua-<tag>`).
 * One helper, so the lane repoints every read when the top moves.
 */
const draftPath = (titlePath: string, ext: string): string => join(hearth!.root, "wikis", faceFolder(), `${titlePath}${ext}`);
/** Where a LIFTED kahua item projects: the face's stage under the state root (`<root>/bags/kahua-<tag>`), sited by title. */
const stagePath = (titlePath: string): string => join(hearth!.root, "bags", faceFolder(), `${titlePath}.tid`);

/** Poll a predicate on the hearth's disk or CLI to a bound; answer its last reading. */
async function settle<T>(read: () => T | Promise<T>, done: (v: T) => boolean, ms = 30_000): Promise<T> {
  const deadline = performance.now() + ms;
  for (;;) {
    const v = await read();
    if (done(v) || performance.now() > deadline) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * CONTROL RECORDS NEVER PROJECT. Every file under the hearth's `bags/` and `wikis/` names a content title; a title in a
 * control plane (a checkpoint, a persona act, a cap event, a seal, a binding, an intent entry, a verb outcome) under
 * either tree reads as a leak of the control plane onto disk.
 */
const CONTROL_TITLE = /checkpoint|persona[-_/]?act|cap[-_/]?event|\/seal|binding|intent|outcomes?\/|summons|delegation|\$:\//i;
function controlRecordsOnDisk(): string[] {
  return [...filesUnder(join(hearth!.root, "bags")), ...filesUnder(join(hearth!.root, "wikis"))].filter((f) => {
    const rel = f.slice(hearth!.root.length);
    const title = /^title: (.*)$/m.exec((() => { try { return readFileSync(f, "utf8").slice(0, 4000); } catch { return ""; } })())?.[1] ?? "";
    return CONTROL_TITLE.test(rel) || CONTROL_TITLE.test(title);
  }).map((f) => f.slice(hearth!.root.length));
}

/** Author a NEW tiddler in the joined page through its own toolbar and editor; answer once the body paints. */
async function authorInPage(page: Page, title: string, body: string): Promise<void> {
  const NEW_TIDDLER = '[class*="Buttons%2Fnew-tiddler"][data-lar-rid]';
  expect(await page.waitForFunction((s) => !!document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.querySelector(s),
    NEW_TIDDLER, { timeout: WAIT }).then(() => true).catch(() => false), `no new-tiddler button painted in the pane\n${tail()}`).toBe(true);
  expect(await clickIn(page, NEW_TIDDLER), "the new-tiddler button left the pane before its click").toBe(true);
  expect(await waitPane(page, "tc-tiddler-edit-frame"), "the new tiddler's edit frame never opened").toBe(true);
  expect(await fillIn(page, ".tc-tiddler-edit-frame input.tc-titlebar[data-lar-rid]", title)).toBe(true);
  expect(await fillIn(page, ".tc-tiddler-edit-frame textarea[data-lar-rid]", body)).toBe(true);
  expect(await clickIn(page, '.tc-tiddler-edit-frame [class*="Buttons%2Fsave"][data-lar-rid]'), "no save button in the edit frame").toBe(true);
}

/** Re-open an existing tiddler's editor in the page, replace its body, save; answer once the new body paints. */
async function reviseInPage(page: Page, title: string, body: string): Promise<void> {
  const frame = `[data-tiddler-title="${title}"]`;
  expect(await clickIn(page, `${frame} [class*="Buttons%2Fedit"][data-lar-rid]`), `no edit button on ${title}\n${tail()}`).toBe(true);
  expect(await waitPane(page, "tc-tiddler-edit-frame"), "the edit frame never opened").toBe(true);
  expect(await fillIn(page, ".tc-tiddler-edit-frame textarea[data-lar-rid]", body)).toBe(true);
  expect(await clickIn(page, '.tc-tiddler-edit-frame [class*="Buttons%2Fsave"][data-lar-rid]'), "no save button in the edit frame").toBe(true);
  expect(await waitPane(page, body), `the revised body never painted\n${tail()}`).toBe(true);
}

/** The draft S3 authored and the walk lifts. */
const DRAFT = { title: "L4/page-new", body: "NEW FROM THE PAGE stage-walk", body2: "REVISED IN THE PAGE stage-walk" };
/**
 * THE PROPOSE TIDDLER the page authors: a TW5 button that dispatches `kahua-propose` for the draft, a dump of every
 * `kahua-propose` outcome's fields, and the shadow mark the draft casts. The operator authors the same by hand in QA.
 */
const PROPOSE_TITLE = "L4/propose";
const PROPOSE_BODY = [
  `<$button class="walk-propose"><$action-setfield $tiddler="lar:///lararium.local.vm/verb/kahua-propose" verb="kahua-propose" lares-dispatch="1" arg-titles="${DRAFT.title}"/>propose</$button>`,
  `<$list filter="[prefix[lar:///ha.ka.ba/bags/daemon/outcomes/]field:verb[kahua-propose]]"><div class="walk-outcome"><$list filter="[all[current]fields[]]" variable="f"><<f>>=<$text text={{{ [all[current]get<f>] }}}/>;</$list></div></$list>`,
  `<$list filter="[[${DRAFT.title}]kahua-shadow[]]" variable="hit"><span class="walk-shadow"><<hit>></span></$list>`,
].join("\n\n");

/** Every DISTINCT proposal id the pane's outcome dumps show, in document order: the pane may paint one outcome twice. */
const proposalIds = async (page: Page): Promise<string[]> => {
  const dumps = await page.evaluate(() => [...(document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.querySelectorAll("div.walk-outcome") ?? [])].map((d) => d.textContent ?? ""));
  return [...new Set(dumps.flatMap((d) => [...d.matchAll(/"id":"([0-9a-f]{64})"/g)].map((m) => m[1]!)))];
};
/** Whether a RENDERED element matches `sel` in the pane: the edit textarea serialises its source, so a substring read lies. */
const paneHas = (page: Page, sel: string) => page.evaluate((s) => !!document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.querySelector(s), sel);
const waitSel = (page: Page, sel: string, present = true) =>
  page.waitForFunction(([s, want]) => !!document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.querySelector(s as string) === want,
    [sel, present] as const, { timeout: WAIT }).then(() => true).catch(() => false);
const shadowed = (page: Page): Promise<boolean> => paneHas(page, "span.walk-shadow");
/** What the shadow span says (the filter's own answer: the title, or an operator's error naming itself). */
const shadowText = (page: Page) => page.evaluate(() => document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.querySelector("span.walk-shadow")?.textContent ?? "");

// ── the MCP seat, spoken to over stdio as a harness does (the shape of e2e/mcp-seat-binds-the-hearth) ─────────────
interface SeatEntry { command: string; args: string[]; env: Record<string, string> }
async function speakToSeat(entry: SeatEntry, call: { name: string; arguments: Record<string, unknown> }): Promise<{ result: unknown; stderr: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env, ...entry.env };
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
    return Promise.race([answer, exited.then(() => null)]);
  };
  let result: unknown = null;
  const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "stage-walk", version: "0" } });
  if (init !== null) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const r = await request("tools/call", call);
    result = r?.["error"] ?? r?.["result"] ?? null;
  }
  child.stdin.end();
  await Promise.race([exited, new Promise<void>((r) => setTimeout(() => { child.kill("SIGKILL"); r(); }, 15_000))]);
  return { result, stderr };
}
function seatPayload(result: unknown): Record<string, unknown> {
  const r = result as { structuredContent?: Record<string, unknown>; content?: Array<{ type: string; text?: string }>; isError?: boolean };
  if (!r || r.isError) throw new Error(`the seat refused: ${JSON.stringify(result)}`);
  if (r.structuredContent) return (r.structuredContent["result"] ?? r.structuredContent) as Record<string, unknown>;
  const text = r.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error(`the seat answered no payload: ${JSON.stringify(result)}`);
  return JSON.parse(text) as Record<string, unknown>;
}
/** The seat `lares home tend` would register for THIS hearth, resolved as the resolver does. */
async function resolveSeat(): Promise<SeatEntry> {
  const prior = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = hearth!.root;
  try {
    const { memorySensoriumDir } = await import(join(REPO, "packages/lararium-node/dist/src/index.js")) as { memorySensoriumDir: () => string };
    mkdirSync(memorySensoriumDir(), { recursive: true });
    const { resolveLaresMcp } = await import(join(REPO, "packages/lares-cli/dist/src/mcp-resolve.js")) as { resolveLaresMcp: (clone: string) => SeatEntry | null };
    const entry = resolveLaresMcp(REPO);
    if (entry === null) throw new Error("the resolver found no MCP seat (no interpreter holding mcp?)");
    return entry;
  } finally {
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  }
}

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
  test("S1 — a CLI put to recipe default projects under <root>/wikis/kahua and reads back the same bytes", async () => {
    const uri = "lar:///t.stage.walk/cli-put";
    const file = join(scratch, "cli.txt");
    writeFileSync(file, "hello from the CLI\n");
    const repoBefore = filesUnder(join(REPO, "wikis")).length;
    const put = await hearth!.cli(["meme", "put", uri, "--recipe", "default", "--file", file, "--json"]);
    expect(put.code, `${put.stdout.slice(-400)}\n${put.stderr.slice(-400)}`).toBe(0);
    const carrier = draftPath("t.stage.walk/cli-put", ".txt");
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
    // THE DAEMON SURFACE: the app shell's universal summon flips #projection to this device's daemon wiki (both surfaces
    // stand mounted; a pure gate flip). The daemon's working-surface wrapper paints above its story as the proof.
    await page.locator("#summon-daemon").click();
    expect(await waitPane(page, "data-lares-surface="), `the daemon surface never painted after the summon\n${tail()}`).toBe(true);
    joined = page;
  });

  test("S3 — a NEW tiddler saved in the joined page paints there, and nothing reaches the hearth's disk or its canon", async () => {
    const page = joined;
    expect(page, "S2 joined no page").not.toBeNull();
    const before = projection();
    const { title, body } = DRAFT;
    // The joined boot re-renders the pane after the crossing stands: `authorInPage` waits for the toolbar's own button to paint.
    await authorInPage(page!, title, body);
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

  let proposal = "";

  test("S4 — the page proposes its draft by digest; CONTROL: before the lift the stage holds no file and no read finds the item", async () => {
    const page = joined;
    expect(page, "S2 joined no page").not.toBeNull();
    await authorInPage(page!, PROPOSE_TITLE, PROPOSE_BODY);
    expect(await waitSel(page!, "button.walk-propose"), `the propose button never painted\n${tail()}`).toBe(true);
    expect(await waitSel(page!, ".tc-tiddler-edit-frame", false), "the edit frame stayed open after the save").toBe(true);
    expect(await shadowed(page!), `a draft with no kahua twin casts no shadow; the span reads: ${await shadowText(page!)}`).toBe(false);
    expect(await clickIn(page!, "button.walk-propose"), "no propose button in the pane").toBe(true);
    expect(await waitSel(page!, "div.walk-outcome"), `the kahua-propose verb wrote no outcome into the pane\n${tail()}`).toBe(true);
    const ids = await settle(() => proposalIds(page!), (v) => v.length > 0, 10_000);
    const dump = await page!.evaluate(() => document.getElementById("projection")?.shadowRoot?.querySelector(".lar-projection")?.querySelector("div.walk-outcome")?.textContent ?? "");
    expect(ids.length, `the outcome names no proposal id:\n${dump.slice(0, 1500)}\n${tail()}`).toBe(1);
    proposal = ids[0]!;
    // Digests only crossed: nothing stands on the stage until the operator's hand lifts.
    expect(existsSync(stagePath(DRAFT.title))).toBe(false);
    expect(filesUnder(join(hearth!.root, "bags", faceFolder()))).toEqual([]);
    const got = await hearth!.cli(["kahua", "get", DRAFT.title]);
    expect(got.code, got.stderr).toBe(0);
    expect((JSON.parse(got.stdout) as { item: unknown }).item).toBeNull();
    const meme = await hearth!.cli(["meme", "get", DRAFT.title, "--recipe", "default"]);
    expect(meme.stdout, meme.stdout.slice(0, 300)).toMatch(/not-found/);
  });

  let seat: SeatEntry | null = null;

  test("S5 — the operator's hand lifts the proposal; the item projects under <root>/bags/kahua and the CLI, the recipe and the MCP seat read it", async () => {
    expect(proposal, "S4 handed over no proposal id").toMatch(/^[0-9a-f]{64}$/);
    const lifted = await hearth!.cli(["kahua", "lift", DRAFT.title, "--proposal", proposal, "--text", DRAFT.body, "--taint", "none"]);
    expect(lifted.code, `${lifted.stdout}\n${lifted.stderr}`).toBe(0);
    const cid = (JSON.parse(lifted.stdout) as { cid: string }).cid;
    expect(cid).toMatch(/^[0-9a-f]{64}$/);
    const at = stagePath(DRAFT.title);
    expect(await settle(() => existsSync(at), (v) => v), `nothing landed at ${at}:\n${filesUnder(join(hearth!.root, "bags")).join("\n")}`).toBe(true);
    const file = readFileSync(at, "utf8");
    expect(file).toContain(`title: ${DRAFT.title}`);
    expect(file).toContain(DRAFT.body);
    const got = await hearth!.cli(["kahua", "get", DRAFT.title]);
    expect(got.code, got.stderr).toBe(0);
    // One standing head: the lift's revision carries the body and the proposal it bound (a fork reads `siblings`).
    expect((JSON.parse(got.stdout) as { item: unknown }).item).toMatchObject({ title: DRAFT.title, status: "standing", heads: [{ text: DRAFT.body, proposal }] });
    const meme = await hearth!.cli(["meme", "get", DRAFT.title, "--recipe", "default", "--json"]);
    expect(meme.code, `${meme.stdout.slice(0, 400)}\n${meme.stderr.slice(0, 400)}`).toBe(0);
    expect((JSON.parse(meme.stdout) as { data: { text: string } }).data.text).toBe(DRAFT.body);
    seat = await resolveSeat();
    expect(seat.env["LAR_ROOT"]).toBe(hearth!.root);
    const said = await speakToSeat(seat, { name: "kahua_get", arguments: { title: DRAFT.title } });
    const item = seatPayload(said.result)["item"] as { status?: string; heads?: Array<{ text?: string }> } | null;
    expect(item?.status, `the seat read ${JSON.stringify(said.result)}`).toBe("standing");
    expect(item?.heads?.map((h) => h.text), `the seat read ${JSON.stringify(said.result)}\n${said.stderr.slice(-800)}`).toEqual([DRAFT.body]);
  }, 180_000);

  test("S6 — the stage reaches the page: a re-edit casts the kahua-shadow mark, and a second propose + lift clears it", async () => {
    const page = joined!;
    // The lifted twin stands under the page's draft once the stage syncs; equal bodies cast no mark.
    expect(await shadowed(page), `equal bodies cast no shadow; the span reads: ${await shadowText(page)}`).toBe(false);
    await reviseInPage(page, DRAFT.title, DRAFT.body2);
    expect(await waitSel(page, "span.walk-shadow"), `the revised draft cast no shadow: the stage never reached the page\n${tail()}`).toBe(true);
    expect(await clickIn(page, "button.walk-propose"), "no propose button in the pane").toBe(true);
    const ids = await settle(() => proposalIds(page), (v) => v.length >= 2, WAIT);
    expect(ids.length, `the second propose wrote no outcome\n${tail()}`).toBe(2);
    const second = ids.find((id) => id !== proposal)!;
    expect(second).toMatch(/^[0-9a-f]{64}$/);
    const lifted = await hearth!.cli(["kahua", "lift", DRAFT.title, "--proposal", second, "--text", DRAFT.body2, "--taint", "none"]);
    expect(lifted.code, `${lifted.stdout}\n${lifted.stderr}`).toBe(0);
    expect(await settle(() => readFileSync(stagePath(DRAFT.title), "utf8"), (v) => v.includes(DRAFT.body2))).toContain(DRAFT.body2);
    expect(await waitSel(page, "span.walk-shadow", false), `the shadow mark stayed after the second lift\n${tail()}`).toBe(true);
    const history = await hearth!.cli(["kahua", "get", DRAFT.title, "--history"]);
    expect((JSON.parse(history.stdout) as { history: unknown[] }).history.length).toBe(2);
  }, 240_000);

  test("S7 — CONTROL: a faceless device on the same hearth never sees the item; no control record projects under <root>/bags or <root>/wikis", async () => {
    const context = await browser!.newContext();
    await armTestCustody(context, "stage-walk-stranger");
    contexts.push(context);
    const stranger = await context.newPage();
    stranger.on("console", (m) => { lines.push(`[stranger] ${m.text()}`); });
    await stranger.goto(`${bannerUrl}&anchor=${bannerAnchor}`);
    expect(await awaitLive(stranger), tail()).toMatch(/^live/);
    // The stranger renders the SAME list the joined page did: a stage title reads as a tiddler only where the stage mounts.
    await authorInPage(stranger, "L4/stranger-reads", `<$list filter="[[${DRAFT.title}]is[tiddler]]"><span class="walk-leak">LEAKED</span></$list><span class="walk-stranger-ready">ready</span>`);
    expect(await waitSel(stranger, "span.walk-stranger-ready"), `the stranger's list never painted\n${tail()}`).toBe(true);
    await new Promise((r) => setTimeout(r, 5_000));
    expect(await paneHas(stranger, "span.walk-leak")).toBe(false);
    expect(controlRecordsOnDisk()).toEqual([]);
    // The daemon stays the control plane, CRDT only: no `bags/daemon` dir ever projects.
    expect(existsSync(join(hearth!.root, "bags/daemon"))).toBe(false);
  }, 240_000);
});
