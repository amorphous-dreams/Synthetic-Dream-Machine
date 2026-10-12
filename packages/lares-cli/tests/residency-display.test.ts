/**
 * `lares bag stats` prints the stowage's OWN idleness. The stowage measures how long a bag sat untouched on
 * its own clock (rolls, or monotonic ms) and answers a duration with the clock's kind; the CLI holds no
 * shared instant with it, so it reads no `lastTouched` and calls no clock.
 */
import { describe, test, expect, vi, afterEach } from "vitest";

const h = vi.hoisted(() => ({ stats: {} as Record<string, unknown> }));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  runVerb: async () => ({ status: "ok" }),
  verbFailure: (err: unknown) => ({ code: "daemon-unreachable", message: String(err) }),
}));
vi.mock("../src/verb-result.js", () => ({ summaryOutput: () => h.stats }));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdResidency } from "../src/commands/residency.js";
import type { ParsedArgs } from "../src/parse-args.js";

const ARGS = { positionals: [], flags: {} } as unknown as ParsedArgs;

async function printed(stats: Record<string, unknown>): Promise<{ code: number; text: string }> {
  h.stats = stats;
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { lines.push(a.join(" ")); });
  const code = await cmdResidency(ARGS);
  return { code, text: lines.join("\n") };
}

afterEach(() => { vi.restoreAllMocks(); });

describe("lares bag stats idleness", () => {
  test("a realm answer prints idle in rolls", async () => {
    const { code, text } = await printed({
      clockKind: "realm", pinned: [], anuCount: 2, hotCap: 8,
      wela: [{ url: "automerge:a", idleFor: 4 }],
    });
    expect(code).toBe(0);
    expect(text).toContain("automerge:a  — idle 4 rolls");
  });

  test("a wall-floor answer prints idle in seconds, then minutes", async () => {
    const { text } = await printed({
      clockKind: "wall-floor", pinned: [], anuCount: 0, hotCap: 8,
      wela: [{ url: "automerge:a", idleFor: 12_000 }, { url: "automerge:b", idleFor: 65_000, syncActive: true }],
    });
    expect(text).toContain("automerge:a  — idle 12s");
    expect(text).toContain("automerge:b  — idle 1m  (syncing)");
  });

  test("an entry with no numeric idleFor prints idle unknown", async () => {
    const { code, text } = await printed({
      clockKind: "realm", pinned: [], anuCount: 0, hotCap: 8,
      wela: [{ url: "automerge:a" }, { url: "automerge:b", idleFor: "soon" }],
    });
    expect(code).toBe(0);
    expect(text.match(/idle unknown/g)).toHaveLength(2);
  });

  test("the command calls no clock", async () => {
    vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("the CLI read a wall clock"); });
    const { code, text } = await printed({
      clockKind: "wall-floor", pinned: [], anuCount: 0, hotCap: 8,
      wela: [{ url: "automerge:a", idleFor: 65_000 }],
    });
    expect(code).toBe(0);
    expect(text).toContain("idle 1m");
  });

  test("control: the pinned, wela count, anu count and hotCap lines read as ever", async () => {
    const { text } = await printed({
      clockKind: "realm", pinned: ["automerge:p"], anuCount: 5, hotCap: 8,
      wela: [{ url: "automerge:a", idleFor: 1 }],
    });
    expect(text).toContain("pinned (1):");
    expect(text).toContain("  automerge:p");
    expect(text).toContain("wela (1/8):");
    expect(text).toContain("anu count: 5");
  });
});
