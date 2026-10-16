/**
 * `lares fleet join --face N` hands the root holder's two acts the face it names; a bare `--face`, a negation or
 * a value that reads as no index refuses, and no act reaches the store door, since a silent fallback would sign the
 * join under the founding face's root.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const seam = vi.hoisted(() => ({ asked: [] as Array<[string, Record<string, unknown>]> }));

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
});
