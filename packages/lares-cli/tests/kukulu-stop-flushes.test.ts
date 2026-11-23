/**
 * kukulu-stop-flushes — the restand that replaces a standing vessel flushes every shore, and the rite says so before it moves.
 *
 * `lares rite kukulu` replaces a standing vessel through the shim's down path (`compose stop` / `down`: SIGTERM, then Docker's
 * stop grace). The node's graceful stop runs the teardown's flush phase, which asks every resident island with a mirror to
 * flush before any island goes down (lararium-node `shore-flush-stand-down`). The rite names that before the raise, with what
 * to do where the stop runs past its grace; a vessel that stands down already, or one the restand leaves standing on its
 * image, hears no such line.
 *
 * Every rite port answers from a FAKE.
 */
import { describe, expect, it } from "vitest";
import { riteKukulu, type RitePorts, type StandReading } from "../src/rite-kukulu.js";

const HEAD = "a".repeat(40), IMAGE = "sha256:" + "ab".repeat(32);
const READING: StandReading = { revision: HEAD, image: IMAGE, how: "built", vessel: "standing", current: false, pulama: "off", lit: null, admitted: null, offer: false };
const ABSENT = { ok: false as const, code: "swarm-lei-absent", message: "no lei" };

function fakes(reading: StandReading) {
  const timeline: string[] = [];
  const ports: RitePorts = {
    checkout: async () => ({ head: HEAD, branch: "main" }),
    stage: async () => ({ code: 0, reading }),
    raise: async () => { timeline.push("RAISE"); return 0; },
    tty: () => false,
    row: async () => ABSENT,
    say: (line) => { timeline.push(line); },
  };
  return { ports, timeline };
}

const FLUSH_LINE = /the restand stops the standing vessel gracefully .*its teardown flushes every shore/;

describe("kukulu names the stop's shore flush before it replaces a standing vessel", () => {
  it("RED: over a standing vessel on an older image, the rite says the stop flushes every shore, and what to do past the grace, before the raise", async () => {
    const f = fakes(READING);
    await riteKukulu(f.ports, {});
    const at = f.timeline.findIndex((l) => FLUSH_LINE.test(l));
    expect(at, f.timeline.join("\n")).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(f.timeline.indexOf("RAISE"));
    const line = f.timeline[at]!;
    expect(line).toMatch(/grace/);
    expect(line).toMatch(/lares shore flush/);
    expect(line).toMatch(/the daemon and the active wiki/);
  });

  it("CONTROL: a vessel already down, or one that runs the image already (a quiet day), hears no stop line", async () => {
    for (const reading of [{ ...READING, vessel: "down" as const }, { ...READING, current: true }]) {
      const f = fakes(reading);
      await riteKukulu(f.ports, {});
      expect(f.timeline.some((l) => FLUSH_LINE.test(l))).toBe(false);
      expect(f.timeline).toContain("RAISE");
    }
  });
});
