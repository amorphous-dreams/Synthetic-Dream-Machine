/**
 * persona-admit-held — M8 (gp25 iteration 4, D2): the HELD SESSION (`lares persona admit offer` / `grant`
 * with no `--detach`) must never leave a stale offer/grant pending on ANY exit path, and must not hang the
 * process once its own wait has ended. Drives the REAL `lares` binary as a child process under a scratch
 * `LAR_ROOT` (copied per case from a ONE-TIME founded template) — these are process-level behaviors
 * (signals, stdin lifecycle, exit timing) an in-process call cannot exercise.
 *
 * Proven (the four briefed cases hold, PLUS the three holes M8 closes):
 *   · patience end withdraws the offer (pending 1 → 0);
 *   · SIGINT withdraws; SIGTERM withdraws;
 *   · `--detach` stays one-shot (pending 1 after, no hold, no withdrawal);
 *   · a LATE grant after a patience withdrawal refuses — no pending enrollment;
 *   · HOLE 1 (closed): a paste that FAILS to open (garbage) still withdraws the offer and the process still
 *     exits, rather than leaving the offer pending and the process holding stdin;
 *   · HOLE 3 (closed): after ANY paste, the process exits promptly even while the write side of stdin stays
 *     open (the old code hung ~30s+ on a held-open pipe; `finish` now destroys stdin itself).
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, cpSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdVessel } from "../src/commands/vessel.js";
import { grantAdmitFlow, openAdmitFlow } from "@lararium/node";
import { ed25519SignerFromSeed } from "@lararium/mesh";
import * as ed from "@noble/ed25519";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const BIN = join(import.meta.dirname, "..", "bin", "lares.mjs");
const GENESIS_SEED = new Uint8Array(32).fill(7);

let template: string;

function identityDirOf(root: string): string {
  return join(root, "data", "lares", "identity");
}

function pendingCount(root: string): number {
  const p = join(identityDirOf(root), ".persona-enroll-pending.json");
  if (!existsSync(p)) return 0;
  const f = JSON.parse(readFileSync(p, "utf8")) as { order?: string[] };
  return (f.order ?? []).length;
}

async function waitFor(pred: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`waitFor(${label}) timed out after ${timeoutMs}ms`);
}

/** Spawn the real `lares` bin against `root`, args prepended with `persona admit`. */
function spawnAdmit(root: string, args: string[]): ReturnType<typeof spawn> {
  return spawn(process.execPath, [BIN, "persona", "admit", ...args], {
    cwd: join(import.meta.dirname, ".."),
    env: { ...process.env, LAR_ROOT: root, LAR_BAGS: "", LAR_GENESIS: "" },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function collect(child: ReturnType<typeof spawn>): { stdout: () => string; stderr: () => string } {
  let out = "", err = "";
  child.stdout!.on("data", (d) => { out += String(d); });
  child.stderr!.on("data", (d) => { err += String(d); });
  return { stdout: () => out, stderr: () => err };
}

function waitExit(child: ReturnType<typeof spawn>): Promise<number | null> {
  return new Promise((resolve) => child.once("exit", (code) => resolve(code)));
}

/** The carriage line prints under `--json` to STDERR (L12). */
function carriageOf(text: string): string | null {
  const m = /carriage: (#enroll=[A-Za-z0-9_-]+)/.exec(text);
  return m?.[1] ?? null;
}

describe("persona-admit-held — the held session never leaks, and never hangs past its own wait", () => {
  beforeAll(async () => {
    template = mkdtempSync(join(tmpdir(), "lares-admit-held-template-"));
    cpSync(join(REPO_ROOT, "genesis"), join(template, "genesis"), { recursive: true });
    const saved = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = template;
    try {
      const rc = await cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true } });
      if (rc !== 0) throw new Error(`template founding failed (rc=${rc})`);
    } finally {
      if (saved === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = saved;
    }
  }, 30_000);

  afterAll(() => { rmSync(template, { recursive: true, force: true }); });

  const roots: string[] = [];
  function freshRoot(): string {
    const r = mkdtempSync(join(tmpdir(), "lares-admit-held-case-"));
    cpSync(template, r, { recursive: true });
    roots.push(r);
    return r;
  }
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  test("CASE 1 — patience end withdraws the offer (pending 1 → 0), rc 0", async () => {
    const root = freshRoot();
    const child = spawnAdmit(root, ["offer", "--json", "--patience", "300ms"]);
    const io = collect(child);
    const t0 = Date.now();
    const code = await waitExit(child);
    const elapsed = Date.now() - t0;
    expect(code).toBe(0);
    expect(elapsed).toBeLessThan(5_000);
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(pendingCount(root)).toBe(0);
    const payload = JSON.parse(io.stdout().trim().split("\n").find((l) => l.startsWith("{")) ?? "{}") as Record<string, unknown>;
    expect((payload["data"] as Record<string, unknown> | undefined)?.["withdrawn"]).toBe(true);
  }, 15_000);

  test("CASE 2 — SIGINT withdraws the offer (pending 1 → 0), process exits", async () => {
    const root = freshRoot();
    const child = spawnAdmit(root, ["offer", "--json", "--patience", "10m"]);
    const io = collect(child);
    await waitFor(() => carriageOf(io.stderr()) !== null, 10_000, "carriage printed");
    await waitFor(() => pendingCount(root) === 1, 10_000, "offer pending");
    child.kill("SIGINT");
    const code = await waitExit(child);
    expect(code).toBe(0);
    expect(pendingCount(root)).toBe(0);
  }, 15_000);

  test("CASE 3 — SIGTERM withdraws the offer (pending 1 → 0), process exits", async () => {
    const root = freshRoot();
    const child = spawnAdmit(root, ["offer", "--json", "--patience", "10m"]);
    const io = collect(child);
    await waitFor(() => carriageOf(io.stderr()) !== null, 10_000, "carriage printed");
    await waitFor(() => pendingCount(root) === 1, 10_000, "offer pending");
    child.kill("SIGTERM");
    const code = await waitExit(child);
    expect(code).toBe(0);
    expect(pendingCount(root)).toBe(0);
  }, 15_000);

  test("CASE 4 — --detach stays ONE-SHOT: exits immediately, offer stays pending, nothing held", async () => {
    const root = freshRoot();
    const child = spawnAdmit(root, ["offer", "--json", "--detach"]);
    const t0 = Date.now();
    const code = await waitExit(child);
    const elapsed = Date.now() - t0;
    expect(code).toBe(0);
    expect(elapsed).toBeLessThan(5_000);     // never waits out a patience window
    expect(pendingCount(root)).toBe(1);       // nothing withdrew it — it stands pending, by design
  }, 15_000);

  test("CASE 5 — a LATE grant after a patience withdrawal refuses: no pending enrollment", async () => {
    const root = freshRoot();
    const child = spawnAdmit(root, ["offer", "--json", "--patience", "300ms"]);
    const io = collect(child);
    await waitFor(() => carriageOf(io.stderr()) !== null, 10_000, "carriage printed");
    const carriage = carriageOf(io.stderr())!;
    const code = await waitExit(child);
    expect(code).toBe(0);
    expect(pendingCount(root)).toBe(0);   // withdrawn by patience end

    // Mint a grant answering the NOW-WITHDRAWN offer (any persona signer — this proof never reaches the
    // head-check stage; it must refuse at "no pending enrollment" first).
    const personaSeed = new Uint8Array(32).fill(3);
    const personaRef = { prefix: "EpersonaAID_held_test", verifyingKey: await ed.getPublicKeyAsync(personaSeed).then((b) => Buffer.from(b).toString("hex")) };
    const granterDir = mkdtempSync(join(tmpdir(), "lares-admit-held-granter-"));
    try {
      const grant = await grantAdmitFlow({
        offerCarriage: carriage, personaRef, personaSigner: ed25519SignerFromSeed(personaSeed), dir: granterDir,
      });
      if ("error" in grant) throw new Error(`grant mint failed: ${grant.error}`);

      const deviceSigner = ed25519SignerFromSeed(new Uint8Array(32).fill(4));
      const opened = await openAdmitFlow({
        grantCarriage: grant.carriage, resolveHeadOpKey: async () => null, deviceSigner,
        dir: identityDirOf(root),
      });
      expect("error" in opened).toBe(true);
      if ("error" in opened) expect(opened.error).toContain("no pending enrollment");
    } finally {
      rmSync(granterDir, { recursive: true, force: true });
    }
  }, 15_000);

  test("HOLE 1 CLOSED — a paste that FAILS to open still withdraws the offer, and the process still exits", async () => {
    const root = freshRoot();
    const child = spawnAdmit(root, ["offer", "--json", "--patience", "10m"]);
    const io = collect(child);
    await waitFor(() => carriageOf(io.stderr()) !== null, 10_000, "carriage printed");
    await waitFor(() => pendingCount(root) === 1, 10_000, "offer pending");

    // HOLE 3 CLOSED (same case): write garbage and leave the write side OPEN (never call `.end()`) — the
    // exact held-open-pipe shape the old code hung on (~30s+ observed). The fix (`finish` destroys stdin
    // itself) must let the process exit promptly regardless.
    const t0 = Date.now();
    child.stdin!.write("not-a-grant\n");
    const code = await waitExit(child);
    const elapsed = Date.now() - t0;

    expect(code).toBe(2);                          // UsageError -> exitFor("usage")
    expect(elapsed).toBeLessThan(5_000);            // HOLE 3: no multi-second hang on the still-open pipe
    expect(pendingCount(root)).toBe(0);             // HOLE 1: the failed paste still withdrew this offer
  }, 15_000);
});
