/**
 * site-file-to-title — THE PROJECTOR'S SITING, RUN BACKWARD. A mirror file reads back under the title the projector sited it
 * by, and a file no rule reads names why. The precedence inverts the projector's (`disk-projector.ts` flush):
 *
 *   (0) a synced base standing at this exact path names its carrier (`SyncedTree.uriAt`)
 *   (1) the loci rule (`mirrorDirFileToUri`)
 *   (2) on a title-path mirror, the relative path minus its extension
 *   (3) the file's in-band title (a `.tid` header, a `.meta` sidecar, a `.json` record, a `.mem` toml `title`)
 *   (4) TiddlyWiki's filename decode, last: it loses `/` and `:` alike (both flatten to `_`)
 *
 * Refusals by name: a `lar:` title off its own loci path, a title the projection filter keeps off disk, the bag's own
 * declaration, a file outside any holding folder, a file with no filetype extension.
 *
 * And the one list the house ignores inside every mirror (`houseIgnored`): `.git`, `.vscode`, `.shore` at the top, any
 * `<stem>.orphans/` folder, the atomic writer's temps, and the `temp/` layer beside a working mirror.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { siteFileToTitle, houseIgnored, HOUSE_IGNORED } from "../src/bag-paths.js";
import { isPersonalTitle } from "@lararium/tw5";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";

let plane: string;
const F = "11111111-1111-4111-8111-111111111111";
const at = (rel: string): string => join(plane, `daemon-${F}`, ...rel.split("/"));
const put = (rel: string, text: string): string => { const p = at(rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
const tid = (title: string, body = "a body"): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${body}\n`;
const titleOf = (r: ReturnType<typeof siteFileToTitle>): string | null => ("title" in r ? r.title : null);
const whyOf = (r: ReturnType<typeof siteFileToTitle>): string => ("why" in r ? r.why : "");

beforeEach(() => { plane = join(mkdtempSync(join(tmpdir(), "lar-site-")), "wikis"); mkdirSync(plane, { recursive: true }); });
afterEach(() => { rmSync(dirname(plane), { recursive: true, force: true }); });

describe("siteFileToTitle — every mirror file reads back under the title it was sited by", () => {
  test("(1) a loci carrier keeps the loci rule", () => {
    const r = siteFileToTitle({ planeDir: plane }, put("ha.ka.ba/notes/pond.tid", tid("lar:///ha.ka.ba/notes/pond")));
    expect(r).toEqual({ title: "lar:///ha.ka.ba/notes/pond", by: "loci" });
  });

  test("(3) a hand-made plain-title tiddler reads by its in-band title, whatever its file name flattened", () => {
    expect(siteFileToTitle({ planeDir: plane }, put("My Notes.tid", tid("My Notes")))).toEqual({ title: "My Notes", by: "in-band" });
    // The walk: `Time: dusk` flattens to `Time_ dusk.tid`; only the in-band title recovers the colon.
    expect(titleOf(siteFileToTitle({ planeDir: plane }, put("Time_ dusk.tid", tid("Time: dusk"))))).toBe("Time: dusk");
    expect(titleOf(siteFileToTitle({ planeDir: plane }, put("$__config_Foo.tid", tid("$:/config/Foo"))))).toBe("$:/config/Foo");
    expect(titleOf(siteFileToTitle({ planeDir: plane }, put("Room 4.tid", tid("Room 4", "a hand edited this"))))).toBe("Room 4");
  });

  test("(3) a .mem's toml title, a .json record's title and a content file's .meta title each read in-band", () => {
    const mem = put("Pond Note.mem", "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki`>>\n\n```toml meta\ntitle = \"Pond Note\"\ntype = \"text/memetic-wikitext+tiddlywiki\"\n```\n\nbody\n");
    expect(siteFileToTitle({ planeDir: plane }, mem)).toEqual({ title: "Pond Note", by: "in-band" });
    expect(titleOf(siteFileToTitle({ planeDir: plane }, put("A_B.json", JSON.stringify({ title: "A/B", text: "x" }))))).toBe("A/B");
    const png = put("Heron Sketch.png", "not really a png");
    put("Heron Sketch.png.meta", "title: Heron: a sketch\ntype: image/png\n");
    expect(titleOf(siteFileToTitle({ planeDir: plane }, png))).toBe("Heron: a sketch");
  });

  test("(4) the filename decode answers last, for a file that states no title", () => {
    expect(siteFileToTitle({ planeDir: plane }, put("Plain Thing.txt", "just words\n"))).toEqual({ title: "Plain Thing", by: "filename" });
    expect(titleOf(siteFileToTitle({ planeDir: plane }, put("$__config_Bar.txt", "x\n")))).toBe("$:/config/Bar");
  });

  test("(2) a title-path mirror reads the relative path minus its extension", () => {
    const r = siteFileToTitle({ planeDir: plane, titlePaths: true }, put("notes/heron.tid", tid("notes/heron")));
    expect(r).toEqual({ title: "notes/heron", by: "title-path" });
  });

  test("(0) a synced base standing at this exact path names its carrier before any other rule", () => {
    const tree = new SyncedTree(null);
    const file = put("Collide_1.tid", tid("Collide: one"));
    tree.set(syncedTreeKey("lar:///ha.ka.ba/wikis/daemon/working", "Collide/one"), file, "sha256:" + "a".repeat(64));
    const r = siteFileToTitle({ planeDir: plane, uriAt: (p) => tree.uriAt(p) }, file);
    expect(r).toEqual({ title: "Collide/one", by: "base" });
  });

  test("a lar: title off its own loci path refuses by name", () => {
    const r = siteFileToTitle({ planeDir: plane }, put("Stray.tid", tid("lar:///ha.ka.ba/notes/pond")));
    expect("why" in r).toBe(true);
    expect(whyOf(r)).toContain("lar:///ha.ka.ba/notes/pond");
  });

  test("a title the projection filter keeps off disk refuses by name", () => {
    const r = siteFileToTitle({ planeDir: plane }, put("$__state_fold.tid", tid("$:/state/fold")));
    expect(whyOf(r)).toMatch(/projection filter/);
    expect(whyOf(r)).toContain("$:/state/fold");
  });

  test("the bag's own declaration, a file outside any holding folder and a file with no extension each refuse by name", () => {
    expect(whyOf(siteFileToTitle({ planeDir: plane }, put("meta.mem", "```toml meta\ntitle = \"lar:///ha.ka.ba/bags/x\"\n```\n")))).toMatch(/declaration/);
    const loose = join(plane, "loose.tid"); writeFileSync(loose, tid("loose"));
    expect(whyOf(siteFileToTitle({ planeDir: plane }, loose))).toMatch(/holding folder/);
    expect(whyOf(siteFileToTitle({ planeDir: plane }, put("README", "x")))).toMatch(/extension/);
  });
});

describe("SyncedTree.uriAt — the reverse lookup a base row gives", () => {
  test("names the one carrier whose base stands at a path, scoped by bag where asked; several carriers there name none", () => {
    const tree = new SyncedTree(null);
    tree.set(syncedTreeKey("bag-a", "One"), "/m/one.tid", "sha256:" + "1".repeat(64));
    expect(tree.uriAt("/m/one.tid")).toBe("One");
    expect(tree.uriAt("/m/two.tid")).toBeNull();
    tree.set(syncedTreeKey("bag-b", "Other"), "/m/one.tid", "sha256:" + "2".repeat(64));
    expect(tree.uriAt("/m/one.tid")).toBeNull();
    expect(tree.uriAt("/m/one.tid", "bag-a")).toBe("One");
    tree.deleteAt(syncedTreeKey("bag-b", "Other"), "/m/one.tid");
    expect(tree.uriAt("/m/one.tid")).toBe("One");
  });
});

describe("HOUSE_IGNORED — the one list every scan, watcher and bundle honours", () => {
  test("names each ignored shape with its reason, and passes a carrier", () => {
    for (const rel of [".git/config", ".git/objects/ab/cdef", ".vscode/settings.json", ".shore/ha.ka.ba/x.mem",
      "ha.ka.ba/notes/pond.orphans/part.mem", `ha.ka.ba/notes/pond.mem.4242.${"0".repeat(8)}-0000-4000-8000-${"0".repeat(12)}.tmp`, "temp/scratch.tid",
      "$__StoryList.tid", "personal/lares/$__StoryList.tid", "wiki/$__HistoryList.tid", "$__StoryList.json.meta", "personal/lares/$__state_folded_Room 4.tid"]) {
      expect(houseIgnored(rel), rel).not.toBeNull();
    }
    for (const rel of ["ha.ka.ba/notes/pond.mem", "My Notes.tid", "notes/.gitkeep-not-top/x.tid", "ha.ka.ba/git/x.mem",
      "$__config_lares_ProjectionFilter.tid", "$__StoryListing.tid", "StoryList.tid"]) expect(houseIgnored(rel), rel).toBeNull();
    expect(HOUSE_IGNORED.topDirs).toEqual(expect.arrayContaining([".git", ".vscode", ".shore", "temp"]));
  });

  test("view state names the personal titles by TiddlyWiki's flattened file name, and no other system title (lar-kind weld)", () => {
    const flat = (title: string): string => `${title.replace(/^\$:\//, "$__").replace(/[/\\<>~:"|?*^]/g, "_")}.tid`;
    for (const title of ["$:/StoryList", "$:/palette", "$:/state/folded/Room 4", "$:/state/tab-1749438307"]) {
      expect(isPersonalTitle(title), title).toBe(true);
      expect(houseIgnored(`personal/lares/${flat(title)}`), title).not.toBeNull();
    }
    expect(houseIgnored(flat("$:/HistoryList")), "the navigator's history rides with its story").not.toBeNull();
    for (const title of ["$:/config/lares/ProjectionFilter", "$:/state/popup/x", "$:/temp/x"]) {
      expect(isPersonalTitle(title), title).toBe(false);
      expect(houseIgnored(flat(title)), title).toBeNull();
    }
  });
});
