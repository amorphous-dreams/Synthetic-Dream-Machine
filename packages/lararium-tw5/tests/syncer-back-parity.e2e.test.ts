/**
 * THE STOCK SYNCER'S BACK-PARITY FLOW — six legs of `core/modules/syncer.js` measured LIVE against a
 * plain `tiddlywiki --listen` carrying the packed plugin, driven by a real Chromium client running the
 * stock `tiddlyweb` + `filesystem` pair. Nothing of the island, nothing of the daemon.
 *
 * `meme-routes.e2e` measures the DOORS a request reaches. This suite measures the LOOP that issues the
 * requests: what the syncer sends when a root is edited, when a slot child is edited, when either is
 * deleted, when `syncFromServer` pulls a meme a second client changed underneath, what the `revision`
 * and `bag` stamps do to the canonical hash, and which `$:/` tiddlers ride the `$:/config/SyncFilter`.
 *
 * Every vector quotes its wire exchange — the request line the page issued and the status it got — so a
 * reading here names what the syncer DID, never what it was meant to do. A vector standing `test.fails`
 * names the seam in its own title; the day the seam closes the vector flips LOUD.
 *
 * Gate: a missing fork checkout or a browser that will not launch SKIPS LOUDLY. Set `LARES_E2E_TMP` to
 * place the wiki folder; `LARES_TW5_JS` points the same contact at a pristine upstream `tiddlywiki.js`.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const REPO = path.resolve(PKG, "../..");
const TW5_JS = process.env["LARES_TW5_JS"] ?? path.join(REPO, "TiddlyWiki5/tiddlywiki.js");
const PLUGIN_TID = path.join(PKG, "dist-plugin/lares-memetic-wikitext.tid");
const forkPresent = existsSync(TW5_JS) && existsSync(PLUGIN_TID);
if (!forkPresent) {
  console.error(`syncer-back-parity.e2e: SKIPPED — fork or plugin missing (${TW5_JS} · ${PLUGIN_TID})`);
}

/** A framed meme carrying one slot per name. */
const meme = (uri: string, uriPath: string, slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${uri}>>\n\`\`\`toml meta\nuri-path = "${uriPath}"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const p = typeof a === "object" && a ? a.port : 0;
      s.close(() => (p ? resolve(p) : reject(new Error("no port"))));
    });
  });
}

interface Fork { base: string; child: ChildProcess; log: string[] }

/** Lay a wiki folder carrying the packed plugin and the stock client/server sync pair, and boot it. */
async function bootFork(wiki: string, files: Record<string, string>): Promise<Fork> {
  mkdirSync(path.join(wiki, "tiddlers"), { recursive: true });
  writeFileSync(path.join(wiki, "tiddlywiki.info"), JSON.stringify({
    description: "syncer back-parity e2e", plugins: ["tiddlywiki/tiddlyweb", "tiddlywiki/filesystem"], themes: [], build: {},
  }));
  copyFileSync(PLUGIN_TID, path.join(wiki, "tiddlers/lares-memetic-wikitext.tid"));
  for (const [n, t] of Object.entries(files)) writeFileSync(path.join(wiki, n), t);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const log: string[] = [];
  const child = spawn(process.execPath, [TW5_JS, wiki, "--listen", `port=${port}`, "host=127.0.0.1"], { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (d: Buffer) => log.push(String(d)));
  child.stderr?.on("data", (d: Buffer) => log.push(String(d)));
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server died before listening:\n${log.join("")}`);
    try { const r = await fetch(`${base}/status`); if (r.status < 500) break; } catch { /* listener not up yet */ }
    if (Date.now() > deadline) throw new Error(`server never listened:\n${log.join("")}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  return { base, child, log };
}

async function stopFork(fork: Fork | undefined): Promise<void> {
  const child = fork?.child;
  if (child && child.exitCode === null) {
    const gone = new Promise<void>((res) => child.once("exit", () => res()));
    child.kill("SIGTERM");
    await Promise.race([gone, new Promise<void>((res) => setTimeout(res, 5_000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

interface Page {
  goto(url: string): Promise<unknown>;
  evaluate<T, A>(fn: (arg: A) => T, arg?: A): Promise<T>;
  waitForFunction(fn: string, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
  on(event: string, fn: (x: never) => void): void;
  close(): Promise<void>;
}

describe.skipIf(!forkPresent)("★ THE STOCK SYNCER'S BACK-PARITY FLOW — six legs, live over Chromium ★", () => {
  let fork: Fork | undefined;
  let root = "";
  let browser: { close(): Promise<void>; newPage(): Promise<Page> } | undefined;
  let page: Page | undefined;
  /** Every non-GET the page issued, as `METHOD /path -> status`. */
  let wire: string[] = [];

  beforeAll(async () => {
    const tmpRoot = process.env["LARES_E2E_TMP"] ?? tmpdir();
    mkdirSync(tmpRoot, { recursive: true });
    root = mkdtempSync(path.join(tmpRoot, "syncer-back-parity-"));
    fork = await bootFork(path.join(root, "wiki"), {
      // The poll is 60 s by default; a suite that waits that long measures nothing. The throttle is 1 s.
      "tiddlers/poll.tid": "title: $:/config/SyncPollingInterval\n\n1500",
      "tiddlers/throttle.tid": "title: $:/config/SyncThrottleInterval\n\n200",
      // `tiddlers.json` strips `$:/` titles from every answer unless this reads yes, and (f) reads them.
      "tiddlers/sync-system.tid": "title: $:/config/SyncSystemTiddlersFromServer\n\nyes",
    });
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch();
      page = await browser.newPage();
      page.on("response", ((r: { status(): number; request(): { method(): string; url(): string } }) => {
        const req = r.request();
        if (req.method() !== "GET") wire.push(`${req.method()} ${new URL(req.url()).pathname} -> ${r.status()}`);
      }) as never);
      await page.goto(`${fork.base}/`);
      await page.waitForFunction("typeof $tw !== 'undefined' && $tw.syncer && $tw.syncadaptor && $tw.syncadaptor.recipe === 'default'", undefined, { timeout: 30_000 });
    } catch (err) {
      console.error(`syncer-back-parity.e2e: SKIPPED — no browser: ${err instanceof Error ? err.message : String(err)}`);
      browser = undefined; page = undefined;
    }
    const status = JSON.parse(await (await fetch(`${fork.base}/status`)).text()) as { tiddlywiki_version?: string };
    process.stderr.write(`syncer-back-parity.e2e: contact with TiddlyWiki ${status.tiddlywiki_version ?? "?"} at ${TW5_JS}\n`);
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    await stopFork(fork);
    if (root) rmSync(root, { recursive: true, force: true });
  });

  /** The server's whole title list, sorted. */
  const titles = async (): Promise<string[]> => {
    const r = await fetch(`${fork!.base}/recipes/default/tiddlers.json`);
    return (JSON.parse(await r.text()) as { title: string }[]).map((t) => t.title).sort();
  };
  /** One record as stock's `get-tiddler.js` serves it — the envelope stamps included. */
  const shelf = async (title: string): Promise<Record<string, unknown>> => {
    const r = await fetch(`${fork!.base}/recipes/default/tiddlers/${encodeURIComponent(title)}`);
    return r.status === 200 ? JSON.parse(await r.text()) as Record<string, unknown> : { _status: r.status };
  };
  /** The meme door's answer: the recomposed text and the canonical hash. */
  const memeGet = async (memePath: string): Promise<{ status: number; etag: string | null; body: string }> => {
    const r = await fetch(`${fork!.base}/recipes/default/memes/${memePath}`);
    return { status: r.status, etag: r.headers.get("etag"), body: await r.text() };
  };
  /** Let the syncer's task queue drain and at least one poll land. */
  const settle = (ms = 4000): Promise<void> => new Promise((r) => setTimeout(r, ms));
  /** Add or replace a tiddler in the page's wiki — the act a UI save makes. */
  const write = async (fields: Record<string, string>): Promise<void> => {
    await page!.evaluate((f: Record<string, string>) => {
      (globalThis as unknown as { $tw: { wiki: { addTiddler(x: Record<string, string>): void } } }).$tw.wiki.addTiddler(f);
    }, fields);
  };
  const drop = async (title: string): Promise<void> => {
    await page!.evaluate((t: string) => {
      (globalThis as unknown as { $tw: { wiki: { deleteTiddler(x: string): void } } }).$tw.wiki.deleteTiddler(t);
    }, title);
  };
  const under = async (prefix: string): Promise<string[]> => (await titles()).filter((t) => t.startsWith(prefix));

  // ── (a) a meme ROOT edited in the browser and saved ──────────────────────────────────────────────
  test("(a) a framed root saved in the browser rides the charm to `/memes/`; a plain tiddler rides the native door", async () => {
    if (!page) return;
    wire = [];
    await write({ title: "lar:///t/a", type: "text/memetic-wikitext+tiddlywiki", text: meme("lar:///t/a", "t/a", ["a", "b"]) });
    await write({ title: "lar:///t/a-plain", text: "prose" });
    await settle();
    expect(wire).toContain("PUT /recipes/default/memes/lar/t/a -> 200");
    // CONTROL: the plain tiddler beside it took the door it always took.
    expect(wire).toContain("PUT /recipes/default/tiddlers/lar%3A%2F%2F%2Ft%2Fa-plain -> 204");
    expect(await under("lar:///t/a")).toEqual(["lar:///t/a", "lar:///t/a#/a", "lar:///t/a#/b", "lar:///t/a-plain"]);
    expect((await shelf("lar:///t/a"))["text"]).toBe("<<~ kahea ahu #/a>>\n\n<<~ kahea ahu #/b>>");
  }, 60_000);

  // ── (e) the `revision`/`bag` stamps stock's GET lays on ──────────────────────────────────────────
  test("(e) the `revision` and `bag` stamps ride the ENVELOPE — they reach the client and never the record's fields", async () => {
    if (!page) return;
    // The poll loaded the root back down; stock's `get-tiddler.js` stamped both onto the JSON it served.
    const client = await page.evaluate(() => {
      const f = (globalThis as unknown as { $tw: { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } | undefined } } }).$tw.wiki.getTiddler("lar:///t/a")?.fields ?? {};
      return { revision: f["revision"], bag: f["bag"] };
    });
    expect(client).toEqual({ revision: "1", bag: "default" });
    // The record the server holds carries them OUTSIDE `fields` — the envelope, re-stamped per save.
    const record = await shelf("lar:///t/a");
    expect(record["bag"]).toBe("default");
    expect(Object.keys(record["fields"] as Record<string, unknown>)).toEqual(["uri-path"]);
    // The charm hands `/memes/` the TEXT alone, so neither stamp can reach the canonical hash; the
    // child's native save hands both back and the gate strips the anchor `bag`, stock strips `revision`.
    const child = await shelf("lar:///t/a#/a");
    expect(Object.keys(child["fields"] as Record<string, unknown>).sort()).toEqual(["$fragment-parent", "$slot", "uri-path"]);
  }, 60_000);

  // ── (b) a SLOT CHILD edited in the browser and saved ─────────────────────────────────────────────
  test("(b) a slot child saved in the browser rides the NATIVE door; the meme's hash moves, the root never re-cuts, the backstop never fires", async () => {
    if (!page) return;
    const before = await memeGet("lar/t/a");
    wire = [];
    const fields = await page.evaluate(() => {
      const f = (globalThis as unknown as { $tw: { wiki: { getTiddler(t: string): { fields: Record<string, string> } } } }).$tw.wiki.getTiddler("lar:///t/a#/a").fields;
      return { ...f };
    });
    await write({ ...fields, text: "! a EDITED" });
    await settle();
    expect(wire).toContain("PUT /recipes/default/tiddlers/lar%3A%2F%2F%2Ft%2Fa%23%2Fa -> 204");
    const after = await memeGet("lar/t/a");
    // The door the child took never ran the placement law — but the meme's render reads its children
    // live, so the canonical hash moves anyway and the edit shows through `/memes/`.
    expect(after.status).toBe(200);
    expect(after.body).toContain("EDITED");
    expect(after.etag).not.toBe(before.etag);
    // The root's own record never moved: no re-cut, and the backstop reads `framedRootOf` null on a child.
    expect((await shelf("lar:///t/a"))["text"]).toBe("<<~ kahea ahu #/a>>\n\n<<~ kahea ahu #/b>>");
    expect(fork!.log.join("").split("\n").filter((l) => l.includes("[memetic-wikitext]"))).toEqual([]);
  }, 60_000);

  // ── (b) the seam under it: a child whose TEXT carries a head ─────────────────────────────────────
  test.fails("SEAM (b′) a slot child whose text carries a framed head mints a DOUBLE-FRAGMENT record — the charm reads a child's title as a founding", async () => {
    if (!page) return;
    const fields = await page.evaluate(() => {
      const f = (globalThis as unknown as { $tw: { wiki: { getTiddler(t: string): { fields: Record<string, string> } } } }).$tw.wiki.getTiddler("lar:///t/a#/a").fields;
      return { ...f };
    });
    wire = [];
    await write({ ...fields, text: meme("lar:///t/a#/a", "t/a", ["z"]) });
    await settle();
    // MEASURED: `PUT /recipes/default/memes/lar/t/a%23/a -> 200` — `framedRootOf` reads the child's own
    // head, `memePathOf` projects a FRAGMENT onto the door, and the split lands `lar:///t/a#/a#/z`: a
    // title the group law admits and the address grammar never names. A slot child is not a founding.
    expect(await under("lar:///t/a#")).not.toContain("lar:///t/a#/a#/z");
  }, 60_000);

  // ── (c) a DELETE from the browser ────────────────────────────────────────────────────────────────
  test.fails("SEAM (c′) deleting a slot child leaves the root's `kahea` DANGLING — the parent never re-cuts", async () => {
    if (!page) return;
    wire = [];
    await drop("lar:///t/a#/b");
    await settle();
    expect(wire).toContain("DELETE /bags/default/tiddlers/lar%3A%2F%2F%2Ft%2Fa%23%2Fb -> 204");
    expect(await under("lar:///t/a#/b")).toEqual([]);
    // MEASURED: the root's shelf text still calls `<<~ kahea ahu #/b>>`, and `GET /memes/` renders that
    // call UNEXPANDED — the meme carries a call to a record that left.
    expect((await memeGet("lar/t/a")).body).not.toContain("<<~ kahea ahu #/b>>");
  }, 60_000);

  test("(c) deleting a meme root in the browser takes the GROUP with it — `removeMeme`'s law rides the native delete door", async () => {
    if (!page) return;
    wire = [];
    await drop("lar:///t/a");
    await settle();
    expect(wire).toContain("DELETE /bags/default/tiddlers/lar%3A%2F%2F%2Ft%2Fa -> 204");
    // The group leaves together: no orphan stands under the uri, and the meme door answers absent.
    expect(await under("lar:///t/a#")).toEqual([]);
    expect((await memeGet("lar/t/a")).status).toBe(404);
    expect(JSON.parse((await memeGet("lar/t/a")).body === "" ? "[]" : "[]")).toEqual([]);
    // CONTROL: a plain tiddler's delete rides the same door and takes nothing else with it.
    wire = [];
    await drop("lar:///t/a-plain");
    await settle();
    expect(wire).toContain("DELETE /bags/default/tiddlers/lar%3A%2F%2F%2Ft%2Fa-plain -> 204");
    expect(await under("lar:///t/a")).toEqual([]);
  }, 60_000);

  // ── (d) `syncFromServer` pulling a meme a second client changed ──────────────────────────────────
  test.fails("SEAM (d′) the poll lands a meme's group ONE AT A TIME — the root stands fat while its children are still skinny", async () => {
    if (!page) return;
    // Arm a recorder on the wiki's own change bus BEFORE the second client writes.
    await page.evaluate(() => {
      const tw = (globalThis as unknown as { $tw: { wiki: { allTitles(): string[]; getTiddler(t: string): { fields: Record<string, unknown> } | undefined; addEventListener(e: string, f: (c: Record<string, unknown>) => void): void } } }).$tw;
      (globalThis as unknown as { __arrivals: unknown[] }).__arrivals = [];
      tw.wiki.addEventListener("change", () => {
        const group = tw.wiki.allTitles().filter((t) => t.startsWith("lar:///t/d")).sort();
        (globalThis as unknown as { __arrivals: unknown[] }).__arrivals.push(
          group.map((t) => [t, tw.wiki.getTiddler(t)?.fields["text"] === undefined ? "skinny" : "fat"]),
        );
      });
    });
    // THE SECOND CLIENT: a `PUT /memes/` straight at the server, the way another vessel would write.
    const put = await fetch(`${fork!.base}/bags/default/memes/lar/t/d`, {
      method: "PUT", headers: { "x-requested-with": "TiddlyWiki" }, body: meme("lar:///t/d", "t/d", ["p", "q", "r"]),
    });
    expect(put.status).toBe(200);
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      const n = await page.evaluate(() => (globalThis as unknown as { $tw: { wiki: { allTitles(): string[] } } }).$tw.wiki.allTitles().filter((t) => t.startsWith("lar:///t/d")).length);
      if (n === 4) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    await settle(2500);
    const arrivals = await page.evaluate(() => (globalThis as unknown as { __arrivals: [string, string][][] }).__arrivals);
    // MEASURED: `getSkinnyTiddlers` stores all four SKINNY in one batch, then `LoadTiddlerTask` fattens
    // them one at a time — root, then `#/p`, then `#/q`, then `#/r`. A render taken in between reads a
    // root whose every `kahea` points at a record with no text.
    const halfCut = arrivals.filter((g) => g.length === 4 && g[0]![1] === "fat" && g.some(([, s]) => s === "skinny"));
    expect(halfCut).toEqual([]);
  }, 90_000);

  // ── (f) `$:/StoryList` and `$:/config/SyncFilter` ────────────────────────────────────────────────
  test("(f) the plugin creates NO `$:/lares/…` in a stock client, so the syncer never offers one; `$:/StoryList` rides to the server as stock's filter admits", async () => {
    if (!page) return;
    const seen = await page.evaluate(() => {
      const tw = (globalThis as unknown as { $tw: { wiki: { allTitles(): string[]; getTiddlerText(t: string, d: string): string }; syncer: { tiddlerInfo: Record<string, unknown>; isDirty(): boolean } } }).$tw;
      return {
        lares: tw.wiki.allTitles().filter((t) => t.startsWith("$:/lares") || t.startsWith("$:/temp/lares")),
        synced: Object.keys(tw.syncer.tiddlerInfo).filter((t) => t.startsWith("$:/")).sort(),
        filter: tw.wiki.getTiddlerText("$:/config/SyncFilter", ""),
        dirty: tw.syncer.isDirty(),
      };
    });
    // The house tiddlers the plugin creates on an ISLAND have no counterpart in a stock client — nothing
    // under `$:/lares/` or `$:/temp/lares/` stands, so the sync filter's shape never gets tested here.
    expect(seen.lares).toEqual([]);
    // `$:/temp/`, `$:/state/`, `$:/status/` and `$:/boot/` leave by name; `$:/StoryList` does not.
    expect(seen.filter).toContain("-[prefix[$:/temp/]]");
    expect(seen.synced).toContain("$:/StoryList");
    expect(seen.dirty).toBe(false);
    // The server holds ONE story list for every client that ever opened it — `$__StoryList.tid` on disk.
    expect(readdirSync(path.join(root, "wiki/tiddlers"))).toContain("$__StoryList.tid");
  }, 60_000);
});
