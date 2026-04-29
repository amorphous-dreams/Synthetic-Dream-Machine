/**
 * P3 guard: projection-cache-origin-cannot-promote-canon
 *
 * Verifies the canPromoteToCanon policy in @lararium/core refuses every
 * projection-cache origin, regardless of authorityMode or target.
 * Also verifies that operator-trusted origins are allowed through.
 */

import { canPromoteToCanon } from "@lararium/core";

describe("canPromoteToCanon — projection-cache guard", () => {
  const receiptHash = "abc123";

  it("blocks projection-cache origin in local-operator mode", () => {
    expect(canPromoteToCanon({
      origin:        { kind: "projection-cache" },
      authorityMode: "local-operator",
      target:        "hostless-invariant-meme",
    })).toEqual({ ok: false, reason: "projection-cache-origin-cannot-promote-canon" });
  });

  it("blocks projection-cache origin in ucan-delegated mode", () => {
    expect(canPromoteToCanon({
      origin:        { kind: "projection-cache" },
      authorityMode: "ucan-delegated",
      target:        "lar:///some/meme",
    })).toEqual({ ok: false, reason: "projection-cache-origin-cannot-promote-canon" });
  });

  it("blocks projection-cache origin in keyhive mode", () => {
    expect(canPromoteToCanon({
      origin:        { kind: "projection-cache" },
      authorityMode: "keyhive",
      target:        "lar:///group/doc",
    })).toEqual({ ok: false, reason: "projection-cache-origin-cannot-promote-canon" });
  });

  it("blocks tw-local origin (live edits require ceremony)", () => {
    expect(canPromoteToCanon({
      origin:        { kind: "tw-local" },
      authorityMode: "local-operator",
      target:        "lar:///some/meme",
    })).toEqual({ ok: false, reason: "live-edit-origin-cannot-promote-canon-without-ceremony" });
  });

  it("blocks crdt-remote origin", () => {
    expect(canPromoteToCanon({
      origin:        { kind: "crdt-remote" },
      authorityMode: "local-operator",
      target:        "lar:///some/meme",
    })).toEqual({ ok: false, reason: "live-edit-origin-cannot-promote-canon-without-ceremony" });
  });

  it("allows canon-hydrate origin", () => {
    expect(canPromoteToCanon({
      origin:        { kind: "canon-hydrate" },
      authorityMode: "local-operator",
      target:        "lar:///lares/invariant",
    })).toEqual({ ok: true });
  });

  it("allows mcp-draft origin (operator-trusted path)", () => {
    expect(canPromoteToCanon({
      origin:        { kind: "mcp-draft" },
      authorityMode: "local-operator",
      target:        "lar:///lares/draft",
    })).toEqual({ ok: true });
  });

  it("allows operator-import origin", () => {
    expect(canPromoteToCanon({
      origin:        { kind: "operator-import" },
      authorityMode: "local-operator",
      target:        "lar:///lares/imported",
    })).toEqual({ ok: true });
  });

  it("rejects unknown origin kind", () => {
    const result = canPromoteToCanon({
      origin:        { kind: "unexpected-future-kind" },
      authorityMode: "local-operator",
      target:        "lar:///some/meme",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown-origin-kind/);
  });
});
