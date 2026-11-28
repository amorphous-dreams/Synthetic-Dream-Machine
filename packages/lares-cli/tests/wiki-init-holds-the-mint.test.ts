/** `lares wiki init` holds the wiki it mints, within the face's keep budget; a full budget is named, never silent, and nothing is evicted. */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const sent: string[] = [];
let minted = "minted";
let held: string[] = [];
let budget = 3;
let extra: Record<string, unknown> = {};
let holdOut: Record<string, unknown> | null = null;
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  verbFailure: () => null,
  runVerb: async (name: string) => {
    sent.push(name);
    const output = name === "init-wiki" ? { status: minted, ...extra, wikiUri: "u", wikiDocUrl: "d", draftBagId: "b", draftDocUrl: "e", recipeUri: "r" }
      : name === "wiki-active" ? { active: [], held, keepBudget: budget, activationCap: 4 }
      : holdOut ?? { held: true, holds: [...held, "fresh"], budget };
    return { status: "done", requestId: "r", results: { summary: { ok: true, output } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({ ...(await orig<typeof import("../src/env.js")>()), vesselDid: async () => "0x" + "ab".repeat(32) }));

import { cmdWikiInit } from "../src/commands/wiki.js";
import { parseArgs } from "../src/parse-args.js";

let text = "";
beforeEach(() => {
  sent.length = 0; text = ""; minted = "minted"; held = []; budget = 3; extra = {}; holdOut = null;
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { text += a.join(" ") + "\n"; });
  vi.spyOn(process.stdout, "write").mockImplementation(((s: string | Uint8Array) => { text += String(s); return true; }) as typeof process.stdout.write);
});
afterEach(() => { vi.restoreAllMocks(); });

test("a freshly minted wiki is held within the budget", async () => {
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "json=false"]))).toBe(0);
  expect(sent).toContain("wiki-keep");
});

test("a full budget holds nothing, names the budget and the verb that frees a hold", async () => {
  held = ["a", "b", "c"];
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "json=false"]))).toBe(0);
  expect(sent).not.toContain("wiki-keep");
  expect(text).toMatch(/3\/3/);
  expect(text).toContain("lares wiki unkeep <slug>");
  expect(text).toContain("fresh");
});

test("control: a wiki that already stood is not held by a re-init", async () => {
  minted = "already-exists";
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "json=false"]))).toBe(0);
  expect(sent).not.toContain("wiki-keep");
});

test("RED (referee walk #1/#6) an init that completed a partial says plainly what it stood, and holds the wiki", async () => {
  minted = "completed";
  extra = { canonReused: "floor", bagsRegistered: ["lar:///ha.ka.ba/bags/fresh", "lar:///ha.ka.ba/wikis/fresh/working"], workbench: { realmId: "f".repeat(64), founded: true } };
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "json=false"]))).toBe(0);
  expect(sent).toContain("wiki-keep");
  expect(text).not.toMatch(/completed-partial/);
  expect(text).toMatch(/completed: canon reused from the floor; bags registered: lar:\/\/\/ha\.ka\.ba\/bags\/fresh, lar:\/\/\/ha\.ka\.ba\/wikis\/fresh\/working; workbench founded \(realm ffffffffffff…\)/);
});

test("RED (referee walk #1) a workbench this face cannot stand reads as a named line, never a silent nothing", async () => {
  minted = "already-exists";
  extra = { bagsRegistered: [], workbench: { realmId: null, founded: false } };
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "json=false"]))).toBe(0);
  expect(text).toMatch(/workbench: none stands for this face/);
});

test("a keep the vessel refuses names its cause and its detail, and the mint still stands", async () => {
  holdOut = { held: false, cause: "keep-full", detail: "the keep budget stands full (3/3); this face keeps b", holds: [], budget };
  expect(await cmdWikiInit(parseArgs(["wiki", "fresh", "json=false"]))).toBe(0);
  expect(sent).toContain("wiki-keep");
  expect(text).toContain("keep-full");
  expect(text).toContain("this face keeps b");
  expect(text).not.toContain("face-0");
});
