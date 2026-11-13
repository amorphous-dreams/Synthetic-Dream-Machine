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
  /** When set, the wire answers this whole result instead of a `done` carrying `reply`. */
  result: null as unknown,
  throwLWE: false,
  receipt: null as unknown,
  root: "",
}));
vi.mock("../src/verb-call.js", async (orig) => ({
  ...(await orig<typeof import("../src/verb-call.js")>()),
  runVerb: async (verb: string, args: Record<string, unknown>, _by: string, opts: Record<string, unknown> = {}) => {
    h.calls.push({ verb, args });
    if (h.throwLWE) {
      const { LocalWaitExpired } = await import("../src/local-connector.js");
      throw new LocalWaitExpired(verb, 10_000, String(opts["requestId"]));
    }
    if (h.result !== null) return h.result;
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: h.reply } } };
  },
}));
vi.mock("../src/local-connector.js", async (orig) => ({
  ...(await orig<typeof import("../src/local-connector.js")>()),
  queryReceipt: async (requestId: string) => h.receipt ?? { requestId, state: "unknown" },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "0x" + "ab".repeat(32),
  larRoot: () => h.root,
  larBagsDir: () => join(h.root, "bags"),
  larWikisDir: () => join(h.root, "wikis"),
}));

import { cmdAct } from "../src/commands/act.js";
import { refusalHint } from "../src/verb-call.js";
import type { ParsedArgs } from "../src/parse-args.js";

const actArgs = (positional: string[], options: Record<string, string> = {}, flags: Record<string, boolean> = {}): ParsedArgs =>
  ({ command: "act", positional, options, flags: { json: true, yes: true, ...flags } } as unknown as ParsedArgs);

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); h.calls.length = 0; h.result = null; h.throwLWE = false; h.receipt = null; vi.restoreAllMocks(); });

/** A bundle file under a `bags/<holding>/<w.w.w>/…` mirror tree, so the address derivation names it. */
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

describe("lares act REPACK — every refusal carries its hint and the request id", () => {
  const run = async (): Promise<{ code: number; payload: { requestId?: string; error: { code: string; hint?: string } } }> => {
    const { bundle } = bundleUnderBags();
    const out: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out.push(String(chunk)); return true; });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await cmdAct(actArgs(["REPACK"], { source: bundle, from: "lar:///sdm" }));
    vi.restoreAllMocks();
    return { code, payload: JSON.parse(out.join("")) };
  };

  test("★ a synchronous retention-gap refusal carries error.hint and the request id ★", async () => {
    h.result = { status: "error", requestId: "r-live", errorMessage: "evicted", refusal: { reason: "retention-gap" } };
    const { code, payload } = await run();
    expect(code).toBe(6);
    expect(payload.requestId).toBe("r-live");
    expect(payload.error.code).toBe("retention-gap");
    expect(payload.error.hint).toContain("evicted");
  });

  test("★ a lost connection read back `abandoned` carries the shared helper's text ★", async () => {
    h.throwLWE = true;
    h.receipt = { requestId: "r", state: "abandoned" };
    const { code, payload } = await run();
    expect(code).toBe(6);
    expect(payload.error.code).toBe("request-abandoned");
    expect(payload.error.hint).toBe(refusalHint("request-abandoned", undefined));
    expect(payload.requestId).toBeDefined();
  });

  test("a lost connection read back `interrupted` names request-interrupted", async () => {
    h.throwLWE = true;
    h.receipt = { requestId: "r", state: "interrupted" };
    const { code, payload } = await run();
    expect(code).toBe(6);
    expect(payload.error.code).toBe("request-interrupted");
    expect(payload.error.hint).toBe(refusalHint("request-interrupted", undefined));
  });

  test("CONTROL: a refusal with no standing cure still emits no hint", async () => {
    h.result = { status: "error", requestId: "r", errorMessage: "boom" };
    const { payload } = await run();
    expect(payload.error.code).toBe("verb-error");
    expect(payload.error.hint).toBeUndefined();
  });
});
