/**
 * keypad.test.ts — ONE DOOR, A KEYPAD (lar:///ha.ka.ba/kahua/memory/course/comms-ux-enacts "One door, a keypad"; the keypad
 * head): `lares` plus key=value pairs in any order, exactly one act key, the shaping keys sharing the `set` panel's params, the
 * flag zoo burned into the two dials, and a positional spelling answering a teaching refusal that names the keypad line.
 *
 * The keypad reads in `src/keypad.ts` (pure); `bin/lares.ts` runs the line it reads. The call door half rides the same
 * vessel mock as `tiddler-door.test.ts`, so a keypad call and its call-shape spelling send one plan.
 */
import { afterEach, describe, test, expect, vi } from "vitest";

const h = vi.hoisted(() => ({ calls: [] as Array<{ verb: string; args: Record<string, unknown> }>, reply: {} as Record<string, unknown> }));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: (err: unknown) => ({ code: "error", message: err instanceof Error ? err.message : String(err) }),
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
  runVerbAsFace: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { BURNED_FLAGS, KeypadUsage, isKeypadLine, positionalCure, readKeypad, type KeypadLine } from "../src/keypad.js";
import { COMMANDS, dispatch, keypadArgv } from "../src/bin/lares.js";
import { MU_CARRY_ORDER, MU_CARRIES, APERTURE_RANKS } from "@lararium/tw5";

const DOORS = { names: COMMANDS.map((c) => c.name), accepts: (d: string): readonly string[] => COMMANDS.find((c) => c.name === d)?.accepts ?? [] };
const read = (...tokens: string[]): KeypadLine => readKeypad(tokens, DOORS);
const refusal = (...tokens: string[]): KeypadUsage => {
  try { read(...tokens); } catch (err) { if (err instanceof KeypadUsage) return err; throw err; }
  throw new Error(`${tokens.join(" ")} read without a refusal`);
};

afterEach(() => { h.calls.length = 0; h.reply = {}; });

describe("one door, a keypad: key=value in any order, exactly one act key", () => {
  test("RED: a line whose first token names a key speaks the keypad; a door word or an address does not", () => {
    expect(isKeypadLine(["rite=kukulu"])).toBe(true);
    expect(isKeypadLine(["mu=_0"])).toBe(true);
    expect(isKeypadLine(["rite", "kukulu"])).toBe(false);
    expect(isKeypadLine(["lar:///engine.record.reads", "title=x"])).toBe(false);
    expect(isKeypadLine([])).toBe(false);
  });

  test("RED: the call door's act keys route as the call shape: get= put= delete= rename= filter= act=, in any order beside their shaping keys", () => {
    expect(read("get=Room 4", "aperture=arc")).toEqual({ kind: "call", verb: "get", params: { title: "Room 4", aperture: "arc" }, set: {} });
    expect(read("aperture=measure", "mu=?0", "get=lar:///t/x")).toEqual({ kind: "call", verb: "get", params: { aperture: "measure", mu: "?0", title: "lar:///t/x" }, set: {} });
    expect(read("put=T", "text=new words", "mu=_!")).toMatchObject({ kind: "call", verb: "put", params: { title: "T", text: "new words", mu: "_!" } });
    expect(read("rename=Old", "to=New")).toMatchObject({ kind: "call", verb: "rename", params: { title: "Old", to: "New" } });
    expect(read("filter=[tag[x]]", "aperture=measure")).toMatchObject({ kind: "call", verb: "get", params: { filter: "[tag[x]]", aperture: "measure" } });
    expect(read("act=lar:///engine.law.indexes")).toMatchObject({ kind: "call", verb: "lar:///engine.law.indexes", params: {} });
    // A container word beside a call key reads as the container, never a second act.
    expect(read("get=Room 4", "bag=lares", "realm=r1")).toMatchObject({ kind: "call", params: { title: "Room 4", bag: "lares", realm: "r1" } });
  });

  test("RED: the set panel's keys ride every line as testimony; a delete keeps its own mode", () => {
    expect(read("get=T", "stance=poet", "mood=wry", "note=chasing an adjacency")).toMatchObject({ kind: "call", params: { title: "T" }, set: { stance: "poet", mood: "wry", note: "chasing an adjacency" } });
    expect(read("get=T", "mode=sketch")).toMatchObject({ params: { title: "T" }, set: { mode: "sketch" } });
    expect(read("delete=T", "mode=kapae")).toMatchObject({ params: { title: "T", mode: "kapae" }, set: {} });
  });

  test("RED: two act keys refuse, naming both lines", () => {
    const both = refusal("get=x", "rite=kukulu");
    expect(both.code).toBe("act-keys-doubled");
    expect(both.message).toContain("lares get=x");
    expect(both.message).toContain("lares rite=kukulu");
    expect(refusal("put=a", "delete=b").code).toBe("act-keys-doubled");
  });

  test("RED: a door the command table runs takes its key's value as its sub-verb words, its shaping keys as its flags, with= whole", () => {
    expect(read("rite=kukulu")).toEqual({ kind: "door", door: "rite", argv: ["rite", "kukulu"], set: {}, notes: [] });
    expect(read("lei=show", "rite=kukulu", "branch=develop")).toMatchObject({ kind: "door", door: "lei", argv: ["lei", "show", "--rite=kukulu", "--branch=develop"] });
    expect(read("bag=show")).toMatchObject({ kind: "door", door: "bag", argv: ["bag", "show"] });
    expect(read("vessel=stand", "restart=true", "with=--page")).toMatchObject({ argv: ["vessel", "stand", "--restart", "--page"] });
    expect(read("meme=offer show")).toMatchObject({ argv: ["meme", "offer", "show"] });
  });

  test("RED: a door folds the dials its code walks: the Pentacle asks --dry-run, the Sword alone --json, Rest nothing; any other carry refuses until its carrier lands", () => {
    expect(read("bag=sweep", "mu=_0")).toMatchObject({ argv: ["bag", "sweep", "--dry-run"] });
    expect(read("bag=sweep", "mu=_!")).toMatchObject({ argv: ["bag", "sweep", "--dry-run"] });
    expect(read("bag=sweep", "mu=overview")).toMatchObject({ argv: ["bag", "sweep", "--dry-run"] });
    expect(read("bag=show", "mu=!")).toMatchObject({ argv: ["bag", "show", "--json"] });
    expect(read("bag=show", "mu=00")).toMatchObject({ argv: ["bag", "show"] });
    expect(refusal("rite=kukulu", "mu=_!").code).toBe("mu-cell-empty");
    expect(refusal("bag=show", "mu=*?").code).toBe("mu-cell-empty");
    expect(refusal("bag=show", "mu=relate")).toMatchObject({ code: "mu-malformed", cure: "lares bag=show mu=cup" });
  });

  test("RED: a door folds aperture where it reads a range (arc and theme ask --verbose), and names it testimony where it reads none", () => {
    expect(read("vessel=read", "aperture=arc")).toMatchObject({ argv: ["vessel", "read", "--verbose"], notes: [] });
    const rite = read("rite=kukulu", "aperture=arc");
    expect(rite).toMatchObject({ argv: ["rite", "kukulu"] });
    expect(rite.kind === "door" ? rite.notes.join(" ") : "").toContain("aperture=16/arc rides as testimony");
    expect(refusal("rite=kukulu", "aperture=3/measure").code).toBe("aperture-malformed");
  });

  test("RED: no act key reads the house (the bare door), its dials and face beside it; any other key refuses naming the act keys", () => {
    expect(read("mu=00", "aperture=beat")).toEqual({ kind: "bare", params: { mu: "00", aperture: "beat" }, set: {} });
    expect(read("mu=*", "face=h1", "stance=philosopher")).toEqual({ kind: "bare", params: { mu: "*", face: "h1" }, set: { stance: "philosopher" } });
    expect(refusal("title=x").code).toBe("act-key-unnamed");
  });

  test("RED: every seed carry and every aperture rank reads on a keypad line, the two dials crossing", () => {
    for (const carry of MU_CARRY_ORDER) {
      for (const rank of APERTURE_RANKS) {
        expect(read("get=T", `mu=${carry}`, `aperture=${rank}`), `${carry} ${rank}`).toMatchObject({ kind: "call", params: { title: "T", mu: carry, aperture: rank } });
        expect(read(`mu=${MU_CARRIES[carry]!.name}`, `aperture=${rank}`), `${carry} ${rank} bare`).toMatchObject({ kind: "bare", params: { mu: MU_CARRIES[carry]!.name, aperture: rank } });
      }
    }
  });
});

describe("the flag zoo burns into the dials", () => {
  test("RED: each burned flag answers a teaching refusal naming the keypad line with its dial", () => {
    for (const [flag, dial] of Object.entries(BURNED_FLAGS)) {
      const said = refusal("get=T", `--${flag}`);
      expect(said.code, flag).toBe("keypad-flag");
      expect(said.cure, flag).toBe(`lares get=T ${dial}`);
    }
    expect(BURNED_FLAGS).toEqual({ "dry-run": "mu=_0", json: "mu=!0", quiet: "mu=!0", meme: "aperture=measure", skinny: "aperture=measure", all: "aperture=arc", grain: "aperture=arc" });
    expect(refusal("get=T", "--grain=skinny").cure).toBe("lares get=T aperture=measure");
    expect(refusal("rite=kukulu", "--rollback").cure).toBe("lares rite=kukulu rollback=true");
  });

  test("RED: a bare word on a keypad line refuses, naming the key whose value carries it", () => {
    const said = refusal("rite=kukulu", "now");
    expect(said.code).toBe("keypad-positional");
    expect(said.cure).toBe("lares rite='kukulu now'");
  });
});

describe("a positional spelling teaches the keypad line", () => {
  test("RED: a call word's bare title reads as its act key; the call shape and a help ask stand", () => {
    expect(positionalCure("get", ["Room4"])).toBe("lares get=Room4");
    expect(positionalCure("get", ["Room 4", "recipe=kahu"])).toBe("lares get='Room 4' recipe=kahu");
    expect(positionalCure("rename", ["Old", "New"])).toBe("lares rename=Old to=New");
    expect(positionalCure("get", ["title=Room4"])).toBeNull();
    expect(positionalCure("get", [])).toBeNull();
    expect(positionalCure("act", ["lar:///engine.law.indexes"])).toBeNull();
    expect(positionalCure("rite", ["kukulu"])).toBeNull();
  });

  test("RED: dispatch refuses `lares get Room4` with exit 2, naming `lares get=Room4`, and sends nothing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await dispatch(["get", "Room4"])).toBe(2);
      expect(err.mock.calls.flat().join(" ")).toContain("`lares get=Room4`");
      expect(h.calls).toEqual([]);
    } finally { err.mockRestore(); }
  });
});

describe("the keypad runs the line it reads", () => {
  test("RED: `lares get=<title> aperture=arc` sends the plan `lares get title=<title> aperture=arc` sends", async () => {
    const keyed = keypadArgv(["get=lar:///t/x", "aperture=arc", "mu=!0"]);
    expect(keyed).toMatchObject({ argv: ["get", "title=lar:///t/x", "aperture=arc", "mu=!0"] });
    const out = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      h.reply = { has: "<<~ has name=`lar:///t/x`>>" };
      await dispatch(["get=lar:///t/x", "aperture=arc", "mu=!0"]);
      await dispatch(["get", "title=lar:///t/x", "aperture=arc", "mu=!0"]);
    } finally { out.mockRestore(); }
    expect(h.calls).toHaveLength(2);
    expect(h.calls[0]).toEqual(h.calls[1]);
    expect(h.calls[0]!.args).toMatchObject({ verb: "get", params: { title: "lar:///t/x", aperture: "arc", mu: "!0" }, surface: "cli" });
  });

  test("RED: a keypad refusal exits 2 before anything runs", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await dispatch(["get=x", "rite=kukulu"])).toBe(2);
      expect(await dispatch(["get=x", "--json"])).toBe(2);
      expect(err.mock.calls.flat().join(" ")).toContain("mu=!0");
      expect(h.calls).toEqual([]);
    } finally { err.mockRestore(); }
  });
});
