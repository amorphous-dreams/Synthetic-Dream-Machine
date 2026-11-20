/**
 * lei-land-command — `lares lei land '<record>'`: the vessel lands a lei the hand signed at the pūlama (road 4b, Wave 4b lane B).
 *
 * Under a pūlama the hand strings, restrings and unstrings a lei at the pūlama's hand door, sign-only; the answer it prints
 * carries the signed record and its face, or (one stringing for every open face) one such answer per face. `lei land` plans the
 * rows that land them: a lei rides the kui row (a restring too, after the tip it names), an unstring the unstring row, each
 * carrying the record as `signed`, so the vessel asks no route. The plan alone runs here: no vessel stands. Every red pairs with
 * a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/parse-args.js";
import { LeiUsage, leiLandPlans, leiPlan } from "../src/commands/lei.js";

const CID = "c".repeat(64);
const plan = (...line: string[]) => leiPlan(parseArgs(["lei", ...line]));
const land = (...line: string[]) => leiLandPlans(parseArgs(["lei", "land", ...line]));
const lei = { body: { act: "lei", group: "g", rite: "kukulu", branch: "main", after: null, reach: "wide", returns: 2, kind: "lar.swarm.act" }, signer: "a".repeat(64), sig: "s" };
const unstrung = { body: { act: "lei-unstrung", group: "g", rite: "kukulu", branch: "main", lei: CID, kind: "lar.swarm.act" }, signer: "a".repeat(64), sig: "s" };

describe("lares lei land plans the rows that land hand records", () => {
  it("RED: the pūlama's answer lands by the kui row with its face, an unstring by the unstring row, and a bare record with --face; CONTROL: kui plans as it stood", () => {
    expect(plan("kui", "--rite", "push", "--branch", "feature/x", "--returns", "3")).toEqual({ verb: "swarm-lei-kui", args: { rite: "push", branch: "feature/x", returns: 3, after: null } });
    expect(land(JSON.stringify({ op: "lei", act: "kui", reading: "signed", face: 2, record: lei, cid: CID }))).toEqual({ plans: [{ verb: "swarm-lei-kui", args: { signed: lei, face: 2 } }] });
    expect(land(JSON.stringify({ op: "lei", act: "restring", reading: "signed", face: 0, record: lei, restrung: CID }))).toEqual({ plans: [{ verb: "swarm-lei-kui", args: { signed: lei, face: 0 } }] });
    expect(land(JSON.stringify({ op: "lei", act: "unstring", reading: "signed", face: 0, record: unstrung }))).toEqual({ plans: [{ verb: "swarm-lei-unstring", args: { signed: unstrung, face: 0 } }] });
    expect(land(JSON.stringify(lei), "--face", "1")).toEqual({ plans: [{ verb: "swarm-lei-kui", args: { signed: lei, face: 1 } }] });
    expect(land(JSON.stringify(lei))).toEqual({ plans: [{ verb: "swarm-lei-kui", args: { signed: lei } }] });
  });

  it("RED: one stringing for every face lands each face's record by its own face; a signing that stopped at one face lands the faces signed before it and names the stop; CONTROL: a stop with nothing signed lands nothing", () => {
    const signed = (face: number) => ({ op: "lei", act: "kui", reading: "signed", face, record: lei, cid: CID });
    expect(land(JSON.stringify({ op: "lei", act: "kui", reading: "signed", faces: [signed(0), signed(2)] })))
      .toEqual({ plans: [{ verb: "swarm-lei-kui", args: { signed: lei, face: 0 } }, { verb: "swarm-lei-kui", args: { signed: lei, face: 2 } }] });
    const stop = { op: "lei", act: "kui", reading: "face-group-unread", face: 1, detail: "no group" };
    expect(land(JSON.stringify({ op: "lei", act: "kui", reading: "face-group-unread", faces: [signed(0), stop] })))
      .toEqual({ plans: [{ verb: "swarm-lei-kui", args: { signed: lei, face: 0 } }], stopped: { face: 1, reading: "face-group-unread", detail: "no group" } });
    expect(() => land(JSON.stringify({ op: "lei", act: "kui", reading: "ward-no-slot-opens", faces: [{ ...stop, reading: "ward-no-slot-opens" }] }))).toThrow(LeiUsage);
    expect(() => land(JSON.stringify({ op: "lei", act: "kui", reading: "signed", faces: [signed(0)] }), "--face", "0")).toThrow(LeiUsage);
  });

  it("RED: no record, a record that reads as no JSON, an answer the pūlama refused, a body no lei forms, and a face the answer and the line name apart each refuse by usage; CONTROL: the same answer with one face plans", () => {
    for (const line of [[], ["not json"], ["[1]"], [JSON.stringify({ op: "lei", reading: "ward-no-slot-opens", face: 0 })],
      [JSON.stringify({ ...lei, body: { ...lei.body, act: "receipt" } })], [JSON.stringify({ op: "lei", reading: "signed", face: 0, record: lei }), "--face", "2"],
      [JSON.stringify(lei), "extra"]]) {
      expect(() => land(...line), line.join(" ")).toThrow(LeiUsage);
    }
    expect(land(JSON.stringify({ op: "lei", reading: "signed", face: 2, record: lei }), "--face", "2")).toEqual({ plans: [{ verb: "swarm-lei-kui", args: { signed: lei, face: 2 } }] });
  });
});
