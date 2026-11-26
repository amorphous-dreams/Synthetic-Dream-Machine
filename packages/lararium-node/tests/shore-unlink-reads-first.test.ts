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
 * A FILE A CHECKOUT NEVER TRACKED STAYS where the records drop its carrier: it holds the only copy, so no proof
 * of agreement lets it leave. One alert per path names it and the cure; a commit lets it leave and clears the
 * alert. A checkout git cannot read keeps the file too, and says why.
 *
 * Controls: an untouched file at each earlier home leaves as before; a file a second bag still projects
 * to the same path stays.
 */
import { describe, test, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey, syncedPath } from "../src/synced-tree.js";
import { checkoutTracking, type CarrierTracking } from "../src/checkout-carriers.js";
import { untrackedCarrierAlertTitle } from "../src/disk-projector.js";
import { carrierHash } from "@lararium/mesh/crypto";
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
  /** The document each bag's records rest in, as the projector's `documentOf` door answers it (none named: none answered). */
  docs: Record<string, string>;
  /** The history each bag's document holds, as the projector's `lineageOf` door answers it: the heads it stands at, and every head it holds. */
  lineage: Record<string, { heads: string[]; holds: string[] }>;
  /** The alerts the projector raised in the wiki, by title. */
  alerts: Map<string, Record<string, unknown>>;
  /** The Synced tree as the directory holds it now. */
  tree: () => SyncedTree;
  at: (rel: string, bag?: string) => string;
  reboot: () => Promise<void>;
}

function stand(mirrorRoots: Record<string, string> = { [BAG]: BAG, [OTHER]: OTHER }, untrackedAt?: CarrierTracking): Stand {
  root = mkdtempSync(join(tmpdir(), "lar-unlink-reads-"));
  const tree = (): SyncedTree => new SyncedTree(join(root, ".projection", "synced-tree"));
  const s = {
    conflicts: [] as Stand["conflicts"], resolved: [] as string[],
    file: { ext: ".md", body: BODY, metaBody: META, relPath: "a/note.md", encoding: "utf8" } as CarrierFile,
    owner: { bag: BAG as string | null }, holding: new Set<string>([BAG]),
    docs: {} as Record<string, string>,
    lineage: {} as Stand["lineage"],
    alerts: new Map<string, Record<string, unknown>>(),
  };
  const engine = { $tw: { wiki: {
    getTiddler: (title: string) => (s.alerts.has(title) ? { fields: s.alerts.get(title) }
      : title === URI && s.owner.bag !== null ? { fields: { title, "$origin-bag": s.owner.bag } } : undefined),
    addTiddler: (fields: Record<string, unknown>) => { s.alerts.set(String(fields["title"]), fields); },
    deleteTiddler: (title: string) => { s.alerts.delete(title); },
    allTitles: () => (s.owner.bag !== null ? [URI] : []),
    addEventListener: () => {}, removeEventListener: () => {},
  } } } as unknown as TW5Engine;
  const make = (): LarDiskProjector => {
    const projector = new LarDiskProjector({
      mirrors: Object.entries(mirrorRoots).map(([bagId, dir]) => ({ bagId, mirrorRoot: join(root, dir) })),
      carrierFileFn: async () => out.file,
      bagsHolding: async () => [...s.holding],
      documentOf: (bagId: string) => s.docs[bagId] ?? null,
      lineageOf: (bagId: string) => {
        const held = s.lineage[bagId];
        return held === undefined ? null : { heads: held.heads, quiet: true, holds: (named: readonly string[]) => named.every((head) => held.holds.includes(head)) };
      },
      syncedTree: tree(),
      onConflict: (info) => { s.conflicts.push(info); },
      onConflictResolved: (info) => { s.resolved.push(info.standoff); },
      ...(untrackedAt ? { untrackedAt } : {}),
    });
    projector.start(engine);
    return projector;
  };
  const out: Stand = {
    ...s, projector: null as unknown as LarDiskProjector, tree,
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

  test("a foreign title the address siting rule sites nowhere still gets read at its base's path after a restart", async () => {
    const s = stand();
    const TITLE = "My Notes";
    const live = { on: true };
    await s.projector.stop();
    const tree = new SyncedTree(join(root, ".projection", "foreign-tree.json"));
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

  test("an untouched file a checkout never tracked stays, one alert names it and the cure; a commit lets it leave", async () => {
    const s = stand({ [BAG]: BAG }, checkoutTracking(() => null));
    const git = (...a: string[]): void => {
      const r = spawnSync("git", ["-c", "user.name=Heron", "-c", "user.email=heron@probe.invalid", ...a], { cwd: root, encoding: "utf8", env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_"))), GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
      if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
    };
    git("init", "-q");
    await s.projector.idle();
    const file = s.at("a/note.md");
    expect(read(file)).toBe(BODY);
    s.owner.bag = null; s.holding.clear();                      // a re-found takes the record
    await s.projector.sense([URI]);
    expect(read(file)).toBe(BODY);
    expect(existsSync(`${file}.meta`)).toBe(true);
    const alert = s.alerts.get(untrackedCarrierAlertTitle(file));
    expect(alert).toMatchObject({ tags: "$:/tags/Alert", "alert-kind": "untracked-carrier", path: file, uri: URI, bag: BAG });
    expect(String(alert!["text"])).toMatch(/Commit it, or remove it by hand/);
    expect(s.conflicts).toEqual([]);
    // Committed, the file holds a copy elsewhere: the next pass lets it leave and the alert clears.
    git("add", "-A"); git("commit", "-q", "-m", "lar:///probe.keeps.the-note/commit");
    await s.projector.sense([URI]);
    expect(existsSync(file)).toBe(false);
    expect(s.alerts.size).toBe(0);
  });

  test("a checkout git cannot read keeps the file, and the alert says why", async () => {
    const s = stand({ [BAG]: BAG }, () => ({ why: "git cannot run in this runtime" }));
    await s.projector.idle();
    s.owner.bag = null; s.holding.clear();
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(BODY);
    expect(String(s.alerts.get(untrackedCarrierAlertTitle(s.at("a/note.md")))!["text"])).toMatch(/git cannot run in this runtime/);
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

  test("a base a sibling pinned inside the mirror after this projector loaded gets read before the homes settle", async () => {
    const s = stand();
    await s.projector.idle();
    // The ingest gesture, a separate process over the same tree, pins a base at a second file inside the
    // mirror (a path an earlier siting left the carrier at). This projector loaded the tree before that.
    const sited = s.at("z/note.md");
    mkdirSync(dirname(sited), { recursive: true });
    writeFileSync(sited, BODY, "utf-8");
    writeFileSync(`${sited}.meta`, META, "utf-8");
    new SyncedTree(join(root, ".projection", "synced-tree")).set(syncedTreeKey(BAG, URI), syncedPath(sited), carrierHash(BODY, META));
    s.owner.bag = null; s.holding.clear();                      // the records drop the carrier
    await s.projector.sense([URI]);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(existsSync(sited)).toBe(false);                      // agreed with its base, so it left with the carrier
    expect(existsSync(`${sited}.meta`)).toBe(false);
    expect(new SyncedTree(join(root, ".projection", "synced-tree")).bases(syncedTreeKey(BAG, URI))).toEqual([]);
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
    const gesture = new SyncedTree(join(root, ".projection", "synced-tree"));
    gesture.set(syncedTreeKey(BAG, URI), syncedPath(held), carrierHash(BODY, META));
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

  test("the mirror it moved into already holds its bytes: nothing writes there, and the untouched file it left still leaves", async () => {
    // The seed's road for a leaf bag: LOAD onto the wiki's working layer (whose mirror writes the file), then
    // MOVE the layer into canon, whose mirror already holds the same bytes. The canon flush writes nothing,
    // and the file in the working layer's mirror must leave all the same, or a copy of canon rests there.
    const s = stand();
    await s.projector.idle();
    expect(read(s.at("a/note.md"))).toBe(BODY);
    mkdirSync(dirname(s.at("a/note.md", OTHER)), { recursive: true });
    writeFileSync(s.at("a/note.md", OTHER), BODY, "utf-8");
    writeFileSync(s.at("a/note.md.meta", OTHER), META, "utf-8");
    s.owner.bag = OTHER; s.holding.clear(); s.holding.add(OTHER);
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md", OTHER))).toBe(BODY);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(existsSync(s.at("a/note.md.meta"))).toBe(false);
    expect(s.conflicts).toEqual([]);
  });

  test("CONTROL: the bag it shadows still holds it: the file in that mirror stays when the other flush writes nothing", async () => {
    const s = stand();
    await s.projector.idle();
    mkdirSync(dirname(s.at("a/note.md", OTHER)), { recursive: true });
    writeFileSync(s.at("a/note.md", OTHER), BODY, "utf-8");
    writeFileSync(s.at("a/note.md.meta", OTHER), META, "utf-8");
    s.owner.bag = OTHER; s.holding.add(OTHER);
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(BODY);
    expect(s.conflicts).toEqual([]);
  });
});

describe("a file answers only to the document whose records its base read", () => {
  // Each face of a vessel mounts its OWN workbench document for an unshared wiki, and every face's document serves one
  // bag id over one mirror root. The base names the document its records side read, so a pass under another face's
  // document never judges that file.
  const KEY = syncedTreeKey(BAG, URI);

  test("another document's pass finds the carrier in a second bag: the first document's file stays, its base stands, and nothing stands off", async () => {
    const s = stand();
    s.docs[BAG] = "automerge:face-a";
    await s.projector.idle();
    expect(read(s.at("a/note.md"))).toBe(BODY);
    // Another face stands worn: its own document serves the bag, holds no such carrier, and the view resolves the
    // carrier from the second bag (canon under a working copy the other face forked).
    s.docs[BAG] = "automerge:face-b";
    s.owner.bag = OTHER; s.holding.clear(); s.holding.add(OTHER);
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md", OTHER))).toBe(BODY);
    expect(read(s.at("a/note.md"))).toBe(BODY);
    expect(existsSync(s.at("a/note.md.meta"))).toBe(true);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))?.doc).toBe("automerge:face-a");
    expect(s.conflicts).toEqual([]);
  });

  test("CONTROL: the same document's pass finds the carrier in a second bag: its own untouched file leaves", async () => {
    const s = stand();
    s.docs[BAG] = "automerge:face-a";
    await s.projector.idle();
    s.owner.bag = OTHER; s.holding.clear(); s.holding.add(OTHER);
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md", OTHER))).toBe(BODY);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))).toBeNull();
  });

  test("another document's records hold no such carrier: the first document's file and base stay", async () => {
    const s = stand();
    s.docs[BAG] = "automerge:face-a";
    await s.projector.idle();
    s.docs[BAG] = "automerge:face-b";
    s.owner.bag = null; s.holding.clear();
    await s.reboot();
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(BODY);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))?.doc).toBe("automerge:face-a");
    expect(s.conflicts).toEqual([]);
  });

  test("two documents hold one title: the second writes nothing over the first's file and stands off by name", async () => {
    const s = stand();
    s.docs[BAG] = "automerge:face-a";
    await s.projector.idle();
    s.docs[BAG] = "automerge:face-b";
    s.file = { ...s.file, body: "# what the second face's records say\n" };
    await s.reboot();
    expect(read(s.at("a/note.md"))).toBe(BODY);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))?.doc).toBe("automerge:face-a");
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]!.reason).toContain("another document");
    expect(s.conflicts[0]!.reason).toContain(s.at("a/note.md"));
  });

  test("CONTROL: one document's records move: its own file takes the new render", async () => {
    const s = stand();
    s.docs[BAG] = "automerge:face-a";
    await s.projector.idle();
    s.file = { ...s.file, body: "# what the records say now\n" };
    await s.reboot();
    expect(read(s.at("a/note.md"))).toBe("# what the records say now\n");
    expect(s.conflicts).toEqual([]);
  });
});

describe("a base names the history its records side read: records that fell behind it write nothing", () => {
  // THE WORN-HOUSE LOSS (2026-11-25). A put landed newer words in a wiki's working document and the file agreed; that
  // save never rested. The vessel stood again, the document read back as it stood before the put, and the projector
  // read `disk == base, records != base` as records that moved on: it wrote the older render over the tracked file.
  // Two hashes cannot tell records that moved on from records that lost history. The base's heads can.
  const KEY = syncedTreeKey(BAG, URI);
  const NEWER = "# what the records say, with a bullet a later write added\n";
  /** A write lands in the records at head `h2` and the file takes it; then the document reads back at `h1`, without it. */
  const agreeThenFallBehind = async (): Promise<Stand> => {
    const s = stand();
    s.docs[BAG] = "automerge:working";
    s.lineage[BAG] = { heads: ["h1"], holds: ["h1"] };
    await s.projector.idle();
    s.file = { ...s.file, body: NEWER };
    s.lineage[BAG] = { heads: ["h2"], holds: ["h1", "h2"] };
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(NEWER);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))?.heads).toEqual(["h2"]);
    s.file = { ...s.file, body: BODY };
    s.lineage[BAG] = { heads: ["h1"], holds: ["h1"] };
    return s;
  };

  test("the document reads back without the agreed write: the file keeps its newer words and one standoff names the cure", async () => {
    const s = await agreeThenFallBehind();
    await s.reboot();
    expect(read(s.at("a/note.md"))).toBe(NEWER);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))?.heads).toEqual(["h2"]);
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]!.reason).toContain("fell behind");
    expect(s.conflicts[0]!.reason).toContain(`lares shore keep-disk ${URI} --key ${s.conflicts[0]!.standoff}`);
    expect(s.conflicts[0]!.reason).toContain(`lares shore take-records ${URI} --key ${s.conflicts[0]!.standoff}`);
    // Level-triggered: the same states raise nothing more and still write nothing.
    await s.projector.sense([URI]);
    expect(s.conflicts).toHaveLength(1);
    expect(read(s.at("a/note.md"))).toBe(NEWER);
  });

  test("the standoff names what the keeper needs to keep the disk: the document, the heads it lacks, and whether it stood quiet since it mounted", async () => {
    const s = await agreeThenFallBehind();
    await s.reboot();
    expect(s.projector.standing().find((x) => x.uri === URI)?.behind).toEqual({ doc: "automerge:working", heads: ["h2"], quiet: true });
  });

  test("the file moved too while the records fell behind: still no both-moved, the file holds the newest words", async () => {
    const s = await agreeThenFallBehind();
    writeFileSync(s.at("a/note.md"), HAND, "utf-8");
    await s.reboot();
    expect(read(s.at("a/note.md"))).toBe(HAND);
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]!.reason).toContain("fell behind");
    expect(s.projector.standing().find((x) => x.uri === URI)?.behind?.heads).toEqual(["h2"]);
  });

  test("the file vanished while the records fell behind: the carrier pends and asks, nothing re-projects and nothing tombstones", async () => {
    const s = await agreeThenFallBehind();
    rmSync(s.at("a/note.md")); rmSync(s.at("a/note.md.meta"), { force: true });
    await s.reboot();
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(s.projector.pendingRemovals().map((p) => p.uri)).toEqual([URI]);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))?.heads).toEqual(["h2"]);
    expect(s.conflicts).toEqual([]);
  });

  test("a person who names that standoff and takes the records' side lands the older render, by their own word", async () => {
    const s = await agreeThenFallBehind();
    await s.reboot();
    expect((await s.projector.takeRecords(BAG, URI, s.conflicts[0]!.standoff)).took).toBe(true);
    expect(read(s.at("a/note.md"))).toBe(BODY);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))?.heads).toEqual(["h1"]);
  });

  test("a blank document stands in for one that failed to load: the file its base agrees with stays, and one standoff names it", async () => {
    const s = await agreeThenFallBehind();
    s.owner.bag = null; s.holding.clear();                      // the stand-in holds no such carrier
    s.lineage[BAG] = { heads: ["blank"], holds: ["blank"] };
    await s.reboot();
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(NEWER);
    expect(s.tree().baseAt(KEY, s.at("a/note.md"))?.heads).toEqual(["h2"]);
    expect(s.conflicts).toHaveLength(1);
    expect(s.conflicts[0]!.reason).toContain("fell behind");
  });

  test("the lost history returns (the document hydrates late): the standoff clears and nothing wrote meanwhile", async () => {
    const s = await agreeThenFallBehind();
    await s.reboot();
    expect(s.conflicts).toHaveLength(1);
    s.file = { ...s.file, body: NEWER };
    s.lineage[BAG] = { heads: ["h2"], holds: ["h1", "h2"] };
    await s.projector.sense([URI]);
    expect(read(s.at("a/note.md"))).toBe(NEWER);
    expect(s.resolved).toEqual([s.conflicts[0]!.standoff]);
  });

  test("CONTROL: records that moved on from the agreement still hold its heads: the file takes the new render", async () => {
    const s = stand();
    s.docs[BAG] = "automerge:working";
    s.lineage[BAG] = { heads: ["h1"], holds: ["h1"] };
    await s.projector.idle();
    s.file = { ...s.file, body: NEWER };
    s.lineage[BAG] = { heads: ["h2"], holds: ["h1", "h2"] };
    await s.reboot();
    expect(read(s.at("a/note.md"))).toBe(NEWER);
    expect(s.conflicts).toEqual([]);
  });

  test("CONTROL: records that dropped a carrier after the agreement still hold its heads: the untouched file leaves", async () => {
    const s = stand();
    s.docs[BAG] = "automerge:working";
    s.lineage[BAG] = { heads: ["h1"], holds: ["h1"] };
    await s.projector.idle();
    s.owner.bag = null; s.holding.clear();
    s.lineage[BAG] = { heads: ["h2"], holds: ["h1", "h2"] };
    await s.projector.sense([URI]);
    expect(existsSync(s.at("a/note.md"))).toBe(false);
    expect(s.conflicts).toEqual([]);
  });

  test("CONTROL: a base that names no heads vouches as before, and a store that answers no history pins none", async () => {
    const s = stand();
    s.docs[BAG] = "automerge:working";
    await s.projector.idle();
    expect("heads" in s.tree().baseAt(KEY, s.at("a/note.md"))!).toBe(false);
    s.file = { ...s.file, body: NEWER };
    s.lineage[BAG] = { heads: ["h9"], holds: ["h9"] };
    await s.reboot();
    expect(read(s.at("a/note.md"))).toBe(NEWER);
    expect(s.conflicts).toEqual([]);
  });
});
