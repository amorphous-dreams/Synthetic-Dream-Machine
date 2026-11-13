/**
 * `lares fleet join --face N` hands the root holder's two acts the face it names; a bare `--face`, a negation or
 * a value that reads as no index refuses, and no act reaches the store door, since a silent fallback would sign the
 * join under the founding face's root.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ asked: [] as Array<[string, Record<string, unknown>]>, ran: [] as string[] }));

// The joinee's runners stand in: a refused act must reach none of them, and a control must reach its own.
vi.mock("@lararium/node", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lararium/node")>()),
  runFleetJoinRequest: async () => { seam.ran.push("request"); return { kind: "request" }; },
  runFleetJoinLand: async () => { seam.ran.push("land"); },
  runFleetJoinAbandon: async () => { seam.ran.push("abandon"); return true; },
  ownedStore: async (_dir: string, use: (repo: unknown) => unknown) => use({}),
}));

vi.mock("../src/store-door.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/store-door.js")>()),
  storeVerb: async (verb: string, args: Record<string, unknown>) => {
    seam.asked.push([verb, args]);
    return { output: verb === "fleet-join-offer" ? { offer: { kind: "offer" } } : { answer: { kind: "answer" } } };
  },
}));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  readFileSync: () => JSON.stringify({ nonce: "0".repeat(64) }),
}));

import { cmdFleet } from "../src/commands/fleet.js";
import { parseArgs } from "../src/parse-args.js";

const run = (...argv: string[]) => cmdFleet(parseArgs(["fleet", "join", ...argv]));

describe("fleet join --face", () => {
  beforeEach(() => {
    seam.asked = [];
    seam.ran = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  test("CONTROL: no --face asks the store door with no face", async () => {
    expect(await run("offer")).toBe(0);
    expect(seam.asked).toEqual([["fleet-join-offer", {}]]);
  });

  test("--face 2 reaches offer and answer as the number 2", async () => {
    expect(await run("offer", "--face", "2")).toBe(0);
    expect(await run("answer", "request.json", "--face=2")).toBe(0);
    expect(seam.asked.map(([verb, args]) => [verb, args["face"]])).toEqual([["fleet-join-offer", 2], ["fleet-join-answer", 2]]);
  });

  test("NONSENSE: a bare --face, a negation or a non-index refuses and asks nothing", async () => {
    for (const argv of [["offer", "--face"], ["offer", "--no-face"], ["answer", "request.json", "--face"], ["offer", "--face", "one"], ["offer", "--face", "-1"], ["offer", "--face", "1.5"], ["offer", "--face", "01"]]) {
      expect(await run(...argv), argv.join(" ")).toBe(1);
    }
    expect(seam.asked).toEqual([]);
  });

  test("CONTROL: request, land and abandon without --face reach their runners", async () => {
    expect(await run("request", "offer.json")).toBe(0);
    expect(await run("land", "answer.json")).toBe(0);
    expect(await run("abandon")).toBe(0);
    expect(seam.ran).toEqual(["request", "land", "abandon"]);
  });

  test("the joinee names no face: --face on request, land and abandon refuses by name and runs nothing", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => { errors.push(String(line)); });
    for (const argv of [
      ["request", "offer.json", "--face", "1"], ["request", "offer.json", "--face=1"], ["request", "offer.json", "--face"], ["request", "offer.json", "--no-face"],
      ["land", "answer.json", "--face", "1"], ["land", "answer.json", "--face=0"],
      ["abandon", "--face", "1"], ["abandon", "--face=1"],
    ]) {
      errors.length = 0;
      expect(await run(...argv), argv.join(" ")).toBe(1);
      expect(errors.join("\n"), argv.join(" ")).toMatch(/face-joinee|joinee/);
      expect(errors.join("\n"), argv.join(" ")).toMatch(/rides the offer/);
    }
    expect(seam.ran).toEqual([]);
    expect(seam.asked).toEqual([]);
  });
});
