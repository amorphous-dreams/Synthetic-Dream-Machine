/**
 * receipt-cmd.test.ts — M14: `lares receipt <requestId>` and `lares cancel <requestId>`, the two
 * doors every `outcome-unknown` / `request-abandoned` message tells an operator to walk through.
 * Before this, `cancelRequest` had no caller anywhere in the CLI and no door read a request id back.
 *
 * Live against a bare stub listener standing at the SAME rendezvous path `local-connector.ts`
 * resolves (via `LAR_ROOT`) — never a mock of `queryReceipt`/`cancelRequest` themselves, so the whole
 * wire shape (JSON line in, JSON line out) is exercised exactly as a real vessel would answer it.
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import { createServer, type Server } from "node:net";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rendezvousPath } from "@lararium/mesh/rendezvous-path";
import { parseArgs } from "../src/parse-args.js";
import { cmdReceipt, cmdCancel } from "../src/commands/receipt-cmd.js";

let dir: string;
let server: Server | undefined;
const liveSockets = new Set<{ destroy: () => void }>();

afterEach(async () => {
  for (const s of liveSockets) { try { s.destroy(); } catch { /* already gone */ } }
  liveSockets.clear();
  if (server) { await new Promise<void>((r) => server!.close(() => r())); server = undefined; }
  if (dir) rmSync(dir, { recursive: true, force: true });
  delete process.env["LAR_ROOT"];
  vi.restoreAllMocks();
});

function standVessel(): string {
  dir = mkdtempSync(join(tmpdir(), "receipt-cmd-"));
  mkdirSync(dir, { recursive: true });
  process.env["LAR_ROOT"] = dir;
  const dataDir = join(dir, "data", "lares", "vessel");
  return rendezvousPath({ root: dataDir, uid: process.getuid?.() ?? 0 });
}

/** A stub vessel that answers every `{op, requestId}` line with ONE fixed reply. */
async function standStub(answer: unknown): Promise<string> {
  const path = standVessel();
  server = createServer((sock) => {
    liveSockets.add(sock);
    sock.on("close", () => liveSockets.delete(sock));
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("data", (c: string) => {
      buf += c;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      sock.end(JSON.stringify(answer) + "\n");
    });
  });
  await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(path, resolve); });
  return path;
}

function jsonArgs(positional: string[]): ReturnType<typeof parseArgs> {
  return parseArgs(["receipt", ...positional, "--json"]);
}

function captured(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    lines.push(String(chunk));
    return true;
  });
  return { lines, restore: () => spy.mockRestore() };
}

describe("lares receipt <requestId> (M14)", () => {
  test("usage: no requestId given → exit 2, nothing dispatched", async () => {
    const code = await cmdReceipt(jsonArgs([]));
    expect(code).toBe(2);
  });

  test("★ a `done` receipt reads ok:true with its results, exit 0 ★", async () => {
    await standStub({ requestId: "req-1", state: "done", results: { count: 3 } });
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-1"]));
    cap.restore();
    expect(code).toBe(0);
    const payload = JSON.parse(cap.lines.join(""));
    expect(payload).toEqual({ ok: true, requestId: "req-1", data: { state: "done", results: { count: 3 } } });
  });

  test("★ an `abandoned` receipt reads its OWN code — request-abandoned, never outcome-unknown ★", async () => {
    await standStub({ requestId: "req-2", state: "abandoned" });
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-2"]));
    cap.restore();
    const payload = JSON.parse(cap.lines.join("")) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("request-abandoned");
    expect(code).not.toBe(0);
  });

  test("★ an `interrupted` receipt reads its OWN code, request-interrupted, in the exit-6 family ★", async () => {
    await standStub({ requestId: "req-int", state: "interrupted" });
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-int"]));
    cap.restore();
    const payload = JSON.parse(cap.lines.join("")) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("request-interrupted");
    expect(code).toBe(6);
  });

  test("★ an `interrupted` receipt carries a hint beside the code, in the JSON error and on the prose path ★", async () => {
    await standStub({ requestId: "req-int-hint", state: "interrupted" });
    const cap = captured();
    await cmdReceipt(jsonArgs(["req-int-hint"]));
    cap.restore();
    const payload = JSON.parse(cap.lines.join("")) as { error: { code: string; hint?: string } };
    expect(payload.error.hint).toMatch(/change-id/);
    expect(payload.error.hint).toMatch(/may have landed in part/);

    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.join(" ")); });
    await cmdReceipt(parseArgs(["receipt", "req-int-hint", "--no-json"]));
    expect(out.join("\n")).toMatch(/change-id/);
  });

  test("CONTROL: a `done` receipt carries no hint", async () => {
    await standStub({ requestId: "req-done-nohint", state: "done" });
    const cap = captured();
    await cmdReceipt(jsonArgs(["req-done-nohint"]));
    cap.restore();
    expect(JSON.parse(cap.lines.join(""))).not.toHaveProperty("error");
  });

  test("★ an `evicted` receipt (M1 — the receipt ring dropped this id past retention) reads its own code, retention-gap ★", async () => {
    await standStub({ requestId: "req-evicted", state: "evicted" });
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-evicted"]));
    cap.restore();
    const payload = JSON.parse(cap.lines.join("")) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("retention-gap");
    expect((payload.error as { hint?: string }).hint).toMatch(/fresh request/);
    expect(code).not.toBe(0);
    expect(code).toBe(6); // the same exit family as outcome-unknown/request-abandoned
  });

  test("an `unknown` receipt (this vessel never arbitrated it) reads not-found, never a crash", async () => {
    await standStub({ requestId: "req-3", state: "unknown" });
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-3"]));
    cap.restore();
    const payload = JSON.parse(cap.lines.join("")) as { ok: boolean; error: { code: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("not-found");
    expect(code).not.toBe(0);
  });

  test("CONTROL: no vessel at all → daemon-unreachable, with the standing hint", async () => {
    standVessel(); // sets LAR_ROOT, binds NOTHING
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-absent"]));
    cap.restore();
    const payload = JSON.parse(cap.lines.join("")) as { ok: boolean; error: { code: string; hint?: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("daemon-unreachable");
    expect(payload.error.hint).toMatch(/vessel stand --foreground/);
    expect(code).not.toBe(0);
  });
});

describe("lares cancel <requestId> (M14 + M8 — the OPERATOR's own explicit withdrawal)", () => {
  /** Run the cancel door against a stub vessel that answers `answer`; the JSON it printed and its exit code. */
  async function cancelAgainst(answer: Record<string, unknown>): Promise<{ payload: { ok: boolean; data: Record<string, unknown>; error?: { code: string; message: string; hint?: string } }; code: number }> {
    await standStub(answer);
    const cap = captured();
    const code = await cmdCancel(parseArgs(["cancel", String(answer["requestId"]), "--json"]));
    cap.restore();
    return { payload: JSON.parse(cap.lines.join("")), code };
  }

  test("★ a cancel that stands reads withdrawn, ok and exit 0: the vessel holds the id abandoned ★", async () => {
    const { payload, code } = await cancelAgainst({ requestId: "req-9", state: "abandoned" });
    expect(payload).toEqual({ ok: true, requestId: "req-9", data: { state: "abandoned", withdrawn: true } });
    expect(code).toBe(0);
  });

  test("★ a cancel that met a commit reads `cancel-lost` with the state the vessel holds, never as withdrawn ★", async () => {
    const { payload, code } = await cancelAgainst({ requestId: "req-10", state: "committed" });
    expect(payload.ok).toBe(false);
    expect(payload.data).toEqual({ state: "committed", withdrawn: false });
    expect(payload.error?.code).toBe("cancel-lost");
    expect(payload.error?.hint).toMatch(/lares receipt req-10/);
    expect(code).toBe(4);
  });

  test("a cancel that met a landed request reads `cancel-lost` and carries the results the vessel keeps", async () => {
    for (const state of ["done", "error"]) {
      const { payload, code } = await cancelAgainst({ requestId: "req-11", state, results: { count: 3 } });
      expect(payload.data).toEqual({ state, withdrawn: false, results: { count: 3 } });
      expect(payload.error?.code).toBe("cancel-lost");
      expect(code).toBe(4);
    }
  });

  test("a cancel of an id the vessel no longer answers for reads that state's own code, and never as withdrawn", async () => {
    for (const [state, errorCode] of [["evicted", "retention-gap"], ["interrupted", "request-interrupted"]] as const) {
      const { payload, code } = await cancelAgainst({ requestId: "req-12", state });
      expect(payload.data).toEqual({ state, withdrawn: false });
      expect(payload.error?.code).toBe(errorCode);
      expect(code).toBe(6);
    }
  });

  test("a torn fact names its own refusal on both doors, never a verb's error", async () => {
    const torn = { requestId: "req-13", state: "error", errorMessage: "unreadable", refusal: { reason: "receipt-fact-torn" } };
    const cancelled = await cancelAgainst(torn);
    expect(cancelled.payload.error?.code).toBe("receipt-fact-torn");
    expect(cancelled.payload.data["withdrawn"]).toBe(false);
    await new Promise<void>((r) => server!.close(() => r())); server = undefined;
    await standStub(torn);
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-13"]));
    cap.restore();
    expect((JSON.parse(cap.lines.join("")) as { error: { code: string } }).error.code).toBe("receipt-fact-torn");
    expect(code).toBe(6);
  });

  test("a landed error that carries a refusal of its own still reads `cancel-lost` on the cancel door", async () => {
    const { payload, code } = await cancelAgainst({ requestId: "req-15", state: "error", errorMessage: "evicted effect", refusal: { reason: "retention-gap" } });
    expect(payload.error?.code).toBe("cancel-lost");
    expect(code).toBe(4);
  });

  test("★ the vessel's fault line names no state: both doors read a fault, never ok ★", async () => {
    const fault = { requestId: "req-16", status: "error", errorMessage: "a synthetic store fault" };
    const cancelled = await cancelAgainst(fault);
    expect(cancelled.payload).toEqual({ ok: false, requestId: "req-16", error: { code: "verb-error", message: "a synthetic store fault" } });
    expect(cancelled.code).toBe(4);
    await new Promise<void>((r) => server!.close(() => r())); server = undefined;
    await standStub(fault);
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-16"]));
    cap.restore();
    expect((JSON.parse(cap.lines.join("")) as { ok: boolean }).ok).toBe(false);
    expect(code).toBe(4);
  });

  test("CONTROL: the receipt door reads the same `committed` answer as ok, with no `withdrawn` word", async () => {
    await standStub({ requestId: "req-14", state: "committed" });
    const cap = captured();
    const code = await cmdReceipt(jsonArgs(["req-14"]));
    cap.restore();
    expect(JSON.parse(cap.lines.join(""))).toEqual({ ok: true, requestId: "req-14", data: { state: "committed" } });
    expect(code).toBe(0);
  });

  test("usage: no requestId given → exit 2", async () => {
    const code = await cmdCancel(parseArgs(["cancel", "--json"]));
    expect(code).toBe(2);
  });
});
