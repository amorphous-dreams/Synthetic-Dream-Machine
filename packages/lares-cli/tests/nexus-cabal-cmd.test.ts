/**
 * nexus-cabal-cmd — `lares nexus cabal` reaches the seat quorum's admission door through the store door, and
 * refuses by name before any act where its words fall short.
 *
 * Proven on a bare tree (no charter, no vessel): each sub-verb reaches `runCabalAct` / `runCabalCosign` /
 * `runCabalStanding` and answers that door's own refusal; a cosign naming no act CID, a group that reads as no
 * PersonaGroup id and an unwritable `--out` each refuse before the store door; an unknown sub-verb refuses with
 * the door's usage. Behaviour over a seated charter belongs to `lararium-node/tests/nexus-cabal.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import type { ParsedArgs } from "../src/parse-args.js";

const GROUP = "cd".repeat(32);
const run = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } } as unknown as ParsedArgs);

describe("lares nexus cabal", () => {
  let root: string;
  let said: string[];
  const saved: Record<string, string | undefined> = {};
  const ENV = ["LAR_ROOT", "LAR_SEAL_HOME", "LAR_DATA_DIR"];
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-nexus-cabal-"));
    for (const k of ENV) { saved[k] = process.env[k]; process.env[k] = root; }
    said = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { said.push(a.join(" ")); });
    vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => { said.push(String(c)); return true; });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]!; }
    rmSync(root, { recursive: true, force: true });
  });
  const answer = async (a: ParsedArgs): Promise<{ code: number; out: string }> => {
    said = [];
    const code = await cmdNexus(a);
    return { code, out: said.join("\n") };
  };

  test("C1 — admit, remove and standing reach the cabal door, which refuses a bare tree on its own ground", async () => {
    for (const sub of ["admit", "remove", "standing"]) {
      const { code, out } = await answer(run(["cabal", sub, GROUP]));
      expect(out, `cabal ${sub}`).toMatch(/no seated charter stands here/);
      expect(code, `cabal ${sub}`).not.toBe(0);
    }
  });

  test("C2 — a cosign reaches the door, which reads the carried file before any charter", async () => {
    const carried = join(root, "partial.json");
    writeFileSync(carried, JSON.stringify({ kind: "not-an-admission" }));
    const { code, out } = await answer(run(["cabal", "cosign", carried], { act: "ef".repeat(32) }));
    expect(out).toMatch(/carries no cabal admission act/);
    expect(code).not.toBe(0);
  });

  test("C3 — a cosign naming no act CID refuses with the usage, before the store door", async () => {
    const carried = join(root, "partial.json");
    writeFileSync(carried, "{}");
    const { code, out } = await answer(run(["cabal", "cosign", carried]));
    expect(out).toMatch(/--act/);
    expect(code).toBe(2);
  });

  test("C4 — a group that reads as no PersonaGroup id refuses by name", async () => {
    const { code, out } = await answer(run(["cabal", "admit", "not-a-group"]));
    expect(out).toMatch(/reads as no PersonaGroup id/);
    expect(code).not.toBe(0);
  });

  test("C5 — an --out the write could not take refuses before any act", async () => {
    const dir = join(root, "a-dir");
    mkdirSync(dir);
    expect((await answer(run(["cabal", "admit", GROUP], { out: dir }))).out).toMatch(/names a directory; name a file/);
    const carried = join(root, "p.json");
    writeFileSync(carried, "{}");
    expect((await answer(run(["cabal", "cosign", carried], { act: "ef".repeat(32), out: carried }))).out).toMatch(/--out names the partial you carried/);
  });

  test("C6 — CONTROL: an unknown sub-verb refuses with the door's usage", async () => {
    const { code, out } = await answer(run(["cabal", "enthrone", GROUP]));
    expect(out).toMatch(/unknown verb .*enthrone/);
    expect(code).toBe(2);
  });
});
