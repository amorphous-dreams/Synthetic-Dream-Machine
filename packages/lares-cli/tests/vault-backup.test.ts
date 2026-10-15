/**
 * vault-backup — the command's half of one face's backup cut: a fresh bundle key per cut, the routes bound in the
 * command's own process, ONE `backup` frame to the vessel, and a file only where the vessel answered a sealed body.
 *
 *   V1  a cut that lands writes mark, slot tree and sealed body, owner-only; the file opens under the bundle's route
 *       to exactly the body the vessel sealed.
 *   V2  the frame carries the vessel's own route, the face and a 64-hex key; the bundle's routes never ride it.
 *   V3  two cuts draw two keys.
 *   V4  a refusal writes no file and carries the vessel's own name for it (and the attempts left).
 *   V5  a file already standing refuses before any frame leaves; no vessel answering writes nothing.
 *   V6  the lines a landed cut prints name each bag and version, and say the sealed bytes must survive elsewhere.
 *
 * Synthetic names and keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-cut
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hexToBytes, openBundleKey, openFaceBundleBody, readFaceBundle, sealFaceBundleBody, type SlotSpec } from "@lararium/mesh";
import type { CustodyFrame } from "../src/custody-door.js";
import { SEALED_BYTES_LINE, backupLines, cutBundleToFile } from "../src/vault-backup.js";

vi.setConfig({ testTimeout: 120_000 });

const VESSEL_ROUTE = "the-vessel-route-for-a-backup-test";
const BUNDLE_ROUTE = "the-bundle-route-for-a-backup-test";
const routes: SlotSpec[] = [{ t: 1, pins: [{ kind: "passphrase", passphrase: BUNDLE_ROUTE }] }];
const vesselCredentials = [{ kind: "passphrase", passphrase: VESSEL_ROUTE }] as const;
const HOLD = { bagId: "lar:///ha.ka.ba/@test/bags/garden-notes", founding: "11".repeat(32), keyVersion: "22".repeat(32) };
const BODY = new TextEncoder().encode("a body the vessel sealed for this test");
const FACE = { handleIndex: 2, verifyingKey: "ab".repeat(32) };
const CARRIES = { keyEvents: 1, faceProofKeys: 1, handleBookRecords: 3, petname: true, handle: false, guardians: 0 };

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "vault-backup-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** A vessel that seals `BODY` under whatever key the frame carries, and keeps the frames it heard. */
function vessel() {
  const frames: CustodyFrame[] = [];
  const send = async (frame: CustodyFrame) => {
    frames.push(frame);
    if (frame.op !== "backup") throw new Error("another frame");
    return { op: "backup", sealedBody: Buffer.from(sealFaceBundleBody(BODY, hexToBytes(frame.key))).toString("base64"), holds: [HOLD], face: FACE, carries: CARRIES };
  };
  return { frames, send };
}

describe("a cut writes a bundle only where the vessel answered a sealed body", () => {
  it("V1 — the file holds mark, tree and body, rests owner-only, and opens under the bundle's route to the vessel's body", async () => {
    const v = vessel();
    const out = join(dir, "face.bundle");
    const landed = await cutBundleToFile({ face: 2, out, vesselCredentials, bundleRoutes: routes, send: v.send });
    expect(landed).toMatchObject({ ok: true, out, face: FACE, holds: [HOLD], carries: CARRIES, slots: 1 });
    expect(statSync(out).mode & 0o777).toBe(0o600);
    const read = readFaceBundle(new Uint8Array(readFileSync(out)));
    expect(read.reading).toBe("readable");
    if (read.reading !== "readable") return;
    const key = openBundleKey(read.tree, [{ kind: "passphrase", passphrase: BUNDLE_ROUTE }]);
    expect(key.reading).toBe("opens");
    if (key.reading !== "opens") return;
    expect(Buffer.from(openFaceBundleBody(read.sealedBody, key.bundleKey)!).toString()).toBe("a body the vessel sealed for this test");
    // The vessel's own route opens no slot of the bundle.
    expect(openBundleKey(read.tree, [{ kind: "passphrase", passphrase: VESSEL_ROUTE }]).reading).toBe("no-slot-opens");
  });

  it("V2 — the one frame carries the vessel's route, the face and a key, and nothing of the bundle's route", async () => {
    const v = vessel();
    await cutBundleToFile({ face: 2, out: join(dir, "face.bundle"), vesselCredentials, bundleRoutes: routes, send: v.send });
    expect(v.frames).toHaveLength(1);
    const frame = v.frames[0]! as Extract<CustodyFrame, { op: "backup" }>;
    expect(Object.keys(frame).sort()).toEqual(["credentials", "face", "key", "op"]);
    expect(frame.face).toBe(2);
    expect(frame.key).toMatch(/^[0-9a-f]{64}$/);
    expect(frame.credentials).toEqual(vesselCredentials);
    expect(JSON.stringify(frame)).not.toContain(BUNDLE_ROUTE);
    // CONTROL: the frame does carry the vessel's route, so the hunt finds a route where one rides.
    expect(JSON.stringify(frame)).toContain(VESSEL_ROUTE);
  });

  it("V3 — two cuts draw two keys", async () => {
    const v = vessel();
    await cutBundleToFile({ face: 2, out: join(dir, "a.bundle"), vesselCredentials, bundleRoutes: routes, send: v.send });
    await cutBundleToFile({ face: 2, out: join(dir, "b.bundle"), vesselCredentials, bundleRoutes: routes, send: v.send });
    const [a, b] = v.frames as Array<Extract<CustodyFrame, { op: "backup" }>>;
    expect(a!.key).not.toBe(b!.key);
  });

  it("V4 — a refusal writes no file and carries the vessel's own name for it", async () => {
    const out = join(dir, "face.bundle");
    const refused = await cutBundleToFile({
      face: 2, out, vesselCredentials, bundleRoutes: routes,
      send: async () => ({ op: "backup", status: "error", errorMessage: "this vessel wears h0", refusal: { reason: "face-not-worn" } }),
    });
    expect(refused).toEqual({ ok: false, reason: "face-not-worn", message: "this vessel wears h0" });
    expect(existsSync(out)).toBe(false);
    const missed = await cutBundleToFile({
      face: 2, out, vesselCredentials, bundleRoutes: routes,
      send: async () => ({ op: "backup", status: "error", errorMessage: "no slot opens", refusal: { reason: "no-slot-opens", attemptsLeft: 2 } }),
    });
    expect(missed).toEqual({ ok: false, reason: "no-slot-opens", message: "no slot opens", attemptsLeft: 2 });
    expect(existsSync(out)).toBe(false);
  });

  it("V5 — a file already standing refuses before any frame leaves; no vessel answering writes nothing", async () => {
    const v = vessel();
    const out = join(dir, "face.bundle");
    writeFileSync(out, "something a person keeps");
    expect(await cutBundleToFile({ face: 2, out, vesselCredentials, bundleRoutes: routes, send: v.send })).toMatchObject({ ok: false, reason: "out-exists" });
    expect(v.frames).toEqual([]);
    expect(readFileSync(out, "utf8")).toBe("something a person keeps");
    const fresh = join(dir, "fresh.bundle");
    expect(await cutBundleToFile({ face: 2, out: fresh, vesselCredentials, bundleRoutes: routes, send: async () => null })).toMatchObject({ ok: false, reason: "daemon-unreachable" });
    expect(existsSync(fresh)).toBe(false);
  });

  it("V6 — a landed cut names each bag and version, and says the sealed bytes must survive elsewhere", async () => {
    const v = vessel();
    const landed = await cutBundleToFile({ face: 2, out: join(dir, "face.bundle"), vesselCredentials, bundleRoutes: routes, send: v.send });
    if (!landed.ok) throw new Error("setup");
    const text = backupLines(landed).join("\n");
    expect(text).toContain(HOLD.bagId);
    expect(text).toContain(HOLD.keyVersion.slice(0, 16));
    expect(text).toContain(SEALED_BYTES_LINE);
    expect(text).toContain("values written after this cut included");
    expect(text).toContain("no version minted after this cut");
    const bare = backupLines({ ...landed, holds: [] }).join("\n");
    expect(bare).toContain("no content key");
    expect(bare).toContain(SEALED_BYTES_LINE);
  });
});
