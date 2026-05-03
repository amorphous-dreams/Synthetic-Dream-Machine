/**
 * @lararium/tw5 pure-parser tests — no TW5 VM required.
 *
 * Tests cover:
 *   parseTaploFields — sync TOML → flat record (smol-toml based)
 *   parseZoomLayoutTOML — zoom-level layout extraction from TOML blocks
 *
 * These parsers run in Node without any DOM, TW5 boot, or Automerge dep.
 * They parse carrier #iam TOML and kumu zoom config respectively.
 *
 * Meme: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/iam-toml
 */

import { describe, test, expect } from "@jest/globals";
import { parseTaploFields } from "../src/toml-ast.js";
import { parseZoomLayoutTOML } from "../src/zoom-layout.js";

// ---------------------------------------------------------------------------
// parseTaploFields — carrier #iam TOML → flat record
// ---------------------------------------------------------------------------

describe("parseTaploFields — carrier TOML parsing", () => {
  test("parses simple string fields", () => {
    const toml = `
uri-path   = "ha.ka.ba/@lares/api/v0.1/mu"
type       = "text/x-memetic-wikitext"
confidence = "0.88"
`;
    const fields = parseTaploFields(toml);
    expect(fields["uri-path"]).toBe("ha.ka.ba/@lares/api/v0.1/mu");
    expect(fields["type"]).toBe("text/x-memetic-wikitext");
  });

  test("parses numeric values as strings (flat model)", () => {
    const toml = `confidence = 0.88\nmanaoio = 0.75`;
    const fields = parseTaploFields(toml);
    // flattenTomlValue converts numbers to strings
    expect(typeof fields["confidence"]).toBe("string");
    expect(parseFloat(fields["confidence"] as string)).toBeCloseTo(0.88, 2);
  });

  test("returns {} and pushes diagnostic on malformed TOML", () => {
    const warnings: string[] = [];
    const fields = parseTaploFields("not = valid = toml !!!", warnings, "#iam");
    expect(fields).toEqual({});
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("#iam");
  });

  test("parses TOML with inline comments without error", () => {
    const toml = `
uri-path  = "ha.ka.ba/@lares/api/v0.1/pono/invariant"  # canonical
register  = "CS"  # confidence scale
`;
    const warnings: string[] = [];
    const fields = parseTaploFields(toml, warnings);
    expect(fields["register"]).toBe("CS");
    expect(warnings).toHaveLength(0);
  });

  test("recognizes canonical mana signal keys", () => {
    const toml = `
confidence = 0.84
manaoio    = 0.80
mana       = 0.88
manao      = 0.84
register   = "CS"
`;
    const fields = parseTaploFields(toml);
    expect(fields["confidence"]).toBeDefined();
    expect(fields["manaoio"]).toBeDefined();
    expect(fields["register"]).toBe("CS");
  });
});

// ---------------------------------------------------------------------------
// parseZoomLayoutTOML — kumu zoom-level config
// ---------------------------------------------------------------------------

describe("parseZoomLayoutTOML — zoom config extraction", () => {
  test("returns null when text contains no TOML block", () => {
    expect(parseZoomLayoutTOML("No toml here")).toBeNull();
  });

  test("parses fenced ```toml block", () => {
    const text = [
      "```toml",
      "w     = 220",
      "h     = 100",
      "color = \"rating\"",
      "include-ahu  = false",
      "show-carrier = false",
      "opacity      = 1.0",
      "```",
    ].join("\n");
    const layout = parseZoomLayoutTOML(text);
    expect(layout).not.toBeNull();
    expect(layout!.w).toBe(220);
    expect(layout!.h).toBe(100);
    expect(layout!.color).toBe("rating");
    expect(layout!.includeAhu).toBe(false);
    expect(layout!.showCarrier).toBe(false);
    expect(layout!.opacity).toBeCloseTo(1.0, 2);
  });

  test("combat zoom level enables ahu frames", () => {
    const text = [
      "```toml",
      "w           = 280",
      "h           = 140",
      "color       = \"rating\"",
      "include-ahu = true",
      "```",
    ].join("\n");
    const layout = parseZoomLayoutTOML(text);
    expect(layout!.includeAhu).toBe(true);
  });

  test("action zoom level enables carrier text", () => {
    const text = [
      "```toml",
      "w            = 380",
      "h            = 200",
      "color        = \"rating\"",
      "show-carrier = true",
      "```",
    ].join("\n");
    const layout = parseZoomLayoutTOML(text);
    expect(layout!.showCarrier).toBe(true);
  });

  test("applies defaults for missing optional fields", () => {
    const text = ["```toml", "w = 200", "h = 90", "color = \"rating\"", "```"].join("\n");
    const layout = parseZoomLayoutTOML(text);
    expect(layout!.includeAhu).toBe(false);
    expect(layout!.showCarrier).toBe(false);
    expect(layout!.opacity).toBeCloseTo(1.0, 2);
  });
});
