/**
 * THE LEASE-EPOCH FENCE IS WIRED THROUGH ALL DOORS THAT REMAIN, AND THE SOURCE SAYS SO.
 *
 * Option 1 (operator-approved): device-delegation admission licenses off the PersonaGroup LEASE EPOCH (a
 * clockless monotone counter, `epoch-lease.ts`) instead of the wall-clock alone. `verifyDeviceDelegation`
 * already implemented the fence (`opts.expectedEpoch`); `verifyEdgeAgainstPersonaKel`'s opts type carried
 * only `{now, driftMs}`, so the fence was UNREACHABLE from the KEL-wrapped callers this house's
 * admission doors run: the boot Binding Gate (`boot-daemon-keyhive.ts`) and the face-grant record's own verifier
 * (`face-grant-record.ts`). (No in-worker door admits a peer; the sealed gate admits.)
 *
 * `gate-walk-wired.test.ts` proves the KEL-head walk itself is wired into these same three doors. This
 * weld proves the SECOND fence — the epoch — rides alongside it: a door that stops threading
 * `expectedEpoch` into its `verifyEdgeAgainstPersonaKel` (or `verifyFaceGrantRecord`) call regresses to
 * witness-free licensing, silently, with no red anywhere else (the behavioral tests in
 * `persona-kel.test.ts` / `face-grant-record.test.ts` / `boot-daemon-keyhive.test.ts` prove the PRIMITIVE
 * enforces the fence when asked; this proves each DOOR still asks).
 *
 * The face grant's doors left the lease (lease-end, road M6): their welds below pin the founder-standing proof instead.
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
    expect(src).toMatch(/if \(input\.expectedEpoch === undefined\)[\s\S]{0,220}current lease frontier unavailable/);
    // The epoch the gate walks under is the observed one lifted to the sealed anchor's frontier (a stale replica lowers nothing).
    expect(src).toMatch(/leaseEpochUnderAnchor\(input\.faceAnchor!,\s*input\.expectedEpoch\)/);
    expect(src).toMatch(/verifyEdgeAgainstPersonaKel\(input\.deviceEdge!,\s*chain,\s*\{\s*expectedEpoch:\s*anchorEpoch\.epoch\s*\}/);
  });

  test("★ operator-daemon-behavior.ts ALSO threads it into the boot-time bootDaemonKeyhive call (Binding Gate door) ★", () => {
    const src = KEYHIVE_SRC("operator-daemon-behavior.ts");
    expect(src).toMatch(/bindingGateLease\s*=\s*await readLeaseEpoch\(ctx\.composite\)/);
    expect(src).toMatch(/bindingGateLease\.kind\s*===\s*"epoch"\s*\?\s*\{\s*expectedEpoch:\s*bindingGateLease\.n/);
  });

  // RECUT (lease-end, road M6): the grant path no longer asks the lease. The joinee's grant-take and the grant verifier read
  // the FOUNDER's standing (its anchor-pinned persona lineage and its remove-wins dyad) instead; these welds keep each
  // door asking for that proof, and keep the lease out of it, so a door that drops either regresses red here.
  test("★ the joinee's grant-take reads the founder's standing through a required dyad reader and hands it to verifyFaceGrantRecord ★", () => {
    const daemon = KEYHIVE_SRC("operator-daemon-behavior.ts");
    expect(daemon).toMatch(/founderStanding:\s*async\s*\(key\)\s*=>\s*requireDyadReader\(dyadReader\(ctx\),\s*"the grant founder"\)\(edge\.personaRootDid,\s*key\)/);
    expect(daemon).toMatch(/verify:\s*verifyFaceGrantRecord/);
    const seat = KEYHIVE_SRC("face-seat.ts");
    expect(seat).toMatch(/ports\.verify\(record,\s*\{[\s\S]{0,300}dyad:/);
    expect(seat).not.toMatch(/expectedEpoch|readLease/);
  });

  test("★ an unknown founder standing cannot make a face-grant record mutate the joinee ★", () => {
    const src = KEYHIVE_SRC("face-seat.ts");
    const start = src.indexOf("await ports.founderStanding(");
    const end = src.indexOf("ports.verify(record", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const grantTake = src.slice(start, end);
    expect(grantTake).toMatch(/if \(standing === "unknown"\) \{[\s\S]{0,400}face-join grant pending[\s\S]{0,200}founder dyad standing unknown[\s\S]{0,80}continue/);
    expect(src.lastIndexOf("judged.add(record.sig)")).toBeGreaterThan(src.indexOf("await ports.ingest(record)"));
  });

  test("★ face-grant-record.ts carries no lease epoch: the founder's authority reads its pinned lineage and its standing ★", () => {
    const src = KEYHIVE_SRC("face-grant-record.ts");
    expect(src).not.toMatch(/expectedEpoch|freshnessOpts|verifyDeviceDelegation/);
    expect(src).toMatch(/const authority = await verifyFounderAuthority\(r\.founderEdge,\s*ctx\)/);
    expect(src).toMatch(/verifyEdgeAgainstPersonaKel\(founderEdge,\s*chain\)/);
    expect(src).toMatch(/if \(!proof\.dyad\) return \{ ok: false, reason: "founder dyad standing proof unavailable", pending: true \}/);
  });

  test("★ ONE ROAD: every lease read goes through the island's own daemon layer, never the oracle registry ★", () => {
    const src = KEYHIVE_SRC("operator-daemon-behavior.ts");
    expect(src).toMatch(/readLeaseUnderFace\(composite,\s*daemonAuth\.personaGroupId,/);
    expect(src).not.toMatch(/storeOf\(DAEMON_BAG_ID\)/);
    expect(src).toMatch(/resolveDaemonStore = async \(\) => \{\s*const store = daemonLayerOf\(ctx\.composite\)/);
  });

  test("CONTROL — the assertions are not vacuous: every symbol they grep for is real", () => {
    expect(KEYHIVE_SRC("boot-daemon-keyhive.ts")).toContain("export async function bootDaemonKeyhive");
    expect(KEYHIVE_SRC("face-grant-record.ts")).toContain("export async function verifyFaceGrantRecord");
  });
});
