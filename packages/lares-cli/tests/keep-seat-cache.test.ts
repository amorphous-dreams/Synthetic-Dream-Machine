/**
 * keep-seat-cache — the last roster seal the seat keeps ships only where the house's own signing seed vouches for it.
 *
 * The seat keeps its last seal so an unmoved house cuts the same bundle. Whoever writes the config home could swap those bytes
 * for a roster of their own sealed to the public half, beside the same digest; a cut that ships the cache unverified would carry
 * it, signed by the house.
 *
 *   KC1  RED: a cache whose sealed bytes were swapped (the digest left standing) never ships: the re-cut carries a seal of the
 *        house's own roster. CONTROL: an untouched cache re-cuts the very same bundle.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
  test("KC1 RED: a swapped cache never ships; CONTROL: an untouched cache re-cuts the same bundle", async () => {
    const a = await houseExport(join(scratch, "a"), { acceptOmissions: true, doors: doors() });
    const b = await houseExport(join(scratch, "b"), { acceptOmissions: true, doors: doors() });
    expect(b.manifest.bundleId, "CONTROL: an untouched cache re-cuts the same bundle").toBe(a.manifest.bundleId);
    const seatPath = join(root, "config", "keep-seat.json");
    const local = JSON.parse(readFileSync(seatPath, "utf8")) as { publicKey: string; lastRoster: { digest: string; sealed: string } };
    const forged = sealRedeclare(Uint8Array.from(Buffer.from(local.publicKey, "hex")), { schema: BUNDLE_SCHEMA, faces: [{ face: "f0", handleIndex: 0, petname: "otter-face", handle: "Forged", seat: true, chair: "forged" }] });
    local.lastRoster = { digest: local.lastRoster.digest, sealed: forged.toString("base64") };
    writeFileSync(seatPath, JSON.stringify(local), { mode: 0o600 });
    await houseExport(join(scratch, "c"), { acceptOmissions: true, doors: doors() });
    expect(readFileSync(join(scratch, "c", REDECLARE_FILE)).equals(forged), "the swapped bytes shipped").toBe(false);
  });
});
