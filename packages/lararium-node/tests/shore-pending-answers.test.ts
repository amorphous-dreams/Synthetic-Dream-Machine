/**
 * PENDING REMOVALS, AT THE GATE'S EDGE CASES AND THROUGH THE ANSWER DOOR.
 *
 * The walk (`shore-vanished-file-pends`) tells a person's act over the real legs. These vectors pin the
 * narrower states a walk passes by, over a stub wiki:
 *
 *   · a content file whose `.meta` left reads as a disk state of its own, never as a vanished carrier: a
 *     hand's body stays, and `restore` reaches no such file;
 *   · a carrier re-sited to a path that holds no file takes a first projection there (the base stands at
 *     the earlier path), while the same absence at the base's own path pends;
 *   · the shore verb's `sense`, `restore` and `remove` acts, their count handshake and their bag reading.
 */
import { describe, test, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { carrierHash } from "@lararium/mesh";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import { answerShore } from "../src/shore-verb.js";
import type { TW5Engine, CarrierFile } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const OTHER = "lararium";
const uriOf = (n: string): string => `lar:///ha.ka.ba/probe/${n}`;
const RENDER = (uri: string): string => `title: ${uri}\n\nWHAT THE RECORDS SAY\n`;

interface Stand {
  projector: LarDiskProjector; tree: SyncedTree; live: Map<string, string>; removed: string[];
  pendings: Array<{ bagId: string; key: string; count: number }>; cleared: string[]; conflicts: string[];
  file: (uri: string, bag?: string) => string; files: Map<string, CarrierFile>;
}

function stand(uris: readonly string[], bagOf: (uri: string) => string = () => BAG): Stand {
  root = mkdtempSync(join(tmpdir(), "lar-shore-pending-"));
  const tree = new SyncedTree(join(root, ".projection", "synced-tree.json"), 0);
  const live = new Map(uris.map((uri) => [uri, bagOf(uri)] as const));
  const files = new Map<string, CarrierFile>();
  const removed: string[] = [];
  const pendings: Stand["pendings"] = [];
  const cleared: string[] = [];
  const conflicts: string[] = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: join(root, BAG) }, { bagId: OTHER, mirrorRoot: join(root, OTHER) }],
    carrierFileFn: async (uri) => files.get(uri) ?? { ext: MEME_EXT, body: RENDER(uri), encoding: "utf8" },
    syncedTree: tree,
    onConflict: (info) => { conflicts.push(info.uri); },
    onPendingRemoval: (info) => { pendings.push({ bagId: info.bagId, key: info.key, count: info.count }); },
    onPendingRemovalResolved: (info) => { cleared.push(info.key); },
    removeCarrier: (uri) => { removed.push(uri); live.delete(uri); },
  });
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (live.has(title) ? { fields: { title, "$origin-bag": live.get(title) } } : undefined),
    allTitles: () => [...live.keys()],
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  projector.start(engine);
  const file = (uri: string, bag = bagOf(uri)): string => join(root, bag, `${uri.slice("lar:///".length)}${MEME_EXT}`);
  return { projector, tree, live, removed, pendings, cleared, conflicts, file, files };
}

describe("a content file whose sidecar left never reads as a vanished carrier", () => {
  const URI = uriOf("sidecar");
  const META = "title: lar:///ha.ka.ba/probe/sidecar\ntype: text/markdown\n";
  const BODY = "# what the records say\n";

  async function standSidecar(): Promise<Stand & { md: string }> {
    const s = stand([URI]);
    s.files.set(URI, { ext: ".md", body: BODY, metaBody: META, encoding: "utf8" });
    await s.projector.idle();
    const md = join(root, BAG, "ha.ka.ba/probe/sidecar.md");
    expect(readFileSync(md, "utf-8")).toBe(BODY);
    expect(readFileSync(`${md}.meta`, "utf-8")).toBe(META);
    return { ...s, md };
  }

  test("the `.meta` vanished and a hand edited the body: nothing writes, nothing pends, and `restore` reaches no such file", async () => {
    const s = await standSidecar();
    rmSync(`${s.md}.meta`);
    writeFileSync(s.md, "# A HAND'S OWN BODY\n", "utf-8");
    await s.projector.sense();
    expect(readFileSync(s.md, "utf-8")).toBe("# A HAND'S OWN BODY\n");
    expect(existsSync(`${s.md}.meta`)).toBe(false);
    expect(s.projector.pendingRemovals()).toEqual([]);
    expect(await s.projector.answerRemovals("restore", BAG, { uris: [URI] })).toMatchObject({ ok: false, refusal: "not-pending" });
    expect(readFileSync(s.md, "utf-8")).toBe("# A HAND'S OWN BODY\n");
  });

  test("CONTROL: the content file itself vanished: the carrier pends, and `restore` writes body and sidecar back", async () => {
    const s = await standSidecar();
    rmSync(s.md);
    await s.projector.sense();
    expect(existsSync(s.md)).toBe(false);
    expect(s.projector.pendingRemovals().map((p) => p.uri)).toEqual([URI]);
    expect(await s.projector.answerRemovals("restore", BAG, { uris: [URI] })).toMatchObject({ ok: true, done: [URI], left: [] });
    expect(readFileSync(s.md, "utf-8")).toBe(BODY);
    expect(readFileSync(`${s.md}.meta`, "utf-8")).toBe(META);
  });
});

describe("a base stands at one path", () => {
  test("an absence at a path the base never named takes a first projection; the same absence at the base's path pends", async () => {
    const URI = uriOf("resited");
    const s = stand([URI]);
    // The agreement stood at a path a siting rule once named; the carrier sites at its loci path, where no file stands.
    s.tree.set(syncedTreeKey(BAG, URI), join(root, BAG, "ruled/elsewhere.mem"), carrierHash(RENDER(URI)));
    await s.projector.idle();
    expect(readFileSync(s.file(URI), "utf-8")).toBe(RENDER(URI));
    expect(s.projector.pendingRemovals()).toEqual([]);
    expect(s.tree.baseAt(syncedTreeKey(BAG, URI), s.file(URI))).not.toBeNull();
    // That very file leaves: the base now stands at its path, so the carrier pends.
    rmSync(s.file(URI));
    await s.projector.sense([URI]);
    expect(existsSync(s.file(URI))).toBe(false);
    expect(s.projector.pendingRemovals().map((p) => p.uri)).toEqual([URI]);
  });
});

describe("the shore verb answers pending removals", () => {
  const A = uriOf("a"), B = uriOf("b"), C = uriOf("c"), X = uriOf("x");

  async function vanished(): Promise<Stand> {
    const s = stand([A, B, C, X], (uri) => (uri === X ? OTHER : BAG));
    await s.projector.idle();
    for (const uri of [A, B, C, X]) rmSync(s.file(uri));
    return s;
  }

  test("sense looks at the named carriers, the alert names the count once, and list shows what stands", async () => {
    const s = await vanished();
    expect(await answerShore(s.projector, { op: "sense", uris: [A, B] })).toMatchObject({ ok: true, pendingCount: 2 });
    expect(s.pendings.map((p) => [p.bagId, p.count])).toEqual([[BAG, 2]]);
    // No carrier named = every carrier this island mirrors.
    expect(await answerShore(s.projector, { op: "sense" })).toMatchObject({ ok: true, pendingCount: 4 });
    expect(s.pendings.map((p) => [p.bagId, p.count])).toEqual([[BAG, 2], [BAG, 3], [OTHER, 1]]);
    expect(s.cleared).toEqual([s.pendings[0]!.key]);
    const listed = await answerShore(s.projector, { op: "list", bag: OTHER });
    expect(listed).toMatchObject({ ok: true, pendingCount: 1, pending: [{ bagId: OTHER, uri: X }] });
    expect(await answerShore(s.projector, { op: "sense", uris: "all of them" })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
  });

  test("list looks first: a file a hand put back since reads as standing, with no answer", async () => {
    const s = await vanished();
    await answerShore(s.projector, { op: "sense" });
    writeFileSync(s.file(A), RENDER(A), "utf-8");
    expect(await answerShore(s.projector, { op: "list", bag: BAG })).toMatchObject({ pendingCount: 2, pending: [{ uri: B }, { uri: C }] });
  });

  test("restore and remove each answer the bag that holds what a person named; two bags never fold into one answer", async () => {
    const s = await vanished();
    await answerShore(s.projector, { op: "sense" });
    expect(await answerShore(s.projector, { op: "restore", all: true, count: 4 })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    expect(await answerShore(s.projector, { op: "restore", uris: [X] })).toEqual({ ok: true, op: "restore", bag: OTHER, done: [X], left: [] });
    expect(readFileSync(s.file(X), "utf-8")).toBe(RENDER(X));
    // With one bag left pending, `all` reads that bag, under the count that stands there.
    expect(await answerShore(s.projector, { op: "remove", all: true, count: 2 })).toMatchObject({ ok: false, refusal: "pending-count-moved", count: 3 });
    expect(s.removed).toEqual([]);
    expect(await answerShore(s.projector, { op: "remove", uris: [A] })).toEqual({ ok: true, op: "remove", bag: BAG, done: [A], left: [] });
    expect(s.removed).toEqual([A]);
    expect(existsSync(s.file(A))).toBe(false);
    expect(await answerShore(s.projector, { op: "remove", all: true, count: 2 })).toMatchObject({ ok: true, done: [B, C] });
    expect(s.removed).toEqual([A, B, C]);
    expect(s.projector.pendingRemovals()).toEqual([]);
    // The base stays: a carrier that returns from beneath its tombstone asks its person afresh.
    expect(s.tree.baseAt(syncedTreeKey(BAG, A), s.file(A))).not.toBeNull();
    s.live.set(A, BAG);
    await s.projector.sense([A]);
    expect(existsSync(s.file(A))).toBe(false);
    expect(s.projector.pendingRemovals().map((p) => p.uri)).toEqual([A]);
  });

  test("CONTROL: a carrier in no pending removal, an answer naming both a carrier and all, and a projector with no delete door each refuse", async () => {
    const s = await vanished();
    await answerShore(s.projector, { op: "sense", uris: [A] });
    expect(await answerShore(s.projector, { op: "restore", uris: [B] })).toMatchObject({ ok: false, refusal: "not-pending" });
    expect(await answerShore(s.projector, { op: "restore", uris: [A], all: true })).toMatchObject({ ok: false, refusal: "shore-answer-incomplete" });
    const bare = new LarDiskProjector({ mirrors: [{ bagId: BAG, mirrorRoot: join(root, "bare") }], carrierFileFn: async (uri) => ({ ext: MEME_EXT, body: RENDER(uri), encoding: "utf8" }) });
    const live = new Set([A]);
    bare.start({ $tw: { wiki: { getTiddler: (t: string) => (live.has(t) ? { fields: { title: t, "$origin-bag": BAG } } : undefined), allTitles: () => [...live], addEventListener: () => {}, removeEventListener: () => {} } } } as unknown as TW5Engine);
    await bare.idle();
    const written = join(root, "bare", `${A.slice("lar:///".length)}${MEME_EXT}`);
    mkdirSync(dirname(written), { recursive: true });
    rmSync(written);
    await bare.sense([A]);
    expect(await bare.answerRemovals("remove", BAG, { uris: [A] })).toMatchObject({ ok: false, refusal: "no-delete-door" });
    expect(bare.pendingRemovals().map((p) => p.uri)).toEqual([A]);
  });
});

describe("a sidecar standing alone", () => {
  const URI = uriOf("pointer");
  const META = "title: lar:///ha.ka.ba/probe/pointer\ntype: image/png\n";
  const pointer = (meta = META): CarrierFile => ({ ext: ".png", body: "", metaBody: meta, encoding: "base64", pointerCid: "ab".repeat(32) });

  test("a pending pointer's sidecar that a hand edited stands off: no write replaces it unread", async () => {
    const s = stand([URI]);
    s.files.set(URI, pointer());
    await s.projector.idle();
    const sidecar = join(root, BAG, "ha.ka.ba/probe/pointer.png.meta");
    expect(readFileSync(sidecar, "utf-8")).toBe(META);
    expect(existsSync(join(root, BAG, "ha.ka.ba/probe/pointer.png"))).toBe(false);

    // The records' sidecar moves while the disk's stands where the base left it: the write applies.
    s.files.set(URI, pointer(`${META}caption: from the records\n`));
    await s.projector.sense([URI]);
    expect(readFileSync(sidecar, "utf-8")).toContain("caption: from the records");
    expect(s.conflicts).toEqual([]);

    // A hand edits the sidecar, and the records move again: both moved, so nothing writes.
    writeFileSync(sidecar, `${META}caption: A HAND'S OWN CAPTION\n`, "utf-8");
    s.files.set(URI, pointer(`${META}caption: the records, later\n`));
    await s.projector.sense([URI]);
    expect(readFileSync(sidecar, "utf-8")).toContain("A HAND'S OWN CAPTION");
    expect(s.conflicts).toEqual([URI]);
  });

  test("a resolved pointer whose body a hand deleted stays deleted while its bytes fail to resolve, and pends once they return", async () => {
    const s = stand([URI]);
    const BYTES = Buffer.from("the pointer's own bytes");
    const { sha256HexBytesSync } = await import("@lararium/mesh");
    const cid = sha256HexBytesSync(BYTES);
    let tierHolds = true;
    const resolved: CarrierFile = { ext: ".txt", body: "", metaBody: META, encoding: "utf8", pointerCid: cid };
    await s.projector.stop();
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: BAG, mirrorRoot: join(root, BAG) }],
      carrierFileFn: async () => resolved,
      resolveByCid: async () => (tierHolds ? new Uint8Array(BYTES) : null),
      syncedTree: s.tree,
    });
    projector.start({ $tw: { wiki: { getTiddler: (t: string) => (t === URI ? { fields: { title: t, "$origin-bag": BAG } } : undefined), allTitles: () => [URI], addEventListener: () => {}, removeEventListener: () => {} } } } as unknown as TW5Engine);
    await projector.idle();
    const body = join(root, BAG, "ha.ka.ba/probe/pointer.txt");
    expect(readFileSync(body, "utf-8")).toBe("the pointer's own bytes");

    rmSync(body);                       // a hand deletes the body; its sidecar stays
    tierHolds = false;                  // and the content tier loses the bytes for a while
    await projector.sense([URI]);
    expect(existsSync(body)).toBe(false);
    tierHolds = true;                   // the bytes return
    await projector.sense([URI]);
    // No write brought the deleted body back: the carrier pends for its person.
    expect(existsSync(body)).toBe(false);
    expect(projector.pendingRemovals().map((p) => p.uri)).toEqual([URI]);
  });

  test("a lone sidecar a hand left at a path the carrier leaves stays; one the projector wrote under a pending pointer leaves", async () => {
    const s = stand([URI]);
    s.files.set(URI, pointer());
    await s.projector.idle();
    const sidecar = join(root, BAG, "ha.ka.ba/probe/pointer.png.meta");
    // CONTROL: the records drop the carrier while its sidecar stands as the projector wrote it.
    s.live.delete(URI);
    await s.projector.sense([URI]);
    expect(existsSync(sidecar)).toBe(false);

    // A body-bearing carrier whose body vanished leaves a sidecar no base can vouch for alone.
    const MD = uriOf("lone");
    s.files.set(MD, { ext: ".md", body: "# body\n", metaBody: "title: lone\n", encoding: "utf8" });
    s.live.set(MD, BAG);
    await s.projector.sense([MD]);
    const md = join(root, BAG, "ha.ka.ba/probe/lone.md");
    rmSync(md);
    writeFileSync(`${md}.meta`, "title: lone\nnote: A HAND WROTE THIS\n", "utf-8");
    s.live.delete(MD);
    await s.projector.sense([MD]);
    expect(readFileSync(`${md}.meta`, "utf-8")).toContain("A HAND WROTE THIS");
  });
});
