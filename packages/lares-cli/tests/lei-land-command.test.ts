/**
 * lei-land-command — `lares lei land '<record>'`: the vessel lands a lei the hand signed at the pūlama (road 4b, Wave 4b lane B).
 *
 * Under a pūlama the hand strings, restrings and unstrings a lei at the pūlama's hand door, sign-only; the answer it prints
 * carries the signed record and its face. `lei land` plans the row that lands it: a lei rides the kui row (a restring too, after
 * the tip it names), an unstring the unstring row, each carrying the record as `signed`, so the vessel asks no route.
 * The plan alone runs here: no vessel stands. Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/parse-args.js";
import { LeiUsage, leiPlan } from "../src/commands/lei.js";

const CID = "c".repeat(64);
const plan = (...line: string[]) => leiPlan(parseArgs(["lei", ...line]));
const lei = { body: { act: "lei", group: "g", rite: "kukulu", branch: "main", after: null, reach: "wide", returns: 2, kind: "lar.swarm.act" }, signer: "a".repeat(64), sig: "s" };
const unstrung = { body: { act: "lei-unstrung", group: "g", rite: "kukulu", branch: "main", lei: CID, kind: "lar.swarm.act" }, signer: "a".repeat(64), sig: "s" };

describe("lares lei land plans the row that lands a hand record", () => {
  it("RED: the pūlama's answer lands by the kui row with its face, an unstring by the unstring row, and a bare record with --face; CONTROL: kui plans as it stood", () => {
    expect(plan("kui", "--rite", "push", "--branch", "feature/x", "--returns", "3")).toEqual({ verb: "swarm-lei-kui", args: { rite: "push", branch: "feature/x", returns: 3, after: null } });
    expect(plan("land", JSON.stringify({ op: "lei", act: "kui", reading: "signed", face: 2, record: lei, cid: CID }))).toEqual({ verb: "swarm-lei-kui", args: { signed: lei, face: 2 } });
    expect(plan("land", JSON.stringify({ op: "lei", act: "restring", reading: "signed", face: 0, record: lei, restrung: CID }))).toEqual({ verb: "swarm-lei-kui", args: { signed: lei, face: 0 } });
    expect(plan("land", JSON.stringify({ op: "lei", act: "unstring", reading: "signed", face: 0, record: unstrung }))).toEqual({ verb: "swarm-lei-unstring", args: { signed: unstrung, face: 0 } });
    expect(plan("land", JSON.stringify(lei), "--face", "1")).toEqual({ verb: "swarm-lei-kui", args: { signed: lei, face: 1 } });
    expect(plan("land", JSON.stringify(lei))).toEqual({ verb: "swarm-lei-kui", args: { signed: lei } });
  });

  it("RED: no record, a record that reads as no JSON, an answer the pūlama refused, a body no lei forms, and a face the answer and the line name apart each refuse by usage; CONTROL: the same answer with one face plans", () => {
    for (const line of [["land"], ["land", "not json"], ["land", "[1]"], ["land", JSON.stringify({ op: "lei", reading: "ward-no-slot-opens", face: 0 })],
      ["land", JSON.stringify({ ...lei, body: { ...lei.body, act: "receipt" } })], ["land", JSON.stringify({ op: "lei", reading: "signed", face: 0, record: lei }), "--face", "2"],
      ["land", JSON.stringify(lei), "extra"]]) {
      expect(() => plan(...line), line.join(" ")).toThrow(LeiUsage);
    }
    expect(plan("land", JSON.stringify({ op: "lei", reading: "signed", face: 2, record: lei }), "--face", "2")).toEqual({ verb: "swarm-lei-kui", args: { signed: lei, face: 2 } });
  });
});
