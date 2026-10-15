/**
 * act-effect-scope.test.ts — G1 (H7 + M10 + the CLI half of L13), P2.5 iteration 6.
 *
 * H7 closed for CLEAR / DROP / CREATE: these three verbs carry no content of their own that tells
 * one logical CHANGE apart from the next retry of the SAME change (unlike ADD/COPY/MOVE/LOAD, whose
 * wire args already carry `change-id`) — so without a nonce, two genuinely DISTINCT CLEARs of the
 * same bag would content-address to the identical `effectKey`, and the daemon's own effect index
 * (D1, proven at the tw5/node layers) would wrongly answer the second one with the first's outcome
 * instead of running it. `--change-id` (default `newChangeId()`) folds in as that nonce — CLI-side
 * only, never riding the wire args (no mesh change) — so a RE-RUN that reuses the SAME `--change-id`
 * keeps the SAME effectKey (the retry the effect index must dedup), while a FRESH `--change-id`
 * mints a genuinely distinct one (a new change the index must let run).
 *
 * REPACK carries NO effectKey at all (it reads; H7) — proven directly against the real rendezvous
 * line in `act-repack.test.ts` already; this file re-confirms it at the `runVerb` options boundary.
 *
 * M10 closed: the outcome-unknown hint never again tells a caller "re-running is always safe" with
 * no condition — it names the EXACT gesture (`--change-id <id>`) a re-run needs to stay a retry
 * rather than mint a new change.
 *
 * `effectOf` (additive): `act.ts` surfaces `result.effectOf` — once a daemon answer carries it
 * (G2, `uds-channel.ts`'s `readOutcomeFor`/awaited-outcome answer) — into both the JSON `data`
 * and a distinct human line, *before* G2 lands (fed directly here, since `runVerb` is mocked).
 *
 * `receipt-fact-torn` (G2's own refusal name) maps to exit 6 through `refusalCode` — proven here at
 * the live-dispatch (`result.refusal`) boundary, mirroring how the OTHER refusal names are proven in
 * `act-load-effect-split.test.ts`.
 *
 * The LIVE (synchronous) refusal branch carries the SAME hint text as the
 * read-back branches, for the SAME code — both call the one shared `refusalHint` helper in
 * `verb-call.ts`. Before this, a caller whose refusal rode straight back on the socket (the
 * connection never dropped) read no hint at all, while the identical refusal discovered only after
 * a lost connection (`LocalWaitExpired` → a read-back) read a full cure.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ verb: string; args: Record<string, unknown>; requestedBy: string; opts: Record<string, unknown> }>,
  reply: null as unknown,
  throwLWE: false,
  receipt: null as unknown,
  root: "",
}));
vi.mock("../src/verb-call.js", async (orig) => ({
  ...(await orig<typeof import("../src/verb-call.js")>()),
  runVerb: async (verb: string, args: Record<string, unknown>, requestedBy: string, opts: Record<string, unknown> = {}) => {
    h.calls.push({ verb, args, requestedBy, opts });
    if (h.throwLWE) {
      const { LocalWaitExpired } = await import("../src/local-connector.js");
      throw new LocalWaitExpired(verb, 10_000, String(opts["requestId"]));
    }
    if (h.reply !== null) return h.reply;
    return { status: "done", requestId: "r", results: { summary: { ok: true, output: { landed: 1 } } } };
  },
}));
vi.mock("../src/local-connector.js", async (orig) => ({
  ...(await orig<typeof import("../src/local-connector.js")>()),
  queryReceipt: async (requestId: string) => h.receipt ?? { requestId, state: "unknown" },
}));
vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "did:key:ztest-effect-scope",
  larRoot: () => h.root,
  larBagsDir: () => join(h.root, "bags"),
  larWikisDir: () => join(h.root, "wikis"),
}));

import { cmdAct } from "../src/commands/act.js";
import { parseArgs } from "../src/parse-args.js";

const dirs: string[] = [];
afterEach(() => {
  h.calls.length = 0; h.reply = null; h.throwLWE = false; h.receipt = null;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** A bundle file under a `bags/<holding>/<w.w.w>/…` mirror tree, so REPACK's loci derivation names it. */
function bundleUnderBags(): string {
  const root = mkdtempSync(join(tmpdir(), "lares-effect-scope-")); dirs.push(root);
  const dir = join(root, "bags", "sdm", "ha.ka.ba", "packs");
  mkdirSync(dir, { recursive: true });
  const bundle = join(dir, "bundle.json");
  writeFileSync(bundle, "[]", "utf8");
  h.root = root;
  return bundle;
}

function act(...argv: string[]): ReturnType<typeof parseArgs> {
  return parseArgs(["act", ...argv, "--yes", "--json"]);
}

describe("H7/M10 — CLEAR/DROP/CREATE fold --change-id into the effectKey nonce", () => {
  test("★ CLEAR: the SAME --change-id across two attempts keeps the SAME effectKey — the RETRY ★", async () => {
    expect(await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-fixed"))).toBe(0);
    expect(await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-fixed"))).toBe(0);
    expect(h.calls).toHaveLength(2);
    const [a, b] = h.calls;
    expect(a!.opts["effectKey"]).toBeDefined();
    expect(a!.opts["effectKey"]).toBe(b!.opts["effectKey"]);
    expect(a!.opts["requestId"]).not.toBe(b!.opts["requestId"]); // still a fresh dispatch id each time
    // the wire args never carry change-id for a bag verb (no mesh change)
    expect(a!.args).toEqual({ bag: "lar:///test/catalog" });
  });

  test("★ CLEAR: a DIFFERENT --change-id mints a DIFFERENT effectKey, even though the wire args read identical — a GENUINE new change ★", async () => {
    expect(await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-one"))).toBe(0);
    expect(await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-two"))).toBe(0);
    expect(h.calls).toHaveLength(2);
    const [a, b] = h.calls;
    expect(a!.args).toEqual(b!.args); // identical wire args
    expect(a!.opts["effectKey"]).not.toBe(b!.opts["effectKey"]); // yet distinct effects
  });

  test("DROP folds --change-id the same way", async () => {
    expect(await cmdAct(act("DROP", "--bag", "lar:///test/catalog", "--change-id", "cid-fixed"))).toBe(0);
    expect(await cmdAct(act("DROP", "--bag", "lar:///test/catalog", "--change-id", "cid-fixed"))).toBe(0);
    const [a, b] = h.calls;
    expect(a!.opts["effectKey"]).toBe(b!.opts["effectKey"]);
  });

  test("CREATE folds --change-id the same way, --plane included", async () => {
    expect(await cmdAct(act("CREATE", "--bag", "lar:///test/catalog", "--change-id", "cid-fixed"))).toBe(0);
    expect(await cmdAct(act("CREATE", "--bag", "lar:///test/catalog", "--change-id", "cid-fixed"))).toBe(0);
    const [a, b] = h.calls;
    expect(a!.opts["effectKey"]).toBe(b!.opts["effectKey"]);
    expect(await cmdAct(act("CREATE", "--bag", "lar:///test/catalog", "--change-id", "cid-other"))).toBe(0);
    const [, , c] = h.calls;
    expect(c!.opts["effectKey"]).not.toBe(a!.opts["effectKey"]);
  });

  test("CONTROL: with NO --change-id, each attempt mints its OWN default — two flagless CLEARs read as TWO distinct changes", async () => {
    expect(await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog"))).toBe(0);
    expect(await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog"))).toBe(0);
    const [a, b] = h.calls;
    expect(a!.opts["effectKey"]).not.toBe(b!.opts["effectKey"]);
  });
});

describe("H7 — REPACK carries NO effectKey at all", () => {
  test("★ the options passed to runVerb for REPACK hold a requestId and no effectKey property ★", async () => {
    const bundle = bundleUnderBags();
    h.reply = { status: "done", requestId: "r", results: { summary: { ok: true, output: { text: "[]", count: 0 } } } };
    await cmdAct(act("REPACK", "--source", bundle, "--from", "lar:///sdm"));
    expect(h.calls).toHaveLength(1);
    const opts = h.calls[0]!.opts;
    expect(opts["requestId"]).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(opts, "effectKey")).toBe(false);
  });
});

describe("M10 — the outcome-unknown/abandoned/retention-gap hints name the exact --change-id gesture", () => {
  test("an abandoned refusal's hint names THIS attempt's own --change-id, never a bare 'safe to re-run'", async () => {
    // The READ-BACK path (`LocalWaitExpired` → `queryReceipt`).
    h.throwLWE = true;
    h.receipt = { requestId: "r", state: "abandoned" };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-abandon"));
    spy.mockRestore();
    expect(code).toBe(6);
    const payload = JSON.parse(cap.join("")) as { error: { code: string; hint: string } };
    expect(payload.error.code).toBe("request-abandoned");
    expect(payload.error.hint).toContain("cid-abandon");
    expect(payload.error.hint).not.toContain("Re-running is always safe");
  });
});

describe("a read-back that finds the request interrupted names the code and the --change-id cure", () => {
  test("★ an interrupted read-back exits 6 as request-interrupted with the change id in its hint ★", async () => {
    h.throwLWE = true;
    h.receipt = { requestId: "r", state: "interrupted" };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-interrupted"));
    spy.mockRestore();
    expect(code).toBe(6);
    const payload = JSON.parse(cap.join("")) as { error: { code: string; hint: string } };
    expect(payload.error.code).toBe("request-interrupted");
    expect(payload.error.hint).toContain("--change-id cid-interrupted");
  });

  test("a live `interrupted` refusal reads the same code and hint", async () => {
    h.reply = { status: "error", requestId: "r", errorMessage: "stopped", refusal: { reason: "interrupted" } };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-live-int"));
    spy.mockRestore();
    expect(code).toBe(6);
    const payload = JSON.parse(cap.join("")) as { error: { code: string; hint: string } };
    expect(payload.error.code).toBe("request-interrupted");
    expect(payload.error.hint).toContain("cid-live-int");
  });
});

describe("the SYNCHRONOUS (live) refusal carries the SAME hint as the read-back", () => {
  test("★ a live retention-gap refusal carries the hint on both error.hint and the human line ★", async () => {
    // The connection never drops here — the refusal rides straight back as `result.refusal`,
    // never through `LocalWaitExpired`/`queryReceipt`. Mirrors probe-h7b.sh's live E2.
    h.reply = { status: "error", requestId: "r", errorMessage: "evicted", refusal: { reason: "retention-gap" } };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-evicted"));
    spy.mockRestore();
    expect(code).toBe(6);
    const payload = JSON.parse(cap.join("")) as { error: { code: string; hint: string } };
    expect(payload.error.code).toBe("retention-gap");
    expect(payload.error.hint).toContain("evicted");
    expect(payload.error.hint).toContain("--change-id");
  });

  test("a live request-abandoned refusal's hint names THIS attempt's own --change-id", async () => {
    h.reply = { status: "error", requestId: "r", errorMessage: "refused", refusal: { reason: "abandoned" } };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-live-abandon"));
    spy.mockRestore();
    expect(code).toBe(6);
    const payload = JSON.parse(cap.join("")) as { error: { code: string; hint: string } };
    expect(payload.error.code).toBe("request-abandoned");
    expect(payload.error.hint).toContain("cid-live-abandon");
  });

  test("a live receipt-fact-torn refusal carries its own hint (never a bare code with no cure)", async () => {
    h.reply = { status: "error", requestId: "r", errorMessage: "torn", refusal: { reason: "receipt-fact-torn" } };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog"));
    spy.mockRestore();
    expect(code).toBe(6);
    const payload = JSON.parse(cap.join("")) as { error: { code: string; hint: string } };
    expect(payload.error.code).toBe("receipt-fact-torn");
    expect(payload.error.hint).toContain("fresh request");
  });

  test("a live bag-retired refusal reads its own code, exit 2 and the CREATE cure", async () => {
    h.reply = { status: "error", requestId: "r", errorMessage: "bag-retired: CLEAR of x refused", refusal: { reason: "bag-retired" } };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog"));
    spy.mockRestore();
    expect(code).toBe(2);
    const payload = JSON.parse(cap.join("")) as { error: { code: string; hint: string } };
    expect(payload.error.code).toBe("bag-retired");
    expect(payload.error.hint).toContain("lares act CREATE --bag");
  });

  test("MUTATION: a verb-error refusal carries no hint field — the shared helper never invents one", async () => {
    h.reply = { status: "error", requestId: "r", errorMessage: "boom" };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog"));
    spy.mockRestore();
    expect(code).toBe(4);
    const payload = JSON.parse(cap.join("")) as { error: { code: string; hint?: string } };
    expect(payload.error.code).toBe("verb-error");
    expect(Object.prototype.hasOwnProperty.call(payload.error, "hint")).toBe(false);
  });
});

describe("`effectOf` surfaces (fed directly — a stand-in for G2's wire field, proven end to end there)", () => {
  test("★ a `done` result carrying `effectOf` prints the already-landed line and rides data.effectOf ★", async () => {
    h.reply = { status: "done", requestId: "r-retry", results: { summary: { ok: true, output: { landed: 1 } } }, effectOf: "r-prior" };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog", "--change-id", "cid-fixed"));
    spy.mockRestore();
    expect(code).toBe(0);
    const payload = JSON.parse(cap.join("")) as { ok: boolean; data: { effectOf?: string; verb: string } };
    expect(payload.ok).toBe(true);
    expect(payload.data.effectOf).toBe("r-prior");
  });

  test("a `done` result with NO `effectOf` carries none in data — never fabricated", async () => {
    h.reply = { status: "done", requestId: "r", results: { summary: { ok: true, output: { landed: 1 } } } };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog"));
    spy.mockRestore();
    const payload = JSON.parse(cap.join("")) as { data: { effectOf?: string } };
    expect(Object.prototype.hasOwnProperty.call(payload.data, "effectOf")).toBe(false);
  });
});

describe("`receipt-fact-torn` (G2's refusal name) maps to exit 6, never verb-error", () => {
  test("★ a live refusal naming receipt-fact-torn reads its own code ★", async () => {
    h.reply = { status: "error", requestId: "r", errorMessage: "torn", refusal: { reason: "receipt-fact-torn" } };
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog"));
    spy.mockRestore();
    expect(code).toBe(6);
    const payload = JSON.parse(cap.join("")) as { error: { code: string } };
    expect(payload.error.code).toBe("receipt-fact-torn");
  });

  test("MUTATION: an unrecognized refusal reason still falls to verb-error (exit 4) — the default never silently widens", async () => {
    h.reply = { status: "error", requestId: "r", errorMessage: "???", refusal: { reason: "some-future-reason" } };
    const code = await cmdAct(act("CLEAR", "--bag", "lar:///test/catalog"));
    expect(code).toBe(4);
  });
});
