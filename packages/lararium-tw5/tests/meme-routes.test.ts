/**
 * THE ROUTE SKINS — driven through TW5's route contract (request · response · state) with nothing
 * beneath them but a Map. PUT lands, GET hands back the base, a stale base answers 412, an error-
 * graded meme answers 422, a malformed uri answers 400. The server's auth and CSRF gate stand in
 * front of these and get no exercise here.
 */
import { describe, test, expect } from "vitest";
import * as put from "../src/routes/put-meme.js";
import * as get from "../src/routes/get-meme.js";
import * as del from "../src/routes/delete-meme.js";
import * as list from "../src/routes/list-memes.js";
import { memePathOf } from "../src/place-meme.js";
import { nativeDoorGate } from "../src/native-door-gate.js";
import type { TiddlerFields } from "../src/deserializer.js";
import { digestsEqual, reprDigestOf } from "@lararium/mesh/agile-digest";

const URI = "lar:///t/x";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

function wiki() {
  const store = new Map<string, TiddlerFields>();
  return {
    store,
    allTitles: () => [...store.keys()],
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t)! } : undefined),
    addTiddler: (f: TiddlerFields) => { store.set(String(f.title), f); },
    deleteTiddler: (t: string) => { store.delete(t); },
  };
}

interface Reply { status: number; headers: Record<string, string>; body: string }

/** Fire one route handler the way TW5's server does and await its reply. */
function fire(
  route: { handler: (req: never, res: never, state: never) => void },
  w: ReturnType<typeof wiki>,
  opts: { uri?: string; data?: string; ifMatch?: string; ifNoneMatch?: string },
): Promise<Reply> {
  return new Promise((resolve) => {
    const reply: Reply = { status: 0, headers: {}, body: "" };
    const response = {
      writeHead: (status: number, headers: Record<string, string>) => { reply.status = status; reply.headers = headers; },
      end: (body?: string) => { reply.body = body ?? ""; resolve(reply); },
    };
    const request = { headers: {
      ...(opts.ifMatch ? { "if-match": opts.ifMatch } : {}),
      ...(opts.ifNoneMatch ? { "if-none-match": opts.ifNoneMatch } : {}),
    } };
    const state = { wiki: w, params: ["bags", "default", "lar", opts.uri ?? "t/x"], data: opts.data ?? "" };
    route.handler(request as never, response as never, state as never);
  });
}

describe("★ PUT /bags/:bag/memes/:scheme/:path ★", () => {
  test("★ the URI projects onto the path with no percent-encoding: scheme segment, then uri-path ★", () => {
    expect(put.methods).toEqual(["PUT"]);
    expect(memePathOf("lar:///ha.ka.ba/lares/api/noosphere-boot", { kind: "bags", name: "default" }))
      .toBe("/bags/default/memes/lar/ha.ka.ba/lares/api/noosphere-boot");
    expect(put.path.exec("/bags/default/memes/lar/ha.ka.ba/lares/api/noosphere-boot")?.slice(1))
      .toEqual(["bags", "default", "lar", "ha.ka.ba/lares/api/noosphere-boot"]);
    // The native read/write pair: recipes read the same path.
    expect(get.path.test("/recipes/default/memes/lar/t/x")).toBe(true);
    // A session-form URI carries an authority and never projects.
    expect(memePathOf("lar://mara:operator@host/t/x", { kind: "bags", name: "default" })).toBeNull();
  });

  test("a fresh meme lands as its records; the ETag carries the base for the next writer", async () => {
    const w = wiki();
    const r = await fire(put, w, { data: meme(["a", "b"]) });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).decision).toBe("ingest");
    expect(r.headers["ETag"]).toMatch(/^"sha256:/);
    expect([...w.store.keys()].sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
  });

  test("★ GET hands back the base; a PUT over a STALE base answers 412 and lands nothing ★", async () => {
    const w = wiki();
    await fire(put, w, { data: meme(["a"]) });
    const read = await fire(get, w, {});
    expect(read.status).toBe(200);
    expect(read.headers["Content-Type"]).toMatch(/memetic-wikitext/);
    // Another writer moves the records past the base this writer read.
    await fire(put, w, { data: meme(["a", "b"]) });
    const stale = await fire(put, w, { data: meme(["a", "z"]), ifMatch: read.headers["ETag"] });
    expect(stale.status).toBe(412);
    expect(w.store.has(`${URI}#/z`)).toBe(false);
    // The current base lets the same edit through.
    const fresh = await fire(get, w, {});
    const ok = await fire(put, w, { data: meme(["a", "z"]), ifMatch: fresh.headers["ETag"] });
    expect(ok.status).toBe(200);
    expect(w.store.has(`${URI}#/z`)).toBe(true);
  });

  test("CONTROL: an error-graded meme answers 422 and the wiki stays untouched", async () => {
    const w = wiki();
    const stranded = meme(["a"]).replace("<<^ code=\"&#x0003;\">>\n", "<<^ code=\"&#x0003;\">>\n<<~ ahu #edges>>\n\n* x\n\n<<~/ahu>>\n");
    const r = await fire(put, w, { data: stranded });
    expect(r.status).toBe(422);
    expect(w.store.size).toBe(0);
  });

  test("★ a FRAGMENT-addressed uri never founds: PUT answers 400 and names the single-hash law ★", async () => {
    // `#` may not repeat in a lar address, so a founding at `uri#/slot` could mint only `uri#/slot#/z` —
    // a title the group law admits and the address grammar has no name for. After the root law gained
    // one spelling no stock client addresses this door with a fragment; the wall is for every OTHER
    // skin (MCP, CLI, a hand-rolled curl), and it costs the syncer nothing because nothing sends here.
    const w = wiki();
    const reply = await fire(put, w, { uri: "t/x%23/a", data: meme(["z"]) });
    expect(reply.status).toBe(400);
    expect(reply.body).toContain("#");
    expect([...w.store.keys()]).toEqual([]);
  });

  test("CONTROL · a ROOT uri still lands, and GET/DELETE on the fragment path answer as they always did", async () => {
    const w = wiki();
    expect((await fire(put, w, { uri: "t/x", data: meme(["z"]) })).status).toBe(200);
    // The read and the removal never founded anything, so they keep their own answers: absent.
    expect((await fire(get, w, { uri: "t/x%23/a" })).status).toBe(404);
    expect((await fire(del, w, { uri: "t/x%23/a" })).status).toBe(404);
  });

  test("a malformed :path answers 400 on both skins, never an uncaught throw", async () => {
    const w = wiki();
    expect((await fire(put, w, { uri: "t/%E0%A4%A", data: meme(["a"]) })).status).toBe(400);
    expect((await fire(get, w, { uri: "t/%E0%A4%A" })).status).toBe(400);
  });

  test("GET on a uri the wiki never held answers 404", async () => {
    expect((await fire(get, wiki(), {})).status).toBe(404);
  });

  test("★ `If-None-Match: *` — create-only: a fresh URI lands, a standing record answers 412 and nothing moves ★", async () => {
    const w = wiki();
    const born = await fire(put, w, { data: meme(["a"]), ifNoneMatch: "*" });
    expect(born.status).toBe(200);
    expect(JSON.parse(born.body).decision).toBe("ingest");
    const before = [...w.store.entries()].map(([t, f]) => [t, f["text"]]);
    const refused = await fire(put, w, { data: meme(["a", "b"]), ifNoneMatch: "*" });
    expect(refused.status).toBe(412);
    expect(JSON.parse(refused.body)).toMatchObject({ uri: URI, decision: "conflict" });
    expect([...w.store.entries()].map(([t, f]) => [t, f["text"]])).toEqual(before);
    // CONTROL: the same text with no precondition lands.
    expect((await fire(put, w, { data: meme(["a", "b"]) })).status).toBe(200);
    expect(w.store.has(`${URI}#/b`)).toBe(true);
  });

  test("★ both skins emit `Repr-Digest` (RFC 9530) beside the `ETag`, one digest in two spellings ★", async () => {
    const w = wiki();
    const written = await fire(put, w, { data: meme(["a"]) });
    const etag = written.headers["ETag"]!.replace(/^"|"$/g, "");
    expect(written.headers["Repr-Digest"]).toMatch(/^sha-256=:[A-Za-z0-9+/]+=*:$/);
    expect(written.headers["Repr-Digest"]).toBe(reprDigestOf(etag));
    expect(digestsEqual(written.headers["Repr-Digest"]!, etag)).toBe(true);
    const read = await fire(get, w, {});
    expect(read.headers["Repr-Digest"]).toBe(written.headers["Repr-Digest"]);
    expect(read.headers["ETag"]).toBe(written.headers["ETag"]);
  });
});

describe("★ THE PLAIN CONTAINER LAW — `default` is the host's anchor; any other name answers 404 ★", () => {
  const fireAt = (route: Parameters<typeof fire>[0], w: ReturnType<typeof wiki>, kind: string, name: string, data?: string) =>
    new Promise<Reply>((resolve) => {
      const reply: Reply = { status: 0, headers: {}, body: "" };
      const response = {
        writeHead: (status: number, headers: Record<string, string>) => { reply.status = status; reply.headers = headers; },
        end: (body?: string) => { reply.body = body ?? ""; resolve(reply); },
      };
      route.handler({ headers: {} } as never, response as never, { wiki: w, params: [kind, name, "lar", "t/x"], data: data ?? "" } as never);
    });

  test("a bag or recipe the server cannot name answers 404 with a one-line body and swallows nothing", async () => {
    const w = wiki();
    for (const [kind, name] of [["bags", "other"], ["recipes", "other"], ["bags", "Default"], ["recipes", ""]] as const) {
      const r = await fireAt(put, w, kind, name, meme(["a"]));
      expect(r.status, `${kind}/${name}`).toBe(404);
      expect(r.body.trim().split("\n")).toHaveLength(1);
      expect((await fireAt(get, w, kind, name)).status, `${kind}/${name}`).toBe(404);
    }
    expect(w.store.size).toBe(0);
  });

  test("CONTROL: `recipes/default` and `bags/default` both name the one wiki", async () => {
    const w = wiki();
    expect((await fireAt(put, w, "recipes", "default", meme(["a"]))).status).toBe(200);
    expect((await fireAt(get, w, "bags", "default")).status).toBe(200);
    expect((await fireAt(get, w, "recipes", "default")).status).toBe(200);
  });
});

describe("★ THE NATIVE DOOR — `bag` is user space; the container's name is the envelope ★", () => {
  const gate = (body: unknown, standing?: Record<string, unknown>) => nativeDoorGate(JSON.stringify(body), standing, "default");
  const landed = (r: ReturnType<typeof nativeDoorGate>): Record<string, unknown> =>
    r.kind === "pass" ? (JSON.parse(r.data) as Record<string, unknown>) : { refused: r.status };

  test("a top-level `bag: \"default\"` never lands; the standing record's own `bag` rides through", () => {
    expect(landed(gate({ title: "t", text: "x", bag: "default", revision: "3" }, { title: "t", bag: "mine" })))
      .toEqual({ title: "t", text: "x", revision: "3", bag: "mine" });
    // No standing `bag` → none appears.
    expect(landed(gate({ title: "t", text: "x", bag: "default" }, { title: "t" }))).toEqual({ title: "t", text: "x" });
    expect(landed(gate({ title: "t", text: "x", bag: "default" }, undefined))).toEqual({ title: "t", text: "x" });
  });

  test("CONTROL: an author's `bag` of any other value lands as written; a nested `fields.bag` is the author's; a non-JSON body passes untouched", () => {
    expect(landed(gate({ title: "t", bag: "mine" }, { title: "t", bag: "theirs" }))["bag"]).toBe("mine");
    expect(landed(gate({ title: "t", fields: { bag: "default" } }, { title: "t", bag: "mine" }))).toEqual({ title: "t", fields: { bag: "default" } });
    expect(nativeDoorGate("not json", undefined, "default")).toEqual({ kind: "pass", data: "not json" });
    expect(nativeDoorGate("[1]", undefined, "default")).toEqual({ kind: "pass", data: "[1]" });
  });
});

describe("★ DELETE /bags/:bag/memes/:scheme/:path — the root and its group go, nothing beside them ★", () => {
  const fireDel = (w: ReturnType<typeof wiki>, opts: { kind?: string; uri?: string; ifMatch?: string } = {}) =>
    new Promise<Reply>((resolve) => {
      const reply: Reply = { status: 0, headers: {}, body: "" };
      const response = {
        writeHead: (status: number, headers: Record<string, string>) => { reply.status = status; reply.headers = headers; },
        end: (body?: string) => { reply.body = body ?? ""; resolve(reply); },
      };
      const request = { headers: opts.ifMatch ? { "if-match": opts.ifMatch } : {} };
      del.handler(request as never, response as never, { wiki: w, params: [opts.kind ?? "bags", "default", "lar", opts.uri ?? "t/x"] } as never);
    });

  test("204: the root and its `#/slot` children tombstone; CONTROL: a tiddler under the same prefix stays", async () => {
    const w = wiki();
    await fire(put, w, { data: meme(["a", "b"]) });
    w.store.set("lar:///t/xy", { title: "lar:///t/xy", text: "a neighbour, not a child" });
    expect(del.methods).toEqual(["DELETE"]);
    const r = await fireDel(w);
    expect(r.status).toBe(204);
    expect([...w.store.keys()]).toEqual(["lar:///t/xy"]);
  });

  test("404 when nothing stands under the uri; the `/recipes/` form answers 404 as stock's delete does", async () => {
    const w = wiki();
    expect((await fireDel(w)).status).toBe(404);
    await fire(put, w, { data: meme(["a"]) });
    const r = await fireDel(w, { kind: "recipes" });
    expect(r.status).toBe(404);
    expect(w.store.size).toBe(2);
  });

  test("★ `If-Match` over a STALE base answers 412 and removes nothing; the current base removes ★", async () => {
    const w = wiki();
    await fire(put, w, { data: meme(["a"]) });
    const stale = (await fire(get, w, {})).headers["ETag"]!;
    await fire(put, w, { data: meme(["a", "b"]) });
    expect((await fireDel(w, { ifMatch: stale })).status).toBe(412);
    expect(w.store.size).toBe(3);
    const fresh = (await fire(get, w, {})).headers["ETag"]!;
    expect((await fireDel(w, { ifMatch: fresh })).status).toBe(204);
    expect(w.store.size).toBe(0);
  });
});

describe("★ THE TWO DOORS (a): a framed meme root at the native door refuses, naming the /memes/ door ★", () => {
  const gate = (body: unknown) => nativeDoorGate(JSON.stringify(body), undefined, "default");
  const CARRIER = "text/memetic-wikitext+tiddlywiki";

  test("a native PUT of a root (carrier type + SOH head) answers 422 with the door for that URI", () => {
    const r = gate({ title: URI, type: CARRIER, text: meme(["a"]) });
    expect(r.kind).toBe("refuse");
    if (r.kind !== "refuse") return;
    expect(r.status).toBe(422);
    expect(r.body["door"]).toBe("/recipes/default/memes/lar/t/x");
    expect(r.body["uri"]).toBe(URI);
    // The TiddlyWeb shape nests the unknown fields; the type rides known, the text rides known.
    expect(gate({ title: URI, type: CARRIER, text: meme(["a"]), fields: { "uri-path": "t/x" } }).kind).toBe("refuse");
  });

  test("CONTROL: a plain tiddler passes; a carrier-typed tiddler with no head (a split root, a slot child) passes; SOH text under another type passes", () => {
    expect(gate({ title: URI, text: meme(["a"]) }).kind).toBe("pass");
    expect(gate({ title: URI, type: "text/vnd.tiddlywiki", text: meme(["a"]) }).kind).toBe("pass");
    expect(gate({ title: URI, type: CARRIER, text: "<<~ kahea ahu #/a>>" }).kind).toBe("pass");
    expect(gate({ title: `${URI}#/a`, type: CARRIER, text: "! a", fields: { "$slot": "#/a" } }).kind).toBe("pass");
    // A head SHOWN inside a fence opens nothing.
    expect(gate({ title: URI, type: CARRIER, text: "```\n" + meme(["a"]) + "```\n" }).kind).toBe("pass");
  });
});

/**
 * THE LISTING SKIN — `GET /{recipes|bags}/default/memes.json`, the route skin of `listMemes`, a sibling
 * of stock's `tiddlers.json`: roots + the canonical hash by default, `?tree=1` nests the slot tree. It
 * carries stock's `$:/` posture — a system-titled root rides only while `SyncSystemTiddlersFromServer`
 * reads `yes`.
 */
describe("★ GET /{recipes|bags}/default/memes.json ★", () => {
  const fireList = (w: ReturnType<typeof wiki>, opts: { kind?: string; name?: string; query?: Record<string, string> } = {}): Promise<Reply> =>
    new Promise((resolve) => {
      const reply: Reply = { status: 0, headers: {}, body: "" };
      const response = {
        writeHead: (status: number, headers: Record<string, string>) => { reply.status = status; reply.headers = headers; },
        end: (body?: string) => { reply.body = body ?? ""; resolve(reply); },
      };
      const state = { wiki: w, params: [opts.kind ?? "recipes", opts.name ?? "default"], queryParameters: opts.query ?? {} };
      list.handler({ headers: {} } as never, response as never, state as never);
    });

  test("the path stands beside `tiddlers.json` under both container kinds, and never under `/memes/<scheme>/`", () => {
    expect(list.methods).toEqual(["GET"]);
    expect(list.path.exec("/recipes/default/memes.json")?.slice(1)).toEqual(["recipes", "default"]);
    expect(list.path.exec("/bags/default/memes.json")?.slice(1)).toEqual(["bags", "default"]);
    expect(list.path.test("/bags/default/memes/lar/t/x")).toBe(false);
    expect(get.path.test("/bags/default/memes.json")).toBe(false);
  });

  test("★ roots + canonical hash by default; `?tree=1` nests `uri#/slot` under its own root; CONTROL: a plain tiddler never lists ★", async () => {
    const w = wiki();
    const a = await fire(put, w, { data: meme(["a", "b"]) });
    await fire(put, w, { uri: "t/y", data: meme(["c"]).replaceAll("t/x", "t/y") });
    w.store.set("plain", { title: "plain", text: "prose" });
    const r = await fireList(w);
    expect(r.status).toBe(200);
    expect(r.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(r.body)).toEqual([
      { uri: URI, canonicalHash: JSON.parse(a.body).canonicalHash },
      { uri: "lar:///t/y", canonicalHash: expect.stringMatching(/^sha256:/) },
    ]);
    const tree = JSON.parse((await fireList(w, { query: { tree: "1" } })).body) as Array<{ uri: string; slots: unknown[] }>;
    expect(tree.map((m) => m.slots)).toEqual([
      [{ slot: "#/a", uri: `${URI}#/a`, slots: [] }, { slot: "#/b", uri: `${URI}#/b`, slots: [] }],
      [{ slot: "#/c", uri: "lar:///t/y#/c", slots: [] }],
    ]);
  });

  test("★ THE CONTAINER LAW: a bag or recipe the server cannot name answers 404 with the one-line body ★", async () => {
    const w = wiki();
    await fire(put, w, { data: meme(["a"]) });
    const other = await fireList(w, { name: "other" });
    expect(other.status).toBe(404);
    expect(other.body).toContain("other");
    const kind = await fireList(w, { kind: "shelves" });
    expect(kind.status).toBe(404);
  });

  test("the `$:/` posture rides stock's switch: a system-titled root lists only while SyncSystemTiddlersFromServer reads yes", async () => {
    const w = wiki();
    await fire(put, w, { data: meme(["a"]) });
    // A `$:/` root reaches the shelf by a native door alone — `/memes/<scheme>/` always carries a scheme.
    const sys = "$:/lar/sys";
    w.store.set(sys, { title: sys, type: "text/memetic-wikitext+tiddlywiki", text: "! s" });
    expect((JSON.parse((await fireList(w)).body) as { uri: string }[]).map((m) => m.uri)).toEqual([URI]);
    w.store.set("$:/config/SyncSystemTiddlersFromServer", { title: "$:/config/SyncSystemTiddlersFromServer", text: "yes" });
    expect((JSON.parse((await fireList(w)).body) as { uri: string }[]).map((m) => m.uri)).toEqual([sys, URI]);
  });
});
