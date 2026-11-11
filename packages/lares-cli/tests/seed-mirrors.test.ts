/**
 * seed-mirrors — a seed lays EVERY disk mirror back into the ONE layer it mirrors, through INGEST's three-way gate; it
 * adopts a former face's folders by pet-name after a re-founding; it lifts kahua by the operator's hand alone, with eyes;
 * and it moves an adopted face's folders to ashes once nothing stands pending.
 *
 * The vessel below holds layers of records, a synced base per mirror file (the three-way gate: disk equal to base lands
 * nothing, disk moved lands, both moved stands off), the composite's override-base fork, and each face's kahua stage.
 *
 *   M1  the full round trip: a working copy over a canon title, a working-only title, a kāpae shadow, a face-canon memory,
 *       a house-bag row and a kahua item; export -> reset -> found -> seed -> import puts every record in the same layer
 *       with the same bytes, the copy keeps its base and still shadows, kahua stands pending until confirmed and then
 *       lifts signed by the new face, the old folders rest under ashes; a second seed and a second import land nothing
 *   M2  the same with NO export: reset -> found -> seed recovers the daemon memory by pet-name, from disk alone
 *   M3  an ambiguous pet-name refuses and lands nothing; so do an unmatched one and a folder no label names
 *   M4  a kahua mirror file: the preview lists it; no confirm -> pending; a wrong count refuses; --yes alone lifts nothing;
 *       a file that differs from the standing head reads `differs` and supersedes it on the confirmed count
 *   M5  ashes never read back into a layer, never travel in a bundle, never copy into a live mirror
 *   M6  an import's bag row and the seeded canon for one title meet at the gate: divergence stands off, never overwrites
 *   M7  the override base travels: the export's working row carries it, and an import that lands the copy restores it
 *   M8  a base forked before the reset survives a SEED-ONLY recovery (the face's bases sidecar), and canon still reads
 *       fresher than the copy
 *   M9  two faces: each face's working rows carry that face's own bases, never the face the daemon wears
 *   M10 a labelled former face whose folders hold a file the bundle never carried: the import leaves it out of ashes,
 *       the seed adopts it, and only then do its folders move to ashes
 *   M11 a fresh face that reads no relation and no stage (no refusal) never halts the seed
 *   M12 a face folder no label names: the seed names it and adopts nothing; the import never adopts, labels or moves it
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { kapaeShadowBody, readKapaeShadow, mirrorDirFileToUri } from "@lararium/node";
import { daemonFaceCanonBag, carrierHash } from "@lararium/mesh";
import { seedMirrors, mirrorFiles, readKahuaPending, MirrorRefused, type MirrorDoors, type MirrorLaid, type MirrorWave } from "../src/seed-mirrors.js";
import { carryExport, carryImport, type CarryDoors, type CarryVesselFace } from "../src/commands/carry.js";
import { writeFaceLabels, faceLabelPath, writeFaceBases, readFaceLabel } from "../src/face-labels.js";
import { runMirrorLeg } from "../src/commands/seed.js";
import type { CarryKahuaHead } from "../src/carry-manifest.js";

const F1 = "11111111-1111-4111-8111-111111111111";
const F2 = "22222222-2222-4222-8222-222222222222";
const F3 = "33333333-3333-4333-8333-333333333333";
const WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
const POND = "lar:///ha.ka.ba/notes/pond";
const HERON = "lar:///ha.ka.ba/kahua/memory/heron";
const GONE = "lar:///ha.ka.ba/notes/gone";
const DEEP = "lar:///ha.ka.ba/memory/deep";
const ROSE = "lar:///ha.ka.ba/garden/rose";
const GARDEN = "lar:///ha.ka.ba/bags/garden";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
/** A .tid file's carrier identity: `carrierHash` over its bytes, the canonical carrier form the vessel's records render to. */
const carrierOf = (s: string): string => carrierHash(s);

interface Rec { text: string; base?: string; deleted?: boolean }

/** A vessel the doors reach: layered records, a synced base per mirror file, the override fork, each face's stage. */
class FakeHouse {
  faces: CarryVesselFace[];
  layers = new Map<string, Map<string, Rec>>();
  synced = new Map<string, string>();
  stage = new Map<number, CarryKahuaHead[]>();
  lifts: Array<{ face: number; title: string; text: string; signer: string; parent: string | null }> = [];
  laid: string[] = [];
  held = new Set<string>();
  mints: string[] = [];
  constructor(faces: Array<Partial<CarryVesselFace> & { handleIndex: number }>, readonly grant: string, readonly worn: string) {
    this.faces = faces.map((f) => ({ petname: null, relation: null, handle: null, seat: false, chair: null, kahua: [], ...f }));
    for (const f of this.faces) this.stage.set(f.handleIndex, [...(f.kahua ?? [])]);
  }
  layer(bag: string): Map<string, Rec> { return this.layers.get(bag) ?? this.layers.set(bag, new Map()).get(bag)!; }
  live(bag: string, title: string): Rec | undefined { const r = this.layer(bag).get(title); return r && !r.deleted ? r : undefined; }
  canonUnder(bag: string): string | null {
    if (bag === WORKING) return daemonFaceCanonBag(this.worn);
    const m = /^lar:\/\/\/ha\.ka\.ba\/wikis\/([^/]+)\/working$/.exec(bag);
    return m ? `lar:///ha.ka.ba/bags/${m[1]}` : null;
  }
  /** The composite's fork: a record that names a base keeps it; a working write over a title canon holds forks one. */
  land(bag: string, title: string, text: string, given?: string): void {
    const canon = this.canonUnder(bag);
    const prior = this.layer(bag).get(title);
    const base = given ?? prior?.base ?? (canon !== null && this.live(canon, title) ? carrierOf(this.live(canon, title)!.text) : undefined);
    this.layer(bag).set(title, { text, ...(base !== undefined ? { base } : {}) });
  }
  facesNow(): CarryVesselFace[] { return this.faces.map((f) => ({ ...f, kahua: [...(this.stage.get(f.handleIndex) ?? [])] })); }
  async lay(wave: MirrorWave, apply: boolean): Promise<MirrorLaid> {
    this.laid.push(wave.source);
    const planned: string[] = [], kapae: string[] = [];
    const cands: Array<{ uri: string; key: string; text: string; base: string | undefined }> = [];
    for (const rel of mirrorFiles(wave.source, wave.skipTop).filter((r) => !r.endsWith(".meta"))) {
      const abs = join(wave.source, ...rel.split("/"));
      if (rel.endsWith(".kapae")) { const k = readKapaeShadow(readFileSync(abs, "utf8")); if ("title" in k) kapae.push(k.title); continue; }
      const uri = mirrorDirFileToUri(wave.uriDir, abs);
      if (!uri) continue;
      const text = readFileSync(abs, "utf8"), key = `${wave.toBag}\n${abs}`, base = this.synced.get(key);
      if (base === sha(text)) continue;
      cands.push({ uri, key, text, base });
      planned.push(uri);
    }
    const out = { planned, kapae, landed: [] as string[], kapaeRaised: [] as string[], conflicts: [] as Array<{ uri: string; why: string }>, refused: [], unanswered: [] };
    if (!apply) return out;
    for (const c of cands) {
      const held = this.live(wave.toBag, c.uri);
      const lands = c.base === undefined ? (held === undefined || held.text === c.text) : (held === undefined || sha(held.text) === c.base);
      if (!lands) { out.conflicts.push({ uri: c.uri, why: c.base === undefined ? "no-base" : "both-moved" }); continue; }
      if (held?.text !== c.text) this.land(wave.toBag, c.uri, c.text, wave.bases?.[c.uri]);
      this.synced.set(c.key, sha(c.text));
      out.landed.push(c.uri);
    }
    for (const t of kapae) { if (this.layer(wave.toBag).get(t)?.deleted) continue; this.layer(wave.toBag).set(t, { text: "", deleted: true }); out.kapaeRaised.push(t); }
    return out;
  }
  kahuaLift: CarryDoors["kahuaLift"] = async (face, lift) => {
    const cid = sha(`${this.grant}:${lift.title}:${lift.text}:${this.lifts.length}`);
    this.lifts.push({ face, title: lift.title, text: lift.text, signer: this.grant, parent: lift.parent });
    const heads = (this.stage.get(face) ?? []).filter((h) => h.cid !== lift.parent);
    this.stage.set(face, [...heads, { title: lift.title, cid, text: lift.text, fields: { ...lift.fields }, taint: [...lift.taint], sources: [...lift.sources] }]);
    return { cid };
  };
  mirrorDoors(): MirrorDoors {
    return {
      faces: async () => this.facesNow(), tempConsented: () => ["daemon"],
      heldSlugs: async () => new Set(this.held), mintBag: async (bag) => { this.mints.push(bag); this.held.add(bag.slice(bag.lastIndexOf("/") + 1)); },
      kahuaLift: this.kahuaLift, lay: (w, a) => this.lay(w, a), sourced: () => false,
    };
  }
  carryDoors(): CarryDoors {
    return {
      census: async () => ({ clean: true, items: [], unanswered: [] }),
      faces: async () => this.facesNow(), tempConsented: () => ["daemon"],
      rename: async () => {}, declareHandle: async () => {}, standSeat: async () => {},
      heldSlugs: async () => new Set(this.held), mintBag: async (bag) => { this.mints.push(bag); this.held.add(bag.slice(bag.lastIndexOf("/") + 1)); },
      ingest: async ({ toBag, candidates, kapae }) => {
        const landed: string[] = [], conflicts: Array<{ uri: string; why: string }> = [];
        for (const c of candidates) {
          const held = this.live(toBag, c.uri);
          if (held === undefined) { this.land(toBag, c.uri, c.text, c.overrideBase); landed.push(c.uri); }
          else if (held.text === c.text) landed.push(c.uri);              // noop: the records already say it; nothing writes
          else conflicts.push({ uri: c.uri, why: "no-base" });
        }
        const raised: string[] = [];
        for (const t of kapae) { if (!this.layer(toBag).get(t)?.deleted) this.layer(toBag).set(t, { text: "", deleted: true }); raised.push(t); }
        return { landed, conflicts, refused: [], unanswered: [], kapaeRaised: raised, kapaeRefused: [] };
      },
      overrideBases: async (bag) => Object.fromEntries([...this.layer(bag)].filter(([, r]) => r.base !== undefined && !r.deleted).map(([t, r]) => [t, r.base!])),
      kahuaLift: this.kahuaLift,
    };
  }
}

let root: string, out: string;
const put = (rel: string, text: string): void => { const p = join(root, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const tid = (title: string, text: string, extra = ""): string => `title: ${title}\n${extra}type: text/vnd.tiddlywiki\n\n${text}\n`;
const P = (rel: string): string => join(root, "projections", ...rel.split("/"));

const POND_CANON = tid(POND, "the pond as canon said it");
const POND_WORKING = tid(POND, "the pond as a hand wrote it");

/** The old founding's disk: face F1's mirrors, a house bag, a kahua item. */
function oldDisk(): void {
  put(`projections/bags/daemon-${F1}/ha.ka.ba/notes/pond.tid`, POND_CANON);
  put(`projections/bags/daemon-${F1}/ha.ka.ba/memory/deep.tid`, tid(DEEP, "a memory promoted to the face's canon"));
  put(`projections/wikis/daemon-${F1}/ha.ka.ba/notes/pond.tid`, POND_WORKING);
  put(`projections/wikis/daemon-${F1}/ha.ka.ba/kahua/memory/heron.tid`, tid(HERON, "remember the heron"));
  put(`projections/wikis/daemon-${F1}/ha.ka.ba/notes/gone.kapae`, kapaeShadowBody(GONE));
  put(`projections/wikis/daemon-${F1}/recovery/draft-one.tid`, tid("draft one", "half a thought"));
  put("projections/bags/garden/ha.ka.ba/garden/rose.tid", tid(ROSE, "a rose"));
  put(`projections/bags/kahua-${F1}/ha.ka.ba/kahua/memory/heron.tid`, tid(HERON, "remember the heron", `kahua-taint: []\nkahua-sources: [{"title":"${POND}","revision":"r1"}]\n`));
}

/** The old vessel, its records laid from its own disk (no adoption: it wears F1), its stage holding the heron. */
async function oldVessel(): Promise<FakeHouse> {
  const v = new FakeHouse([{ handleIndex: 0, petname: "hearth-one", relation: F1 }], "old-grant", F1);
  v.held.add("garden");
  v.stage.set(0, [{ title: HERON, cid: sha("old-heron"), text: "remember the heron", fields: {}, taint: [], sources: [{ title: POND, revision: "r1" }] }]);
  await seedMirrors({ apply: true, doors: v.mirrorDoors() });
  writeFaceLabels(v.facesNow(), join(root, "projections"));     // what the vessel writes at each stand (and `liveFaces` at each read)
  keepBases(v, F1);                                            // what the vessel's bases keeper writes off the face's working slots
  return v;
}

/** The vessel's bases keeper, as a test runs it: the face's working copies' bases into its sidecar. */
function keepBases(v: FakeHouse, relation: string): void {
  writeFaceBases(relation, Object.fromEntries([...v.layer(WORKING)].filter(([, r]) => r.base !== undefined && !r.deleted).map(([t, r]) => [t, r.base!])), join(root, "projections"));
}

/** reset -> found: the hearth cleared, persona zero founded fresh under the same pet-name with a new relation and grant. */
function refound(faces: Array<Partial<CarryVesselFace> & { handleIndex: number }> = [{ handleIndex: 0, petname: "hearth-one", relation: F2 }]): FakeHouse {
  rmSync(join(root, "hearth"), { recursive: true, force: true });
  return new FakeHouse(faces, "new-grant", F2);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-seed-mirrors-"));
  writeFileSync(join(root, ".lar-test-scratch"), "seed-mirrors suite\n");
  process.env["LAR_ROOT"] = root;
  out = join(mkdtempSync(join(tmpdir(), "lar-seed-mirrors-out-")), "bundle");
  oldDisk();
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); rmSync(dirname(out), { recursive: true, force: true }); });

describe("the seed lays every mirror back into its one layer", () => {
  test("M1 — export -> reset -> found -> seed -> import: every record in its layer with its bytes, the base kept, kahua on the confirmed count, ashes; nothing twice", async () => {
    const old = await oldVessel();
    const oldBase = old.layer(WORKING).get(POND)!.base;
    expect(oldBase).toBe(carrierOf(POND_CANON));
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: old.carryDoors() });
    expect(manifest.rows.find((r) => r.layer === "working" && r.title === POND)?.overrideBase).toBe(oldBase);

    const after = refound();
    const first = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(first.adoptions).toEqual([{ relation: F1, petname: "hearth-one", handleIndex: 0, toRelation: F2 }]);
    // KAHUA WAITS: previewed, never lifted on a bare apply, pending at the shore; the old folders stay and say why.
    expect(first.kahua.preview.map((p) => [p.title, p.state, p.handleIndex])).toEqual([[HERON, "new", 0]]);
    expect(after.lifts).toEqual([]);
    expect(readKahuaPending().map((p) => p.title)).toEqual([HERON]);
    expect(first.ashes).toEqual([]);
    expect(first.ashesLeft[0]?.why).toMatch(/kahua item\(s\) wait for a hand/);

    const confirmed = await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(after.lifts).toEqual([{ face: 0, title: HERON, text: "remember the heron", signer: "new-grant", parent: null }]);
    expect(readKahuaPending()).toEqual([]);
    expect(confirmed.ashes.map((a) => a.relation)).toEqual([F1]);
    expect(existsSync(P(`ashes/${F1}/wikis/daemon-${F1}/ha.ka.ba/notes/pond.tid`))).toBe(true);
    expect(existsSync(P(`wikis/daemon-${F1}`)) || existsSync(P(`bags/daemon-${F1}`)) || existsSync(P(`bags/kahua-${F1}`))).toBe(false);

    const imported = await carryImport(out, { apply: true, doors: after.carryDoors() });
    expect(Object.values(imported.tallies).every((t) => t.stoodOff.length === 0 && t.refused.length === 0)).toBe(true);
    expect(imported.tallies.kahua.landed).toBe(0);                 // the stage already holds the heron's body
    expect(after.lifts).toHaveLength(1);

    // EVERY RECORD IN THE SAME LAYER WITH THE SAME BYTES.
    const texts = (h: FakeHouse, bag: string) => Object.fromEntries([...h.layer(bag)].map(([t, r]) => [t, r.deleted ? "<kapae>" : r.text]));
    expect(texts(after, WORKING)).toEqual(texts(old, WORKING));
    expect(texts(after, daemonFaceCanonBag(F2))).toEqual(texts(old, daemonFaceCanonBag(F1)));
    expect(texts(after, GARDEN)).toEqual(texts(old, GARDEN));
    expect(after.live(daemonFaceCanonBag(F2), HERON)).toBeUndefined();          // a working-only title never promotes
    // The copy keeps its base and still shadows the canon under it.
    expect(after.layer(WORKING).get(POND)?.base).toBe(oldBase);
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
    expect(after.live(daemonFaceCanonBag(F2), POND)?.text).toBe(POND_CANON);
    expect(readFileSync(P(`wikis/daemon-${F2}/recovery/draft-one.tid`), "utf8")).toBe(tid("draft one", "half a thought"));

    // A SECOND SEED AND A SECOND IMPORT LAND NOTHING.
    const again = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(again.layers.reduce((n, t) => n + t.landed + t.kapae, 0)).toBe(0);
    expect(again.kahua.preview).toEqual([]);
    const reimport = await carryImport(out, { apply: true, doors: after.carryDoors() });
    expect(Object.values(reimport.tallies).every((t) => t.landed === 0 && t.planned === 0)).toBe(true);
    expect(after.lifts).toHaveLength(1);
  });

  test("M2 — with NO export, reset -> found -> seed recovers the daemon memory by pet-name from disk alone", async () => {
    await oldVessel();
    const after = refound();
    const preview = await seedMirrors({ apply: false, doors: after.mirrorDoors() });
    expect(preview.layers.reduce((n, t) => n + t.planned, 0)).toBeGreaterThan(0);
    expect(after.layers.size).toBe(0);
    expect(existsSync(P(`wikis/daemon-${F2}`))).toBe(false);

    const result = await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(result.adoptions.map((a) => a.petname)).toEqual(["hearth-one"]);
    expect(after.live(WORKING, HERON)?.text).toBe(tid(HERON, "remember the heron"));
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
    expect(after.layer(WORKING).get(GONE)?.deleted).toBe(true);
    expect(after.live(daemonFaceCanonBag(F2), DEEP)).toBeDefined();
    expect(after.live(GARDEN, ROSE)?.text).toBe(tid(ROSE, "a rose"));
    expect(after.mints).toEqual([GARDEN]);
    expect(after.lifts.map((l) => [l.title, l.signer])).toEqual([[HERON, "new-grant"]]);
    expect(result.ashes.map((a) => a.relation)).toEqual([F1]);
  });

  test("M3 — an ambiguous pet-name refuses and lands nothing; so do an unmatched pet-name and a folder no label names", async () => {
    await oldVessel();
    const twins = refound([{ handleIndex: 0, petname: "hearth-one", relation: F2 }, { handleIndex: 1, petname: "hearth-one", relation: F3 }]);
    await expect(seedMirrors({ apply: true, doors: twins.mirrorDoors() })).rejects.toThrow(/seed-face-duplicate-petname[\s\S]*hearth-one/);
    const nothing = (h: FakeHouse) => { expect(h.layers.size + h.lifts.length + h.laid.length + h.mints.length).toBe(0); expect(existsSync(P(`wikis/daemon-${F2}`))).toBe(false); };
    nothing(twins);
    expect(existsSync(P(`wikis/daemon-${F1}/ha.ka.ba/notes/pond.tid`))).toBe(true);

    const stranger = refound([{ handleIndex: 0, petname: "someone-else", relation: F2 }]);
    const e = await seedMirrors({ apply: true, doors: stranger.mirrorDoors() }).then(() => null, (x: Error) => x);
    expect(e).toBeInstanceOf(MirrorRefused);
    expect((e as MirrorRefused).code).toBe("seed-face-unmatched");
    nothing(stranger);

    rmSync(faceLabelPath(F1, join(root, "projections")));
    const unlabelled = refound();
    await expect(seedMirrors({ apply: true, doors: unlabelled.mirrorDoors() })).rejects.toThrow(/seed-face-unlabelled/);
    nothing(unlabelled);
  });

  test("M4 — kahua: the preview lists it; no confirm stands it pending; a wrong count refuses; --yes alone lifts nothing; a differing file supersedes on the count", async () => {
    // One face wearing F1, its stage empty: the stage file stands on disk alone.
    const v = new FakeHouse([{ handleIndex: 0, petname: "hearth-one", relation: F1 }], "grant", F1);
    v.held.add("garden");
    const preview = await seedMirrors({ apply: false, doors: v.mirrorDoors() });
    expect(preview.kahua.preview).toEqual([expect.objectContaining({ title: HERON, state: "new", handleIndex: 0, petname: "hearth-one", digest: sha("remember the heron"), parent: null })]);
    expect(readKahuaPending()).toEqual([]);                     // a preview writes nothing

    const bare = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(bare.kahua.pending.map((p) => p.title)).toEqual([HERON]);
    expect(readKahuaPending().map((p) => p.title)).toEqual([HERON]);
    expect(v.lifts).toEqual([]);

    await expect(seedMirrors({ apply: true, doors: v.mirrorDoors(), liftKahua: 2 })).rejects.toThrow(/seed-kahua-count/);
    expect(v.lifts).toEqual([]);

    // `--yes` names no count: the leg runs with apply and yes, and nothing lifts.
    const said: string[] = [];
    const [log, err] = [console.log, console.error];
    console.log = (...a: unknown[]) => { said.push(a.join(" ")); };
    console.error = (...a: unknown[]) => { said.push(a.join(" ")); };
    try { await runMirrorLeg({ command: "vessel", positional: ["seed"], options: {}, flags: { apply: true, yes: true } }, v.mirrorDoors()); }
    finally { console.log = log; console.error = err; }
    expect(v.lifts).toEqual([]);
    expect(said.join("\n")).toMatch(/--lift-kahua 1/);

    // A FILE THAT DIFFERS FROM THE STANDING HEAD reads `differs` and supersedes that head on the confirmed count.
    v.stage.set(0, [{ title: HERON, cid: sha("standing"), text: "an older heron", fields: {}, taint: [], sources: [] }]);
    const differs = await seedMirrors({ apply: false, doors: v.mirrorDoors() });
    expect(differs.kahua.preview.map((p) => [p.state, p.parent])).toEqual([["differs", sha("standing")]]);
    await seedMirrors({ apply: true, doors: v.mirrorDoors(), liftKahua: 1 });
    expect(v.lifts).toEqual([{ face: 0, title: HERON, text: "remember the heron", signer: "grant", parent: sha("standing") }]);
    expect(v.lifts.length).toBe(1);
    expect(readKahuaPending()).toEqual([]);
  });

  test("M5 — ashes never read back, never travel, never copy into a live mirror", async () => {
    await oldVessel();
    const after = refound();
    await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(existsSync(P(`ashes/${F1}`))).toBe(true);
    put(`projections/ashes/${F1}/wikis/daemon-${F1}/ha.ka.ba/notes/late.tid`, tid("lar:///ha.ka.ba/notes/late", "written into ashes"));
    after.laid = [];
    await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(after.laid.some((s) => s.includes(`${join("projections", "ashes")}`))).toBe(false);
    expect(after.live(WORKING, "lar:///ha.ka.ba/notes/late")).toBeUndefined();
    // The export walks the live mirrors alone: ashes never refuse it as unclaimed, and none of their bytes travel.
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: after.carryDoors() });
    expect(manifest.files.some((f) => f.path.includes("late") || f.path.includes("ashes"))).toBe(false);
    expect(manifest.omissions.some((o) => o.kind === "unclaimed-face-folders")).toBe(false);
    // The face worn now projects under its own folders, never under ashes: the late file lands in no live mirror.
    expect(existsSync(P(`wikis/daemon-${F2}/ha.ka.ba/notes/late.tid`))).toBe(false);
  });

  test("M6 — an import's bag row meets the seeded canon at the gate: divergence stands off and never overwrites", async () => {
    const old = await oldVessel();
    await carryExport(out, { acceptOmissions: false, doors: old.carryDoors() });
    const after = refound();
    after.held.add("garden");
    // The seed laid another canon text for the title (the checkout's), and the house mirror left the disk.
    after.layer(GARDEN).set(ROSE, { text: tid(ROSE, "the checkout's rose") });
    rmSync(P("bags/garden"), { recursive: true });
    const r = await carryImport(out, { apply: true, doors: after.carryDoors() });
    expect(r.tallies.bag.stoodOff.join("\n")).toContain(ROSE);
    expect(after.live(GARDEN, ROSE)?.text).toBe(tid(ROSE, "the checkout's rose"));
    // And the other way: a seed over the bundle's landed row stands off on a disk file that moved too.
    put("projections/bags/garden/ha.ka.ba/garden/rose.tid", tid(ROSE, "a third rose"));
    const seeded = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(seeded.layers.find((t) => t.toBag === GARDEN)?.stoodOff.join("\n")).toContain(ROSE);
    expect(after.live(GARDEN, ROSE)?.text).toBe(tid(ROSE, "the checkout's rose"));
  });

  test("M7 — the override base travels: an import that lands the copy restores the base the bundle carried", async () => {
    const old = await oldVessel();
    const oldBase = old.layer(WORKING).get(POND)!.base!;
    await carryExport(out, { acceptOmissions: false, doors: old.carryDoors() });
    // Move the old folders aside by hand (no seed adoption), so the import lands each copy itself.
    for (const rel of [`wikis/daemon-${F1}`, `bags/daemon-${F1}`, `bags/kahua-${F1}`]) rmSync(P(rel), { recursive: true });
    const after = refound();
    after.held.add("garden");
    await carryImport(out, { apply: true, doors: after.carryDoors() });
    // The working wave lands before the face canon does, so no canon stands to fork from: the carried base alone names it.
    expect(after.layer(WORKING).get(POND)?.base).toBe(oldBase);
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
  });

  test("M8 — a base forked before the reset survives a seed-only recovery, and canon still reads fresher", async () => {
    const old = await oldVessel();
    const forkBase = old.layer(WORKING).get(POND)!.base!;
    // Canon moved past the fork before the reset: the face canon's disk file says something newer.
    const NEWER = tid(POND, "the pond as canon says it now");
    put(`projections/bags/daemon-${F1}/ha.ka.ba/notes/pond.tid`, NEWER);
    const after = refound();
    await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(after.live(daemonFaceCanonBag(F2), POND)?.text).toBe(NEWER);
    // Without the sidecar the copy would fork off the NEWER canon and read current; it keeps the base it forked from.
    expect(after.layer(WORKING).get(POND)?.base).toBe(forkBase);
    expect(after.layer(WORKING).get(POND)?.base).not.toBe(carrierOf(NEWER));   // canon reads fresher than the copy above it
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
  });

  test("M9 — two faces: each face's working rows carry its own bases, never the face the daemon wears", async () => {
    const two = new FakeHouse([{ handleIndex: 0, petname: "one", relation: F1 }, { handleIndex: 1, petname: "two", relation: F3 }], "grant", F1);
    two.held.add("garden");
    put(`projections/wikis/daemon-${F3}/ha.ka.ba/notes/pond.tid`, tid(POND, "face two's pond"));
    const B1 = `sha256:${"1".repeat(64)}`, B3 = `sha256:${"3".repeat(64)}`;
    writeFaceBases(F1, { [POND]: B1 }, join(root, "projections"));
    writeFaceBases(F3, { [POND]: B3 }, join(root, "projections"));
    const { manifest } = await carryExport(out, { acceptOmissions: false, doors: { ...two.carryDoors(), overrideBases: async () => ({ [POND]: `sha256:${"9".repeat(64)}` }) } });
    const rowOf = (pet: string) => manifest.rows.find((r) => r.layer === "working" && r.face === pet && r.title === POND);
    expect(rowOf("one")?.overrideBase).toBe(B1);
    expect(rowOf("two")?.overrideBase).toBe(B3);
  });

  test("M10 — a labelled former face whose folders hold a file the bundle never carried: the import leaves it, the seed adopts it, then ashes", async () => {
    const old = await oldVessel();
    await carryExport(out, { acceptOmissions: false, doors: old.carryDoors() });
    // The former face wrote one more memory after the export: the bundle never carried it.
    put(`projections/wikis/daemon-${F1}/ha.ka.ba/notes/after-export.tid`, tid("lar:///ha.ka.ba/notes/after-export", "written after the export"));
    const after = refound();
    const imported = await carryImport(out, { apply: true, doors: after.carryDoors() });
    expect(imported.ashes).toEqual([]);
    expect(imported.ashesLeft.find((a) => a.relation === F1)?.why).toMatch(/never carried/);
    const seeded = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(seeded.adoptions.map((a) => a.relation)).toEqual([F1]);
    expect(after.live(WORKING, "lar:///ha.ka.ba/notes/after-export")?.text).toBe(tid("lar:///ha.ka.ba/notes/after-export", "written after the export"));
    expect(seeded.ashes.map((a) => a.relation)).toEqual([F1]);
  });

  test("M12 — a face folder no label names: the seed names it and adopts nothing; the import never adopts it, labels it or moves it", async () => {
    const old = await oldVessel();
    await carryExport(out, { acceptOmissions: false, doors: old.carryDoors() });
    rmSync(faceLabelPath(F1, join(root, "projections")));
    const after = refound();
    const refused = await seedMirrors({ apply: true, doors: after.mirrorDoors() }).then(() => null, (e: Error) => e);
    expect((refused as MirrorRefused).code).toBe("seed-face-unlabelled");
    expect(refused?.message).toMatch(/this folder carries no face label[\s\S]*move it aside or remove it/);
    expect(refused?.message).not.toMatch(/import/);
    expect(after.layers.size + after.laid.length).toBe(0);
    const imported = await carryImport(out, { apply: true, doors: after.carryDoors() });
    expect(imported.ashes).toEqual([]);
    expect(readFaceLabel(F1, join(root, "projections"))).toBeNull();
    expect(existsSync(P(`wikis/daemon-${F1}/ha.ka.ba/notes/pond.tid`))).toBe(true);
    expect(existsSync(P(`ashes/${F1}`))).toBe(false);
  });

  test("M11 — a fresh face that reads no relation and no stage never halts the seed", async () => {
    const v = new FakeHouse([{ handleIndex: 0, petname: "hearth-one", relation: F1 }, { handleIndex: 1, petname: "fresh", relation: null, kahua: [] }], "grant", F1);
    v.held.add("garden");
    const r = await seedMirrors({ apply: true, doors: v.mirrorDoors(), liftKahua: 1 });
    expect(r.adoptions).toEqual([]);
    expect(v.live(WORKING, POND)?.text).toBe(POND_WORKING);
  });
});
