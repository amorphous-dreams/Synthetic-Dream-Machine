/**
 * bag-carrier — the two self-describing carriers this shore mints carry a REAL frame.
 *
 * THE BUG THIS GUARDS. `renderBagManifest`/`renderLibraryIndex` once hand-spelled a carrier in a
 * retired layout: no STX, no ETX, no block check, a head with no `from=` and a bare `?`, an EOT with
 * no `to=`. It parsed as prose to anything that read it, and `writeBagManifest`/`library-store`'s
 * index write regressed a migrated corpus file to that shape on every re-declare.
 *
 * So these assert the SHAPE a real reader checks — `@lararium/tw5`'s own `verifyBcc` and
 * `readCarrierShape` — rather than grepping for substrings this module could satisfy by accident.
 * And the bag-manifest renderer is held to BYTE-EXACT equivalence against real `bags/*` manifests,
 * because a frame that merely "has STX somewhere" is not the same claim as "renders what the house
 * already hand-authored".
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readCarrierShape } from "@lararium/tw5";
import { verifyBcc } from "@lararium/memetic-frame";
import { renderBagManifest, renderLibraryIndex } from "../src/bag-carrier.js";
import type { BagManifest } from "@lararium/mesh";
import type { LibraryEntryMeta } from "@lararium/mesh";

// The real repo root, however this test runs — two levels up from `packages/lararium-node/tests`.
const REPO_ROOT = join(__dirname, "..", "..", "..");

describe("renderBagManifest — a real carrier, not a hand-spelled lookalike", () => {
  const m: BagManifest = { bag: "crossroads", tier: "public", home: "repository", repository: "synthetic-dream-machine" };

  test("★ carries a named-end head, STX, ETX+check, and a named-end EOT ★", () => {
    const wire = renderBagManifest(m);
    expect(wire).toContain('from="?" -> to="lar:///ha.ka.ba/bags/crossroads"');
    expect(wire).toContain('<<^ code="&#x0002;">>');                 // STX
    expect(wire).toMatch(/<<\^ code="&#x0003;">>ni:\/\/\/sha-256;/); // ETX, check glued directly on
    expect(wire).toContain('<<^ code="&#x0004;" -> to="?">>');       // EOT, named end
    // the retired shape this bug once emitted
    expect(wire).not.toMatch(/\? ->/);
    expect(wire).not.toContain('-> ?>>');
  });

  test("★ verifies through tw5's OWN reader — no fault, check reads ok ★", () => {
    const wire = renderBagManifest(m);
    expect(verifyBcc(wire)).toBe("ok");
    const shape = readCarrierShape(wire);
    expect(shape.faults).toEqual([]);
    expect(shape.marks.stx).toBe(true);
    expect(shape.marks.etx).toBe(true);
    expect(shape.marks.check).toBe("ok");
  });

  test("★ BYTE-EXACT against a real corpus bag manifest ★", () => {
    for (const bag of ["crossroads", "lares", "sdm"] as const) {
      const wire = renderBagManifest({ bag, tier: "public", home: "repository", repository: "synthetic-dream-machine" });
      const real = readFileSync(join(REPO_ROOT, "bags", bag, "meta.mem"), "utf8");
      expect(wire).toBe(real);
    }
  });

  test("the RETIRED shape this bug once emitted never verifies — the regression this guards", () => {
    const oldBuggy = [
      '<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>',
      "",
      '<<^ code="&#x0001;" namespace="⊙" ? -> lar:///ha.ka.ba/bags/old>>',
      "```toml meta",
      'bag       = "old"',
      'cap-tier  = "public"',
      'home      = "repository"',
      'type      = "text/memetic-wikitext+tiddlywiki"',
      "```",
      "",
      "! old",
      "",
      '<<^ code="&#x0004;" -> ?>>',
      "",
    ].join("\n");
    expect(verifyBcc(oldBuggy)).toBe("unchecked");         // no STX/ETX span to check at all
    expect(readCarrierShape(oldBuggy).faults.length).toBeGreaterThan(0);
  });
});

describe("renderLibraryIndex — the same frame law, for the acquired tier's index", () => {
  const entries: LibraryEntryMeta[] = [
    { cid: "a".repeat(64), name: "book.txt", collection: "shelf", size: 42, mediaType: "text/plain", integrity: "ni:///sha-256;abc" },
  ];

  test("★ carries the real frame and verifies clean ★", () => {
    const wire = renderLibraryIndex("shelf", entries);
    expect(wire).toContain('from="?" -> to="lar:///ha.ka.ba/library/shelf"');
    expect(wire).toContain('<<^ code="&#x0002;">>');
    expect(wire).toMatch(/<<\^ code="&#x0003;">>ni:\/\/\/sha-256;/);
    expect(wire).toContain('<<^ code="&#x0004;" -> to="?">>');
    expect(verifyBcc(wire)).toBe("ok");
    expect(readCarrierShape(wire).faults).toEqual([]);
  });

  test("carries no path — only the name, bytes, and foreign-legible anchor", () => {
    const wire = renderLibraryIndex("shelf", entries);
    expect(wire).toContain("book.txt");
    expect(wire).toContain("ni:///sha-256;abc");
    expect(wire).toContain("library:shelf");
  });
});
