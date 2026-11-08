/**
 * THE LIVE WAKE, NODE ISLAND: the node island reads its founder's standing across the port from the vessel's edge-shadow
 * ring (`ringDyadDoor`, the door the vessel serves), while the island's own replica of the fleet board carries the move that
 * wakes the seat. A founder lift reaches the joinee's seat through the production composition with no daemon-layer change;
 * the ring's reading goes dark on the move and the door refolds before it answers. CONTROL: the daemon-layer wake the
 * composition already carried seats the joinee, so the fixture itself can seat.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const boot = vi.hoisted(() => ({ kh: null as null | Record<string, unknown> }));
vi.mock("@lararium/keyhive/boot-daemon-keyhive", () => ({ bootDaemonKeyhive: async () => ({ keyhive: boot.kh }) }));
vi.mock("@lararium/keyhive/face-grant-record", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  verifyFaceGrantRecord: async (record: { founderEdge: { deviceVerifyingKey: string } }, context: { dyad?: (key: string) => string }) =>
    context.dyad?.(record.founderEdge.deviceVerifyingKey) === "aside" ? { ok: false, reason: "founder aside" } : { ok: true },
}));
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { makeEdgeShadowRing, ringDyadDoor, type EdgeShadowRing } from "../src/edge-shadow-ring.js";
import { recordingKeyhive, standJoineeSeat, until, quiesce } from "../../lararium-keyhive/tests/face-seat-wake-fixture.js";

describe("the node island's seat wakes through the vessel's ring door", () => {
  let stop: (() => Promise<void>) | null = null;
  afterEach(async () => { await stop?.(); stop = null; vi.restoreAllMocks(); });

  const stand = async (seedByte: number) => {
    const kh = recordingKeyhive();
    boot.kh = kh;
    vi.spyOn(console, "log").mockImplementation(() => {});
    let ring: EdgeShadowRing | null = null;
    const seat = await standJoineeSeat({
      operatorDaemonOptions: operatorDaemonOptions as never, seedByte,
      extra: async ({ repo, root, joinee, lineage }) => {
        ring = makeEdgeShadowRing({
          repo: repo as never, vesselKey: () => joinee, sealHome: mkdtempSync(join(tmpdir(), "seal-")), fleetRoots: () => [root],
          lineageOfFleet: () => lineage as never, vesselKeyOfPeer: () => null, realmNymOfPeer: () => null,
        });
        await ring.refold();
        return { dyadReading: ringDyadDoor(ring) };
      },
    });
    await seat.boot();
    stop = async () => { for (const d of kh.disposers) d(); ring?.dispose(); await seat.shutdown(); };
    expect(ring!.deviceStanding(seat.root, seat.founder), "the vessel's ring reads the founder aside at boot").toBe("aside");
    expect(kh.ingests).toBe(0);
    await quiesce();
    return { kh, seat, ring: ring! };
  };

  test("a founder lift seats the joinee off the ring's refold, with no daemon-layer change", async () => {
    const { kh, seat, ring } = await stand(161);
    await seat.lift();
    expect(await until(() => kh.ingests > 0), "the lift woke the seat, and the door answered past the ring's dark reading").toBe(true);
    expect(ring.deviceStanding(seat.root, seat.founder), "the ring's own refold reads the lift").toBe("owing");
    await quiesce();
    expect(kh.ingests, "one grant, one ingest").toBe(1);
  });

  test("CONTROL: the daemon-layer wake the composition already carried seats the joinee", async () => {
    const { kh, seat } = await stand(171);
    await seat.lift();
    seat.daemonTouch();
    expect(await until(() => kh.ingests > 0)).toBe(true);
    await quiesce();
    expect(kh.ingests).toBe(1);
  });
});
