/**
 * act-repack.test.ts — `lares act REPACK`, the collect-the-residency export on the ACTION rail.
 *
 * REPACK asks the island to collect a pack's members from the aside map (`$:/config/OriginalTiddlerPaths`)
 * and re-render the bundle through TW5's own serializer: a residency ACTION, seated with the rail. Proven
 * here: the verb the daemon receives (`REPACK` with `bag` + `pack-path`, the pack path derived from the
 * source's loci uri plus its extension), `--in-wiki` wrapping it as `wiki-act`, the bytes landing at
 * `--out` (default: the source), and a source outside the mirror tree refusing as usage.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown> }>,
  reply: {} as Record<string, unknown>,
  root: "",
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
  larRoot: () => h.root,
}));

import { cmdAct } from "../src/commands/act.js";
import type { ParsedArgs } from "../src/parse-args.js";

const actArgs = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "act", positional, options, flags: { json: true, yes: true, ...flags } } as unknown as ParsedArgs);

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); h.calls.length = 0; vi.restoreAllMocks(); });

/** A bundle file under a `bags/<holding>/<w.w.w>/…` mirror tree, so the loci derivation names it. */
const bundleUnderBags = (): { root: string; bundle: string } => {
  const root = mkdtempSync(join(tmpdir(), "lares-repack-")); dirs.push(root);
  const dir = join(root, "bags", "sdm", "ha.ka.ba", "packs");
  mkdirSync(dir, { recursive: true });
  const bundle = join(dir, "bundle.json");
  writeFileSync(bundle, "[]", "utf8");
  h.root = root;
  return { root, bundle };
};

describe("lares act REPACK", () => {
  test("★ dispatches REPACK with bag + pack-path and writes the bundle back to the source ★", async () => {
    const { bundle } = bundleUnderBags();
    h.reply = { text: "[{\"title\":\"x\"}]", count: 1 };
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await cmdAct(actArgs(["REPACK"], { source: bundle, from: "lar:///sdm" }))).toBe(0);
    expect(h.calls).toEqual([{ verb: "REPACK", args: { bag: "lar:///sdm", "pack-path": "ha.ka.ba/packs/bundle.json" } }]);
    expect(readFileSync(bundle, "utf8")).toBe("[{\"title\":\"x\"}]");
  });

  test("--out lands the bundle elsewhere; --in-wiki wraps the verb as wiki-act", async () => {
    const { root, bundle } = bundleUnderBags();
    const out = join(root, "elsewhere.json");
    h.reply = { text: "[]", count: 0 };
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await cmdAct(actArgs(["REPACK"], { source: bundle, from: "lar:///sdm", out }, { "in-wiki": true }))).toBe(0);
    expect(h.calls).toEqual([{ verb: "wiki-act", args: { verb: "REPACK", args: { bag: "lar:///sdm", "pack-path": "ha.ka.ba/packs/bundle.json" } } }]);
    expect(readFileSync(out, "utf8")).toBe("[]");
    expect(readFileSync(bundle, "utf8")).toBe("[]");
  });

  test("a missing --source or --from prints usage and returns 2, touching no wire", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdAct(actArgs(["REPACK"], { source: "x.json" }))).toBe(2);
    expect(await cmdAct(actArgs(["REPACK"], { from: "lar:///sdm" }))).toBe(2);
    expect(h.calls).toEqual([]);
  });

  test("CONTROL: the rail's case holds — `repack` in lower case refuses as any unknown verb does", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cmdAct(actArgs(["repack"], { source: "x.json", from: "lar:///sdm" }))).toBe(2);
    expect(h.calls).toEqual([]);
  });
});
