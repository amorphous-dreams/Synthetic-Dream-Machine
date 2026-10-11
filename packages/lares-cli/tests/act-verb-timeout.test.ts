/**
 * A LOCAL WAIT ENDING IS NOT A VERDICT ON THE ACT, AND NEVER AN ABSENT DAEMON.
 *
 * `lares act` derives its ACK budget from the gesture — `10s + carriers × 400ms`, because a
 * directory-batch LOAD chews one island frame per carrier and a flat budget would time out the ACK while
 * the verb itself ran on. Good shape. But every failure out of `runVerb` then landed as
 * `daemon-unreachable`, hinted "Start the daemon with `lares vessel stand --foreground` and try again".
 *
 * A budget overrun answers NOTHING like an absent daemon. The socket connected, the daemon took the verb,
 * and the caller stopped waiting — so the hint sends an operator to start something already running, and
 * an agent reading `--json` routes on a code naming the wrong fault entirely. Measured on the corpus e2e:
 * `{"code":"daemon-unreachable","message":"local verb \\"LOAD\\" timed out after 162400ms"}` while the
 * daemon stood and served, on a machine carrying other work.
 *
 * P2.5 "no global now" (operator 2026-10-10): the law goes further than telling the two faults apart.
 * A wall clock never decides a verdict on the act, so this process's own local wait ending must not be
 * told as "the verb timed out" either — that still claims to know the act failed. It reads as "outcome
 * unknown" instead, names the request id, and tries ONE short read-back (by that same id, via the
 * dispatcher's own outcome dedup) before giving up on knowing at all. `verb-timeout` is retired; its
 * successor is `outcome-unknown`, raised only from `local-connector.ts`'s `LocalWaitExpired`.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = (f: string): string => readFileSync(join(import.meta.dirname, "..", "src", f), "utf8");

afterEach(() => { vi.restoreAllMocks(); });

describe("what `lares act` says when its own local wait ends", () => {
  test("★ an outcome-unknown wait carries its own code — never `daemon-unreachable` ★", () => {
    const src = SRC("commands/act.ts");
    // BOTH runVerb catches must branch — `act` holds two (the derived-budget LOAD and REPACK), and a
    // window sliced from the first would measure whichever one came earlier in the file. Count instead.
    const arms = src.match(/code: "outcome-unknown"/g) ?? [];
    expect(arms.length, "an act catch still names every fault `daemon-unreachable`").toBe(2);
  });

  test("RED (retired): `verb-timeout` and bare `/timed out after/` wording never return", () => {
    const src = SRC("commands/act.ts");
    expect(src, "a retired code crept back in").not.toMatch(/"verb-timeout"/);
    expect(src, "a retired wall-clock verdict wording crept back in").not.toMatch(/timed out after \d/);
  });

  test("★ both arms branch on LocalWaitExpired, never a message-sniffing regex ★", () => {
    const src = SRC("commands/act.ts");
    const arms = src.match(/err instanceof LocalWaitExpired/g) ?? [];
    expect(arms.length, "an act catch stopped checking the error's TYPE").toBe(2);
  });

  test("★ the outcome-unknown hint names the BUDGET and the carrier count, never `stand the daemon` ★", () => {
    const src = SRC("commands/act.ts");
    // The DERIVED-budget arm must name the arithmetic that set it; a reader cannot reach 162400ms from
    // the message alone.
    const derived = src.slice(src.indexOf("const timeoutMs = Math.max"));
    const hintLine = derived.slice(derived.indexOf("const hint"), derived.indexOf("const hint") + 600);
    expect(hintLine, "the outcome-unknown hint hides the carrier count that SET the budget").toMatch(/carrierCount/);
    expect(hintLine, "the outcome-unknown hint still tells the operator to start a running daemon")
      .not.toMatch(/vessel stand --foreground/);
  });

  test("★ each read-back re-submits the SAME request id, never a fresh one ★", () => {
    const src = SRC("commands/act.ts");
    // A fresh id on retry would dodge the dispatcher's outcome dedup and could re-run the act's effect.
    expect(src, "the LOAD read-back dropped its own request id").toMatch(/runVerb\(submitName, submitArgs, did, \{ requestId, timeoutMs: READBACK_MS \}\)/);
    expect(src, "the REPACK read-back dropped its own request id").toMatch(/runVerb\(submitName, submitArgs, did, \{ requestId: repackRequestId, timeoutMs: REPACK_READBACK_MS \}\)/);
  });

  test("CONTROL — a genuinely unreachable daemon KEEPS its code and its standing hint", () => {
    const src = SRC("commands/act.ts");
    expect(src, "the unreachable arm lost its code").toMatch(/daemon-unreachable/);
    expect(src, "the unreachable arm lost the one hint that fits it").toMatch(/vessel stand --foreground/);
  });

  test("CONTROL — `outcome-unknown` reads as a routable exit class (falls to the generic failure code, never `ok`)", () => {
    // render.ts is not this builder's file (P2.5 S1 owns act.ts and local-connector.ts, not the shared
    // exit-code table); an unranked code falls to EXIT_FOR's generic bucket rather than 0/success, which
    // is still a distinct, non-zero failure exit. A dedicated rank (alongside `verb-timeout`'s old 4) is
    // owed to whoever owns render.ts — see this builder's handback.
    const render = SRC("render.ts");
    if (/"outcome-unknown":/.test(render)) {
      expect(render).toMatch(/"outcome-unknown":\s*[1-9]/); // ranked, and not success
    } else {
      expect(render, "render.ts's exitFor fallback must still be non-zero").toMatch(/EXIT_FOR\[code\] \?\? 1/);
    }
  });
});
