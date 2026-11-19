/**
 * keep-seal — the keep bundle seals its roster (cabal-realm.mem:189; research/tideline-surface #/roster, #/ward-scope).
 *
 * A remote the keep pushes to crosses to another vessel, so the bundle a keep cuts carries no linked roster of one human's faces
 * in clear: no pet-name, no Handle, no chair, no handle index and no share owner or seat, in any file or any path.
 *
 *   KS1  RED: a cut bundle holds no face's pet-name, Handle or chair label, and no share row's owner or seats, in any byte or
 *        any path; the manifest's faces carry their path key alone and its rows name a face by that key; no path carries a
 *        `.git/` a mirror held. CONTROL: the content a person wrote reads in clear, and the house that cut it opens the roster
 *        again: the import maps each pet-name to its face and the share rows travel.
 *   KS2  RED: an import with no route to open the bundle's keep seat (no terminal, no staged root) refuses by name before anything
 *        moves; the bundle carries no loose key, so nothing else opens its roster.
 *   KS3  a re-cut of an unmoved house names the same bundle (the seat keeps its last seal, so an unmoved keep spends nothing).
 *   KS4  RED: no face RELATION and no handle index rides the bundle in clear: a face's canon plane, its kahua heads, a census
 *        that names held saves and carriers by bag and document, a face whose stage would not read, and a legacy `daemon-<F>`
 *        folder in the wikis and bags mirrors all stand in the house, and no byte or path of the bundle names F, and no
 *        omission names `h<N>`. CONTROL: each omission still names its kind and count, and the canon row travels under its key.
 */
import { plantKeptSeat } from "./support/kept-seat.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ShareEntry } from "@lararium/mesh";
import { houseExport, houseImport, type BundleDoors, type BundleVesselFace } from "../src/commands/house-bundle.js";
import { walkBundle, bundleBytes, MANIFEST_FILE } from "../src/bundle-manifest.js";

// A restore opens the keep seat at the remote cost (`support/kept-seat.ts`): a case takes seconds, not milliseconds.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const F1 = "11111111-1111-4111-8111-111111111111";
const F2 = "22222222-2222-4222-8222-222222222222";
const G1 = "33333333-3333-4333-8333-333333333333";
const G2 = "44444444-4444-4444-8444-444444444444";
/** Every string that would join the two faces into one human's roster. */
const ROSTER = ["otter-face", "kestrel-face", "Otterhandle", "Kestrelhandle", "north-chair"];

let root: string, out: string;
const put = (rel: string, text: string): void => { const p = join(root, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const tid = (title: string, text: string): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${text}\n`;

function doors(faces: BundleVesselFace[], shares: ShareEntry[]): BundleDoors & { written: ShareEntry[][] } {
  const written: ShareEntry[][] = [];
  return {
    written,
    census: async () => ({ clean: true, items: [], unanswered: [] }),
    faces: async () => faces,
    tempConsented: () => [],
    rename: async () => {}, declareHandle: async () => {}, standSeat: async () => {},
    heldSlugs: async () => new Set(["notes"]),
    mintBag: async () => {},
    ingest: async (wave) => ({ landed: wave.candidates.map((c) => c.uri), conflicts: [], refused: [], unanswered: [], kapaeRaised: [...wave.kapae], kapaeRefused: [] }),
    kahuaLift: async () => ({ cid: "c".repeat(64) }),
    shareRows: { read: () => (written.at(-1) ?? shares), write: (rows) => { written.push([...rows]); } },
  };
}

const oldFaces = (): BundleVesselFace[] => [
  { handleIndex: 0, petname: "otter-face", relation: F1, handle: "Otterhandle", seat: true, chair: "north-chair", kahua: [] },
  { handleIndex: 1, petname: "kestrel-face", relation: F2, handle: "Kestrelhandle", seat: false, chair: null, kahua: [] },
];
const SHARES: ShareEntry[] = [{ slug: "notes", kind: "wiki", read: "kestrel-face", write: "otter-face", owner: "otter-face" } as ShareEntry];

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lar-keep-seal-"));
  writeFileSync(join(root, ".lar-test-scratch"), "keep seal suite\n");
  process.env["LAR_ROOT"] = root;
  await plantKeptSeat(root);
  out = join(mkdtempSync(join(tmpdir(), "lar-keep-seal-out-")), "bundle");
  put("projections/faces/otter-face/wiki/ha.ka.ba/notes/pond.tid", tid("lar:///ha.ka.ba/notes/pond", "the pond at dusk"));
  put("projections/faces/kestrel-face/wiki/ha.ka.ba/notes/reed.tid", tid("lar:///ha.ka.ba/notes/reed", "a reed bends"));
  // A repo someone made inside a mirror: its config names a person, and the house never held a byte of it.
  put("projections/faces/otter-face/wiki/.git/config", "[user]\n\tname = otter-face\n");
  put("projections/faces/otter-face/wiki/.git/HEAD", "ref: refs/heads/main\n");
  put("projections/wikis/notes/ha.ka.ba/notes/shared.tid", tid("lar:///ha.ka.ba/notes/shared", "a shared page"));
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); rmSync(dirname(out), { recursive: true, force: true }); delete process.env["LAR_ROOT"]; });

describe("the keep bundle seals its roster", () => {
  test("KS1 RED: no pet-name, Handle, chair or share owner rides the bundle in clear, in any byte or path, and no mirror's .git/ travels; CONTROL: the content reads in clear and the house opens the roster again", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const paths = walkBundle(out);
    for (const p of paths) {
      for (const segment of p.split("/")) expect(ROSTER, `the path ${p} names a face`).not.toContain(segment);
      expect(p.split("/"), `the path ${p} carries a mirror's .git/`).not.toContain(".git");
      const text = bundleBytes(out, p).toString("latin1");
      for (const name of ROSTER) expect(text.includes(name), `${p} carries "${name}" in clear`).toBe(false);
    }
    const manifest = JSON.parse(readFileSync(join(out, MANIFEST_FILE), "utf8")) as { faces: Array<Record<string, unknown>>; rows: Array<{ face: string | null }> };
    expect(manifest.faces).toEqual([{ key: "f0" }, { key: "f1" }]);
    expect(new Set(manifest.rows.map((r) => r.face))).toEqual(new Set(["f0", "f1", null]));
    expect(existsSync(join(out, "re-declare.json")), "the re-declare list rests sealed, never as plain JSON").toBe(false);
    // CONTROL: the content a person wrote travels as a plain file a person reads.
    expect(paths.some((p) => bundleBytes(out, p).toString("utf8").includes("the pond at dusk"))).toBe(true);
    // CONTROL: the staged root's route opens the seat the bundle carries, so its import opens the roster: each pet-name finds its face, the share rows land.
    const after = doors([
      { handleIndex: 0, petname: "otter-face", relation: G1, handle: null, seat: false, chair: null, kahua: [], mounted: true },
      { handleIndex: 1, petname: "kestrel-face", relation: G2, handle: null, seat: false, chair: null, kahua: [], mounted: false },
    ], []);
    const imported = await houseImport(out, { apply: false, doors: after });
    expect(imported.faceMap).toEqual({ "otter-face": 0, "kestrel-face": 1 });
    expect(imported.shares.written).toEqual(["notes"]);
  });

  test("KS2 RED: an import with no route to the bundle's keep seat refuses by name before anything moves", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    rmSync(join(root, "config"), { recursive: true, force: true });
    rmSync(join(root, ".lar-test-scratch"));
    const after = doors(oldFaces(), []);
    await expect(houseImport(out, { apply: true, doors: after })).rejects.toThrow(/keep-route-absent/);
    expect(after.written).toEqual([]);
  });

  test("KS3: a re-cut of an unmoved house names the same bundle", async () => {
    const a = await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const b = await houseExport(`${out}-again`, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    expect(b.manifest.bundleId).toBe(a.manifest.bundleId);
  });

  test("KS4 RED: no face relation and no handle index rides the bundle in clear", async () => {
    const RELATIONS = [F1, F2];
    put("projections/faces/otter-face/canon/ha.ka.ba/notes/canon-note.tid", tid("lar:///ha.ka.ba/notes/canon-note", "a canon note"));
    put(`projections/wikis/daemon-${F1}/ha.ka.ba/notes/old.tid`, tid("lar:///ha.ka.ba/notes/old", "a legacy mirror"));
    put(`projections/bags/daemon-${F2}/ha.ka.ba/notes/old.tid`, tid("lar:///ha.ka.ba/notes/old", "a legacy bag mirror"));
    const faces: BundleVesselFace[] = [
      { handleIndex: 0, petname: "otter-face", relation: F1, handle: "Otterhandle", seat: true, chair: "north-chair",
        kahua: [{ title: "lar:///ha.ka.ba/kahua/memory/heron", cid: "a".repeat(64), text: "remember the heron", fields: {}, taint: [], sources: [] }] },
      { handleIndex: 1, petname: "kestrel-face", relation: F2, handle: "Kestrelhandle", seat: false, chair: null, kahua: null,
        kahuaRefusal: `vessel-locked: face h1 (relation ${F2}) stands shut`, kahuaRefusalCode: "vessel-locked" },
    ];
    const census = {
      clean: false,
      items: [
        { kind: "held-save" as const, refusal: "sealed-rest-held", documentId: `doc-${F1}`, saves: 2, bagId: `lar:///ha.ka.ba/bags/daemon-${F1}` },
        { kind: "carrier" as const, state: "pending", uri: `lar:///ha.ka.ba/notes/pending-${F2}`, bagId: `lar:///ha.ka.ba/bags/daemon-${F2}`, island: "h1" },
      ],
      unanswered: [{ part: "face h1", why: `relation ${F2} answered nothing` }],
    };
    await houseExport(out, { acceptOmissions: true, doors: { ...doors(faces, SHARES), census: async () => census } });
    for (const p of walkBundle(out)) {
      for (const r of RELATIONS) expect(p.includes(r), `the path ${p} names a face relation`).toBe(false);
      const text = bundleBytes(out, p).toString("latin1");
      for (const r of RELATIONS) expect(text.includes(r), `${p} carries the face relation ${r} in clear`).toBe(false);
    }
    const manifest = JSON.parse(readFileSync(join(out, MANIFEST_FILE), "utf8")) as { omissions: Array<{ kind: string; detail: string; items?: string[]; count?: number }>; rows: Array<{ layer: string; face: string | null }> };
    for (const o of manifest.omissions) expect(`${o.detail} ${(o.items ?? []).join(" ")}`, `the omission ${o.kind} names a handle index`).not.toMatch(/\bh\d+\b/);
    // CONTROL: the omissions still name their kinds and counts, and the canon row travels under its face key.
    expect(manifest.omissions.map((o) => o.kind)).toEqual(expect.arrayContaining(["held-saves", "unsettled-carriers", "census-unanswered", "face-unread"]));
    expect(manifest.omissions.find((o) => o.kind === "held-saves")?.count).toBe(1);
    expect(manifest.rows.some((r) => r.layer === "daemon-canon" && r.face === "f0")).toBe(true);
  });
});
