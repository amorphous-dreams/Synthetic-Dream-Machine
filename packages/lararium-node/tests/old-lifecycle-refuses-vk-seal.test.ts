import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSealedCarrier, writeSealedCarrier } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { larDataDir, larIdentityDir, larSealHome } from "../src/vessel-paths.js";
import { archivePath } from "../src/identity-anchors.js";
import { sealArchiveWithPassphrase, rotateArchivePassphrase, repairSplitKek, exportSealedArchive, readArchiveOpening, VkSealedCarrierRefusal } from "../src/archive-passphrase.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const freshRoot = () => { const root = mkdtempSync(join(tmpdir(), "lares-old-lifecycle-vk-")); roots.push(root); return root; };
const slot = { t: 1, pins: [{ kind: "passphrase" as const, passphrase: "synthetic custody pin" }] };
const oldPass = "synthetic old archive phrase";
const newPass = "synthetic new archive phrase";

async function foundArchive(root: string): Promise<{ vk: Awaited<ReturnType<typeof foundCustody>>["vk"]; io: FsCustodyIo; path: string }> {
  const homes = { identity: larIdentityDir(), storage: larDataDir(), seal: larSealHome() };
  const io = new FsCustodyIo(homes);
  const { vk } = await foundCustody({ io, homes, slots: [slot] });
  const path = archivePath();
  mkdirSync(join(root, "identity"), { recursive: true });
  await writeSealedCarrier({ io, vk, treePath: join(homes.identity, "vk-slots.bin"), carrier: { name: "archive", path }, plaintext: new TextEncoder().encode("synthetic archive plaintext") });
  return { vk, io, path };
}

describe("retiring passphrase lifecycle refuses VK seals", () => {
  test.each([
    ["seal", (path: string) => sealArchiveWithPassphrase(oldPass)],
    ["rotate", (path: string) => rotateArchivePassphrase(oldPass, newPass)],
    ["repair", (path: string) => repairSplitKek(oldPass, newPass)],
    ["export", (path: string) => exportSealedArchive(oldPass, join(path, "backup.bin"))],
  ])("refuses VK-sealed archive before any filesystem change (%s)", async (_act, act) => {
    const root = freshRoot();
    await withLarRoot(root, async () => {
      const { path, vk, io } = await foundArchive(root);
      const before = readFileSync(path);
      const names = readdirSync(larIdentityDir()).sort();
      expect(() => act(path)).toThrow(VkSealedCarrierRefusal);
      expect(() => act(path)).toThrow(/archive/);
      expect(readFileSync(path)).toEqual(before);
      expect(readdirSync(larIdentityDir()).sort()).toEqual(names);
      const opened = await openSealedCarrier({ io, vk, carrier: { name: "archive", path } });
      expect(opened.reading).toBe("opens");
    });
  });

  test("opening names the VK seal; cleartext remains open", async () => {
    const root = freshRoot();
    await withLarRoot(root, async () => {
      const { path, io, vk } = await foundArchive(root);
      expect(readArchiveOpening()).toMatchObject({ kind: "vk-sealed", opens: false, why: "the archive carrier rests sealed under the vessel key" });
      writeFileSync(path, "clear archive");
      expect(readArchiveOpening()).toMatchObject({ opens: true, kind: "no-seal-expected" });
      const opened = await openSealedCarrier({ io, vk, carrier: { name: "archive", path } });
      expect(opened.reading).toBe("bare");
    });
  });

  test.each([
    ["seal", (_root: string) => sealArchiveWithPassphrase(oldPass)],
    ["rotate", (_root: string) => { sealArchiveWithPassphrase(oldPass); return rotateArchivePassphrase(oldPass, newPass); }],
    ["repair", (_root: string) => { sealArchiveWithPassphrase(oldPass); return repairSplitKek(oldPass, newPass); }],
    ["export", (root: string) => exportSealedArchive(oldPass, join(root, "backup.bin"))],
  ])("cleartext control still permits %s", async (_act, act) => {
    const root = freshRoot();
    await withLarRoot(root, async () => {
      mkdirSync(larIdentityDir(), { recursive: true });
      writeFileSync(archivePath(), "synthetic clear archive");
      expect(act(root)).toBeTruthy();
    });
  });
});
