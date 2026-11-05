/**
 * ward-credential — one ward act's route lives for that act alone (seat-harness#/the-ward). No module holds a route between
 * acts or lends one to a concurrent act; a store verb names its route by a one-use ticket bound to that verb and its arguments.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import { wardCredential, wardCredentialsOf } from "../src/ward-credential.js";
import { custodyFrameHandler } from "../src/custody-frames.js";
import type { CustodyHolder } from "../src/custody-holder.js";

const route = (passphrase: string) => [{ kind: "passphrase" as const, passphrase }];

describe("no route outlives its act (S2 cold read, P1-1)", () => {
  test("RED: overlapping unlock acts leave no route behind and lend none to a concurrent act; CONTROL: the unlock hands its route to the composition it stands, as an argument", async () => {
    const wc = await import("../src/ward-credential.js") as unknown as Record<string, unknown>;
    if (typeof wc["duringUnlockAct"] === "function") {
      const during = wc["duringUnlockAct"] as (w: unknown, act: () => Promise<void>) => Promise<void>;
      const read = wc["unlockActWard"] as () => unknown;
      let releaseA!: () => void, releaseB!: () => void;
      const a = during(wardCredential(route("A")), () => new Promise<void>((r) => { releaseA = r; }));
      const b = during(wardCredential(route("B")), () => new Promise<void>((r) => { releaseB = r; }));
      const borrowed = read();
      releaseA(); await a; releaseB(); await b;
      expect(borrowed, "a concurrent act borrowed a running act's route").toBeUndefined();
      expect(read(), "a route outlived both acts").toBeUndefined();
    }
    expect(wc["unlockActWard"], "no module-global route reader stands").toBeUndefined();
    expect(wc["duringUnlockAct"], "no module-global route setter stands").toBeUndefined();

    // CONTROL: the unlock frame hands its own route to the recompose it runs, and to nothing else.
    const handed: unknown[] = [];
    let unlocked = false;
    const holder = {
      unlock: async () => { unlocked = true; return { reading: "opens", slot: "s" }; },
      unlockFaces: async () => [], unlockedFaces: () => [], isUnlocked: () => unlocked, faceStanding: async () => null,
    } as unknown as CustodyHolder;
    const handle = custodyFrameHandler({
      holder, testScratch: false, standing: () => "herm", onLog: () => {},
      recompose: async (_sovereign: boolean, ward?: unknown) => { handed.push(ward); return { standing: "hearth" }; },
    } as never);
    const answered = new Promise<void>((resolve) => {
      const sock = Object.assign(new EventEmitter(), { end: () => resolve() }) as unknown as Socket;
      handle({ op: "unlock", credentials: route("the unlock's route") }, sock);
    });
    await answered;
    expect(handed).toHaveLength(1);
    expect(wardCredentialsOf(handed[0] as never)).toEqual(route("the unlock's route"));
  });
});
