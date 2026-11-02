/**
 * `lares kahua` — the operator's door onto a face's kahua stage: mint the pin, propose, lift and withdraw by hand, read.
 *
 * Each act reaches the store door's matching row (`kahua-mint`, `kahua-propose`, `kahua-lift`, `kahua-withdraw`,
 * `kahua-read`) with the arguments the row reads, and prints the row's answer as JSON. A malformed ask refuses before
 * the door. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ calls: [] as Array<[string, Record<string, unknown>]>, output: {} as Record<string, unknown> }));
vi.mock("../src/store-door.js", () => ({
  storeVerb: async (verb: string, args: Record<string, unknown>) => {
    seam.calls.push([verb, args]);
    return { output: seam.output };
  },
  StoreDoorRefusal: class extends Error {},
}));

import { cmdKahua } from "../src/commands/kahua.js";
import { parseArgs } from "../src/parse-args.js";

const run = (...argv: string[]) => cmdKahua(parseArgs(["kahua", ...argv]));
const CID = "c".repeat(64);
const SOURCES = JSON.stringify([{ title: "daemon/T", revision: "r1" }]);

describe("lares kahua", () => {
  let lines: string[];
  beforeEach(() => {
    seam.calls = []; seam.output = { cid: CID, parent: null }; lines = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => { lines.push(String(line)); });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("RED: a lift reaches the lift row with its title, body, taint list and sources, and prints the row's answer as JSON", async () => {
    expect(await run("lift", "T", "--face", "1", "--text", "body", "--taint", "web:example,tool:search", "--sources", SOURCES)).toBe(0);
    expect(seam.calls).toEqual([["kahua-lift", { face: 1, title: "T", text: "body", taint: ["web:example", "tool:search"], sources: [{ title: "daemon/T", revision: "r1" }] }]]);
    expect(JSON.parse(lines.join("\n"))).toEqual({ cid: CID, parent: null });
  });

  test("RED: `--taint none` names an empty taint list, `--parent none` a first lift, and a proposal rides by id; CONTROL: a lift naming no taint refuses before the door", async () => {
    expect(await run("lift", "T", "--text", "body")).toBe(1);
    expect(seam.calls).toEqual([]);
    expect(await run("lift", "T", "--text", "body", "--taint", "none", "--parent", "none", "--proposal", "p".repeat(8))).toBe(0);
    expect(seam.calls[0]).toEqual(["kahua-lift", { title: "T", text: "body", taint: [], parent: null, proposal: "p".repeat(8) }]);
    expect(await run("lift", "T", "--text", "body", "--taint", "none", "--parent", CID, "--fields", "{\"tags\":\"a b\"}")).toBe(0);
    expect(seam.calls[1]).toEqual(["kahua-lift", { title: "T", text: "body", taint: [], parent: CID, fields: { tags: "a b" } }]);
  });

  test("RED: mint, propose, withdraw, list and get reach their rows; CONTROL: malformed JSON and a bare act refuse before the door", async () => {
    expect(await run("mint", "--face", "0")).toBe(0);
    const proposals = [{ title: "T", revision: "r1", text: "body", taint: [] }];
    expect(await run("propose", "--proposals", JSON.stringify(proposals))).toBe(0);
    expect(await run("withdraw", CID)).toBe(0);
    expect(await run("list")).toBe(0);
    expect(await run("get", "T", "--history")).toBe(0);
    expect(seam.calls).toEqual([
      ["kahua-mint", { face: 0 }],
      ["kahua-propose", { proposals }],
      ["kahua-withdraw", { target: CID }],
      ["kahua-read", { action: "list" }],
      ["kahua-read", { action: "get", title: "T", history: true }],
    ]);
    seam.calls = [];
    expect(await run("propose", "--proposals", "{not json")).toBe(1);
    expect(await run("withdraw")).toBe(1);
    expect(await run("get")).toBe(1);
    expect(await run("burn")).toBe(1);
    expect(await run("lift", "T", "--taint", "none", "--sources", "[oops")).toBe(1);
    expect(seam.calls).toEqual([]);
  });
});
