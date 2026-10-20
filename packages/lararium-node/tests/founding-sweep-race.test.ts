/** The sweep waits for the founding custody claim before it scans a two-row handoff. */
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
const scan = vi.hoisted(() => ({ enabled: false, observed: false }));
vi.mock("node:fs", async (importActual) => {
  const actual = await importActual<typeof import("node:fs")>();
  return { ...actual, readdirSync: (path: string) => {
    if (scan.enabled && path.includes("identity")) scan.observed = true;
    return actual.readdirSync(path);
  } };
});
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody, readCustodyRow } from "../src/custody-seat.js";
import { hearthAid } from "../src/hearth-aid.js";
import { faceAtomGroupFile, pendingFoundingFile, sweepFoundingSeeds, type FoundingAtomAsk } from "../src/face-atom-store.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { larDataDir, larIdentityDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const roots: string[] = [];
afterAll(async () => { for (const root of roots) { await withLarRoot(root, async () => { const holder = seatedCustody(); if (holder) { await holder.lock(); unseatCustody(holder); } }); rmSync(root, { recursive: true, force: true }); } });
function deferred() { let resolve!: () => void; const promise = new Promise<void>((yes) => { resolve = yes; }); return { promise, resolve }; }

async function rig() {
  const root = mkdtempSync(join(tmpdir(), "lar-sweep-race-")); roots.push(root);
  return withLarRoot(root, async () => {
    const genesisDir = join(root, "genesis");
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
    await foundDirect({ storageDir: larDataDir(), genesisDir }); await seatSeedCharter();
    const hearthTrueName = hearthAid(); if (!hearthTrueName) throw new Error("no charter hearth");
    return { root, genesisDir, ask: { hearthTrueName, bindingMode: "self-stood", personaKelPrefix: null, mount: true, handleIndex: 0 } as FoundingAtomAsk };
  });
}

describe("the founding sweep and a live handoff", () => {
  test("the sweep takes the founding claim before scanning, then leaves one group row and a standing face", async () => {
    const { root, genesisDir, ask } = await rig();
    await withLarRoot(root, async () => {
      const reachedRemoval = deferred(), releaseRemoval = deferred();
      const original = FsCustodyIo.prototype.remove;
      let heldOnce = false;
      const spy = vi.spyOn(FsCustodyIo.prototype, "remove").mockImplementation(async function (path) {
        if (!heldOnce && path.endsWith(pendingFoundingFile(ask))) {
          heldOnce = true; reachedRemoval.resolve(); await releaseRemoval.promise;
        }
        return original.call(this, path);
      });
      try {
        const founding = foundFace({ storageDir: larDataDir(), genesisDir });
        await reachedRemoval.promise;
        // The group row has landed, but founding still owns the claim and its ask row.
        const before = readdirSync(larIdentityDir());
        expect(before.filter((file) => file === pendingFoundingFile(ask) || /^face-atom-g[0-9a-f]{64}\.bin$/.test(file)), "the pause exposes both rows").toHaveLength(2);
        scan.enabled = true; scan.observed = false;
        let swept = false;
        const sweep = sweepFoundingSeeds().then(() => { swept = true; });
        await Promise.resolve(); await Promise.resolve();
        scan.enabled = false;
        expect(scan.observed, "the sweep waits for the custody claim before listing rows").toBe(false);
        expect(swept, "the sweep cannot finish inside the founding claim").toBe(false);
        releaseRemoval.resolve();
        const [face] = await Promise.all([founding, sweep]);
        const rows = readdirSync(larIdentityDir()).filter((file) => file === pendingFoundingFile(ask) || file === faceAtomGroupFile(face.personaGroupId));
        expect(rows, "exactly one row holds the live founding seed").toEqual([faceAtomGroupFile(face.personaGroupId)]);
        expect(await readCustodyRow("identity", rows[0]!), "the surviving group row holds the seed").toHaveLength(32);
        expect(await loadIdentityAnchors(0), "the face stands after the race").toMatchObject({ personaGroupId: face.personaGroupId });
      } finally { scan.enabled = false; releaseRemoval.resolve(); spy.mockRestore(); }
    });
  }, 180_000);
});
