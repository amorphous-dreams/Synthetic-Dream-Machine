/**
 * A TIMED-OUT VERB IS NOT AN ABSENT DAEMON.
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
 * The two faults want different cures. An absent daemon wants standing. A budget overrun wants a quieter
 * machine or a longer budget — and it wants the CARRIER COUNT said out loud, because that is what set the
 * number, and a reader cannot reach that arithmetic from the failure otherwise.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = (f: string): string => readFileSync(join(import.meta.dirname, "..", "src", f), "utf8");

afterEach(() => { vi.restoreAllMocks(); });

describe("what `lares act` says when its budget runs out", () => {
  test("★ a verb TIMEOUT carries its own code — never `daemon-unreachable` ★", () => {
    const src = SRC("commands/act.ts");
    // BOTH runVerb catches must branch — `act` holds two (the derived-budget LOAD and REPACK), and a
    // window sliced from the first would measure whichever one came earlier in the file. Count instead.
    const arms = src.match(/code: "verb-timeout"/g) ?? [];
    expect(arms.length, "an act catch still names every fault `daemon-unreachable`").toBe(2);
  });

  test("★ the timeout hint names the BUDGET and the carrier count, never `stand the daemon` ★", () => {
    const src = SRC("commands/act.ts");
    // The DERIVED-budget arm must name the arithmetic that set it; a reader cannot reach 162400ms from
    // the message alone.
    const derived = src.slice(src.indexOf("const timedOut"));
    const hintLine = derived.slice(derived.indexOf("const hint"), derived.indexOf("const hint") + 400);
    expect(hintLine, "the timeout hint hides the carrier count that SET the budget").toMatch(/carrierCount/);
    expect(hintLine, "the timeout hint still tells the operator to start a running daemon")
      .not.toMatch(/vessel stand --foreground/);
  });

  test("CONTROL — a genuinely unreachable daemon KEEPS its code and its standing hint", () => {
    const src = SRC("commands/act.ts");
    expect(src, "the unreachable arm lost its code").toMatch(/daemon-unreachable/);
    expect(src, "the unreachable arm lost the one hint that fits it").toMatch(/vessel stand --foreground/);
  });

  test("CONTROL — `verb-timeout` reads as a known exit class, so the code is routable", () => {
    // A code the exit table does not know would fall to the generic bucket and the distinction would
    // buy an agent nothing.
    expect(SRC("render.ts"), "render.ts does not rank verb-timeout").toMatch(/verb-timeout/);
  });
});
