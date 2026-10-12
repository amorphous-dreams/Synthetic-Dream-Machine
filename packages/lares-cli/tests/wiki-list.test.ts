/**
 * wiki-list.test.ts — `lares wiki list` surfaces what the daemon's `list-wikis` answers: each row's
 * `composition` and `defaultDiffers`, so a vessel that composed its system wiki and stopped following
 * a re-baked default reads that from the CLI. `--json` emits the answer verbatim as `data`.
 */
import { afterEach, describe, test, expect, vi } from "vitest";

const ANSWER = {
  wikis: [
    { slug: "lares", uri: "lar:///ha.ka.ba/wikis/lares", automergeUrl: "automerge:abc", kind: "system", composition: "own", defaultDiffers: true },
    { slug: "plain", uri: "lar:///ha.ka.ba/wikis/plain", automergeUrl: null, kind: "system", composition: "default" },
    { slug: "mine",  uri: "lar:///ha.ka.ba/wikis/mine",  automergeUrl: "automerge:def", kind: "user" },
  ],
};
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  runVerb: async () => ({ status: "done", requestId: "r", results: { summary: { ok: true, output: ANSWER } } }),
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdWikiList } from "../src/commands/wiki.js";
import { parseArgs } from "../src/parse-args.js";

afterEach(() => { vi.restoreAllMocks(); });

function capture(): { out: () => string } {
  const chunks: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { chunks.push(a.join(" ")); });
  vi.spyOn(process.stdout, "write").mockImplementation(((s: string | Uint8Array) => { chunks.push(String(s)); return true; }) as typeof process.stdout.write);
  return { out: () => chunks.join("\n") };
}

describe("lares wiki list", () => {
  test("prints each wiki's composition and whether the own stack differs from the default", async () => {
    const c = capture();
    expect(await cmdWikiList(parseArgs(["wiki", "--no-json"]))).toBe(0);
    const text = c.out();
    expect(text).toMatch(/lares[^\n]*composition: own[^\n]*default differs/);
    expect(text).toMatch(/plain[^\n]*composition: default/);
    const mine = text.split("\n").find((l) => l.includes("mine")) ?? "";
    expect(mine).not.toMatch(/composition/);
  });

  test("`--json` emits the daemon's answer verbatim as `data`", async () => {
    const c = capture();
    expect(await cmdWikiList(parseArgs(["wiki", "--json"]))).toBe(0);
    const payload = JSON.parse(c.out().trim()) as { ok: boolean; data: unknown };
    expect(payload.ok).toBe(true);
    expect(payload.data).toEqual(ANSWER);
  });

  test("CONTROL: a row with composition `own` and defaultDiffers false does not read as differing", async () => {
    ANSWER.wikis[0]!.defaultDiffers = false as unknown as true;
    const c = capture();
    await cmdWikiList(parseArgs(["wiki", "--no-json"]));
    expect(c.out()).not.toMatch(/default differs/);
    ANSWER.wikis[0]!.defaultDiffers = true;
  });
});
