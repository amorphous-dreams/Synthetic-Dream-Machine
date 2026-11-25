/**
 * `--force` over a founded hearth re-seeds its bootstrap and asks no route (a standing custody tree needs none), so the
 * re-seed stays the operator's own act: an AI seat that reaches it, bare or through `vessel rite founding --force`, refuses
 * by name, names the cure, and moves no byte.
 *
 * Proven:
 *   · RED: an AI seat's `vessel found --force` over a founded store refuses `hand-act-only`, and the store, the
 *     bootstrap and the identity home keep every byte;
 *   · RED: the same seat's `vessel rite founding --force` halts at its found step with the same refusal;
 *   · CONTROL: a person's hand runs the same `vessel found --force` to completion.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/reality-tunnel
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeScratch, openScratch, type Scratch } from "../../lararium-node/tests/support/scratch-fixture.js";
import { cmdVessel } from "../src/commands/vessel.js";
import { setFoundingSeat } from "../src/commands/found.js";
import { larDataDir, larIdentityDir } from "../src/env.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let house: Scratch;
const found = (force = false) =>
  cmdVessel({ command: "vessel", positional: ["found"], options: {}, flags: { json: true, ...(force ? { force: true } : {}) } });
const rite = () =>
  cmdVessel({ command: "vessel", positional: ["rite", "founding"], options: {}, flags: { json: true, force: true } });

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
  house = openScratch();
  vi.spyOn(console, "log").mockImplementation(() => {});
  cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(house.root, "genesis"), { recursive: true });
  writeFileSync(join(house.root, ".lar-test-scratch"), "");
  expect(await found()).toBe(0);
});
afterEach(() => {
  setFoundingSeat(() => false);
  vi.restoreAllMocks();
  closeScratch(house);
});

describe("vessel found --force over a founded hearth — the operator's hand alone", () => {
  it("RED: an AI seat refuses hand-act-only by name, names the cure, and no byte moves", async () => {
    const said: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    const store = hashes(larDataDir());
    const identity = hashes(larIdentityDir());
    setFoundingSeat(() => true);
    expect(await found(true)).toBe(1);
    expect(said.join("\n")).toMatch(/refused: hand-act-only/);
    expect(said.join("\n")).toMatch(/lares vessel found --force/);
    expect(said.join("\n")).toMatch(/own terminal/);
    expect(hashes(larDataDir())).toEqual(store);
    expect(hashes(larIdentityDir())).toEqual(identity);
  });

  it("RED: the founding rite carries the same refusal at its found step", async () => {
    const said: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    setFoundingSeat(() => true);
    expect(await rite()).toBe(1);
    expect(said.join("\n")).toMatch(/refused: hand-act-only/);
    expect(said.join("\n")).toMatch(/halted at found/);
  });

  it("CONTROL: a person's hand runs the same re-seed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setFoundingSeat(() => false);
    expect(await found(true)).toBe(0);
  });
});
