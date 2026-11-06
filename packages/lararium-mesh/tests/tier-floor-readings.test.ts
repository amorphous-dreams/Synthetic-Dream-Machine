/**
 * tier-floor-readings — every floor names its three readings (reach-plane#/the-vault-reads-as-a-bag; cap-tier#/the-keystone).
 *
 *   R1 — a site that omits `secrets` fails to compile: the witness `SECRETS_READING_REQUIRED` in `src/cap-tier.ts` reads
 *        red at typecheck (`tools/typecheck-witness.sh`) the moment the reading stands optional again; this suite's own
 *        files sit outside the typecheck, so the witness rests in the source
 *   R2 — an untyped caller that omits any one reading refuses at once, by name (`floor-reading-absent`), never reading
 *        a federatable secrets plane PUBLIC
 *   R3 — a secrets reading that cannot answer throws through the fold, ahead of the public reading: the floor never
 *        answers PUBLIC past it
 *   CONTROL — all three readings named: the floor folds as it always did, the secrets reading first
 */
import { describe, expect, test } from "vitest";
import { makeTierFloorSource, structuralFloorFor, NO_CONTRACT_SECRETS_PLANE, SECRETS_READING_REQUIRED, type TierFloorSource } from "../src/index.js";

const no = (): boolean => false;
const yes = (): boolean => true;

describe("every floor names its three readings", () => {
  test("R1 — the compile-time witness stands in the source", () => {
    expect(SECRETS_READING_REQUIRED).toBe(true);
  });

  test("R2 — an untyped caller that omits a reading refuses by name", () => {
    const untyped = makeTierFloorSource as (readings: Record<string, unknown>) => TierFloorSource;
    expect(() => untyped({ federatable: yes, sealed: no })).toThrow(/floor-reading-absent: secrets/);
    expect(() => untyped({ federatable: yes, secrets: no })).toThrow(/floor-reading-absent: sealed/);
    expect(() => untyped({ sealed: no, secrets: no })).toThrow(/floor-reading-absent: federatable/);
    expect(() => untyped({})).toThrow(/floor-reading-absent/);
  });

  test("R3 — a secrets reading that cannot answer throws through the fold, ahead of PUBLIC", () => {
    const unread = makeTierFloorSource({
      federatable: yes,
      sealed: no,
      secrets: () => { throw new Error("secrets-registry-unread: the face's catalog has not bound"); },
    });
    expect(() => structuralFloorFor(unread, "creds")).toThrow(/secrets-registry-unread/);
  });

  test("CONTROL — all three readings named: the floor folds as before, secrets first", () => {
    const floor = makeTierFloorSource({ federatable: (d) => d !== "cleartext", sealed: (d) => d === "sealed", secrets: (d) => d === "creds" });
    expect(structuralFloorFor(floor, "creds")).toBe("contract");
    expect(structuralFloorFor(floor, "pub")).toBe("public");
    expect(structuralFloorFor(floor, "cleartext")).toBe("veil");
    const none = makeTierFloorSource({ federatable: yes, sealed: no, secrets: (d) => NO_CONTRACT_SECRETS_PLANE.isContractSecretsPlane(d) });
    expect(structuralFloorFor(none, "pub")).toBe("public");
  });
});
