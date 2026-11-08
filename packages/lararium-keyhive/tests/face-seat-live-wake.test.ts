/**
 * THE LIVE WAKE, BROWSER ISLAND: a founder lift on the fleet board reaches the joinee's seat through the composition the
 * browser island stands (`readDyadFromBoard`: the island folds its own replica), with no daemon-layer change and no test
 * hand on `daemonChanged`. CONTROL: a board move that leaves the founder aside re-reads and seats nothing.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { recordingKeyhive, standJoineeSeat, until, quiesce, type RecordingKeyhive } from "./face-seat-wake-fixture.js";

const boot = vi.hoisted(() => ({ kh: null as null | RecordingKeyhive }));
vi.mock("../src/boot-daemon-keyhive.js", () => ({ bootDaemonKeyhive: async () => ({ keyhive: boot.kh }) }));
vi.mock("../src/face-grant-record.js", async (original) => ({
  ...(await original<typeof import("../src/face-grant-record.js")>()),
  // The grant's own signature stands in: the verdict reads the founder's standing the seat hands it, as the real one does.
  verifyFaceGrantRecord: async (record: { founderEdge: { deviceVerifyingKey: string } }, context: { dyad?: (key: string) => string }) =>
    context.dyad?.(record.founderEdge.deviceVerifyingKey) === "aside" ? { ok: false, reason: "founder aside" } : { ok: true },
}));
import { operatorDaemonOptions } from "../src/operator-daemon-behavior.js";

const refusals = (log: ReturnType<typeof vi.spyOn>) =>
  log.mock.calls.filter(([m]) => typeof m === "string" && /face-join grant record REFUSED .*founder aside/.test(m)).length;

describe("the browser island's seat wakes on its own fleet replica", () => {
  let stop: (() => Promise<void>) | null = null;
  afterEach(async () => { await stop?.(); stop = null; vi.restoreAllMocks(); });

  const stand = async (seedByte: number) => {
    const kh = recordingKeyhive();
    boot.kh = kh;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const seat = await standJoineeSeat({ operatorDaemonOptions: operatorDaemonOptions as never, seedByte, extra: () => ({ readDyadFromBoard: true }) });
    await seat.boot();
    stop = async () => { for (const d of kh.disposers) d(); await seat.repo.shutdown(); };
    expect(refusals(log), "the boot's pass read the founder aside").toBeGreaterThan(0);
    expect(kh.ingests).toBe(0);
    await quiesce();
    return { kh, log, seat, settledRefusals: refusals(log) };
  };

  test("a founder lift on the board seats the joinee with no daemon-layer change", async () => {
    const { kh, seat } = await stand(141);
    await seat.lift();
    expect(await until(() => kh.ingests > 0), "the lift woke the seat through the island's own board replica").toBe(true);
    expect(kh.known).toBe(true);
    await quiesce();
    expect(kh.ingests, "one grant, one ingest").toBe(1);
  });

  test("CONTROL: the fixture seats on the daemon-layer wake the composition already carried", async () => {
    const { kh, seat } = await stand(146);
    await seat.lift();
    seat.daemonTouch();
    expect(await until(() => kh.ingests > 0), "a daemon-layer change after the lift seats the joinee").toBe(true);
    await quiesce();
    expect(kh.ingests).toBe(1);
  });

  test("a board move that leaves the founder aside re-reads and seats nothing", async () => {
    const { kh, log, seat, settledRefusals } = await stand(151);
    seat.noise();
    expect(await until(() => refusals(log) > settledRefusals), "the move woke the seat").toBe(true);
    await quiesce();
    expect(kh.ingests).toBe(0);
    expect(kh.known).toBe(false);
  });
});
