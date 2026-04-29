/**
 * PUT /admin/promote — guard composition tests.
 *
 * Verifies the logic that serve.ts uses at the promote endpoint:
 *   canPromoteToCanon() + resolveLarUri() together form the gate.
 *
 * Does not spin up an HTTP server — exercises the policy functions
 * directly so the guard invariants are machine-checked independently
 * of the HTTP layer.
 */

import { describe, test, expect } from "@jest/globals";
import { canPromoteToCanon, resolveLarUri } from "@lararium/core";

// ---------------------------------------------------------------------------
// Guard composition — the same logic serve.ts executes at PUT /admin/promote
// ---------------------------------------------------------------------------

function simulatePromote(opts: {
  originKind: string;
  uri: string;
}): { ok: boolean; reason?: string; laresRelPath?: string | null } {
  const guard = canPromoteToCanon({
    origin:        { kind: opts.originKind },
    authorityMode: "local-operator",
    target:        opts.uri,
  });
  if (!guard.ok) return guard;

  const resolution = resolveLarUri(opts.uri);
  return { ok: true, laresRelPath: resolution.laresRelPath };
}

describe("PUT /admin/promote — guard composition", () => {
  test("operator-import origin passes guard and resolves a caps URI", () => {
    const result = simulatePromote({
      originKind: "operator-import",
      uri: "lar:///AGENTS",
    });
    expect(result.ok).toBe(true);
    expect(result.laresRelPath).toMatch(/AGENTS\.md$/);
  });

  test("operator-import origin passes for a tuple URI", () => {
    const result = simulatePromote({
      originKind: "operator-import",
      uri: "lar:///ha.ka.ba/api/v0.1/mu",
    });
    expect(result.ok).toBe(true);
    expect(result.laresRelPath).toBeTruthy();
  });

  test("projection-cache origin is blocked at the guard", () => {
    const result = simulatePromote({
      originKind: "projection-cache",
      uri: "lar:///AGENTS",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("projection-cache-origin-cannot-promote-canon");
  });

  test("tw-local origin is blocked at the guard", () => {
    const result = simulatePromote({
      originKind: "tw-local",
      uri: "lar:///LARES",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/live-edit-origin/);
  });

  test("crdt-remote origin is blocked at the guard", () => {
    const result = simulatePromote({
      originKind: "crdt-remote",
      uri: "lar:///AGENTS",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/live-edit-origin/);
  });

  test("mcp-draft origin passes guard", () => {
    const result = simulatePromote({
      originKind: "mcp-draft",
      uri: "lar:///AGENTS",
    });
    expect(result.ok).toBe(true);
  });

  test("resolved laresRelPath stays inside lares/ namespace", () => {
    const uris = [
      "lar:///AGENTS",
      "lar:///LARES",
      "lar:///ha.ka.ba/api/v0.1/mu",
    ];
    for (const uri of uris) {
      const result = simulatePromote({ originKind: "operator-import", uri });
      expect(result.ok).toBe(true);
      // laresRelPath must be relative (no leading /) and not escape upward
      expect(result.laresRelPath).not.toMatch(/^\//);
      expect(result.laresRelPath).not.toContain("..");
    }
  });
});
