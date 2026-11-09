/**
 * THE PER-DEVICE DAEMON DOCUMENTS SEAL UNDER THE LIT FACE (operator ruling 2026-11-09, sealed map): the daemon wiki's
 * device slots (`bags/control/daemon-slot/<kind>/<group>`) and the face's daemon canon (`bags/control/daemon-canon/<face>`)
 * are the AI's memory on this device. A founded vessel that lights its face mints them through the control document; each
 * rests sealed in the vessel's store (a sealed pointer, never Automerge's clear bytes) and stands there after the vessel
 * stands down, so the next boot finds it. The control document itself rests under the vessel's key beside the secret home.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventEmitter } from "node:events";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTROL_HOME_ID, tiddlerText, type LarDoc } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "./found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeVessel, seatFaceRoute, seatWardGatherer, ownedStore } from "../dist/src/index.js";
import { openVesselSecretHome } from "../dist/src/secret-home-store.js";
import type { NodeVesselResult } from "../dist/src/open-node-vessel.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); vi.restoreAllMocks(); });

const MAGIC = [0x85, 0x6f, 0x4a, 0x83];
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) { const p = join(dir, name); const st = statSync(p); if (st.isDirectory()) out.push(...filesUnder(p)); else out.push(p); }
  return out;
}
/** A document's chunk files in a NodeFS store: `<dir>/<id[0:2]>/<id[2:]>/…`. */
const chunksOf = (storageDir: string, documentId: string): string[] => {
  try { return filesUnder(join(storageDir, documentId.slice(0, 2), documentId.slice(2))); } catch { return []; }
};

describe("the per-device daemon documents seal under the lit face and survive a stand-down", () => {
  test("RED: every daemon-slot and daemon-canon document the control document names rests sealed, never clear, after the vessel stands down", async () => {
    const root = mkdtempSync(join(tmpdir(), "device-daemon-docs-"));
    const genesisDir = join(root, "genesis");
    const storageDir = join(root, "hearth", "vessel");
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
    let vessel: NodeVesselResult | null = null;
    leaving.push(async () => { if (vessel) await withLarRoot(root, () => vessel!.teardown()); rmSync(root, { recursive: true, force: true }); });
    await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
    await withLarRoot(root, () => foundSeedCharter({ name: "device docs founder", readBack: async () => {} }));
    await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));
    vessel = await withLarRoot(root, () => openNodeVessel({ hostId: "device-docs", wikiId: "device-docs", storageDir, genesisDir, wss: new EventEmitter() as never }));
    await withLarRoot(root, () => vessel!.daemon.workerEa);
    await withLarRoot(root, () => vessel!.teardown());
    vessel = null;

    const named = await withLarRoot(root, () => ownedStore(storageDir, async (repo) => {
      const home = await openVesselSecretHome(repo);
      const controlUrl = (await import("../dist/src/secret-home-store.js")).readSecretHomeAddress;
      const address = await controlUrl();
      expect(address?.controlId, "the custody row names the control document beside the home").toBeTruthy();
      const control = await repo.find<LarDoc>(`automerge:${address!.controlId}` as never);
      void home;
      return Object.entries(control.doc().tiddlers)
        .filter(([title]) => title.startsWith(`${CONTROL_HOME_ID}/daemon-slot/`) || title.startsWith(`${CONTROL_HOME_ID}/daemon-canon/`))
        .map(([title, rec]) => ({ title, id: (tiddlerText(rec as never) ?? "").replace(/^automerge:/, ""), controlId: address!.controlId! }));
    }));
    // The setup took: the lit face's daemon wiki minted its device documents and named them.
    expect(named.length, "the control document names the face's device daemon documents").toBeGreaterThan(0);
    // The control document rests sealed under the vessel's key: no clear chunk.
    for (const f of chunksOf(storageDir, named[0]!.controlId)) expect(MAGIC.every((b, i) => readFileSync(f)[i] === b), f).toBe(false);
    for (const { title, id } of named) {
      const chunks = chunksOf(storageDir, id).filter((f) => /incremental|snapshot/.test(f));
      expect(chunks.length, `${title} rests in the vessel's store after the stand-down`).toBeGreaterThan(0);
      for (const f of chunks) expect(MAGIC.every((b, i) => readFileSync(f)[i] === b), `${title} rests clear at ${f}`).toBe(false);
    }
  }, 240_000);
});
