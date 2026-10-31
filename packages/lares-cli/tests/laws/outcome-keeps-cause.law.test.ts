/**
 * L9 · A NAMED OUTCOME KEEPS ITS CAUSE AND ITS EXIT CLASS.
 *
 * A refusal or failure names its cause by a stable code, and that code maps to one exit class; two
 * distinct causes never collapse into one code, and an unnamed cause never borrows another's name.
 *
 * Inputs: the live `EXIT_FOR` table (every code), the reasons `refusalCode` maps (tabulated from the
 * receipt/refusal census rows), the typed faults `verbFailure` and `storeFailure` tell apart, the
 * four vessel states `conditionExit` carries outward, and generated unknown reasons.
 * Seeds: the exit class each census row names (usage 2 · cause-less fault 1 · nothing answered 3 ·
 * conflict and verb-error 4 · cap-denied 5 · outcome-unknown family 6). Control: a fault that names
 * nothing keeps the command's fallback word, and a distinct-cause check that reads red on a fused map.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import { fc } from "@fast-check/vitest";
import "./fixed-seed.js";
import { EXIT_FOR, exitFor } from "../../src/render.js";
import { DaemonUnreachable, refusalCode, refusalHint, verbFailure } from "../../src/verb-call.js";
import { LocalWaitExpired } from "../../src/local-connector.js";
import { RoutedVerbRefused, SlowBootTimeout, storeFailure } from "../../src/store-door.js";
import { NexusKapaeError, StoreHeld } from "@lararium/node";
import { EXIT_PARTIAL, conditionExit, vesselCondition, type VesselState } from "../../src/vessel-condition.js";
import { UNKNOWN, door } from "./harness.js";

/** The reasons a vessel's refusal channel names, each with the code it travels under (seed table). */
const REASONS: ReadonlyArray<readonly [reason: string, code: string]> = [
  ["abandoned", "request-abandoned"],
  ["interrupted", "request-interrupted"],
  ["request-id-reused-with-changed-input", "request-id-reused"],
  ["retention-gap", "retention-gap"],
  ["receipt-fact-torn", "receipt-fact-torn"],
  ["bag-retired", "bag-retired"],
  ["waking-floor", "waking-floor"],
  ["no-container", "no-container"],
  ["cap-denied", "cap-denied"],
  ["crossing-outward", "crossing-outward"],
];

/** The exit class each named code keeps (seed table, read from the census rows' assertions). */
const CLASSES: ReadonlyArray<readonly [code: string, exit: number]> = [
  ["ok", 0], ["error", 1],
  ["usage", 2], ["request-id-reused", 2], ["bag-retired", 2], ["no-container", 2], ["waking-floor", 2],
  ["not-found", 3], ["daemon-unreachable", 3], ["store-door-timeout", 3],
  ["conflict", 4], ["verb-error", 4], ["cancel-lost", 4], ["store-held", 4],
  ["cap-denied", 5], ["crossing-outward", 5],
  ["outcome-unknown", 6], ["request-abandoned", 6], ["request-interrupted", 6], ["retention-gap", 6], ["receipt-fact-torn", 6],
];

describe("L9 · a named outcome keeps its cause and its exit class", () => {
  describe("the exit table", () => {
    test.each(Object.keys(EXIT_FOR).map((c) => [c]))("code `%s` maps to one exit inside 0..6", (code) => {
      expect(Number.isInteger(EXIT_FOR[code])).toBe(true);
      expect(exitFor(code)).toBe(EXIT_FOR[code]);
      expect(exitFor(code)).toBeGreaterThanOrEqual(0);
      expect(exitFor(code)).toBeLessThanOrEqual(6);
    });

    test.each(CLASSES.map(([c, e]) => [c, e] as [string, number]))("`%s` keeps exit class %i", (code, exit) => {
      expect(exitFor(code)).toBe(exit);
    });

    test("every tabulated class names a live code, so the table cannot drift away from the seed", () => {
      for (const [code] of CLASSES) expect(Object.keys(EXIT_FOR)).toContain(code);
    });

    test("only a failure that names no cause reads exit 1; any nonzero code besides `error` outranks it", () => {
      for (const [code, exit] of Object.entries(EXIT_FOR)) if (code !== "error" && code !== "ok") expect(exit).toBeGreaterThanOrEqual(2);
    });

    test("an unknown code falls to the generic failure class", () => {
      expect(exitFor(UNKNOWN)).toBe(1);
    });
  });

  describe("refusalCode keeps each reason as its own code", () => {
    test.each(REASONS.map(([r, c]) => [r, c]))("reason `%s` travels as `%s`, a live code with an exit", (reason, code) => {
      expect(refusalCode(reason)).toBe(code);
      expect(Object.keys(EXIT_FOR)).toContain(code);
    });

    test("distinct reasons never fuse into one code", () => {
      const codes = REASONS.map(([r]) => refusalCode(r));
      expect(new Set(codes).size).toBe(REASONS.length);
    });

    test("distinct causes in the outcome-unknown family keep distinct codes beside one exit class", () => {
      // Each cause made by its own producer: a wait that expired, and the four refusals a vessel names.
      const family = [
        verbFailure(new LocalWaitExpired("recall", 1, "req-w")).code,
        ...["abandoned", "interrupted", "retention-gap", "receipt-fact-torn"].map(refusalCode),
        ...["abandoned", "interrupted", "retention-gap", "receipt-fact-torn"].map((r) => storeFailure(new RoutedVerbRefused("refused", r)).code),
      ];
      expect(new Set(family.slice(0, 5)).size).toBe(5);
      expect(family.slice(5)).toEqual(family.slice(1, 5));   // the store door names each refusal as the verb door does
      expect(new Set(family.map(exitFor))).toEqual(new Set([6]));
    });

    test.each(REASONS.map(([r, c]) => [c, r]))("the cure for `%s` (when one stands) rides the code, never the reason spelling", (code) => {
      const h = refusalHint(code, "cid-9");
      if (h !== undefined) expect(h.length).toBeGreaterThan(0);
    });

    test("an unrecognized reason falls to verb-error, exit 4 (CONTROL: the fallback is not a named code)", () => {
      expect(refusalCode("some-future-reason")).toBe("verb-error");
      expect(exitFor(refusalCode("some-future-reason"))).toBe(4);
    });

    test("generated unknown reasons fall to verb-error and carry no cure", () => {
      const known = new Set(REASONS.map(([r]) => r));
      fc.assert(fc.property(fc.string({ minLength: 1 }).filter((s) => !known.has(s)), (reason) => {
        expect(refusalCode(reason)).toBe("verb-error");
        expect(refusalHint("verb-error", undefined)).toBeUndefined();
      }));
    });

    test("CONTROL: a fused map reads red — collapsing two reasons to one code breaks the distinctness check", () => {
      const fused = REASONS.map(([r]) => (r === "abandoned" ? "request-interrupted" : refusalCode(r)));
      expect(new Set(fused).size).toBeLessThan(REASONS.length);
    });
  });

  describe("verbFailure tells a fault by its type", () => {
    const FAULTS: ReadonlyArray<readonly [string, () => unknown, string]> = [
      ["LocalWaitExpired", () => new LocalWaitExpired("recall", 5_000, "req-abc"), "outcome-unknown"],
      ["DaemonUnreachable", () => new DaemonUnreachable("/tmp/does-not-exist.sock"), "daemon-unreachable"],
      ["a bare Error", () => new Error("the island refused for its own reasons"), "verb-error"],
      ["a non-Error throw", () => "a bare string throw", "verb-error"],
    ];
    test.each(FAULTS.map(([n, f, c]) => [n, f, c] as [string, () => unknown, string]))("%s reads `%s`, a live code", (_n, make, code) => {
      const f = verbFailure(make());
      expect(f.code).toBe(code);
      expect(Object.keys(EXIT_FOR)).toContain(f.code);
    });
    test("the three typed causes keep three distinct codes and exits 6, 3, 4", () => {
      const got = FAULTS.slice(0, 3).map(([, f]) => verbFailure(f()).code);
      expect(new Set(got).size).toBe(3);
      expect(got.map(exitFor)).toEqual([6, 3, 4]);
    });
    test("an unreachable daemon never reads as outcome-unknown (CONTROL: the two differ)", () => {
      expect(verbFailure(new DaemonUnreachable("/x")).code).not.toBe(verbFailure(new LocalWaitExpired("v", 1, "r")).code);
    });
    test("outcome-unknown carries its request id; no other cause does", () => {
      expect(verbFailure(new LocalWaitExpired("v", 1, "req-7")).requestId).toBe("req-7");
      expect(verbFailure(new DaemonUnreachable("/x")).requestId).toBeUndefined();
      expect(verbFailure(new Error("x")).requestId).toBeUndefined();
    });
  });

  describe("storeFailure keeps the cause of a store-door failure", () => {
    test.each(REASONS.map(([r, c]) => [r, c]))("a vessel refusal `%s` reads under `%s`", (reason, code) => {
      const f = storeFailure(new RoutedVerbRefused("the vessel refused", reason));
      expect(f.code).toBe(code);
      expect(Object.keys(EXIT_FOR)).toContain(f.code);
    });

    test("a name this build has no code for travels as itself, never as verb-error (generated)", () => {
      const known = new Set(REASONS.map(([r]) => r));
      fc.assert(fc.property(fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/).filter((s) => !known.has(s)), (name) => {
        expect(storeFailure(new RoutedVerbRefused("m", name)).code).toBe(name);
      }));
    });

    test("the store's own faults each read under their own code and exit class", () => {
      const waited = storeFailure(new LocalWaitExpired("nexus-kapae", 10, "req-7"));
      const slow = storeFailure(new SlowBootTimeout("parked", "the vessel's store door", [7]));
      const gone = storeFailure(new DaemonUnreachable("/tmp/x.sock"));
      const held = storeFailure(Object.assign(Object.create(StoreHeld.prototype) as Error, { message: "a vessel (pid 7) holds the store" }));
      expect([waited.code, slow.code, gone.code, held.code]).toEqual(["outcome-unknown", "store-door-timeout", "daemon-unreachable", "store-held"]);
      expect([waited.code, slow.code, gone.code, held.code].map(exitFor)).toEqual([6, 3, 3, 4]);
      expect(waited.hint).toMatch(/lares receipt req-7/);   // an unknown outcome names the read that settles it
    });

    test("a fault that names nothing keeps the word its command gave (CONTROL)", () => {
      expect(storeFailure(new Error("disk full"))).toEqual({ code: "error", message: "disk full" });
      expect(storeFailure(new Error("disk full"), "refused").code).toBe("refused");
      expect(storeFailure(new RoutedVerbRefused("no name given")).code).toBe("error");
      expect(storeFailure(new RoutedVerbRefused("no name given"), "refused").code).toBe("refused");
      expect(storeFailure(new NexusKapaeError("made here, through no door"), "refused").code).toBe("refused");
    });

    test("a named refusal never reads as the fallback word", () => {
      expect(storeFailure(new RoutedVerbRefused("m", "waking-floor"), "refused").code).not.toBe("refused");
    });
  });

  describe("conditionExit carries the four vessel states outward", () => {
    const STATES: ReadonlyArray<readonly [VesselState, string, number]> = [
      ["standing", "accepting", 0],
      ["rising", "socket-silent", EXIT_PARTIAL],
      ["degraded", "uds-refused", EXIT_PARTIAL],
      ["down", "never-started", 1],
    ];
    test.each(STATES.map(([s, r, e]) => [s, r, e] as [VesselState, string, number]))("state `%s` exits %i", (state, reason, exit) => {
      expect(conditionExit(vesselCondition({ state, reason, message: "m" }))).toBe(exit);
    });
    test("arrived, moved-but-not-arrived and absent keep three distinct exits", () => {
      expect(new Set(STATES.map(([, , e]) => e)).size).toBe(3);
    });
    test("a reason that is prose refuses to construct (CONTROL: the law can fail)", () => {
      expect(() => vesselCondition({ state: "down", reason: "Not Started!", message: "m" })).toThrow(/branch token/);
    });
  });

  describe("at the door: a usage refusal keeps code `usage` and exit 2 on both channels", () => {
    test("`library <unknown verb> --json` writes error.code usage and exits 2", async () => {
      const r = await door(["library", UNKNOWN, "--json"]);
      expect(r.code).toBe(exitFor("usage"));
      const line = r.out.split("\n").find((l) => l.trim().startsWith("{"));
      expect(line).toBeDefined();
      expect(JSON.parse(line!).error.code).toBe("usage");
    });
    test("CONTROL: a live door under --help exits 0, not a usage class", async () => {
      expect((await door(["vessel", "--help"])).code).toBe(exitFor("ok"));
    });
  });
});
