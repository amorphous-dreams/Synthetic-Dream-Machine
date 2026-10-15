/**
 * socket-claim — unit proofs for the extracted claim primitive (M6).
 *
 * Control: a held name refuses a second claimant (known positive — the whole point of the
 * primitive). Mutation proofs: release frees the name for a fresh claimant; a corpse (server closed
 * without release, so the rendezvous file is orphaned) gets reaped by the next claimant rather than
 * refusing forever; `onConnection` really wires through to the bound server.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/socket-claim-tests
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { claimName, anchoredName, NameHeld } from "../src/socket-claim.js";

const dirs: string[] = [];
function scratchSocketPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "socket-claim-"));
  dirs.push(dir);
  return join(dir, "claim.sock");
}

afterEach(() => {
  for (const d of dirs.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

describe("socket-claim — claimName (M6)", () => {
  test("control: a second claim on a held name refuses by name", async () => {
    const path = scratchSocketPath();
    const first = await claimName(path);
    await expect(claimName(path)).rejects.toBeInstanceOf(NameHeld);
    await first.release();
  });

  test("release frees the name — a fresh claimant binds it right after", async () => {
    const path = scratchSocketPath();
    const first = await claimName(path);
    await first.release();
    const second = await claimName(path);
    expect(second.path).toBe(path);
    await second.release();
  });

  test("a corpse (listener closed without release) gets reaped by the next claimant, never refused forever", async () => {
    const path = scratchSocketPath();
    const first = await claimName(path);
    // Close the server directly, bypassing release() — the rendezvous file is now an orphaned
    // hard link to a dead listener: a corpse, not a live holder. (Skips first.release()'s own
    // dropIfOurs so the name on disk really is the corpse case, not a normal hand-off.)
    await new Promise<void>((resolve) => first.server.close(() => resolve()));
    const second = await claimName(path);
    expect(second.path).toBe(path);
    await second.release();
  });

  test("onConnection wires through to the bound server", async () => {
    const path = scratchSocketPath();
    const claim = await claimName(path, {
      onConnection: (sock) => { sock.end("hello\n"); },
    });
    const got = await new Promise<string>((resolve, reject) => {
      const sock = createConnection(path);
      let buf = "";
      sock.setEncoding("utf8");
      sock.on("data", (c: string) => { buf += c; });
      sock.on("close", () => resolve(buf));
      sock.on("error", reject);
    });
    expect(got).toBe("hello\n");
    await claim.release();
  });

  test("double release is safe (idempotent)", async () => {
    const path = scratchSocketPath();
    const claim = await claimName(path);
    await claim.release();
    await expect(claim.release()).resolves.toBeUndefined();
  });
});

describe("socket-claim — claimName under `await`", () => {
  test("RED: each look at a live holder takes ONE wait from the pace port, and the claim lands once the holder lets go", async () => {
    // No clock: the port hands back a wait this case alone releases, and the holder counts its own callers.
    const path = scratchSocketPath();
    const pollMs = 37, looks = 4;
    let callers = 0;
    let onCaller: () => void = () => undefined;
    const holder = await claimName(path, { onConnection: (sock) => { callers += 1; try { sock.end(); } catch { /* gone */ } onCaller(); } });
    const callersReach = (n: number) => new Promise<void>((res) => { if (callers >= n) res(); else onCaller = () => { if (callers >= n) res(); }; });
    const asks: { pollMs: number; release: () => void }[] = [];
    let onAsk: () => void = () => undefined;
    const pace = (ms: number) => new Promise<void>((release) => { asks.push({ pollMs: ms, release }); onAsk(); });
    const asksReach = (n: number) => new Promise<void>((res) => { if (asks.length >= n) res(); else onAsk = () => { if (asks.length >= n) res(); }; });

    const order: string[] = [];
    const waiting = claimName(path, { await: true, pollMs, pace }).then((claim) => { order.push("claimed"); return claim; });
    for (let look = 1; look <= looks; look++) {
      await asksReach(look);
      // A look reaches the holder four times: the bind's ask and the waiter's ask find it live, one connection
      // watches for its release, and one more ask after the hang-up sees that it still answers. The holder hung
      // up on all four, and the waiter still holds its one wait: a hang-up alone ends no look.
      await callersReach(4 * look);
      expect(asks.length).toBe(look);
      expect(callers).toBe(4 * look);
      expect(order).toEqual(Array.from({ length: look - 1 }, (_, k) => `released-${k + 1}`));
      if (look < looks) { order.push(`released-${look}`); asks[look - 1]!.release(); }
    }
    expect(asks.map((a) => a.pollMs)).toEqual(Array(looks).fill(pollMs));
    // The holder lets go while the last wait still stands; the wait's release then lets the waiter claim.
    await holder.release();
    order.push(`released-${looks}`);
    asks[looks - 1]!.release();
    const claim = await waiting;
    expect(order).toEqual([...Array.from({ length: looks }, (_, k) => `released-${k + 1}`), "claimed"]);
    expect(asks.length).toBe(looks);                 // no wait asked once the name went quiet
    expect(callers).toBe(4 * looks);                 // and the holder heard nothing more
    await expect(claimName(path)).rejects.toBeInstanceOf(NameHeld);   // CONTROL: the waiter holds the name
    await claim.release();
  });

  test("a look whose holder let go before the hang-up ends early, with its wait still unreleased", async () => {
    const path = scratchSocketPath();
    // This holder answers each caller by leaving: the caller's hang-up and the name's release arrive together.
    // (It lets go once the claim's own listener has taken the caller's connection, so the release closes it.)
    let holder!: Awaited<ReturnType<typeof claimName>>;
    let callers = 0;
    let leave!: (released: Promise<void>) => void;
    const left = new Promise<void>((res) => { leave = (released) => { void released.then(res); }; });
    holder = await claimName(path, { onConnection: () => { callers += 1; if (callers === 3) setImmediate(() => leave(holder.release())); } });
    const asks: (() => void)[] = [];
    const claim = await claimName(path, { await: true, pace: () => new Promise<void>((release) => { asks.push(release); }) });
    expect(asks.length).toBe(1);                     // one wait asked, never released: the name stopped answering
    expect(claim.path).toBe(path);
    await left;
    await claim.release();
  });
});

describe("socket-claim — anchoredName", () => {
  test("a claim under a directory past sun_path binds, refuses a second, and releases", async () => {
    const base = mkdtempSync(join(tmpdir(), "socket-claim-"));
    dirs.push(base);
    const deep = join(base, "a".repeat(50), "b".repeat(50));
    expect(join(deep, "x.sock").length).toBeGreaterThan(108);
    const anchor = anchoredName(deep, "x.sock");
    const first = await claimName(anchor.path);
    await expect(claimName(anchor.path)).rejects.toBeInstanceOf(NameHeld);
    await first.release();
    const again = await claimName(anchor.path);
    await again.release();
    anchor.release();
  });
});
