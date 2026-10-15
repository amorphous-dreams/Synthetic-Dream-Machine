/**
 * local-connector.test.ts — `socketHolderPids` names a wedged holder (M-a).
 *
 * `owned-store.ts` never binds its rendezvous NAME directly: it binds a private STAGING name
 * (`<path>.<pid>.<random>`), then `linkSync`s that staging name onto the rendezvous path, and
 * unlinks the staging name once linked. This test reproduces that EXACT bind-then-link-then-unlink
 * shape over a real UNIX socket in a SEPARATE CHILD PROCESS (never a faked message, and never this
 * test's own PID standing in for a "holder" — `socketHolderPids` excludes its caller's own PID by
 * design, which a same-process listener would silently satisfy for the wrong reason).
 *
 * Proven:
 *   · RED (the retired bug, re-enacted): `lsof -t <rendezvous path>` — the exact path a caller
 *     resolves through — names nothing, because the kernel remembers this listener by its STAGING
 *     bind, never by a hard link created afterward.
 *   · the cure: `socketHolderPids(<rendezvous path>)` still names the CHILD's real pid, by matching
 *     the staging name's PREFIX over every UNIX listener (`ss -xlp`/`lsof -U`).
 *   · CONTROL: a rendezvous path nothing listens at names no pid at all.
 */
import { describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { socketHolderPids } from "../src/local-connector.js";

/** A standalone script that binds a staging name, hard-links it onto `process.argv[2]`, unlinks the
 *  staging name, prints "ready", then sleeps — the EXACT shape `owned-store.ts`'s `bindClaim`
 *  leaves standing, run in its OWN process so its pid is never this test's own. */
const HOLDER_SCRIPT = `
const { createServer } = require("node:net");
const { linkSync, unlinkSync, chmodSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const rendezvousPath = process.argv[2];
const staging = rendezvousPath + "." + process.pid + "." + randomUUID().slice(0, 8);
const server = createServer();
server.listen(staging, () => {
  try { chmodSync(staging, 0o600); } catch {}
  linkSync(staging, rendezvousPath);
  unlinkSync(staging);
  console.log("ready");
});
setInterval(() => {}, 1000); // never exits on its own — the test kills it
`;

async function spawnHolder(rendezvousPath: string, scriptPath: string): Promise<ChildProcess> {
  writeFileSync(scriptPath, HOLDER_SCRIPT, "utf8");
  const child = spawn(process.execPath, [scriptPath, rendezvousPath], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => {
    let out = "";
    child.stdout?.on("data", (c: Buffer) => { out += c.toString(); if (out.includes("ready")) resolve(); });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`holder exited early (${code})`)));
  });
  return child;
}

const haveTool = (bin: string): boolean => {
  try { execFileSync(bin, ["-v"], { stdio: "ignore" }); return true; } catch { return false; }
};

describe("socketHolderPids — names a listener the rendezvous hard link only POINTS AT (M-a)", () => {
  it("MUTATION PROOF of the retired bug: `lsof -t <rendezvous path>` names nothing for a real bind-then-link listener", async () => {
    if (!haveTool("lsof")) return; // environment carries no lsof — the live probe already confirmed this once
    const dir = mkdtempSync(join(tmpdir(), "socket-holder-pids-"));
    const rendezvousPath = join(dir, "rendezvous.sock");
    const holder = await spawnHolder(rendezvousPath, join(dir, "holder.cjs"));
    try {
      let out = "";
      try { out = execFileSync("lsof", ["-t", rendezvousPath], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
      catch { out = ""; }                          // a non-zero exit (nothing found) is lsof's own normal "no match"
      expect(out.trim()).toBe("");                  // the OLD shape this door retired: names NOTHING
    } finally {
      holder.kill("SIGKILL");
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names the REAL listener's pid (a separate process), by matching the staging name's prefix", async () => {
    const dir = mkdtempSync(join(tmpdir(), "socket-holder-pids-"));
    const rendezvousPath = join(dir, "rendezvous.sock");
    const holder = await spawnHolder(rendezvousPath, join(dir, "holder.cjs"));
    try {
      const pids = socketHolderPids(rendezvousPath);
      expect(pids).toContain(holder.pid);
    } finally {
      holder.kill("SIGKILL");
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CONTROL: a rendezvous path nothing listens at names no pid", () => {
    const dir = mkdtempSync(join(tmpdir(), "socket-holder-pids-"));
    mkdirSync(dir, { recursive: true });
    try {
      const pids = socketHolderPids(join(dir, "nothing-here.sock"));
      expect(pids).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
