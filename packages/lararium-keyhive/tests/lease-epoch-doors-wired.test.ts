/**
 * THE LEASE-EPOCH FENCE IS WIRED THROUGH ALL THREE DOORS, AND THE SOURCE SAYS SO.
 *
 * Option 1 (operator-approved): device-delegation admission licenses off the PersonaGroup LEASE EPOCH (a
 * clockless monotone counter, `epoch-lease.ts`) instead of the wall-clock alone. `verifyDeviceDelegation`
 * already implemented the fence (`opts.expectedEpoch`); `verifyEdgeAgainstPersonaKel`'s opts type carried
 * only `{now, driftMs}`, so the fence was UNREACHABLE from the three KEL-wrapped callers this house's
 * admission doors actually run: the boot Binding Gate (`boot-daemon-keyhive.ts`), the daemon's live
 * admission path (`operator-daemon-behavior.ts::verifyPeer`), and the face-grant record's own verifier
 * (`face-grant-record.ts`).
 *
 * `gate-walk-wired.test.ts` proves the KEL-head walk itself is wired into these same three doors. This
 * weld proves the SECOND fence — the epoch — rides alongside it: a door that stops threading
 * `expectedEpoch` into its `verifyEdgeAgainstPersonaKel` (or `verifyFaceGrantRecord`) call regresses to
 * wall-clock-only licensing, silently, with no red anywhere else (the behavioral tests in
 * `persona-kel.test.ts` / `face-grant-record.test.ts` / `boot-daemon-keyhive.test.ts` prove the PRIMITIVE
 * enforces the fence when asked; this proves each DOOR still asks).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const KEYHIVE_SRC = (f: string): string => readFileSync(join(import.meta.dirname, "..", "src", f), "utf8");

describe("the lease-epoch fence's wiring", () => {
  test("★ boot-daemon-keyhive.ts threads expectedEpoch into the Binding Gate's KEL-walk call ★", () => {
    const src = KEYHIVE_SRC("boot-daemon-keyhive.ts");
    expect(src).toMatch(/readonly expectedEpoch\?:\s*number/);
    // The forwarding call itself — expectedEpoch reaches verifyEdgeAgainstPersonaKel's opts.
    expect(src).toMatch(/verifyEdgeAgainstPersonaKel\(input\.deviceEdge!,\s*chain,\s*\{[\s\S]{0,200}expectedEpoch/);
  });

  test("★ operator-daemon-behavior.ts threads expectedEpoch into verifyPeer's device-delegation door (:814-ish) ★", () => {
    const src = KEYHIVE_SRC("operator-daemon-behavior.ts");
    // The live admission path reads a fresh lease epoch and forwards it into the SAME KEL-walk primitive.
    expect(src).toMatch(/const expectedEpoch\s*=\s*epochCtx\s*\?\s*await readLeaseEpoch/);
    expect(src).toMatch(/verifyEdgeAgainstPersonaKel\(edge,\s*kel\.chain,\s*\{[\s\S]{0,120}now:\s*Date\.now\(\)[\s\S]{0,200}expectedEpoch/);
  });

  test("★ operator-daemon-behavior.ts ALSO threads it into the boot-time bootDaemonKeyhive call (Binding Gate door) ★", () => {
    const src = KEYHIVE_SRC("operator-daemon-behavior.ts");
    expect(src).toMatch(/bindingGateExpectedEpoch\s*=\s*await readLeaseEpoch/);
    expect(src).toMatch(/bindingGateExpectedEpoch\s*!==\s*null\s*\?\s*\{\s*expectedEpoch:\s*bindingGateExpectedEpoch/);
  });

  test("★ operator-daemon-behavior.ts threads it into the joinee's grant-take (verifyFaceGrantRecord) ★", () => {
    const src = KEYHIVE_SRC("operator-daemon-behavior.ts");
    expect(src).toMatch(/verifyFaceGrantRecord\(rec,\s*\{[\s\S]{0,300}expectedEpoch/);
  });

  test("★ face-grant-record.ts forwards ctx.expectedEpoch into BOTH the KEL-head and pinned-root verify paths ★", () => {
    const src = KEYHIVE_SRC("face-grant-record.ts");
    expect(src).toMatch(/readonly expectedEpoch\?:\s*number/);
    expect(src).toMatch(/freshnessOpts[\s\S]{0,300}expectedEpoch/);
    expect(src).toMatch(/verifyEdgeAgainstPersonaKel\(r\.founderEdge,\s*chain,\s*freshnessOpts\)/);
    expect(src).toMatch(/verifyDeviceDelegation\(r\.founderEdge,\s*ctx\.personaRootDid,\s*freshnessOpts\)/);
  });

  test("CONTROL — the assertions are not vacuous: every symbol they grep for is real", () => {
    expect(KEYHIVE_SRC("boot-daemon-keyhive.ts")).toContain("export async function bootDaemonKeyhive");
    expect(KEYHIVE_SRC("operator-daemon-behavior.ts")).toContain("verifyPeer:");
    expect(KEYHIVE_SRC("face-grant-record.ts")).toContain("export async function verifyFaceGrantRecord");
  });
});
