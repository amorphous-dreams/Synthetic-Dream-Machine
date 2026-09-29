/**
 * HANA INTERPRETER LOOKUP — the registered-interpreter branch must actually fire.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────────────────────────
 * `sigil-hana.tid`'s `~hana` widget computed its lookup candidate and its own dispatch variable in
 * ONE filter string:
 *
 *   <$set name="_h-interp" filter="[<p1>addprefix[…/hana-interpreter/]]
 *                                   [all[shadows+tiddlers+system]tag<_h-interp>!is[draft]first[]]">
 *
 * The second run's `tag<_h-interp>` reads `_h-interp` — the SAME variable this `$set` is in the
 * middle of defining — so it always resolves to whatever `_h-interp` held BEFORE this call (blank,
 * for a top-level invocation), never the addprefix'd candidate the first run just computed. The
 * registered-interpreter branch could never fire, for ANY grammar-key, and every hana body fell to
 * the verbatim `<pre><code>` fallback (`hana-body-render.test.ts` measured and named this bug by
 * hand; this suite is its RED/GREEN control at the render layer).
 *
 * It also matched by `tag`, never by `title` — `ingest-canon.mem` Lock 10-superset names the contract
 * plainly: "Guest grammar plugs in via an interpreter tiddler AT
 * lar:///…/hana-interpreter/<key>" — a TITLE, not a tag a registrant must remember to carry.
 *
 * FIX: two nested `$set`s (the same non-self-referencing shape `sigil-ahu.tid`/`sigil-kahea.tid`
 * already carry) — `_h-candidate` computes the title once, `_h-interp` looks IT up by
 * `field:title`, never by its own name.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";

const REGISTERED_KEY = "test-interp-probe";
const REGISTERED_TITLE = `lar:///ha.ka.ba/lararium/hana-interpreter/${REGISTERED_KEY}`;

describe.skipIf(wikiSkip)(`hana interpreter lookup${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => {
    e = await bootTestWiki({
      tiddlers: [{
        title: REGISTERED_TITLE,
        type: "text/vnd.tiddlywiki",
        // a $tiddler= transclusion's named attributes bind as variables only when the TARGET
        // declares them (\parameters, or the ParametersWidget) — TranscludeWidget.tid #Parameters.
        text: '\\parameters (hana-key:"" hana-body:"")\n<span class="probe-interp" data-key=<<hana-key>>><<hana-body>></span>',
      }],
    });
  }, 60_000);

  test("RED→GREEN — a REGISTERED grammar-key's interpreter branch fires (title lookup, not tag)", () => {
    const html = renderWikitext(e, `<<~ hana "${REGISTERED_KEY}">>\npayload text\n<<~/hana>>`);
    expect(html, "the registered interpreter never transcluded — lookup still self-referencing/tag-keyed").toContain("probe-interp");
    expect(html).toContain("payload text");
    // the verbatim fallback must NOT also fire alongside a matched interpreter
    expect(html).not.toContain("lar-hana");
  });

  test("CONTROL — an UNREGISTERED grammar-key still falls to the verbatim, escaped fallback", () => {
    const html = renderWikitext(e, '<<~ hana "no-such-interpreter">>\n<script>evil</script>\n<<~/hana>>');
    expect(html, "the verbatim fallback pre/code wrapper is gone").toContain("lar-hana");
    // the fallback must escape the body, never render it as live markup
    expect(html).not.toContain("<script>evil</script>");
    expect(html).toMatch(/&lt;script&gt;evil&lt;\/script&gt;|evil/);
  });
});
