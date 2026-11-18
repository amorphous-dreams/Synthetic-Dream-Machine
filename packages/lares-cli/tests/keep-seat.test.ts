/**
 * keep-seat — the keep bundle's roster seals to the keep pair's PUBLIC half; the secret half rests wrapped in a slot tree under
 * the human's own routes, and travels in the bundle beside the roster, so a restore needs a passphrase or a paper sheet and no file.
 *
 * The house mints no loose key: no plaintext keep secret rests anywhere on disk, in the house root or in the bundle. A cut asks
 * for no credential (it seals to the public half), so `down --if-due` and the session-end hook keep cutting. A restore opens a
 * slot with what the human supplies, then the roster.
 *
 *   KQ1  RED: after a seat and a cut, no file under the house root or the bundle holds the keep secret (raw, hex or base64), and
 *        no `config/keep-key` stands. CONTROL: the secret opens under the route, and the content a person wrote reads in clear.
 *   KQ2  RED: a cut with no credential seals (no marker, no terminal: any ask would refuse), and its roster opens under the route.
 *   KQ3  RED: a restore under a wrong passphrase refuses by name before anything moves; the right one opens the roster.
 *   KQ4  RED: a restore from the bundle alone onto a fresh house root (no config carried) opens with the passphrase.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Credential, ShareEntry } from "@lararium/mesh";
import { houseExport, houseImport, type BundleDoors, type BundleVesselFace } from "../src/commands/house-bundle.js";
import { MANIFEST_FILE } from "../src/bundle-manifest.js";
import { TEST_ROUTE_PASSPHRASE } from "../src/offline-custody.js";

vi.setConfig({ testTimeout: 60_000 });

const F1 = "11111111-1111-4111-8111-111111111111";
const F2 = "22222222-2222-4222-8222-222222222222";
const G1 = "33333333-3333-4333-8333-333333333333";
const G2 = "44444444-4444-4444-8444-444444444444";
const RIGHT: Credential[] = [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }];
const WRONG: Credential[] = [{ kind: "passphrase", passphrase: "not the route" }];

let root: string, out: string;
const put = (rel: string, text: string): void => { const p = join(root, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const tid = (title: string, text: string): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${text}\n`;

function doors(faces: BundleVesselFace[], shares: ShareEntry[], route?: readonly Credential[]): BundleDoors & { written: ShareEntry[][] } {
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
    ...(route !== undefined ? { keepRoute: async () => route } : {}),
  } as BundleDoors & { written: ShareEntry[][] };
}

const oldFaces = (): BundleVesselFace[] => [
  { handleIndex: 0, petname: "otter-face", relation: F1, handle: "Otterhandle", seat: true, chair: "north-chair", kahua: [] },
  { handleIndex: 1, petname: "kestrel-face", relation: F2, handle: "Kestrelhandle", seat: false, chair: null, kahua: [] },
];
const newFaces = (): BundleVesselFace[] => [
  { handleIndex: 0, petname: "otter-face", relation: G1, handle: null, seat: false, chair: null, kahua: [], mounted: true },
  { handleIndex: 1, petname: "kestrel-face", relation: G2, handle: null, seat: false, chair: null, kahua: [], mounted: false },
];
const SHARES: ShareEntry[] = [{ slug: "notes", kind: "wiki", read: "kestrel-face", write: "otter-face", owner: "otter-face" } as ShareEntry];

/** Every regular file under `dir`, recursively. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const outFiles: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) outFiles.push(...filesUnder(p));
    else if (st.isFile()) outFiles.push(p);
  }
  return outFiles;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-keep-seat-"));
  writeFileSync(join(root, ".lar-test-scratch"), "keep seat suite\n");
  process.env["LAR_ROOT"] = root;
  out = join(mkdtempSync(join(tmpdir(), "lar-keep-seat-out-")), "bundle");
  put(`projections/wikis/daemon-${F1}/ha.ka.ba/notes/pond.tid`, tid("lar:///ha.ka.ba/notes/pond", "the pond at dusk"));
  put(`projections/wikis/daemon-${F2}/ha.ka.ba/notes/reed.tid`, tid("lar:///ha.ka.ba/notes/reed", "a reed bends"));
  put("projections/wikis/notes/ha.ka.ba/notes/shared.tid", tid("lar:///ha.ka.ba/notes/shared", "a shared page"));
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); rmSync(dirname(out), { recursive: true, force: true }); delete process.env["LAR_ROOT"]; });

describe("the keep seals its roster to a pair whose secret rests under the human's routes", () => {
  test("KQ1 RED: no plaintext keep secret rests on disk, in the house or the bundle, and no config/keep-key stands; CONTROL: the secret opens and the content reads in clear", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    expect(existsSync(join(root, "config", "keep-key")), "the burned loose key file stands again").toBe(false);
    const { readKeepSeat, openKeepSeat } = await import("../src/keep-seat.js");
    const seat = readKeepSeat();
    expect(seat, "the cut found a seated keep pair").not.toBeNull();
    const opened = await openKeepSeat(seat!, RIGHT);
    expect(opened.reading, "CONTROL: the route opens the keep secret").toBe("opens");
    const secret = Buffer.from((opened as { secret: Uint8Array }).secret);
    const shapes = [secret.toString("hex"), secret.toString("base64"), secret.toString("base64url")];
    for (const file of [...filesUnder(root), ...filesUnder(out)]) {
      const bytes = readFileSync(file);
      expect(bytes.includes(secret), `${file} holds the keep secret raw`).toBe(false);
      const text = bytes.toString("latin1");
      for (const s of shapes) expect(text.includes(s), `${file} holds the keep secret in text`).toBe(false);
    }
    expect(filesUnder(out).some((f) => readFileSync(f, "utf8").includes("the pond at dusk")), "CONTROL: the content reads in clear").toBe(true);
  });

  test("KQ2 RED: once seated, a cut with no credential seals, and its roster opens under the route", async () => {
    await houseExport(`${out}-seat`, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    // NO MARKER, NO TERMINAL: any ask for a credential would refuse, so a cut that lands asked for none.
    rmSync(join(root, ".lar-test-scratch"));
    const cut = await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    expect(existsSync(join(out, "re-declare.sealed"))).toBe(true);
    expect(cut.manifest.faces.length).toBe(2);
    const imported = await houseImport(out, { apply: false, doors: doors(newFaces(), [], RIGHT) });
    expect(imported.faceMap).toEqual({ "otter-face": 0, "kestrel-face": 1 });
  });

  test("KQ3 RED: a wrong passphrase refuses by name before anything moves; CONTROL: the right one opens the roster", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const refused = doors(newFaces(), [], WRONG);
    await expect(houseImport(out, { apply: true, doors: refused })).rejects.toThrow(/keep-route-refused/);
    expect(refused.written).toEqual([]);
    const right = await houseImport(out, { apply: false, doors: doors(newFaces(), [], RIGHT) });
    expect(right.shares.written).toEqual(["notes"]);
  });

  test("KQ4 RED: a restore from the bundle alone onto a fresh house root, no config carried, opens with the passphrase", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const fresh = mkdtempSync(join(tmpdir(), "lar-keep-seat-fresh-"));
    try {
      process.env["LAR_ROOT"] = fresh;
      expect(existsSync(join(fresh, "config"))).toBe(false);
      const imported = await houseImport(out, { apply: false, doors: doors(newFaces(), [], RIGHT) });
      expect(imported.faceMap).toEqual({ "otter-face": 0, "kestrel-face": 1 });
      expect(JSON.parse(readFileSync(join(out, MANIFEST_FILE), "utf8")).faces).toEqual([{ key: "f0" }, { key: "f1" }]);
    } finally { rmSync(fresh, { recursive: true, force: true }); }
  });
});
