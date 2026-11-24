/**
 * action-oracle-cast — a button in any wiki holding the memetic-wikitext plugin casts the I Ching and writes the cast
 * as a tiddler. The cast happens when the action fires and never at render: rendering the button, or the cast it
 * wrote, casts nothing again.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { ORACLE_THROW_STANDS } from "@lararium/mesh/oracle-cast";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const CASTS = "lar:///ha.ka.ba/lares/oracle/casts/";

describe.skipIf(wikiSkip)(`<$action-oracle-cast> writes a cast as a tiddler${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const casts = (): string[] => e.wiki.filterTiddlers(`[prefix[${CASTS}]]`);
  const fire = (action: string): void =>
    (e.$tw as unknown as { rootWidget: { invokeActionString(s: string): void } }).rootWidget.invokeActionString(action);

  test("RED: rendering the button casts nothing; firing it writes one cast tiddler", () => {
    const before = casts().length;
    renderWikitext(e, `<$button>Cast<$action-oracle-cast coins="889688" caster="operator"/></$button>`);
    renderWikitext(e, `<$button>Cast<$action-oracle-cast coins="889688" caster="operator"/></$button>`);
    expect(casts().length).toBe(before);
    fire(`<$action-oracle-cast coins="889688" caster="operator" result="$:/temp/oracle/last"/>`);
    const title = e.wiki.getTiddlerText("$:/temp/oracle/last", "") ?? "";
    expect(title.startsWith(CASTS)).toBe(true);
    expect(title.endsWith("-15-16")).toBe(true);
    const fields = e.wiki.getTiddler(title)!.fields as Record<string, unknown>;
    expect(fields).toMatchObject({
      method: "three-coins", entropy: "operator:three-coins", lines: "8 8 9 6 8 8", changing: "3 4",
      primary: "15", relating: "16", caster: "operator",
    });
    expect(typeof fields["cast-at"]).toBe("string");
    expect(String(fields["text"])).toContain(ORACLE_THROW_STANDS);
    // Rendering the cast it wrote re-casts nothing: the record holds the throw.
    renderWikitext(e, `{{${title}}}`);
    expect(e.wiki.getTiddler(title)!.fields["lines"]).toBe("8 8 9 6 8 8");
    expect(casts().length).toBe(before + 1);
  });

  test("a house cast from the button draws through the platform's entropy door and says so", () => {
    fire(`<$action-oracle-cast result="$:/temp/oracle/house"/>`);
    const title = e.wiki.getTiddlerText("$:/temp/oracle/house", "") ?? "";
    const fields = e.wiki.getTiddler(title)!.fields as Record<string, unknown>;
    expect(fields["entropy"]).toBe("platform:crypto.getRandomValues");
    expect(fields["caster"]).toBe("wiki");
    expect(String(fields["lines"]).split(" ")).toHaveLength(6);
  });

  test("CONTROL: coins that read wrong cast nothing", () => {
    const before = casts().length;
    fire(`<$action-oracle-cast coins="7,7,7"/>`);
    fire(`<$action-oracle-cast coins="heads"/>`);
    expect(casts().length).toBe(before);
  });
});
