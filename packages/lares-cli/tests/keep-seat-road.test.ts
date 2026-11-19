/**
 * keep-seat-road — a house reads the seat a pūlama minted as the shim writes it, and a cut that finds no usable seat names the
 * road THIS house takes to seat one.
 *
 *   KR1  RED: a keep-seat.json holding the pūlama's one `keep-seat` line verbatim reads as the house's seat with its signing
 *        seed: the cut lands, signed.
 *   KR2  RED: `keep-seat-absent` names the road per house: a pūlama house, `pulama-main.js keep-seat` through its shim; a vessel
 *        standing unlocked, `lares vault reseat`; else `lares vault unlock`. The same roads name `keep-seat-unsigned`.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mintKeepSeatUnder, encodeKeepSeat, keepVerifyKeyOf, nobleKdf } from "@lararium/mesh";
import { houseExport, type BundleDoors } from "../src/commands/house-bundle.js";
import { MANIFEST_FILE } from "../src/bundle-manifest.js";

vi.setConfig({ testTimeout: 120_000 });

const F1 = "11111111-1111-4111-8111-111111111111";
let root: string, scratch: string, priorHome: string | undefined;

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
  root = mkdtempSync(join(tmpdir(), "lar-keep-road-"));
  process.env["LAR_ROOT"] = root;
  // THE OPERATOR'S OWN SURFACE never leaks in: its pūlama signal rides a file under HOME.
  priorHome = process.env["HOME"]; process.env["HOME"] = join(root, "operator"); delete process.env["LARES_PULAMA"];
  scratch = mkdtempSync(join(tmpdir(), "lar-keep-road-out-"));
  const p = join(root, "projections", "faces", "otter-face", "wiki", "ha.ka.ba", "notes", "pond.tid");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, "title: lar:///ha.ka.ba/notes/pond\ntype: text/vnd.tiddlywiki\n\nthe pond\n");
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); rmSync(scratch, { recursive: true, force: true }); delete process.env["LAR_ROOT"]; delete process.env["LAR_PULAMA_SOCKET"]; if (priorHome === undefined) delete process.env["HOME"]; else process.env["HOME"] = priorHome; });

describe("the seat a pūlama minted, and the road a seatless house names", () => {
  test("KR1 RED: the pūlama's line, written verbatim, reads as the house's seat and the cut lands signed", async () => {
    const mint = (await mintKeepSeatUnder([{ kind: "passphrase", passphrase: "the steward's pūlama words" }], nobleKdf))!;
    const encoded = JSON.parse(encodeKeepSeat(mint.seat)) as { publicKey: string; stretchSalt: string; slots: unknown };
    const line = { op: "keep-seat", reading: "seated", seat: { publicKey: encoded.publicKey, stretchSalt: encoded.stretchSalt, tree: encoded.slots, verifyKey: Buffer.from(keepVerifyKeyOf(mint.signingSeed)).toString("hex") }, signer: Buffer.from(mint.signingSeed).toString("hex") };
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(join(root, "config", "keep-seat.json"), `${JSON.stringify(line)}\n`, { mode: 0o600 });
    const cut = await houseExport(join(scratch, "a"), { acceptOmissions: true, doors: doors() });
    expect(cut.manifest.faces.length).toBe(1);
    const { readFileSync } = await import("node:fs");
    expect(typeof JSON.parse(readFileSync(join(scratch, "a", MANIFEST_FILE), "utf8")).keepSignature).toBe("string");
  });

  test("KR2 RED: keep-seat-absent names this house's road", async () => {
    process.env["LAR_PULAMA_SOCKET"] = join(root, "pulama.sock");
    await expect(houseExport(join(scratch, "p"), { acceptOmissions: true, doors: doors() })).rejects.toThrow(/keep-seat-absent.*pulama-main\.js keep-seat/s);
    delete process.env["LAR_PULAMA_SOCKET"];
    await expect(houseExport(join(scratch, "u"), { acceptOmissions: true, doors: doors() })).rejects.toThrow(/keep-seat-absent.*lares vault unlock/s);
    const { keepSeatRoad } = await import("../src/keep-seat.js");
    expect(keepSeatRoad({ pulama: false, vesselUnlocked: true })).toMatch(/lares vault reseat/);
    expect(keepSeatRoad({ pulama: true, vesselUnlocked: true })).toMatch(/pulama-main\.js keep-seat/);
    expect(keepSeatRoad({ pulama: false, vesselUnlocked: false })).toMatch(/lares vault unlock/);
  });
});
