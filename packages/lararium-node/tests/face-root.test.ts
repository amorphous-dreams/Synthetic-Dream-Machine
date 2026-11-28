/**
 * face-root — one working tree per face, keyed by PET NAME (operator, 2026-11-18: "one pool per face keyed by pet name"):
 *
 *   projections/faces/<pet name>/
 *     wiki/              the face's daemon working layer
 *     canon/             the face's daemon canon
 *     stage/             the kahua memory stage
 *     personal/<slug>/    personal layers over shared wikis (the face's overlay, never a copy of the workbench)
 *     recovery/<slug>/   unsaved drafts in shared wikis
 *     temp/<slug>/       a shared wiki's consented temp layer, beside recovery
 *
 * A relation id changes at every re-found, so a relation-keyed folder orphans; the pet name carries across.
 *
 *   R1 every per-face mirror sites under `faces/<pet name>/` (daemon working, canon, stage, temp; the daemon VM's one list)
 *   R2 a shared workbench's `recovery/` and `temp/` move to the writing face's root, never under the shared `wikis/<slug>/`;
 *      the personal grant roots at `faces/<pet name>/personal/<slug>`; no face worn: none of the three
 *   R3 the pet-name segment rule: each refusal by name; otherwise the pet name as written (spaces, Unicode, NFC)
 *   R4 a re-minted face under the same pet name sites the SAME folder (the relation never enters a face path)
 *   R5 no index file rests under `faces/`; no two faces share a root
 *   R6 ONE COPY (face-pools #/one-copy): a wiki shared between two faces lands exactly one disk copy, outside every face
 *      root, and each face's personal layer mirrors only that face's own overlay layer
 *   R7 the reverse siting reads each face plane back (`siteFileToTitle` over the face root and its personal layers)
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { resolveDiskMirrors, type DiskMirrorGrant } from "../../lararium-mesh/src/vessel-island-pool-core.js";
import { wikiSlotUri } from "../../lararium-mesh/src/wiki-recipe.js";
import { daemonFaceCanonBag, KAHUA_BAG } from "../../lararium-mesh/src/index.js";
import {
  daemonWorkingMirror, daemonCanonMirror, kahuaStageMirror, daemonTempMirror, daemonDiskMirrors, faceRoot, faceSegment,
  faceSegmentRefusal, FaceSegmentRefused, FACES_PROJECTION_DIR, siteFileToTitle, type FaceSite,
} from "../src/bag-paths.js";
import { faceLabelsDir, writeFaceLabel, faceSiteOf } from "../src/face-labels.js";

const F1 = "11111111-1111-4111-8111-111111111111";
const F2 = "22222222-2222-4222-8222-222222222222";
const P = "/lar/projections";
const heron: FaceSite = { relation: F1, segment: "Heron" };

describe("R1 — every per-face mirror sites under faces/<pet name>/", () => {
  test("daemon working, canon, stage and temp", () => {
    expect(FACES_PROJECTION_DIR).toBe("faces");
    expect(daemonWorkingMirror(P, heron).mirrorRoot).toBe(`${P}/faces/Heron/wikis/daemon`);
    expect(daemonCanonMirror(P, heron)).toEqual({ bagId: daemonFaceCanonBag(F1), mirrorRoot: `${P}/faces/Heron/bags/daemon` });
    expect(kahuaStageMirror(P, heron)).toEqual({ bagId: KAHUA_BAG, mirrorRoot: `${P}/faces/Heron/bags/kahua`, titlePaths: true });
    expect(daemonTempMirror(P, heron).mirrorRoot).toBe(`${P}/faces/Heron/wikis/daemon/temp`);
    expect(faceRoot(P, "Heron")).toBe(`${P}/faces/Heron`);
  });

  test("the daemon VM's one list: each private mirror under the face root; no face worn, none", () => {
    const list = daemonDiskMirrors({ projectionRoot: P, canonBags: "/absent", face: heron, canon: true, temp: true });
    const privates = list.filter((m) => m.scope !== "crossroads");
    expect(privates.map((m) => m.mirrorRoot).sort()).toEqual([`${P}/faces/Heron/bags/daemon`, `${P}/faces/Heron/bags/kahua`, `${P}/faces/Heron/wikis/daemon`, `${P}/faces/Heron/wikis/daemon/temp`]);
    for (const m of list) expect(m.mirrorRoot).not.toMatch(/daemon-|kahua-|\/personal\//);
    expect(daemonDiskMirrors({ projectionRoot: P, canonBags: "/absent", face: null }).map((m) => m.scope)).toEqual(["crossroads"]);
  });
});

describe("R2 — personal layers, drafts and temp of a shared wiki rest in the writing face's root", () => {
  const grant = (segment: string | null): DiskMirrorGrant => [
    { bagId: "working",  mirrorRoot: `${P}/wikis`, scope: "working",  wikiSlot: "working" },
    { bagId: "personal", mirrorRoot: `${P}/${FACES_PROJECTION_DIR}`, scope: "personal", wikiSlot: "personal", faceFolder: () => segment },
    { bagId: "draft",    mirrorRoot: `${P}/${FACES_PROJECTION_DIR}`, scope: "draft", wikiSlot: "draft", faceFolder: () => segment },
    { bagId: "temp",     mirrorRoot: `${P}/${FACES_PROJECTION_DIR}`, scope: "temp", wikiSlot: "temp", consentSlugs: ["notes"], faceFolder: () => segment },
  ];
  const designation = ["working", "personal", "draft", "temp"].map((k) => wikiSlotUri("notes", k as "working"));

  test("worn face: personal/<slug>, recovery/<slug>, temp/<slug>; the workbench stays at wikis/<slug>", () => {
    const resolved = resolveDiskMirrors(grant("Heron"), designation, "notes");
    const root = (scope: string): string | undefined => resolved.find((m) => m.scope === scope)?.mirrorRoot;
    expect(root("working")).toBe(`${P}/wikis/notes`);
    expect(root("personal")).toBe(`${P}/faces/Heron/personal/notes`);
    expect(root("draft")).toBe(`${P}/faces/Heron/recovery/notes`);
    expect(root("temp")).toBe(`${P}/faces/Heron/temp/notes`);
    for (const m of resolved) expect(m.mirrorRoot.startsWith(`${P}/wikis/notes/`), `${m.scope} never under the shared workbench`).toBe(false);
  });

  test("no face worn: no personal layer, no draft, no temp mirror; the workbench still stands", () => {
    expect(resolveDiskMirrors(grant(null), designation, "notes").map((m) => m.scope)).toEqual(["working"]);
  });
});

describe("R3 — the pet-name segment rule", () => {
  test.each([
    ["a/b", "face-segment-separator"], ["a\\b", "face-segment-separator"], ["a:b", "face-segment-colon"],
    ["a\0b", "face-segment-nul"], [".hidden", "face-segment-leading-dot"], [".", "face-segment-leading-dot"],
    ["..", "face-segment-leading-dot"], ["", "face-segment-empty"],
  ])("%j refuses by name (%s)", (petname, code) => {
    expect(faceSegmentRefusal(petname)?.code).toBe(code);
    expect(() => faceSegment(petname)).toThrow(FaceSegmentRefused);
    try { faceSegment(petname); } catch (e) { expect((e as FaceSegmentRefused).code).toBe(code); expect((e as Error).message).toContain(code); }
  });

  test("a name colliding case-insensitively with another face's segment refuses; so does the same segment", () => {
    expect(faceSegmentRefusal("heron", ["Heron"])?.code).toBe("face-segment-collision");
    expect(faceSegmentRefusal("Heron", ["Heron"])?.code).toBe("face-segment-collision");
    expect(faceSegmentRefusal("Heron", ["Egret"])).toBeNull();
  });

  test("otherwise the pet name as written: spaces and Unicode kept, NFC", () => {
    expect(faceSegment("Night Heron")).toBe("Night Heron");
    expect(faceSegment("ʻIo")).toBe("ʻIo");
    expect(faceSegment("Pelé")).toBe("Pelé");                      // NFD in, NFC out
    expect(faceSegment("a..b")).toBe("a..b");                            // an inner dot run names no parent
  });
});

describe("R4 — a re-minted face under the same pet name sites the same folder", () => {
  test("the relation changes; every face path holds", () => {
    const before = daemonDiskMirrors({ projectionRoot: P, canonBags: "/absent", face: { relation: F1, segment: "Heron" }, canon: true, temp: true });
    const after = daemonDiskMirrors({ projectionRoot: P, canonBags: "/absent", face: { relation: F2, segment: "Heron" }, canon: true, temp: true });
    expect(after.map((m) => m.mirrorRoot)).toEqual(before.map((m) => m.mirrorRoot));
    for (const m of after) expect(m.mirrorRoot).not.toContain(F2);
    // The canon BAG still follows the relation (a record identity), never its folder.
    expect(after.find((m) => m.scope === "daemon-canon")?.bagId).toBe(daemonFaceCanonBag(F2));
  });
});

describe("R5 — no index file under faces/; no two faces share a root", () => {
  test("the label shelf and the kahua index rest beside faces/, never inside", () => {
    expect(faceLabelsDir(P).startsWith(`${P}/${FACES_PROJECTION_DIR}/`)).toBe(false);
    expect(faceLabelsDir(P)).toBe(`${P}/face-labels`);
  });

  test("two faces' roots never nest or meet", () => {
    const a = faceRoot(P, faceSegment("Heron")), b = faceRoot(P, faceSegment("Egret", ["Heron"]));
    expect(a).not.toBe(b);
    expect(a.startsWith(b + sep) || b.startsWith(a + sep)).toBe(false);
    expect(() => faceSegment("HERON", ["Heron"])).toThrow(/face-segment-collision/);
  });
});

describe("R5b — the vessel reads its face's segment off the label shelf", () => {
  const made: string[] = [];
  afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });
  test("a re-minted face under the same pet name keeps its segment; another face's case-twin refuses by name", () => {
    const projections = mkdtempSync(join(tmpdir(), "face-root-labels-"));
    made.push(projections);
    writeFaceLabel({ relation: F1, petname: "Heron", handleIndex: 0 }, projections);
    expect(faceSiteOf({ relation: F2, petname: "Heron", handleIndex: 0 }, projections)).toEqual({ site: { relation: F2, segment: "Heron" } });
    expect(faceSiteOf({ relation: F2, petname: "heron", handleIndex: 1 }, projections)).toMatchObject({ refused: { code: "face-segment-collision" } });
    expect(faceSiteOf({ relation: F2, petname: "a/b", handleIndex: 1 }, projections)).toMatchObject({ refused: { code: "face-segment-separator" } });
    expect(faceSiteOf({ relation: F2, petname: null, handleIndex: 1 }, projections)).toMatchObject({ refused: { code: "face-segment-empty" } });
  });
});

describe("R6 — one copy: a shared wiki lands one disk copy, outside every face root", () => {
  test("two faces wear in turn: the workbench resolves to one folder; each personal layer to its own face's overlay layer", () => {
    let worn: string | null = "Heron";
    const grant: DiskMirrorGrant = [
      { bagId: "working",  mirrorRoot: `${P}/wikis`, scope: "working",  wikiSlot: "working" },
      { bagId: "personal", mirrorRoot: `${P}/${FACES_PROJECTION_DIR}`, scope: "personal", wikiSlot: "personal", faceFolder: () => worn },
    ];
    const designation = [wikiSlotUri("notes", "working"), wikiSlotUri("notes", "personal")];
    const asHeron = resolveDiskMirrors(grant, designation, "notes");
    worn = "Egret";
    const asEgret = resolveDiskMirrors(grant, designation, "notes");
    const benches = new Set([...asHeron, ...asEgret].filter((m) => m.bagId === wikiSlotUri("notes", "working")).map((m) => m.mirrorRoot));
    expect([...benches]).toEqual([`${P}/wikis/notes`]);
    for (const bench of benches) expect(bench.startsWith(`${P}/${FACES_PROJECTION_DIR}/`)).toBe(false);
    const personalLayer = (r: DiskMirrorGrant) => r.find((m) => m.scope === "personal")!;
    expect(personalLayer(asHeron)).toMatchObject({ bagId: wikiSlotUri("notes", "personal"), mirrorRoot: `${P}/faces/Heron/personal/notes` });
    expect(personalLayer(asEgret)).toMatchObject({ bagId: wikiSlotUri("notes", "personal"), mirrorRoot: `${P}/faces/Egret/personal/notes` });
    // A personal layer mirrors the overlay layer alone: never the workbench's bag.
    for (const r of [asHeron, asEgret]) expect(r.filter((m) => m.mirrorRoot.startsWith(`${P}/faces/`)).every((m) => m.bagId !== wikiSlotUri("notes", "working"))).toBe(true);
  });
});

describe("R7 — the reverse siting reads each face plane back", () => {
  const made: string[] = [];
  afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });
  test("wiki, canon and stage read against the face root; a personal layer against personal/", () => {
    const projections = mkdtempSync(join(tmpdir(), "face-root-"));
    made.push(projections);
    const root = faceRoot(projections, "Night Heron");
    const put = (rel: string, body: string): string => { const p = join(root, ...rel.split("/")); mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, body); return p; };
    const working = put("wiki/My Notes.tid", "title: My Notes\n\nbody");
    const canon = put("canon/ha.ka.ba/notes/pond.tid", "title: lar:///ha.ka.ba/notes/pond\n\nbody");
    const stage = put("stage/memory/heron.tid", "title: memory/heron\n\nbody");
    const personalLayer = put("personal/notes/Aside.tid", "title: Aside\n\nbody");
    expect(siteFileToTitle({ planeDir: root }, working)).toEqual({ title: "My Notes", by: "in-band" });
    expect(siteFileToTitle({ planeDir: root }, canon)).toEqual({ title: "lar:///ha.ka.ba/notes/pond", by: "loci" });
    expect(siteFileToTitle({ planeDir: root, titlePaths: true }, stage)).toEqual({ title: "memory/heron", by: "title-path" });
    expect(siteFileToTitle({ planeDir: join(root, "personal") }, personalLayer)).toEqual({ title: "Aside", by: "in-band" });
  });
});
