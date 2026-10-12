/**
 * nexus-seal-reserve-armed — a head armed with the reserve's commit reads so by name, and the one
 * irreversible arming refuses.
 *
 * No verb carries a recovery card into a rotation or seats a reserve-derived key, so a head whose
 * `nextKeyCommit` names the reserve key-set never reveals. Proven over a real persona vault + the charter on
 * disk:
 *   · V1 — a genesis armed with the reserve's commit (what the quorum rite seats) reads `reserveArmed`, and
 *     `seal rotate` refuses it as `reserve-armed` with the re-seat named open, charter bytes untouched;
 *   · V2 — `seal rotate --next-key-commit <the reserve's commit>` on a rotated chain refuses as
 *     `reserve-commit-unrevealable`: a chain past genesis never re-seats, so that arming freezes it;
 *   · V3 — the reserve payload names its one reader, the rehearsal (which rolls nothing);
 *   · CONTROL — a head armed with the standing roster's commit rolls while a reserve stands beside it, and
 *     reads `reserveArmed: false`.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdNexus } from "../src/commands/nexus.js";
import { isReserveArmed } from "../src/commands/nexus-seal.js";
import type { ParsedArgs } from "../src/parse-args.js";
import { larSealHome } from "../src/env.js";
import { generateOrLoadPersonaGroupRoot, makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore, nexusCharterDocPath, readNexusDoc } from "@lararium/node";
import { declarePersonaHandle, renameOwnPersona, sealKeySetHash, standForKahuSeat } from "@lararium/mesh";

const KAHU = ["Kahu Alpha", "Kahu Beta", "Kahu Gamma"];
const args = (positional: string[], options: Record<string, string> = {}): ParsedArgs =>
  ({ command: "nexus", positional, options, flags: { json: true } });

async function run(a: ParsedArgs): Promise<{ code: number; out: Record<string, unknown> }> {
  const lines: string[] = [];
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { lines.push(String(chunk)); return true; });
  try {
    const code = await cmdNexus(a);
    const json = lines.find((line) => line.trim().startsWith("{"));
    return { code, out: json ? JSON.parse(json) as Record<string, unknown> : {} };
  } finally { out.mockRestore(); }
}

describe("seal reserve armed heads", () => {
  let root: string;
  let prior: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-reserve-armed-"));
    prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = root;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    await new Promise((resolve) => setTimeout(resolve, 200));
    rmSync(root, { recursive: true, force: true });
  });

  async function standThree(): Promise<string[]> {
    const petnames = await makeNodePersonaPetnameStore();
    const declarations = await makeNodePersonaDeclarationStore();
    const keys: string[] = [];
    for (let i = 0; i < KAHU.length; i++) {
      const rt = await generateOrLoadPersonaGroupRoot(i);
      await renameOwnPersona(petnames, i, `compartment-${i}`);
      await declarePersonaHandle(declarations, i, KAHU[i]!);
      await standForKahuSeat(declarations, i, true);
      keys.push(rt.verifyingKey);
    }
    return keys;
  }

  async function reserve(): Promise<{ commit: string; data: Record<string, unknown> }> {
    const r = await run(args(["seal", "reserve"]));
    expect(r.code).toBe(0);
    const data = r.out["data"] as Record<string, unknown>;
    return { commit: data["nextKeyCommit"] as string, data };
  }

  test("the pure reading trims and folds commitments and rejects empty heads", () => {
    expect(isReserveArmed("  AbCd ", "abcd")).toBe(true);
    expect(isReserveArmed("", "abcd")).toBe(false);
    expect(isReserveArmed("abcd", " ")).toBe(false);
  });

  test("V1 — blocks a reserve-armed genesis head and leaves charter bytes unchanged", async () => {
    const keys = await standThree();
    const { commit } = await reserve();
    expect((await run(args(["seal", "seat"], { "next-key-commit": commit }))).code).toBe(0);
    const show = await run(args(["seal", "show"]));
    expect((show.out["data"] as Record<string, unknown>)["reserveArmed"]).toBe(true);

    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);
    const rotate = await run(args(["seal", "rotate"], { "next-key-commit": sealKeySetHash(keys, 2) }));
    expect(rotate.code).not.toBe(0);
    expect((rotate.out["error"] as Record<string, unknown>)["code"]).toBe("reserve-armed");
    expect((rotate.out["data"] as Record<string, unknown>)["reseatOpen"]).toBe(true);
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  test("V2 — blocks arming a rotated head with the reserve commit and leaves depth unchanged", async () => {
    const keys = await standThree();
    const rosterCommit = sealKeySetHash(keys, 2);
    expect((await run(args(["seal", "seat"], { "next-key-commit": rosterCommit }))).code).toBe(0);
    expect((await run(args(["seal", "rotate"], { "next-key-commit": rosterCommit }))).code).toBe(0);
    await reserve();
    const refreshed = await run(args(["seal", "reserve", "refresh"]));
    const reserveCommit = (refreshed.out["data"] as Record<string, unknown>)["nextKeyCommit"] as string;
    const path = nexusCharterDocPath(larSealHome());
    const before = readFileSync(path);

    const rotate = await run(args(["seal", "rotate"], { "next-key-commit": reserveCommit }));
    expect(rotate.code).not.toBe(0);
    expect((rotate.out["error"] as Record<string, unknown>)["code"]).toBe("reserve-commit-unrevealable");
    expect(readFileSync(path).equals(before)).toBe(true);
    expect(readNexusDoc(larSealHome())!.sealLineage!.length).toBe(2);
  });

  test("V3 — reserve payload names the rehearsal as its one card reader", async () => {
    const { data } = await reserve();
    expect(data["cards"]).toHaveLength(3);
    expect(data["cardReader"]).toBe("nexus seal reserve rehearse");
  });

  test("CONTROL — a roster-armed head rotates when the reserve commit differs", async () => {
    const keys = await standThree();
    const rosterCommit = sealKeySetHash(keys, 2);
    expect((await run(args(["seal", "seat"], { "next-key-commit": rosterCommit }))).code).toBe(0);
    const { commit: reserveCommit } = await reserve();
    expect(reserveCommit).not.toBe(rosterCommit);
    const rotate = await run(args(["seal", "rotate"], { "next-key-commit": rosterCommit }));
    expect(rotate.code).toBe(0);
    expect((rotate.out["data"] as Record<string, unknown>)["chainDepth"]).toBe(2);
  });

  test("a roster-armed head reads reserveArmed false while a reserve stands beside it", async () => {
    const keys = await standThree();
    expect((await run(args(["seal", "seat"], { "next-key-commit": sealKeySetHash(keys, 2) }))).code).toBe(0);
    await reserve();
    const show = await run(args(["seal", "show"]));
    expect((show.out["data"] as Record<string, unknown>)["reserveArmed"]).toBe(false);
  });
});
