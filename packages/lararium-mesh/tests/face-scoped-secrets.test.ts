/**
 * face-scoped-secrets — the registry gates only its own face's documents (operator clarification 2026-11-06, red 4;
 * reach-plane#/the-vault-reads-as-a-bag).
 *
 *   F1 — at a locked floor (the face's catalog unread) a public-shelf or genesis document the face does not own still
 *        crosses: the registry's refusal never reaches past its own face's documents
 *   F2 — the face's OWN documents refuse every crossing while the registry cannot read, the public shelf included
 *   F3 — a scope that cannot answer whether the face owns a document refuses that crossing (fail closed)
 *   CONTROL — once the registry reads, a registered plane floors CONTRACT and an unregistered face doc answers false
 */
import { describe, expect, test } from "vitest";
import {
  faceScopedSecrets, makeFaceSecretsRegistry, makeTierFloorSource, tightenShare, SecretsRegistryRefusal,
  type ContractSecretsPlane, type FaceSecretsCatalog,
} from "../src/index.js";

const locked: FaceSecretsCatalog = { face: () => null, sealed: () => false, failure: () => null, flush: async () => {} };
const faceDocs = new Set(["vault", "circle-notes"]);
const owns = (d: string): boolean => faceDocs.has(d);
const ringOver = (plane: ContractSecretsPlane) => ({
  declared: { declaredTierForDoc: () => null },
  floor: makeTierFloorSource({ federatable: () => true, sealed: () => false, secrets: (d) => plane.isContractSecretsPlane(d) }),
});

describe("the registry gates only its own face's documents", () => {
  test("F1 — public shelf and genesis documents cross at a locked floor", () => {
    const scoped = faceScopedSecrets(makeFaceSecretsRegistry(locked).plane, owns);
    expect(scoped.isContractSecretsPlane("genesis-shelf")).toBe(false);
    expect(tightenShare(true, "genesis-shelf", "world", ringOver(scoped))).toBe(true);
  });

  test("F2 — the face's own documents refuse while the registry cannot read", () => {
    const scoped = faceScopedSecrets(makeFaceSecretsRegistry(locked).plane, owns);
    expect(() => scoped.isContractSecretsPlane("vault")).toThrow(SecretsRegistryRefusal);
    for (const audience of ["fleet", "contract", "world"] as const) {
      expect(tightenShare(true, "vault", audience, ringOver(scoped))).toBe(false);
      expect(tightenShare(true, "circle-notes", audience, ringOver(scoped))).toBe(false);
    }
  });

  test("F3 — a scope that cannot answer refuses", () => {
    const scoped = faceScopedSecrets({ isContractSecretsPlane: () => false }, () => { throw new Error("bag registry unread"); });
    expect(() => scoped.isContractSecretsPlane("anything")).toThrow();
    expect(tightenShare(true, "anything", "world", ringOver(scoped))).toBe(false);
  });

  test("CONTROL — a reading registry answers through the scope", () => {
    const scoped = faceScopedSecrets({ isContractSecretsPlane: (d) => d === "vault" }, owns);
    expect(scoped.isContractSecretsPlane("vault")).toBe(true);
    expect(scoped.isContractSecretsPlane("circle-notes")).toBe(false);
    expect(tightenShare(true, "vault", "world", ringOver(scoped))).toBe(false);
    expect(tightenShare(true, "vault", "contract", ringOver(scoped))).toBe(true);
  });
});
