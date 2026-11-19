/**
 * keep-seat-cache — the last roster seal the seat keeps ships only where the house's own signing seed vouches for it.
 *
 * The seat keeps its last seal so an unmoved house cuts the same bundle. Whoever writes the config home could swap those bytes
 * for a roster of their own sealed to the public half, beside the same digest; a cut that ships the cache unverified would carry
 * it, signed by the house.
 *
 * The vouch guards ACCIDENTAL and WRITE-ONLY swaps: a hand that can write the config home but not read its signing seed. A hand
 * that reads the config home holds the seed itself, and no vouch stands against it.
 *
 *   KC1  RED: a cache whose sealed bytes were swapped beside the standing digest and vouch refuses the cut by name
 *        (`keep-roster-cache-unvouched`), and nothing ships. CONTROL: an untouched cache re-cuts the very same bundle.
 *   KC2  RED: a cache whose forged bytes carry a vouch made under the wrong key refuses the cut the same way.
 *   KC3  CONTROL: a cache with no vouch at all re-seals the house's own roster and ships that.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { houseExport, type BundleDoors } from "../src/commands/house-bundle.js";
import { BUNDLE_SCHEMA, REDECLARE_FILE, sealRedeclare } from "../src/bundle-manifest.js";
import { plantKeptSeat } from "./support/kept-seat.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const F1 = "11111111-1111-4111-8111-111111111111";
let root: string, scratch: string;

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

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lar-keep-cache-"));
  writeFileSync(join(root, ".lar-test-scratch"), "keep cache suite\n");
  process.env["LAR_ROOT"] = root;
  scratch = mkdtempSync(join(tmpdir(), "lar-keep-cache-out-"));
  await plantKeptSeat(root);
  const p = join(root, "projections", "faces", "otter-face", "wiki", "ha.ka.ba", "notes", "pond.tid");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, "title: lar:///ha.ka.ba/notes/pond\ntype: text/vnd.tiddlywiki\n\nthe pond\n");
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); rmSync(scratch, { recursive: true, force: true }); delete process.env["LAR_ROOT"]; });

describe("the cached roster seal ships only under the house's own vouch", () => {
  const seatPath = () => join(root, "config", "keep-seat.json");
  type Local = { publicKey: string; lastRoster: { digest: string; sealed: string; vouch?: string } };
  const forgedFor = (local: Local) => sealRedeclare(Uint8Array.from(Buffer.from(local.publicKey, "hex")), { schema: BUNDLE_SCHEMA, faces: [{ face: "f0", handleIndex: 0, petname: "otter-face", handle: "Forged", seat: true, chair: "forged" }] });

  test("KC1 RED: swapped bytes beside the standing vouch refuse the cut; CONTROL: an untouched cache re-cuts the same bundle", async () => {
    const a = await houseExport(join(scratch, "a"), { acceptOmissions: true, doors: doors() });
    const b = await houseExport(join(scratch, "b"), { acceptOmissions: true, doors: doors() });
    expect(b.manifest.bundleId, "CONTROL: an untouched cache re-cuts the same bundle").toBe(a.manifest.bundleId);
    const local = JSON.parse(readFileSync(seatPath(), "utf8")) as Local;
    const forged = forgedFor(local);
    local.lastRoster = { ...local.lastRoster, sealed: forged.toString("base64") };
    writeFileSync(seatPath(), JSON.stringify(local), { mode: 0o600 });
    await expect(houseExport(join(scratch, "c"), { acceptOmissions: true, doors: doors() })).rejects.toThrow(/keep-roster-cache-unvouched/);
  });

  test("KC2 RED: forged bytes under a vouch made with the wrong key refuse the cut", async () => {
    await houseExport(join(scratch, "a"), { acceptOmissions: true, doors: doors() });
    const local = JSON.parse(readFileSync(seatPath(), "utf8")) as Local;
    const forged = forgedFor(local);
    const vouch = createHmac("sha256", Buffer.alloc(32, 9)).update("lar-keep-roster-seal").update(local.lastRoster.digest).update(forged).digest("hex");
    local.lastRoster = { digest: local.lastRoster.digest, sealed: forged.toString("base64"), vouch };
    writeFileSync(seatPath(), JSON.stringify(local), { mode: 0o600 });
    await expect(houseExport(join(scratch, "c"), { acceptOmissions: true, doors: doors() })).rejects.toThrow(/keep-roster-cache-unvouched/);
  });

  test("KC3 CONTROL: a cache with no vouch re-seals the house's own roster", async () => {
    await houseExport(join(scratch, "a"), { acceptOmissions: true, doors: doors() });
    const local = JSON.parse(readFileSync(seatPath(), "utf8")) as Local;
    const forged = forgedFor(local);
    local.lastRoster = { digest: local.lastRoster.digest, sealed: forged.toString("base64") };
    writeFileSync(seatPath(), JSON.stringify(local), { mode: 0o600 });
    await houseExport(join(scratch, "c"), { acceptOmissions: true, doors: doors() });
    expect(readFileSync(join(scratch, "c", REDECLARE_FILE)).equals(forged), "the unvouched bytes shipped").toBe(false);
  });
});
