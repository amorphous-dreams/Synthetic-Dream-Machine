/**
 * seed-mirrors — a seed lays EVERY disk mirror back into the ONE layer it mirrors, through INGEST's three-way gate; a face's
 * root (`faces/<pet name>/`) carries across a re-founding where it stands, so the re-minted face lays it in place; and it
 * lifts kahua by the operator's hand alone, with eyes.
 *
 * The vessel below holds layers of records, a synced base per mirror file (the three-way gate: disk equal to base lands
 * nothing, disk moved lands, both moved stands off), the composite's override-base fork, and each face's kahua stage.
 *
 *   M1  the full round trip: a working copy over a canon title, a working-only title, a kāpae shadow, a face-canon memory,
 *       a house-bag row and a kahua item; export -> reset -> found -> lay -> import puts every record in the same layer
 *       with the same bytes, the copy keeps its base and still shadows, kahua stands pending until confirmed and then
 *       lifts signed by the new face, the face root stands where it stood; a second lay and a second import land nothing
 *   M2  the same with NO export: reset -> found -> lay recovers the daemon memory by pet-name, from disk alone
 *   M3  an ambiguous pet-name refuses that root and lands nothing of it, and the lay goes on; so does an unmatched one
 *   M4  a kahua mirror file: the preview lists it; no confirm -> pending; a wrong count refuses; --yes alone lifts nothing;
 *       a file that differs from the standing head reads `differs` and supersedes it on the confirmed count
 *   M5  ashes never read back into a layer and never travel in a bundle
 *   M6  an import's bag row and the seeded canon for one title meet at the gate: divergence stands off, never overwrites
 *   M7  the override base travels: the export's working row carries it, and an import that lands the copy restores it
 *   M8b the live lay restores a carrier's family whole: a lay-only recovery's wave hands each fragment's base from the
 *       face's sidecar beside the root's
 *   M7b a carrier's family travels whole: the working row carries each fragment record's base beside the root's, and the
 *       import hands them to the wave
 *   M8  a base forked before the reset survives a SEED-ONLY recovery (the face's bases sidecar), and canon still reads
 *       fresher than the copy
 *   M9  two faces: each face's working rows carry that face's own bases, never the face the daemon wears
 *   M10 a face root holding a file the bundle never carried: the import lands the bundle, the lay lays the rest in place
 *   M11 a fresh face that reads no relation and no stage (no refusal) never halts the lay
 *   M13 THE LIT SET: three faces open, h1 worn: one lay lands each face's working memory in its own document alone (the worn
 *       face's through the ordinary wave, the others through waves naming them); a second lay lands nothing
 *   M13b h0 and h1 open, h2 shut: one lay lands h0 and h1 and names h2 ("stays shut"); unlocking h2 and laying lands h2 alone
 *   M14 the import's lit set: a bundle of three faces onto three open faces lands each face's rows in its own document
 *   M15 one refused root never halts the rest: an unmatched root records its line while the face's own lands
 *   M16 a face whose pet-name would not read blocks only the roots no other face claims; a SHUT face waits for its own
 *   M17 a kahua refusal names its face
 *   M23 the walked loss: reset -> found -> lay keeps every plain-title working tiddler under its own title
 *   M24 a file no rule reads names itself and its reason in the lay's lines
 *   M25 HOUSE_IGNORED reaches the bundle: an export carries no `.git/` (a face root's own pool), a lay reads none
 */
import { plantKeptSeat } from "./support/kept-seat.js";
import { checkHouseTeardown } from "./support/check-house-teardown.js";
import { closeScratch, openScratch, type Scratch } from "../../lararium-node/tests/support/scratch-fixture.js";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { createHash } from "node:crypto";
import { kapaeShadowBody, readKapaeShadow, SyncedTree } from "@lararium/node";
import { daemonFaceCanonBag, carrierHash, wikiSlotUri, type ShareEntry } from "@lararium/mesh";
import { seedMirrors, liveLay, mirrorFiles, mirrorLines, mirrorsLeftWork, readKahuaPending, readKahuaFile, kahuaPendingPath, siteWaveFile, type MirrorDoors, type MirrorLaid, type MirrorWave } from "../src/seed-mirrors.js";
import { houseExport, houseImport, foldWaveRefusal, type BundleDoors, type BundleVesselFace } from "../src/commands/house-bundle.js";
import { writeFaceLabels, writeFaceBases, readFaceLabel, labelFaceAtNaming } from "../src/face-labels.js";
import { moveFaceToAshes } from "../src/ashes.js";
import { fileToUriForSource } from "../src/ingest-core.js";
import { runMirrorLeg } from "../src/commands/lay.js";
import type { BundleKahuaHead } from "../src/bundle-manifest.js";
import { openBundle, readBundleSeat, verifyBundle } from "../src/bundle-manifest.js";
import { openKeepSeat } from "../src/keep-seat.js";
import { TEST_ROUTE_PASSPHRASE } from "../src/offline-custody.js";

// A restore opens the keep seat at the remote cost (`support/kept-seat.ts`): a case takes seconds, not milliseconds.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

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
  faces: BundleVesselFace[];
  layers = new Map<string, Map<string, Rec>>();
  synced = new Map<string, string>();
  stage = new Map<number, BundleKahuaHead[]>();
  lifts: Array<{ face: number; title: string; text: string; signer: string; parent: string | null }> = [];
  laid: string[] = [];
  held = new Set<string>();
  mints: string[] = [];
  /** The slugs minted through the WIKI door (`init-wiki`: canon, draft and recipe row), a subset of `mints`. */
  wikiMints: string[] = [];
  /** The relation the composition wears: the daemon working layer holds THAT face's document alone (`wear` switches it). */
  constructor(faces: Array<Partial<BundleVesselFace> & { handleIndex: number }>, readonly grant: string, public worn: string) {
    this.faces = faces.map((f) => ({ petname: null, relation: null, handle: null, seat: false, chair: null, kahua: [], ...f }));
    for (const f of this.faces) this.stage.set(f.handleIndex, [...(f.kahua ?? [])]);
  }
  layer(bag: string): Map<string, Rec> {
    // Each face its own daemon working document and its own personal layer of every wiki: those read the WORN face's. A wiki's
    // workbench stands as ONE document on the vessel, whichever face wears.
    const key = bag === WORKING || /\/wikis\/[^/]+\/personal$/.test(bag) ? `${bag}@${this.worn}` : bag;
    return this.layers.get(key) ?? this.layers.set(key, new Map()).get(key)!;
  }
  /** One face's own personal layer of a wiki, whichever face stands worn. */
  personalOf(relation: string, slug: string): Map<string, Rec> { return this.layers.get(`lar:///ha.ka.ba/wikis/${slug}/personal@${relation}`) ?? new Map(); }
  /** A wiki's ONE workbench on this vessel. */
  bench(slug: string): Map<string, Rec> { return this.layers.get(`lar:///ha.ka.ba/wikis/${slug}/working`) ?? new Map(); }
  /** The writer seats each wiki's workbench holds, by relation; a slug with no entry stands unbound (no face stood it yet). */
  seats = new Map<string, Set<string>>();
  /** The share rows the vessel-private file holds, and how many times the lay landed them. */
  shareRows: ShareEntry[] = [];
  shareLandings = 0;
  /** The `wikis` dir beside the canon source, and the slugs that stand sourced there (none: no canon source stands). */
  canonWikis: string | null = null;
  sourcedSlugs = new Set<string>();
  /** One face's own working document, whichever face stands worn. */
  workingOf(relation: string): Map<string, Rec> { return this.layers.get(`${WORKING}@${relation}`) ?? new Map(); }
  /** `lares vault unlock --face N`: the composition wears another face. */
  wear(relation: string): void { this.worn = relation; }
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
  facesNow(): BundleVesselFace[] { return this.faces.map((f) => ({ ...f, kahua: [...(this.stage.get(f.handleIndex) ?? [])], mounted: f.relation !== null && f.relation === this.worn })); }
  /** Open faces this island resolves no layer for (the live node before the sibling resolver lands). */
  unresolved = new Set<number>();
  /** Each wave's face, as the lay named it (undefined: the worn face's own wave). */
  waveFaces: Array<{ source: string; face: number | undefined }> = [];
  /**
   * THE ISLAND'S FACE-NAMED WAVE: a wave naming an open face lands in THAT face's own document (never the worn one's); a wave
   * naming a shut face resolves no document and refuses `face-unresolved`, landing nothing.
   */
  async lay(wave: MirrorWave, apply: boolean): Promise<MirrorLaid> {
    this.waveFaces.push({ source: wave.source, face: wave.face });
    if (wave.face === undefined) return this.layAsWorn(wave, apply);
    const named = this.faces.find((f) => f.handleIndex === wave.face);
    if (named === undefined || named.relation === null || this.unresolved.has(wave.face)) {
      return { planned: [], kapae: [], landed: [], kapaeRaised: [], conflicts: [], refused: [{ uri: wave.source, why: "face-unresolved" }], unanswered: [], skipped: [] };
    }
    const prior = this.worn;
    this.worn = named.relation;
    try { return await this.layAsWorn(wave, apply); } finally { this.worn = prior; }
  }
  async layAsWorn(wave: MirrorWave, apply: boolean): Promise<MirrorLaid> {
    this.laid.push(wave.source);
    // The first face whose applied wave reaches a wiki's workbench stands it (its private cabal of one), as a mount does.
    const bench = /\/wikis\/([^/]+)\/working$/.exec(wave.toBag);
    if (apply && bench && wave.toBag !== WORKING && !this.seats.has(bench[1]!)) this.seats.set(bench[1]!, new Set([this.worn]));
    const planned: string[] = [], kapae: string[] = [];
    const skipped: Array<{ file: string; why: string }> = [];
    const cands: Array<{ uri: string; key: string; text: string; base: string | undefined }> = [];
    for (const rel of mirrorFiles(wave.source, wave.skipTop).filter((r) => !r.endsWith(".meta"))) {
      const abs = join(wave.source, ...rel.split("/"));
      if (rel.endsWith(".kapae")) { const k = readKapaeShadow(readFileSync(abs, "utf8")); if ("title" in k) kapae.push(k.title); continue; }
      // The fake sites a file as the live lay does (the projector's precedence run backward), and names each skip.
      const sited = siteWaveFile(wave, abs, new SyncedTree(null));
      if ("why" in sited) { skipped.push({ file: abs, why: sited.why }); continue; }
      const uri = sited.title;
      const text = readFileSync(abs, "utf8"), key = `${wave.toBag}\n${abs}`, base = this.synced.get(key);
      if (base === sha(text)) continue;
      cands.push({ uri, key, text, base });
      planned.push(uri);
    }
    const out = { planned, kapae, landed: [] as string[], kapaeRaised: [] as string[], conflicts: [] as Array<{ uri: string; why: string }>, refused: [], unanswered: [], skipped };
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
  kahuaLift: BundleDoors["kahuaLift"] = async (face, lift) => {
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
      mintWiki: async (slug) => { this.wikiMints.push(slug); this.mints.push(`lar:///ha.ka.ba/bags/${slug}`); this.held.add(slug); },
      kahuaLift: this.kahuaLift, lay: (w, a) => this.lay(w, a), sourced: (slug) => this.sourcedSlugs.has(slug), canonWikis: () => this.canonWikis,
      // THE SEAT: a bound slug answers the worn face `working` where it holds a writer's seat, else `personal`; an unbound one
      // answers `personal` and `bound: false` (the first stand founds it), as the island's `workbench-seat` does.
      benchSeat: async (slug) => { const seated = this.seats.get(slug); return { bound: seated !== undefined, writeSlot: seated?.has(this.worn) ? "working" : "personal" }; },
      shareRows: () => this.shareRows,
      // The vessel's own account (`share-apply`): a wiki's first landing on this founding seats its member, and a replay seats none.
      landShares: async () => {
        this.shareLandings++;
        return { granted: 0, moved: 0, carried: 0, pending: 0, workbenches: this.shareRows.filter((r) => r.kind === "wiki").map((r) => {
          const fresh = !this.sharesSeated.has(r.slug) && this.held.has(r.slug);
          if (fresh) this.sharesSeated.add(r.slug);
          return { slug: r.slug, members: 1, founded: false, seated: fresh ? 1 : 0, removed: [] };
        }) };
      },
    };
  }
  /** The shared wikis whose seats a landing already set on this founding. */
  sharesSeated = new Set<string>();
  bundleDoors(): BundleDoors {
    return {
      census: async () => ({ clean: true, items: [], unanswered: [] }),
      faces: async () => this.facesNow(), tempConsented: () => ["daemon"],
      rename: async () => {}, declareHandle: async () => {}, standSeat: async () => {},
      heldSlugs: async () => new Set(this.held), mintBag: async (bag) => { this.mints.push(bag); this.held.add(bag.slice(bag.lastIndexOf("/") + 1)); },
      mintWiki: async (slug) => { this.wikiMints.push(slug); this.mints.push(`lar:///ha.ka.ba/bags/${slug}`); this.held.add(slug); },
      // A FACE-NAMED WAVE lands in THAT face's own document, as the island's face-named INGEST does (never the worn one's).
      ingest: async ({ toBag, candidates, kapae, face }) => {
        const named = face === undefined ? undefined : this.faces.find((f) => f.handleIndex === face);
        if (face !== undefined && (named === undefined || named.relation === null)) {
          return { landed: [], conflicts: [], refused: candidates.map((c) => ({ uri: c.uri, why: "face-unresolved" })), unanswered: [], kapaeRaised: [], kapaeRefused: [] };
        }
        const prior = this.worn;
        if (named?.relation) this.worn = named.relation;
        const bench = /\/wikis\/([^/]+)\/working$/.exec(toBag);
        if (bench && toBag !== WORKING && !this.seats.has(bench[1]!)) this.seats.set(bench[1]!, new Set([this.worn]));
        try {
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
        } finally { this.worn = prior; }
      },
      canonWikis: () => this.canonWikis, sourced: (slug) => this.sourcedSlugs.has(slug),
      benchSeat: async (slug) => { const seated = this.seats.get(slug); return { bound: seated !== undefined, writeSlot: seated?.has(this.worn) ? "working" : "personal" }; },
      shareRows: { read: () => this.shareRows, write: (rows) => { this.shareRows = [...rows]; } },
      landShares: async () => { this.shareLandings++; return { granted: 0, carried: 0, pending: 0, workbenches: [] }; },
      overrideBases: async (bag) => Object.fromEntries([...this.layer(bag)].filter(([, r]) => r.base !== undefined && !r.deleted).map(([t, r]) => [t, r.base!])),
      kahuaLift: this.kahuaLift,
    };
  }
}

let house: Scratch;
let root: string, out: string;
const put = (rel: string, text: string): void => { const p = join(root, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const tid = (title: string, text: string, extra = ""): string => `title: ${title}\n${extra}type: text/vnd.tiddlywiki\n\n${text}\n`;
const P = (rel: string): string => join(root, "projections", ...rel.split("/"));

const POND_CANON = tid(POND, "the pond as canon said it");
const POND_WORKING = tid(POND, "the pond as a hand wrote it");

/** The face root a pet name makes, under the projections root. */
const FR = (pet: string, rel = ""): string => `projections/faces/${pet}${rel === "" ? "" : `/${rel}`}`;

/** The old founding's disk: face "hearth-one"'s root (F1 wore it), a house bag, a kahua item. */
function oldDisk(): void {
  put(FR("hearth-one", "canon/ha.ka.ba/notes/pond.tid"), POND_CANON);
  put(FR("hearth-one", "canon/ha.ka.ba/memory/deep.tid"), tid(DEEP, "a memory promoted to the face's canon"));
  put(FR("hearth-one", "wiki/ha.ka.ba/notes/pond.tid"), POND_WORKING);
  put(FR("hearth-one", "wiki/ha.ka.ba/kahua/memory/heron.tid"), tid(HERON, "remember the heron"));
  put(FR("hearth-one", "wiki/ha.ka.ba/notes/gone.kapae"), kapaeShadowBody(GONE));
  put(FR("hearth-one", "recovery/garden/draft-one.tid"), tid("draft one", "half a thought"));
  put("projections/bags/garden/ha.ka.ba/garden/rose.tid", tid(ROSE, "a rose"));
  // A stage carrier's body rides as it stands: the projector adds no newline after it, and the lay's lift reads it byte for byte.
  put(FR("hearth-one", "stage/ha.ka.ba/kahua/memory/heron.tid"), tid(HERON, "remember the heron", `kahua-taint: []\nkahua-sources: [{"title":"${POND}","revision":"r1"}]\n`).replace(/\n$/, ""));
}
/** Clear the old founding's face root (and, with `garden`, its house bag), as a hand does. */
const clearFace = (garden = false): void => { rmSync(P("faces/hearth-one"), { recursive: true, force: true }); if (garden) rmSync(P("bags/garden"), { recursive: true, force: true }); };

/** The old vessel, its records laid from its own disk (it wears F1 under "hearth-one"), its stage holding the heron. */
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
function refound(faces: Array<Partial<BundleVesselFace> & { handleIndex: number }> = [{ handleIndex: 0, petname: "hearth-one", relation: F2 }]): FakeHouse {
  rmSync(join(root, "hearth"), { recursive: true, force: true });
  return new FakeHouse(faces, "new-grant", F2);
}

beforeEach(async () => {
  house = openScratch({ gitConfig: "private" });
  root = house.root;
  writeFileSync(join(root, ".lar-test-scratch"), "seed-mirrors suite\n");
  await plantKeptSeat(root);
  out = join(house.home, "export", "bundle");
  mkdirSync(dirname(out));
  oldDisk();
});
afterEach(() => { closeScratch(house); });

checkHouseTeardown();

describe("the lay lays every mirror back into its one layer", () => {
  test("M1 — export -> reset -> found -> lay -> import: every record in its layer with its bytes, the base kept, kahua on the confirmed count, the root kept; nothing twice", async () => {
    const old = await oldVessel();
    const oldBase = old.layer(WORKING).get(POND)!.base;
    expect(oldBase).toBe(carrierOf(POND_CANON));
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    expect(manifest.rows.find((r) => r.layer === "working" && r.title === POND)?.overrideBase).toBe(oldBase);

    const after = refound();
    const first = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(first.refusals).toEqual([]);
    // KAHUA WAITS: previewed, never lifted on a bare apply, pending at the shore.
    expect(first.kahua.preview.map((p) => [p.title, p.state, p.handleIndex])).toEqual([[HERON, "new", 0]]);
    expect(after.lifts).toEqual([]);
    expect(readKahuaPending().map((p) => p.title)).toEqual([HERON]);

    await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(after.lifts).toEqual([{ face: 0, title: HERON, text: "remember the heron", signer: "new-grant", parent: null }]);
    expect(readKahuaPending()).toEqual([]);
    // THE ROOT STANDS WHERE IT STOOD: nothing adopted, copied or moved to ashes.
    expect(existsSync(P("faces/hearth-one/wiki/ha.ka.ba/notes/pond.tid"))).toBe(true);
    expect(existsSync(P("ashes"))).toBe(false);

    const imported = await houseImport(out, { apply: true, doors: after.bundleDoors() });
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
    expect(readFileSync(P("faces/hearth-one/recovery/garden/draft-one.tid"), "utf8")).toBe(tid("draft one", "half a thought"));

    // A SECOND SEED AND A SECOND IMPORT LAND NOTHING.
    const again = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(again.layers.reduce((n, t) => n + t.landed + t.kapae, 0)).toBe(0);
    expect(again.kahua.preview).toEqual([]);
    const reimport = await houseImport(out, { apply: true, doors: after.bundleDoors() });
    expect(Object.values(reimport.tallies).every((t) => t.landed === 0 && t.planned === 0)).toBe(true);
    expect(after.lifts).toHaveLength(1);
  });

  test("M2 — with NO export, reset -> found -> lay recovers the daemon memory by pet-name from disk alone", async () => {
    await oldVessel();
    const after = refound();
    const preview = await seedMirrors({ apply: false, doors: after.mirrorDoors() });
    expect(preview.layers.reduce((n, t) => n + t.planned, 0)).toBeGreaterThan(0);
    expect(after.layers.size).toBe(0);

    const result = await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(result.refusals).toEqual([]);
    expect(after.live(WORKING, HERON)?.text).toBe(tid(HERON, "remember the heron"));
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
    expect(after.layer(WORKING).get(GONE)?.deleted).toBe(true);
    expect(after.live(daemonFaceCanonBag(F2), DEEP)).toBeDefined();
    expect(after.live(GARDEN, ROSE)?.text).toBe(tid(ROSE, "a rose"));
    expect(after.mints).toEqual([GARDEN]);
    expect(after.lifts.map((l) => [l.title, l.signer])).toEqual([[HERON, "new-grant"]]);
    expect(existsSync(P("ashes"))).toBe(false);
  });

  test("M3 — an ambiguous pet-name and an unmatched one each refuse THAT root by name and land nothing of it", async () => {
    await oldVessel();
    const nothingOfF1 = (h: FakeHouse) => {
      expect(h.live(WORKING, POND)).toBeUndefined();
      expect(h.lifts).toEqual([]);
      expect(h.laid.some((s) => s.startsWith(P("faces/hearth-one")))).toBe(false);
      expect(existsSync(P("faces/hearth-one/wiki/ha.ka.ba/notes/pond.tid"))).toBe(true);
    };
    const twins = refound([{ handleIndex: 0, petname: "hearth-one", relation: F2 }, { handleIndex: 1, petname: "hearth-one", relation: F3 }]);
    const t = await seedMirrors({ apply: true, doors: twins.mirrorDoors() });
    expect(t.refusals.map((x) => [x.face, x.code])).toEqual([["hearth-one", "seed-face-duplicate-petname"]]);
    expect(t.refusals[0]!.message).toMatch(/hearth-one/);
    expect(mirrorsLeftWork(t)).toBe(true);
    nothingOfF1(twins);
    // The rest of the lay went on: the house bag still laid.
    expect(twins.live(GARDEN, ROSE)?.text).toBe(tid(ROSE, "a rose"));

    const stranger = refound([{ handleIndex: 0, petname: "someone-else", relation: F2 }]);
    const s2 = await seedMirrors({ apply: true, doors: stranger.mirrorDoors() });
    expect(s2.refusals.map((x) => x.code)).toEqual(["seed-face-unmatched"]);
    nothingOfF1(stranger);
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
    // THE PENDING FILE NAMES WHAT IT HOLDS, never a number: bytes under a numbered tag read as nothing pending.
    const pendingBytes = readFileSync(kahuaPendingPath(), "utf8");
    expect(JSON.parse(pendingBytes).schema).toBe("lar-kahua-pending");
    writeFileSync(kahuaPendingPath(), JSON.stringify({ ...JSON.parse(pendingBytes), schema: "lar-kahua-pending/1" }));
    expect(readKahuaPending()).toEqual([]);
    writeFileSync(kahuaPendingPath(), pendingBytes);
    expect(v.lifts).toEqual([]);

    await expect(seedMirrors({ apply: true, doors: v.mirrorDoors(), liftKahua: 2 })).rejects.toThrow(/seed-kahua-count/);
    expect(v.lifts).toEqual([]);

    // `--yes` names no count: the leg runs with apply and yes, and nothing lifts.
    const said: string[] = [];
    const [log, err] = [console.log, console.error];
    console.log = (...a: unknown[]) => { said.push(a.join(" ")); };
    console.error = (...a: unknown[]) => { said.push(a.join(" ")); };
    try { await runMirrorLeg({ command: "vessel", positional: ["lay"], options: {}, flags: { apply: true, yes: true } }, v.mirrorDoors()); }
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

  test("M5 — ashes never read back and never travel", async () => {
    await oldVessel();
    const after = refound();
    await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    put("projections/ashes/burned-one/wiki/ha.ka.ba/notes/late.tid", tid("lar:///ha.ka.ba/notes/late", "written into ashes"));
    after.laid = [];
    await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(after.laid.some((s) => s.includes(`${join("projections", "ashes")}`))).toBe(false);
    expect(after.live(WORKING, "lar:///ha.ka.ba/notes/late")).toBeUndefined();
    // The export walks the live mirrors alone: ashes never refuse it as unclaimed, and none of their bytes travel.
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: after.bundleDoors() });
    expect(manifest.files.some((f) => f.path.includes("late") || f.path.includes("ashes"))).toBe(false);
    expect(manifest.omissions.some((o) => o.kind === "unclaimed-face-folders")).toBe(false);
    // The face worn now projects under its own root, never under ashes: the late file lands in no live mirror.
    expect(existsSync(P("faces/hearth-one/wiki/ha.ka.ba/notes/late.tid"))).toBe(false);
  });

  test("M6 — an import's bag row meets the seeded canon at the gate: divergence stands off and never overwrites", async () => {
    const old = await oldVessel();
    await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    const after = refound();
    after.held.add("garden");
    // The lay laid another canon text for the title (the checkout's), and the house mirror left the disk.
    after.layer(GARDEN).set(ROSE, { text: tid(ROSE, "the checkout's rose") });
    rmSync(P("bags/garden"), { recursive: true });
    const r = await houseImport(out, { apply: true, doors: after.bundleDoors() });
    expect(r.tallies.bag.stoodOff.join("\n")).toContain(ROSE);
    expect(after.live(GARDEN, ROSE)?.text).toBe(tid(ROSE, "the checkout's rose"));
    // And the other way: a lay over the bundle's landed row stands off on a disk file that moved too.
    put("projections/bags/garden/ha.ka.ba/garden/rose.tid", tid(ROSE, "a third rose"));
    const seeded = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(seeded.layers.find((t) => t.toBag === GARDEN)?.stoodOff.join("\n")).toContain(ROSE);
    expect(after.live(GARDEN, ROSE)?.text).toBe(tid(ROSE, "the checkout's rose"));
  });

  test("M7 — the override base travels: an import that lands the copy restores the base the bundle carried", async () => {
    const old = await oldVessel();
    const oldBase = old.layer(WORKING).get(POND)!.base!;
    await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    // Move the old root aside by hand (no lay), so the import lands each copy itself.
    clearFace();
    const after = refound();
    after.held.add("garden");
    await houseImport(out, { apply: true, doors: after.bundleDoors() });
    // The working wave lands before the face canon does, so no canon stands to fork from: the carried base alone names it.
    expect(after.layer(WORKING).get(POND)?.base).toBe(oldBase);
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
  });

  test("M8 — a base forked before the reset survives a lay-only recovery, and canon still reads fresher", async () => {
    const old = await oldVessel();
    const forkBase = old.layer(WORKING).get(POND)!.base!;
    // Canon moved past the fork before the reset: the face canon's disk file says something newer.
    const NEWER = tid(POND, "the pond as canon says it now");
    put(FR("hearth-one", "canon/ha.ka.ba/notes/pond.tid"), NEWER);
    const after = refound();
    await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(after.live(daemonFaceCanonBag(F2), POND)?.text).toBe(NEWER);
    // Without the sidecar the copy would fork off the NEWER canon and read current; it keeps the base it forked from.
    expect(after.layer(WORKING).get(POND)?.base).toBe(forkBase);
    expect(after.layer(WORKING).get(POND)?.base).not.toBe(carrierOf(NEWER));   // canon reads fresher than the copy above it
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
  });

  test("M8b — the live lay restores a carrier's family whole: the wave carries each fragment's base beside the root's", async () => {
    const B0 = `sha256:${"a".repeat(64)}`, BP = `sha256:${"b".repeat(64)}`, BX = `sha256:${"c".repeat(64)}`;
    const asked: Array<{ uri: string; overrideBase?: string; familyBases?: Readonly<Record<string, string>> }> = [];
    const submit = async (o: { candidates: readonly { uri: string }[] }) => { asked.push(...o.candidates); return { status: "error" as const, requestId: "probe", errorMessage: "probe: the vessel stands nowhere" }; };
    const wave: MirrorWave = { source: P("faces/hearth-one/wiki"), uriDir: P("faces/hearth-one"), toBag: WORKING, skipTop: ["temp"], bases: { [POND]: B0, [`${POND}#/part`]: BP, [`${HERON}-twin#/part`]: BX } };
    await liveLay(wave, true, { did: async () => "0xprobe", submit });
    const pond = asked.find((c) => c.uri === POND);
    expect(pond?.overrideBase).toBe(B0);
    expect(pond?.familyBases).toEqual({ [`${POND}#/part`]: BP });
    expect(asked.find((c) => c.uri === HERON)?.familyBases).toBeUndefined();
  });

  test("M9 — two faces: each face's working rows carry its own bases, never the face the daemon wears", async () => {
    const two = new FakeHouse([{ handleIndex: 0, petname: "hearth-one", relation: F1 }, { handleIndex: 1, petname: "two", relation: F3 }], "grant", F1);
    two.held.add("garden");
    put(FR("two", "wiki/ha.ka.ba/notes/pond.tid"), tid(POND, "face two's pond"));
    const B1 = `sha256:${"1".repeat(64)}`, B3 = `sha256:${"3".repeat(64)}`;
    writeFaceBases(F1, { [POND]: B1 }, join(root, "projections"));
    writeFaceBases(F3, { [POND]: B3 }, join(root, "projections"));
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: { ...two.bundleDoors(), overrideBases: async () => ({ [POND]: `sha256:${"9".repeat(64)}` }) } });
    const rowOf = (pet: string) => manifest.rows.find((r) => r.layer === "working" && r.face === pet && r.title === POND);
    expect(rowOf("hearth-one")?.overrideBase).toBe(B1);
    expect(rowOf("two")?.overrideBase).toBe(B3);
  });

  test("M7b — a carrier's family travels whole: the working row carries each fragment's base, and the import hands them to the wave", async () => {
    const old = await oldVessel();
    const B0 = `sha256:${"a".repeat(64)}`, BP = `sha256:${"b".repeat(64)}`, BX = `sha256:${"c".repeat(64)}`;
    // The face's bases sidecar names the root, one fragment of its family, and another carrier's fragment.
    writeFaceBases(F1, { [POND]: B0, [`${POND}#/part`]: BP, [`${HERON}#/part`]: BX }, join(root, "projections"));
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    const row = manifest.rows.find((r) => r.layer === "working" && r.title === POND);
    expect(row?.overrideBase).toBe(B0);
    expect(row?.familyBases).toEqual({ [`${POND}#/part`]: BP });
    clearFace();
    const after = refound();
    after.held.add("garden");
    const doors = after.bundleDoors();
    const asked: Array<{ uri: string; overrideBase?: string; familyBases?: Readonly<Record<string, string>> }> = [];
    await houseImport(out, { apply: true, doors: { ...doors, ingest: async (wave) => { asked.push(...wave.candidates); return doors.ingest(wave); } } });
    const pond = asked.find((c) => c.uri === POND);
    expect(pond?.overrideBase).toBe(B0);
    expect(pond?.familyBases).toEqual({ [`${POND}#/part`]: BP });
  });

  test("M10 — a face root holding a file the bundle never carried: the import lands the bundle, and the lay lays the rest in place", async () => {
    const old = await oldVessel();
    await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    // The face wrote one more memory after the export: the bundle never carried it.
    put(FR("hearth-one", "wiki/ha.ka.ba/notes/after-export.tid"), tid("lar:///ha.ka.ba/notes/after-export", "written after the export"));
    const after = refound();
    after.held.add("garden");
    const imported = await houseImport(out, { apply: true, doors: after.bundleDoors() });
    expect(Object.values(imported.tallies).every((t) => t.stoodOff.length === 0 && t.refused.length === 0)).toBe(true);
    await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(after.live(WORKING, "lar:///ha.ka.ba/notes/after-export")?.text).toBe(tid("lar:///ha.ka.ba/notes/after-export", "written after the export"));
    expect(existsSync(P("ashes"))).toBe(false);
  });

  test("M13 — the lit set: three faces open, h1 worn; one lay lands every face's memory, each in its own document alone", async () => {
    const [G0, G1, G2] = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"];
    const [N0, N1, N2] = ["lar:///ha.ka.ba/notes/zero-only", "lar:///ha.ka.ba/notes/one-only", "lar:///ha.ka.ba/notes/two-only"];
    // The FORMER founding's three faces left their roots, each named by its pet-name.
    clearFace();
    const pets = ["joshua-fontany", "joshua-fontany-engineer", "joshua-fontany-referee"];
    [N0, N1, N2].forEach((n, i) => put(FR(pets[i]!, `wiki/ha.ka.ba/notes/${n.slice(n.lastIndexOf("/") + 1)}.tid`), tid(n, `face h${i}'s own memory`)));
    writeFaceLabels([G0, G1, G2].map((relation, handleIndex) => ({ relation, petname: pets[handleIndex]!, handleIndex })), join(root, "projections"));
    // Re-founded: the same three pet-names on fresh relations; `vault unlock --all --face 1` opened all three, h1 worn.
    const [R0, R1, R2] = ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb0", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"];
    const v = new FakeHouse([R0, R1, R2].map((relation, handleIndex) => ({ handleIndex, petname: pets[handleIndex]!, relation })), "grant", R1);
    v.held.add("garden");

    const first = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(first.refusals).toEqual([]);
    // Every open face's memory lands, each in its own document alone.
    expect(v.workingOf(R0).get(N0)?.text).toBe(tid(N0, "face h0's own memory"));
    expect(v.workingOf(R1).get(N1)?.text).toBe(tid(N1, "face h1's own memory"));
    expect(v.workingOf(R2).get(N2)?.text).toBe(tid(N2, "face h2's own memory"));
    for (const [r, others] of [[R0, [N1, N2]], [R1, [N0, N2]], [R2, [N0, N1]]] as const) for (const n of others) expect(v.workingOf(r).has(n)).toBe(false);
    // The worn face rides the ordinary wave; each other open face's waves name it.
    const rootOf = (i: number): string => P(`faces/${pets[i]}`) + sep;
    expect(v.waveFaces.filter((w) => (w.source + sep).startsWith(rootOf(1))).every((w) => w.face === undefined)).toBe(true);
    expect(v.waveFaces.filter((w) => (w.source + sep).startsWith(rootOf(0))).every((w) => w.face === 0)).toBe(true);
    expect(v.waveFaces.filter((w) => (w.source + sep).startsWith(rootOf(2))).every((w) => w.face === 2)).toBe(true);
    expect(first.waiting).toEqual([]);
    expect(mirrorsLeftWork(first)).toBe(false);
    // A second lay lands nothing.
    const again = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(again.layers.reduce((n, t) => n + t.landed, 0)).toBe(0);
  });

  test("M13b — h0 and h1 open, h2 shut: one lay lands h0 and h1 and names h2; unlocking h2 and laying lands h2 alone", async () => {
    const [G0, G1, G2] = ["dddddddd-dddd-4ddd-8ddd-ddddddddddd0", "dddddddd-dddd-4ddd-8ddd-ddddddddddd1", "dddddddd-dddd-4ddd-8ddd-ddddddddddd2"];
    const [N0, N1, N2] = ["lar:///ha.ka.ba/notes/zero-own", "lar:///ha.ka.ba/notes/one-own", "lar:///ha.ka.ba/notes/two-own"];
    clearFace();
    const pets = ["joshua-fontany", "joshua-fontany-engineer", "joshua-fontany-referee"];
    [N0, N1, N2].forEach((n, i) => put(FR(pets[i]!, `wiki/ha.ka.ba/notes/${n.slice(n.lastIndexOf("/") + 1)}.tid`), tid(n, `face h${i}'s memory`)));
    writeFaceLabels([G0, G1, G2].map((relation, handleIndex) => ({ relation, petname: pets[handleIndex]!, handleIndex })), join(root, "projections"));
    const [R0, R1, R2] = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"];
    const v = new FakeHouse([
      { handleIndex: 0, petname: pets[0]!, relation: R0 },
      { handleIndex: 1, petname: pets[1]!, relation: R1 },
      { handleIndex: 2, petname: pets[2]!, relation: null, kahua: null, kahuaRefusal: "face-locked" },
    ], "grant", R1);
    v.held.add("garden");
    const first = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.workingOf(R0).get(N0)?.text).toBe(tid(N0, "face h0's memory"));
    expect(v.workingOf(R1).get(N1)?.text).toBe(tid(N1, "face h1's memory"));
    expect(v.waveFaces.some((w) => w.face === 2)).toBe(false);
    expect(first.waiting.map((w) => [w.handleIndex, w.petname, w.folders])).toEqual([[2, pets[2], [P(`faces/${pets[2]}`)]]]);
    expect(mirrorLines(first).out.join("\n")).toContain(`${pets[2]} stays shut: \`lares vault unlock --face 2\`, then lay again`);
    expect(existsSync(P(`faces/${pets[2]}`))).toBe(true);

    // `lares vault unlock --face 2`, then lay: h2's memory lands in h2's own document alone; h0 and h1 read quiet.
    (v.faces as Array<BundleVesselFace>)[2] = { ...v.faces[2]!, relation: R2, kahua: [] };
    v.waveFaces = [];
    const second = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.workingOf(R2).get(N2)?.text).toBe(tid(N2, "face h2's memory"));
    expect(v.workingOf(R2).has(N0) || v.workingOf(R2).has(N1)).toBe(false);
    expect(second.waiting).toEqual([]);
    expect(second.layers.filter((t) => t.landed > 0).every((t) => t.mirror.endsWith(pets[2]!))).toBe(true);
  });

  test("M13c — an open face the island resolves no layer for waits by name: no refusal flood, its folders stay, the worn face lands", async () => {
    const [G0, G1] = ["ffffffff-ffff-4fff-8fff-fffffffffff0", "ffffffff-ffff-4fff-8fff-fffffffffff1"];
    clearFace();
    const pets = ["joshua-fontany", "joshua-fontany-engineer"];
    put(FR(pets[0]!, "wiki/ha.ka.ba/notes/zero.tid"), tid("lar:///ha.ka.ba/notes/zero", "h0's"));
    put(FR(pets[1]!, "wiki/ha.ka.ba/notes/one.tid"), tid("lar:///ha.ka.ba/notes/one", "h1's"));
    writeFaceLabels([G0, G1].map((relation, handleIndex) => ({ relation, petname: pets[handleIndex]!, handleIndex })), join(root, "projections"));
    const [R0, R1] = ["abababab-abab-4bab-8bab-ababababab00", "abababab-abab-4bab-8bab-ababababab01"];
    const v = new FakeHouse([{ handleIndex: 0, petname: pets[0]!, relation: R0 }, { handleIndex: 1, petname: pets[1]!, relation: R1 }], "grant", R1);
    v.unresolved.add(0);
    const r = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.workingOf(R1).get("lar:///ha.ka.ba/notes/one")).toBeDefined();
    expect(v.workingOf(R0).size).toBe(0);
    expect(r.waiting.map((w) => [w.handleIndex, w.why])).toEqual([[0, "unresolved"]]);
    expect(mirrorsLeftWork(r)).toBe(false);
    expect(mirrorLines(r).out.join("\n")).toMatch(/joshua-fontany stands open, and its own layer lays at its own face's wear \(this island opens no daemon layer of its own for it under another face\)/);
    expect(existsSync(P(`faces/${pets[0]}`))).toBe(true);
  });

  test("M14 — the import's lit set: a three-face bundle onto three open faces, h1 worn, lands each face's rows in its own document", async () => {
    const pets = ["one", "two", "three"];
    const old = new FakeHouse([F1, F2, F3].map((relation, handleIndex) => ({ handleIndex, petname: pets[handleIndex]!, relation })), "old", F1);
    old.held.add("garden");
    clearFace();
    put(FR("one", "wiki/ha.ka.ba/notes/pond.tid"), POND_WORKING);
    put(FR("two", "wiki/ha.ka.ba/notes/two.tid"), tid("lar:///ha.ka.ba/notes/two", "face two's"));
    put(FR("three", "wiki/ha.ka.ba/notes/three.tid"), tid("lar:///ha.ka.ba/notes/three", "face three's"));
    await houseExport(out, { acceptOmissions: true, doors: old.bundleDoors() });
    rmSync(P("faces"), { recursive: true, force: true });
    const [R0, R1, R2] = ["cccccccc-cccc-4ccc-8ccc-ccccccccccc0", "cccccccc-cccc-4ccc-8ccc-ccccccccccc1", "cccccccc-cccc-4ccc-8ccc-ccccccccccc2"];
    const after = new FakeHouse([R0, R1, R2].map((relation, handleIndex) => ({ handleIndex, petname: pets[handleIndex]!, relation })), "new", R1);
    after.held.add("garden");
    const r = await houseImport(out, { apply: true, doors: after.bundleDoors() });
    // Every face open: each bundle face's rows land in its own face's document, the worn one's and the two named alike.
    expect(r.waiting).toEqual([]);
    expect(after.live(WORKING, "lar:///ha.ka.ba/notes/two")?.text).toBe(tid("lar:///ha.ka.ba/notes/two", "face two's"));
    expect(after.workingOf(R2).get("lar:///ha.ka.ba/notes/three")?.text).toBe(tid("lar:///ha.ka.ba/notes/three", "face three's"));
    expect(after.live(WORKING, "lar:///ha.ka.ba/notes/three")).toBeUndefined();
    expect(after.workingOf(R0).get(POND)).toBeDefined();                      // face one's working copy lands in face one's own document
    expect(after.live(WORKING, POND)).toBeUndefined();
  });

  test("M15 — one refused root never halts the rest: an unmatched root records its line, the face's own lands", async () => {
    await oldVessel();
    put(FR("nobody-here", "wiki/ha.ka.ba/notes/stray.tid"), tid("lar:///ha.ka.ba/notes/stray", "a stranger's memory"));
    const after = refound();
    const r = await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(r.refusals.map((x) => [x.face, x.code])).toEqual([["nobody-here", "seed-face-unmatched"]]);
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
    expect(after.live(WORKING, "lar:///ha.ka.ba/notes/stray")).toBeUndefined();
    expect(existsSync(P("faces/nobody-here/wiki/ha.ka.ba/notes/stray.tid"))).toBe(true);
  });

  test("M16 — a face whose pet-name would not read blocks only the folders no other face claims; a SHUT face waits for its own", async () => {
    await oldVessel();
    put(FR("unknown-one", "wiki/ha.ka.ba/notes/stray.tid"), tid("lar:///ha.ka.ba/notes/stray", "whose?"));
    const after = refound([{ handleIndex: 0, petname: "hearth-one", relation: F2 }, { handleIndex: 1, petname: null, relation: null, kahua: null, kahuaRefusal: "vessel-locked" }]);
    const r = await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(r.refusals.map((x) => [x.face, x.code])).toEqual([["unknown-one", "seed-faces-unread"]]);
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);                // hearth-one's root still lands

    // A face that stands SHUT under a pet-name it still answers: its root waits, named, never refused.
    rmSync(P("faces/unknown-one"), { recursive: true });
    put(FR("referee", "wiki/ha.ka.ba/notes/shut.tid"), tid("lar:///ha.ka.ba/notes/shut", "the referee's"));
    const shut = refound([{ handleIndex: 0, petname: "hearth-one", relation: F2 }, { handleIndex: 2, petname: "referee", relation: null, kahua: null, kahuaRefusal: "face-locked" }]);
    const s2 = await seedMirrors({ apply: true, doors: shut.mirrorDoors() });
    expect(s2.refusals).toEqual([]);
    expect(s2.waiting.map((w) => [w.handleIndex, w.petname, w.folders])).toEqual([[2, "referee", [P("faces/referee")]]]);
    expect(mirrorLines(s2).out.join("\n")).toContain("referee stays shut: `lares vault unlock --face 2`, then lay again");
    expect(existsSync(P("faces/referee/wiki/ha.ka.ba/notes/shut.tid"))).toBe(true);
  });

  test("M17 — a kahua refusal names its face", async () => {
    await oldVessel();
    // A stage file naming no item beside the heron.
    put(FR("hearth-one", "stage/ha.ka.ba/kahua/memory/broken.tid"), "no carrier here\n");
    const after = refound();
    const r = await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(r.kahua.refused.length).toBe(1);
    expect(r.kahua.refused[0]).toMatch(/^h0 \("hearth-one"\): /);
    expect(after.lifts.map((l) => l.title)).toEqual([HERON]);
  });

  test("M18 — one folder for a workbench: it lays once, at a seated writer's wear; a face with no writer's seat waits by name and takes none of it", async () => {
    const [R0, R1, R2] = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"];
    const RFC = "lar:///ha.ka.ba/lares/ref/RFC-4151";
    clearFace(true);
    const pets = ["steward", "engineer", "referee"];
    put("projections/wikis/notes/ha.ka.ba/lares/ref/RFC-4151.tid", tid(RFC, "the one working copy the seated faces share"));
    const v = new FakeHouse([R0, R1, R2].map((relation, handleIndex) => ({ handleIndex, petname: pets[handleIndex]!, relation })), "grant", R2);
    v.held.add("notes");
    // The steward owns the workbench and the engineer holds a writer's seat; the referee reads.
    v.seats.set("notes", new Set([R0, R1]));
    // THE REFEREE WORN: the folder waits by name, exits clean, and nothing of it reaches the workbench or the referee's own layers.
    const first = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(first.benchWaiting).toEqual([{ slug: "notes", folder: P("wikis/notes"), why: "writer" }]);
    expect(v.bench("notes").size + v.personalOf(R2, "notes").size).toBe(0);
    expect(mirrorLines(first).out.join("\n")).toMatch(/the workbench of notes lays once, at the wear of a face that holds a writer's seat there: this face holds none/);
    expect(mirrorsLeftWork(first), "a folder that waits for a writer leaves no work for a hand").toBe(false);
    expect(first.refusals).toEqual([]);
    // THE ENGINEER WORN, a seated writer and not the owner: it lays the one folder into the one document.
    v.wear(R1);
    const second = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.bench("notes").get(RFC)?.text).toBe(tid(RFC, "the one working copy the seated faces share"));
    expect(second.benchWaiting).toEqual([]);
    expect(second.layers.map((t) => [t.mirror, t.landed])).toEqual([["workbench notes", 1]]);
    // THE STEWARD WORN: the document already holds it, so the second writer's lay lands nothing. Once per document.
    v.wear(R0);
    const third = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(third.layers.reduce((n, t) => n + t.landed, 0)).toBe(0);
    // Settled against its base, the folder draws no line under the referee; a hand's edit there waits for a writer again.
    v.wear(R2);
    expect((await seedMirrors({ apply: true, doors: v.mirrorDoors() })).benchWaiting).toEqual([]);
    put("projections/wikis/notes/ha.ka.ba/lares/ref/RFC-4151.tid", tid(RFC, "the copy, edited by hand"));
    expect((await seedMirrors({ apply: true, doors: v.mirrorDoors() })).benchWaiting.map((w) => w.why)).toEqual(["writer"]);
    expect(v.bench("notes").get(RFC)?.text).toBe(tid(RFC, "the one working copy the seated faces share"));
    expect(existsSync(P(`wikis/notes-${R1}`)), "no folder names a face").toBe(false);
    expect(mirrorFiles(P("faces")), "a workbench never rests under a face root").toEqual([]);
  });

  test("M18b — a wiki whose workbench another face's realm binds mints nothing under a face that holds no writer's seat there: its catalog names no such wiki, and the folder waits by name", async () => {
    const [R0, R1, R2] = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"];
    const RFC = "lar:///ha.ka.ba/lares/ref/RFC-4151";
    clearFace(true);
    const pets = ["steward", "engineer", "referee"];
    put("projections/wikis/cold-shelf/ha.ka.ba/lares/ref/RFC-4151.tid", tid(RFC, "the steward's page in a wiki no share names for the referee"));
    // THE REFEREE WORN: the steward stood cold-shelf (its realm binds the slug); the referee's catalog names no such wiki.
    const v = new FakeHouse([R0, R1, R2].map((relation, handleIndex) => ({ handleIndex, petname: pets[handleIndex]!, relation })), "grant", R2);
    v.seats.set("cold-shelf", new Set([R0]));
    const r = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.wikiMints, "the referee's lay mints no wiki of its own over the steward's").toEqual([]);
    expect(r.minted).toEqual([]);
    expect(r.benchWaiting).toEqual([{ slug: "cold-shelf", folder: P("wikis/cold-shelf"), why: "writer" }]);
    expect(v.bench("cold-shelf").size + v.personalOf(R2, "cold-shelf").size).toBe(0);
    // CONTROL: an unbound house wiki (no face stood it on this founding) still mints at the worn face's lay, which stands it.
    rmSync(P("wikis/cold-shelf"), { recursive: true });
    put("projections/wikis/lending-shelf/ha.ka.ba/lares/ref/RFC-4151.tid", tid(RFC, "a page in a wiki no face stood yet"));
    const fresh = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(fresh.minted).toEqual(["lar:///ha.ka.ba/bags/lending-shelf"]);
  });

  test("M19 — a sourced wiki's one folder, beside the canon source, lays at ANY seated writer's wear: no face alone writes back", async () => {
    const RFC = "lar:///ha.ka.ba/lares/ref/RFC-4151";
    clearFace(true);
    put("wikis/lares/ha.ka.ba/lares/ref/RFC-4151.tid", tid(RFC, "the shared working copy, beside the source"));
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: F2 }, { handleIndex: 1, petname: "engineer", relation: F3 }, { handleIndex: 2, petname: "referee", relation: F1 }], "grant", F1);
    v.held.add("lares");
    v.canonWikis = join(root, "wikis"); v.sourcedSlugs.add("lares");
    v.seats.set("lares", new Set([F2, F3]));
    // The referee, seated read-only, worn: the folder waits and reaches no layer.
    const first = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(first.benchWaiting).toEqual([{ slug: "lares", folder: join(root, "wikis", "lares"), why: "writer" }]);
    expect(v.bench("lares").size).toBe(0);
    // The engineer, a seated writer who holds no Kahu chair, worn: it lays the folder beside the source.
    v.wear(F3);
    const second = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.bench("lares").get(RFC)?.text).toBe(tid(RFC, "the shared working copy, beside the source"));
    expect(second.layers.map((t) => t.mirror)).toEqual(["workbench lares (beside the canon source)"]);
    expect(second.benchWaiting).toEqual([]);
    // The steward's lay after it lands nothing.
    v.wear(F2);
    expect((await seedMirrors({ apply: true, doors: v.mirrorDoors() })).layers.reduce((n, t) => n + t.landed, 0)).toBe(0);
  });

  test("M21 — after a re-founding a shared wiki re-stands at its owner's wear from its mirror and its share row, and the shares land again", async () => {
    const [R0, R1] = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"];
    const PAGE = "lar:///ha.ka.ba/notes/page", DRAFTED = "lar:///ha.ka.ba/notes/working-only";
    clearFace(true);
    // What the former founding left: the wiki's canon mirror, its one workbench folder, and the vessel-private share row.
    put("projections/bags/notes/ha.ka.ba/notes/page.tid", tid(PAGE, "a promoted page"));
    put("projections/wikis/notes/ha.ka.ba/notes/working-only.tid", tid(DRAFTED, "a working-only page"));
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "grant", R1);
    v.shareRows = [{ slug: "notes", kind: "wiki", read: "", write: "engineer", owner: "steward" }];
    // THE ENGINEER SEEDS FIRST: the wiki belongs to the steward, so nothing mints and nothing lays under the engineer.
    const first = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.mints).toEqual([]);
    expect(first.benchWaiting.map((w) => [w.slug, w.why, w.owner])).toEqual([["notes", "owner", "steward"], ["notes", "owner", "steward"]]);
    expect(mirrorLines(first).out.join("\n")).toMatch(/the wiki notes re-stands at its owner's wear: wear steward/);
    expect(v.bench("notes").size + v.layer("lar:///ha.ka.ba/bags/notes").size).toBe(0);
    expect(mirrorsLeftWork(first)).toBe(false);
    // THE OWNER'S WEAR: the wiki mints again, its canon and its workbench lay, and the shares land again by pet-name.
    v.wear(R0);
    const second = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.mints).toEqual(["lar:///ha.ka.ba/bags/notes"]);
    expect(v.wikiMints, "a wiki mints through the wiki door, so its recipe row stands").toEqual(["notes"]);
    expect(v.layer("lar:///ha.ka.ba/bags/notes").get(PAGE)?.text).toBe(tid(PAGE, "a promoted page"));
    expect(v.bench("notes").get(DRAFTED)?.text).toBe(tid(DRAFTED, "a working-only page"));
    expect(second.benchWaiting).toEqual([]);
    expect(second.shares?.workbenches).toEqual([{ slug: "notes", members: 1, founded: false, seated: 1, removed: 0 }]);
    expect(mirrorLines(second).out.join("\n")).toMatch(/shares: landed 0 grant\(s\); workbench seats: notes \(1 member face\(s\), 1 seated now\)/);
    // The engineer's lay after it lands nothing: the document arrived once.
    v.seats.get("notes")!.add(R1);
    v.wear(R1);
    const third = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(third.layers.reduce((n, t) => n + t.landed, 0)).toBe(0);
    expect(v.mints).toHaveLength(1);
  });

  test("M20 — a face's margin of a wiki comes back across a re-founding: the root its pet name makes lays into that face's own layer alone", async () => {
    const [G0, G1] = ["cccccccc-cccc-4ccc-8ccc-ccccccccccc0", "cccccccc-cccc-4ccc-8ccc-ccccccccccc1"];
    const [R0, R1] = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"];
    const NOTE = "lar:///ha.ka.ba/lares/ref/RW-REHEARSAL";
    clearFace(true);
    // The former engineer held no writer's seat in the `lares` workbench, so its put rested in its own personal layer.
    put(FR("engineer", "margins/lares/ha.ka.ba/lares/ref/RW-REHEARSAL.tid"), tid(NOTE, "what the engineer kept for itself"));
    writeFaceLabels([{ relation: G0, petname: "steward", handleIndex: 0 }, { relation: G1, petname: "engineer", handleIndex: 1 }], join(root, "projections"));
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "grant", R0);
    v.held.add("lares");
    // A view-state carrier the face left: with no base standing at its path it reads back as nothing, and nothing stands off.
    put(FR("engineer", "margins/lares/$__StoryList.tid"), tid("$:/StoryList", "the story here"));
    const first = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(first.refusals).toEqual([]);
    // The steward stands worn: the engineer's margin waits for the engineer's own wear, and lands in no other face's layer.
    expect(first.waiting.map((w) => [w.handleIndex, w.why, w.folders])).toEqual([[1, "unworn", [P("faces/engineer/margins/lares")]]]);
    expect(v.personalOf(R0, "lares").size + v.personalOf(R1, "lares").size).toBe(0);
    expect(mirrorLines(first).out.join("\n")).toMatch(/engineer stands unworn, and a face's own layer of a wiki lays at that face's wear: wear it \(`lares vault unlock --face 1`\)/);
    expect(mirrorsLeftWork(first), "a waiting face leaves no work for a hand beyond its wear").toBe(false);
    v.wear(R1);
    const second = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.personalOf(R1, "lares").get(NOTE)?.text, "the engineer's margin lands in the engineer's own personal layer").toBe(tid(NOTE, "what the engineer kept for itself"));
    expect(v.personalOf(R0, "lares").size, "and never in the steward's").toBe(0);
    expect(v.waveFaces.filter((w) => w.source.includes("margins")).every((w) => w.face === undefined), "a margin wave rides the worn face's own island").toBe(true);
    expect(existsSync(P("faces/engineer/margins/lares/ha.ka.ba/lares/ref/RW-REHEARSAL.tid"))).toBe(true);
    expect(readFileSync(P("faces/engineer/margins/lares/$__StoryList.tid"), "utf8")).toContain("the story here");
    expect(second.layers.flatMap((t) => t.stoodOff)).toEqual([]);
    expect(existsSync(P("ashes"))).toBe(false);
    expect(second.waiting).toEqual([]);
    const again = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(again.layers.reduce((n, t) => n + t.landed, 0), "a second lay lands nothing").toBe(0);
  });

  test("M22 — export and import carry by document: a workbench travels as ONE row set with its share row, a personal layer for its one face; each lands once", async () => {
    const [G0, G1] = ["cccccccc-cccc-4ccc-8ccc-ccccccccccc0", "cccccccc-cccc-4ccc-8ccc-ccccccccccc1"];
    const [R0, R1] = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"];
    const PAGE = "lar:///ha.ka.ba/notes/page", DRAFTED = "lar:///ha.ka.ba/notes/working-only", MARGIN = "lar:///ha.ka.ba/lares/ref/RW-REHEARSAL", SOURCED = "lar:///ha.ka.ba/lares/ref/RFC-4151";
    clearFace(true);
    // THE STANDING VESSEL: a shared wiki's canon and its ONE workbench folder, a sourced wiki's workbench beside its canon
    // source, the engineer's personal layer of `lares`, and the vessel-private share row that names owner and seats.
    put("projections/bags/notes/ha.ka.ba/notes/page.tid", tid(PAGE, "a promoted page"));
    put("projections/wikis/notes/ha.ka.ba/notes/working-only.tid", tid(DRAFTED, "a working-only page"));
    put("wikis/lares/ha.ka.ba/lares/ref/RFC-4151.tid", tid(SOURCED, "a working copy beside the source"));
    put(FR("engineer", "margins/lares/ha.ka.ba/lares/ref/RW-REHEARSAL.tid"), tid(MARGIN, "what the engineer kept for itself"));
    put(FR("engineer", "margins/lares/$__StoryList.tid"), tid("$:/StoryList", "a view"));
    const old = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: G0 }, { handleIndex: 1, petname: "engineer", relation: G1 }], "old-grant", G0);
    old.held.add("notes"); old.held.add("lares");
    old.canonWikis = join(root, "wikis"); old.sourcedSlugs.add("lares");
    old.shareRows = [{ slug: "notes", kind: "wiki", read: "", write: "engineer", owner: "steward" }];
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    expect(manifest.counts["wiki-working"], "each workbench travels as its one row set: notes, and the sourced lares").toBe(2);
    expect(manifest.rows.filter((r) => r.layer === "wiki-working").map((r) => [r.title, r.face]).sort()).toEqual([[SOURCED, null], [DRAFTED, null]].sort());
    expect(manifest.rows.filter((r) => r.layer === "personal").map((r) => [r.title, r.face, r.bag])).toEqual([[MARGIN, "engineer", "lar:///ha.ka.ba/wikis/lares/personal"]]);
    expect(manifest.files.some((f) => f.path.includes("$__")), "a view-state carrier never travels").toBe(false);
    // The re-declare list rests sealed to the keep pair; the steward's route opens the seat the bundle carries, then the roster.
    const verified = verifyBundle(out);
    const opening = await openKeepSeat(readBundleSeat(verified), [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }]);
    if (opening.reading !== "opens") throw new Error(`the keep seat opened nothing: ${opening.reading}`);
    const redeclare = openBundle(verified, opening.secret).redeclare;
    expect(redeclare.shares, "the share row travels beside the workbench it seats, owner and seats by pet-name").toEqual([{ slug: "notes", kind: "wiki", read: "", write: "engineer", owner: "steward" }]);

    // A RE-FOUNDING, with the mirrors gone (the bundle alone carries them): the engineer imports first.
    rmSync(P("wikis/notes"), { recursive: true }); rmSync(P("bags/notes"), { recursive: true }); rmSync(P("faces/engineer"), { recursive: true }); rmSync(join(root, "wikis"), { recursive: true });
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "new-grant", R1);
    v.canonWikis = join(root, "wikis"); v.sourcedSlugs.add("lares"); v.held.add("lares");
    v.seats.set("lares", new Set([R0]));           // the steward's first mount stood the house wiki's workbench
    const first = await houseImport(out, { apply: true, doors: v.bundleDoors() });
    expect(v.shareRows, "the share row lands in the vessel-private file").toEqual([{ slug: "notes", kind: "wiki", read: "", write: "engineer", owner: "steward" }]);
    expect(first.shares.written).toEqual(["notes"]);
    expect(first.benchWaiting.map((w) => [w.slug, w.why, w.owner]).sort(), "notes waits for its owner, lares for a seated writer").toEqual([["lares", "writer", undefined], ["notes", "owner", "steward"]]);
    expect(v.mints, "a wiki another face owns mints at that face's wear").toEqual([]);
    expect(v.bench("notes").size + v.bench("lares").size + v.layer("lar:///ha.ka.ba/bags/notes").size).toBe(0);
    expect(v.personalOf(R1, "lares").get(MARGIN)?.text, "the worn engineer's own margin lands").toBe(tid(MARGIN, "what the engineer kept for itself"));
    expect(first.tallies.personal.landed).toBe(1);
    // THE STEWARD WEARS: the wiki mints, its canon and both workbenches land once, and the engineer's margin stays the engineer's.
    v.wear(R0);
    const second = await houseImport(out, { apply: true, doors: v.bundleDoors() });
    expect(v.mints).toEqual(["lar:///ha.ka.ba/bags/notes"]);
    expect(v.wikiMints, "a wiki mints through the wiki door, so its recipe row stands").toEqual(["notes"]);
    expect(v.layer("lar:///ha.ka.ba/bags/notes").get(PAGE)?.text).toBe(tid(PAGE, "a promoted page"));
    expect(v.bench("notes").get(DRAFTED)?.text).toBe(tid(DRAFTED, "a working-only page"));
    expect(v.bench("lares").get(SOURCED)?.text).toBe(tid(SOURCED, "a working copy beside the source"));
    expect(existsSync(join(root, "wikis", "lares", "ha.ka.ba", "lares", "ref", "RFC-4151.tid")), "a sourced wiki's rows restore beside the canon source").toBe(true);
    expect(second.benchWaiting).toEqual([]);
    expect(second.tallies.wikiWorking.landed).toBe(2);
    expect(v.personalOf(R0, "lares").size, "no face's margin lands on another face").toBe(0);
    expect(v.shareLandings).toBeGreaterThan(0);
    // A SECOND IMPORT LANDS NOTHING, under either face.
    const third = await houseImport(out, { apply: true, doors: v.bundleDoors() });
    expect(Object.values(third.tallies).reduce((n, t) => n + t.landed + t.planned, 0)).toBe(0);
    v.seats.get("notes")!.add(R1);
    v.wear(R1);
    const fourth = await houseImport(out, { apply: true, doors: v.bundleDoors() });
    expect(Object.values(fourth.tallies).reduce((n, t) => n + t.landed + t.planned, 0)).toBe(0);
    expect(v.mints).toHaveLength(1);
  });

  test("M11 — a fresh face that reads no relation and no stage never halts the lay", async () => {
    const v = new FakeHouse([{ handleIndex: 0, petname: "hearth-one", relation: F1 }, { handleIndex: 1, petname: "fresh", relation: null, kahua: [] }], "grant", F1);
    v.held.add("garden");
    const r = await seedMirrors({ apply: true, doors: v.mirrorDoors(), liftKahua: 1 });
    expect(r.refusals).toEqual([]);
    expect(v.live(WORKING, POND)?.text).toBe(POND_WORKING);
  });
});

describe("no plain-title working tiddler drops at a re-found (tideline-surface#/rehearsal, the walked loss)", () => {
  const PLAIN: Record<string, string> = { "My Notes.tid": "My Notes", "Time_ dusk.tid": "Time: dusk", "$__config_Foo.tid": "$:/config/Foo", "Room 4.tid": "Room 4" };

  test("M23 — reset -> found -> lay keeps every plain-title working tiddler of the former face, each under its own title", async () => {
    for (const [file, title] of Object.entries(PLAIN)) put(FR("hearth-one", `wiki/${file}`), tid(title, `the words of ${title}`));
    const old = await oldVessel();
    for (const title of Object.values(PLAIN)) expect(old.live(WORKING, title)?.text, title).toBe(tid(title, `the words of ${title}`));
    const after = refound();
    await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    for (const title of Object.values(PLAIN)) expect(after.live(WORKING, title)?.text, title).toBe(tid(title, `the words of ${title}`));
    // The loci carriers still land beside them.
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
  });

  test("M24 — a file no rule reads names itself in the lay's lines, and the lay says it skipped", async () => {
    put(FR("hearth-one", "wiki/$__state_fold.tid"), tid("$:/state/fold", "a fold"));
    const v = new FakeHouse([{ handleIndex: 0, petname: "hearth-one", relation: F1 }], "grant", F1);
    v.held.add("garden");
    const r = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    const working = r.layers.find((t) => t.toBag === WORKING)!;
    expect(working.skipped.map((s) => s.file)).toEqual([P("faces/hearth-one/wiki/$__state_fold.tid")]);
    expect(mirrorLines(r).err.some((l) => l.includes("$__state_fold.tid") && /projection filter/.test(l))).toBe(true);
  });

  test("M25 — HOUSE_IGNORED reaches the bundle: an export carries no `.git/` (the face root's own pool, or one inside a plane), and a lay reads none", async () => {
    put(FR("hearth-one", ".git/config"), "[user]\n  name = someone\n");
    put(FR("hearth-one", ".git/objects/ab/cdef"), "blob");
    put(FR("hearth-one", "wiki/.git/HEAD"), "ref: refs/heads/main\n");
    put(FR("hearth-one", "wiki/.vscode/settings.json"), "{}");
    const old = await oldVessel();
    expect(old.laid.some((s) => s.includes(".git"))).toBe(false);
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    expect(manifest.files.filter((f) => /(^|\/)\.(git|vscode)\//.test(f.path))).toEqual([]);
    const after = refound();
    const seeded = await seedMirrors({ apply: true, doors: after.mirrorDoors(), liftKahua: 1 });
    expect(seeded.layers.flatMap((t) => t.skipped).filter((x) => x.file.includes(".git"))).toEqual([]);
  });
});

describe("a carry act waits by name for a face that stands open and unworn, and accounts for every row (the carry block, walked)", () => {
  const [G0, G1] = ["cccccccc-cccc-4ccc-8ccc-ccccccccccc0", "cccccccc-cccc-4ccc-8ccc-ccccccccccc1"];
  const [R0, R1] = ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"];
  const WREN = "lar:///ha.ka.ba/kahua/memory/wren", NOTE = "lar:///ha.ka.ba/notes/engineer-own", MARGIN = "lar:///ha.ka.ba/lares/ref/RW-REHEARSAL";
  /** A kahua carrier as the projector writes it: the block, a blank line, the body verbatim (no newline added). */
  const kahuaTid = (title: string, body: string): string => `kahua-sources: []\nkahua-taint: []\ntitle: ${title}\ntype: text/vnd.tiddlywiki\n\n${body}`;
  const clearOld = (): void => clearFace(true);
  /** The vessel's own law, as a walked hearth answers it: a lift for a face it does not mount refuses `chore-face-not-mounted`. */
  const liftsAsWornAlone = (v: FakeHouse): BundleDoors["kahuaLift"] => async (face, lift) => {
    if (v.faces.find((f) => f.handleIndex === face)?.relation !== v.worn) throw new Error("chore-face-not-mounted: a kahua stage acts for a face this vessel does not mount");
    return v.kahuaLift(face, lift);
  };

  test("W1 — RED: a kahua item of an open, unworn face waits by name for its own wear: the count names what this wear lifts, no lift reaches the vessel for it, the lay leaves no work; CONTROL: the worn face's item lifts, and the unworn face's lifts at its own wear", async () => {
    clearOld();
    put(FR("steward", "stage/ha.ka.ba/kahua/memory/heron.tid"), kahuaTid(HERON, "remember the heron"));
    put(FR("engineer", "stage/ha.ka.ba/kahua/memory/wren.tid"), kahuaTid(WREN, "remember the wren"));
    writeFaceLabels([{ relation: G0, petname: "steward", handleIndex: 0 }, { relation: G1, petname: "engineer", handleIndex: 1 }], join(root, "projections"));
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "grant", R0);
    const doors = (): MirrorDoors => ({ ...v.mirrorDoors(), kahuaLift: liftsAsWornAlone(v) });
    const first = await seedMirrors({ apply: true, doors: doors(), liftKahua: 1 });
    expect(v.lifts.map((l) => [l.face, l.title])).toEqual([[0, HERON]]);
    expect(first.kahua.refused, "an expected wait names itself; it never reads as a refusal").toEqual([]);
    expect(first.kahua.waiting.map((p) => [p.handleIndex, p.title])).toEqual([[1, WREN]]);
    expect(mirrorsLeftWork(first)).toBe(false);
    expect(mirrorLines(first).out.join("\n")).toMatch(/engineer \(h1\)[^\n]*lifts at its own face's wear: wear it \(`lares vault unlock --face 1`\)/);
    expect(readKahuaPending().map((p) => p.title), "the waiting item stays at the shore").toEqual([WREN]);
    // A count that names the unworn face's item too refuses before anything writes: this wear lifts one.
    await expect(seedMirrors({ apply: true, doors: doors(), liftKahua: 2 })).rejects.toThrow(/seed-kahua-count/);
    v.wear(R1);
    const second = await seedMirrors({ apply: true, doors: doors(), liftKahua: 1 });
    expect(v.lifts.map((l) => [l.face, l.title])).toEqual([[0, HERON], [1, WREN]]);
    expect(second.kahua.waiting).toEqual([]);
    expect(readKahuaPending()).toEqual([]);
  });

  test("W2 — RED: a face-named wave the island answers `document-unavailable` for (a lit face's own layer, sealed under its own key) waits by name and leaves the exit green; CONTROL: any other refusal still reads as work for a hand", async () => {
    clearOld();
    put(FR("engineer", "wiki/ha.ka.ba/notes/engineer-own.tid"), tid(NOTE, "the engineer's own memory"));
    writeFaceLabels([{ relation: G0, petname: "steward", handleIndex: 0 }, { relation: G1, petname: "engineer", handleIndex: 1 }], join(root, "projections"));
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "grant", R0);
    const sealed = "[document-unavailable] lar:///ha.ka.ba/wikis/daemon/working (a lit face's own layer) unavailable: doc automerge:2rZ45c35 was reported unavailable by every reachable peer; make the document reachable from a peer, then restart.";
    const refusing = (why: string): MirrorDoors => ({ ...v.mirrorDoors(), lay: async (wave, apply) => wave.face === undefined ? v.lay(wave, apply)
      : { planned: [NOTE], kapae: [], landed: [], kapaeRaised: [], conflicts: [], refused: apply ? [{ uri: NOTE, why }] : [], unanswered: [], skipped: [] } });
    const r = await seedMirrors({ apply: true, doors: refusing(sealed) });
    expect(r.layers.flatMap((t) => t.refused)).toEqual([]);
    expect(r.waiting.map((w) => [w.handleIndex, w.why])).toEqual([[1, "unresolved"]]);
    expect(mirrorsLeftWork(r), "an expected wait leaves the exit green").toBe(false);
    expect(mirrorLines(r).out.join("\n")).toMatch(/engineer stands open, and its own layer lays at its own face's wear[^\n]*wear it \(`lares vault unlock --face 1`\) and lay again/);
    expect(mirrorLines(r).err).toEqual([]);
    const other = await seedMirrors({ apply: true, doors: refusing("cap-denied: write on the layer required") });
    expect(mirrorsLeftWork(other), "CONTROL: a refusal that names no wait still asks a hand").toBe(true);
  });

  test("W3 — RED: a kahua body rides the lay's lift byte for byte, its trailing newline kept, so the import after it reads the stage as holding the bundle's body; CONTROL: a body that ends with no newline lifts as it stands", async () => {
    expect(readKahuaFile(kahuaTid(WREN, "a body that ends with one newline\n"))?.text).toBe("a body that ends with one newline\n");
    expect(readKahuaFile(kahuaTid(WREN, "a body that ends with none"))?.text).toBe("a body that ends with none");
    clearOld();
    const body = "remember the wren, and the line ends here\n";
    put(FR("steward", "stage/ha.ka.ba/kahua/memory/wren.tid"), kahuaTid(WREN, body));
    writeFaceLabels([{ relation: G0, petname: "steward", handleIndex: 0 }], join(root, "projections"));
    const old = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: G0 }], "old-grant", G0);
    old.stage.set(0, [{ title: WREN, cid: sha("old-wren"), text: body, fields: {}, taint: [], sources: [] }]);
    await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }], "new-grant", R0);
    await seedMirrors({ apply: true, doors: v.mirrorDoors(), liftKahua: 1 });
    expect(v.lifts.map((l) => l.text)).toEqual([body]);
    const imported = await houseImport(out, { apply: true, doors: v.bundleDoors() });
    expect(imported.tallies.kahua.stoodOff, "the stage holds the bundle's own body, so nothing stands off").toEqual([]);
    expect(imported.tallies.kahua.already).toBe(1);
  });

  test("W4 — RED: a lay whose share landing moved nothing says nothing of shares; CONTROL: a landing that moved a grant, seated a face or left one pending says so", async () => {
    clearOld();
    put("projections/wikis/notes/ha.ka.ba/notes/page.tid", tid("lar:///ha.ka.ba/notes/page", "a page"));
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }], "grant", R0);
    v.held.add("notes"); v.seats.set("notes", new Set([R0]));
    v.shareRows = [{ slug: "notes", kind: "wiki", read: "", write: "engineer", owner: "steward" }];
    const landing = (answer: Record<string, unknown>): MirrorDoors => ({ ...v.mirrorDoors(), landShares: async () => answer });
    const quiet = await seedMirrors({ apply: true, doors: landing({ granted: 2, moved: 0, carried: 2, pending: 0, workbenches: [{ slug: "notes", members: 2, founded: false, seated: 0, removed: [] }] }) });
    await seedMirrors({ apply: true, doors: landing({ granted: 2, moved: 0, carried: 2, pending: 0, workbenches: [{ slug: "notes", members: 2, founded: false, seated: 0, removed: [] }] }) });
    const second = await seedMirrors({ apply: true, doors: landing({ granted: 2, moved: 0, carried: 2, pending: 0, workbenches: [{ slug: "notes", members: 2, founded: false, seated: 0, removed: [] }] }) });
    expect(quiet.shares?.moved).toBe(0);
    expect(mirrorLines(second).out.join("\n"), "a second lay lands and says nothing").not.toMatch(/shares:/);
    const moved = await seedMirrors({ apply: true, doors: landing({ granted: 2, moved: 1, carried: 1, pending: 0, workbenches: [{ slug: "notes", members: 2, founded: false, seated: 1, removed: [] }] }) });
    expect(mirrorLines(moved).out.join("\n")).toMatch(/shares: landed 1 grant\(s\) \(1 reach their grantee at that face's next wear\); workbench seats: notes \(2 member face\(s\), 1 seated now\)/);
    const pending = await seedMirrors({ apply: true, doors: landing({ granted: 0, moved: 0, carried: 0, pending: 1, workbenches: [] }) });
    expect(mirrorLines(pending).out.join("\n")).toMatch(/shares: landed 0 grant\(s\); 1 wait for a shut face/);
  });

  test("W5 — RED: an import accounts for every bundle row: a personal row and a kahua head of an open, unworn face count as waiting and name their face, and no lift reaches the vessel for them; CONTROL: at that face's own wear both land, and a second import lands and waits on nothing", async () => {
    clearOld();
    put(FR("engineer", "margins/lares/ha.ka.ba/lares/ref/RW-REHEARSAL.tid"), tid(MARGIN, "what the engineer kept for itself"));
    put(FR("engineer", "stage/ha.ka.ba/kahua/memory/wren.tid"), kahuaTid(WREN, "remember the wren\n"));
    const old = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: G0 }, { handleIndex: 1, petname: "engineer", relation: G1 }], "old-grant", G0);
    old.held.add("lares");
    old.stage.set(1, [{ title: WREN, cid: sha("old-wren"), text: "remember the wren\n", fields: {}, taint: [], sources: [] }]);
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    expect(manifest.counts.personal).toBe(1);
    rmSync(P("faces/engineer"), { recursive: true });
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "new-grant", R0);
    v.held.add("lares");
    const doors = (): BundleDoors => ({ ...v.bundleDoors(), kahuaLift: liftsAsWornAlone(v) });
    const first = await houseImport(out, { apply: true, doors: doors() });
    expect(first.tallies.personal).toMatchObject({ landed: 0, already: 0, waiting: 1 });
    expect(first.tallies.kahua).toMatchObject({ landed: 0, waiting: 1, refused: [], stoodOff: [] });
    expect(first.kahuaWaiting).toEqual([{ petname: "engineer", handleIndex: 1, heads: 1 }]);
    expect(v.lifts).toEqual([]);
    v.wear(R1);
    const second = await houseImport(out, { apply: true, doors: doors() });
    expect(second.tallies.personal).toMatchObject({ landed: 1, waiting: 0 });
    expect(second.tallies.kahua).toMatchObject({ landed: 1, waiting: 0 });
    expect(v.lifts.map((l) => [l.face, l.text])).toEqual([[1, "remember the wren\n"]]);
    const third = await houseImport(out, { apply: true, doors: doors() });
    expect(Object.values(third.tallies).reduce((n, t) => n + t.landed + t.planned + t.waiting, 0)).toBe(0);
  });

  test("W6 — RED: an export names each wiki that stands cold, since a put a face made into a cold wiki rides no mirror and so no bundle; CONTROL: with every wiki awake the export names none", async () => {
    clearOld();
    const old = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: G0 }], "old-grant", G0);
    const cold = await houseExport(out, { acceptOmissions: false, doors: { ...old.bundleDoors(), coldWikis: async () => ["notes"] } });
    const named = cold.manifest.omissions.find((o) => o.kind === "cold-wikis");
    expect(named?.items).toEqual(["notes"]);
    expect(named?.detail).toMatch(/lares wiki hold <slug>/);
    rmSync(out, { recursive: true });
    const awake = await houseExport(out, { acceptOmissions: false, doors: { ...old.bundleDoors(), coldWikis: async () => [] } });
    expect(awake.manifest.omissions.map((o) => o.kind)).not.toContain("cold-wikis");
  });

  test("W7 — a shared wiki mints from its share row at its owner's wear though no page of it reached a mirror, and a face's margin of it waits by name for that mint; CONTROL: once the owner's wear stood the wiki, the margin lays at its own face's wear", async () => {
    clearOld();
    const PAGE = "lar:///ha.ka.ba/notes/margin";
    put(FR("engineer", "margins/notes/ha.ka.ba/notes/margin.tid"), tid(PAGE, "the engineer's page in a wiki it woke late"));
    writeFaceLabels([{ relation: G0, petname: "steward", handleIndex: 0 }, { relation: G1, petname: "engineer", handleIndex: 1 }], join(root, "projections"));
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "grant", R1);
    v.shareRows = [{ slug: "notes", kind: "wiki", read: "engineer", write: "", owner: "steward" }];
    const first = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.mints, "a wiki another face owns mints at that face's wear").toEqual([]);
    expect(first.benchWaiting.map((w) => [w.slug, w.why, w.owner])).toEqual([["notes", "owner", "steward"]]);
    expect(v.personalOf(R1, "notes").size).toBe(0);
    expect(mirrorsLeftWork(first)).toBe(false);
    v.wear(R0);
    await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.wikiMints, "the share row alone mints the wiki, through the wiki door").toEqual(["notes"]);
    v.wear(R1);
    const third = await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    expect(v.personalOf(R1, "notes").get(PAGE)?.text).toBe(tid(PAGE, "the engineer's page in a wiki it woke late"));
    expect(third.benchWaiting).toEqual([]);
  });

  /** The island's whole-wave answers, as a live vessel gives them: a face-named wave for an open face the vessel does not wear
   *  draws `document-unavailable` (a lit sibling's daemon layer opens at its own wear), or `refusal` where one is named, and an
   *  in-wiki wave for a wiki the vessel holds no bag of draws `wiki-mount-refused: no-such-bag`. The live door FOLDS the answer
   *  into one refused row per candidate (`foldWaveRefusal`); `shape: "throw"` stands a door that throws it instead. */
  const liveIngest = (v: FakeHouse, refusal: string | null = null, shape: "fold" | "throw" = "fold"): BundleDoors["ingest"] => async (wave) => {
    const whole = wave.face !== undefined && v.faces.find((f) => f.handleIndex === wave.face)?.relation !== v.worn
      ? refusal ?? "[document-unavailable] lar:///ha.ka.ba/wikis/daemon/working (a lit face's own layer) unavailable: doc automerge:35dAufh4 was reported unavailable by every reachable peer; make the document reachable from a peer, then restart."
      : wave.inWiki === true && wave.wiki !== undefined && !v.held.has(wave.wiki) ? `wiki-mount-refused: no-such-bag lar:///ha.ka.ba/bags/${wave.wiki}` : null;
    if (whole === null) return v.bundleDoors().ingest(wave);
    if (shape === "throw") throw new Error(whole);
    return { landed: [], unanswered: [], conflicts: [], kapaeRaised: [], ...foldWaveRefusal(whole, wave.candidates, wave.kapae) };
  };

  test("W8 — RED: an import's face-named wave the island refuses WHOLE with `document-unavailable` (a lit face's own layer), whether the live door folds it into rows or a door throws it, waits by name: nothing lands, no restored file stays in that face's mirror, and the face's own wear lands every row; CONTROL: a whole-wave throw that names no wait still rejects and strands no file", async () => {
    clearOld();
    put(FR("engineer", "wiki/ha.ka.ba/notes/engineer-own.tid"), tid(NOTE, "the engineer's own memory"));
    const old = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: G0 }, { handleIndex: 1, petname: "engineer", relation: G1 }], "old-grant", G0);
    await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    rmSync(P("faces/engineer"), { recursive: true });
    const restored = P("faces/engineer/wiki/ha.ka.ba/notes/engineer-own.tid");
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "new-grant", R0);
    await expect(houseImport(out, { apply: true, doors: { ...v.bundleDoors(), ingest: liveIngest(v, "cap-denied: write on the layer required", "throw") } }),
      "CONTROL: a whole-wave throw that names no wait still rejects").rejects.toThrow(/cap-denied/);
    expect(existsSync(restored), "CONTROL: the thrown wave leaves no restored file behind").toBe(false);
    const named = await houseImport(out, { apply: true, doors: { ...v.bundleDoors(), ingest: liveIngest(v, "cap-denied: write on the layer required") } });
    expect(named.tallies.working.refused, "CONTROL: the live door's folded refusal stands named row by row").toEqual([`${NOTE} (cap-denied: write on the layer required)`]);
    expect(named.daemonWaiting).toEqual([]);
    expect(existsSync(restored), "CONTROL: a refused row's restored file leaves the mirror").toBe(false);
    for (const shape of ["fold", "throw"] as const) {
      const first = await houseImport(out, { apply: true, doors: { ...v.bundleDoors(), ingest: liveIngest(v, null, shape) } });
      expect(first.daemonWaiting, shape).toEqual([{ petname: "engineer", handleIndex: 1 }]);
      expect(first.tallies.working, shape).toMatchObject({ landed: 0, waiting: 1, refused: [], stoodOff: [] });
      expect(v.workingOf(R1).size).toBe(0);
      expect(existsSync(restored), `${shape}: a waiting wave's restored file leaves the mirror again`).toBe(false);
    }
    v.wear(R1);
    const second = await houseImport(out, { apply: true, doors: { ...v.bundleDoors(), ingest: liveIngest(v) } });
    expect(second.daemonWaiting).toEqual([]);
    expect(second.tallies.working).toMatchObject({ landed: 1, waiting: 0, refused: [] });
    expect(v.workingOf(R1).get(NOTE)?.text).toBe(tid(NOTE, "the engineer's own memory"));
    expect(existsSync(restored), "a landed row's file stands in its mirror").toBe(true);
  });

  test("W9 — RED: an import's margin of a wiki no face minted (its share row names another face as owner) waits by name at its own face's wear, and never mounts the unminted wiki; CONTROL: once the owner's wear minted the wiki, the margin lands at its own face's wear", async () => {
    clearOld();
    const PAGE = "lar:///ha.ka.ba/notes/margin";
    put(FR("engineer", "margins/notes/ha.ka.ba/notes/margin.tid"), tid(PAGE, "the engineer's margin of the steward's wiki"));
    const old = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: G0 }, { handleIndex: 1, petname: "engineer", relation: G1 }], "old-grant", G1);
    old.held.add("notes");
    old.shareRows = [{ slug: "notes", kind: "wiki", read: "engineer", write: "", owner: "steward" }];
    // The live export names each user wiki the vessel holds (`list-wikis`), so the bundle re-declares `notes` though no page of its workbench travels.
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: { ...old.bundleDoors(), userWikis: async () => ["notes"] } });
    expect(manifest.counts.personal).toBe(1);
    rmSync(P("faces/engineer"), { recursive: true });
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "new-grant", R1);
    const doors = (): BundleDoors => ({ ...v.bundleDoors(), ingest: liveIngest(v) });
    const first = await houseImport(out, { apply: true, doors: doors() });
    expect(v.mints, "the steward's wiki mints at the steward's wear").toEqual([]);
    expect(first.personalWaiting).toEqual([{ petname: "engineer", handleIndex: 1, wiki: "notes", owner: "steward" }]);
    expect(first.tallies.personal).toMatchObject({ landed: 0, waiting: 1, refused: [] });
    expect(existsSync(P("faces/engineer/margins/notes")), "a waiting margin restores nothing into the mirror").toBe(false);
    v.wear(R0);
    await houseImport(out, { apply: true, doors: doors() });
    expect(v.wikiMints).toEqual(["notes"]);
    v.wear(R1);
    const third = await houseImport(out, { apply: true, doors: doors() });
    expect(third.personalWaiting).toEqual([]);
    expect(third.tallies.personal).toMatchObject({ landed: 1, waiting: 0 });
    expect(v.personalOf(R1, "notes").get(PAGE)?.text).toBe(tid(PAGE, "the engineer's margin of the steward's wiki"));
  });

  test("W10 — RED: the share rows an import carries reach the standing vessel's control document, owner by pet-name, before the owner's wear lands the shares (the vessel reconciles config/share.tid only at its boot), so that landing carries the wiki's catalog row to the reader's half and the reader's margin lands at its own wear; CONTROL: a second import finds the rows in the file and sets none again", async () => {
    clearOld();
    const PAGE = "lar:///ha.ka.ba/notes/margin";
    const ROW: ShareEntry = { slug: "notes", kind: "wiki", read: "engineer", write: "", owner: "steward" };
    put(FR("engineer", "margins/notes/ha.ka.ba/notes/margin.tid"), tid(PAGE, "the engineer's margin of the steward's wiki"));
    const old = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: G0 }, { handleIndex: 1, petname: "engineer", relation: G1 }], "old-grant", G1);
    old.held.add("notes");
    old.shareRows = [{ ...ROW }];
    await houseExport(out, { acceptOmissions: false, doors: { ...old.bundleDoors(), userWikis: async () => ["notes"] } });
    rmSync(P("faces/engineer"), { recursive: true });
    const v = new FakeHouse([{ handleIndex: 0, petname: "steward", relation: R0 }, { handleIndex: 1, petname: "engineer", relation: R1 }], "new-grant", R0);
    // The vessel's own law, as a walked hearth answers it: share-apply reads the CONTROL document (never the file), a face's
    // catalog half names a wiki its own wear minted or a landing under its owner's wear carried to it (lifted at that face's
    // next wear), and a margin's in-wiki mount reads the worn face's half alone, refusing `no-such-bag` where it names none.
    const control: ShareEntry[] = [];
    const halves = new Map<string, Set<string>>(), carried = new Map<string, Set<string>>();
    const half = (rel: string, of = halves): Set<string> => of.get(rel) ?? of.set(rel, new Set()).get(rel)!;
    const relOf = (pet: string | undefined): string | null => v.faces.find((f) => f.petname === pet)?.relation ?? null;
    const atLanding: ShareEntry[][] = [];
    let sets = 0;
    const wear = (rel: string): void => { v.wear(rel); for (const slug of half(rel, carried)) half(rel).add(slug); carried.delete(rel); };
    const doors = (): BundleDoors => {
      const base = v.bundleDoors();
      return {
        ...base,
        mintWiki: async (slug) => { await base.mintWiki!(slug); half(v.worn).add(slug); },
        ingest: async (wave) => wave.inWiki === true && wave.wiki !== undefined && v.held.has(wave.wiki) && !half(v.worn).has(wave.wiki)
          ? { landed: [], unanswered: [], conflicts: [], kapaeRaised: [], ...foldWaveRefusal(`wiki-mount-refused: no-such-bag lar:///ha.ka.ba/bags/${wave.wiki}`, wave.candidates, wave.kapae) }
          : liveIngest(v)(wave),
        shareSet: async (row) => { sets++; control.splice(0, control.length, ...control.filter((r) => r.slug !== row.slug), { ...row }); },
        landShares: async () => {
          atLanding.push(control.map((r) => ({ ...r })));
          let granted = 0;
          for (const r of control) {
            if (r.kind !== "wiki" || relOf(r.owner) !== v.worn || !half(v.worn).has(r.slug)) continue;
            for (const pet of `${r.read} ${r.write}`.split(/\s+/).filter((x) => x && x !== r.owner)) {
              const rel = relOf(pet);
              if (rel !== null) { half(rel, carried).add(r.slug); granted++; }
            }
          }
          return { granted, carried: granted, pending: 0, workbenches: [] };
        },
      };
    };
    const first = await houseImport(out, { apply: true, doors: doors() });
    expect(v.wikiMints, "the steward's wiki mints at the steward's wear").toEqual(["notes"]);
    expect(v.shareRows, "the row rests in the vessel-private file").toEqual([ROW]);
    expect(atLanding[0], "the owner's landing read no row: the carried row rested in the file alone").toEqual([ROW]);
    expect(first.warnings.filter((w) => w.startsWith("carry-share-unset"))).toEqual([]);
    wear(R1);
    const second = await houseImport(out, { apply: true, doors: doors() });
    expect(sets, "CONTROL: a row the file already held sets again").toBe(1);
    expect(second.tallies.personal, "the reader's margin mounts the wiki its half now names").toMatchObject({ landed: 1, waiting: 0, refused: [] });
    expect(v.personalOf(R1, "notes").get(PAGE)?.text).toBe(tid(PAGE, "the engineer's margin of the steward's wiki"));
  });
});

// ── P1, THE FACE ROOT (face-pools #/shape): one working tree per face, keyed by pet name ──────────────────────────
//
//   FR1 a re-found keeps the SAME folder: the re-minted face under the same pet name lays `faces/<pet name>/` where it stands:
//       no adoption copy, no `ashes/` move, no relation-keyed folder written
//   FR2 a folder whose pet name no standing face carries refuses by name and lands nothing; nothing moves to ashes
//   FR3 `moveFaceToAshes` serves only a face whose pet name no standing face carries
//   FR4 export reads every face plane off `faces/<pet name>/` (drafts from `recovery/<slug>`), and import lands them back there
//   FR5 no index file ever rests under `faces/`, and no two faces share a root
//   FR6 a face rename moves its folder
//   FR7 the ingest's reverse siting reads a face plane and a margin under `faces/`
describe("P1 — the face root, keyed by pet name", () => {
  const FACE = "hearth-one";
  /** The face's pool as the projector lays it now: every plane under `faces/<pet name>/`. */
  const poolDisk = (): void => {
    rmSync(join(root, "projections"), { recursive: true, force: true });
    put(`projections/faces/${FACE}/canon/ha.ka.ba/notes/pond.tid`, POND_CANON);
    put(`projections/faces/${FACE}/wiki/ha.ka.ba/notes/pond.tid`, POND_WORKING);
    put(`projections/faces/${FACE}/wiki/ha.ka.ba/kahua/memory/heron.tid`, tid(HERON, "remember the heron"));
    put(`projections/faces/${FACE}/wiki/My Notes.tid`, tid("My Notes", "a plain-title working tiddler"));
    put(`projections/faces/${FACE}/margins/notes/Aside.tid`, tid("Aside", "a margin over the notes wiki"));
    put(`projections/faces/${FACE}/recovery/notes/draft-one.tid`, tid("draft one", "half a thought"));
  };
  const snapshot = (dir: string): string[] => mirrorFiles(dir).sort();

  test("FR1 — RED: a re-found keeps the same folder: no adoption copy, no ashes, no relation-keyed folder", async () => {
    poolDisk();
    const old = new FakeHouse([{ handleIndex: 0, petname: FACE, relation: F1 }], "old-grant", F1);
    old.held.add("notes");
    await seedMirrors({ apply: true, doors: old.mirrorDoors() });
    expect(old.live(WORKING, POND)?.text).toBe(POND_WORKING);
    expect(old.live(WORKING, "My Notes")?.text).toBe(tid("My Notes", "a plain-title working tiddler"));
    expect(old.live(daemonFaceCanonBag(F1), POND)?.text).toBe(POND_CANON);
    const before = snapshot(P(`faces/${FACE}`));

    const after = refound([{ handleIndex: 0, petname: FACE, relation: F2 }]);
    after.held.add("notes");
    const seeded = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(seeded.refusals).toEqual([]);
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
    expect(after.live(WORKING, "My Notes")?.text).toBe(tid("My Notes", "a plain-title working tiddler"));
    expect(after.live(daemonFaceCanonBag(F2), POND)?.text).toBe(POND_CANON);
    expect(after.personalOf(F2, "notes").get("Aside")?.text).toBe(tid("Aside", "a margin over the notes wiki"));
    // Every wave read the face's one root; nothing copied, nothing moved, no relation-keyed folder stands.
    for (const s of after.laid) if (s.includes(`${sep}faces${sep}`)) expect(s.startsWith(P(`faces/${FACE}`))).toBe(true);
    expect(snapshot(P(`faces/${FACE}`))).toEqual(before);
    expect(existsSync(P("ashes"))).toBe(false);
    for (const gone of [`wikis/daemon-${F1}`, `wikis/daemon-${F2}`, `bags/daemon-${F2}`, `bags/kahua-${F2}`, `personal/${F2}`]) expect(existsSync(P(gone)), gone).toBe(false);
    // A second lay lands nothing.
    const again = await seedMirrors({ apply: true, doors: after.mirrorDoors() });
    expect(again.layers.reduce((n, t) => n + t.landed + t.kapae, 0)).toBe(0);
  });

  test("FR2 — RED: a folder whose pet name no face carries refuses by name, lands nothing, and stays where it stands", async () => {
    poolDisk();
    const stranger = refound([{ handleIndex: 0, petname: "someone-else", relation: F2 }]);
    const r = await seedMirrors({ apply: true, doors: stranger.mirrorDoors() });
    expect(r.refusals.map((x) => x.code)).toEqual(["seed-face-unmatched"]);
    expect(r.refusals[0]!.message).toContain(FACE);
    expect(stranger.live(WORKING, POND)).toBeUndefined();
    expect(stranger.laid.some((s) => s.startsWith(P(`faces/${FACE}`)))).toBe(false);
    expect(existsSync(P(`faces/${FACE}/wiki/ha.ka.ba/notes/pond.tid`))).toBe(true);
    expect(existsSync(P("ashes"))).toBe(false);
  });

  test("FR3 — RED: moveFaceToAshes refuses a standing pet name and moves a burned one", () => {
    poolDisk();
    const projections = join(root, "projections");
    expect(moveFaceToAshes(projections, FACE, [FACE])).toMatchObject({ left: expect.stringMatching(/stands/) });
    expect(existsSync(P(`faces/${FACE}`))).toBe(true);
    const moved = moveFaceToAshes(projections, FACE, ["someone-else"]);
    expect(moved).toMatchObject({ segment: FACE });
    expect(existsSync(P(`faces/${FACE}`))).toBe(false);
    expect(existsSync(P(`ashes/${FACE}/wiki/ha.ka.ba/notes/pond.tid`))).toBe(true);
  });

  test("FR4 — RED: export reads each plane off the face root, and import lands each back there", async () => {
    poolDisk();
    const old = new FakeHouse([{ handleIndex: 0, petname: FACE, relation: F1 }], "old-grant", F1);
    old.held.add("notes");
    await seedMirrors({ apply: true, doors: old.mirrorDoors() });
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: old.bundleDoors() });
    const rowOf = (layer: string, title: string | null) => manifest.rows.find((r) => r.layer === layer && (title === null || r.title === title));
    expect(rowOf("working", POND)).toMatchObject({ face: FACE });
    expect(rowOf("daemon-canon", POND)).toMatchObject({ face: FACE });
    expect(rowOf("personal", "Aside")).toMatchObject({ face: FACE });
    expect(rowOf("draft", null)).toMatchObject({ face: FACE, bag: wikiSlotUri("notes", "draft") });
    rmSync(join(root, "projections"), { recursive: true, force: true });
    const after = refound([{ handleIndex: 0, petname: FACE, relation: F2 }]);
    after.held.add("notes");
    const imported = await houseImport(out, { apply: true, doors: after.bundleDoors() });
    expect(Object.values(imported.tallies).every((t) => t.stoodOff.length === 0 && t.refused.length === 0)).toBe(true);
    expect(after.live(WORKING, POND)?.text).toBe(POND_WORKING);
    expect(readFileSync(P(`faces/${FACE}/wiki/ha.ka.ba/notes/pond.tid`), "utf8")).toBe(POND_WORKING);
    expect(readFileSync(P(`faces/${FACE}/recovery/notes/draft-one.tid`), "utf8")).toBe(tid("draft one", "half a thought"));
    expect(existsSync(P("wikis/notes/recovery"))).toBe(false);
  });

  test("FR5 — RED: no index file rests under faces/, and two faces never share a root", async () => {
    poolDisk();
    put("projections/faces/Egret/wiki/Shell.tid", tid("Shell", "egret's own"));
    const v = new FakeHouse([{ handleIndex: 0, petname: FACE, relation: F1 }, { handleIndex: 1, petname: "Egret", relation: F2 }], "grant", F1);
    v.held.add("notes");
    await seedMirrors({ apply: true, doors: v.mirrorDoors() });
    writeFaceLabels(v.facesNow(), join(root, "projections"));
    await houseExport(out, { acceptOmissions: false, doors: v.bundleDoors() });
    const walk = (dir: string): string[] => { try { return readdirSync(dir, { recursive: true }).map(String); } catch { return []; } };
    for (const rel of walk(P("faces"))) expect(rel, rel).not.toMatch(/(^|[\\/])(face-labels|kahua-index\.toml|share\.tid|kahua-pending\.json)([\\/]|$)/);
    expect(v.workingOf(F2).get("Shell")?.text).toBe(tid("Shell", "egret's own"));
    expect(v.workingOf(F1).get("Shell")).toBeUndefined();
    // A face whose pet name case-folds onto another face's refuses by name: two faces never share one root.
    const twins = new FakeHouse([{ handleIndex: 0, petname: FACE, relation: F1 }, { handleIndex: 1, petname: FACE.toUpperCase(), relation: F2 }], "grant", F1);
    const r = await seedMirrors({ apply: true, doors: twins.mirrorDoors() });
    expect(r.refusals.map((x) => x.code)).toContain("face-segment-collision");
  });

  test("FR6 — RED: a face rename moves its folder", async () => {
    poolDisk();
    const projections = join(root, "projections");
    writeFaceLabels([{ relation: F1, petname: FACE, handleIndex: 0 }], projections);
    await labelFaceAtNaming({ handleIndex: 0, petname: "Night Heron", relation: F1, formerPetname: FACE }, async () => F1, projections);
    expect(existsSync(P(`faces/${FACE}`))).toBe(false);
    expect(readFileSync(P("faces/Night Heron/wiki/ha.ka.ba/notes/pond.tid"), "utf8")).toBe(POND_WORKING);
    expect(readFaceLabel(F1, projections)?.petname).toBe("Night Heron");
  });

  test("FR7 — RED: the ingest's reverse siting reads a face plane and a margin under faces/", () => {
    poolDisk();
    const projections = join(root, "projections");
    const dirs = { bags: join(root, "bags"), wikis: join(root, "wikis"), projections };
    const read = (source: string, file: string) => fileToUriForSource(root, source, dirs)(root, file);
    expect(read(P(`faces/${FACE}/wiki`), P(`faces/${FACE}/wiki/My Notes.tid`))).toBe("My Notes");
    expect(read(P(`faces/${FACE}/wiki`), P(`faces/${FACE}/wiki/ha.ka.ba/notes/pond.tid`))).toBe(POND);
    expect(read(P(`faces/${FACE}/canon`), P(`faces/${FACE}/canon/ha.ka.ba/notes/pond.tid`))).toBe(POND);
    expect(read(P(`faces/${FACE}/margins/notes`), P(`faces/${FACE}/margins/notes/Aside.tid`))).toBe("Aside");
  });
});
