/**
 * A founding runs with no vessel standing.
 *
 * Proven:
 *   · RED: `vessel found --force` beside a vessel standing on the same store exits non-zero, names the refusal,
 *     and leaves every byte of the store, the bootstrap and the identity home as it found them;
 *   · CONTROL: the vessel gone, the same `vessel found --force` runs to completion.
 *
 * The standing vessel here holds the store's rendezvous name exactly as a booted vessel does — the claim the
 * one direct opener (`ownedStore`) and the vessel's own socket share.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claimStore } from "@lararium/node";
import { cmdVessel } from "../src/commands/vessel.js";
import { larDataDir, larIdentityDir } from "../src/env.js";

let root: string;
let priorRoot: string | undefined;
const found = (force = false) =>
  cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true, ...(force ? { force: true } : {}) } });

/** Every file under `dir`, by relative path, to its sha256 — the store as bytes. */
function hashes(dir: string, base = dir): Record<string, string> {
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) Object.assign(out, hashes(p, base));
    else out[p.slice(base.length)] = createHash("sha256").update(readFileSync(p)).digest("hex");
  }
  return out;
}

beforeEach(async () => {
  vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
  root = mkdtempSync(join(tmpdir(), "lares-found-standing-"));
  priorRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  vi.spyOn(console, "log").mockImplementation(() => {});
  cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(root, "genesis"), { recursive: true });
  expect(await found()).toBe(0);
});
afterEach(() => {
  vi.restoreAllMocks();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  rmSync(root, { recursive: true, force: true });
});

describe("vessel found — only with no vessel standing", () => {
  it("RED: beside a standing vessel the founding refuses by name, and no byte of the store moves", async () => {
    const said: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    const storeBefore = hashes(larDataDir());
    const identityBefore = hashes(larIdentityDir());
    expect(Object.keys(storeBefore).length, "the founded store holds no bytes — the comparison would be vacuous").toBeGreaterThan(0);

    const standing = await claimStore(larDataDir());
    try {
      expect(await found(true)).toBe(1);
    } finally { await standing.release(); }

    expect(said.join("\n")).toMatch(/refused: .*already has a holder answering/);
    expect(said.join("\n")).toMatch(/no vessel standing/);
    expect(hashes(larDataDir())).toEqual(storeBefore);
    expect(hashes(larIdentityDir())).toEqual(identityBefore);
  });

  it("CONTROL: with no vessel standing, the same founding runs", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await found(true)).toBe(0);
  });
});
