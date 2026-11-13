/**
 * gate-sweep — the ONE owner of a vessel's gate sweep (T19 and T27, test-recut-road, wave 0): a transport-free stage that
 * reads carried postures, drops the sockets no longer held, and stands or stands down the gates it serves, one turn at a
 * time. Ports named by capability: reads carried postures (`readCarried`), serves a gate (`seat`), drops what a refold
 * demotes (`drop`).
 *
 * Proven with controllable promises, each with its control:
 *   · RED refresh-then-drop: the drop reads the readings THIS turn read, never the last turn's / CONTROL: an idle turn
 *     reads the same readings and drops on them;
 *   · RED serial: a second refold asked while a first reads waits its turn, so an older read never lands last /
 *     CONTROL: a refold asked while one waits unstarted joins it (one read serves both);
 *   · RED shut on a read failure: a read that throws reads as nothing carried, and every carried gate stands down /
 *     CONTROL: the next whole read stands them again;
 *   · RED close stands nothing: a turn in flight when the owner closes stands no gate and runs no after-step, and
 *     close stands every gate down / CONTROL: an open owner stands what its read names;
 *   · a seat port that answers null (the floor, or before the arm) stands nothing, and the drop still runs.
 * On the span the module does not exist, so every case reads red at the missing name.
 */
import { describe, expect, test } from "vitest";
import { gateSweep, type GateSweepSeat } from "../src/gate-sweep.js";

interface Reading { readonly aid: string; readonly posture: "open" | "private" }

/** A read the test releases by hand. */
function handRead() {
  const asks: Array<{ resolve: (r: readonly Reading[]) => void; reject: (e: unknown) => void }> = [];
  const read = (): Promise<readonly Reading[]> => new Promise((resolve, reject) => { asks.push({ resolve, reject }); });
  return { read, asks };
}

/** A seat that records what stands. */
function recordingSeat(): GateSweepSeat & { stood: Set<string>; log: string[] } {
  const stood = new Set<string>();
  const log: string[] = [];
  return {
    stood, log,
    stand(nexus) { stood.add(nexus); log.push(`stand ${nexus}`); return () => { stood.delete(nexus); log.push(`unstand ${nexus}`); }; },
  };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const nexusesOf = (readings: readonly Reading[]): readonly string[] => readings.map((r) => r.aid);

describe("the gate sweep owner", () => {
  test("RED refresh-then-drop: the drop reads the readings this turn read; CONTROL: an idle turn drops on the same", async () => {
    const { read, asks } = handRead();
    const seen: string[] = [];
    const owner = gateSweep<Reading>({ readCarried: read, nexusesOf, seat: () => null, drop: (readings) => { seen.push(readings.map((r) => `${r.aid}:${r.posture}`).join(",")); } });
    const one = owner.refold();
    await flush();
    asks[0]!.resolve([{ aid: "n", posture: "open" }]);
    await one;
    const two = owner.refold();
    await flush();
    asks[1]!.resolve([{ aid: "n", posture: "private" }]);
    await two;
    expect(seen).toEqual(["n:open", "n:private"]);               // the tightening drops on the tightened reading
    expect(owner.readings()).toEqual([{ aid: "n", posture: "private" }]);
    const three = owner.refold();                                  // CONTROL: an idle turn reads the same and drops on it
    await flush();
    asks[2]!.resolve([{ aid: "n", posture: "private" }]);
    await three;
    expect(seen.at(-1)).toBe("n:private");
  });

  test("RED serial: an older read never lands last; CONTROL: a refold asked while one waits unstarted joins it", async () => {
    const { read, asks } = handRead();
    const seat = recordingSeat();
    const owner = gateSweep<Reading>({ readCarried: read, nexusesOf, seat: () => seat, drop: () => {} });
    const first = owner.refold();
    await flush();
    const second = owner.refold();                                 // asked while the first reads
    const third = owner.refold();                                  // asked while the second waits unstarted: joins it
    await flush();
    expect(asks).toHaveLength(1);                                  // the second waits its turn
    asks[0]!.resolve([{ aid: "old", posture: "open" }]);
    await first;
    await flush();
    expect(asks).toHaveLength(2);                                  // one read serves the second and the third
    asks[1]!.resolve([{ aid: "new", posture: "open" }]);
    await Promise.all([second, third]);
    expect([...seat.stood]).toEqual(["new"]);                      // the newer read landed last
    expect(seat.log).toEqual(["stand old", "unstand old", "stand new"]);
  });

  test("RED shut on a read failure: every carried gate stands down; CONTROL: the next whole read stands them again", async () => {
    const { read, asks } = handRead();
    const seat = recordingSeat();
    const faults: unknown[] = [];
    const owner = gateSweep<Reading>({ readCarried: read, nexusesOf, seat: () => seat, drop: () => {}, onFault: (e) => faults.push(e) });
    const one = owner.refold(); await flush(); asks[0]!.resolve([{ aid: "n", posture: "open" }]); await one;
    expect([...seat.stood]).toEqual(["n"]);
    const two = owner.refold(); await flush(); asks[1]!.reject(new Error("the carried boards would not read")); await two;
    expect([...seat.stood]).toEqual([]);
    expect(owner.readings()).toEqual([]);
    expect(faults).toHaveLength(1);
    const three = owner.refold(); await flush(); asks[2]!.resolve([{ aid: "n", posture: "open" }]); await three;
    expect([...seat.stood]).toEqual(["n"]);
  });

  test("RED close stands nothing: a turn in flight at close stands no gate and runs no after-step; CONTROL: an open owner stands", async () => {
    const { read, asks } = handRead();
    const seat = recordingSeat();
    let afters = 0;
    const owner = gateSweep<Reading>({ readCarried: read, nexusesOf, seat: () => seat, drop: () => {}, after: async () => { afters++; } });
    const one = owner.refold(); await flush(); asks[0]!.resolve([{ aid: "a", posture: "open" }]); await one;
    expect([...seat.stood]).toEqual(["a"]);                        // CONTROL
    expect(afters).toBe(1);
    const inFlight = owner.refold();
    await flush();
    owner.close();                                                 // the teardown, while the read is out
    expect([...seat.stood]).toEqual([]);                           // close stands every gate down
    asks[1]!.resolve([{ aid: "a", posture: "open" }, { aid: "b", posture: "open" }]);
    await inFlight;
    expect([...seat.stood]).toEqual([]);                           // the late read stands nothing
    expect(afters).toBe(1);
    await owner.refold();                                          // a refold after close reads nothing
    expect(asks).toHaveLength(2);
  });

  test("a seat that answers null stands nothing, and the drop still runs", async () => {
    const { read, asks } = handRead();
    let drops = 0;
    const owner = gateSweep<Reading>({ readCarried: read, nexusesOf, seat: () => null, drop: () => { drops++; } });
    const one = owner.refold(); await flush(); asks[0]!.resolve([{ aid: "n", posture: "open" }]); await one;
    expect(drops).toBe(1);
  });
  test("RED a stalled after-step holds no later turn's drop (the cold read's SHOULD 1); CONTROL: after-steps still run one at a time", async () => {
    const { read, asks } = handRead();
    const drops: string[] = [];
    let release: () => void = () => {};
    let afters = 0;
    let running = 0;
    let overlapped = false;
    const owner = gateSweep<Reading>({
      readCarried: read, nexusesOf, seat: () => null,
      drop: (readings) => { drops.push(readings.map((r) => r.posture).join(",")); },
      // The first after-step stalls (a relay that never answers); the rest return at once.
      after: async () => {
        running++; if (running > 1) overlapped = true;
        try { if (afters++ === 0) await new Promise<void>((r) => { release = r; }); } finally { running--; }
      },
    });
    void owner.refold();
    await flush();
    asks[0]!.resolve([{ aid: "n", posture: "open" }]);
    await flush();
    void owner.refold();                                           // the charter tightens while the first after-step stalls
    await flush();
    expect(asks).toHaveLength(2);                                  // the second turn's read runs now
    asks[1]!.resolve([{ aid: "n", posture: "private" }]);
    await flush();
    expect(drops).toEqual(["open", "private"]);                    // and its drop with it, past the stalled after-step
    release();
    await flush();
    expect(overlapped).toBe(false);                                // CONTROL: no two after-steps ran at once
    expect(afters).toBe(2);
  });
});
