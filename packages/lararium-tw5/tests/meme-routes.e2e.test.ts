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
 * Set `LARES_E2E_TMP` to place the wiki folder; the OS temp dir stands otherwise. Set `LARES_TW5_JS`
 * to a pristine upstream `tiddlywiki.js` to run the same contact against stock.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { memePathOf } from "../src/place-meme.js";
import { projectSubmission } from "../src/meme-markdown.js";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { digestsEqual, reprDigestOf } from "@lararium/mesh/agile-digest";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const REPO = path.resolve(PKG, "../..");
// `LARES_TW5_JS` points the suite at another TiddlyWiki — a pristine `npm pack tiddlywiki@<ver>` — so the
// plugin proves it drops into stock, not only into the fork.
const TW5_JS = process.env["LARES_TW5_JS"] ?? path.join(REPO, "TiddlyWiki5/tiddlywiki.js");
const PLUGIN_TID = path.join(PKG, "dist-plugin/lares-memetic-wikitext.tid");

const URI = "lar:///t/x";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
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

interface Fork { base: string; child: ChildProcess; log: string[] }

/** Lay a wiki folder carrying the packed plugin and boot the fork's `--listen` over it. */
async function bootFork(wiki: string, args: readonly string[], files: Record<string, string> = {}, plugins: readonly string[] = []): Promise<Fork> {
  mkdirSync(path.join(wiki, "tiddlers"), { recursive: true });
  writeFileSync(path.join(wiki, "tiddlywiki.info"), JSON.stringify({ description: "meme-routes e2e", plugins, themes: [], build: {} }));
  copyFileSync(PLUGIN_TID, path.join(wiki, "tiddlers/lares-memetic-wikitext.tid"));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(wiki, name), text);
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const log: string[] = [];
  const child = spawn(process.execPath, [TW5_JS, wiki, "--listen", `port=${port}`, "host=127.0.0.1", ...args], { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (d: Buffer) => log.push(String(d)));
  child.stderr?.on("data", (d: Buffer) => log.push(String(d)));
  // Poll the listener rather than wait a duration; a child that died ends the poll with its log.
  const deadline = Date.now() + 30_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`server died before listening:\n${log.join("")}`);
    try {
      const r = await fetch(`${base}/status`);
      if (r.status < 500) break;
    } catch { /* listener not up yet */ }
    if (Date.now() > deadline) throw new Error(`server never listened:\n${log.join("")}`);
    await new Promise((res) => setTimeout(res, 100));
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

describe.skipIf(!forkPresent)("★ THE CONTACT — meme routes on a live plain-TiddlyWiki server ★", () => {
  let fork: Fork | undefined;
  let base = "";
  let root = "";

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
    fork = await bootFork(path.join(root, "wiki"), [], {
      // The kind-parity witness asks the server's own filter engine over HTTP; the fork gates external
      // filters behind this switch (get-tiddlers-json.js), so the suite's wiki folder opens it.
      "tiddlers/allow-filters.tid": "title: $:/config/Server/AllowAllExternalFilters\n\nyes",
      // The same route strips `$:/` titles from every answer unless this reads yes — and a partition
      // compared over stripped answers agrees vacuously.
      "tiddlers/sync-system.tid": "title: $:/config/SyncSystemTiddlersFromServer\n\nyes",
    });
    base = fork.base;
    // Name the engine under contact, so a pristine run reads as one in the log. Written to the stream
    // itself: the runner shows a `console.error` from a green file on a red alone, and a CI job greps
    // this line to prove WHICH engine the contact ran against.
    const status = JSON.parse(await (await fetch(`${base}/status`)).text()) as { tiddlywiki_version?: string };
    process.stderr.write(`meme-routes.e2e: contact with TiddlyWiki ${status.tiddlywiki_version ?? "?"} at ${TW5_JS}\n`);
  }, 60_000);

  afterAll(async () => {
    await stopFork(fork);
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
    expect(get.body).toContain("<<~ ahu #/b>>");
  });

  test("★ memes.json lists the roots with the base a writer hands back; ?tree=1 nests the slots; CONTROL: a plain tiddler never lists ★", async () => {
    await http("PUT", `/recipes/default/tiddlers/${encodeURIComponent("lar:///t/prose")}`, { body: JSON.stringify({ title: "lar:///t/prose", text: "plain" }) });
    const r = await http("GET", "/recipes/default/memes.json");
    expect(r.status, r.body).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    const etag = (await http("GET", memePath())).headers.get("etag")!.replace(/^"|"$/g, "");
    expect(JSON.parse(r.body)).toEqual([{ uri: URI, canonicalHash: etag }]);
    const tree = JSON.parse((await http("GET", "/bags/default/memes.json?tree=1")).body) as Array<{ uri: string; slots: unknown[] }>;
    expect(tree).toEqual([{ uri: URI, canonicalHash: etag, slots: [{ slot: "#/a", uri: `${URI}#/a`, slots: [] }, { slot: "#/b", uri: `${URI}#/b`, slots: [] }] }]);
    // The container law rides the listing too.
    expect((await http("GET", "/bags/other/memes.json")).status).toBe(404);
    // The CONTROL leaves through stock's own door, so the shelf reads as the next test expects it.
    expect((await http("DELETE", `/bags/default/tiddlers/${encodeURIComponent("lar:///t/prose")}`)).status).toBe(204);
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

  test("★ `If-None-Match: *` on a standing uri → 412 and nothing moves; on a fresh uri → 200 ingest ★", async () => {
    const before = await titles();
    const standing = (await http("GET", memePath())).headers.get("etag")!;
    const r = await http("PUT", memePath(), { body: meme(["a", "q"]), headers: { "if-none-match": "*" } });
    expect(r.status, r.body).toBe(412);
    expect(JSON.parse(r.body).decision).toBe("conflict");
    expect(await titles()).toEqual(before);
    expect((await http("GET", memePath())).headers.get("etag")).toBe(standing);
    // A uri nothing stands under founds.
    const fresh = memePathOf("lar:///t/founded", { kind: "bags", name: "default" })!;
    const born = await http("PUT", fresh, {
      body: meme(["a"]).replaceAll(URI, "lar:///t/founded").replace('uri-path = "t/x"', 'uri-path = "t/founded"'),
      headers: { "if-none-match": "*" },
    });
    expect(born.status, born.body).toBe(200);
    expect(JSON.parse(born.body).decision).toBe("ingest");
  });

  test("★ both skins carry `Repr-Digest` (RFC 9530) beside the ETag — one digest, two spellings ★", async () => {
    const get = await http("GET", memePath());
    const etag = get.headers.get("etag")!.replace(/^"|"$/g, "");
    const repr = get.headers.get("repr-digest")!;
    expect(repr).toMatch(/^sha-256=:[A-Za-z0-9+/]+=*:$/);
    expect(repr).toBe(reprDigestOf(etag));
    expect(digestsEqual(repr, etag)).toBe(true);
    const put = await http("PUT", memePath(), { body: get.body, headers: { "if-match": get.headers.get("etag")! } });
    expect(put.status, put.body).toBe(200);
    expect(put.headers.get("repr-digest")).toBe(repr);
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

  test("★ DELETE /bags/default/memes/… → 204, the group gone; `/recipes/` → 404; a stale If-Match → 412 ★", async () => {
    const uri = "lar:///t/gone";
    const text = meme(["a", "b"]).replaceAll("t/x", "t/gone");
    expect((await http("PUT", memePath("default", "bags", uri), { body: text })).status).toBe(200);
    // CONTROL: a neighbour under the same prefix, never a child.
    const neighbour = "lar:///t/gone-not";
    await http("PUT", `/recipes/default/tiddlers/${encodeURIComponent(neighbour)}`, { body: JSON.stringify({ title: neighbour, text: "stays" }) });
    expect((await titles()).filter((t) => t.startsWith(uri))).toEqual([uri, `${uri}#/a`, `${uri}#/b`, neighbour]);
    const stale = (await http("GET", memePath("default", "bags", uri))).headers.get("etag")!;
    expect((await http("PUT", memePath("default", "bags", uri), { body: text.replace("! b", "! b moved") })).status).toBe(200);
    const conflict = await http("DELETE", memePath("default", "bags", uri), { headers: { "if-match": stale } });
    expect(conflict.status, conflict.body).toBe(412);
    const recipes = await http("DELETE", memePath("default", "recipes", uri));
    expect(recipes.status).toBe(404);
    expect((await titles()).filter((t) => t.startsWith(uri))).toHaveLength(4);
    const fresh = (await http("GET", memePath("default", "bags", uri))).headers.get("etag")!;
    const gone = await http("DELETE", memePath("default", "bags", uri), { headers: { "if-match": fresh } });
    expect(gone.status, gone.body).toBe(204);
    expect((await titles()).filter((t) => t.startsWith(uri))).toEqual([neighbour]);
    expect((await http("DELETE", memePath("default", "bags", uri))).status).toBe(404);
  });

  test("★ THE TWO DOORS (a): the native PUT of a framed root refuses with 422 naming the /memes/ door; the door lands it split ★", async () => {
    const title = "lar:///t/native";
    const text = meme(["a", "b"]).replaceAll("t/x", "t/native");
    const before = await titles();
    const r = await http("PUT", `/recipes/default/tiddlers/${encodeURIComponent(title)}`, {
      body: JSON.stringify({ title, text, type: "text/memetic-wikitext+tiddlywiki" }),
    });
    expect(r.status, r.body).toBe(422);
    expect(JSON.parse(r.body).door).toBe(memePath("default", "recipes", title));
    expect(await titles()).toEqual(before);
    // The door splits the SAME text into its records.
    const routed = await http("PUT", memePath("default", "bags", title), { body: text });
    expect(routed.status, routed.body).toBe(200);
    expect((await titles()).filter((t) => t.startsWith(title))).toEqual([title, `${title}#/a`, `${title}#/b`]);
    // CONTROL: a plain tiddler and a carrier-typed slot child (no head) pass the native door.
    const plain = await http("PUT", `/recipes/default/tiddlers/${encodeURIComponent("lar:///t/plain")}`, {
      body: JSON.stringify({ title: "lar:///t/plain", text: "prose" }),
    });
    expect(plain.status).toBe(204);
    const child = await http("PUT", `/recipes/default/tiddlers/${encodeURIComponent(`${title}#/c`)}`, {
      body: JSON.stringify({ title: `${title}#/c`, type: "text/memetic-wikitext+tiddlywiki", text: "! c", fields: { "$slot": "#/c", "$fragment-parent": title } }),
    });
    expect(child.status).toBe(204);
  });

  /**
   * `bag` IS USER SPACE — the native round trip. Stock's `get-tiddler.js` stamps `bag: "default"` OVER
   * the JSON (the TiddlyWeb envelope) and `put-tiddler.js` deletes `revision` alone, so a stock client
   * that loads and saves a record hands the envelope back as a field. The shelf must keep the author's
   * own `bag` and never persist the container's name; `tiddlers.json` reads the shelf unstamped.
   */
  test("★ BAG-STAMP ROUND TRIP: a user `bag` survives stock GET → stock PUT; `default` never lands ★", async () => {
    const title = "lar:///t/npc";
    const native = `/recipes/default/tiddlers/${encodeURIComponent(title)}`;
    const shelf = async (): Promise<Record<string, string> | undefined> => {
      const r = await http("GET", `/recipes/default/tiddlers.json?filter=${encodeURIComponent(`[[${title}]]`)}&exclude=none`);
      return (JSON.parse(r.body) as Record<string, string>[])[0];
    };
    expect((await http("PUT", native, { body: JSON.stringify({ title, text: "an NPC", bag: "mine" }) })).status).toBe(204);
    expect((await shelf())?.["bag"]).toBe("mine");
    // MEASURED (stock): the GET JSON carries the envelope, not the field.
    const loaded = JSON.parse((await http("GET", native)).body) as Record<string, unknown>;
    expect(loaded["bag"]).toBe("default");
    expect(loaded["revision"]).toBeDefined();
    // The stock client saves what it loaded, text edited.
    const saved = await http("PUT", native, { body: JSON.stringify({ ...loaded, text: "an NPC, edited" }) });
    expect(saved.status, saved.body).toBe(204);
    const after = await shelf();
    expect(after?.["text"]).toBe("an NPC, edited");
    expect(after?.["bag"]).toBe("mine");
    // CONTROL: a record that never carried a `bag` gains none from the round trip.
    const bare = "lar:///t/bare";
    const bareNative = `/recipes/default/tiddlers/${encodeURIComponent(bare)}`;
    await http("PUT", bareNative, { body: JSON.stringify({ title: bare, text: "no bag" }) });
    const bareLoaded = JSON.parse((await http("GET", bareNative)).body) as Record<string, unknown>;
    await http("PUT", bareNative, { body: JSON.stringify({ ...bareLoaded, text: "no bag, edited" }) });
    const r = await http("GET", `/recipes/default/tiddlers.json?filter=${encodeURIComponent(`[[${bare}]]`)}&exclude=none`);
    expect((JSON.parse(r.body) as Record<string, string>[])[0]?.["bag"]).toBeUndefined();
  });

  /**
   * THE KIND PARITY — `[lar-kind[]]` on the LIVE fork server answers the same partition TiddlyWiki's
   * own predicates answer (`is[draft]` · `is[system]` · the `$:/temp/` prefixes), over tiddlers that
   * entered by the native PUT door. The draft carries a user-attributed title and a `draft.of` field;
   * the CONTROL carries the prefix and no field.
   */
  test("★ KIND PARITY: `lar-kind[]` on the live server agrees with `is[draft]`-family answers ★", async () => {
    const put = async (fields: Record<string, string>): Promise<void> => {
      const r = await http("PUT", `/recipes/default/tiddlers/${encodeURIComponent(fields["title"]!)}`, { body: JSON.stringify(fields) });
      expect(r.status, r.body).toBe(204);
    };
    await put({ title: "Draft of 'Kind' by Alice", "draft.of": "Kind", "draft.title": "Kind", text: "drafting" });
    await put({ title: "Draft of Beer", text: "a recipe, not a draft" });
    await put({ title: "$:/temp/volatile/kind", text: "" });
    await put({ title: "$:/temp/kind", text: "" });
    await put({ title: "$:/state/folded/kind", text: "hide" });
    await put({ title: "$:/kind/system", text: "" });
    const ask = async (filter: string): Promise<string[]> => {
      const r = await http("GET", `/recipes/default/tiddlers.json?filter=${encodeURIComponent(filter)}`);
      expect(r.status, `${filter}: ${r.body}`).toBe(200);
      return (JSON.parse(r.body) as { title: string }[]).map((t) => t.title).sort();
    };
    const ofKind = (kind: string): Promise<string[]> => ask(`[all[tiddlers]] :filter[lar-kind[]match[${kind}]] +[sort[]]`);
    expect(await ofKind("draft")).toEqual(await ask("[all[tiddlers]is[draft]sort[]]"));
    expect(await ofKind("draft")).toContain("Draft of 'Kind' by Alice");
    expect(await ofKind("content")).toContain("Draft of Beer");
    expect(await ofKind("volatile")).toEqual(await ask("[all[tiddlers]prefix[$:/temp/volatile/]sort[]]"));
    expect(await ofKind("temporary")).toEqual(await ask("[all[tiddlers]prefix[$:/temp/]!prefix[$:/temp/volatile/]sort[]]"));
    expect(await ofKind("personal")).toEqual(await ask("[all[tiddlers]is[system]] :filter[lar-kind[]match[personal]] +[sort[]]"));
    expect(await ofKind("personal")).toContain("$:/state/folded/kind");
    const nonSystemKinds = [...await ofKind("draft"), ...await ofKind("content")].sort();
    expect(nonSystemKinds).toEqual(await ask("[all[tiddlers]!is[system]sort[]]"));
    const systemKinds = [...await ofKind("volatile"), ...await ofKind("temporary"), ...await ofKind("personal"), ...await ofKind("system")].sort();
    expect(systemKinds).toEqual(await ask("[all[tiddlers]is[system]sort[]]"));
  });

  test("★ THE RENDER DOOR: `tiddlywiki --render` on a stock server writes the meme through the house templates ★", async () => {
    // The records the live server holds, text included, land in a fresh wiki folder as native JSON —
    // the door a stock `--render` reads. (A `.mem` file in a wiki folder does not split at boot: the
    // plugin's deserializer registers after the folder loads; the PUT route is the door that splits.)
    const group = (await titles()).filter((t) => t.startsWith(URI));
    expect(group).toEqual([URI, `${URI}#/a`, `${URI}#/z`]);
    // The TiddlyWeb shape nests the non-standard fields under `fields`; flatten it back to a record.
    const records = await Promise.all(group.map(async (title) => {
      const { revision: _rev, bag: _bag, fields, ...known } = JSON.parse((await http("GET", `/recipes/default/tiddlers/${encodeURIComponent(title)}`)).body) as Record<string, string> & { fields?: Record<string, string> };
      return { ...known, ...(fields ?? {}) };
    }));
    const renderWiki = path.join(root, "render");
    mkdirSync(path.join(renderWiki, "tiddlers"), { recursive: true });
    writeFileSync(path.join(renderWiki, "tiddlywiki.info"), JSON.stringify({ description: "render door", plugins: [], themes: [], build: {} }));
    copyFileSync(PLUGIN_TID, path.join(renderWiki, "tiddlers/lares-memetic-wikitext.tid"));
    writeFileSync(path.join(renderWiki, "tiddlers/records.json"), JSON.stringify(records));

    const T = "lar:///ha.ka.ba/lararium/templates/meme";
    const ran = spawnSync(process.execPath, [
      TW5_JS, renderWiki, "--output", path.join(renderWiki, "out"),
      "--render", `[[${URI}]]`, "x.mem", "text/plain", `${T}/mem`,
      "--render", `[[${URI}]]`, "x.md", "text/plain", `${T}/md`,
      "--render", `[[${URI}]]`, "x.md.meta", "text/plain", `${T}/md.meta`,
      "--render", "lar:///ha.ka.ba/lararium/exporters/memetic-wikitext", "export.mem", "text/plain", "", "exportFilter", `[[${URI}#/a]]`,
      "--render", `[[${URI}]]`, "x.html", "text/plain", `${T}/html`,
    ], { encoding: "utf8" });
    expect(ran.status, ran.stderr).toBe(0);
    const out = (name: string): string => readFileSync(path.join(renderWiki, "out", name), "utf8");

    // mem: the recomposed carrier the GET route serves, byte for byte; it deserializes back to the records.
    const served = (await http("GET", memePath())).body;
    expect(out("x.mem")).toBe(served);
    const back = memeticWikitextDeserializer.call({ wiki: {} } as never, out("x.mem"), { title: URI }, CARRIER_TYPE) as Array<{ title: string }>;
    expect(back.map((t) => t.title).filter((t) => !t.includes("#/$")).sort()).toEqual([URI, `${URI}#/a`, `${URI}#/z`]);
    // The Export dropdown's template, rendered the way the plugin build packs itself: the same bytes.
    expect(out("export.mem")).toBe(served);
    // md: the submission pair the CLI emits.
    const pair = projectSubmission(served, { uri: URI });
    expect(out("x.md")).toBe(pair.markdown);
    expect(out("x.md.meta")).toBe(pair.meta);
    expect(out("x.md")).toContain("# a");
    // html: the house static render of the root — the same template the island renders through.
    expect(out("x.html")).toMatch(/^<!doctype html>/);
    expect(out("x.html")).toContain("tc-story-river");
    expect(out("x.html")).toMatch(/<h1[^>]*>a<\/h1>/);
  }, 60_000);
});

/**
 * THE READERS/WRITERS CASE — the server's principal table stands in front of the meme skins exactly
 * as it stands in front of `/tiddlers/`: the method→principal mapping and the authenticator run
 * before any route is chosen. Measured on stock's own path first, asserted as parity on ours.
 */
describe.skipIf(!forkPresent)("★ READERS/WRITERS — the meme skins answer the principal table as `/tiddlers/` does ★", () => {
  let fork: Fork | undefined;
  let root = "";
  const basic = (user: string): Record<string, string> => ({ authorization: `Basic ${Buffer.from(`${user}:pw`).toString("base64")}` });
  const http = async (method: string, p: string, init: { body?: string; headers?: Record<string, string> } = {}): Promise<Reply> => {
    const headers: Record<string, string> = { ...init.headers };
    if (method !== "GET") headers["x-requested-with"] = "TiddlyWiki";
    const r = await fetch(fork!.base + p, { method, headers, body: init.body });
    return { status: r.status, headers: r.headers, body: await r.text() };
  };
  const NATIVE = `/recipes/default/tiddlers/${encodeURIComponent("lar:///t/x")}`;
  const MEME = memePathOf(URI, { kind: "recipes", name: "default" })!;
  const MEME_BAG = memePathOf(URI, { kind: "bags", name: "default" })!;

  beforeAll(async () => {
    const tmpRoot = process.env["LARES_E2E_TMP"] ?? tmpdir();
    mkdirSync(tmpRoot, { recursive: true });
    root = mkdtempSync(path.join(tmpRoot, "meme-routes-auth-"));
    fork = await bootFork(path.join(root, "wiki"), ["readers=(authenticated)", "writers=alice", "credentials=users.csv"], {
      "users.csv": "username,password\nalice,pw\nbob,pw\n",
    });
  }, 60_000);

  afterAll(async () => {
    await stopFork(fork);
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("★ anonymous: `/memes/` answers the status stock's `/tiddlers/` answers; authenticated: 200 ★", async () => {
    const stock = await http("GET", NATIVE);
    expect(stock.status).toBe(401);
    expect(stock.headers.get("www-authenticate")).toMatch(/^Basic /);
    const ours = await http("GET", MEME);
    expect(ours.status).toBe(stock.status);
    expect(ours.headers.get("www-authenticate")).toBe(stock.headers.get("www-authenticate"));
    // A writer lands the meme; a reader reads it back.
    const put = await http("PUT", MEME_BAG, { body: meme(["a"]), headers: basic("alice") });
    expect(put.status, put.body).toBe(200);
    expect((await http("GET", MEME, { headers: basic("bob") })).status).toBe(200);
    expect((await http("GET", MEME, { headers: basic("alice") })).status).toBe(200);
  });

  test("CONTROL: a reader-only principal's PUT and DELETE refuse as stock refuses; nothing moves", async () => {
    const stock = await http("PUT", NATIVE, { body: JSON.stringify({ title: "lar:///t/x", text: "bob" }), headers: basic("bob") });
    expect(stock.status).toBe(401);
    const put = await http("PUT", MEME_BAG, { body: meme(["a", "z"]), headers: basic("bob") });
    expect(put.status).toBe(stock.status);
    const del = await http("DELETE", MEME_BAG, { headers: basic("bob") });
    expect(del.status).toBe(stock.status);
    const read = await http("GET", MEME, { headers: basic("alice") });
    expect(read.status).toBe(200);
    expect(read.body).not.toContain("#/z");
  });
});

/**
 * THE TWO DOORS (b), LIVE — a stock browser client over the fork server, the plugin loaded the way a
 * stock wiki loads it. A framed root added to the client wiki reaches the server SPLIT: the charm
 * carried it through `/memes/`, where the native door would have answered 422 and the syncer would
 * have retried forever. The plain CONTROL lands through the native door as ever.
 * Needs a browser: skips loudly when playwright's chromium cannot launch.
 */
describe.skipIf(!forkPresent)("★ THE TWO DOORS (b): a stock client's save of a framed root lands split on the server ★", () => {
  let fork: Fork | undefined;
  let root = "";
  let browser: { close(): Promise<void>; newPage(): Promise<Page> } | undefined;
  interface Page { goto(url: string): Promise<unknown>; evaluate<T, A>(fn: (arg: A) => T, arg: A): Promise<T>; waitForFunction(fn: string, arg?: unknown, opts?: { timeout?: number }): Promise<unknown>; close(): Promise<void> }
  const http = async (method: string, p: string): Promise<Reply> => {
    const r = await fetch(fork!.base + p, { method });
    return { status: r.status, headers: r.headers, body: await r.text() };
  };
  const titles = async (): Promise<string[]> => {
    const r = await http("GET", "/recipes/default/tiddlers.json");
    return (JSON.parse(r.body) as { title: string }[]).map((t) => t.title).sort();
  };

  beforeAll(async () => {
    const tmpRoot = process.env["LARES_E2E_TMP"] ?? tmpdir();
    mkdirSync(tmpRoot, { recursive: true });
    root = mkdtempSync(path.join(tmpRoot, "meme-routes-client-"));
    // The client-server pair a stock wiki folder carries: the browser's syncadaptor and the server's file store.
    fork = await bootFork(path.join(root, "wiki"), [], {}, ["tiddlywiki/tiddlyweb", "tiddlywiki/filesystem"]);
    try {
      const { chromium } = await import("playwright");
      browser = await chromium.launch();
    } catch (err) {
      console.error(`meme-routes.e2e (client door): SKIPPED — no browser: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await stopFork(fork);
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("a framed root added in the browser arrives split; a plain tiddler arrives through the native door", async () => {
    if (!browser) return;
    const page = await browser.newPage();
    try {
      await page.goto(`${fork!.base}/`);
      await page.waitForFunction("typeof $tw !== 'undefined' && $tw.syncer && $tw.syncadaptor && $tw.syncadaptor.recipe === 'default'", undefined, { timeout: 30_000 });
      const uri = "lar:///t/client";
      const text = meme(["a"]).replaceAll("t/x", "t/client");
      await page.evaluate((arg: { uri: string; text: string }) => {
        const tw = (globalThis as { $tw: { wiki: { addTiddler(f: Record<string, string>): void } } }).$tw;
        tw.wiki.addTiddler({ title: arg.uri, type: "text/memetic-wikitext+tiddlywiki", text: arg.text });
        tw.wiki.addTiddler({ title: "lar:///t/client-plain", text: "prose" });
      }, { uri, text });
      const deadline = Date.now() + 20_000;
      let seen: string[] = [];
      while (Date.now() < deadline) {
        seen = await titles();
        if (seen.includes(`${uri}#/a`) && seen.includes("lar:///t/client-plain")) break;
        await new Promise((res) => setTimeout(res, 250));
      }
      expect(seen.filter((t) => t.startsWith("lar:///t/client"))).toEqual([uri, `${uri}#/a`, "lar:///t/client-plain"]);
      // The shelf holds the root SPLIT — the door ran, the native PUT never landed it whole.
      const shelf = JSON.parse((await http("GET", `/recipes/default/tiddlers/${encodeURIComponent(uri)}`)).body) as { text: string };
      expect(shelf.text).toBe("<<~ kahea ahu #/a>>");
    } finally {
      await page.close();
    }
  }, 60_000);
});

/**
 * THE TWO DOORS (c), LIVE — a framed root landed by a door neither the native gate nor the charm
 * sees: the fork's own `--load` command, which imports through `$tw.wiki.importTiddler`. The backstop
 * re-stamps it and the server log carries the one line. The plain CONTROL in the same file stays.
 */
describe.skipIf(!forkPresent)("★ THE TWO DOORS (c): a root landed by `--load` re-stamps on the server, one log line ★", () => {
  let fork: Fork | undefined;
  let root = "";
  const uri = "lar:///t/loaded";

  beforeAll(async () => {
    const tmpRoot = process.env["LARES_E2E_TMP"] ?? tmpdir();
    mkdirSync(tmpRoot, { recursive: true });
    root = mkdtempSync(path.join(tmpRoot, "meme-routes-backstop-"));
    const framed = path.join(root, "framed.json");
    writeFileSync(framed, JSON.stringify([
      { title: uri, type: "text/memetic-wikitext+tiddlywiki", text: meme(["a"]).replaceAll("t/x", "t/loaded") },
      { title: "lar:///t/loaded-plain", text: "prose" },
    ]));
    fork = await bootFork(path.join(root, "wiki"), ["--load", framed]);
  }, 60_000);

  afterAll(async () => {
    await stopFork(fork);
    if (root) rmSync(root, { recursive: true, force: true });
  });

  test("the shelf holds the root split and its slot; the log names the re-stamp once; the plain tiddler stands", async () => {
    const deadline = Date.now() + 10_000;
    let seen: string[] = [];
    while (Date.now() < deadline) {
      const r = await fetch(`${fork!.base}/recipes/default/tiddlers.json`);
      seen = (JSON.parse(await r.text()) as { title: string }[]).map((t) => t.title).sort();
      if (seen.includes(`${uri}#/a`)) break;
      await new Promise((res) => setTimeout(res, 100));
    }
    expect(seen).toEqual([uri, `${uri}#/a`, "lar:///t/loaded-plain"]);
    const shelf = JSON.parse(await (await fetch(`${fork!.base}/recipes/default/tiddlers/${encodeURIComponent(uri)}`)).text()) as { text: string };
    expect(shelf.text).toBe("<<~ kahea ahu #/a>>");
    const lines = fork!.log.join("").split("\n").filter((l) => l.includes("[memetic-wikitext]"));
    expect(lines).toEqual([`[memetic-wikitext] re-stamped ${uri} (landed via a native write)`]);
  }, 30_000);
});
