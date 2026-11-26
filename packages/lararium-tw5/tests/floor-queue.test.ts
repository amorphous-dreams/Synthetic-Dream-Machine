/**
 * floor-queue — the test floor's queue folds inside the wiki (mandate/floor-gate-1): arrival order, dedupe by ticket and by
 * green sha, the ticket block a hand-back carries, the byte rows, and the house skin classing the operator.
 * RED-FIRST: written by floor-warden#2, run by the familiar.
 */
import { describe, expect, test } from "vitest";
import { DEFAULT_RUN, FLOOR_LEDGER, floorView, foldLedger, sameSha, ticketId } from "../src/floor-ledger.js";
import { floorQueue } from "../src/filters/floor-queue.js";
import { LARARIUM_MODULES, skinOfModule } from "../plugin-build/skins.js";

const A = "a".repeat(40), B = "b".repeat(40), C = "c".repeat(40);
const LOG = [
  "CLAIM old habit line the grammar never reads",
  `QUEUE lane-a@${A.slice(0, 9)} lane-a spirit/a ${A}`,
  `RUN lane-a@${A.slice(0, 9)} pnpm --filter @lararium/node exec vitest run tests/x.test.ts`,
  `WHY lane-a@${A.slice(0, 9)} the red proves the door refuses`,
  `QUEUE lane-b@${B.slice(0, 9)} lane-b spirit/b ${B}`,
  `QUEUE lane-a@${A.slice(0, 9)} lane-a spirit/a ${A}`,
  `QUEUE lane-c@${C.slice(0, 9)} lane-c spirit/c ${C}`,
  `TAKE lane-c@${C.slice(0, 9)} lares-alpha c-free=88.10`,
  `DONE lane-c@${C.slice(0, 9)} GREEN wrote=0.42 c-drop=0.61 · BENCH GATE GREEN at ccccccc`,
].join("\n");

describe("the fold", () => {
  test("RED 1: arrival orders the queue; a QUEUE over a waiting ticket folds to nothing; unread lines fold to nothing", () => {
    const t = foldLedger(LOG);
    expect(floorView(t, "waiting")).toEqual([`lane-a@${A.slice(0, 9)}`, `lane-b@${B.slice(0, 9)}`]);
    expect(floorView(t, "next")).toEqual([`lane-a@${A.slice(0, 9)}`]);
    expect(t.find((x) => x.id.startsWith("lane-a"))?.runs).toHaveLength(1);
  });

  test("RED 2: a waiting ticket whose sha already holds GREEN reads skip, never waiting (dedupe by sha)", () => {
    const again = `${LOG}\nQUEUE lane-c2@${C.slice(0, 9)} lane-c2 spirit/c2 ${C.slice(0, 12)}`;
    const t = foldLedger(again);
    expect(floorView(t, "skip")).toEqual([`lane-c2@${C.slice(0, 9)}`]);
    expect(floorView(t, "waiting")).not.toContain(`lane-c2@${C.slice(0, 9)}`);
    expect(floorView(t, "green-sha", C.slice(0, 7))).toEqual(["yes"]);
    expect(floorView(t, "green-sha", A)).toEqual([]);
  });

  test("RED 3: TAKE marks taken, DONE lands the verdict and the byte row, DROP sets down", () => {
    const log = `${LOG}\nTAKE lane-a@${A.slice(0, 9)} lares-alpha c-free=87.9\nDONE lane-a@${A.slice(0, 9)} STOPPED wrote=4.20 c-drop=4.05 · budget: c-drop past 4G\nDROP lane-b@${B.slice(0, 9)} lane withdrawn`;
    const t = foldLedger(log);
    expect(floorView(t, "stopped")).toEqual([`lane-a@${A.slice(0, 9)}`]);
    expect(floorView(t, "dropped")).toEqual([`lane-b@${B.slice(0, 9)}`]);
    expect(floorView(t, "budget")).toEqual([`lane-c@${C.slice(0, 9)} GREEN wrote=0.42 c-drop=0.61`, `lane-a@${A.slice(0, 9)} STOPPED wrote=4.20 c-drop=4.05`]);
    expect(floorView(t, "waiting")).toEqual([]);
  });

  test("RED 4: a QUEUE over a DONE ticket re-enters it at the tail with its runs cleared", () => {
    const id = `lane-c@${C.slice(0, 9)}`;
    const t = foldLedger(`${LOG}\nQUEUE ${id} lane-c spirit/c ${C}`);
    expect(floorView(t, "taken")).toEqual([]);
    expect(floorView(t, "runs", id)).toEqual([DEFAULT_RUN]);
  });

  test("RED 5: the ticket block carries the hand-back shape; a view the grammar lacks throws", () => {
    const t = foldLedger(LOG);
    const [block] = floorView(t, "ticket", `lane-a@${A.slice(0, 9)}`);
    expect(block).toBe([`FLOOR TICKET lane-a spirit/a ${A}`, "  bench: familiar", "  run:   pnpm --filter @lararium/node exec vitest run tests/x.test.ts", "  why:   the red proves the door refuses"].join("\n"));
    expect(() => floorView(t, "wating")).toThrow(/names no view/);
  });

  test("CONTROL: ticket ids and sha matching", () => {
    expect(ticketId("lane-x", A.toUpperCase())).toBe(`lane-x@${A.slice(0, 9)}`);
    expect(sameSha(A.slice(0, 7), A)).toBe(true);
    expect(sameSha(A.slice(0, 6), A)).toBe(false);
    expect(sameSha(A, B)).toBe(false);
  });
});

describe("the operator", () => {
  const wiki = (texts: Record<string, string>) => ({ getTiddler: (title: string) => (title in texts ? { fields: { title, text: texts[title] } } : undefined) });
  const run = (titles: string[], operands: string[], texts: Record<string, string>): string[] =>
    floorQueue((cb) => titles.forEach((t) => cb(undefined as never, t)), { operator: "floor-queue", operand: operands[0] ?? "", operands: operands as never }, { wiki: wiki(texts) as never });

  test("RED 6: the operator reads the ledger record's text and answers the view; an absent record answers empty", () => {
    expect(run([FLOOR_LEDGER], ["next"], { [FLOOR_LEDGER]: LOG })).toEqual([`lane-a@${A.slice(0, 9)}`]);
    expect(run([FLOOR_LEDGER], ["sha", `lane-b@${B.slice(0, 9)}`], { [FLOOR_LEDGER]: LOG })).toEqual([B]);
    expect(run(["lar:///nowhere"], ["waiting"], {})).toEqual([]);
  });

  test("RED 7: the house skin classes the operator, so it packs as a module tiddler", () => {
    const title = "lar:///ha.ka.ba/lararium/tw5/filters/floor-queue";
    expect(LARARIUM_MODULES).toContain(title);
    expect(skinOfModule(title).name).toBe("lararium");
  });
});
