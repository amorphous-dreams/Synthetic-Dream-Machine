/**
 * MEME SINKS — the store skins of `placeMeme`.
 *
 * `placeMeme` speaks four verbs over whatever holds tiddlers. These sinks hand it a `LarTiddlerStore`
 * (a bag's own doc, reached by access) and a bag in a `CompositeStore` (a mounted writable layer). The
 * laws under test: a landed record carries the bag it landed in · a tombstoned title leaves the
 * sink's title list and reads as absent · an unwritable bag fails loud, naming the bag, and never
 * shadows up to the default writable.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, type ChangeOrigin } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { placeMeme, readMeme } from "../src/place-meme.js";
import { storeMemeSink, compositeMemeSink } from "../src/meme-sinks.js";

const URI = "lar:///t/x";
const ORIGIN: ChangeOrigin = { kind: "lares-verb", requestId: "r-test" };

const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

describe("storeMemeSink — placeMeme over one bag's own store", () => {
  test("a fresh meme lands its group as records; residency rides the store, never a stamped field", async () => {
    const bag = bagUri("sdm");
    const store = new MemoryTiddlerStore(bag);
    const r = await placeMeme({ uri: URI, text: meme(["a", "b"]) }, storeMemeSink(store, bag, ORIGIN));
    expect(r.decision).toBe("ingest");
    expect((await store.listVisible()).sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    expect((await store.get(`${URI}#/a`))?.tiddler["bag"]).toBeUndefined();
  });

  test("★ a dropped slot tombstones: it leaves the title list AND reads as absent ★", async () => {
    const bag = bagUri("sdm");
    const store = new MemoryTiddlerStore(bag);
    const sink = storeMemeSink(store, bag, ORIGIN);
    await placeMeme({ uri: URI, text: meme(["a", "b"]) }, sink);
    const r = await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    expect(r.tombstoned).toEqual([`${URI}#/b`]);
    expect(await sink.titles()).not.toContain(`${URI}#/b`);
    // The store keeps the kāpae record; the sink reads it as gone.
    expect((await store.get(`${URI}#/b`))?.meta?.deleted).toBe(true);
    expect(await sink.read(`${URI}#/b`)).toBeUndefined();
  });

  test("readMeme round-trips the text and hands back the base the next writer needs", async () => {
    const bag = bagUri("sdm");
    const sink = storeMemeSink(new MemoryTiddlerStore(bag), bag, ORIGIN);
    const put = await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    const got = await readMeme(URI, sink);
    expect(got?.canonicalHash).toBe(put.canonicalHash);
    const again = await placeMeme({ uri: URI, text: meme(["a", "z"]), baseHash: got!.canonicalHash }, sink);
    expect(again.decision).toBe("ingest");
  });

  test("CONTROL: readMeme over an empty store reads null", async () => {
    const bag = bagUri("sdm");
    expect(await readMeme(URI, storeMemeSink(new MemoryTiddlerStore(bag), bag, ORIGIN))).toBeNull();
  });
});

describe("compositeMemeSink — a bag the island mounts writable", () => {
  test("lands into the named writable layer, not the default writable", async () => {
    const composite = new CompositeStore();
    const top = new MemoryTiddlerStore(bagUri("top"));
    const sdm = new MemoryTiddlerStore(bagUri("sdm"));
    composite.addLayer({ bagId: bagUri("sdm"), store: sdm, writable: true, defaultWritable: false });
    composite.addLayer({ bagId: bagUri("top"), store: top, writable: true });
    expect(composite.defaultWritableBagId()).toBe(bagUri("top"));
    const r = await placeMeme({ uri: URI, text: meme(["a"]) }, compositeMemeSink(composite, bagUri("sdm"), ORIGIN));
    expect(r.decision).toBe("ingest");
    expect(await sdm.listVisible()).toContain(URI);
    expect(await top.listVisible()).toEqual([]);
  });

  test("★ an unmounted bag fails loud, naming the bag — never a shadow-up ★", () => {
    const composite = new CompositeStore();
    composite.addLayer({ bagId: bagUri("top"), store: new MemoryTiddlerStore(bagUri("top")), writable: true });
    expect(() => compositeMemeSink(composite, bagUri("nope"), ORIGIN)).toThrow(bagUri("nope"));
  });

  test("CONTROL: a READ-ONLY layer of the bag fails the same way (a residency placement never copies up)", () => {
    const composite = new CompositeStore();
    composite.addLayer({ bagId: bagUri("lib"), store: new MemoryTiddlerStore(bagUri("lib")), writable: false });
    composite.addLayer({ bagId: bagUri("top"), store: new MemoryTiddlerStore(bagUri("top")), writable: true });
    expect(() => compositeMemeSink(composite, bagUri("lib"), ORIGIN)).toThrow(bagUri("lib"));
  });
});
