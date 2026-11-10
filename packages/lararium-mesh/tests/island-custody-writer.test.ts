/**
 * island-custody-writer — a daemon island's custody write crosses its port to the vessel's record.
 *
 * The browser's daemon island stood no Archive writer, so its key shore's `restArchive` threw "no Archive writer stands
 * on this shore" and every seal under a lit face refused `wrap-failed`: each save waited in memory (`save-unsealed`) and
 * the page's control events never settled (e2e stage-walk S6). `islandCustodyWriter` asks `custody:write` over the port;
 * `answerIslandAsks` answers it through the lift's `custodyWrite`.
 */
import { describe, expect, test } from "vitest";
import { answerIslandAsks, islandCustodyWriter, type CapabilityRecord } from "../src/index.js";

function pair(): { island: { post(m: unknown): void; listen(cb: (m: unknown) => void): () => void }; vessel: { post(m: unknown): void; listen(cb: (m: unknown) => void): () => void } } {
  const toVessel = new Set<(m: unknown) => void>();
  const toIsland = new Set<(m: unknown) => void>();
  const end = (out: Set<(m: unknown) => void>, inn: Set<(m: unknown) => void>) => ({
    post: (m: unknown) => { queueMicrotask(() => { for (const cb of [...out]) cb(m); }); },
    listen: (cb: (m: unknown) => void) => { inn.add(cb); return () => { inn.delete(cb); }; },
  });
  return { island: end(toVessel, toIsland), vessel: end(toIsland, toVessel) };
}

describe("the island's custody write", () => {
  test("RED: the bytes reach the lift's custodyWrite, and an unseated lift rejects by name", async () => {
    const { island, vessel } = pair();
    const written: Array<{ carrier: string; bytes: number[] }> = [];
    const caps = { custodyWrite: async (carrier: string, bytes: Uint8Array) => { written.push({ carrier, bytes: [...bytes] }); } } as unknown as CapabilityRecord;
    const stop = answerIslandAsks(vessel, caps);
    const write = islandCustodyWriter(island, { idPrefix: "t" });
    await write("veil", Uint8Array.of(1, 2, 3));
    expect(written).toEqual([{ carrier: "veil", bytes: [1, 2, 3] }]);
    stop();
    const bare = pair();
    answerIslandAsks(bare.vessel, {} as CapabilityRecord);
    await expect(islandCustodyWriter(bare.island, { idPrefix: "u" })("veil", Uint8Array.of(4))).rejects.toThrow(/did not seal the veil carrier/);
  });
});
