/**
 * canPromoteToCanon policy guard tests.
 *
 * projection-cache origin is removed — content now lives in the Automerge
 * meme store; canvas shapes carry layout only, not carrier text.
 */

import { canPromoteToCanon } from "@lararium/core";

describe("canPromoteToCanon — origin policy", () => {
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

  it("blocks canvas-draft origin — requires PUT /admin/promote ceremony", () => {
    const result = canPromoteToCanon({
      origin:        { kind: "canvas-draft", shapeId: "shape:test-arc-b" },
      authorityMode: "local-operator",
      target:        "lar:///lares/draft-meme",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("canvas-draft-requires-promote-ceremony");
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
