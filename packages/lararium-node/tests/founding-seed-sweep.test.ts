/** A crash between the destination write and ask removal leaves a pair the boot sweep retires once. */
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody, readCustodyRow } from "../src/custody-seat.js";
import { hearthAid } from "../src/hearth-aid.js";
import { pendingFoundingFile, loadPendingFoundingSeed, type FoundingAtomAsk } from "../src/face-atom-store.js";
import { larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const roots: string[] = [];
afterAll(async () => { for (const root of roots) { await withLarRoot(root, async () => { const holder = seatedCustody(); if (holder) { await holder.lock(); unseatCustody(holder); } }); rmSync(root, { recursive: true, force: true }); } });

async function rig() {
  const root = mkdtempSync(join(tmpdir(), "lar-seed-sweep-")); roots.push(root);
  return withLarRoot(root, async () => {
    const genesisDir = join(root, "genesis"); cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
    await foundDirect({ storageDir: larDataDir(), genesisDir }); await seatSeedCharter();
    const hearthTrueName = hearthAid(); if (!hearthTrueName) throw new Error("no charter hearth");
    const ask: FoundingAtomAsk = { hearthTrueName, bindingMode: "self-stood", personaKelPrefix: null, mount: true, handleIndex: 0 };
    return { root, genesisDir, ask };
  });
}

describe("the founding seed sweep", () => {
  test("a planted removal fault exposes two rows; the sweep retires only the matching ask and stays idempotent", async () => {
    const { root, genesisDir, ask } = await rig();
    await withLarRoot(root, async () => {
      const original = FsCustodyIo.prototype.remove;
      let planted = false;
      const spy = vi.spyOn(FsCustodyIo.prototype, "remove").mockImplementation(async function (path) {
        if (!planted && path.endsWith(pendingFoundingFile(ask))) { planted = true; throw new Error("planted between group write and ask removal"); }
        return original.call(this, path);
      });
      try { await expect(foundFace({ storageDir: larDataDir(), genesisDir })).rejects.toThrow("planted between group write and ask removal"); }
      finally { spy.mockRestore(); }
      expect(planted, "the fault struck the ask removal seam").toBe(true);
      const names = () => readdirSync(larIdentityDir()).filter((name) => name === pendingFoundingFile(ask) || /^face-atom-g[0-9a-f]{64}\.bin$/.test(name)).sort();
      expect(names(), "the fault exposes both sealed rows").toHaveLength(2);
      const [groupFile] = names().filter((name) => name.startsWith("face-atom-g"));
      expect(await readCustodyRow("identity", groupFile!)).toEqual(await loadPendingFoundingSeed(ask));
      const path = "../src/face-atom-store.js";
      const module = await import(path).catch(() => null) as { sweepFoundingSeeds?: () => Promise<void> } | null;
      expect(module?.sweepFoundingSeeds, "sweepFoundingSeeds stands").toBeTypeOf("function");
      await module!.sweepFoundingSeeds!();
      expect(names(), "one group row keeps the seed").toEqual([groupFile]);
      const bytes = readFileSync(join(larIdentityDir(), groupFile!));
      await module!.sweepFoundingSeeds!();
      expect(names()).toEqual([groupFile]);
      expect(readFileSync(join(larIdentityDir(), groupFile!))).toEqual(bytes);
      const boot = readFileSync(join(import.meta.dirname, "..", "src", "open-node-vessel.ts"), "utf8");
      expect(boot, "node boot invokes the founding sweep").toMatch(/sweepFoundingSeeds\s*\(/);
    });
  }, 180_000);
});
