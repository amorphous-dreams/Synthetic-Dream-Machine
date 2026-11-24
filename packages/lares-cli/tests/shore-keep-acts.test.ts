/**
 * THE AWAITING STAND-OFF'S ACTIONS, as `lares shore` carries them: each names a runnable command, and each rides a door the
 * shore already holds. `keep-records` rides `take-records`; `keep-disk` rides `take-disk` whole (no merge); `keep-both`
 * rides its own op (the drafts stay, the records take the file); `drafts` reads titles alone and asks no confirmation.
 */
import { describe, expect, test, vi } from "vitest";
import { cmdShore, shoreArgs, shoreHandRefusal, SHORE_ACTS } from "../src/commands/shore.js";
import type { ParsedArgs } from "../src/parse-args.js";

const URI = "lar:///ha.ka.ba/x/note";
const parsed = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ positional, options, flags } as unknown as ParsedArgs);

describe("lares shore keep-disk | keep-records | keep-both | drafts", () => {
  test("each action the alert names stands among the shore's acts", () => {
    for (const act of ["keep-disk", "keep-records", "keep-both", "drafts"]) expect(SHORE_ACTS).toContain(act);
  });

  test("keep-records rides take-records; keep-disk rides take-disk whole; keep-both its own op", () => {
    expect(shoreArgs("keep-records", parsed(["keep-records", URI], { key: "k1" }))).toEqual({ args: { op: "take-records", uri: URI, key: "k1" } });
    expect(shoreArgs("keep-disk", parsed(["keep-disk", URI], { key: "k1" }))).toEqual({ args: { op: "take-disk", uri: URI, key: "k1", whole: true } });
    expect(shoreArgs("keep-both", parsed(["keep-both", URI], { key: "k1", bag: "lar:///ha.ka.ba/bags/x" }))).toEqual({ args: { op: "keep-both", uri: URI, key: "k1", bag: "lar:///ha.ka.ba/bags/x" } });
    expect(shoreArgs("drafts", parsed(["drafts", URI]))).toEqual({ args: { op: "drafts", uri: URI } });
  });

  test("a keyed action names its key, or the usage names the command that runs it", () => {
    const shaped = shoreArgs("keep-both", parsed(["keep-both", URI]));
    expect(shaped).toEqual({ usage: "keep-both names a carrier and the standoff's key: lares shore keep-both <uri> --key <key>" });
    expect(shoreArgs("drafts", parsed(["drafts"]))).toEqual({ usage: "drafts names a carrier: lares shore drafts <uri>" });
  });
});

describe("settling a stand-off stays a hand act at the command", () => {
  const SETTLES = ["take-records", "take-disk", "keep-disk", "keep-records", "keep-both"] as const;

  test("an AI harness on the command's branch refuses hand-act-only, naming the command the operator runs", () => {
    for (const act of SETTLES) {
      const refused = shoreHandRefusal(act, { uri: URI, key: "k1" }, () => ({ refusal: "hand-act-only" }));
      expect(refused?.code, act).toBe("hand-act-only");
      expect(refused?.message, act).toContain(`lares shore ${act} ${URI} --key k1`);
    }
    expect(shoreHandRefusal("keep-both", { uri: URI, key: "k1" }, () => ({ refusal: "hand-unattested" }))?.code).toBe("hand-unattested");
  });

  test("a person's hand passes, and the acts that settle nothing never ask", () => {
    for (const act of SETTLES) expect(shoreHandRefusal(act, { uri: URI, key: "k1" }, () => ({ admit: "hand" }))).toBeNull();
    for (const act of ["list", "drafts", "flush", "settle"] as const) expect(shoreHandRefusal(act, { uri: URI }, () => ({ refusal: "hand-act-only" }))).toBeNull();
  });

  test("--yes approves nothing: a seat's keep-both refuses before any verb runs", async () => {
    const said: string[] = [];
    const out = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { said.push(a.map(String).join(" ")); });
    const err = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.map(String).join(" ")); });
    const wrote = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { said.push(String(chunk)); return true; });
    try {
      const code = await cmdShore(parsed(["keep-both", URI], { key: "k1" }, { yes: true, json: true }), { hand: () => ({ refusal: "hand-act-only" }) });
      expect(code).not.toBe(0);
    } finally { out.mockRestore(); err.mockRestore(); wrote.mockRestore(); }
    expect(said.join("\n")).toContain("hand-act-only");
    expect(said.join("\n")).toContain(`lares shore keep-both ${URI} --key k1`);
  });
});
