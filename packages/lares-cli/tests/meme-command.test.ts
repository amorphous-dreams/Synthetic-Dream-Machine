/**
 * meme-command.test.ts — `lares meme put|get`, the CLI skin of the daemon's meme-put / meme-get verbs.
 *
 * The CLI adds nothing to the contract: it names the target (`--recipe <slug>` xor `--bag <slug>`,
 * neither = the anchor), reads the meme text off `--file` or stdin, carries `--base`, and hands the
 * receipt back. Proven here: the argument law (both targets refuse; a bare `lares meme` prints usage and
 * returns 2), the verb args the daemon receives, and the exit classes a receipt maps to (a CONFLICT exits
 * as `conflict`, an absent meme on get as `not-found`).
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  reply: {} as Record<string, unknown>,
}));
vi.mock("../src/verb-call.js", () => ({
  DaemonUnreachable: class extends Error {},
  runVerb: async (verb: string, args: Record<string, unknown>) => {
    h.calls.push({ verb, args });
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
}));

import { cmdMeme, memePlan } from "../src/commands/meme.js";
import type { ParsedArgs } from "../src/parse-args.js";

const memeArgs = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "meme", positional, options, flags: { json: true } } as unknown as ParsedArgs);

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); h.calls.length = 0; });
const tmpFile = (text: string): string => {
  const d = mkdtempSync(join(tmpdir(), "lares-meme-")); dirs.push(d);
  const p = join(d, "x.mem"); writeFileSync(p, text, "utf8"); return p;
};

describe("memePlan — the argument law, no daemon", () => {
  test("bare targets: neither flag names nothing (the daemon reads `recipe: default`)", () => {
    expect(memePlan("get", memeArgs(["get", "lar:///t/x"]))).toEqual({ verb: "meme-get", args: { uri: "lar:///t/x" } });
  });
  test("--recipe and --bag ride through as bare slugs", () => {
    expect(memePlan("get", memeArgs(["get", "lar:///t/x"], { recipe: "sdm" })).args).toEqual({ uri: "lar:///t/x", recipe: "sdm" });
    expect(memePlan("get", memeArgs(["get", "lar:///t/x"], { bag: "sdm" })).args).toEqual({ uri: "lar:///t/x", bag: "sdm" });
  });
  test("★ --recipe AND --bag together refuse ★", () => {
    expect(() => memePlan("get", memeArgs(["get", "lar:///t/x"], { recipe: "sdm", bag: "sdm" }))).toThrow(/one of/);
  });
  test("a missing uri refuses", () => {
    expect(() => memePlan("get", memeArgs(["get"]))).toThrow(/uri/);
  });
  test("put carries --base", () => {
    expect(memePlan("put", memeArgs(["put", "lar:///t/x"], { base: "sha256:abc" })).args).toEqual({ uri: "lar:///t/x", base: "sha256:abc" });
  });
});

describe("lares meme put", () => {
  test("★ reads the meme off --file and dispatches meme-put with uri · text · target · base ★", async () => {
    h.reply = { uri: "lar:///t/x", decision: "ingest", grade: "clean", landed: ["lar:///t/x"], tombstoned: [], canonicalHash: "sha256:1", warnings: [], diagnostics: [] };
    const file = tmpFile("<<^ code=\"&#x0001;\">> hello");
    const code = await cmdMeme(memeArgs(["put", "lar:///t/x"], { file, bag: "sdm", base: "sha256:0" }));
    expect(code).toBe(0);
    expect(h.calls).toEqual([{ verb: "meme-put", args: { uri: "lar:///t/x", text: "<<^ code=\"&#x0001;\">> hello", bag: "sdm", base: "sha256:0" } }]);
  });

  test("a CONFLICT receipt exits as the conflict class", async () => {
    h.reply = { uri: "lar:///t/x", decision: "conflict", grade: "clean", landed: [], tombstoned: [], canonicalHash: "sha256:2", warnings: ["moved"], diagnostics: [] };
    expect(await cmdMeme(memeArgs(["put", "lar:///t/x"], { file: tmpFile("x") }))).toBe(4);
  });

  test("CONTROL: a REFUSE receipt exits as verb-error, not conflict", async () => {
    h.reply = { uri: "lar:///t/x", decision: "refuse", grade: "error", landed: [], tombstoned: [], warnings: ["bad frame"], diagnostics: [] };
    expect(await cmdMeme(memeArgs(["put", "lar:///t/x"], { file: tmpFile("x") }))).toBe(4);
  });
});

describe("lares meme get", () => {
  test("dispatches meme-get and returns 0 on a hit", async () => {
    h.reply = { uri: "lar:///t/x", meme: { text: "T", canonicalHash: "sha256:9" } };
    expect(await cmdMeme(memeArgs(["get", "lar:///t/x"], { recipe: "sdm" }))).toBe(0);
    expect(h.calls).toEqual([{ verb: "meme-get", args: { uri: "lar:///t/x", recipe: "sdm" } }]);
  });
  test("★ an absent meme exits not-found ★", async () => {
    h.reply = { uri: "lar:///t/x", meme: null };
    expect(await cmdMeme(memeArgs(["get", "lar:///t/x"]))).toBe(3);
  });
});

describe("lares meme (bare)", () => {
  test("prints usage and returns 2; an unknown sub-verb the same", async () => {
    expect(await cmdMeme(memeArgs([]))).toBe(2);
    expect(await cmdMeme(memeArgs(["frob"]))).toBe(2);
    expect(h.calls).toEqual([]);
  });
});
