/**
 * `lares export` · `lares import` — the operator's authored memory carried across a re-founding, as content.
 *
 *   C1  export -> re-found (a fresh face with the same pet-name, a new relation and a new grant) -> import --apply:
 *       every working row reads back by content key in the new face's wiki, the memory row among them; each kahua head
 *       lands once, signed under the new grant; drafts and consented temp land beside the new face's folder.
 *   C2  a second import of the same bundle lands nothing, journal or no journal.
 *   C3  the bundle holds no sensorium file and nothing from bags/daemon; the manifest counts
 *       what the daemon bag leaves behind; faces key by pet-name and no face relation rides the bundle.
 *   C4  a tampered byte, an unlisted file or an unsafe path refuses before any write.
 *   C5  a dest inside the house root or the workspace refuses; an unsettled census refuses unless --accept-omissions
 *       names the bundle partial, and then the manifest records each omission.
 *   C6  a bundle face with no matching pet-name refuses by name; two faces sharing a pet-name refuse, on either side.
 *   C7  a diverged id stands off (working through the gate, kahua by body digest) and never overwrites.
 *   C8  preview writes nothing; a re-declare row replays as fresh acts on an unnamed face.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { repoRoot } from "@lararium/mesh/node";
import { kapaeShadowBody, SyncedTree } from "@lararium/node";
import { DAEMON_BAG_ID, daemonFaceCanonBag } from "@lararium/mesh";
import { scanFiles } from "../src/ingest-core.js";
import { carryExport, carryImport, carryJournalPath, CarryRefused, type CarryDoors, type CarryVesselFace } from "../src/commands/carry.js";
import { CarryBundleRefused, MANIFEST_FILE } from "../src/carry-manifest.js";
import type { CensusReading } from "../src/commands/census.js";
import type { CarryKahuaHead } from "../src/carry-manifest.js";

const F1 = "11111111-1111-4111-8111-111111111111";
const F2 = "22222222-2222-4222-8222-222222222222";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const MEMORY = "lar:///ha.ka.ba/kahua/memory/heron";
const NOTE = "lar:///ha.ka.ba/notes/pond";

/** A vessel the doors reach: faces, the worn face's daemon working records, each face's kahua stage. */
class FakeVessel {
  faces: CarryVesselFace[];
  records = new Map<string, string>();
  bagRecords = new Map<string, Map<string, string>>();
  kapae = new Set<string>();
  lifts: Array<{ face: number; title: string; text: string; signer: string; parent: string | null }> = [];
  stage = new Map<number, CarryKahuaHead[]>();
  ingestCalls = 0;
  waves: Array<Parameters<CarryDoors["ingest"]>[0]> = [];
  inWikiBags: string[] = [];
  held = new Set<string>(["garden"]);
  mints: string[] = [];
  acts: string[] = [];
  census: CensusReading = { clean: true, items: [], unanswered: [] };
  constructor(faces: Array<Partial<CarryVesselFace> & { handleIndex: number }>, readonly grant: string) {
    this.faces = faces.map((f) => ({ petname: null, relation: null, handle: null, seat: false, chair: null, kahua: [], ...f }));
    for (const f of this.faces) this.stage.set(f.handleIndex, [...(f.kahua ?? [])]);
  }
  doors(): CarryDoors {
    return {
      census: async () => this.census,
      faces: async () => this.faces.map((f) => ({ ...f, kahua: [...(this.stage.get(f.handleIndex) ?? [])] })),
      tempConsented: () => ["daemon"],
      rename: async (i, petname) => { this.acts.push(`rename h${i} ${petname}`); this.faces = this.faces.map((f) => (f.handleIndex === i ? { ...f, petname } : f)); },
      declareHandle: async (i, handle) => { this.acts.push(`handle h${i} ${handle}`); this.faces = this.faces.map((f) => (f.handleIndex === i ? { ...f, handle } : f)); },
      standSeat: async (i, chair) => { this.acts.push(`seat h${i} ${chair}`); this.faces = this.faces.map((f) => (f.handleIndex === i ? { ...f, seat: true, chair } : f)); },
      heldSlugs: async () => new Set(this.held),
      mintBag: async (bag) => { this.mints.push(bag); this.held.add(bag.slice(bag.lastIndexOf("/") + 1)); },
      ingest: async (wave) => {
        this.waves.push(wave);
        const { toBag, candidates, kapae, inWiki, wiki } = wave;
        this.ingestCalls++;
        if (inWiki === true) this.inWikiBags.push(`${toBag} in ${wiki}`);
        const store = toBag === "lar:///ha.ka.ba/wikis/daemon/working" ? this.records : (this.bagRecords.get(toBag) ?? this.bagRecords.set(toBag, new Map()).get(toBag)!);
        const landed: string[] = [], conflicts: Array<{ uri: string; why: string }> = [];
        for (const c of candidates) {
          const held = store.get(c.uri);
          if (held === undefined || held === c.text) { store.set(c.uri, c.text); landed.push(c.uri); }
          else conflicts.push({ uri: c.uri, why: "no-base" });
        }
        for (const t of kapae) this.kapae.add(t);
        return { landed, conflicts, refused: [], unanswered: [], kapaeRaised: [...kapae], kapaeRefused: [] };
      },
      kahuaLift: async (face, lift) => {
        const cid = sha(`${this.grant}:${lift.title}:${lift.text}:${this.lifts.length}`);
        this.lifts.push({ face, title: lift.title, text: lift.text, signer: this.grant, parent: lift.parent });
        this.stage.get(face)!.push({ title: lift.title, cid, text: lift.text, fields: { ...lift.fields }, taint: [...lift.taint], sources: [...lift.sources] });
        return { cid };
      },
    };
  }
}

let root: string, out: string;
const put = (rel: string, text: string): void => { const p = join(root, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const tid = (title: string, text: string): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${text}\n`;
const head = (title: string, text: string, cid: string): CarryKahuaHead => ({ title, cid, text, fields: { tags: "memory" }, taint: [], sources: [{ title: NOTE, revision: "r1" }] });

/** The house as the old founding left it: a worn face's working folder, stage, drafts, temp, a minted bag, and what never travels. */
function seedHouse(): void {
  put(`projections/wikis/daemon-${F1}/ha.ka.ba/kahua/memory/heron.tid`, tid(MEMORY, "remember the heron"));
  put(`projections/wikis/daemon-${F1}/ha.ka.ba/notes/pond.tid`, tid(NOTE, "the pond at dusk"));
  put(`projections/wikis/daemon-${F1}/ha.ka.ba/notes/gone.kapae`, kapaeShadowBody("lar:///ha.ka.ba/notes/gone"));
  put(`projections/wikis/daemon-${F1}/recovery/draft-one.tid`, tid("draft one", "half a thought"));
  put(`projections/wikis/daemon-${F1}/temp/scratch.tid`, tid("scratch", "a passing note"));
  put(`projections/bags/kahua-${F1}/ha.ka.ba/kahua/memory/heron.tid`, tid(MEMORY, "remember the heron"));
  put("projections/bags/garden/ha.ka.ba/garden/rose.tid", tid("lar:///ha.ka.ba/garden/rose", "a rose"));
  put("sensoriums/memory/persistence/testimony.ndjson", "{\"witness\":1}\n");
  put("hearth/vessel/store.bin", "old keys");
}

const oldVessel = (): FakeVessel => new FakeVessel([{ handleIndex: 0, petname: "hearth-one", relation: F1, handle: "Heron", seat: true, chair: "east", kahua: [head(MEMORY, "remember the heron", sha("old-cid-1"))] }], "old-grant");
/** A re-founding: the hearth cleared, persona zero founded fresh under the same pet-name, a new relation and grant. */
function refound(over: Partial<CarryVesselFace> = {}): FakeVessel {
  rmSync(join(root, "hearth"), { recursive: true, force: true });
  return new FakeVessel([{ handleIndex: 0, petname: "hearth-one", relation: F2, ...over }], "new-grant");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-carry-house-"));
  writeFileSync(join(root, ".lar-test-scratch"), "carry suite\n");
  process.env["LAR_ROOT"] = root;
  out = join(mkdtempSync(join(tmpdir(), "lar-carry-out-")), "bundle");
  seedHouse();
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); rmSync(dirname(out), { recursive: true, force: true }); });

describe("the carry verbs", () => {
  test("apply restores wave files to their mirror before ingest, including shadows", async () => {
    put("projections/wikis/pond/ha.ka.ba/notes/gone.kapae", kapaeShadowBody("lar:///ha.ka.ba/notes/gone"));
    await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    const after = refound();
    rmSync(join(root, "projections/bags/garden"), { recursive: true });
    rmSync(join(root, "projections/wikis/pond"), { recursive: true });
    await carryImport(out, { apply: true, doors: after.doors() });
    const mirror = join(root, "projections/bags/garden");
    const wave = after.waves.find((w) => w.toBag === "lar:///ha.ka.ba/bags/garden")!;
    expect(wave.source).toBe(mirror);
    expect(readFileSync(join(mirror, "ha.ka.ba/garden/rose.tid"), "utf8")).toBe(tid("lar:///ha.ka.ba/garden/rose", "a rose"));
    expect(readFileSync(join(root, "projections/wikis/pond/ha.ka.ba/notes/gone.kapae"), "utf8")).toBe(kapaeShadowBody("lar:///ha.ka.ba/notes/gone"));
    expect(after.waves.find((w) => w.wiki === "pond")?.kapae).toContain("lar:///ha.ka.ba/notes/gone");
  });

  test("face working shadows and canon land in target face mirrors", async () => {
    const gone = "lar:///ha.ka.ba/memory/gone", canon = "lar:///ha.ka.ba/memory/canon";
    put(`projections/wikis/daemon-${F1}/ha.ka.ba/memory/gone.kapae`, kapaeShadowBody(gone));
    put(`projections/bags/daemon-${F1}/ha.ka.ba/memory/canon.tid`, tid(canon, "canon memory"));
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    expect(manifest.rows.some((r) => r.layer === "kapae" && r.title === gone)).toBe(true);
    expect(manifest.rows.some((r) => r.layer === "daemon-canon" && r.title === canon)).toBe(true);
    const after = refound();
    const result = await carryImport(out, { apply: true, doors: after.doors() });
    expect(after.kapae.has(gone)).toBe(true);
    expect(result.tallies.kapae.landed).toBe(2);
    expect(after.bagRecords.get(daemonFaceCanonBag(F2))?.get(canon)).toBe(tid(canon, "canon memory"));
    expect(result.tallies.daemonCanon.landed).toBe(1);
    expect(after.waves.find((w) => w.toBag === daemonFaceCanonBag(F2))?.source).toBe(join(root, `projections/bags/daemon-${F2}`));
    expect(after.waves.find((w) => w.toBag === "lar:///ha.ka.ba/wikis/daemon/working")?.source).toBe(join(root, `projections/wikis/daemon-${F2}`));
    expect(readFileSync(join(root, `projections/wikis/daemon-${F2}/ha.ka.ba/memory/gone.kapae`), "utf8")).toBe(kapaeShadowBody(gone));
  });

  test("a different mirror file stands off and never enters the wave", async () => {
    await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    const after = refound();
    const path = join(root, "projections/bags/garden/ha.ka.ba/garden/rose.tid");
    writeFileSync(path, "different");
    const result = await carryImport(out, { apply: true, doors: after.doors() });
    expect(readFileSync(path, "utf8")).toBe("different");
    expect(result.tallies.bag.stoodOff).toContain("lar:///ha.ka.ba/garden/rose (a different file stands in the mirror; left as it stands)");
    expect(after.waves.flatMap((w) => w.candidates).some((c) => c.uri === "lar:///ha.ka.ba/garden/rose")).toBe(false);
  });

  test("the journal prevents repeated mirror writes and candidates", async () => {
    await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    const after = refound();
    await carryImport(out, { apply: true, doors: after.doors() });
    const path = join(root, "projections/bags/garden/ha.ka.ba/garden/rose.tid");
    const before = readFileSync(path);
    const calls = after.waves.length;
    const { mtimeMs } = (await import("node:fs")).statSync(path);
    await carryImport(out, { apply: true, doors: after.doors() });
    expect(readFileSync(path)).toEqual(before);
    expect((await import("node:fs")).statSync(path).mtimeMs).toBe(mtimeMs);
    expect(after.waves.slice(calls).flatMap((w) => w.candidates)).toEqual([]);
  });
  test("C1 — carry follows active mirrors: kahua heads, drafts and temp land under the new face", async () => {
    const before = oldVessel();
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: before.doors() });
    expect(manifest.counts.working).toBeGreaterThan(0);

    const after = refound();
    const result = await carryImport(out, { apply: true, doors: after.doors() });
    expect(result.faceMap).toEqual({ "hearth-one": 0 });
    expect(after.records.has(MEMORY)).toBe(true);
    expect(after.records.has(NOTE)).toBe(true);
    expect([...after.kapae]).toEqual(["lar:///ha.ka.ba/notes/gone"]);
    expect(after.bagRecords.get("lar:///ha.ka.ba/bags/garden")?.get("lar:///ha.ka.ba/garden/rose")).toBe(tid("lar:///ha.ka.ba/garden/rose", "a rose"));
    expect(after.lifts).toEqual([{ face: 0, title: MEMORY, text: "remember the heron", signer: "new-grant", parent: null }]);
    expect(readFileSync(join(root, `projections/wikis/daemon-${F2}/recovery/draft-one.tid`), "utf8")).toBe(tid("draft one", "half a thought"));
    expect(readFileSync(join(root, `projections/wikis/daemon-${F2}/temp/scratch.tid`), "utf8")).toBe(tid("scratch", "a passing note"));
    // The re-declare list replayed what the fresh face did not hold yet: the Handle and the chair.
    expect(after.acts).toEqual(["handle h0 Heron", "seat h0 east"]);
    expect(Object.values(result.tallies).every((t) => t.refused.length === 0 && t.stoodOff.length === 0)).toBe(true);
  });

  test("C2 — a second import of the same bundle lands nothing, and without its journal still lands nothing new", async () => {
    await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    const after = refound();
    await carryImport(out, { apply: true, doors: after.doors() });
    const records = new Map(after.records), lifts = after.lifts.length, calls = after.ingestCalls;
    const again = await carryImport(out, { apply: true, doors: after.doors() });
    expect(after.ingestCalls).toBe(calls);
    expect(after.lifts.length).toBe(lifts);
    expect(Object.values(again.tallies).every((t) => t.landed === 0 && t.planned === 0)).toBe(true);
    expect(after.acts).toEqual(["handle h0 Heron", "seat h0 east"]);

    const manifest = JSON.parse(readFileSync(join(out, MANIFEST_FILE), "utf8")) as { bundleId: string };
    rmSync(carryJournalPath(manifest.bundleId));
    await carryImport(out, { apply: true, doors: after.doors() });
    expect(after.records).toEqual(records);
    expect(after.lifts.length).toBe(lifts);
    expect(after.stage.get(0)!.filter((h) => h.title === MEMORY)).toHaveLength(1);
  });

  test("C3 — the bundle excludes sensoriums and daemon control files; faces key by pet-name", async () => {
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    for (const f of manifest.files) expect(f.path).not.toMatch(/sensorium|bags\/daemon|hearth/);
    const bundleText = manifest.files.map((f) => readFileSync(join(out, ...f.path.split("/")), "utf8")).join("\n") + readFileSync(join(out, MANIFEST_FILE), "utf8");
    expect(bundleText).not.toContain(F1);
    expect(manifest.faces).toEqual([{ key: "f0", petname: "hearth-one" }]);
    expect(manifest.omissions.some((o) => o.kind === "daemon-bag")).toBe(false);
    expect(manifest.counts).toMatchObject({ working: 2, kapae: 1, draft: 1, temp: 1, "kahua-carrier": 1, "kahua-head": 1, bag: 1 });
    expect(manifest.tempBytes["lar:///ha.ka.ba/wikis/daemon/temp"]).toBe(tid("scratch", "a passing note").length);
    const redeclare = JSON.parse(readFileSync(join(out, "re-declare.json"), "utf8"));
    expect(redeclare.faces).toEqual([{ face: "f0", handleIndex: 0, petname: "hearth-one", handle: "Heron", seat: true, chair: "east" }]);
  });

  test("C4 — a tampered byte, an unlisted file or an unsafe path refuses before any write", async () => {
    await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    const target = join(out, "bags/garden/ha.ka.ba/garden/rose.tid");
    const good = readFileSync(target, "utf8");
    writeFileSync(target, good.replace("rose", "dawn"));
    const after = refound();
    await expect(carryImport(out, { apply: true, doors: after.doors() })).rejects.toThrow(/bundle-hash-mismatch/);
    expect(after.ingestCalls + after.lifts.length + after.acts.length).toBe(0);
    expect(existsSync(join(root, `projections/wikis/daemon-${F2}`))).toBe(false);
    writeFileSync(target, good);

    writeFileSync(join(out, "faces/f0/stray.tid"), "slipped in");
    await expect(carryImport(out, { apply: true, doors: after.doors() })).rejects.toThrow(/bundle-unlisted-file/);
    rmSync(join(out, "faces/f0/stray.tid"));

    const m = JSON.parse(readFileSync(join(out, MANIFEST_FILE), "utf8"));
    m.files[0].path = `../${m.files[0].path}`;
    writeFileSync(join(out, MANIFEST_FILE), JSON.stringify(m));
    await expect(carryImport(out, { apply: true, doors: after.doors() })).rejects.toBeInstanceOf(CarryBundleRefused);
    expect(after.ingestCalls + after.lifts.length + after.acts.length).toBe(0);
  });

  test("C5 — a dest inside the house or the workspace refuses; an unsettled census refuses unless the export names itself partial", async () => {
    const v = oldVessel();
    await expect(carryExport(join(root, "backup"), { acceptOmissions: false, doors: v.doors() })).rejects.toThrow(/carry-dest-inside-house/);
    await expect(carryExport(join(repoRoot, "tmp-carry-bundle"), { acceptOmissions: false, doors: v.doors() })).rejects.toThrow(/carry-dest-inside-workspace/);
    expect(existsSync(join(repoRoot, "tmp-carry-bundle"))).toBe(false);
    symlinkSync(root, join(dirname(out), "house-link"));
    await expect(carryExport(join(dirname(out), "house-link", "backup"), { acceptOmissions: false, doors: v.doors() })).rejects.toThrow(/carry-dest-inside-house/);
    rmSync(join(dirname(out), "house-link"));
    v.census = { clean: false, items: [{ kind: "carrier", state: "pending", uri: NOTE, bagId: "daemon", island: "daemon" }, { kind: "held-save", refusal: "save-unbooked", documentId: "doc-1", saves: 1, bagId: null }], unanswered: [] };
    await expect(carryExport(out, { acceptOmissions: false, doors: v.doors() })).rejects.toThrow(/carry-unsettled[\s\S]*pending/);
    expect(existsSync(out)).toBe(false);
    expect(readdirSync(dirname(out))).toEqual([]);
    const { manifest } = await carryExport(out, { acceptOmissions: true, doors: v.doors() });
    expect(manifest.omissions.find((o) => o.kind === "unsettled-carriers")?.count).toBe(1);
    expect(manifest.omissions.find((o) => o.kind === "held-saves")?.count).toBe(1);
    await expect(carryExport(out, { acceptOmissions: true, doors: v.doors() })).rejects.toThrow(/carry-dest-stands/);
  });

  test("C6 — no matching pet-name refuses by name; duplicate pet-names refuse on either side", async () => {
    await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    const stranger = refound({ petname: "someone-else" });
    await expect(carryImport(out, { apply: true, doors: stranger.doors() })).rejects.toThrow(/carry-face-unmatched[\s\S]*hearth-one/);
    expect(stranger.ingestCalls + stranger.lifts.length + stranger.acts.length).toBe(0);

    const twins = new FakeVessel([{ handleIndex: 0, petname: "hearth-one", relation: F2 }, { handleIndex: 1, petname: "hearth-one", relation: "33333333-3333-4333-8333-333333333333" }], "g");
    await expect(carryImport(out, { apply: true, doors: twins.doors() })).rejects.toThrow(/carry-face-duplicate-petname/);

    const out2 = join(dirname(out), "bundle-two");
    const twinsOld = new FakeVessel([{ handleIndex: 0, petname: "same", relation: F1 }, { handleIndex: 1, petname: "same", relation: "33333333-3333-4333-8333-333333333333" }], "g");
    await expect(carryExport(out2, { acceptOmissions: false, doors: twinsOld.doors() })).rejects.toThrow(/carry-face-duplicate-petname/);
    const unnamed = new FakeVessel([{ handleIndex: 0, petname: null, relation: F1 }], "g");
    await expect(carryExport(out2, { acceptOmissions: false, doors: unnamed.doors() })).rejects.toThrow(/carry-face-unnamed/);
  });

  test("C7 — a diverged id stands off and never overwrites, in the wiki and on the stage", async () => {
    await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    const after = refound({ kahua: [head(MEMORY, "a different heron", sha("x"))] });
    after.records.set(NOTE, tid(NOTE, "the pond rewritten"));
    put(`projections/wikis/daemon-${F2}/recovery/draft-one.tid`, "someone else's draft");
    const result = await carryImport(out, { apply: true, doors: after.doors() });
    expect(after.records.get(NOTE)).toBe(tid(NOTE, "the pond rewritten"));
    expect(result.tallies.working.stoodOff.join()).toContain(NOTE);
    expect(result.tallies.kahua.stoodOff.join()).toContain(MEMORY);
    expect(after.lifts).toEqual([]);
    expect(result.tallies.draft.stoodOff).toHaveLength(1);
    expect(readFileSync(join(root, `projections/wikis/daemon-${F2}/recovery/draft-one.tid`), "utf8")).toBe("someone else's draft");
  });

  test("C8 — preview writes nothing; an unnamed face at the bundle's index takes the pet-name as a fresh act", async () => {
    await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    const after = refound({ petname: null });
    const preview = await carryImport(out, { apply: false, doors: after.doors() });
    expect(preview.redeclare).toEqual(['h0: pet-name "hearth-one"', 'h0: Handle "Heron"', 'h0: stands for the chair "east"']);
    expect(preview.tallies.working.planned).toBeGreaterThan(0);
    expect(preview.tallies.kahua.planned).toBe(1);
    expect(after.ingestCalls + after.lifts.length + after.acts.length).toBe(0);
    expect(existsSync(join(root, `projections/wikis/daemon-${F2}`))).toBe(false);
    expect(existsSync(join(root, "config", "carry-journal"))).toBe(false);
    await carryImport(out, { apply: true, doors: after.doors() });
    expect(after.acts[0]).toBe("rename h0 hearth-one");
    expect(after.records.has(MEMORY)).toBe(true);
  });

  test("C10 — files under bags/daemon have no carry grant", async () => {
    const STAGE = "lar:///ha.ka.ba/kahua/memory/stage-note";
    put("projections/bags/daemon/ha.ka.ba/kahua/memory/stage-note.tid", tid(STAGE, "a committed memory"));
    put("projections/bags/daemon/ha.ka.ba/bags/persona/group-secret/abc.tid", tid("lar:///ha.ka.ba/bags/persona/group-secret/abc", "sealed"));
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    expect(manifest.rows.some((r) => r.layer === "daemon-canon")).toBe(false);
    expect(manifest.files.some((f) => f.path.startsWith("daemon/canon/"))).toBe(false);
    expect(manifest.files.some((f) => f.path.includes("persona"))).toBe(false);
    expect(manifest.omissions.some((o) => o.kind === "daemon-bag")).toBe(false);
    const after = refound();
    const result = await carryImport(out, { apply: true, doors: after.doors() });
    expect(after.bagRecords.get(DAEMON_BAG_ID)?.get(STAGE)).toBeUndefined();
    const calls = after.ingestCalls;
    await carryImport(out, { apply: true, doors: after.doors() });
    expect(after.ingestCalls).toBe(calls);
  });

  test("C11 — every other wiki's working rows travel; a slug the fresh vessel lacks mints first, named in the preview", async () => {
    const PAGE = "lar:///ha.ka.ba/notes/field-page";
    put("projections/wikis/field-notes/ha.ka.ba/notes/field-page.tid", tid(PAGE, "a field note"));
    put("projections/wikis/field-notes/recovery/half.tid", tid("half", "a draft"));
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    expect(manifest.rows.filter((r) => r.layer === "wiki-working").map((r) => [r.bag, r.title])).toEqual([["lar:///ha.ka.ba/wikis/field-notes/working", PAGE]]);
    const after = refound();
    after.held = new Set();
    const preview = await carryImport(out, { apply: false, doors: after.doors() });
    expect(preview.minted).toEqual(["lar:///ha.ka.ba/bags/field-notes", "lar:///ha.ka.ba/bags/garden"]);
    expect(after.mints).toEqual([]);
    await carryImport(out, { apply: true, doors: after.doors() });
    expect(after.mints).toEqual(["lar:///ha.ka.ba/bags/field-notes", "lar:///ha.ka.ba/bags/garden"]);
    expect(after.bagRecords.get("lar:///ha.ka.ba/wikis/field-notes/working")?.get(PAGE)).toBe(tid(PAGE, "a field note"));
    expect(after.inWikiBags).toEqual(["lar:///ha.ka.ba/wikis/field-notes/working in field-notes"]);
    expect(readFileSync(join(root, "projections/wikis/field-notes/recovery/half.tid"), "utf8")).toBe(tid("half", "a draft"));
  });

  test("C12 — the manifest lists the library's collections by index digest; no original enters the bundle", async () => {
    put("library/books/index.mem", "the books index\n");
    put("library/books/abc123/moby-dick.txt", "Call me Ishmael.");
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: oldVessel().doors() });
    expect(manifest.library).toEqual([{ collection: "books", indexSha256: sha("the books index\n") }]);
    expect(manifest.files.some((f) => f.path.includes("moby") || f.path.includes("library"))).toBe(false);
  });

  test("C13 — source title does not select the bag that receives a carry wave", () => {
    const dir = mkdtempSync(join(tmpdir(), "lar-withheld-"));
    const files = ["h/ha.ka.ba/bags/daemon/outcomes/o1.tid", "h/ha.ka.ba/bags/persona/binding/signer-did.tid", "h/ha.ka.ba/kahua/memory/m.tid"].map((r) => {
      const p = join(dir, ...r.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, "x\n"); return p;
    });
    const titles = [
      "lar:///ha.ka.ba/bags/daemon/outcomes/o1", "lar:///ha.ka.ba/bags/persona/binding/signer-did", "lar:///ha.ka.ba/kahua/memory/m",
    ];
    const titleOf = (_r: string, f: string) => `lar:///${f.slice(join(dir, "h").length + 1).replace(/\.tid$/, "")}`;
    const selected = scanFiles(dir, files, "lar:///ha.ka.ba/bags/garden", new SyncedTree(null), titleOf);
    expect(selected.rows.map((r) => r.uri)).toEqual(titles);
    const other = scanFiles(dir, files, "lar:///ha.ka.ba/bags/crossroads", new SyncedTree(null), titleOf);
    expect(other.rows.map((r) => r.uri)).toEqual(titles);
    rmSync(dir, { recursive: true, force: true });
  });

  test("C9 — the refusal classes carry their codes", () => {
    expect(new CarryRefused("carry-x", "why").message).toBe("carry-x: why");
  });
});
