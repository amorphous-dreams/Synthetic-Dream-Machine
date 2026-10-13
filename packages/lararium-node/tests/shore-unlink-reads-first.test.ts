/**
 * AN UNLINK READS THE FILE FIRST.
 *
 * The projector removes a file only where it can prove the file holds nothing a hand added: its bytes
 * equal the disk side of the base that stands at that path, or they say what the records render. This
 * holds at every unlink: the earlier path of a carrier a siting rule moved, a sibling left at an earlier
 * extension, a mirror the carrier left, and the file of a carrier the records dropped. A file that fails
 * the proof stays, and the carrier stands off under one key that names both paths; nothing writes at the
 * new path until the earlier one settles.
 *
 * The walk: a person edits a carrier's file, then a siting rule moves the carrier. The edit stays where
 * the person left it, one alert names both paths, and the person settles it.
 *
 * Controls: an untouched file at each earlier home leaves as before; a file a second bag still projects
 * to the same path stays.
 */
import { describe, test, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey, syncedPath } from "../src/synced-tree.js";
import { carrierHash } from "@lararium/mesh";
import type { TW5Engine, CarrierFile } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const OTHER = "lararium";
const URI = "lar:///ha.ka.ba/probe/moved";
const BODY = "# what the records say\n";
const META = "title: lar:///ha.ka.ba/probe/moved\ntype: text/markdown\n";
const HAND = "# A HAND'S OWN WORDS\n";

interface Stand {
  projector: LarDiskProjector;
  conflicts: Array<{ bagId: string; uri: string; reason: string; standoff: string }>;
  resolved: string[];
  /** What the render shore answers for the carrier right now. */
  file: CarrierFile;
  /** The bag the wiki's resolved view names for the carrier, or null where it holds none. */
  owner: { bag: string | null };
  holding: Set<string>;
  at: (rel: string, bag?: string) => string;
  reboot: () => Promise<void>;
}

function stand(mirrorRoots: Record<string, string> = { [BAG]: BAG, [OTHER]: OTHER }): Stand {
  root = mkdtempSync(join(tmpdir(), "lar-unlink-reads-"));
  const tree = (): SyncedTree => new SyncedTree(join(root, ".projection", "synced-tree.json"), 0);
  const s = {
    conflicts: [] as Stand["conflicts"], resolved: [] as string[],
    file: { ext: ".md", body: BODY, metaBody: META, relPath: "a/note.md", encoding: "utf8" } as CarrierFile,
    owner: { bag: BAG as string | null }, holding: new Set<string>([BAG]),
  };
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (title === URI && s.owner.bag !== null ? { fields: { title, "$origin-bag": s.owner.bag } } : undefined),
    allTitles: () => (s.owner.bag !== null ? [URI] : []),
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  const make = (): LarDiskProjector => {
    const projector = new LarDiskProjector({
      mirrors: Object.entries(mirrorRoots).map(([bagId, dir]) => ({ bagId, mirrorRoot: join(root, dir) })),
      carrierFileFn: async () => out.file,
      bagsHolding: async () => [...s.holding],
      syncedTree: tree(),
      onConflict: (info) => { s.conflicts.push(info); },
      onConflictResolved: (info) => { s.resolved.push(info.standoff); },
    });
    projector.start(engine);
    return projector;
  };
  const out: Stand = {
    ...s, projector: null as unknown as LarDiskProjector,
    at: (rel: string, bag = BAG): string => join(root, mirrorRoots[bag]!, rel),
    reboot: async (): Promise<void> => { await out.projector.stop(); out.projector = make(); await out.projector.idle(); },
  };
  out.projector = make();
  return out;
}
const read = (p: string): string => readFileSync(p, "utf-8");

describe("a siting rule moves a carrier with a hand edit standing at the earlier path", () => {
  test("the edit stays, nothing writes at the new path, and one standoff names both paths", async () => {
    const s = stand();
    await s.projector.idle();
    expect(read(s.at("a/note.md"))).toBe(BODY);
    writeFileSync(s.at("a/note.md"), HAND, "utf-8");           // a person edits the file by hand
    s.file = { ...s.file, relPath: "b/note.md" };               // and a siting rule moves the carrier
    await s.projector.sense([URI]);

    expect(read(s.at("a/note.md"))).toBe(HAND);
    expect(existsSync(s.at("a/note.md.meta"))).toBe(true);
    expect(existsSync(s.at("b/note.md"))).toBe(false);
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]!.reason).toContain(s.at("a/note.md"));
    expect(s.conflicts[0]!.reason).toContain(s.at("b/note.md"));
    // Level-triggered: the same states raise nothing more.
    await s.projector.sense([URI]);
    expect(s.conflicts).toHaveLength(1);
    expect(read(s.at("a/note.md"))).toBe(HAND);
  });

  test("CONTROL: with the earlier file untouched, the move unlinks it and writes the new path", async () => {
    const s = stand();
    await s.projector.idle();
    s.file = { ...s.file, relPath: "b/note.md" };
    await s.projector.sense([URI]);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(existsSync(s.at("a/note.md.meta"))).toBe(false);
    expect(read(s.at("b/note.md"))).toBe(BODY);
    expect(s.conflicts).toEqual([]);
  });

  test("settled by taking the records' side under the key: the earlier file leaves and the new path takes the render", async () => {
    const s = stand();
    await s.projector.idle();
    writeFileSync(s.at("a/note.md"), HAND, "utf-8");
    s.file = { ...s.file, relPath: "b/note.md" };
    await s.projector.sense([URI]);
    const key = s.conflicts[0]!.standoff;
    expect((await s.projector.takeRecords(BAG, URI, "0".repeat(24))).took).toBe(false);
    expect(read(s.at("a/note.md"))).toBe(HAND);
    expect((await s.projector.takeRecords(BAG, URI, key)).took).toBe(true);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(read(s.at("b/note.md"))).toBe(BODY);
    expect(s.resolved).toEqual([key]);
  });

  test("settled by the records coming to say what the earlier file says: the move then completes", async () => {
    const s = stand();
    await s.projector.idle();
    writeFileSync(s.at("a/note.md"), HAND, "utf-8");
    s.file = { ...s.file, relPath: "b/note.md" };
    await s.projector.sense([URI]);
    expect(s.conflicts).toHaveLength(1);
    s.file = { ...s.file, body: HAND };                         // the ingest leg adopted the hand's words
    await s.projector.sense([URI]);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(read(s.at("b/note.md"))).toBe(HAND);
    expect(s.resolved).toEqual([s.conflicts[0]!.standoff]);
  });

  test("a vessel that restarted between the edit and the move still reads the earlier path: the base names it", async () => {
    const s = stand();
    await s.projector.idle();
    writeFileSync(s.at("a/note.md"), HAND, "utf-8");
    s.file = { ...s.file, relPath: "b/note.md" };
    await s.reboot();                                           // the projector's siting memory starts empty
    expect(read(s.at("a/note.md"))).toBe(HAND);
    expect(existsSync(s.at("b/note.md"))).toBe(false);
    expect(s.conflicts).toHaveLength(1);
  });
});

describe("a filetype change leaves a sibling at the earlier extension", () => {
  test("a hand-edited sibling stays and the carrier stands off; an untouched one leaves", async () => {
    const edited = stand();
    edited.file = { ext: ".md", body: BODY, metaBody: META, encoding: "utf8" };
    await edited.projector.idle();
    const md = edited.at("ha.ka.ba/probe/moved.md");
    writeFileSync(md, HAND, "utf-8");
    edited.file = { ext: ".tid", body: `title: ${URI}\n\nwhat the records say\n`, encoding: "utf8" };
    await edited.projector.sense([URI]);
    expect(read(md)).toBe(HAND);
    expect(existsSync(edited.at("ha.ka.ba/probe/moved.tid"))).toBe(false);
    expect(edited.conflicts).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });

    const clean = stand();
    clean.file = { ext: ".md", body: BODY, metaBody: META, encoding: "utf8" };
    await clean.projector.idle();
    clean.file = { ext: ".tid", body: `title: ${URI}\n\nwhat the records say\n`, encoding: "utf8" };
    await clean.projector.sense([URI]);
    expect(existsSync(clean.at("ha.ka.ba/probe/moved.md"))).toBe(false);
    expect(existsSync(clean.at("ha.ka.ba/probe/moved.md.meta"))).toBe(false);
    expect(existsSync(clean.at("ha.ka.ba/probe/moved.tid"))).toBe(true);
    expect(clean.conflicts).toEqual([]);
  });
});

describe("the records dropped a carrier whose file a hand edited", () => {
  test("the file stays and one standoff names it; taking the records' side removes it", async () => {
    const s = stand();
    await s.projector.idle();
    writeFileSync(s.at("a/note.md"), HAND, "utf-8");
    s.owner.bag = null; s.holding.clear();                      // the carrier left the records
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(HAND);
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]!.reason).toContain(s.at("a/note.md"));
    await s.projector.sense([URI]);
    expect(s.conflicts).toHaveLength(1);
    expect((await s.projector.takeRecords(BAG, URI, s.conflicts[0]!.standoff)).took).toBe(true);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(existsSync(s.at("a/note.md.meta"))).toBe(false);
    expect(s.resolved).toEqual([s.conflicts[0]!.standoff]);
  });

  test("a vessel that restarted before the records dropped the carrier still reads the ruled path: the base names it", async () => {
    const s = stand();
    await s.projector.idle();
    writeFileSync(s.at("a/note.md"), HAND, "utf-8");
    await s.projector.stop();
    s.owner.bag = null; s.holding.clear();                      // the records drop it while the vessel rests
    await s.reboot();                                           // no siting memory, and no tiddler to re-run the rule
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(HAND);
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]!.reason).toContain(s.at("a/note.md"));
  });

  test("a foreign title the loci law sites nowhere still gets read at its base's path after a restart", async () => {
    const s = stand();
    const TITLE = "My Notes";
    const live = { on: true };
    await s.projector.stop();
    const tree = new SyncedTree(join(root, ".projection", "foreign-tree.json"), 0);
    const conflicts: string[] = [];
    const make = (): LarDiskProjector => {
      const p = new LarDiskProjector({
        mirrors: [{ bagId: BAG, mirrorRoot: join(root, "foreign") }],
        carrierFileFn: async () => ({ ext: ".tid", body: `title: ${TITLE}\n\nwhat the records say\n`, defaultRelPath: "My Notes.tid", encoding: "utf8" }),
        syncedTree: tree,
        onConflict: (info) => { conflicts.push(info.reason); },
      });
      p.start({ $tw: { wiki: { getTiddler: (t: string) => (t === TITLE && live.on ? { fields: { title: t, "$origin-bag": BAG } } : undefined), allTitles: () => (live.on ? [TITLE] : []), addEventListener: () => {}, removeEventListener: () => {} } } } as unknown as TW5Engine);
      return p;
    };
    const first = make();
    await first.idle();
    const file = join(root, "foreign", "My Notes.tid");
    expect(existsSync(file)).toBe(true);
    await first.stop();
    writeFileSync(file, `title: ${TITLE}\n\nA HAND'S OWN WORDS\n`, "utf-8");
    live.on = false;
    const second = make();
    await second.sense([TITLE]);
    expect(read(file)).toContain("A HAND'S OWN WORDS");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain(file);
  });

  test("CONTROL: an untouched file leaves with its carrier", async () => {
    const s = stand();
    await s.projector.idle();
    s.owner.bag = null; s.holding.clear();
    await s.projector.sense([URI]);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(existsSync(s.at("a/note.md.meta"))).toBe(false);
    expect(s.conflicts).toEqual([]);
  });

  test("CONTROL: a file a second bag still projects to the same path stays, whatever the first bag's base says", async () => {
    const s = stand({ [BAG]: "shared", [OTHER]: "shared" });
    await s.projector.idle();
    s.owner.bag = null; s.holding.clear(); s.holding.add(OTHER);   // the first bag dropped it; the second holds it
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(BODY);
    expect(s.conflicts).toEqual([]);
  });
});

/**
 * THE INGEST GESTURE READS A SOURCE WHEREVER A PERSON KEEPS IT, and pins the base at the file it read. A
 * holding directory beside the mirror lies outside every mirror root: the projector's ward would refuse a
 * write there, so no unlink may reach it either. The walk: a person ingests a note from a holding directory
 * and keeps the source.
 */
describe("a base that names a file outside the mirror names no home of it", () => {
  /** The gesture's own pin: a sibling writer over the same tree file, as `lares ingest` holds one. */
  function ingestedFromBeside(): string {
    const held = join(root, "holding", "a", "note.md");
    mkdirSync(dirname(held), { recursive: true });
    writeFileSync(held, BODY, "utf-8");
    writeFileSync(`${held}.meta`, META, "utf-8");
    const gesture = new SyncedTree(join(root, ".projection", "synced-tree.json"), 0);
    gesture.set(syncedTreeKey(BAG, URI), syncedPath(held), carrierHash(BODY, META));
    gesture.flush();
    return held;
  }

  test("the source a person ingested from beside the mirror stays whole while the mirror takes its file", async () => {
    const s = stand();
    await s.projector.idle();
    await s.projector.stop();
    const held = ingestedFromBeside();
    await s.reboot();
    await s.projector.sense([URI]);
    expect(read(held)).toBe(BODY);
    expect(read(`${held}.meta`)).toBe(META);
    expect(read(s.at("a/note.md"))).toBe(BODY);
    expect(s.conflicts).toEqual([]);
  });

  test("the records drop the carrier: the source beside the mirror still stays", async () => {
    const s = stand();
    await s.projector.idle();
    await s.projector.stop();
    const held = ingestedFromBeside();
    s.owner.bag = null; s.holding.clear();
    await s.reboot();
    await s.projector.sense([URI]);
    expect(read(held)).toBe(BODY);
    expect(read(`${held}.meta`)).toBe(META);
    expect(s.conflicts).toEqual([]);
  });

  test("CONTROL: a base that names a ruled path inside the mirror still gets read and unlinked after a restart", async () => {
    const s = stand();
    await s.projector.idle();
    s.file = { ...s.file, relPath: "b/note.md" };
    await s.reboot();
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(read(s.at("b/note.md"))).toBe(BODY);
    expect(s.conflicts).toEqual([]);
  });
});

describe("a carrier left one mirror for another", () => {
  test("a hand-edited file in the mirror it left stays and stands off; an untouched one leaves", async () => {
    const s = stand();
    await s.projector.idle();
    writeFileSync(s.at("a/note.md"), HAND, "utf-8");
    s.owner.bag = OTHER; s.holding.clear(); s.holding.add(OTHER);
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md", OTHER))).toBe(BODY);
    expect(read(s.at("a/note.md"))).toBe(HAND);
    expect(s.conflicts.map((c) => c.bagId)).toEqual([BAG]);
    await s.projector.sense([URI]);
    expect(s.conflicts).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });

    const clean = stand();
    await clean.projector.idle();
    clean.owner.bag = OTHER; clean.holding.clear(); clean.holding.add(OTHER);
    await clean.projector.sense([URI]);
    expect(read(clean.at("a/note.md", OTHER))).toBe(BODY);
    expect(existsSync(clean.at("a/note.md"))).toBe(false);
    expect(clean.conflicts).toEqual([]);
  });
});
