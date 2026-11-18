/**
 * floor-key-one-reading — THE FLOOR KEY READS AS THE CONTROL DOCUMENT READS, in one composition (the-veil-ladder#/the-base-model).
 *
 * Measured on the held-out mesh (every scenario's node): a staged hearth booted with its custody shut, and its seat carried an
 * opener (the test route a staged root opens under). The composition read the floor's rest key before any row asked for the
 * key (`vessel-locked`), then the control document's stand opened the custody through the opener and read whole. The daemon
 * island took the stale `vessel-locked` grant and held its working layer in memory, while the host, reading an open control
 * document, asked the island for the daemon's working binding, met `floor-unavailable: vessel-locked`, and died
 * (`HostWorkingBindingRefusal`). A locked hearth stands (operator ruling 2026-11-09), and one composition reads one key.
 *
 *   K1 — RED: a founded, face-lit vessel whose seat opens its custody at the first row composes, its daemon island holds the
 *        floor's key as standing, and the host's daemon working layer mounts as the default writable
 */
import { afterEach, describe, expect, test } from "vitest";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { wikiSlotUri } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "./found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeHerm, seatFaceRoute, seatWardGatherer, seatCustody, seatedCustody } from "../dist/src/index.js";

const route = () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : []));
seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => route());

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); });

describe("one composition reads one floor key", () => {
  test("K1 — RED: a vessel whose custody opens at its first row stands, its island holds the floor key, and the host's daemon working layer mounts", async () => {
    const root = mkdtempSync(join(tmpdir(), "floor-one-reading-"));
    const genesisDir = join(root, "genesis");
    const storageDir = join(root, "hearth", "vessel");
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
    const httpServer = createServer();
    let herm: Awaited<ReturnType<typeof openNodeHerm>> | null = null;
    leaving.push(async () => { if (herm) await withLarRoot(root, () => herm!.teardown()); httpServer.close(); rmSync(root, { recursive: true, force: true }); });
    await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
    await withLarRoot(root, () => foundSeedCharter({ name: "one reading founder", readBack: async () => {} }));
    await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));

    // THE BOOT HOLDS NO KEY, and its seat carries an OPENER: the first row that needs the key opens it mid-composition.
    await withLarRoot(root, async () => {
      const holder = seatedCustody();
      if (holder) { await holder.lock(); seatCustody(holder, async (h) => { await h.unlock(route()); }); }
    });
    herm = await withLarRoot(root, () => openNodeHerm({ hostId: "one-reading", wikiId: "one-reading", storageDir, genesisDir, sovereign: null,
      wss: new EventEmitter() as never, httpServer, dispatcher: undefined as never }));
    await withLarRoot(root, () => herm!.daemon.workerEa);
    expect(herm.floorKey, "the composition reads the key its control document read under").toBe("stands");
    expect(herm.daemon.composite.defaultWritableBagId(), "the host's daemon working layer mounts as the default writable").toBe(wikiSlotUri("daemon", "working"));
  }, 240_000);
});
