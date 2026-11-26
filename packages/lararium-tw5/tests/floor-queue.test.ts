/**
 * floor-queue — the test floor's queue folds inside the wiki (mandate/floor-gate-1): arrival order, dedupe by ticket and by
 * green sha, the ticket block a hand-back carries, the byte rows, and the house skin classing the operator.
 * RED-FIRST: written by floor-warden#2, run by the familiar.
 * THE LANES AND THE RATCHET ROWS (plan/the-harness-proves, phase 1): the floor serves spirit lanes, a green a later red
 * contradicts on one sha reads as one MISS, and each LAND counts the runs its lane spent. RED-FIRST: written by hoʻāʻo#1,
 * never run by its author.
 */
import { describe, expect, test } from "vitest";
import { DEFAULT_RUN, FLOOR_LEDGER, floorView, foldFloor, foldLedger, sameSha, ticketId } from "../src/floor-ledger.js";
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

describe("the floor serves lanes", () => {
  const D = "d".repeat(40), E = "e".repeat(40), F = "f".repeat(40);
  const id = (lane: string, sha: string): string => `${lane}@${sha.slice(0, 9)}`;
  const q = (lane: string, sha: string): string => `QUEUE ${id(lane, sha)} ${lane} spirit/${lane} ${sha}`;

  test("RED 8: a lane's second ticket waits behind a sibling lane's first, whatever order they arrived in", () => {
    const t = foldLedger([q("hoao", A), q("hoao", B), q("kaula", C)].join("\n"));
    expect(floorView(t, "waiting")).toEqual([id("hoao", A), id("kaula", C), id("hoao", B)]);
    expect(floorView(t, "lane")).toEqual(["hoao=2/0", "kaula=1/0"]);
    expect(floorView(t, "lane", "hoao")).toEqual([id("hoao", A), id("hoao", B)]);
  });

  test("RED 9: a lane holding a slot yields the next slot to a lane holding none; CONTROL: one lane waiting alone never idles the floor", () => {
    const held = [q("hoao", A), `TAKE ${id("hoao", A)} lares-alpha c-free=80.00 slot=1`, q("hoao", B), q("kaula", C), q("kaula", D)].join("\n");
    expect(floorView(foldLedger(held), "next")).toEqual([id("kaula", C)]);
    expect(floorView(foldLedger(held), "waiting")).toEqual([id("kaula", C), id("hoao", B), id("kaula", D)]);
    expect(floorView(foldLedger(held), "lane")).toEqual(["kaula=2/0", "hoao=1/1"]);
    const alone = [q("hoao", A), `TAKE ${id("hoao", A)} lares-alpha c-free=80.00 slot=1`, q("hoao", B)].join("\n");
    expect(floorView(foldLedger(alone), "next")).toEqual([id("hoao", B)]);
  });

  test("RED 10: a GREEN ticket, then a RED run on the same sha, writes ONE miss; CONTROL: a red cured by a later green, and a red on another sha, write none", () => {
    const green = [q("hoao", A), `DONE ${id("hoao", A)} GREEN wrote=0.10 c-drop=0.10 · vitest tests/x.test.ts`];
    const gate = [q("hoao", A), `DONE ${id("hoao", A)} RED wrote=1.00 c-drop=1.00 · BENCH GATE REFUSES: witnesses-fast (exit 1)`];
    const twice = foldFloor([...green, ...gate, ...gate, q("gate-b", A), `DONE ${id("gate-b", A)} RED wrote=1.00 c-drop=1.00 · BENCH GATE REFUSES`].join("\n"));
    expect(floorView(twice, "miss")).toEqual([id("hoao", A)]);
    const cured = foldFloor([...gate, ...green].join("\n"));
    expect(floorView(cured, "miss")).toEqual([]);
    const elsewhere = foldFloor([...green, q("kaula", B), `DONE ${id("kaula", B)} RED wrote=0.10 c-drop=0.10 · exit 1`].join("\n"));
    expect(floorView(elsewhere, "miss")).toEqual([]);
  });

  test("RED 11: a MISS row names a miss a hand saw on another sha, once per ticket; a MISS over no ticket folds to nothing", () => {
    const log = [q("hoao", A), `DONE ${id("hoao", A)} GREEN wrote=0.10 c-drop=0.10 · BENCH GATE GREEN`, `MISS ${id("hoao", A)} develop read red on filter-cts after the merge`, `MISS ${id("hoao", A)} again`, `MISS ${id("nobody", B)} stray`].join("\n");
    expect(floorView(foldFloor(log), "miss")).toEqual([id("hoao", A)]);
  });

  test("RED 12: each LAND counts the runs its lane's branch spent since its span opened, beside the floor's turns, then the mean", () => {
    const log = [
      q("hoao", A), `HANDBACK ${id("hoao", A)} body=1`,
      `DONE ${id("hoao", A)} RED wrote=1.00 c-drop=1.00 · BENCH GATE REFUSES`,
      q("kaula", C), `DONE ${id("kaula", C)} GREEN wrote=1.00 c-drop=1.00 · BENCH GATE GREEN`,
      `QUEUE ${id("hoao", B)} hoao spirit/hoao ${B}`, `DONE ${id("hoao", B)} GREEN wrote=1.00 c-drop=1.00 · BENCH GATE GREEN`,
      `LAND ${id("hoao", B)} ${D}`,
      `LAND ${id("kaula", C)} ${E}`,
      `QUEUE ${id("hoao", F)} hoao spirit/hoao ${F}`, `DONE ${id("hoao", F)} GREEN wrote=1.00 c-drop=1.00 · BENCH GATE GREEN`,
      `LAND ${id("hoao", F)} ${F}`,
      `LAND ${id("hoao", F)} not-a-sha`,
    ].join("\n");
    expect(floorView(foldFloor(log), "runs-per-landing")).toEqual([`hoao@${D.slice(0, 9)}=2/3`, `kaula@${E.slice(0, 9)}=1/2`, `hoao@${F.slice(0, 9)}=1/1`, "mean=1.33"]);
    expect(floorView(foldFloor(q("hoao", A)), "runs-per-landing")).toEqual([]);
    expect(floorView(foldLedger(log), "runs-per-landing")).toEqual([]);
  });

  test("RED 13: the OWES and HANDBACK rows ride the ticket block and the one-line ticket", () => {
    const log = [q("hoao", A), `HANDBACK ${id("hoao", A)} body=3`, `OWES ${id("hoao", A)} gate · sets=e2e-node files=4(vessel:1,heavy:3) globs=0 touched=2 owes=0123456789ab via=door`].join("\n");
    const f = foldFloor(log);
    expect(floorView(f, "ticket", id("hoao", A))).toEqual([[`FLOOR TICKET hoao spirit/hoao ${A}`, "  bench: familiar", `  run:   ${DEFAULT_RUN}`, "  owes:  gate · sets=e2e-node files=4(vessel:1,heavy:3) globs=0 touched=2 owes=0123456789ab via=door"].join("\n")]);
    expect(floorView(f, "line", id("hoao", A))).toEqual([`floor ticket hoao#3 · spirit/hoao@${A.slice(0, 9)} · gate · sets=e2e-node files=4(vessel:1,heavy:3) globs=0 touched=2 owes=0123456789ab via=door`]);
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
    const missed = `${LOG}\nQUEUE lane-c@${C.slice(0, 9)} lane-c spirit/c ${C}\nDONE lane-c@${C.slice(0, 9)} RED wrote=1.00 c-drop=1.00 · BENCH GATE REFUSES`;
    expect(run([FLOOR_LEDGER], ["miss"], { [FLOOR_LEDGER]: missed })).toEqual([`lane-c@${C.slice(0, 9)}`]);
  });

  test("RED 7: the house skin classes the operator, so it packs as a module tiddler", () => {
    const title = "lar:///ha.ka.ba/lararium/tw5/filters/floor-queue";
    expect(LARARIUM_MODULES).toContain(title);
    expect(skinOfModule(title).name).toBe("lararium");
  });
});
