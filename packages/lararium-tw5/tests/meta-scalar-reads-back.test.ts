/**
 * A meta value the emitter writes bare must read back as the string it came from.
 *
 * The emitter writes a digit-run string bare (`mana = 14`), so the field reads back through TOML as the
 * integer 14 and stringifies to "14" again. A digit run TOML refuses as an integer — a leading zero
 * (`order = "0310"`, the founding road's child order) — wrote bare as `order = 0310`, which no TOML reader
 * accepts: the whole meta block failed to parse on the next read, every field but the SOH-derived ones
 * fell away, and the second render differed from the first. A run TOML accepts but reads back to another
 * string (`-0`, a run past the safe-integer range) loses its spelling the same way, only quieter.
 *
 * The law: a string writes bare only when TOML reads that bare lexeme back to the same string.
 */
import { describe, expect, test } from "vitest";

import { memeticWikitextDeserializer, expandMemeRefs, type TiddlerFields } from "../src/deserializer.js";

const URI  = "lar:///ha.ka.ba/lares/docs/road/scalar-fixture";
// Built from parts, so the corpus finder never reads this file as a carrier.
const DECL = "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` " + "spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>\n";

function carrier(meta: string): string {
  return DECL + "\n<<^ code=`&#x0001;` from=`?` to=`" + URI + "`>>\n<<^ code=`&#x0002;`>>\n\n" +
    "```toml meta\n" + meta + "\n" +
    'title    = "' + URI + '"\n' +
    'type     = "text/memetic-wikitext+tiddlywiki"\n' +
    'uri-path = "ha.ka.ba/lares/docs/road/scalar-fixture"\n```\n\nbody\n\n<<^ code=`&#x0003;`>>\n\n<<^ code=`&#x0004;` to=`?`>>\n';
}

function render(src: string): { out: string; fields: TiddlerFields } {
  const records = memeticWikitextDeserializer(src, { title: URI });
  const map = new Map(records.map((r) => [String(r.title), r] as const));
  const out = expandMemeRefs((t: string): TiddlerFields | undefined => map.get(t), URI);
  if (out === null) throw new Error("render null");
  return { out, fields: map.get(URI)! };
}

describe("a meta scalar written bare reads back as the string it came from", () => {
  for (const [label, value] of [
    ["a leading zero", "0310"],
    ["a lone zero padded", "00"],
    ["negative zero", "-0"],
    ["a run past the safe-integer range", "123456789012345678901"],
  ] as const) {
    test(`${label} (\`${value}\`) stays quoted, and a second render changes nothing`, () => {
      const once = render(carrier(`order    = "${value}"`));
      expect(once.out).toContain(`order    = "${value}"`);
      const twice = render(once.out);
      expect(twice.out).toBe(once.out);
      expect(twice.fields["order"]).toBe(value);
    });
  }

  test("CONTROL — a TOML integer still writes bare and reads back the same", () => {
    for (const value of ["0", "14", "-7"]) {
      const once = render(carrier(`order    = ${value}`));
      expect(once.out).toContain(`order    = ${value}\n`);
      expect(render(once.out).out).toBe(once.out);
    }
  });
});
