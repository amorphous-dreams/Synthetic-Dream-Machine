import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSealedCarrier, writeSealedCarrier } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { larDataDir, larIdentityDir, larSealHome } from "../src/vessel-paths.js";
import { deviceSharePath } from "../src/recovery-share-store.js";
import { archiveSealStatus, sealArchiveWithPassphrase, rotateArchivePassphrase, repairSplitKek, VkSealedCarrierRefusal } from "../src/archive-passphrase.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const freshRoot = () => { const root = mkdtempSync(join(tmpdir(), "lares-old-lifecycle-vk-")); roots.push(root); return root; };
const slot = { t: 1, pins: [{ kind: "passphrase" as const, passphrase: "synthetic custody pin" }] };
const oldPass = "synthetic old archive phrase";
const newPass = "synthetic new archive phrase";

async function foundDeviceShare(): Promise<{ vk: Awaited<ReturnType<typeof foundCustody>>["vk"]; io: FsCustodyIo; path: string }> {
  const homes = { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
  const io = new FsCustodyIo(homes);
  const { vk } = await foundCustody({ io, homes, slots: [slot] });
  const path = deviceSharePath(0);
  await writeSealedCarrier({ io, vk, treePath: join(homes.identity, "vk-slots.bin"), carrier: { name: "identity/recovery-device-share-h0.bin", path }, plaintext: new TextEncoder().encode(JSON.stringify({ x: 17, ys: [18], custodian: "device", recoveryEpoch: 1 })) });
  return { vk, io, path };
}

describe("retiring passphrase lifecycle refuses VK seals", () => {
  test.each([
    ["seal", () => sealArchiveWithPassphrase(oldPass)],
    ["rotate", () => rotateArchivePassphrase(oldPass, newPass)],
    ["repair", () => repairSplitKek(oldPass, newPass)],
  ])("refuses VK-sealed device share before any filesystem change (%s)", async (_act, act) => {
    const root = freshRoot();
    await withLarRoot(root, async () => {
      const { path, vk, io } = await foundDeviceShare();
      const before = readFileSync(path);
      const names = readdirSync(larIdentityDir()).sort();
      expect(() => act()).toThrow(VkSealedCarrierRefusal);
      expect(() => act()).toThrow(/device-share-h0/);
      expect(readFileSync(path)).toEqual(before);
      expect(readdirSync(larIdentityDir()).sort()).toEqual(names);
      const opened = await openSealedCarrier({ io, vk, carrier: { name: "identity/recovery-device-share-h0.bin", path } });
      expect(opened.reading).toBe("opens");
    });
  });

  test("status names the VK-sealed share and the lifecycle refuses it while custody still opens it", async () => {
    const root = freshRoot();
    await withLarRoot(root, async () => {
      const { path, io, vk } = await foundDeviceShare();
      expect(archiveSealStatus().carriers["device-share-h0"]!.state).toBe("cleartext");
      const before = readFileSync(path);
      for (const act of [() => sealArchiveWithPassphrase(oldPass), () => rotateArchivePassphrase(oldPass, newPass), () => repairSplitKek(oldPass, newPass)]) {
        expect(act).toThrow(VkSealedCarrierRefusal);
        expect(readFileSync(path)).toEqual(before);
        expect((await openSealedCarrier({ io, vk, carrier: { name: "identity/recovery-device-share-h0.bin", path } })).reading).toBe("opens");
      }
      rmSync(path);
      writeFileSync(path, JSON.stringify({ x: 17, ys: [18], custodian: "device", recoveryEpoch: 1 }));
      expect(sealArchiveWithPassphrase(oldPass).sealed).toContain("device-share-h0");
      expect(rotateArchivePassphrase(oldPass, newPass).rotated).toContain("device-share-h0");
      expect(repairSplitKek(oldPass, newPass).alreadyConsistent).toContain("device-share-h0");
    });
  });

  test.each([
    ["seal", (_root: string) => sealArchiveWithPassphrase(oldPass)],
    ["rotate", (_root: string) => { sealArchiveWithPassphrase(oldPass); return rotateArchivePassphrase(oldPass, newPass); }],
    ["repair", (_root: string) => { sealArchiveWithPassphrase(oldPass); return repairSplitKek(oldPass, newPass); }],
  ])("cleartext control still permits %s", async (_act, act) => {
    const root = freshRoot();
    await withLarRoot(root, async () => {
      mkdirSync(larIdentityDir(), { recursive: true });
      writeFileSync(deviceSharePath(0), JSON.stringify({ x: 17, ys: [18], custodian: "device", recoveryEpoch: 1 }));
      expect(act(root)).toBeTruthy();
    });
  });
});
