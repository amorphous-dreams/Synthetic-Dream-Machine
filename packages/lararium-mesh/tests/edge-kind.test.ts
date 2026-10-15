/**
 * edge-kind — the KUE-5 invariant: an edge's kind reads from its type, never inferred; the "TE→tunnels"
 * corruption (a directed decaying signal into a symmetric static store) is made structurally impossible.
 */
import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  functionalEdge,
  effectiveEdge,
  transitionEdge,
  assertGeometryInput,
  assertTunnelEdge,
  partitionByKind,
  type Edge,
} from "../src/edge-kind.js";

describe("edge-kind (legible-by-type, fail-loud)", () => {
  test("constructors stamp the kind; functional mints both directions (symmetric)", () => {
    const [ab, ba] = functionalEdge("a", "b", 0.5);
    expect(ab.kind).toBe("fn.sym");
    expect(ba.kind).toBe("fn.sym");
    expect([ab.src, ab.dst]).toEqual(["a", "b"]);
    expect([ba.src, ba.dst]).toEqual(["b", "a"]);
    expect(effectiveEdge("a", "b", 0.3).kind).toBe("eff.dir");
    expect(transitionEdge("a", "b", 0.7).kind).toBe("tr.dir");
  });

  test("geometry accepts fn.sym + tr.dir, REFUSES eff.dir (TE never generates geometry)", () => {
    const ok: Edge[] = [...functionalEdge("a", "b", 1), transitionEdge("b", "c", 1)];
    expect(() => assertGeometryInput(ok)).not.toThrow();
    expect(() => assertGeometryInput([effectiveEdge("a", "b", 1)])).toThrow(/geometry refuses 'eff.dir'/);
  });

  test("the tunnel store holds fn.sym only — a TE→tunnels injection raises at the boundary", () => {
    expect(() => assertTunnelEdge(functionalEdge("a", "b", 1)[0])).not.toThrow();
    expect(() => assertTunnelEdge(effectiveEdge("a", "b", 1))).toThrow(/tunnel store holds fn.sym only/);
    expect(() => assertTunnelEdge(transitionEdge("a", "b", 1))).toThrow(/tunnel store holds fn.sym only/);
  });

  test("partitionByKind separates the three stores; no union across kinds", () => {
    const mixed: Edge[] = [
      ...functionalEdge("a", "b", 1),
      effectiveEdge("a", "c", 1),
      transitionEdge("c", "d", 1),
      transitionEdge("d", "e", 1),
    ];
    const p = partitionByKind(mixed);
    expect(p["fn.sym"].length).toBe(2);
    expect(p["eff.dir"].length).toBe(1);
    expect(p["tr.dir"].length).toBe(2);
  });
});

/**
 * A GUARD CLAIMS ONLY WHAT A CALLER PERFORMS.
 *
 * `assertGeometryInput` and `assertTunnelEdge` hold the right law: geometry accepts `fn.sym` and `tr.dir`
 * and refuses `eff.dir`; the tunnel store holds `fn.sym` alone. Both stand READY and neither stands WIRED —
 * no geometry builder takes an `Edge[]` yet (they take simplex points and matrices), and no tunnel store
 * exists to reject at a boundary.
 *
 * Their comments claimed the enforcement anyway — "the 'TE→tunnels' corruption made structurally
 * impossible", "rejected at the boundary" — and a reader auditing the geometry path would have taken a
 * ready function for a live one and looked no further. The same drift the gate-walk carried, inverted: that
 * one called itself unwired while three doors ran it.
 *
 * THIS WELD SELF-CLEARS. It fails the moment a production caller appears, and the cure is to re-word the
 * comments as enforcement and delete this test — never to widen the exemption.
 */
describe("what the edge-kind guards may claim", () => {
  const SRC = (f: string): string =>
    readFileSync(join(import.meta.dirname, "..", "src", f), "utf8");

  test("★ the guards stand READY and unwired — no production caller invokes either ★", () => {
    const files = readdirSync(join(import.meta.dirname, "..", "src")).filter((f) => f.endsWith(".ts"));
    const callers = files.filter((f) => f !== "edge-kind.ts")
      .filter((f) => /\bassert(GeometryInput|TunnelEdge)\s*\(/.test(SRC(f)));
    expect(
      callers,
      "a caller appeared — WIRE the claim: re-word edge-kind.ts's comments as live enforcement and delete this test",
    ).toEqual([]);
  });

  test("★ so their comments describe a law they HOLD, never one they enforce ★", () => {
    const src = SRC("edge-kind.ts");
    expect(src, "the comment claims an enforcement no caller performs").not.toMatch(/structurally impossible/i);
    expect(src, "the comment claims a boundary rejection no boundary performs").not.toMatch(/rejected at the boundary/i);
  });

  test("CONTROL — the guards still REFUSE what they name, so the law itself stands ready to wire", () => {
    expect(() => assertGeometryInput([effectiveEdge("a", "b", 1)])).toThrow(/geometry refuses 'eff\.dir'/);
    expect(() => assertTunnelEdge(effectiveEdge("a", "b", 1))).toThrow(/tunnel store holds fn\.sym only/);
  });
});
