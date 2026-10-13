/**
 * A BARE BODY ROUND-TRIPS — text with no frame reads as bare data, never a meme, and a put either
 * lands the bytes a person gave or refuses by name.
 *
 * The gate holds a frameless body verbatim as ONE record (`ingest-gate.ts`, leg 1½). The read half
 * answers those same bytes: the held record's text IS its canonical render, so `meme-get` reads back
 * what `meme-put` took, the hash a put reports equals the hash a get reports, a second put of the
 * same bytes reads as a noop, and a delete under that base removes the hold.
 */
import { describe, test, expect } from "vitest";
import { createRequire } from "node:module";
import { AutomergeDocStore, CompositeStore, bagUri, emptyLarDoc, recipeUri, wikiSlotUri, type LarDoc, type LarTiddlerRecord, type LarTiddlerStore, type Repo as RepoType } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, makeMemeGetReactor, makeMemeDeleteReactor, makeMemeProjectReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import { memeFaceOf } from "../src/modules/meme-face.js";
import { EMPTY_BODY_CODE, holdsUnreadPointer, placeMeme, readMeme, removeMeme, type MemeSink } from "../src/place-meme.js";
import type { TiddlerFields } from "../src/deserializer.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import * as putRoute from "../src/routes/put-meme.js";
import * as getRoute from "../src/routes/get-meme.js";

const meshRequire = createRequire(import.meta.resolve("@lararium/mesh"));
const Repo = meshRequire("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;

const URI = "lar:///t.title.plain/one";

/** Bodies no frame stands in. Each reads back byte for byte. */
const BARE_BODIES: ReadonlyArray<readonly [string, string]> = [
  ["one line and its newline", "a body\n"],
  ["no trailing newline", "a body"],
  ["leading and trailing blank lines", "\n\n  a body  \n\n\n"],
  ["a toml fence that lifts into no field", "```toml meta\ntitle = \"elsewhere\"\n```\n\nprose\n"],
  ["wikitext a parser would read", "! Heading\n\n<<~ ahu #/a>>\n\ninside\n\n<<~/ahu>>\n"],
  ["carriage returns and a tab", "a\r\nb\tc\r\n"],
  ["text beyond ASCII", "kūkākūkā — 言葉 ☂\n"],
];

const framed = (uri: string, slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n` +
  `<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${uri.slice("lar:///".length)}"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

/** A head and an open text frame whose close never arrives: a torn frame. */
const TORN = `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\nbody with no close\n`;

function memorySink(): MemeSink & { store: Map<string, TiddlerFields> } {
  const store = new Map<string, TiddlerFields>();
  return {
    store,
    titles: () => [...store.keys()],
    read: (t) => store.get(t),
    land: (f) => { store.set(String(f.title), f); },
    tombstone: (t) => { store.delete(t); },
  };
}

describe("a bare body through placeMeme and readMeme", () => {
  for (const [name, body] of BARE_BODIES) {
    test(`reads back byte for byte: ${name}`, async () => {
      const sink = memorySink();
      const receipt = await placeMeme({ uri: URI, text: body }, sink);
      expect(receipt.decision).toBe("ingest");
      expect(receipt.landed).toEqual([URI]);
      expect(receipt.diagnostics.map((d) => d.code)).toContain("bare-data");
      // The setup took: the store holds the bytes under the title.
      expect(sink.store.get(URI)?.text).toBe(body);

      const read = await readMeme(URI, sink);
      expect(read).not.toBeNull();
      expect(read!.text).toBe(body);
      expect(read!.canonicalHash).toBe(carrierHash(body));
      // The base a put reports equals the base a get reports.
      expect(receipt.canonicalHash).toBe(read!.canonicalHash);
    });
  }

  test("the same bare bytes again read as a noop, and the receipt keeps the base", async () => {
    const sink = memorySink();
    const first = await placeMeme({ uri: URI, text: "a body\n" }, sink);
    const again = await placeMeme({ uri: URI, text: "a body\n" }, sink);
    expect(again.decision).toBe("noop");
    expect(again.canonicalHash).toBe(first.canonicalHash);
  });

  test("a writer that read the bare hold edits it under that base", async () => {
    const sink = memorySink();
    const first = await placeMeme({ uri: URI, text: "a body\n" }, sink);
    const edit = await placeMeme({ uri: URI, text: "a second body\n", baseHash: first.canonicalHash }, sink);
    expect(edit.decision).toBe("ingest");
    expect((await readMeme(URI, sink))!.text).toBe("a second body\n");
  });

  test("CONTROL: a stale base over a bare hold answers conflict and moves nothing", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: "a body\n" }, sink);
    const stale = await placeMeme({ uri: URI, text: "a second body\n", baseHash: carrierHash("some other bytes") }, sink);
    expect(stale.decision).toBe("conflict");
    expect((await readMeme(URI, sink))!.text).toBe("a body\n");
  });

  test("a delete under the base a get reported removes the hold", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: "a body\n" }, sink);
    const base = (await readMeme(URI, sink))!.canonicalHash;
    const gone = await removeMeme({ uri: URI, baseHash: base }, sink);
    expect(gone.decision).toBe("removed");
    expect(await readMeme(URI, sink)).toBeNull();
  });

  test("a framed carrier placed over a bare hold replaces it under the hold's base", async () => {
    const sink = memorySink();
    const first = await placeMeme({ uri: URI, text: "a body\n" }, sink);
    const r = await placeMeme({ uri: URI, text: framed(URI, ["a"]), baseHash: first.canonicalHash }, sink);
    expect(r.decision).toBe("ingest");
    expect((await readMeme(URI, sink))!.text).toContain("<<~ ahu #/a>>");
  });

  test("CONTROL: a framed carrier round-trips, and a second read returns the first", async () => {
    const sink = memorySink();
    const r = await placeMeme({ uri: URI, text: framed(URI, ["a", "b"]) }, sink);
    expect(r.decision).toBe("ingest");
    expect(r.landed.sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    const read = (await readMeme(URI, sink))!;
    expect(read.canonicalHash).toBe(r.canonicalHash);
    expect(read.text).toContain("<<~ ahu #/a>>");
    expect((await placeMeme({ uri: URI, text: read.text }, sink)).decision).toBe("noop");
  });

  test("REFUSAL: a torn frame refuses by name and lands nothing", async () => {
    const sink = memorySink();
    const r = await placeMeme({ uri: URI, text: TORN }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.landed).toEqual([]);
    expect(r.diagnostics.map((d) => d.code)).toContain("block-check-torn");
    expect(sink.store.size).toBe(0);
    expect(await readMeme(URI, sink)).toBeNull();
  });

  test("REFUSAL: an empty text refuses by name over an address nothing holds, and lands nothing", async () => {
    const sink = memorySink();
    const r = await placeMeme({ uri: URI, text: "" }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.diagnostics.map((d) => d.code)).toEqual([EMPTY_BODY_CODE]);
    expect(r.warnings[0]).toContain(URI);
    expect(sink.store.size).toBe(0);
  });

  test("REFUSAL: an empty text over a standing hold refuses and the hold keeps its bytes", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: "a body\n" }, sink);
    const r = await placeMeme({ uri: URI, text: "" }, sink);
    expect(r.decision).toBe("refuse");
    expect((await readMeme(URI, sink))!.text).toBe("a body\n");
  });

  test("CONTROL: one newline counts as bytes, lands, and reads back", async () => {
    const sink = memorySink();
    expect((await placeMeme({ uri: URI, text: "\n" }, sink)).decision).toBe("ingest");
    expect((await readMeme(URI, sink))!.text).toBe("\n");
  });

  test("a pointer whose body never reached the sink reads as an unread pointer, and readMeme stays total over it", async () => {
    const sink = memorySink();
    sink.store.set(URI, { title: URI, type: "image/png", _is_skinny: "yes", textCid: "ab".repeat(32) } as TiddlerFields);
    expect(await holdsUnreadPointer(URI, sink)).toBe(true);
    // The gate, the listing and the backstop read through `readMeme`; none of them meets a throw.
    expect((await readMeme(URI, sink))!.text).toBe("");
  });

  test("CONTROL: a pointer whose body the sink holds reads that body, and an address nothing holds names no pointer", async () => {
    const sink = memorySink();
    expect(await holdsUnreadPointer(URI, sink)).toBe(false);
    sink.store.set(URI, { title: URI, type: "text/plain", _is_skinny: "yes", textCid: "ab".repeat(32), text: "resolved" } as TiddlerFields);
    expect(await holdsUnreadPointer(URI, sink)).toBe(false);
    expect((await readMeme(URI, sink))!.text).toBe("resolved");
  });

  test("a record of another type under the title reads as its own text", async () => {
    const sink = memorySink();
    sink.store.set(URI, { title: URI, type: "text/vnd.tiddlywiki", text: "plain wikitext" } as TiddlerFields);
    expect((await readMeme(URI, sink))!.text).toBe("plain wikitext");
  });

  test("a lone close mark makes the text a carrier: the frame re-mints and every authored line survives", async () => {
    const sink = memorySink();
    const text = `first line\n\n<<^ code="&#x0003;">>\n`;
    const r = await placeMeme({ uri: URI, text }, sink);
    expect(r.decision).toBe("ingest");
    const read = (await readMeme(URI, sink))!;
    expect(read.canonicalHash).toBe(r.canonicalHash);
    expect(read.text).toContain("first line");
    expect((await placeMeme({ uri: URI, text: read.text }, sink)).decision).toBe("noop");
  });

  test("CONTROL: an address nothing holds reads null, never an empty text", async () => {
    expect(await readMeme(URI, memorySink())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The verb path: put and get AS a wiki that holds a working layer
// ---------------------------------------------------------------------------

const ctx = (requestId = "r1"): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId } as VerbContext["invocation"],
  cap: async () => ({ ok: true }),
});

/** The working layer's store: a memory store, and the live shape (one Automerge document). */
const STORES: ReadonlyArray<readonly [string, (bag: string) => LarTiddlerStore]> = [
  ["a memory store", (bag) => new MemoryTiddlerStore(bag)],
  ["an Automerge document", (bag) => new AutomergeDocStore(new Repo({ network: [] }).create<LarDoc>(emptyLarDoc()), bag)],
];

function wikiWithWorkingLayer(slug: string, storeOf: (bag: string) => LarTiddlerStore = STORES[0]![1]): { opts: MemeVerbOptions; working: LarTiddlerStore } {
  const workingBag = wikiSlotUri(slug, "working");
  const working = storeOf(workingBag);
  const recipes = new Map<string, LarTiddlerRecord>();
  recipes.set(recipeUri("catalog", slug), {
    tiddler: { title: recipeUri("catalog", slug), "bag-stack": bagUri("lares"), "writable-bag": workingBag },
  });
  const opts: MemeVerbOptions = {
    composite: new CompositeStore(),
    tw5: { $tw: { wiki: {} } } as unknown as MemeVerbOptions["tw5"],
    recipeOf: async (s) => recipes.get(recipeUri("catalog", s)) ?? null,
    reach: async (): Promise<LarTiddlerStore | null> => null,
    slotStore: async (s, kind): Promise<LarTiddlerStore | null> => (s === slug && kind === "working" ? working : null),
  };
  return { opts, working };
}

describe("meme-put then meme-get on a wiki with a working layer", () => {
  for (const [storeName, storeOf] of STORES) for (const [name, body] of BARE_BODIES) {
    test(`a frameless body reads back byte for byte from ${storeName}: ${name}`, async () => {
      const { opts, working } = wikiWithWorkingLayer("lares", storeOf);
      const receipt = await makeMemePutReactor(opts)({ recipe: "lares", uri: URI, text: body }, ctx());
      expect(receipt["decision"]).toBe("ingest");
      expect(receipt["landed"]).toEqual([URI]);
      expect((await working.get(URI))?.tiddler["text"]).toBe(body);

      const got = await makeMemeGetReactor(opts)({ recipe: "lares", uri: URI }, ctx("r2"));
      const meme = got["meme"] as { text: string; canonicalHash: string } | null;
      expect(meme).not.toBeNull();
      expect(meme!.text).toBe(body);
      expect(meme!.canonicalHash).toBe(receipt["canonicalHash"]);
      expect(meme!.canonicalHash).toBe(carrierHash(body));
    });
  }

  test("a delete under the base a get reported removes the bare hold from the working layer", async () => {
    const { opts } = wikiWithWorkingLayer("lares");
    await makeMemePutReactor(opts)({ recipe: "lares", uri: URI, text: "a body\n" }, ctx());
    const got = await makeMemeGetReactor(opts)({ recipe: "lares", uri: URI }, ctx("r2"));
    const base = (got["meme"] as { canonicalHash: string }).canonicalHash;
    const gone = await makeMemeDeleteReactor(opts)({ recipe: "lares", uri: URI, base }, ctx("r3"));
    expect(gone["decision"]).toBe("removed");
    expect((await makeMemeGetReactor(opts)({ recipe: "lares", uri: URI }, ctx("r4")))["meme"]).toBeNull();
  });

  test("CONTROL: a framed carrier reads back with the hash the put reported", async () => {
    const { opts } = wikiWithWorkingLayer("lares");
    const receipt = await makeMemePutReactor(opts)({ recipe: "lares", uri: URI, text: framed(URI, ["a"]) }, ctx());
    expect(receipt["decision"]).toBe("ingest");
    const got = await makeMemeGetReactor(opts)({ recipe: "lares", uri: URI }, ctx("r2"));
    const meme = got["meme"] as { text: string; canonicalHash: string };
    expect(meme.canonicalHash).toBe(receipt["canonicalHash"]);
    expect(meme.text).toContain("<<~ ahu #/a>>");
  });

  test("REFUSAL: a torn frame answers refuse, names the tear, and the working layer stays empty", async () => {
    const { opts, working } = wikiWithWorkingLayer("lares");
    const receipt = await makeMemePutReactor(opts)({ recipe: "lares", uri: URI, text: TORN }, ctx());
    expect(receipt["decision"]).toBe("refuse");
    expect(receipt["landed"]).toEqual([]);
    expect((receipt["warnings"] as string[]).length).toBeGreaterThan(0);
    expect(await working.listVisible()).toEqual([]);
  });

  test("REFUSAL: meme-get over a pointer whose body rests in the content tier refuses by name", async () => {
    const { opts, working } = wikiWithWorkingLayer("lares");
    await working.put({ tiddler: { title: URI, type: "image/png", _is_skinny: "yes", textCid: "ab".repeat(32) }, meta: {} }, { kind: "lares-verb", requestId: "seed" }, { bag: wikiSlotUri("lares", "working") });
    const refusal = await makeMemeGetReactor(opts)({ recipe: "lares", uri: URI }, ctx("r2")).catch((e: unknown) => e) as { name?: string; reason?: string; message?: string };
    expect(refusal.name).toBe("VerbRefusal");
    expect(refusal.reason).toBe("pointer-body");
    expect(refusal.message).toContain(URI);
  });

  test("REFUSAL: meme-project over that pointer refuses under the same name, and the in-VM face read refuses too", async () => {
    const { opts, working } = wikiWithWorkingLayer("lares");
    await working.put({ tiddler: { title: URI, type: "image/png", _is_skinny: "yes", textCid: "ab".repeat(32) }, meta: {} }, { kind: "lares-verb", requestId: "seed" }, { bag: wikiSlotUri("lares", "working") });
    const refusal = await makeMemeProjectReactor(opts)({ recipe: "lares", uri: URI, to: "mem" }, ctx("r2")).catch((e: unknown) => e) as { name?: string; reason?: string };
    expect(refusal.name).toBe("VerbRefusal");
    expect(refusal.reason).toBe("pointer-body");

    const w = routeWiki();
    w.store.set(URI, { title: URI, type: "image/png", _is_skinny: "yes", textCid: "ab".repeat(32) } as TiddlerFields);
    await expect(memeFaceOf(w as never).read(URI)).rejects.toThrow(/pointer-body/);
    // The anchor seat (the daemon's own wiki) refuses before its face renders anything.
    let rendered = 0;
    const anchorOpts = {
      ...opts,
      tw5: { $tw: { wiki: { ...w, getTiddlerText: () => "lar:///ha.ka.ba/wikis/daemon/working" }, lares: { meme: { project: () => { rendered++; return { text: "" }; } } } } },
    } as unknown as MemeVerbOptions;
    const atAnchor = await makeMemeProjectReactor(anchorOpts)({ recipe: "default", uri: URI, to: "mem" }, ctx("r3")).catch((e: unknown) => e) as { name?: string; reason?: string };
    expect(atAnchor.reason).toBe("pointer-body");
    expect(rendered).toBe(0);
    // CONTROL: the face reads a bare hold as its bytes.
    w.store.set(URI, { title: URI, type: "text/plain", text: "a body\n" } as TiddlerFields);
    expect((await memeFaceOf(w as never).read(URI))!.text).toBe("a body\n");
  });

  test("REFUSAL: a put that carries no text refuses by name", async () => {
    const { opts } = wikiWithWorkingLayer("lares");
    await expect(makeMemePutReactor(opts)({ recipe: "lares", uri: URI, text: "" }, ctx())).rejects.toThrow(/args\.text is required/);
  });
});

// ---------------------------------------------------------------------------
// The route skins: the same law over TW5's route contract
// ---------------------------------------------------------------------------

interface Reply { status: number; headers: Record<string, string>; body: string }

function routeWiki() {
  const store = new Map<string, TiddlerFields>();
  return {
    store,
    allTitles: () => [...store.keys()],
    getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t)! } : undefined),
    addTiddler: (f: TiddlerFields) => { store.set(String(f.title), f); },
    deleteTiddler: (t: string) => { store.delete(t); },
  };
}

function fire(route: { handler: (req: never, res: never, state: never) => void }, w: ReturnType<typeof routeWiki>, data = ""): Promise<Reply> {
  return new Promise((resolve) => {
    const reply: Reply = { status: 0, headers: {}, body: "" };
    const response = {
      writeHead: (status: number, headers: Record<string, string>) => { reply.status = status; reply.headers = headers; },
      end: (body?: string) => { reply.body = body ?? ""; resolve(reply); },
    };
    route.handler({ headers: {} } as never, response as never, { wiki: w, params: ["bags", "default", "lar", "t.title.plain/one"], data } as never);
  });
}

describe("the route skins hold the same law", () => {
  test("PUT lands a frameless body and GET serves it byte for byte under the same tag", async () => {
    const w = routeWiki();
    const put = await fire(putRoute, w, "a body\n");
    expect(put.status).toBe(200);
    expect(JSON.parse(put.body).decision).toBe("ingest");
    const got = await fire(getRoute, w);
    expect(got.status).toBe(200);
    expect(got.body).toBe("a body\n");
    expect(got.headers["ETag"]).toBe(put.headers["ETag"]);
  });

  test("REFUSAL: PUT of no bytes answers 422, names `empty-body`, and the wiki stays empty", async () => {
    const w = routeWiki();
    const put = await fire(putRoute, w, "");
    expect(put.status).toBe(422);
    expect(JSON.parse(put.body).diagnostics.map((d: { code: string }) => d.code)).toEqual([EMPTY_BODY_CODE]);
    expect(w.store.size).toBe(0);
    expect((await fire(getRoute, w)).status).toBe(404);
  });

  test("REFUSAL: GET over a pointer whose body this wiki holds none of answers 422 and names it", async () => {
    const w = routeWiki();
    w.store.set(URI, { title: URI, type: "image/png", _is_skinny: "yes", textCid: "ab".repeat(32) } as TiddlerFields);
    const got = await fire(getRoute, w);
    expect(got.status).toBe(422);
    expect(got.body).toContain("pointer-body");
    expect(got.body).toContain(URI);
  });
});
