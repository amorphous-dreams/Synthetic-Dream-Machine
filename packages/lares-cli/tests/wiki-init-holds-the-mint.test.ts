/** `lares wiki init` holds the wiki it mints, within the face's hold budget; a full budget is named, never silent, and nothing is evicted. */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const sent: string[] = [];
let minted = "minted";
let held: string[] = [];
let budget = 3;
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: () => null,
  runVerb: async (name: string) => {
    sent.push(name);
    const output = name === "init-wiki" ? { status: minted, wikiUri: "u", wikiDocUrl: "d", draftBagId: "b", draftDocUrl: "e", recipeUri: "r" }
      : name === "wiki-active" ? { active: [], held, pinBudget: budget, activationCap: 4 }
      : { held: true, holds: [...held, "fresh"], budget };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({ ...(await orig<typeof import("../src/env.js")>()), vesselDid: async () => "0x" + "ab".repeat(32) }));

import { cmdWikiInit } from "../src/commands/wiki.js";
import { parseArgs } from "../src/parse-args.js";

let text = "";
beforeEach(() => {
  sent.length = 0; text = ""; minted = "minted"; held = []; budget = 3;
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { text += a.join(" ") + "\n"; });
  vi.spyOn(process.stdout, "write").mockImplementation(((s: string | Uint8Array) => { text += String(s); return true; }) as typeof process.stdout.write);
});
afterEach(() => { vi.restoreAllMocks(); });

test("a freshly minted wiki is held within the budget", async () => {
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "--no-json"]))).toBe(0);
  expect(sent).toContain("wiki-hold");
});

test("a full budget holds nothing, names the budget and the verb that frees a hold", async () => {
  held = ["a", "b", "c"];
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "--no-json"]))).toBe(0);
  expect(sent).not.toContain("wiki-hold");
  expect(text).toMatch(/3\/3/);
  expect(text).toContain("lares wiki release");
  expect(text).toContain("fresh");
});

test("control: a wiki that already stood is not held by a re-init", async () => {
  minted = "already-exists";
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "--no-json"]))).toBe(0);
  expect(sent).not.toContain("wiki-hold");
});
