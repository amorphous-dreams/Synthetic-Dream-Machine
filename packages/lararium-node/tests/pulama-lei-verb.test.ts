/**
 * pulama-lei-verb — `pulama-main.js lei kui|restring|unstring '<terms>'`: the hand's lei verb line at the pūlama.
 *
 * The verb reads the door first (an unlit pūlama asks no route), then reads the route on a real terminal and hands the hand door
 * one `lei` frame: the terms the line names and the route beside them. The terms ride the line as one JSON object; a route never
 * rides it. Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { describe, expect, test } from "vitest";
import { PulamaVerbUsage, runHandVerb } from "../src/pulama-verbs.js";

const CID = "c".repeat(64);

function ports(lit: boolean) {
  const frames: Array<Record<string, unknown>> = [], asked: string[] = [];
  return {
    frames, asked,
    ask: async (frame: Readonly<Record<string, unknown>>) => {
      frames.push({ ...frame });
      return frame["op"] === "status" ? { op: "status", lit } : { op: String(frame["op"]), reading: "signed" };
    },
    route: async (label: string) => { asked.push(label); return "the-route"; },
  };
}

describe("the hand's lei verb at the pūlama", () => {
  test("RED: `lei kui` reads the door, asks the route naming the lei and its face, and hands one lei frame with the terms and the route; restring and unstring ride the same line; CONTROL: status answers as it stood", async () => {
    const p = ports(true);
    expect(await runHandVerb("status", undefined, p)).toEqual({ op: "status", lit: true });
    p.frames.length = 0;
    expect(await runHandVerb("lei", ["kui", JSON.stringify({ face: 0, rite: "kukulu", branch: "main", returns: 2 })], p)).toEqual({ op: "lei", reading: "signed" });
    expect(p.frames).toEqual([{ op: "status" }, { op: "lei", act: "kui", face: 0, rite: "kukulu", branch: "main", returns: 2, credentials: [{ kind: "passphrase", passphrase: "the-route" }] }]);
    expect(p.asked).toHaveLength(1);
    expect(p.asked[0]).toContain("kukulu");
    expect(p.asked[0]).toContain("main");
    expect(p.asked[0]).toContain("h0");
    await runHandVerb("lei", ["restring", JSON.stringify({ face: 2, rite: "keep", branch: "house-backup", after: CID, returns: 6 })], p);
    await runHandVerb("lei", ["unstring", JSON.stringify({ face: 2, rite: "keep", branch: "house-backup", lei: CID })], p);
    expect(p.frames.filter((f) => f["op"] === "lei").map((f) => [f["act"], f["face"]])).toEqual([["kui", 0], ["restring", 2], ["unstring", 2]]);
  });

  test("RED: terms naming every open face (`faces`) read the route ONCE, naming each face, and hand one lei frame per face under it, each that face's own; the answer names each face's", async () => {
    const p = ports(true);
    const each = (face: number, after: string | null) => ({ face, rite: "kukulu", branch: "main", returns: 2, after });
    const answer = await runHandVerb("lei", ["kui", JSON.stringify({ faces: [each(0, null), each(1, CID)] })], p);
    expect(p.asked).toHaveLength(1);
    expect(p.asked[0]).toMatch(/h0, h1/);
    const route = [{ kind: "passphrase", passphrase: "the-route" }];
    expect(p.frames).toEqual([{ op: "status" }, { op: "lei", act: "kui", ...each(0, null), credentials: route }, { op: "lei", act: "kui", ...each(1, CID), credentials: route }]);
    expect(answer).toEqual({ op: "lei", act: "kui", reading: "signed", faces: [{ op: "lei", reading: "signed" }, { op: "lei", reading: "signed" }] });
  });

  test("RED: the every-face signing stops at the first face that refuses, so one mistyped route spends one attempt; the answer reads that refusal and names the faces signed before it", async () => {
    const p = ports(true);
    let n = 0;
    const ask = async (frame: Readonly<Record<string, unknown>>) => {
      p.frames.push({ ...frame });
      if (frame["op"] === "status") return { op: "status", lit: true };
      n += 1;
      return n === 1 ? { op: "lei", reading: "signed", face: 0 } : { op: "lei", reading: "ward-no-slot-opens", face: frame["face"] as number };
    };
    const each = (face: number) => ({ face, rite: "kukulu", branch: "main", returns: 1, after: null });
    const answer = await runHandVerb("lei", ["kui", JSON.stringify({ faces: [each(0), each(1), each(2)] })], { ...p, ask });
    expect(p.frames.filter((f) => f["op"] === "lei").map((f) => f["face"])).toEqual([0, 1]);
    expect(answer).toEqual({ op: "lei", act: "kui", reading: "ward-no-slot-opens", faces: [{ op: "lei", reading: "signed", face: 0 }, { op: "lei", reading: "ward-no-slot-opens", face: 1 }] });
    // Usage: `faces` names no list, an empty one, or one whose entry reads as no object, or carries a route.
    for (const bad of [{ faces: 1 }, { faces: [] }, { faces: [1] }, { faces: [{ ...each(0), credentials: [] }] }]) {
      const q = ports(true);
      await expect(runHandVerb("lei", ["kui", JSON.stringify(bad)], q), JSON.stringify(bad)).rejects.toBeInstanceOf(PulamaVerbUsage);
      expect(q.frames).toEqual([]);
    }
  });

  test("RED: an unlit pūlama answers `pulama-locked` and asks no route; CONTROL: a lit one asks once", async () => {
    const dark = ports(false);
    expect(await runHandVerb("lei", ["kui", JSON.stringify({ face: 0, rite: "kukulu", branch: "main", returns: 1 })], dark)).toMatchObject({ op: "lei", reading: "pulama-locked" });
    expect(dark.asked).toEqual([]);
    expect(dark.frames).toEqual([{ op: "status" }]);
    const lit = ports(true);
    await runHandVerb("lei", ["kui", JSON.stringify({ face: 0, rite: "kukulu", branch: "main", returns: 1 })], lit);
    expect(lit.asked).toHaveLength(1);
  });

  test("RED: a line naming no act, an unknown act, terms that read as no object, and terms carrying a route each read as usage before the door; CONTROL: the whole line runs", async () => {
    for (const arg of [undefined, "kui", ["kui"], ["issue", "{}"], ["kui", "not json"], ["kui", "[1]"], ["kui", JSON.stringify({ face: 0, credentials: [{ kind: "passphrase", passphrase: "x" }] })], ["kui", "{}", "extra"]]) {
      const p = ports(true);
      await expect(runHandVerb("lei", arg as never, p), JSON.stringify(arg)).rejects.toBeInstanceOf(PulamaVerbUsage);
      expect(p.frames).toEqual([]);
    }
    const p = ports(true);
    await expect(runHandVerb("lei", ["kui", "{}"], p)).resolves.toEqual({ op: "lei", reading: "signed" });
  });
});
