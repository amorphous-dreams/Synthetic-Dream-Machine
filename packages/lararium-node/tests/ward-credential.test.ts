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

describe("a ticket names its act (S2 cold read, P2-1)", () => {
  const W = () => wardCredential(route("the hand's route"));
  const ARGS = { digest: "d".repeat(64), wiki: "daemon" };
  test("RED: a ticket spent on another verb, on other arguments, or by a racer who read its ref refuses and burns; CONTROL: its own act spends it once", async () => {
    const wc = await import("../src/ward-credential.js") as unknown as {
      parkWardTicket: (w: unknown, bind?: unknown) => string; takeWardTicket: (raw: unknown, use?: unknown) => unknown; wardBindOf?: unknown;
    };
    const park = (args = ARGS, verb = "promote-commit") => wc.parkWardTicket(W(), { verb, args });
    const tryTake = (ref: string, verb: string, args: Record<string, unknown>): unknown => {
      try { return wc.takeWardTicket(ref, { verb, args }); } catch (e) { return e; }
    };
    // Another verb.
    const a = park();
    expect(String(tryTake(a, "kapae-lower", ARGS))).toMatch(/ward-ticket-mismatch/);
    expect(tryTake(a, "promote-commit", ARGS), "a mismatch burns the ticket").toBeUndefined();
    // Other arguments.
    const b = park();
    expect(String(tryTake(b, "promote-commit", { ...ARGS, digest: "e".repeat(64) }))).toMatch(/ward-ticket-mismatch/);
    expect(tryTake(b, "promote-commit", ARGS)).toBeUndefined();
    // A racer who read the ref off the daemon document and spends it on its own act.
    const c = park();
    expect(String(tryTake(c, "promote-commit", { ...ARGS, wiki: "kahua" }))).toMatch(/ward-ticket-mismatch/);
    expect(tryTake(c, "promote-commit", ARGS)).toBeUndefined();
    // CONTROL: the act it names spends it, once; the session's own face keys never move the binding.
    const d = park();
    const spent = tryTake(d, "promote-commit", { ...ARGS, face: 0, handleIndex: 0, wardRef: d });
    expect(wardCredentialsOf(spent as never)).toEqual(route("the hand's route"));
    expect(tryTake(d, "promote-commit", ARGS), "a ticket spends once").toBeUndefined();
  });

  test("RED: a lock drops every parked ticket, and no more than four stand; CONTROL: a ticket parked after the lock spends", async () => {
    const wc = await import("../src/ward-credential.js") as unknown as {
      parkWardTicket: (w: unknown, bind?: unknown) => string; takeWardTicket: (raw: unknown, use?: unknown) => unknown; dropWardTickets: () => void;
    };
    const bind = { verb: "swarm-go-issue", args: { branch: "x", head: "h" } };
    const parked = wc.parkWardTicket(W(), bind);
    wc.dropWardTickets();
    expect(wc.takeWardTicket(parked, bind)).toBeUndefined();
    const five = [1, 2, 3, 4, 5].map(() => wc.parkWardTicket(W(), bind));
    expect(wc.takeWardTicket(five[0], bind), "the oldest falls out past four").toBeUndefined();
    expect(wc.takeWardTicket(five[4], bind)).toBeDefined();
  });
});
