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
 * unknown" instead, names the request id, and tries ONE short read. `verb-timeout` is retired; its
 * successor is `outcome-unknown`, raised only from `local-connector.ts`'s `LocalWaitExpired`.
 *
 * P2.5 iteration 2, H1 (gp25-episkopos1): that one short read USED to re-submit through `runVerb` —
 * trusting the dispatcher's outcome dedup to make a same-id re-issue safe. Proven live: a caller that
 * gave up got its invocation dropped (never dispatched, never recorded), so the "read-back" calling
 * `runVerb` a second time under that SAME id ran the act a second time. The read-back now calls
 * `queryReceipt`, a dedicated read that cannot dispatch anything.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = (f: string): string => readFileSync(join(import.meta.dirname, "..", "src", f), "utf8");

afterEach(() => { vi.restoreAllMocks(); });

describe("what `lares act` says when its own local wait ends", () => {
  test("★ an outcome-unknown wait carries its own code — never `daemon-unreachable` ★", () => {
    const src = SRC("commands/act.ts");
    // BOTH runVerb catches must branch — `act` holds two (the derived-budget LOAD and REPACK). Each
    // arm's genuinely-still-unknown branch carries ITS OWN `outcome-unknown` emit; count instead of
    // windowing, so neither arm's growth silently escapes this proof.
    const arms = src.match(/code: "outcome-unknown"/g) ?? [];
    expect(arms.length, "an act catch still names every fault `daemon-unreachable`").toBe(2);
    // M3′: an ABANDONED read-back (H1 fix item 6) now carries its OWN code — `request-abandoned` —
    // never `outcome-unknown` (this vessel has already settled "did it run"; the answer is no, and it
    // never will under this id, which is a sharper answer than "outcome unknown").
    const abandoned = src.match(/code: "request-abandoned"/g) ?? [];
    expect(abandoned.length, "the abandoned read-back lost its own code").toBe(2);
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
    // the message alone. Anchor on the `outcome-unknown` EMIT itself and walk BACKWARD to its own
    // `const hint` — D1's split added an `evicted`/`retention-gap` branch between the abandoned and
    // outcome-unknown arms, so a fixed forward window from the FIRST `const hint` no longer reaches
    // this one; anchoring on the code this hint actually feeds stays correct regardless of how many
    // sibling branches precede it.
    const derived = src.slice(src.indexOf("const timeoutMs = Math.max"));
    const outcomeIdx = derived.indexOf('code: "outcome-unknown"');
    expect(outcomeIdx, "no outcome-unknown emit found past the derived budget").toBeGreaterThan(-1);
    const hintIdx = derived.lastIndexOf("const hint", outcomeIdx);
    const hintLine = derived.slice(hintIdx, outcomeIdx + 50);
    expect(hintLine, "the outcome-unknown hint hides the carrier count that SET the budget").toMatch(/carrierCount/);
    expect(hintLine, "the outcome-unknown hint still tells the operator to start a running daemon")
      .not.toMatch(/vessel stand --foreground/);
  });

  test("★ each read-back READS the same request id, through queryReceipt, never a second runVerb dispatch ★ (H1)", () => {
    // P2.5 iter 2, H1 (gp25-episkopos1): the OLD shape re-submitted through `runVerb` a second time,
    // trusting the dispatcher's outcome dedup to make the re-issue safe — but an id this vessel had
    // already dropped as ABANDONED (the caller gave up before commit) carried no outcome to dedup
    // against, so the "read-back" ran the act a SECOND time under the same id. `queryReceipt` rides a
    // dedicated `{op:"receipt"}` line the vessel can only answer, never dispatch from.
    const src = SRC("commands/act.ts");
    const arms = src.match(/await queryReceipt\(/g) ?? [];
    expect(arms.length, "both the LOAD and REPACK read-backs must call queryReceipt, not runVerb").toBe(2);
    // Exactly TWO `runVerb(submitName, submitArgs, did, …)` calls may stand in the whole file — the
    // ORIGINAL LOAD dispatch and the ORIGINAL REPACK dispatch. A THIRD or FOURTH would be a read-back
    // that regressed back to a second dispatch under the retired shape.
    const dispatches = src.match(/runVerb\(submitName, submitArgs, did,/g) ?? [];
    expect(dispatches.length, "a read-back regressed to a second runVerb dispatch under the retired shape").toBe(2);
  });

  test("CONTROL — a genuinely unreachable daemon KEEPS its code and its standing hint", () => {
    // M3′: both else-arms now route through the SHARED `verbFailure` mapper (verb-call.ts) rather than
    // hand-rolling `daemon-unreachable` + its hint inline — the same fault-by-TYPE discipline this
    // file's other arms already use for LocalWaitExpired. `verbFailure` itself still answers
    // `daemon-unreachable` + "vessel stand --foreground" for a genuine `DaemonUnreachable` (proved live
    // in verb-call.test.ts); this proof only needs act.ts to still DELEGATE to it, twice (REPACK + LOAD).
    const src = SRC("commands/act.ts");
    const delegations = src.match(/const f = verbFailure\(err\)/g) ?? [];
    expect(delegations.length, "both else-arms must delegate to the shared verbFailure mapper").toBe(2);
    const render = SRC("render.ts");
    expect(render, "the mapper's own daemon-unreachable code must stay ranked").toMatch(/"daemon-unreachable"/);
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
