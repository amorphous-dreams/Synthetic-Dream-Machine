/**
 * `aka`'s PIN splits into an INFORMATIVE/BINDING pair (operator ruling, lar:///sigil.grammar.lane
 * loop 7): `aka` (informative pin, English weave `pin`) and `kanawai` (binding pin, Hawaiian
 * kānāwai "law", English weave `law`) — two separate canonical sigils, each with its own English
 * weave, never one sigil mirroring the other.
 */
import { describe, test, expect } from "vitest";
import { collectEvents } from "../src/meme-ast/index.js";
import { GENERATED_SIGILS, GENERATED_FAMILIES, GENERATED_PRIMARY_WEAVE, GENERATED_ALIAS_MAP } from "../src/meme-ast/grammar-table.generated.js";
import type { GrammarRules } from "../src/meme-ast/types.js";
import { normalizeMemeSource } from "../src/meme-normalize.js";

const GRAMMAR: GrammarRules = { sigils: GENERATED_SIGILS, families: GENERATED_FAMILIES };

function leafEvent(src: string) {
  const events = collectEvents(src, GRAMMAR);
  return events.find((e) => e.eventType === "leaf");
}

describe("aka/pin and kanawai/law — two canonical sigils, each its own English weave", () => {
  test("GENERATED_PRIMARY_WEAVE names pin for aka/en and law for kanawai/en", () => {
    expect(GENERATED_PRIMARY_WEAVE["aka"]?.["en"]).toBe("pin");
    expect(GENERATED_PRIMARY_WEAVE["kanawai"]?.["en"]).toBe("law");
  });

  test("law mirrors kanawai, never aka; pin mirrors aka, never kanawai", () => {
    expect(GENERATED_ALIAS_MAP["law"]).toBe("kanawai");
    expect(GENERATED_ALIAS_MAP["pin"]).toBe("aka");
  });

  test.each([
    ["aka", '<<~ aka "lar:///a.b.c/x">>'],
    ["pin", '<<~ pin "lar:///a.b.c/x">>'],
    ["kanawai", '<<~ kanawai "lar:///a.b.c/x">>'],
    ["law", '<<~ law "lar:///a.b.c/x">>'],
  ])("%s scans as a leaf event, no Error", (name, src) => {
    const evt = leafEvent(src);
    expect(evt, `${name} produced no leaf event`).toBeTruthy();
  });

  test("pin's event erases to canonical name aka; law's erases to canonical name kanawai", () => {
    expect(leafEvent('<<~ pin "lar:///a.b.c/x">>')?.sigilName).toBe("aka");
    expect(leafEvent('<<~ law "lar:///a.b.c/x">>')?.sigilName).toBe("kanawai");
  });

  test("normalize leaves law and pin alone — both are lar-weave: primary, never read-only mirrors", () => {
    const src = '<<~ pin "lar:///a.b.c/x">>\n<<~ law "lar:///a.b.c/y">>\n';
    const { changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
  });

  test("CONTROL — aka and kanawai themselves are canonical and never fold", () => {
    const src = '<<~ aka "lar:///a.b.c/x">>\n<<~ kanawai "lar:///a.b.c/y">>\n';
    const { changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
  });
});
