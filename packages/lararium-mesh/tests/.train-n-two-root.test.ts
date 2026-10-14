/**
 * Unregistered train N witness scaffold. The mesh Vitest include excludes dotfiles.
 * Unskip the unsigned-genesis red BEFORE the N signed-inception acceptance commit;
 * unskip the two-root import case WITH that commit and bind its trace to the live
 * two-root, file-courier driver. Do not count an absent trace as a passing witness.
 */
import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { genesisCharterEpoch, verifySealLineage } from "../src/wax-stamp.js";

type RootReading = {
  root: string;
  repo: string;
  sealHome: string;
  signer: string;
  seedAid: string;
  jointAid: string;
  imported: boolean;
  bootedAfterRestart: boolean;
  contractA: boolean;
  contractB: boolean;
};
type TwoRootTrace = {
  courier: "files-only";
  offerFingerprint: string;
  finalCharterFingerprint: string;
  unsignedImportRefusedAt: string[];
  halfSignedImportRefusedAt: string[];
  roots: [RootReading, RootReading];
};

function readTwoRootTrace(): TwoRootTrace {
  const text = process.env.LAR_N_TWO_ROOT_TRACE;
  if (!text) throw new Error("N two-root driver has not supplied LAR_N_TWO_ROOT_TRACE");
  return JSON.parse(text) as TwoRootTrace;
}

describe("train N witness scaffold control", () => {
  test("an empty lineage refuses before either root imports", () => {
    expect(verifySealLineage([])).toBe(false);
  });
});

describe.skip("train N two-root import and boot witness", () => {
  test("COFOUND_REQUIRES_TWO_INCEPTION_SIGNATURES: an unsigned two-seat genesis refuses", async () => {
    const keys = await Promise.all([1, 2].map(async n => hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(n)))));
    const unsigned = genesisCharterEpoch(keys, 2);
    expect(verifySealLineage([unsigned])).toBe(false);
  });

  test("COFOUND_OFFER_IS_NOT_A_CHARTER: each isolated root imports and boots only the final two-signature charter", () => {
    const trace = readTwoRootTrace();
    const [a, b] = trace.roots;
    expect(trace.courier).toBe("files-only");
    expect(trace.offerFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(trace.finalCharterFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(trace.offerFingerprint).not.toBe(trace.finalCharterFingerprint);
    for (const field of ["root", "repo", "sealHome", "signer", "seedAid"] as const) expect(a[field]).not.toBe(b[field]);
    expect(a.jointAid).toMatch(/^nexus-[0-9a-f]{64}$/);
    expect(b.jointAid).toBe(a.jointAid);
    expect(a.jointAid).not.toBe(a.seedAid);
    expect(b.jointAid).not.toBe(b.seedAid);
    expect(trace.unsignedImportRefusedAt.sort()).toEqual([a.root, b.root].sort());
    expect(trace.halfSignedImportRefusedAt.sort()).toEqual([a.root, b.root].sort());
    for (const root of trace.roots) {
      expect(root.imported).toBe(true);
      expect(root.bootedAfterRestart).toBe(true);
      expect(root.contractA).toBe(true);
      expect(root.contractB).toBe(true);
    }
  });
});
