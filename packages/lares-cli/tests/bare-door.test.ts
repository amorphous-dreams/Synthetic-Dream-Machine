/**
 * bare-door.test.ts — THE BARE `lares` SPEAKS THE HOUSE (the keypad head; carrier lar:///lares.lararium.status): bare `lares`
 * reads `lares mu=00 aperture=beat`, the status line, the pins layered house → face → mandate, the keys; read-only; a dark
 * house answers as a report; each lens names the doors its view runs, and the Sword's verdict rides the exit code.
 *
 * The door reads the world through `HouseReaders`; each test seats its own, so nothing here reaches a vessel or git.
 */
import { describe, test, expect } from "vitest";
import { MU_CARRY_ORDER, APERTURE_RANKS } from "@lararium/tw5";
import { BARE_ADDRESS, FACE_PINS, HOUSE_PINS, bareAsk, cmdBare, keysLine, pinsOf, viewDoors, type HouseReaders } from "../src/commands/bare.js";

const DOORS = ["rite", "bag", "wiki", "vessel", "shore"];
const PIN_TEXT = "!! pins\n\n```memetic-wikitext\n<<~ get title=`lar:///h` aperture=`measure`>>\n<<~ lar:///engine.law.indexes>>\n```\n<<~ ahu slot=`#/x`>>\n<<has entity=`x` name=`y`>>";

interface Rig { readonly readers: HouseReaders; readonly said: string[]; readonly ran: string[][]; readonly calls: Array<{ verb: string; params: Readonly<Record<string, string>> }> }

/** A house: lit or dark, the pin records it holds, and a mandate record. */
function rig(opts: { lit?: boolean; face?: string | null; mandatePins?: string; facePins?: string; wikiAnswers?: boolean } = {}): Rig {
  const said: string[] = [];
  const ran: string[][] = [];
  const calls: Array<{ verb: string; params: Readonly<Record<string, string>> }> = [];
  const lit = opts.lit ?? true;
  const readers: HouseReaders = {
    revision: () => ({ sha: "abc1234", behind: 3 }),
    lit: async () => lit,
    marker: () => (lit ? "attach" : null),
    call: async (verb, params) => {
      calls.push({ verb, params });
      if (!lit || opts.wikiAnswers === false) return null;
      // One filter reads both layers' `#/pins` slots, each row carrying its text.
      if (params["filter"] === `[[${HOUSE_PINS}#/pins]] [[${FACE_PINS}#/pins]]`) {
        return { rows: [{ title: `${HOUSE_PINS}#/pins`, fields: { text: PIN_TEXT } }, ...(opts.facePins === undefined ? [] : [{ title: `${FACE_PINS}#/pins`, fields: { text: opts.facePins } }])] };
      }
      if (params["title"] === HOUSE_PINS) return { has: "<<~ has name=`pins`>>" };
      if (params["title"] === "lar:///m/mandate") return { tiddler: { fields: { pins: opts.mandatePins ?? "" } } };
      return null;
    },
    env: {},
    run: async (argv) => { ran.push([...argv]); return 0; },
    say: (line) => { said.push(line); },
  };
  return { readers, said, ran, calls };
}

describe("bare `lares` reads mu=00 aperture=beat", () => {
  test("RED: the dials default to Rest and beat, and read every seed carry and every rank", () => {
    expect(bareAsk({})).toEqual({ carry: "00", rank: "beat", n: 6, face: null, mandate: null });
    for (const carry of MU_CARRY_ORDER) for (const rank of APERTURE_RANKS) expect(bareAsk({ mu: carry, aperture: rank }), `${carry} ${rank}`).toMatchObject({ carry, rank });
    expect(bareAsk({ mu: "*" })).toMatchObject({ carry: "*0" });
    expect(bareAsk({ mu: "relate" })).toMatchObject({ fault: expect.stringContaining("lares mu=cup") });
    expect(bareAsk({ aperture: "3/measure" })).toMatchObject({ fault: expect.stringContaining("lares aperture=3/pulse") });
  });

  test("RED: the ground answers its has line, the one status line, the pins house → face → mandate as runnable sigils, then the keys", async () => {
    const r = rig({ facePins: "<<~ get title=`lar:///face/own`>>", mandatePins: "<<~ get title=`lar:///mandate/one`>>" });
    expect(await cmdBare({ mandate: "lar:///m/mandate" }, r.readers, DOORS)).toBe(0);
    expect(r.said[0]).toBe(`<<~ has name=\`${BARE_ADDRESS}\` params=\`mu/00 aperture/6/beat ~ rest at beat\`>>`);
    expect(r.said[1]).toMatch(/^the house stands lit \(attach\) · checkout abc1234 · 3 behind develop · lit by: unread · faces: /);
    expect(r.said.slice(2)).toEqual([
      "pins (house):", "  <<~ get title=`lar:///h` aperture=`measure`>>", "  <<~ lar:///engine.law.indexes>>",
      "pins (face):", "  <<~ get title=`lar:///face/own`>>",
      "pins (mandate lar:///m/mandate):", "  <<~ get title=`lar:///mandate/one`>>",
      keysLine(DOORS),
    ]);
    expect(r.ran, "the ground runs no other door").toEqual([]);
  });

  test("RED: the ground costs one call (both pin layers in one filter), and the Sword's verdict reuses it", async () => {
    const ground = rig();
    await cmdBare({}, ground.readers, DOORS);
    expect(ground.calls).toHaveLength(1);
    const sword = rig();
    await cmdBare({ mu: "!0" }, sword.readers, DOORS);
    expect(sword.calls, "the verdict reads the pins answer, never a second call").toHaveLength(1);
    const pulse = rig();
    await cmdBare({ mu: "!0", aperture: "pulse" }, pulse.readers, DOORS);
    expect(pulse.calls, "at pulse no pins read, so the verdict asks once").toHaveLength(1);
  });

  test("RED: read-only: every call the bare door sends is a get", async () => {
    const r = rig();
    for (const carry of MU_CARRY_ORDER) await cmdBare({ mu: carry }, r.readers, DOORS);
    expect(r.calls.every((c) => c.verb === "get")).toBe(true);
    const doors = r.ran.map((a) => a.join(" "));
    for (const line of doors) expect(["wiki status", "vessel roster", "shore", "rite receipts"], line).toContain(line);
  });

  test("RED: a dark house answers as a report, exit 0, its pins waiting on the raise; only the Sword's verdict exits 1", async () => {
    const dark = rig({ lit: false });
    expect(await cmdBare({}, dark.readers, DOORS)).toBe(0);
    expect(dark.said[1]).toMatch(/^the house stands dark · checkout abc1234/);
    expect(dark.said.join("\n")).toContain("pins: unread while the house stands dark");
    expect(dark.calls, "a dark house reads no pin").toEqual([]);
    const sword = rig({ lit: false });
    expect(await cmdBare({ mu: "!0" }, sword.readers, DOORS)).toBe(1);
    expect(sword.said.join("\n")).toContain("verdict: dark · hearth dark · daemon wiki dark · your face dark");
  });

  test("RED: the Sword's verdict reads three: the hearth, the worn daemon wiki, the asker's face; a wiki that answers no read reads dark", async () => {
    const lit = rig();
    expect(await cmdBare({ mu: "sword" }, lit.readers, DOORS)).toBe(0);
    expect(lit.said.join("\n")).toContain("verdict: lit · hearth lit · daemon wiki lit · your face lit");
    const faced = rig();
    expect(await cmdBare({ mu: "!", face: "h1" }, faced.readers, DOORS)).toBe(0);
    expect(faced.said.join("\n")).toContain("face h1 lit");
    expect(faced.calls.some((c) => c.params["face"] === "h1")).toBe(true);
    const deaf = rig({ wikiAnswers: false });
    expect(await cmdBare({ mu: "!0" }, deaf.readers, DOORS)).toBe(1);
    expect(deaf.said.join("\n")).toContain("verdict: dark · hearth lit · daemon wiki dark");
  });

  test("RED: each lens runs its view's doors in order: wand the wikis, cup the roster, pentacle the residue, and the carries combine them", async () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
      "00": [], "*0": ["wiki status"], "?0": ["vessel roster"], "!0": [], "_0": ["shore", "rite receipts"],
      "*!": ["wiki status"], "*?": ["wiki status", "vessel roster"], "_!": ["shore", "rite receipts"], "_?": ["shore", "rite receipts"],
      "*_": ["wiki status", "shore", "rite receipts"], "?!": ["vessel roster"],
    };
    for (const carry of MU_CARRY_ORDER) {
      const r = rig();
      await cmdBare({ mu: carry }, r.readers, DOORS);
      expect(r.ran.map((a) => a.join(" ")), carry).toEqual(expected[carry]);
      expect(viewDoors(carry), carry).toEqual(expected[carry]!.map((d) => `lares ${d}`));
    }
    const jam = rig();
    await cmdBare({ mu: "?!" }, jam.readers, DOORS);
    expect(jam.said.join("\n")).toContain("relations read on trust");
    const checklist = rig({ lit: false });
    expect(await cmdBare({ mu: "precision", aperture: "arc" }, checklist.readers, DOORS), "the pre-restand checklist's verdict rides its exit").toBe(1);
  });

  test("RED: the range: pulse the status line alone, beat one line with pins and keys, measure one field per line, theme the full door list too", async () => {
    const pulse = rig();
    await cmdBare({ aperture: "pulse" }, pulse.readers, DOORS);
    expect(pulse.said).toHaveLength(2);
    expect(pulse.said[0]).toContain("aperture/2/pulse");
    const measure = rig();
    await cmdBare({ aperture: "measure" }, measure.readers, DOORS);
    expect(measure.said.filter((l) => l.startsWith("  ") && !l.startsWith("  <<~")).length, "one indented line per field").toBe(5);
    expect(measure.said.join("\n")).toContain("`lares shore` names the lag");
    let helped = 0;
    const theme = rig();
    await cmdBare({ aperture: "theme" }, theme.readers, DOORS, async () => { helped++; return 0; });
    expect(helped).toBe(1);
    const beat = rig();
    await cmdBare({}, beat.readers, DOORS, async () => { helped++; return 0; });
    expect(helped, "beat prints no door list").toBe(1);
  });

  test("RED: the dials cross on the bare door: every carry at every rank answers its has line naming both", async () => {
    for (const carry of MU_CARRY_ORDER) {
      for (const rank of APERTURE_RANKS) {
        const r = rig();
        const exit = await cmdBare({ mu: carry, aperture: rank }, r.readers, DOORS, async () => 0);
        expect(r.said[0], `${carry} ${rank}`).toContain(`mu/${carry} aperture/`);
        expect(r.said[0], `${carry} ${rank}`).toContain(`/${rank} ~`);
        expect(exit, `${carry} ${rank}`).toBe(0);
      }
    }
  });

  test("the pins reader takes call sigils alone: never a has row, a slot frame or a kahea", () => {
    expect(pinsOf(PIN_TEXT)).toEqual(["<<~ get title=`lar:///h` aperture=`measure`>>", "<<~ lar:///engine.law.indexes>>"]);
    expect(pinsOf(undefined)).toEqual([]);
  });

  test("the keys line names the call door's act keys, then every door word, and points at lares help", () => {
    expect(keysLine(["rite", "get", "bag"])).toBe("keys: get= put= delete= rename= filter= act= rite= bag=  (lares help: every door · lares help mu=?0)");
  });
});
