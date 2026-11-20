/**
 * keep-seat-test-route — the published test route seats a keep only where the house's own custody opens under it (or stands
 * absent), and a real proved unlock replaces a seat the test route made.
 *
 * The marker alone names a root a harness staged; a house a person founded under their own passphrase, marker or not, never
 * takes a keep seated under a passphrase the whole world reads.
 *
 *   KT1  RED: a marked root whose custody a real passphrase founded refuses the cut `keep-seat-absent`, and no seat rests.
 *   KT2  CONTROL: a marked root with no custody tree seats under the test route, and the cut lands.
 *   KT3  RED: a seat the test route made gives way to the first real proved unlock: the keep then opens under the real route.
 *   KT4  RED: a test-route seat resting on a root whose custody a real passphrase founded refuses the cut by name
 *        (`keep-seat-test-route`): the world's test passphrase opens that keep.
 *   KT5  RED: a restore that opened a bundle's seat under the test route, and adopts it, keeps the seat's test-route mark.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FsCustodyIo, foundCustody, vesselCustodyHomes } from "@lararium/node";
import type { Credential } from "@lararium/mesh";
import { houseExport, houseImport, type BundleDoors } from "../src/commands/house-bundle.js";
import { keepSeatPath, openKeepSeat, readKeepSeat, seatKeepAtUnlock } from "../src/keep-seat.js";
import { TEST_ROUTE_PASSPHRASE } from "../src/offline-custody.js";

vi.setConfig({ testTimeout: 180_000 });

const REAL: Credential[] = [{ kind: "passphrase", passphrase: "a person's own long passphrase" }];
const F1 = "11111111-1111-4111-8111-111111111111";
let root: string, out: string;

function doors(): BundleDoors {
  return {
    census: async () => ({ clean: true, items: [], unanswered: [] }),
    faces: async () => [{ handleIndex: 0, petname: "otter-face", relation: F1, handle: null, seat: false, chair: null, kahua: [] }],
    tempConsented: () => [],
    rename: async () => {}, declareHandle: async () => {}, standSeat: async () => {},
    heldSlugs: async () => new Set<string>(),
    mintBag: async () => {},
    ingest: async (wave) => ({ landed: wave.candidates.map((c) => c.uri), conflicts: [], refused: [], unanswered: [], kapaeRaised: [...wave.kapae], kapaeRefused: [] }),
    kahuaLift: async () => ({ cid: "c".repeat(64) }),
  } as BundleDoors;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-keep-test-route-"));
  writeFileSync(join(root, ".lar-test-scratch"), "keep test route suite\n");
  process.env["LAR_ROOT"] = root;
  out = join(mkdtempSync(join(tmpdir(), "lar-keep-test-route-out-")), "bundle");
  const p = join(root, "projections", "faces", "otter-face", "wikis", "daemon", "ha.ka.ba", "notes", "pond.tid");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, "title: lar:///ha.ka.ba/notes/pond\ntype: text/vnd.tiddlywiki\n\nthe pond\n");
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); rmSync(dirname(out), { recursive: true, force: true }); delete process.env["LAR_ROOT"]; });

describe("the test route seats a keep only over a test custody", () => {
  test("KT1 RED: a marked root founded under a real passphrase refuses the cut, and no seat rests", async () => {
    const homes = vesselCustodyHomes();
    await foundCustody({ io: new FsCustodyIo(homes), homes, slots: [{ t: 1, pins: [REAL[0] as { kind: "passphrase"; passphrase: string }] }] });
    await expect(houseExport(out, { acceptOmissions: true, doors: doors() })).rejects.toThrow(/keep-seat-absent/);
    expect(existsSync(keepSeatPath())).toBe(false);
  });

  test("KT2 CONTROL: a marked root with no custody tree seats under the test route", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors() });
    expect((await openKeepSeat(readKeepSeat()!, [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }])).reading).toBe("opens");
  });

  test("KT3 RED: a test-route seat gives way to the first real proved unlock", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors() });
    const said: string[] = [];
    expect(await seatKeepAtUnlock({ reading: "opens", opener: [0] }, REAL, (l) => said.push(l))).toBe("seated");
    expect((await openKeepSeat(readKeepSeat()!, REAL)).reading).toBe("opens");
    expect((await openKeepSeat(readKeepSeat()!, [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }])).reading).toBe("no-slot-opens");
  });

  test("KT4 RED: a test-route seat over a custody a real passphrase founded refuses the cut", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors() });
    const homes = vesselCustodyHomes();
    await foundCustody({ io: new FsCustodyIo(homes), homes, slots: [{ t: 1, pins: [REAL[0] as { kind: "passphrase"; passphrase: string }] }] });
    await expect(houseExport(`${out}-again`, { acceptOmissions: true, doors: doors() })).rejects.toThrow(/keep-seat-test-route/);
  });

  test("KT5 RED: adopting a bundle's seat opened under the test route keeps the test-route mark", async () => {
    await houseExport(out, { acceptOmissions: true, doors: doors() });
    const fresh = mkdtempSync(join(tmpdir(), "lar-keep-test-route-fresh-"));
    try {
      process.env["LAR_ROOT"] = fresh;
      writeFileSync(join(fresh, ".lar-test-scratch"), "keep test route fresh\n");
      await houseImport(out, { apply: true, doors: { ...doors(), faces: async () => [{ handleIndex: 0, petname: "otter-face", relation: "33333333-3333-4333-8333-333333333333", handle: null, seat: false, chair: null, kahua: [], mounted: true }], keepRoute: async () => [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }] } as BundleDoors });
      const { readFileSync } = await import("node:fs");
      expect((JSON.parse(readFileSync(join(fresh, "config", "keep-seat.json"), "utf8")) as { route?: string }).route).toBe("test");
    } finally { rmSync(fresh, { recursive: true, force: true }); }
  });
});
