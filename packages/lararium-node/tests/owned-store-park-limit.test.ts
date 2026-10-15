/**
 * owned-store — the park's own COUNT bound (M8′).
 *
 * A booting "vessel" holder parks every caller that arrives before its verb channel takes the claim
 * over (`serve`) — a caller's invocation waits, unread, for that hand-over. Before this, nothing
 * bounded how many callers could park at once: a boot storm that outpaced the vessel's own open of
 * its verb channel grew that map without limit. This proves the bound: past `parkLimit`, the OLDEST
 * parked caller is evicted with a NAMED refusal (never silently dropped), by insertion order (never
 * JS key order, never a clock) — and every caller still within the bound is replayed, unconditionally,
 * once `serve` takes the claim over.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rendezvousPath } from "@lararium/mesh/rendezvous-path";
import { claimStore } from "../src/owned-store.js";
import { arrival, type Arrival } from "../../lararium-mesh/tests/handshake.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "lares-park-limit-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const socketOf = (d: string): string => rendezvousPath({ root: d, uid: process.getuid?.() ?? 0 });

/** Connect, write a verb line, collect the full reply (resolves on `end`). Never resolves early — a
 *  parked caller gets no bytes back until eviction or hand-over, so this is the honest "still parked"
 *  read: callers race it against a short grace window in the test body. */
function openAndSend(path: string, verb: string): { sock: Socket; reply: Promise<string> } {
  const sock = createConnection(path);
  let buf = "";
  const reply = new Promise<string>((resolve, reject) => {
    sock.setEncoding("utf8");
    sock.on("connect", () => sock.write(JSON.stringify({ verb }) + "\n"));
    sock.on("data", (c: string) => { buf += c; });
    sock.on("end", () => resolve(buf));
    sock.on("error", reject);
  });
  return { sock, reply };
}

/**
 * The park's own word for "this caller's line stands parked" (`onPark`), kept per verb. A vector opens a caller
 * and waits for that word before it opens the next, so the park's order follows the vector's order on any machine
 * and no pause stands in for "the park read the line".
 */
function parkEar(): { onPark: (verb: string) => void; parked: (verb: string) => Promise<void> } {
  const words = new Map<string, Arrival<void>>();
  const of = (verb: string): Arrival<void> => {
    let word = words.get(verb);
    if (!word) { word = arrival<void>(`the park reading the line of verb "${verb}"`); words.set(verb, word); }
    return word;
  };
  return { onPark: (verb) => { of(verb).arrive(); }, parked: (verb) => of(verb).arrived };
}

function settledWithin(p: Promise<unknown>, ms: number): Promise<"settled" | "pending"> {
  return Promise.race([p.then(() => "settled" as const), new Promise<"pending">((r) => setTimeout(() => r("pending"), ms))]);
}

describe("owned-store park — a COUNT bound, never an age bound (M8′)", () => {
  it("★ RED→cure: past parkLimit, the OLDEST parked caller is evicted by a NAMED refusal; the rest stay parked ★", async () => {
    const ear = parkEar();
    const claim = await claimStore(dir, { holder: "vessel", parkLimit: 3, onPark: ear.onPark });
    try {
      const path = socketOf(dir);
      // One caller at a time, each parked by the park's own word before the next connects: "a" stands oldest
      // because the park read it first, never because three dials happened to land in the order they started.
      const callers: Array<ReturnType<typeof openAndSend>> = [];
      for (const verb of ["a", "b", "c"]) {
        callers.push(openAndSend(path, verb));
        await ear.parked(verb);
      }
      for (const c of callers) {
        expect(await settledWithin(c.reply, 50), "a caller within the bound must still be parked, unanswered").toBe("pending");
      }

      // The 4th caller pushes the park past its limit — the OLDEST ("a") must be evicted NOW, by name.
      const fourth = openAndSend(path, "d");
      const oldestReply = await callers[0]!.reply; // "a" — must resolve (evicted), never hang
      expect(oldestReply).toMatch(/evicted from the park past PARK_LIMIT=3/);
      expect(oldestReply).toMatch(/verb \\"a\\"/);

      // "b", "c", and the newly-arrived "d" all stay parked — the eviction took exactly one.
      await ear.parked("d");
      expect(await settledWithin(callers[1]!.reply, 50)).toBe("pending");
      expect(await settledWithin(callers[2]!.reply, 50)).toBe("pending");
      expect(await settledWithin(fourth.reply, 50)).toBe("pending");

      for (const c of [callers[1]!, callers[2]!, fourth]) c.sock.destroy();
    } finally {
      await claim.release();
    }
  });

  it("CONTROL: within parkLimit, nothing is evicted, and every caller replays once `serve` takes over", async () => {
    const ear = parkEar();
    const claim = await claimStore(dir, { holder: "vessel", parkLimit: 3, onPark: ear.onPark });
    try {
      const path = socketOf(dir);
      const callers = [openAndSend(path, "x"), openAndSend(path, "y")];
      await Promise.all([ear.parked("x"), ear.parked("y")]);
      for (const c of callers) {
        expect(await settledWithin(c.reply, 50)).toBe("pending");
      }
      const seen: string[] = [];
      claim.serve((sock) => {
        let buf = "";
        sock.setEncoding("utf8");
        sock.on("data", (chunk: string) => {
          buf += chunk;
          const nl = buf.indexOf("\n");
          if (nl === -1) return;
          const line = JSON.parse(buf.slice(0, nl)) as { verb: string };
          seen.push(line.verb);
          sock.end(JSON.stringify({ status: "done", requestId: "r" }) + "\n");
        });
      });
      await callers[0]!.reply;
      await callers[1]!.reply;
      expect(seen.sort()).toEqual(["x", "y"]);
    } finally {
      claim.refuse("done");
      await claim.release();
    }
  });

  it("CONTROL: the default parkLimit (PARK_LIMIT) requires no caller-side option", async () => {
    const ear = parkEar();
    const claim = await claimStore(dir, { holder: "vessel", onPark: ear.onPark });
    try {
      const path = socketOf(dir);
      const c = openAndSend(path, "solo");
      await ear.parked("solo");
      expect(await settledWithin(c.reply, 50)).toBe("pending"); // a lone caller well under any sane default stays parked
      c.sock.destroy();
    } finally {
      await claim.release();
    }
  });
});
