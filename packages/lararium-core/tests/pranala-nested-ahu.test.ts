/**
 * Nested ahu ? -> resolution tests.
 *
 * Ahu blocks serve as:
 *   - graph sockets (fromSocket/toSocket in PranaEdge)
 *   - wiki worksites/bookmarks (nested sections in a carrier page)
 *
 * Two socket-resolution modes exist for inline pranala:
 *
 *   1. Bare `?`:   <<~ pranala ? -> TARGET family:F role:R >>
 *      fromSocket = innermost open ahu (the "current worksite").
 *      Falls back to carrier URI if no ahu is open.
 *
 *   2. Explicit socket:  <<~ pranala #name ? -> TARGET family:F role:R >>
 *      fromSocket = carrierUri + "#name" (names this specific edge slot).
 *      The ahu stack is IGNORED — the explicit fragment wins.
 *      This is how real carriers name their pranala sockets (e.g. #hydrate-hud).
 *
 * Sugar forms (loulou/aka/kahea) always use the ahu stack — they have no
 * explicit fragment syntax.
 */

import { describe, test, expect } from "@jest/globals";
import { parsePranalaEdges } from "../src/pranala-parser.js";

const BASE = "lar:///ha.ka.ba/api/v0.1/test";

function edges(body: string) {
  return parsePranalaEdges(BASE, body);
}

// ---------------------------------------------------------------------------
// Mode 1: bare ? — ahu stack resolves fromSocket
// ---------------------------------------------------------------------------

describe("bare ? — ahu stack resolution", () => {
  test("? inside ahu resolves to that ahu socket", () => {
    const result = edges(`
<<~ ahu #core >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
<<~/ahu >>
`);
    expect(result).toHaveLength(1);
    expect(result[0]!.fromSocket).toBe(`${BASE}#core`);
    expect(result[0]!.toUri).toBe("lar:///ha.ka.ba/api/v0.1/mu");
    expect(result[0]!.role).toBe("owns");
  });

  test("? outside all ahu resolves to carrier URI", () => {
    const result = edges(`
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
`);
    expect(result[0]!.fromSocket).toBe(BASE);
  });

  test("? after ahu closes resolves to carrier URI", () => {
    const result = edges(`
<<~ ahu #core >>
<<~/ahu >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
`);
    expect(result[0]!.fromSocket).toBe(BASE);
  });
});

// ---------------------------------------------------------------------------
// Mode 2: explicit #name — overrides ahu stack
// ---------------------------------------------------------------------------

describe("explicit socket #name — overrides ahu stack", () => {
  test("explicit #name inside ahu uses #name, not ahu socket", () => {
    const result = edges(`
<<~ ahu #core-hydration >>
<<~ pranala #hydrate-mu ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
<<~/ahu >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#hydrate-mu`);
  });

  test("explicit #name inside nested ahu ignores both ahu levels", () => {
    const result = edges(`
<<~ ahu #outer >>
<<~ ahu #inner >>
<<~ pranala #my-edge ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
<<~/ahu >>
<<~/ahu >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#my-edge`);
  });

  test("two explicit-named pranala inside the same ahu have distinct sockets", () => {
    const result = edges(`
<<~ ahu #edges >>
<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~/ahu >>
`);
    expect(result).toHaveLength(2);
    const meme = result.find((e) => e.toUri.endsWith("meme"))!;
    const loci = result.find((e) => e.toUri.endsWith("loci"))!;
    expect(meme.fromSocket).toBe(`${BASE}#implements-meme`);
    expect(loci.fromSocket).toBe(`${BASE}#implements-loci`);
  });
});

// ---------------------------------------------------------------------------
// Two-level nesting with bare ?
// ---------------------------------------------------------------------------

describe("two-level nested ahu with bare ?", () => {
  test("? inside inner resolves to inner socket", () => {
    const result = edges(`
<<~ ahu #outer >>
<<~ ahu #inner >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
<<~/ahu >>
<<~/ahu >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#inner`);
  });

  test("? after inner closes resolves to outer socket", () => {
    const result = edges(`
<<~ ahu #outer >>
<<~ ahu #inner >>
<<~/ahu >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
<<~/ahu >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#outer`);
  });

  test("bare ? at each nesting level captures the correct innermost socket", () => {
    const result = edges(`
<<~ ahu #outer >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/lararium family:control role:owns >>
<<~ ahu #inner >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
<<~/ahu >>
<<~/ahu >>
`);
    expect(result).toHaveLength(2);
    const mu  = result.find((e) => e.toUri.includes("mu"))!;
    const lar = result.find((e) => e.toUri.includes("lararium"))!;
    expect(mu.fromSocket).toBe(`${BASE}#inner`);
    expect(lar.fromSocket).toBe(`${BASE}#outer`);
  });
});

// ---------------------------------------------------------------------------
// Three-level nesting
// ---------------------------------------------------------------------------

describe("three-level nested ahu with bare ?", () => {
  test("? at each level captures the correct innermost socket", () => {
    const result = edges(`
<<~ ahu #a >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ ahu #b >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~ ahu #c >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~/ahu >>
<<~/ahu >>
<<~/ahu >>
`);
    expect(result).toHaveLength(3);
    const meme = result.find((e) => e.toUri.endsWith("meme"))!;
    const loci = result.find((e) => e.toUri.endsWith("loci"))!;
    const inv  = result.find((e) => e.toUri.endsWith("invariant"))!;
    expect(meme.fromSocket).toBe(`${BASE}#a`);
    expect(loci.fromSocket).toBe(`${BASE}#b`);
    expect(inv.fromSocket).toBe(`${BASE}#c`);
  });
});

// ---------------------------------------------------------------------------
// Sugar forms always use ahu stack (no explicit socket syntax)
// ---------------------------------------------------------------------------

describe("sugar forms in nested ahu", () => {
  test("loulou inside nested ahu uses innermost socket", () => {
    const result = edges(`
<<~ ahu #outer >>
<<~ ahu #refs >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/mu >>
<<~/ahu >>
<<~/ahu >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#refs`);
    expect(result[0]!.family).toBe("relation");
  });

  test("aka inside single ahu uses that socket", () => {
    const result = edges(`
<<~ ahu #edges >>
<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language >>
<<~/ahu >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#edges`);
    expect(result[0]!.family).toBe("observe");
    expect(result[0]!.toUri).toBe("lar:///ha.ka.ba/api/v0.1/pono/RFC-2119");
    expect(result[0]!.toSocket).toBe("lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language");
  });

  test("kahea outside all ahu uses carrier URI as socket", () => {
    const result = edges(`
<<~ kahea lar:///ha.ka.ba/api/v0.1/lararium >>
`);
    expect(result[0]!.fromSocket).toBe(BASE);
    expect(result[0]!.family).toBe("dataflow");
  });

  test("loulou after inner ahu closes uses outer socket", () => {
    const result = edges(`
<<~ ahu #outer >>
<<~ ahu #inner >>
<<~/ahu >>
<<~ loulou lar:///ha.ka.ba/api/v0.1/mu >>
<<~/ahu >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#outer`);
  });
});

// ---------------------------------------------------------------------------
// Adversarial — unbalanced ahu
// ---------------------------------------------------------------------------

describe("adversarial — unbalanced ahu", () => {
  test("extra close tag does not crash, bare ? resolves to carrier URI", () => {
    expect(() => edges(`
<<~/ahu >>
<<~/ahu >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
`)).not.toThrow();

    const result = edges(`
<<~/ahu >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
`);
    expect(result[0]!.fromSocket).toBe(BASE);
  });

  test("unclosed ahu — bare ? inside still resolves to its socket", () => {
    const result = edges(`
<<~ ahu #dangling >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#dangling`);
  });

  test("multiple reopen of the same socket name stacks correctly", () => {
    // Two pushes of #section. After one pop, still #section.
    const result = edges(`
<<~ ahu #section >>
<<~ ahu #section >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu family:control role:owns >>
<<~/ahu >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/lararium family:control role:owns >>
<<~/ahu >>
`);
    expect(result).toHaveLength(2);
    expect(result[0]!.fromSocket).toBe(`${BASE}#section`);
    expect(result[1]!.fromSocket).toBe(`${BASE}#section`);
  });
});

// ---------------------------------------------------------------------------
// Adversarial — target resolution
// ---------------------------------------------------------------------------

describe("adversarial — target forms in nested ahu", () => {
  test("local fragment target resolves to carrier + fragment", () => {
    const result = edges(`
<<~ ahu #core >>
<<~ pranala ? -> #sibling family:control role:implements >>
<<~/ahu >>
`);
    expect(result[0]!.toUri).toBe(BASE);
    expect(result[0]!.toSocket).toBe(`${BASE}#sibling`);
    // fromSocket still resolves via ahu stack
    expect(result[0]!.fromSocket).toBe(`${BASE}#core`);
  });

  test("absolute lar:/// target with fragment inside nested ahu", () => {
    const result = edges(`
<<~ ahu #outer >>
<<~ ahu #inner >>
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language family:observe >>
<<~/ahu >>
<<~/ahu >>
`);
    expect(result[0]!.fromSocket).toBe(`${BASE}#inner`);
    expect(result[0]!.toUri).toBe("lar:///ha.ka.ba/api/v0.1/pono/RFC-2119");
    expect(result[0]!.toSocket).toBe("lar:///ha.ka.ba/api/v0.1/pono/RFC-2119#normative-language");
  });
});

// ---------------------------------------------------------------------------
// Invariant: real carrier edge structure (lararium.md pattern)
// ---------------------------------------------------------------------------

describe("real carrier — lararium.md pattern", () => {
  const LARARIUM_URI = "lar:///ha.ka.ba/api/v0.1/lararium";
  const LARARIUM_TEXT = `
<<~ ahu #core-hydration >>
<<~ pranala #hydrate-hud ? -> lar:///ha.ka.ba/api/v0.1/lararium/hud family:control role:owns >>
<<~ pranala #hydrate-voices ? -> lar:///ha.ka.ba/api/v0.1/lararium/voices family:control role:owns >>
<<~/ahu >>
<<~ ahu #edges >>
<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~/ahu >>
`;

  test("explicit-named pranala inside #core-hydration have their own sockets", () => {
    const result = parsePranalaEdges(LARARIUM_URI, LARARIUM_TEXT);
    const hud = result.find((e) => e.toUri.endsWith("hud"))!;
    expect(hud.fromSocket).toBe(`${LARARIUM_URI}#hydrate-hud`);
    expect(hud.family).toBe("control");
    expect(hud.role).toBe("owns");
  });

  test("explicit-named pranala inside #edges has its own socket", () => {
    const result = parsePranalaEdges(LARARIUM_URI, LARARIUM_TEXT);
    const meme = result.find((e) => e.toUri.endsWith("meme"))!;
    expect(meme.fromSocket).toBe(`${LARARIUM_URI}#implements-meme`);
    expect(meme.role).toBe("implements");
  });

  test("all edges have non-empty fromSocket", () => {
    const result = parsePranalaEdges(LARARIUM_URI, LARARIUM_TEXT);
    for (const edge of result) {
      expect(edge.fromSocket.length).toBeGreaterThan(0);
    }
  });
});
