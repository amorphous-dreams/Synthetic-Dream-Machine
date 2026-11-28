/**
 * foreign-title-projection — a tiddler whose title is not a `lar:` URI lands on disk.
 *
 * Two halves.
 *
 * ① THE FORM CUT. The change handler used to read `if (!title.startsWith("lar:")) continue;` — a
 *    withholding by FORM, the same move canon refused for hostful URIs. The volatile-residency bar
 *    (the in-wiki cascade's named withholding, `isVolatileVmUri`, and the mirror roster) stays the
 *    only bar: a title reaches the gate, and `reconcile` drops it when its `$origin-bag` names no
 *    mirror.
 *
 * ② THE UNIQUIFIER. TW5's adaptor resolves a path collision by trying `title.tid`, `title_1.tid`, …
 *    until `fs.existsSync` reads free, and stays STABLE across restarts because `$tw.boot.files`
 *    holds the title→path assignment for the process's life. This projector holds no such registry —
 *    it reconciles per carrier root against settled VM state — so a naive `existsSync` loop would
 *    write `title.tid` on the first boot and `title_1.tid` on the second, growing one file per boot.
 *    The free-path test is therefore "absent OR ALREADY MINE", and MINE is proved FROM DISK: every
 *    native projection writes its own `title:` — in the `.tid` field block, in the `.json` array, or
 *    in the `.meta` sidecar. A format that carries no title (a flattened `.mem`) cannot prove it, and
 *    an OCCUPIED candidate there REFUSES loudly rather than clobber or grow.
 *
 * ③ DRAFT MIRRORS. A draft bag projects as an ordinary mirror: its own records render through `recordFileFn` off the
 *    bag's store, a shadow in the view notwithstanding, and a draft that leaves takes its file with it.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { vendoredCore } from "../../lararium-tw5/tests/test-wiki.js";
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import type { CarrierFile } from "@lararium/tw5";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { afterDispatch, draftBag, openDraft, shoreRig, turns, typeInto } from "../../lararium-tw5/tests/wiki-shore-rig.js";
import { makeReceiptCapability } from "../../lararium-tw5/src/receipt.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

type Flushable = {
  flush: (b: string, u: string) => Promise<void>;
  _scheduleUnlinkByTitle: (t: string) => Promise<void>;
  start: (tw5: unknown) => () => void;
};

/** A `.tid` body exactly as `makeTw5FileInfo` writes one: the field block names the title. */
function tidBody(title: string, text: string): string {
  return `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${text}`;
}

function rig(file: (uri: string) => CarrierFile | null, refusals: string[] = []): { projector: Flushable; root: string } {
  root = mkdtempSync(join(tmpdir(), "lar-foreign-title-"));
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "wiki", mirrorRoot: root }],
    carrierFileFn: async (uri) => file(uri),
    onRefusal: (r) => refusals.push(r.reason),
  }) as unknown as Flushable;
  return { projector, root };
}

/** A second projector over the SAME root — the "restart" (a fresh, empty `sited` memory). */
function restart(mirrorRoot: string, file: (uri: string) => CarrierFile | null, refusals: string[] = []): Flushable {
  return new LarDiskProjector({
    mirrors: [{ bagId: "wiki", mirrorRoot }],
    carrierFileFn: async (uri) => file(uri),
    onRefusal: (r) => refusals.push(r.reason),
  }) as unknown as Flushable;
}

const nativeFile = (title: string, text: string): CarrierFile => ({
  ext: ".tid",
  body: tidBody(title, text),
  defaultRelPath: `${title.replace(/\/|\\/g, "_")}.tid`,
});

test("a held durable receipt plus a production boundary never opens a parallel write", async () => {
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const reached = new Promise<void>((resolve) => { started = resolve; });
  let first = true;
  const capability = makeReceiptCapability({
    post: (message) => {
      if (message.type !== "receipt:request") return;
      if (first) {
        first = false;
        started();
        void (async () => { await held; capability.answer({ type: "receipt:issued", requestId: message.requestId, issued: true }); })();
        return;
      }
      capability.answer({ type: "receipt:issued", requestId: message.requestId, issued: true });
    },
    handles: () => new Map(Object.entries(r.handles)),
  });
  r.adaptor.caps.receipt = capability;
  const title = openDraft(r, "Boundary receipt", "first");
  const count = () => r.calls.filter((call) => call.bag === draftBag && call.puts.includes(title)).length;
  try {
    await afterDispatch();
    await reached;
    typeInto(r, title, "latest");
    await afterDispatch();
    const boundary = r.adaptor.boundary();
    await turns(30);
    expect(count(), "the boundary opened a second write before the first durable receipt landed").toBe(1);
    release();
    await boundary;
    for (let i = 0; i < 200 && count() < 2; i++) await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(count()).toBe(2);
  } finally {
    release();
    capability.close();
    r.adaptor.caps.receipt = null;
    await r.stop();
  }
}, 60_000);


describe("foreign-title projection — the form cut", () => {
  test("★ a tiddler titled `My Notes` projects to disk ★", async () => {
    const { projector, root } = rig(() => nativeFile("My Notes", "a plain title.\n"));
    await projector.flush("wiki", "My Notes");
    expect(existsSync(join(root, "My Notes.tid"))).toBe(true);
    expect(readFileSync(join(root, "My Notes.tid"), "utf8")).toContain("a plain title.");
  });

  test("★ the change handler admits a foreign title by FORM ★", async () => {
    const { projector } = rig(() => null);
    const marked: string[] = [];
    let handler: ((c: Record<string, unknown>) => void) | undefined;
    const fakeTw5 = {
      $tw: {
        wiki: {
          getTiddler: () => undefined,
          addEventListener: (_e: string, h: (c: Record<string, unknown>) => void) => { handler = h; },
          removeEventListener: () => {},
        },
      },
    };
    const stop = projector.start(fakeTw5);
    // The handler closes over the gate the projector built; patch that object's `mark` in place.
    const gate = (projector as unknown as { gate: { mark: (k: string) => void } }).gate;
    gate.mark = (k) => marked.push(k);
    handler?.({ "My Notes": {}, "lar:///ha.ka.ba/lares/api/x": {}, "$:/state/tab": {} });
    await stop();
    expect(marked).toContain("My Notes");
    expect(marked).toContain("lar:///ha.ka.ba/lares/api/x");
  });
});

describe("foreign-title projection — the uniquifier", () => {
  test("★ two titles that sanitize alike each keep their own file ★", async () => {
    const bodies: Record<string, string> = { "A/B": "slash.\n", "A_B": "underscore.\n" };
    const { projector, root } = rig((uri) => nativeFile(uri, bodies[uri]!));
    await projector.flush("wiki", "A/B");
    await projector.flush("wiki", "A_B");
    const files = readdirSync(root).sort();
    expect(files).toEqual(["A_B.tid", "A_B_1.tid"]);
    // and NEITHER overwrote the other
    const all = files.map((f) => readFileSync(join(root, f), "utf8")).join("\n");
    expect(all).toContain("slash.");
    expect(all).toContain("underscore.");
  });

  test("★ project · restart · project — the SAME file, never `_1` ★", async () => {
    const { projector, root } = rig(() => nativeFile("My Notes", "a plain title.\n"));
    await projector.flush("wiki", "My Notes");
    for (let boot = 0; boot < 3; boot++) {
      await restart(root, () => nativeFile("My Notes", "a plain title.\n")).flush("wiki", "My Notes");
    }
    expect(readdirSync(root).sort()).toEqual(["My Notes.tid"]);
  });

  test("a collided pair survives a restart at ITS OWN count — the disk title proves ownership", async () => {
    const bodies: Record<string, string> = { "A/B": "slash.\n", "A_B": "underscore.\n" };
    const mk = (uri: string) => nativeFile(uri, bodies[uri]!);
    const { projector, root } = rig(mk);
    await projector.flush("wiki", "A/B");
    await projector.flush("wiki", "A_B");
    const before = readFileSync(join(root, "A_B_1.tid"), "utf8");
    const second = restart(root, mk);
    await second.flush("wiki", "A_B");
    await second.flush("wiki", "A/B");
    expect(readdirSync(root).sort()).toEqual(["A_B.tid", "A_B_1.tid"]);
    expect(readFileSync(join(root, "A_B_1.tid"), "utf8")).toBe(before);
  });

  test("a `.meta` sidecar proves ownership for a content filetype", async () => {
    const mk = (uri: string): CarrierFile => ({
      ext: ".png",
      body: "AAAA",
      metaBody: `title: ${uri}\ntype: image/png\n`,
      defaultRelPath: `${uri.replace(/\//g, "_")}.png`,
    });
    const { projector, root } = rig(mk);
    await projector.flush("wiki", "a/shot");
    await projector.flush("wiki", "a_shot");
    expect(readdirSync(root).sort()).toEqual(["a_shot.png", "a_shot.png.meta", "a_shot_1.png", "a_shot_1.png.meta"]);
    await restart(root, mk).flush("wiki", "a/shot");
    expect(readdirSync(root).sort()).toEqual(["a_shot.png", "a_shot.png.meta", "a_shot_1.png", "a_shot_1.png.meta"]);
  });

  test("★ nothing on disk can prove ownership → the write REFUSES, it never clobbers ★", async () => {
    const refusals: string[] = [];
    const { projector, root } = rig(() => ({ ext: ".mem", body: "mine\n", defaultRelPath: "loose meme.mem" }), refusals);
    writeFileSync(join(root, "loose meme.mem"), "someone else's bytes\n", "utf8");
    await projector.flush("wiki", "loose meme");
    expect(readFileSync(join(root, "loose meme.mem"), "utf8")).toBe("someone else's bytes\n");
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain("ownership");
  });

  test("an unprovable format still writes when the candidate is FREE", async () => {
    const { projector, root } = rig(() => ({ ext: ".mem", body: "mine\n", defaultRelPath: "loose meme.mem" }));
    await projector.flush("wiki", "loose meme");
    expect(readFileSync(join(root, "loose meme.mem"), "utf8")).toBe("mine\n");
  });

  test("a delete unlinks at the uniquified siting", async () => {
    const bodies: Record<string, string> = { "A/B": "slash.\n", "A_B": "underscore.\n" };
    const { projector, root } = rig((uri) => nativeFile(uri, bodies[uri]!));
    await projector.flush("wiki", "A/B");
    await projector.flush("wiki", "A_B");
    await projector._scheduleUnlinkByTitle("A_B");
    expect(readdirSync(root).sort()).toEqual(["A_B.tid"]);
    expect(readFileSync(join(root, "A_B.tid"), "utf8")).toContain("slash.");
  });
});

describe("foreign-title projection — the CONTROLs", () => {
  const LAR = "lar:///ha.ka.ba/lares/parity/note";

  test("★ CONTROL — a `lar:` carrier sites byte-identically at its uri-path ★", async () => {
    const { projector, root } = rig(() => ({
      ext: ".mem",
      body: "# note",
      // the flattened default rides now, and the address siting rule MUST still win
      defaultRelPath: "lar___ha.ka.ba_lares_parity_note.mem",
    }));
    await projector.flush("wiki", LAR);
    expect(readFileSync(join(root, "ha.ka.ba/lares/parity/note.mem"), "utf8")).toBe("# note");
    expect(existsSync(join(root, "lar___ha.ka.ba_lares_parity_note.mem"))).toBe(false);
  });

  test("CONTROL — a cascade rule still wins over the flattened default", async () => {
    const { projector, root } = rig(() => ({
      ext: ".md", body: "# note", metaBody: "type: text/markdown\n",
      relPath: "notes/note.md", defaultRelPath: "My Notes.md",
    }));
    await projector.flush("wiki", "My Notes");
    expect(existsSync(join(root, "notes/note.md"))).toBe(true);
    expect(existsSync(join(root, "My Notes.md"))).toBe(false);
  });

  test("fragment and bag-manifest titles project through their selected mirror", async () => {
    const { projector, root } = rig((uri) => ({
      ext: ".mem", body: "x", relPath: uri.includes("#") ? "placed/fragment.mem" : "placed/manifest.mem",
    }));
    await projector.flush("wiki", "lar:///ha.ka.ba/lares/parity/note#slot");
    await projector.flush("wiki", "lar:///ha.ka.ba/bags/lares");
    expect(readFileSync(join(root, "placed/fragment.mem"), "utf8")).toBe("x");
    expect(readFileSync(join(root, "placed/manifest.mem"), "utf8")).toBe("x");
  });

  test("CONTROL — a carrier with neither rule, loci, nor default sites nowhere", async () => {
    const { projector, root } = rig(() => ({ ext: ".tid", body: "x" }));
    await projector.flush("wiki", "My Notes");
    expect(readdirSync(root)).toEqual([]);
  });

  test("★ CONTROL — the residency bar, not the title's form, decides: a volatile-plane title never projects ★", async () => {
    // The volatile plane never persists (island-adaptor refuses it), so nothing there ever carries
    // an `$origin-bag` naming a mirror. Reconcile reads that stamp and drops what no mirror holds —
    // the same drop a `$:/state/…` tiddler routed to the unmirrored temp bag takes.
    const seen: string[] = [];
    root = mkdtempSync(join(tmpdir(), "lar-foreign-title-"));
    const tiddlers: Record<string, Record<string, string>> = {
      "lar:///lararium.local.vm/verb/act": { title: "lar:///lararium.local.vm/verb/act" },   // volatile: no stamp
      "$:/state/tab":                      { title: "$:/state/tab", "$origin-bag": "temp" }, // unmirrored bag
      "My Notes":                          { title: "My Notes", "$origin-bag": "wiki" },     // mirrored
    };
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "wiki", mirrorRoot: root }],
      carrierFileFn: async (uri) => { seen.push(uri); return nativeFile(uri, "x\n"); },
    });
    (projector as unknown as { _tw5: unknown })._tw5 = {
      $tw: { wiki: { getTiddler: (t: string) => (tiddlers[t] ? { fields: tiddlers[t] } : undefined) } },
    };
    const reconcile = (projector as unknown as { reconcile: (u: string) => Promise<void> }).reconcile.bind(projector);
    for (const t of Object.keys(tiddlers)) await reconcile(t);
    expect(seen).toEqual(["My Notes"]);
    expect(readdirSync(root).sort()).toEqual(["My Notes.tid"]);
  });

  test("CONTROL — a flattened path that escapes the mirror is refused by the disk ward", async () => {
    const refusals: string[] = [];
    const { projector, root } = rig(() => ({ ext: ".tid", body: "x", defaultRelPath: "../escape.tid" }), refusals);
    await projector.flush("wiki", "escape");
    expect(refusals.length).toBeGreaterThan(0);
    expect(existsSync(join(root, "..", "escape.tid"))).toBe(false);
  });
});

/** A draft bag's own store, holding `titles`, and the record renderer an ordinary mirror reads it through. */
async function draftLayer(titles: Record<string, string>): Promise<{ store: MemoryTiddlerStore; recordFileFn: (bag: string, uri: string) => Promise<CarrierFile | null> }> {
  const store = new MemoryTiddlerStore("draft");
  for (const [title, text] of Object.entries(titles)) await store.put({ tiddler: { title, text } }, { kind: "operator-import", sessionId: "test" });
  const recordFileFn = async (bag: string, uri: string): Promise<CarrierFile | null> => {
    const rec = bag === "draft" ? await store.get(uri) : null;
    return rec && !rec.meta?.deleted ? nativeFile(uri, String(rec.tiddler["text"] ?? "")) : null;
  };
  return { store, recordFileFn };
}

test("a draft mirror projects its own held draft as an ordinary mirror, even when the wiki view shadows it; a bag with no mirror stays off disk", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-draft-projection-"));
  const title = "Draft of 'Note'";
  const recovery = join(root, "recovery");
  const layer = await draftLayer({ [title]: "unsaved words" });
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "draft", mirrorRoot: recovery }],
    bagStore: (bag) => bag === "draft" ? layer.store : null,
    recordFileFn: layer.recordFileFn,
    bagsHolding: async (uri) => uri === title ? ["draft", "temp"] : ["temp"],
    carrierFileFn: async (uri) => nativeFile(uri, "private"),
  });
  (projector as unknown as { _tw5: unknown })._tw5 = { $tw: { wiki: { getTiddler: (uri: string) => ({ fields: { title: uri, "$origin-bag": "temp" } }) } } };
  const reconcile = (projector as unknown as { reconcile: (uri: string) => Promise<void> }).reconcile.bind(projector);
  await reconcile("temp-only");
  expect(existsSync(recovery)).toBe(false);
  await reconcile(title);
  expect(existsSync(recovery)).toBe(true);
  const files = readdirSync(recovery);
  expect(files).toHaveLength(1);
  expect(readFileSync(join(recovery, files[0]!), "utf8")).toBe(tidBody(title, "unsaved words"));
});

test("initial scan finds a shadowed draft in the draft bag's own records", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-draft-scan-"));
  const recovery = join(root, "recovery");
  const title = "Draft of 'Note'";
  const layer = await draftLayer({ [title]: "draft bytes" });
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "draft", mirrorRoot: recovery }],
    bagStore: (bag) => bag === "draft" ? layer.store : null,
    recordFileFn: layer.recordFileFn,
    bagsHolding: async (uri) => uri === title ? ["draft", "temp"] : ["temp"],
    carrierFileFn: async (uri) => nativeFile(uri, "private"),
  });
  const wiki = {
    allTitles: () => [title, "temp-only"],
    getTiddler: (uri: string) => ({ fields: { title: uri, "$origin-bag": "temp" } }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const stop = projector.start({ $tw: { wiki } } as never);
  try {
    await projector.idle();
    expect(existsSync(recovery)).toBe(true);
    const files = readdirSync(recovery);
    expect(files).toHaveLength(1);
    expect(readFileSync(join(recovery, files[0]!), "utf8")).toContain("draft bytes");
  } finally {
    await stop();
  }
});

test("CONTROL — initial scan leaves a title held only by an ungranted bag off disk", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-draft-scan-control-"));
  const recovery = join(root, "recovery");
  const layer = await draftLayer({});
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "draft", mirrorRoot: recovery }],
    bagStore: (bag) => bag === "draft" ? layer.store : null,
    recordFileFn: layer.recordFileFn,
    bagsHolding: async () => ["temp"],
    carrierFileFn: async (uri) => nativeFile(uri, "private"),
  });
  const wiki = {
    allTitles: () => ["temp-only"],
    getTiddler: (uri: string) => ({ fields: { title: uri, "$origin-bag": "temp" } }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const stop = projector.start({ $tw: { wiki } } as never);
  try {
    await projector.idle();
    expect(existsSync(recovery)).toBe(false);
  } finally {
    await stop();
  }
});

test("the mount projects the draft bag's own fields despite a shadow, and keeps other bags isolated", async () => {
  const { CompositeStore } = await import("@lararium/mesh/composite-store");
  const { MemoryTiddlerStore } = await import("../../lararium-tw5/src/memory-store.js");
  const { TW5Engine } = await import("../../lararium-tw5/src/tw5-vm.js");
  const { mountDiskProjection, mountedDiskProjector } = await import("../src/island-behaviors.js");
  root = mkdtempSync(join(tmpdir(), "lar-draft-record-"));
  const recovery = join(root, "recovery");
  const workingRoot = join(root, "working");
  const draft = new MemoryTiddlerStore("draft");
  const temp = new MemoryTiddlerStore("temp");
  const working = new MemoryTiddlerStore("working");
  const composite = new CompositeStore();
  composite.addLayer({ bagId: "working", store: working, writable: true });
  composite.addLayer({ bagId: "draft", store: draft, writable: true });
  composite.addLayer({ bagId: "temp", store: temp, writable: true });
  const origin = { kind: "operator-import", sessionId: "test" } as const;
  const title = "Draft of 'Note'";
  await draft.put({ tiddler: { title, text: "recovery words", "draft.of": "Note", "lar-draft-base-bag": "working", "lar-draft-base-heads": "abc" } }, origin);
  await temp.put({ tiddler: { title, text: "shadow secret" } }, origin);
  await temp.put({ tiddler: { title: "temp-only", text: "private secret" } }, origin);
  await working.put({ tiddler: { title: "Working note", text: "ordinary words" } }, origin);
  const engine = new TW5Engine();
  await engine.boot(vendoredCore());
  const tw = engine.$tw;
  tw.wiki.addTiddler(new tw.Tiddler({ title, text: "shadow secret", "$origin-bag": "temp" }));
  tw.wiki.addTiddler(new tw.Tiddler({ title: "temp-only", text: "private secret", "$origin-bag": "temp" }));
  tw.wiki.addTiddler(new tw.Tiddler({ title: "Working note", text: "ordinary words", "$origin-bag": "working" }));
  const stop = mountDiskProjection({ diskMirrors: [
    { bagId: "draft", mirrorRoot: recovery, scope: "draft" },
    { bagId: "working", mirrorRoot: workingRoot, scope: "working" },
  ] } as never, { tw5: engine, composite, post: () => {}, wikiUri: "test" } as never)!;
  try {
    await mountedDiskProjector()!.idle();
    const ordinary = readdirSync(workingRoot).map((f) => readFileSync(join(workingRoot, f), "utf8"));
    expect(ordinary.join("\n")).toContain("ordinary words");
    expect(ordinary.join("\n")).not.toContain("secret");
    expect(existsSync(recovery)).toBe(true);
    const files = readdirSync(recovery).map((f) => readFileSync(join(recovery, f), "utf8"));
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("recovery words");
    expect(files[0]).toContain("lar-draft-base-bag: working");
    expect(files[0]).toContain("lar-draft-base-heads: abc");
    expect(files[0]).not.toContain("secret");
    await temp.put({ tiddler: { title, text: "new shadow secret" } }, origin);
    await draft.put({ tiddler: { title, text: "updated recovery", "draft.of": "Note", "lar-draft-base-bag": "working", "lar-draft-base-heads": "def" } }, origin);
    await mountedDiskProjector()!.idle();
    const updated = readdirSync(recovery).map((f) => readFileSync(join(recovery, f), "utf8"));
    expect(updated).toHaveLength(1);
    expect(updated[0]).toContain("updated recovery");
    expect(updated[0]).toContain("lar-draft-base-heads: def");
    expect(updated[0]).not.toContain("secret");
  } finally { await stop(); }
}, 60_000);

test("a restart removes a tombstoned draft's file even when a different bag shadows its title", async () => {
  const { MemoryTiddlerStore } = await import("../../lararium-tw5/src/memory-store.js");
  root = mkdtempSync(join(tmpdir(), "lar-draft-tombstone-restart-"));
  const recovery = join(root, "recovery");
  const bases = join(root, "bases");
  const draft = new MemoryTiddlerStore("draft");
  const origin = { kind: "operator-import", sessionId: "test" } as const;
  const deleted = "Draft of 'Deleted'";
  const retained = "Draft of 'Retained'";
  await draft.put({ tiddler: { title: deleted, text: "remove me" } }, origin);
  await draft.put({ tiddler: { title: retained, text: "keep me" } }, origin);
  const wiki = {
    allTitles: () => [deleted, retained],
    getTiddler: (title: string) => ({ fields: { title, "$origin-bag": "temp" } }),
    addEventListener: () => {}, removeEventListener: () => {},
  };
  const mount = () => new LarDiskProjector({
    mirrors: [{ bagId: "draft", mirrorRoot: recovery }],
    bagStore: () => draft,
    recordFileFn: async (_bag, uri) => { const rec = await draft.get(uri); return rec && !rec.meta?.deleted ? nativeFile(uri, String(rec.tiddler["text"] ?? "")) : null; },
    carrierFileFn: async () => null,
    bagsHolding: async (title) => (await draft.get(title))?.meta?.deleted ? ["temp"] : ["draft", "temp"],
    syncedTree: new SyncedTree(bases),
  });
  const first = mount();
  const stopFirst = first.start({ $tw: { wiki } } as never);
  await first.idle();
  expect(readdirSync(recovery).sort()).toEqual([`${deleted}.tid`, `${retained}.tid`].sort());
  await stopFirst();
  await draft.tombstone(deleted, origin);
  const second = mount();
  const stopSecond = second.start({ $tw: { wiki } } as never);
  try {
    await second.idle();
    expect(readdirSync(recovery)).toEqual([`${retained}.tid`]);
    expect(readFileSync(join(recovery, `${retained}.tid`), "utf8")).toContain("keep me");
  } finally { await stopSecond(); }
});

test("multi-bag cleanup preserves co-rooted and live drafts across shadow and absent views", async () => {
  const { MemoryTiddlerStore } = await import("../../lararium-tw5/src/memory-store.js");
  root = mkdtempSync(join(tmpdir(), "lar-draft-multi-cleanup-"));
  const shared = join(root, "shared");
  const separate = join(root, "separate");
  const ordinary = join(root, "ordinary");
  const stores = new Map(["draft-a", "draft-b", "draft-c"].map((bag) => [bag, new MemoryTiddlerStore(bag)]));
  const origin = { kind: "operator-import", sessionId: "test" } as const;
  const title = "lar:///test.multi.draft/shadow";
  const absent = "lar:///test.multi.draft/absent";
  for (const bag of ["draft-a", "draft-b", "draft-c"]) {
    await stores.get(bag)!.put({ tiddler: { title, text: "shared words" } }, origin);
  }
  await stores.get("draft-c")!.put({ tiddler: { title: absent, text: "live absent-view draft" } }, origin);
  let shadow = true;
  let workingHeld = true;
  const wiki = {
    allTitles: () => [title, absent],
    getTiddler: (uri: string) => shadow && uri === title ? { fields: { title: uri, "$origin-bag": "temp" } }
      : workingHeld && uri === absent ? { fields: { title: uri, "$origin-bag": "working" } } : undefined,
    addEventListener: () => {}, removeEventListener: () => {},
  };
  const projector = new LarDiskProjector({
    mirrors: [
      { bagId: "draft-a", mirrorRoot: shared },
      { bagId: "draft-b", mirrorRoot: shared },
      { bagId: "draft-c", mirrorRoot: separate },
      { bagId: "working", mirrorRoot: ordinary },
    ],
    bagStore: (bag) => stores.get(bag) ?? null,
    recordFileFn: async (bag, uri) => { const rec = await stores.get(bag)?.get(uri); return rec && !rec.meta?.deleted ? nativeFile(uri, String(rec.tiddler["text"] ?? "")) : null; },
    carrierFileFn: async (uri) => nativeFile(uri, "ordinary words"),
    bagsHolding: async (uri) => {
      const held: string[] = [];
      for (const [bag, store] of stores) {
        const record = await store.get(uri);
        if (record && !record.meta?.deleted) held.push(bag);
      }
      if (shadow && uri === title) held.push("temp");
      if (workingHeld && uri === absent) held.push("working");
      return held;
    },
    syncedTree: new SyncedTree(join(root, "bases")),
  });
  const stop = projector.start({ $tw: { wiki } } as never);
  try {
    await projector.idle();
    const sharedFile = join(shared, "test.multi.draft", "shadow.tid");
    const separateFile = join(separate, "test.multi.draft", "shadow.tid");
    const absentFile = join(separate, "test.multi.draft", "absent.tid");
    const ordinaryFile = join(ordinary, "test.multi.draft", "absent.tid");
    expect(readFileSync(sharedFile, "utf8")).toContain("shared words");
    expect(readFileSync(separateFile, "utf8")).toContain("shared words");
    expect(readFileSync(absentFile, "utf8")).toContain("live absent-view draft");
    expect(readFileSync(ordinaryFile, "utf8")).toContain("ordinary words");
    await stores.get("draft-a")!.tombstone(title, origin);
    await projector.idle();
    expect(readFileSync(sharedFile, "utf8")).toContain("shared words");
    expect(readFileSync(separateFile, "utf8")).toContain("shared words");
    await stores.get("draft-b")!.tombstone(title, origin);
    await projector.idle();
    expect(existsSync(sharedFile)).toBe(false);
    expect(readFileSync(separateFile, "utf8")).toContain("shared words");
    shadow = false;
    workingHeld = false;
    await projector.sense([title, absent]);
    expect(readFileSync(separateFile, "utf8")).toContain("shared words");
    expect(readFileSync(absentFile, "utf8")).toContain("live absent-view draft");
    expect(existsSync(ordinaryFile)).toBe(false);
  } finally { await stop(); }
});
