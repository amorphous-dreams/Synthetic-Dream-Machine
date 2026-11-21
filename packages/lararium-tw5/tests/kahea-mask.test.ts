/**
 * kahea mask= — one name, one relation (Train Q, lead ruling 2026-11-01).
 *
 * `name=` gave kahea two meanings: the template mask beside `uri=`, the definition name alone. The mask
 * takes its own key. RED: ``kahea uri=`…` mask=`…` `` renders through the mask; ``kahea name=`x` `` calls
 * the definition; a `name=` beside `uri=` picks no mask and renders a refusal that names the key.
 * `import`/`transclude` hand their `key=` to the mask.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kahea
 */
import { describe, test, expect, beforeAll } from "vitest";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";

const TARGET = "lar:///t/kahea-target";
const MASK = "lar:///t/kahea-mask";

describe.skipIf(wikiSkip)(`kahea: mask= picks the template, name= calls a definition${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => {
    engine = await bootTestWiki({
      tiddlers: [
        { title: TARGET, type: "text/vnd.tiddlywiki", text: "target body" },
        { title: MASK, type: "text/vnd.tiddlywiki", text: "MASKED:<$text text={{!!title}}/>" },
      ],
    });
  });
  const render = (src: string) => renderWikitext(engine, src);

  test("★ uri= with mask= renders the target through the mask ★", () => {
    expect(render(`<<~ kahea uri=\`${TARGET}\` mask=\`${MASK}\`>>`)).toContain(`MASKED:${TARGET}`);
  });

  test("★ import and transclude hand key= to the mask ★", () => {
    expect(render(`<<~ import uri=\`${TARGET}\` key=\`${MASK}\`>>`)).toContain(`MASKED:${TARGET}`);
    expect(render(`<<~ transclude uri=\`${TARGET}\` key=\`${MASK}\`>>`)).toContain(`MASKED:${TARGET}`);
  });

  test("★ name= alone calls the definition by name ★", () => {
    expect(render("\\procedure greet(who) Hi <<who>>!\n\n<<~ kahea name=`greet` params=`Op`>>")).toContain("Hi Op!");
  });

  test("★ a name= beside uri= picks no mask and renders a refusal naming mask= ★", () => {
    const html = render(`<<~ kahea uri=\`${TARGET}\` name=\`${MASK}\`>>`);
    expect(html).not.toContain("MASKED:");
    expect(html).toContain("lar-kahea-refused");
    expect(html).toContain("mask=");
  });

  test("CONTROL: uri= alone renders through the default cascade, never the mask", () => {
    const html = render(`<<~ kahea uri=\`${TARGET}\`>>`);
    expect(html).not.toContain("MASKED:");
    expect(html).not.toContain("lar-kahea-refused");
  });
});
