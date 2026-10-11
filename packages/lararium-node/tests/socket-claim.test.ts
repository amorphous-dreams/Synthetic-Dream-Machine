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
import { claimName, NameHeld } from "../src/socket-claim.js";

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
