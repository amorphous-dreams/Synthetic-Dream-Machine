/**
 * The custody door on the verb socket: `unlock`, `lock` and `custody` frames, handled ahead of every verb.
 *
 *   F1  a frame of any other shape passes the door untouched (the verb seat's).       control: a custody frame stays
 *   F2  an unlock that opens recomposes sovereign ONCE; one that opens nothing recomposes nothing.
 *   F3  a lock on an unlocked holder drops the key and recomposes at the floor; on a locked one it does neither.
 *   F4  two unlocks sent together stand ONE sovereign composition.
 *   F5  nothing the door logs or answers carries the credential.
 *   F6  a recomposition that throws answers its own caller by name and leaves the door serving the next frame.
 *   F7  an unlock frame with no usable credential refuses before the holder hears of it.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder, HolderUnlock } from "../src/custody-holder.js";

const RIGHT = "frames-test-passphrase-right";

function fakeSock(): { sock: Socket; answer: Promise<Record<string, unknown>> } {
  let settle!: (a: Record<string, unknown>) => void;
  const answer = new Promise<Record<string, unknown>>((r) => { settle = r; });
  const sock = Object.assign(new EventEmitter(), { end: (line: string) => settle(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
  return { sock, answer };
}

function harness(opts: { recomposeThrows?: boolean } = {}) {
  let unlocked = false;
  let spent = 0;
  const heard: unknown[] = [];
  const holder: CustodyHolder = {
    unlock: async (creds): Promise<HolderUnlock> => {
      heard.push(creds);
      if (unlocked) return { reading: "already-unlocked" };
      const ok = creds.some((c) => c.kind === "passphrase" && c.passphrase === RIGHT);
      if (!ok) { spent += 1; return { reading: "no-slot-opens", attemptsLeft: 3 - spent }; }
      unlocked = true;
      return { reading: "opens", slot: "slot-1" };
    },
    lock: async () => { unlocked = false; },
    isUnlocked: () => unlocked,
    attemptsLeft: () => 3 - spent,
    openedSlot: () => (unlocked ? "slot-1" : null),
    readRow: async () => ({ reading: "locked" }),
    writeRow: async () => {},
    openColdRow: async () => { throw new Error("unused"); },
    derive: () => new Uint8Array(),
  };
  const recomposed: boolean[] = [];
  const logs: string[] = [];
  const handle = custodyFrameHandler({
    holder, testScratch: false,
    standing: () => "herm",
    recompose: async (sovereign) => {
      recomposed.push(sovereign);
      await new Promise((r) => setTimeout(r, 15));
      if (opts.recomposeThrows) throw new Error("the composition fell over");
      return { standing: sovereign ? "hearth" : "herm" };
    },
    onLog: (line) => logs.push(line),
  });
  const send = (frame: unknown): { consumed: boolean; answer: Promise<Record<string, unknown>> } => {
    const { sock, answer } = fakeSock();
    return { consumed: handle(frame, sock), answer };
  };
  return { send, recomposed, logs, heard, holder };
}

const unlockFrame = (passphrase: string) => ({ op: "unlock", credentials: [{ kind: "passphrase", passphrase }] });

describe("the custody door", () => {
  test("F1 — a verb, a receipt query and a cancel pass the door; a custody frame stays", () => {
    const h = harness();
    expect(h.send({ verb: "meme-get", requestedBy: "did:key:x" }).consumed).toBe(false);
    expect(h.send({ op: "receipt", requestId: "r" }).consumed).toBe(false);
    expect(h.send({ op: "cancel", requestId: "r" }).consumed).toBe(false);
    expect(h.send(null).consumed).toBe(false);
    expect(h.send({ op: "custody" }).consumed).toBe(true);
  });

  test("F2 — an opening unlock recomposes sovereign once; a miss recomposes nothing", async () => {
    const h = harness();
    const miss = await h.send(unlockFrame("wrong")).answer;
    expect(miss).toMatchObject({ op: "unlock", reading: "no-slot-opens", attemptsLeft: 2, standing: "herm" });
    expect(h.recomposed).toEqual([]);
    const hit = await h.send(unlockFrame(RIGHT)).answer;
    expect(hit).toMatchObject({ op: "unlock", reading: "opens", slot: "slot-1", standing: "hearth" });
    expect(h.recomposed).toEqual([true]);
  });

  test("F3 — lock drops the key and recomposes at the floor; a second lock does neither", async () => {
    const h = harness();
    await h.send(unlockFrame(RIGHT)).answer;
    expect(await h.send({ op: "lock" }).answer).toMatchObject({ op: "lock", locked: true, was: "unlocked", standing: "herm" });
    expect(h.holder.isUnlocked()).toBe(false);
    expect(h.recomposed).toEqual([true, false]);
    expect(await h.send({ op: "lock" }).answer).toMatchObject({ locked: true, was: "locked" });
    expect(h.recomposed).toEqual([true, false]);
    expect(await h.send({ op: "custody" }).answer).toMatchObject({ op: "custody", unlocked: false, slot: null, attemptsLeft: 3, standing: "herm" });
  });

  test("F4 — two unlocks sent together stand one sovereign composition", async () => {
    const h = harness();
    const [a, b] = [h.send(unlockFrame(RIGHT)), h.send(unlockFrame(RIGHT))];
    const answers = [await a.answer, await b.answer].map((x) => x["reading"]);
    expect(answers.sort()).toEqual(["already-unlocked", "opens"]);
    expect(h.recomposed).toEqual([true]);
  });

  test("F5 — no log line and no answer carries the credential", async () => {
    const h = harness();
    const answers = [await h.send(unlockFrame("a-wrong-secret-guess")).answer, await h.send(unlockFrame(RIGHT)).answer];
    const spoken = JSON.stringify(answers) + h.logs.join("\n");
    expect(spoken).not.toContain(RIGHT);
    expect(spoken).not.toContain("a-wrong-secret-guess");
    expect(h.logs.join("\n")).toContain("slot slot-1");          // CONTROL: the door did log, and logged the slot
  });

  test("F6 — a recomposition that throws names itself to its caller; the door serves the next frame", async () => {
    const h = harness({ recomposeThrows: true });
    expect(await h.send(unlockFrame(RIGHT)).answer).toMatchObject({ status: "error", refusal: { reason: "custody-act-failed" }, errorMessage: "the composition fell over" });
    expect(await h.send({ op: "custody" }).answer).toMatchObject({ op: "custody", unlocked: true });
  });

  test("F7 — an unlock with no usable credential refuses before the holder hears of it", async () => {
    const h = harness();
    for (const bad of [{ op: "unlock" }, { op: "unlock", credentials: [] }, { op: "unlock", credentials: [{ kind: "passphrase" }] }, { op: "unlock", credentials: "x" }]) {
      expect(await h.send(bad).answer).toMatchObject({ status: "error", refusal: { reason: "bad-custody-frame" } });
    }
    expect(h.heard).toEqual([]);
    expect(h.recomposed).toEqual([]);
  });
});
