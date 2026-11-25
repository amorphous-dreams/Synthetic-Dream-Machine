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
 *   KQ3  RED: a restore under a wrong passphrase refuses by name before any door is touched (every door watched, the route's
 *        own aside) and seats nothing; the right one opens the roster.
 *   KQ4  RED: a restore from the bundle alone onto a fresh house root (no config carried) applies with the passphrase, and the
 *        fresh house seats the bundle's pair, so its next keep seals to the same pair.
 *   KQ5  RED: a restore that refuses after the roster opened (an unlaid canon) seats no pair: the adoption lands at the end of
 *        a whole apply alone.
 *   KQ6  RED: whoever writes the remote seals a roster of their own to the published public half and re-hashes the manifest:
 *        the restore refuses by name (`keep-roster-unsigned`) before any door is touched. CONTROL: the house's own cut restores.
 *   KQ7  RED: whoever writes the remote alters a row's override base in the manifest (a field outside every hashed file): the
 *        restore refuses by name before any door is touched, since the cut signs the whole manifest.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Credential } from "@lararium/mesh/keyslot-door";
import type { ShareEntry } from "@lararium/mesh/share-config";
import { houseExport, houseImport, type BundleDoors, type BundleVesselFace } from "../src/commands/house-bundle.js";
import { BUNDLE_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, bundleIdOf, sealRedeclare, sha256Hex, type BundleFile } from "../src/bundle-manifest.js";
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

/** Wrap every door so a call to any of them (the route's own door aside) lands in `calls`. */
function watched<T extends object>(d: T, calls: string[]): T {
  return new Proxy(d, { get(target, key, recv) {
    const v = Reflect.get(target, key, recv) as unknown;
    if (typeof v !== "function" || key === "keepRoute") return v;
    return (...a: unknown[]) => { calls.push(String(key)); return (v as (...x: unknown[]) => unknown).apply(target, a); };
  } });
}

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
  put("projections/faces/otter-face/wikis/daemon/ha.ka.ba/notes/pond.tid", tid("lar:///ha.ka.ba/notes/pond", "the pond at dusk"));
  put("projections/faces/kestrel-face/wikis/daemon/ha.ka.ba/notes/reed.tid", tid("lar:///ha.ka.ba/notes/reed", "a reed bends"));
  put("projections/realms/notes/wikis/notes/ha.ka.ba/notes/shared.tid", tid("lar:///ha.ka.ba/notes/shared", "a shared page"));
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
    // A REAL SEAT: a proved unlock seated the pair under the steward's own route (a test-route seat refuses on an unmarked root).
    const STEWARD: Credential[] = [{ kind: "passphrase", passphrase: "the steward's own long passphrase" }];
    const { seatKeepAtUnlock } = await import("../src/keep-seat.js");
    expect(await seatKeepAtUnlock({ reading: "opens", opener: [0] }, STEWARD, () => {})).toBe("seated");
    // NO MARKER, NO TERMINAL: any ask for a credential would refuse, so a cut that lands asked for none.
    rmSync(join(root, ".lar-test-scratch"));
    const cut = await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    expect(existsSync(join(out, "re-declare.sealed"))).toBe(true);
    expect(cut.manifest.faces.length).toBe(2);
    const imported = await houseImport(out, { apply: false, doors: doors(newFaces(), [], STEWARD) });
    expect(imported.faceMap).toEqual({ "otter-face": 0, "kestrel-face": 1 });
  });

  test("KQ3 RED: a wrong passphrase refuses by name before anything moves; CONTROL: the right one opens the roster", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const calls: string[] = [];
    rmSync(join(root, "config"), { recursive: true, force: true });
    const refused = doors(newFaces(), [], WRONG);
    await expect(houseImport(out, { apply: true, doors: watched(refused, calls) })).rejects.toThrow(/keep-route-refused/);
    expect(calls, "a refused route touches no door").toEqual([]);
    expect(refused.written).toEqual([]);
    expect(existsSync(join(root, "config", "keep-seat.json")), "a refused route seats no pair").toBe(false);
    const right = await houseImport(out, { apply: false, doors: doors(newFaces(), [], RIGHT) });
    expect(right.shares.written).toEqual(["notes"]);
  });

  test("KQ4 RED: a restore from the bundle alone onto a fresh house root, no config carried, opens with the passphrase", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const fresh = mkdtempSync(join(tmpdir(), "lar-keep-seat-fresh-"));
    try {
      process.env["LAR_ROOT"] = fresh;
      expect(existsSync(join(fresh, "config"))).toBe(false);
      const imported = await houseImport(out, { apply: true, doors: doors(newFaces(), [], RIGHT) });
      expect(imported.applied).toBe(true);
      expect(imported.faceMap).toEqual({ "otter-face": 0, "kestrel-face": 1 });
      expect(JSON.parse(readFileSync(join(out, MANIFEST_FILE), "utf8")).faces).toEqual([{ key: "f0" }, { key: "f1" }]);
      const seated = JSON.parse(readFileSync(join(fresh, "config", "keep-seat.json"), "utf8")) as { publicKey: string };
      const carried = JSON.parse(readFileSync(join(out, "keep-seat.json"), "utf8")) as { publicKey: string };
      expect(seated.publicKey, "the fresh house seats the pair the bundle carried").toBe(carried.publicKey);
    } finally { rmSync(fresh, { recursive: true, force: true }); }
  });

  test("KQ5 RED: a restore that refuses after the roster opened seats no pair", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const fresh = mkdtempSync(join(tmpdir(), "lar-keep-seat-fresh-"));
    try {
      process.env["LAR_ROOT"] = fresh;
      const unlaid = { ...doors(newFaces(), [], RIGHT), unseeded: () => ["lares"] };
      await expect(houseImport(out, { apply: true, doors: unlaid })).rejects.toThrow(/carry-canon-unseeded/);
      expect(existsSync(join(fresh, "config", "keep-seat.json")), "a refused apply seats no pair").toBe(false);
    } finally { rmSync(fresh, { recursive: true, force: true }); }
  });

  test("KQ6 RED: a roster forged to the published public half refuses by name before any door; CONTROL: the house's own cut restores", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const control = await houseImport(out, { apply: false, doors: doors(newFaces(), [], RIGHT) });
    expect(control.faceMap, "CONTROL: the house's own cut restores").toEqual({ "otter-face": 0, "kestrel-face": 1 });
    // THE FORGER holds the remote: it reads the public half the bundle publishes, seals a roster of its own text to it, and
    // re-hashes the manifest so the bundle proves whole.
    const carried = JSON.parse(readFileSync(join(out, "keep-seat.json"), "utf8")) as { publicKey: string };
    const forged = sealRedeclare(Uint8Array.from(Buffer.from(carried.publicKey, "hex")), {
      schema: BUNDLE_SCHEMA,
      faces: [{ face: "f0", handleIndex: 0, petname: "otter-face", handle: "Forgedhandle", seat: true, chair: "forged-chair" }, { face: "f1", handleIndex: 1, petname: "kestrel-face", handle: null, seat: false, chair: null }],
      shares: [{ slug: "notes", kind: "wiki", read: "", write: "otter-face", owner: "intruder" }],
    });
    writeFileSync(join(out, REDECLARE_FILE), forged);
    const manifest = JSON.parse(readFileSync(join(out, MANIFEST_FILE), "utf8")) as { bundleId: string; files: BundleFile[] };
    manifest.files = manifest.files.map((f) => (f.path === REDECLARE_FILE ? { path: f.path, sha256: sha256Hex(forged), bytes: forged.length } : f));
    manifest.bundleId = bundleIdOf(manifest.files);
    writeFileSync(join(out, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    const calls: string[] = [];
    const after = doors(newFaces(), [], RIGHT);
    await expect(houseImport(out, { apply: true, doors: watched(after, calls) })).rejects.toThrow(/keep-roster-unsigned/);
    expect(calls, "a forged roster touches no door").toEqual([]);
    expect(after.written).toEqual([]);
  });

  test("KQ7 RED: a manifest altered outside every hashed file refuses by name before any door", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors(oldFaces(), SHARES) });
    const manifest = JSON.parse(readFileSync(join(out, MANIFEST_FILE), "utf8")) as { rows: Array<{ layer: string; overrideBase?: string }> };
    const row = manifest.rows.find((r) => r.layer === "working");
    expect(row, "a working row stands to alter").toBeDefined();
    row!.overrideBase = `sha256:${"0".repeat(64)}`;
    writeFileSync(join(out, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    const calls: string[] = [];
    const after = doors(newFaces(), [], RIGHT);
    await expect(houseImport(out, { apply: true, doors: watched(after, calls) })).rejects.toThrow(/keep-roster-unsigned/);
    expect(calls, "an altered manifest touches no door").toEqual([]);
  });
});
