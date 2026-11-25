/**
 * ONE RECORD, ONE TAGS LINE — a title-list field (`tags`, `list`) renders one TOML form whichever shape the record arrives in.
 *
 * The disk projector recomposes a carrier from the bag's own records (`exportRecordCarrierFile`), where a field rides the
 * store's `Record<string, string>` (tiddler-record: "array-valued TW5 fields join with spaces at the boundary"), so `tags`
 * arrives as the title-list string `stage/working [[a b]]`. The meme door recomposes from the live wiki
 * (`exportMemeText`), where `$tw.Tiddler` parsed the same field to `["stage/working", "a b"]`. The meta render wrote
 * whatever shape it met: `tags = "stage/working [[a b]]"` from the one, `tags = ["stage/working", "a b"]` from the other.
 * One record, two byte forms, and every disk-versus-served compare read a moved line where nothing moved.
 *
 * The canonical form: the TOML array, one string per title, `[[…]]` never written into the carrier. Every committed carrier
 * under `bags/` and `wikis/` already spells it so; the array needs no TiddlyWiki bracket-quoting inside TOML; a title
 * holding a space rides whole as one string.
 */
import { describe, expect, test } from "vitest";

import { expandMemeRefs, memeticWikitextDeserializer, type TiddlerFields } from "../src/deserializer.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

const ROOT = "lar:///ha.ka.ba/x/tags-demo";
const KID = `${ROOT}#/kid`;

function render(map: Record<string, TiddlerFields>): string {
  const out = expandMemeRefs((t) => map[t], ROOT);
  if (out === null) throw new Error("render null");
  return out;
}

const base = (tags: string | string[]): TiddlerFields => ({
  title: ROOT, type: CARRIER_TYPE, namespace: "ns", "$carrier-soh": "0001", tags, text: "<<~ kahea ahu slot=`#/kid`>>",
});
const kid = (tags?: string | string[]): TiddlerFields => ({ title: KID, text: "body", ...(tags === undefined ? {} : { tags }) });

describe("the projector's record shape and the wiki's record shape render one tags line", () => {
  test("store shape (title-list string) and wiki shape (array) recompose byte-identical", () => {
    const fromStore = render({ [ROOT]: base("stage/working stage/index"), [KID]: kid() });
    const fromWiki = render({ [ROOT]: base(["stage/working", "stage/index"]), [KID]: kid() });
    expect(fromStore).toBe(fromWiki);
    expect(fromStore).toMatch(/^tags\s+= \["stage\/working", "stage\/index"\]$/m);
  });

  test("a title holding a space rides whole: `[[a b]]` in the store reads one array entry, never the brackets", () => {
    const fromStore = render({ [ROOT]: base("stage/working [[a b]]"), [KID]: kid() });
    const fromWiki = render({ [ROOT]: base(["stage/working", "a b"]), [KID]: kid() });
    expect(fromStore).toBe(fromWiki);
    expect(fromStore).toMatch(/^tags\s+= \["stage\/working", "a b"\]$/m);
    expect(fromStore).not.toContain("[[");
  });

  test("a child whose tags match the parent's floats silently across the two shapes", () => {
    const out = render({ [ROOT]: base(["a", "b c"]), [KID]: kid("a [[b c]]") });
    const block = /<<~ ahu slot=`#\/kid`>>([\s\S]*?)<<~\/ahu>>/.exec(out)?.[1] ?? "";
    expect(block).not.toMatch(/^tags/m);
  });

  test("a child whose tags differ re-emits them in the array form", () => {
    const out = render({ [ROOT]: base(["a"]), [KID]: kid("z [[y x]]") });
    const block = /<<~ ahu slot=`#\/kid`>>([\s\S]*?)<<~\/ahu>>/.exec(out)?.[1] ?? "";
    expect(block).toMatch(/^tags = \["z", "y x"\]$/m);
  });

  test("an empty title-list string writes no tags line, as an empty array writes none", () => {
    const out = render({ [ROOT]: base(""), [KID]: kid() });
    expect(out).not.toMatch(/^tags/m);
    expect(render({ [ROOT]: base("   "), [KID]: kid() })).toBe(out);
  });
});

describe("a carrier written in the string form reads back to the same tiddler and re-renders canonical", () => {
  const carrier = (tagsLine: string): string => [
    "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>",
    "",
    `<<^ code=\`&#x0001;\` namespace=\`ns\` from=\`?\` to=\`${ROOT}\`>>`,
    "<<^ code=`&#x0002;`>>",
    "",
    "```toml meta",
    tagsLine,
    `title = "${ROOT}"`,
    `type  = "${CARRIER_TYPE}"`,
    "```",
    "",
    "Body.",
    "",
    "<<^ code=`&#x0003;`>>",
    "",
    "<<^ code=`&#x0004;` to=`?`>>",
    "",
  ].join("\n");

  const recompose = (src: string): { text: string; tags: unknown } => {
    const records = memeticWikitextDeserializer(src, { title: ROOT });
    const map = new Map(records.map((r) => [String(r.title), r] as const));
    const text = expandMemeRefs((t) => map.get(t), ROOT);
    if (text === null) throw new Error("render null");
    return { text, tags: map.get(ROOT)?.tags };
  };

  test("string form and array form re-render the same bytes, in the array form", () => {
    const fromString = recompose(carrier('tags  = "stage/working [[a b]]"'));
    const fromArray = recompose(carrier('tags  = ["stage/working", "a b"]'));
    expect(fromString.text).toBe(fromArray.text);
    expect(fromString.text).toMatch(/^tags\s+= \["stage\/working", "a b"\]$/m);
  });

  test("the canonical render is a fixed point", () => {
    const once = recompose(carrier('tags  = "stage/working [[a b]]"')).text;
    expect(recompose(once).text).toBe(once);
  });
});
