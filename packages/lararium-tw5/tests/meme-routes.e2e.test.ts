/**
 * THE CONTACT — the meme routes meet a REAL plain-TiddlyWiki server from the fork.
 *
 * Boots `TiddlyWiki5/tiddlywiki.js <wikifolder> --listen` with the packed plugin standing in the
 * wiki folder, then speaks HTTP: the server's own route table, CSRF gate, body reader and
 * `state.params` carry each request into the skins — nothing faked beneath them. The unit suite
 * (`meme-routes.test.ts`) drives the handlers over a Map; this suite proves the assumptions that
 * suite cannot: how the fork hands over the body, the params, the pathname.
 *
 * The CONTROL measures the defect the routes exist to cure: the native tiddler PUT of the same meme
 * text lands ONE unsplit tiddler. The container law rides live too: `default` names THE HOST'S
 * ANCHOR — the one wiki here — and any other recipe or bag answers 404.
 *
 * Gate: a missing fork checkout SKIPS LOUDLY (a named skip, a stderr line), never silently.
 * Set `LARES_E2E_TMP` to place the wiki folder; the OS temp dir stands otherwise.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { memePathOf } from "../src/place-meme.js";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const REPO = path.resolve(PKG, "../..");
const TW5_JS = path.join(REPO, "TiddlyWiki5/tiddlywiki.js");
const PLUGIN_TID = path.join(PKG, "dist-plugin/lares-memetic-wikitext.tid");

const URI = "lar:///t/x";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

/** A port the OS hands out free right now. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const address = s.address();
      const port = typeof address === "object" && address ? address.port : 0;
      s.close(() => (port ? resolve(port) : reject(new Error("no port"))));
    });
  });
}

interface Reply { status: number; headers: Headers; body: string }

const forkPresent = existsSync(TW5_JS) && existsSync(PLUGIN_TID);
if (!forkPresent) {
  console.error(`meme-routes.e2e: SKIPPED — fork or plugin missing (${TW5_JS} · ${PLUGIN_TID})`);
}

describe.skipIf(!forkPresent)("★ THE CONTACT — meme routes on a live plain-TiddlyWiki server ★", () => {
  let child: ChildProcess;
  let base = "";
  let root = "";
  const log: string[] = [];

  const http = async (method: string, p: string, init: { body?: string; headers?: Record<string, string> } = {}): Promise<Reply> => {
    const headers: Record<string, string> = { ...init.headers };
    if (method !== "GET") headers["x-requested-with"] = "TiddlyWiki";
    const r = await fetch(base + p, { method, headers, body: init.body });
    return { status: r.status, headers: r.headers, body: await r.text() };
  };
  const titles = async (): Promise<string[]> => {
    const r = await http("GET", "/recipes/default/tiddlers.json");
    return (JSON.parse(r.body) as { title: string }[]).map((t) => t.title).sort();
  };
  const memePath = (name = "default", kind: "bags" | "recipes" = "bags", uri = URI): string =>
    memePathOf(uri, { kind, name })!;

  beforeAll(async () => {
    const tmpRoot = process.env["LARES_E2E_TMP"] ?? tmpdir();
    mkdirSync(tmpRoot, { recursive: true });
    root = mkdtempSync(path.join(tmpRoot, "meme-routes-e2e-"));
    const wiki = path.join(root, "wiki");
    mkdirSync(path.join(wiki, "tiddlers"), { recursive: true });
    writeFileSync(path.join(wiki, "tiddlywiki.info"), JSON.stringify({ description: "meme-routes e2e", plugins: [], themes: [], build: {} }));
    copyFileSync(PLUGIN_TID, path.join(wiki, "tiddlers/lares-memetic-wikitext.tid"));
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [TW5_JS, wiki, "--listen", `port=${port}`, "host=127.0.0.1"], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout?.on("data", (d: Buffer) => log.push(String(d)));
    child.stderr?.on("data", (d: Buffer) => log.push(String(d)));
    // Poll the listener rather than wait a duration; a child that died ends the poll with its log.
    const deadline = Date.now() + 30_000;
    for (;;) {
      if (child.exitCode !== null) throw new Error(`server died before listening:\n${log.join("")}`);
      try {
        const r = await fetch(`${base}/status`);
        if (r.ok) break;
      } catch { /* listener not up yet */ }
      if (Date.now() > deadline) throw new Error(`server never listened:\n${log.join("")}`);
      await new Promise((res) => setTimeout(res, 100));
    }
  }, 60_000);

  afterAll(async () => {
    if (child && child.exitCode === null) {
      const gone = new Promise<void>((res) => child.once("exit", () => res()));
      child.kill("SIGTERM");
      await Promise.race([gone, new Promise<void>((res) => setTimeout(res, 5_000))]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("PUT a framed meme → 200 ingest, the records born; GET → the meme back under an ETag", async () => {
    const put = await http("PUT", memePath(), { body: meme(["a", "b"]) });
    expect(put.status, put.body).toBe(200);
    expect(JSON.parse(put.body).decision).toBe("ingest");
    expect(put.headers.get("etag")).toMatch(/^"sha256:/);
    expect(await titles()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);

    const get = await http("GET", memePath());
    expect(get.status).toBe(200);
    expect(get.headers.get("content-type")).toMatch(/memetic-wikitext/);
    expect(get.headers.get("etag")).toBe(put.headers.get("etag"));
    expect(get.body).toContain("<<~ ahu #b>>");
  });

  test("★ PUT over a STALE If-Match → 412 and nothing changed ★", async () => {
    const stale = (await http("GET", memePath())).headers.get("etag")!;
    const moved = await http("PUT", memePath(), { body: meme(["a", "b", "c"]) });
    expect(moved.status).toBe(200);
    const before = await titles();

    const r = await http("PUT", memePath(), { body: meme(["a", "z"]), headers: { "if-match": stale } });
    expect(r.status, r.body).toBe(412);
    expect(JSON.parse(r.body).decision).toBe("conflict");
    expect(await titles()).toEqual(before);
    expect((await http("GET", memePath())).headers.get("etag")).toBe(moved.headers.get("etag"));

    // The current base lets the same edit through.
    const ok = await http("PUT", memePath(), { body: meme(["a", "z"]), headers: { "if-match": moved.headers.get("etag")! } });
    expect(ok.status, ok.body).toBe(200);
    expect(await titles()).toEqual([URI, `${URI}#/a`, `${URI}#/z`]);
  });

  test("PUT a meme with content stranded past ETX → 422, records untouched", async () => {
    const before = await titles();
    const stranded = meme(["a"]).replace("<<^ code=\"&#x0003;\">>\n", "<<^ code=\"&#x0003;\">>\n<<~ ahu #edges>>\n\n* x\n\n<<~/ahu>>\n");
    const r = await http("PUT", memePath(), { body: stranded });
    expect(r.status, r.body).toBe(422);
    expect(await titles()).toEqual(before);
  });

  test("a malformed path → 400 on both skins", async () => {
    // The body proves the SKIN answered, not the server's no-route floor or a URL-parser rewrite.
    const put = await http("PUT", "/bags/default/memes/lar/t/%E0%A4%A", { body: meme(["a"]) });
    expect([put.status, put.body]).toEqual([400, "malformed meme path"]);
    const get = await http("GET", "/bags/default/memes/lar/t/%E0%A4%A");
    expect([get.status, get.body]).toEqual([400, "malformed meme path"]);
  });

  test("★ THE CONTAINER LAW: a bag or recipe the server cannot name answers 404 and swallows nothing ★", async () => {
    const before = await titles();
    for (const [kind, name] of [["bags", "other"], ["recipes", "other"], ["bags", "Default"]] as const) {
      const put = await http("PUT", memePath(name, kind, "lar:///t/stray"), { body: meme(["a"]).replaceAll("t/x", "t/stray") });
      expect(put.status, `${kind}/${name} PUT: ${put.body}`).toBe(404);
      expect(put.body.split("\n").filter(Boolean)).toHaveLength(1);
      const get = await http("GET", memePath(name, kind));
      expect(get.status, `${kind}/${name} GET`).toBe(404);
      // The skin's own refusal names the container — the server's no-route 404 carries no body.
      expect(get.body).toContain(name);
    }
    expect(await titles()).toEqual(before);
    // `recipes/default` reads the anchor the same as `bags/default`.
    expect((await http("GET", memePath("default", "recipes"))).status).toBe(200);
  });

  test("CONTROL (measured): the native tiddler PUT of the same meme text lands ONE unsplit tiddler", async () => {
    const title = "lar:///t/native";
    const text = meme(["a", "b"]).replaceAll("t/x", "t/native");
    const r = await http("PUT", `/recipes/default/tiddlers/${encodeURIComponent(title)}`, {
      body: JSON.stringify({ title, text, type: "text/memetic-wikitext+tiddlywiki" }),
    });
    expect(r.status).toBe(204);
    const born = (await titles()).filter((t) => t.startsWith(title));
    expect(born).toEqual([title]);
    // The route splits the SAME text into its records.
    const routed = await http("PUT", memePath("default", "bags", title), { body: text });
    expect(routed.status, routed.body).toBe(200);
    expect((await titles()).filter((t) => t.startsWith(title))).toEqual([title, `${title}#/a`, `${title}#/b`]);
  });
});
