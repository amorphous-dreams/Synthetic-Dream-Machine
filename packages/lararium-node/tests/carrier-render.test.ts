/**
 * carrier-render — the two carriers this shore mints route through tw5's OWN canonical render, and
 * carry a REAL frame.
 *
 * THE BUG THIS GUARDS. `bag-carrier.ts`'s retired `renderBagManifest`/`renderLibraryIndex` once
 * hand-spelled a carrier in a layout with no STX, no ETX, no block check, a head with no `from=` and
 * a bare `?`, an EOT with no `to=`. It parsed as prose to anything that read it, and
 * `writeBagManifest`/`library-store`'s index write regressed a migrated corpus file to that shape on
 * every re-declare. Then the hand-rolled replacement decided the canonical BODY shape itself (key
 * padding, blank-line placement) — a second implementation of the render tw5's own parser∘render
 * pipeline already owns.
 *
 * So these assert both: the SHAPE a real reader checks (`@lararium/tw5`'s own `verifyBcc` and
 * `readCarrierShape`, never a grepped substring this module could satisfy by accident), AND that the
 * bytes landing on disk are tw5's canonical render — `render(parse(draftText)) === draftText` for
 * every corpus `meta.mem`, the control this whole design rests on.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readCarrierShape } from "@lararium/tw5";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { findTopLevelAhuBlocks } from "@lararium/tw5/meme-ast";
import { verifyBcc } from "@lararium/memetic-frame";
import { bagManifestUri, type LibraryEntryMeta } from "@lararium/mesh";
import { writeBagManifest, readBagManifest } from "../src/bag-declare.js";
import { kv, renderCarrier, metaFieldsFromBody } from "../src/carrier-render.js";

// The real repo root, however this test runs — three levels up from `packages/lararium-node/tests`.
const REPO_ROOT = join(__dirname, "..", "..", "..");

// Every bag currently standing under `bags/` — derived, never hand-listed, so a new bag the corpus
// grows joins this control on its own.
const ALL_BAGS = readdirSync(join(REPO_ROOT, "bags"))
  .filter((name) => statSync(join(REPO_ROOT, "bags", name)).isDirectory())
  .filter((name) => statSync(join(REPO_ROOT, "bags", name, "meta.mem")).isFile());

describe("CONTROL — render(deserialize(file)) === file, for every bags/*/meta.mem", () => {
  test("★ tw5's own canonicalizeCarrierText reproduces every corpus manifest byte-for-byte ★", () => {
    expect(ALL_BAGS.length).toBeGreaterThan(0);   // a silent zero here proves nothing
    for (const bag of ALL_BAGS) {
      const path = join(REPO_ROOT, "bags", bag, "meta.mem");
      const real = readFileSync(path, "utf8");
      const uri = bagManifestUri(bag);
      const canonical = canonicalizeCarrierText(uri, real);
      expect(canonical, `${bag}/meta.mem did not round-trip`).toBe(real);
    }
  });
});

describe("writeBagManifest/readBagManifest — through carrier-render, not a bespoke renderer", () => {
  let root: string;
  const makeRoot = (): string => {
    const r = mkdtempSync(join(tmpdir(), "lares-carrier-render-"));
    mkdirSync(join(r, "bag"), { recursive: true });
    return r;
  };

  for (const bag of ["crossroads", "lares", "sdm"] as const) {
    test(`★ BYTE-EXACT against the real corpus manifest — ${bag} ★`, () => {
      root = makeRoot();
      try {
        writeBagManifest(join(root, "bag"), { bag, tier: "public", home: "repository", repository: "synthetic-dream-machine" });
        const wire = readFileSync(join(root, "bag", "meta.mem"), "utf8");
        const real = readFileSync(join(REPO_ROOT, "bags", bag, "meta.mem"), "utf8");
        expect(wire).toBe(real);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  test("★ carries a named-end head, STX, ETX+check, and a named-end EOT, and verifies clean ★", () => {
    root = makeRoot();
    try {
      writeBagManifest(join(root, "bag"), { bag: "crossroads", tier: "public", home: "repository", repository: "synthetic-dream-machine" });
      const wire = readFileSync(join(root, "bag", "meta.mem"), "utf8");
      expect(wire).toContain('from="?" -> to="lar:///ha.ka.ba/bags/crossroads"');
      expect(wire).toContain('<<^ code="&#x0002;">>');
      expect(wire).toMatch(/<<\^ code="&#x0003;">>ni:\/\/\/sha-256;/);
      expect(wire).toContain('<<^ code="&#x0004;" -> to="?">>');
      expect(verifyBcc(wire)).toBe("ok");
      const shape = readCarrierShape(wire);
      expect(shape.faults).toEqual([]);
      expect(shape.marks.stx).toBe(true);
      expect(shape.marks.etx).toBe(true);
      expect(shape.marks.check).toBe("ok");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a round-trip through the deserializer's own TOML reader recovers every written field", () => {
    root = makeRoot();
    try {
      writeBagManifest(join(root, "bag"), { bag: "lares", tier: "contract", home: "repository", repository: "canon", role: "a test role" });
      const wire = readFileSync(join(root, "bag", "meta.mem"), "utf8");
      const back = readBagManifest(join(root, "bag"), "lares");
      expect(back).toMatchObject({ bag: "lares", tier: "contract", home: "repository", repository: "canon", role: "a test role" });
      expect(metaFieldsFromBody(wire)["bag"]).toBe("lares");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the library index — one slot per entry, through the same canonical door", () => {
  const entries: LibraryEntryMeta[] = [
    { cid: "a".repeat(64), name: "book.txt", collection: "shelf", size: 42, mediaType: "text/plain", integrity: "ni:///sha-256;abc" },
    { cid: "b".repeat(64), name: "other.pdf", collection: "shelf", size: 7, mediaType: "application/pdf", integrity: "ni:///sha-256;def", origin: "https://example.com/other.pdf" },
  ];

  test("★ carries the real frame and verifies clean ★", () => {
    const uri = "lar:///ha.ka.ba/library/shelf";
    const body = [
      "```toml meta",
      kv("collection", "shelf"),
      kv("entries", "2"),
      "```",
      "",
      "! Library — shelf",
    ].join("\n");
    const wire = renderCarrier(uri, body);
    expect(wire).toContain('from="?" -> to="lar:///ha.ka.ba/library/shelf"');
    expect(verifyBcc(wire)).toBe("ok");
    expect(readCarrierShape(wire).faults).toEqual([]);
  });

  test("★ every entry is addressable as `<index-uri>#/<cid>` and round-trips its own fields ★", () => {
    const uri = "lar:///ha.ka.ba/library/shelf";
    const entryBlock = (e: LibraryEntryMeta): string =>
      [`<<~ ahu #/${e.cid}>>`, "```toml meta", [kv("name", e.name), kv("bytes", String(e.size)), kv("anchor", e.integrity)].join("\n"), "```", "<<~/ahu>>"].join("\n");
    const body = [
      "```toml meta",
      kv("collection", "shelf"),
      kv("entries", "2"),
      "```",
      "",
      "! Library — shelf",
      "",
      entries.map(entryBlock).join("\n\n"),
    ].join("\n");
    const wire = renderCarrier(uri, body);

    const blocks = findTopLevelAhuBlocks(wire);
    expect(blocks.map((b) => b.slot).sort()).toEqual([`#/${entries[0]!.cid}`, `#/${entries[1]!.cid}`].sort());

    for (const b of blocks) {
      const slotBody = wire.slice(b.bodyStart, b.bodyEnd);
      const fields = metaFieldsFromBody(slotBody);
      const entry = entries.find((e) => b.slot === `#/${e.cid}`);
      expect(entry).toBeDefined();
      expect(fields["name"]).toBe(entry!.name);
      expect(fields["bytes"]).toBe(String(entry!.size));
      expect(fields["anchor"]).toBe(entry!.integrity);
    }

    // CANONICAL IS A FIXED POINT — re-rendering the already-canonical text changes nothing.
    expect(canonicalizeCarrierText(uri, wire)).toBe(wire);
  });
});
