/**
 * act-load-effect-split.test.ts — D1, P2.5 iter 4 commit 4/4 (LOAD-only), WIDENED by E1 commit 4′
 * (P2.5 iter 5) to EVERY action verb: `lares act`'s split request-id / effect-key, closing H4's
 * livelock live over the REAL rendezvous socket (never a mock of `runVerb`/`invokeLocal` — the
 * same stub-listener discipline `receipt-cmd.test.ts` already uses for this package's wire shape,
 * so the whole path — `taskContentId`, `newRequestId`, the JSON line `local-connector.ts` writes,
 * `verb-call.ts`'s `refusalCode` mapping — runs for real).
 *
 * H4 (episkopos-3, re-proven live, then generalized): a frozen vessel's first LOAD timed out as
 * `outcome-unknown`; the identical re-run then read `verb-error` TWICE, never actually
 * re-attempting the load — the content-addressed requestId this surface minted for EVERY action
 * verb collapsed a genuine retry onto the SAME id the vessel had already recorded abandoned, so no
 * re-run could ever again win a "run" verdict under that id. The SAME livelock shape applies to a
 * deliberately-reused `--change-id`/`--bag` on any OTHER action verb, not just LOAD — operator
 * ruling (early alpha, no legacy/back-compat): EVERY action verb (REPACK included) now splits
 * `requestId` (a fresh nonce per attempt) from `effectKey` (content-addressed, stable across
 * retries) — a retry always gets to try again, while the daemon's own effect index (proven at the
 * tw5/node layers, D1 commits 1-3) still prevents a SECOND land if the first attempt actually
 * completed meanwhile.
 */
import { afterEach, describe, test, expect, vi } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rendezvousPath } from "@lararium/mesh/rendezvous-path";
import { VERB_RESULT_KEY } from "@lararium/mesh";

vi.mock("../src/env.js", async (orig) => ({
  ...(await orig<typeof import("../src/env.js")>()),
  vesselDid: async () => "did:key:ztest-load-split",
}));

import { cmdAct } from "../src/commands/act.js";
import { parseArgs } from "../src/parse-args.js";

let dir: string;
let server: Server | undefined;
const liveSockets = new Set<Socket>();

afterEach(async () => {
  for (const s of liveSockets) { try { s.destroy(); } catch { /* already gone */ } }
  liveSockets.clear();
  if (server) { await new Promise<void>((r) => server!.close(() => r())); server = undefined; }
  if (dir) rmSync(dir, { recursive: true, force: true });
  delete process.env["LAR_ROOT"];
  vi.restoreAllMocks();
});

function standVessel(): string {
  dir = mkdtempSync(join(tmpdir(), "act-load-split-"));
  mkdirSync(dir, { recursive: true });
  process.env["LAR_ROOT"] = dir;
  const dataDir = join(dir, "data", "lares", "vessel");
  return rendezvousPath({ root: dataDir, uid: process.getuid?.() ?? 0 });
}

interface Invocation { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string; effectKey?: string; timeoutMs?: number; }

/** A stub vessel whose answer for each successive dispatch connection is chosen by `answers[n]`. */
async function standScripted(answers: readonly ((inv: Invocation) => unknown)[]): Promise<{ path: string; received: Invocation[] }> {
  const path = standVessel();
  const received: Invocation[] = [];
  let n = 0;
  server = createServer((sock) => {
    liveSockets.add(sock);
    sock.on("close", () => liveSockets.delete(sock));
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("data", (c: string) => {
      buf += c;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      const inv = JSON.parse(buf.slice(0, nl)) as Invocation;
      received.push(inv);
      const reply = answers[Math.min(n, answers.length - 1)]!(inv);
      n++;
      try { sock.end(JSON.stringify(reply) + "\n"); } catch { /* gone */ }
    });
  });
  await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(path, resolve); });
  return { path, received };
}

function loadArgs(extra: Record<string, boolean> = {}): ReturnType<typeof parseArgs> {
  // A nonexistent source path: `cmdAct` catches the stat failure and sends a provenance-only LOAD
  // (no carriers) — exactly the shape this proof needs, with no filesystem fixture to maintain.
  return parseArgs([
    "act", "LOAD",
    "--source-uri", "/nonexistent-lares-test-source",
    "--to", "lar:///test/catalog",
    "--change-id", "fixed-probe-change-id",
    "--yes", "--json",
  ]);
}

function doneReply(landed: number, effectOf?: string): (inv: Invocation) => unknown {
  return (inv) => ({
    status: "done", requestId: inv.requestId,
    results: { [VERB_RESULT_KEY]: { ok: true, output: { landed, ...(effectOf ? { effectOf } : {}) } } },
  });
}
function abandonedReply(): (inv: Invocation) => unknown {
  return (inv) => ({ status: "error", errorMessage: `request ${inv.requestId} abandoned`, refusal: { reason: "abandoned" } });
}

describe("lares act — the split requestId/effectKey, every action verb (H4, widened E1 commit 4′)", () => {
  test("★ every LOAD mints a FRESH requestId per attempt, but the SAME effectKey across identical args ★", async () => {
    const { received } = await standScripted([doneReply(1), doneReply(1)]);
    const codeA = await cmdAct(loadArgs());
    const codeB = await cmdAct(loadArgs());
    expect(codeA).toBe(0);
    expect(codeB).toBe(0);
    expect(received).toHaveLength(2);
    expect(received[0]!.requestId).not.toBe(received[1]!.requestId);
    expect(received[0]!.effectKey).toBeDefined();
    expect(received[0]!.effectKey).toBe(received[1]!.effectKey);
  });

  test("★ H4 CLOSED: an abandoned first attempt, then the identical re-run, RUNS and exits 0 — never livelocked on the same id ★", async () => {
    const { received } = await standScripted([abandonedReply(), doneReply(1)]);
    const codeFirst = await cmdAct(loadArgs());
    expect(codeFirst).toBe(6); // request-abandoned
    const codeRetry = await cmdAct(loadArgs());
    expect(codeRetry).toBe(0); // the retry actually ran — never refused again under the same id
    expect(received).toHaveLength(2);
    expect(received[0]!.requestId).not.toBe(received[1]!.requestId); // a fresh id made the retry possible
    expect(received[0]!.effectKey).toBe(received[1]!.effectKey);    // yet the same effect, named consistently
  });

  test("the FIRST attempt's own abandoned refusal reads `request-abandoned` (exit 6), by its own code, never `verb-error`", async () => {
    const { received } = await standScripted([abandonedReply()]);
    const cap: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { cap.push(String(chunk)); return true; });
    const code = await cmdAct(loadArgs());
    spy.mockRestore();
    expect(code).toBe(6);
    const payload = JSON.parse(cap.join("")) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("request-abandoned");
    expect(received).toHaveLength(1);
  });

  test("★ a `done` re-run answers the prior effect (effect-of), exit 0, and sends the SAME effectKey — no second effect is ASKED FOR ★", async () => {
    const { received } = await standScripted([doneReply(1), doneReply(1, "req-prior")]);
    const codeA = await cmdAct(loadArgs());
    const codeB = await cmdAct(loadArgs());
    expect(codeA).toBe(0);
    expect(codeB).toBe(0);
    expect(received).toHaveLength(2);
    // The CLI's own obligation: carry the SAME effectKey both times, so the daemon's effect index
    // (proven live at the tw5/node layers — D1 commits 1-3, and this lane's own uds-channel
    // forwarding test) has what it needs to answer the second attempt without a second land.
    expect(received[1]!.effectKey).toBe(received[0]!.effectKey);
  });

  test("MUTATION: calling the transport directly WITHOUT an effectKey sends none — the field is genuinely optional on the wire, never fabricated", async () => {
    const { received } = await standScripted([doneReply(1)]);
    const { invokeLocal } = await import("../src/local-connector.js");
    await invokeLocal("LOAD", { "to-bag": "lar:///test/catalog" }, "did:key:ztest-load-split", { requestId: "req-no-effectkey" });
    expect(received).toHaveLength(1);
    expect(received[0]!.effectKey).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(received[0]!, "effectKey")).toBe(false);
  });

  test("★ a non-LOAD verb (CLEAR) ALSO splits requestId from effectKey — the split is EVERY verb's, not LOAD-only ★", async () => {
    const { received } = await standScripted([doneReply(1), doneReply(1)]);
    const codeA = await cmdAct(parseArgs(["act", "CLEAR", "--bag", "lar:///test/catalog", "--yes", "--json"]));
    const codeB = await cmdAct(parseArgs(["act", "CLEAR", "--bag", "lar:///test/catalog", "--yes", "--json"]));
    expect(codeA).toBe(0);
    expect(codeB).toBe(0);
    expect(received).toHaveLength(2);
    expect(received[0]!.requestId).not.toBe(received[1]!.requestId); // a fresh id every attempt
    expect(received[0]!.effectKey).toBeDefined();
    expect(received[0]!.effectKey).toBe(received[1]!.effectKey);     // the SAME content-addressed effect
    expect(received[0]!.requestId).not.toBe(received[0]!.effectKey); // never collapsed to one id
  });

  test("★ a non-LOAD verb's abandoned-then-retry ALSO closes (fresh id per attempt, never wedged under one id) ★", async () => {
    const { received } = await standScripted([abandonedReply(), doneReply(1)]);
    const codeFirst = await cmdAct(parseArgs(["act", "CLEAR", "--bag", "lar:///test/catalog", "--yes", "--json"]));
    expect(codeFirst).toBe(6); // request-abandoned
    const codeRetry = await cmdAct(parseArgs(["act", "CLEAR", "--bag", "lar:///test/catalog", "--yes", "--json"]));
    expect(codeRetry).toBe(0); // the retry actually ran — never refused again under the same id
    expect(received).toHaveLength(2);
    expect(received[0]!.requestId).not.toBe(received[1]!.requestId);
    expect(received[0]!.effectKey).toBe(received[1]!.effectKey);
  });

  test("a live `retention-gap` refusal (the receipt ring evicted this id) reads its own code (exit 6), never `verb-error`", async () => {
    const retentionGapReply = (inv: Invocation) => ({
      status: "error", errorMessage: `request ${inv.requestId} retention-gap`, refusal: { reason: "retention-gap" },
    });
    await standScripted([retentionGapReply]);
    const code = await cmdAct(loadArgs());
    expect(code).toBe(6);
  });

  test("a live `request-id-reused-with-changed-input` refusal reads `request-id-reused` (exit 2)", async () => {
    const reusedReply = (inv: Invocation) => ({
      status: "error", errorMessage: `request ${inv.requestId} reused with changed input`,
      refusal: { reason: "request-id-reused-with-changed-input" },
    });
    await standScripted([reusedReply]);
    const code = await cmdAct(loadArgs());
    expect(code).toBe(2);
  });
});
