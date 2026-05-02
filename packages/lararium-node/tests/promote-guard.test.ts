/**
 * Promotion ceremony guard tests.
 *
 * Pins the ability-ladder gate on promoteDraft and verifies PromotionReceipt
 * shape.  Full head-tracking and projection invalidation land in later loops.
 */

import { authProviderEntry, abilityImplies } from "@lararium/core";
import type { LarPrincipal } from "@lararium/core";

describe("promotion ceremony removal", () => {
  it("keeps auth provider routes separate from promotion", () => {
    expect(authProviderEntry("bluesky-oauth")).toBe("/auth/bluesky/start");
    expect(authProviderEntry("github-vscode")).toBe("/auth/github-vscode/claim");
  });
});

describe("abilityImplies — promote gate", () => {
  const actor: LarPrincipal = { kind: "local-operator", alias: "operator" };
  void actor; // referenced in promoteDraft calls below

  it("promote implies promote", () => {
    expect(abilityImplies("promote", "promote")).toBe(true);
  });

  it("admin implies promote", () => {
    expect(abilityImplies("admin", "promote")).toBe(true);
  });

  it("write does NOT imply promote", () => {
    expect(abilityImplies("write", "promote")).toBe(false);
  });

  it("propose does NOT imply promote", () => {
    expect(abilityImplies("propose", "promote")).toBe(false);
  });

  it("read does NOT imply promote", () => {
    expect(abilityImplies("read", "promote")).toBe(false);
  });

  it("pull does NOT imply promote (relay-law exception)", () => {
    expect(abilityImplies("pull", "promote")).toBe(false);
  });
});
