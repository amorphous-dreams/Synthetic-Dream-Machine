/**
 * Authority map tests — provider-neutral skeleton.
 */

import { describe, test, expect } from "@jest/globals";
import {
  authProviderEntry,
  createLocalDevReceipt,
  receiptAllows,
  verifyAuthClaim,
  LarAuthSessionRegistry,
  type LarAuthReceipt,
} from "../src/authority.js";

describe("authProviderEntry", () => {
  test("names BlueSky OAuth start route", () => {
    expect(authProviderEntry("bluesky-oauth")).toBe("/auth/bluesky/start");
  });

  test("names GitHub VS Code claim route", () => {
    expect(authProviderEntry("github-vscode")).toBe("/auth/github-vscode/claim");
  });
});

describe("verifyAuthClaim", () => {
  test("accepts an already materialized receipt", async () => {
    const receipt = createLocalDevReceipt("operator");
    const result = await verifyAuthClaim({ provider: "local-dev", receipt });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.receipt.subject).toBe("local-dev:operator");
  });

  test("stubs local-dev as the only implemented path", async () => {
    const result = await verifyAuthClaim({ provider: "local-dev" });
    expect(result.ok).toBe(true);
  });

  test("leaves BlueSky OAuth unimplemented", async () => {
    const result = await verifyAuthClaim({ provider: "bluesky-oauth" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bluesky-oauth:verifier-not-implemented");
  });

  test("leaves GitHub VS Code unimplemented", async () => {
    const result = await verifyAuthClaim({ provider: "github-vscode" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("github-vscode:verifier-not-implemented");
  });
});

describe("receiptAllows", () => {
  test("local-dev wildcard allows room write", () => {
    const receipt = createLocalDevReceipt("operator");
    expect(receiptAllows(receipt, "room:altar-fire", "room/write")).toBe(true);
  });

  test("expired receipt denies access", () => {
    const receipt: LarAuthReceipt = {
      ...createLocalDevReceipt("operator"),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(receiptAllows(receipt, "room:altar-fire", "room/read")).toBe(false);
  });
});

describe("LarAuthSessionRegistry", () => {
  test("registered peer can sync via wildcard local-dev receipt", () => {
    const registry = new LarAuthSessionRegistry();
    registry.registerPeer("peer:abc", createLocalDevReceipt("operator"));
    expect(registry.isAuthorized("peer:abc")).toBe(true);
  });

  test("unknown peer is rejected", () => {
    const registry = new LarAuthSessionRegistry();
    expect(registry.isAuthorized("peer:missing")).toBe(false);
  });

  test("expired peer is evicted", () => {
    const registry = new LarAuthSessionRegistry();
    registry.registerPeer("peer:old", {
      ...createLocalDevReceipt("operator"),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(registry.isAuthorized("peer:old")).toBe(false);
    expect(registry.getPeer("peer:old")).toBeNull();
  });
});
