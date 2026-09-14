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
 *    it reconciles per carrier root, statelessly, on a debounce — so a naive `existsSync` loop would
 *    write `title.tid` on the first boot and `title_1.tid` on the second, growing one file per boot.
 *    The free-path test is therefore "absent OR ALREADY MINE", and MINE is proved FROM DISK: every
 *    native projection writes its own `title:` — in the `.tid` field block, in the `.json` array, or
 *    in the `.meta` sidecar. A format that carries no title (a flattened `.mem`) cannot prove it, and
 *    an OCCUPIED candidate there REFUSES loudly rather than clobber or grow.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import type { CarrierFile } from "@lararium/tw5";

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
    debounceMs: 1,
    onRefusal: (r) => refusals.push(r.reason),
  }) as unknown as Flushable;
  return { projector, root };
}

/** A second projector over the SAME root — the "restart" (a fresh, empty `sited` memory). */
function restart(mirrorRoot: string, file: (uri: string) => CarrierFile | null, refusals: string[] = []): Flushable {
  return new LarDiskProjector({
    mirrors: [{ bagId: "wiki", mirrorRoot }],
    carrierFileFn: async (uri) => file(uri),
    debounceMs: 1,
    onRefusal: (r) => refusals.push(r.reason),
  }) as unknown as Flushable;
}

const nativeFile = (title: string, text: string): CarrierFile => ({
  ext: ".tid",
  body: tidBody(title, text),
  defaultRelPath: `${title.replace(/\/|\\/g, "_")}.tid`,
});

describe("foreign-title projection — the form cut", () => {
  test("★ a tiddler titled `My Notes` projects to disk ★", async () => {
    const { projector, root } = rig(() => nativeFile("My Notes", "a plain title.\n"));
    await projector.flush("wiki", "My Notes");
    expect(existsSync(join(root, "My Notes.tid"))).toBe(true);
    expect(readFileSync(join(root, "My Notes.tid"), "utf8")).toContain("a plain title.");
  });

  test("★ the change handler no longer withholds a foreign title by FORM ★", () => {
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
    stop();
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
      // the flattened default rides now, and the loci law MUST still win
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

  test("★ CONTROL — a `lar:` name the LOCI law refuses never falls through to the flatten ★", async () => {
    // A fragment owns no file (its carrier root does) and a bag manifest belongs to the declare verb.
    // Both are deliberate refusals, so the flattened default must not resurrect them.
    const { projector, root } = rig((uri) => ({
      ext: ".mem", body: "x", defaultRelPath: `${uri.replace(/[:/]/g, "_")}.mem`,
    }));
    await projector.flush("wiki", "lar:///ha.ka.ba/lares/parity/note#slot");
    await projector.flush("wiki", "lar:///ha.ka.ba/bags/lares");
    expect(readdirSync(root)).toEqual([]);
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
      debounceMs: 1,
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
