/**
 * locked-floor-loads-no-sealed — A FACE-LIT HEARTH BOOTED LOCKED STANDS ITS FLOOR WITHOUT REACHING FOR A SEALED DOCUMENT.
 *
 * The staged e2e roads stand a founded vessel and unlock it through the custody door. Measured on CI: at the locked floor
 * the vessel's Repo kept loading vessel- and face-sealed documents (the control document's held seed and what it pointed
 * at), each load refusing `session-absent` with a stack the daemon wrote to its pipe, so a harness blocked on the unlock
 * door filled the pipe and the daemon never answered. A locked floor fails closed (operator ruling 2026-11-09): its control
 * document stands as a stand-in that no Repo holds, so nothing at the floor finds, syncs or loads a sealed document.
 *
 *   F1 — RED: the floor composition of a founded, face-lit vessel stands with custody locked and its storage reports no
 *        sealed load (`SealedDocumentRefusal`), and its control store refuses `vessel-locked`
 *   F2 — CONTROL: the floor tears down, the key opens, and the sovereign composition stands the control document itself
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OUTCOME_URI_PREFIX, VESSEL_LOCKED } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { direct } from "./direct-store.js";
import { TEST_CUSTODY, TEST_SLOT } from "./found-route.js";
import { runInit, runFoundTheFace, foundSeedCharter, openNodeHerm, openNodeVessel, seatFaceRoute, seatWardGatherer, seatCustody, seatedCustody } from "../dist/src/index.js";

seatFaceRoute(async () => [TEST_SLOT]);
seatWardGatherer(async () => TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));

const leaving: Array<() => Promise<void>> = [];
afterEach(async () => { while (leaving.length) await leaving.pop()!(); vi.restoreAllMocks(); });

describe("a locked floor reaches for no sealed document", () => {
  test("F1 — RED: a founded, face-lit vessel composes its floor with custody locked; no sealed load refuses, and its control store refuses `vessel-locked`", async () => {
    const root = mkdtempSync(join(tmpdir(), "locked-floor-"));
    const genesisDir = join(root, "genesis");
    const storageDir = join(root, "hearth", "vessel");
    cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), genesisDir, { recursive: true });
    const httpServer = createServer();
    let herm: Awaited<ReturnType<typeof openNodeHerm>> | null = null;
    leaving.push(async () => { if (herm) await withLarRoot(root, () => herm!.teardown()); httpServer.close(); rmSync(root, { recursive: true, force: true }); });
    await withLarRoot(root, () => direct(runInit)({ storageDir, genesisDir, custody: TEST_CUSTODY, placeFoundingCard: { readBack: async () => {} } }));
    await withLarRoot(root, () => foundSeedCharter({ name: "locked floor founder", readBack: async () => {} }));
    await withLarRoot(root, () => direct(runFoundTheFace)({ storageDir, genesisDir }));

    // THE BOOT HOLDS NO KEY: the holder locks, and its seat carries no opener.
    await withLarRoot(root, async () => { const holder = seatedCustody(); if (holder) { await holder.lock(); seatCustody(holder); } });
    const said: string[] = [];
    const hear = (...args: unknown[]) => { said.push(args.map((a) => (a instanceof Error ? `${a.name} ${a.message}` : String(a))).join(" ")); };
    vi.spyOn(console, "error").mockImplementation(hear);
    vi.spyOn(console, "warn").mockImplementation(hear);
    herm = await withLarRoot(root, () => openNodeHerm({ hostId: "locked-floor", wikiId: "locked-floor", storageDir, genesisDir, sovereign: null,
      wss: new EventEmitter() as never, httpServer, dispatcher: undefined as never }));
    await withLarRoot(root, () => herm!.daemon.workerEa);
    await new Promise((r) => setTimeout(r, 500));

    expect(said.filter((line) => /SealedDocumentRefusal|session-absent/.test(line))).toEqual([]);
    await expect(herm.daemon.control.get(`${OUTCOME_URI_PREFIX}floor`)).rejects.toMatchObject({ refusal: VESSEL_LOCKED });

    // F2 — THE UNLOCK RECOMPOSES: the floor stands down, the key opens, and the sovereign composition reads its control document.
    await withLarRoot(root, () => herm!.teardown());
    herm = null;
    const unlocked = await withLarRoot(root, async () => {
      const holder = seatedCustody()!;
      await holder.unlock(TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));
      await holder.unlockFaces(TEST_SLOT.pins.flatMap((pin) => (pin.kind === "passphrase" ? [{ kind: "passphrase" as const, passphrase: pin.passphrase }] : [])));
      return holder.isUnlocked();
    });
    expect(unlocked).toBe(true);
    const vessel = await withLarRoot(root, () => openNodeVessel({ hostId: "locked-floor", wikiId: "locked-floor", storageDir, genesisDir, wss: new EventEmitter() as never }));
    leaving.push(async () => { await withLarRoot(root, () => vessel.teardown()); });
    await withLarRoot(root, () => vessel.daemon.workerEa);
    expect(await vessel.daemon.control.get(`${OUTCOME_URI_PREFIX}floor`)).toBeNull();
  }, 240_000);
});
