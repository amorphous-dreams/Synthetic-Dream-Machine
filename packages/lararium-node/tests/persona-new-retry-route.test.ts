/**
 * persona-new-retry-route — a `persona new` stopped after its anchors landed resumes on the CLI's own road: the CLI parks the
 * face's route at the vessel's door (`face-route`) and the store verb runs the founding under that parked route (`withFaceRoute`),
 * with no ward argument and no person seated to answer a ward prompt. The resume must seat the parked route as the founding's
 * ward, as a fresh founding does when its custody is born.
 *
 *   C1  RED  interrupted after the anchors, the retry under a freshly parked route (no ward supplied, no gatherer seated)
 *            stands the face: the same group, the bootstrap entry committed.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test, vi } from "vitest";
import { personaScopedBagIds } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";

const fault = vi.hoisted(() => ({ afterAnchors: false, group: "" }));
vi.mock("../src/identity-anchors.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/identity-anchors.js")>();
  return {
    ...actual,
    persistIdentityAnchors: async (...args: Parameters<typeof actual.persistIdentityAnchors>) => {
      await actual.persistIdentityAnchors(...args);
      if (fault.afterAnchors) { fault.afterAnchors = false; fault.group = args[0].personaGroupId; throw new Error("planted after the anchors"); }
    },
  };
});

import { runFoundTheFace } from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { faceRouteBindDigest, parkFaceRoute, seatFaceRoute, withFaceRoute } from "../src/face-route.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { larBootstrapPath, larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { TEST_SLOT, foundDirect, seatSeedCharter } from "./found-route.js";

const foundFace = direct(runFoundTheFace);
const genesisSource = join(import.meta.dirname, "..", "..", "..", "genesis");
const roots: string[] = [];
afterAll(async () => {
  for (const root of roots) {
    await withLarRoot(root, async () => { const h = seatedCustody(); if (h) { await h.lock(); unseatCustody(h); } });
    rmSync(root, { recursive: true, force: true });
  }
});

/** The store verb's own road (`persona-new`): the route the CLI parked, spent once, and no ward argument. */
const asTheCli = (genesisDir: string, handleIndex: number) => {
  const ref = parkFaceRoute([TEST_SLOT], "persona-new", faceRouteBindDigest("persona-new", { handleIndex }));
  return withFaceRoute(ref, "persona-new", faceRouteBindDigest("persona-new", { handleIndex }), () => foundFace({ genesisDir, handleIndex }));
};

describe("a persona new stopped after its anchors resumes on the CLI's road", () => {
  test("C1 RED: the retry under a parked route, with no ward supplied and no gatherer seated, stands the face", async () => {
    const root = mkdtempSync(join(tmpdir(), "lar-persona-retry-"));
    roots.push(root);
    await withLarRoot(root, async () => {
      const genesisDir = join(root, "genesis");
      cpSync(genesisSource, genesisDir, { recursive: true });
      await foundDirect({ storageDir: larDataDir(), genesisDir });
      await seatSeedCharter();
      await asTheCli(genesisDir, 0);
      // FROM HERE THE ONLY ROUTE IS THE ONE THE CLI PARKS: no gatherer answers a face's route, and no person answers a ward.
      seatFaceRoute(null);
      fault.afterAnchors = true;
      await expect(asTheCli(genesisDir, 1)).rejects.toThrow("planted after the anchors");
      const stopped = fault.group;
      expect((await loadIdentityAnchors(1))?.personaGroupId).toBe(stopped);
      const resumed = await asTheCli(genesisDir, 1);
      expect(resumed.personaGroupId, "the retry finishes the same group").toBe(stopped);
      const packed = JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text?: string }> };
      expect(packed.tiddlers[personaScopedBagIds(stopped).identities]?.text, "the bootstrap entry commits the face").toBeTruthy();
      seatFaceRoute(async () => [TEST_SLOT]);
    });
  }, 300_000);
});
