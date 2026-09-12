/**
 * Two renderers, ONE column law — the disk projector's `.mem` render and `meme normalize` byte-agree on
 * the toml meta fence.
 *
 * The projector (`expandMemeRefs`) re-emits the meta from fields and aligns the equals-signs to the
 * longest key; `normalize` left the fence as the author spelled it. A carrier committed with one extra
 * column of padding therefore read clean under `meme check` and moved under the projector — the two
 * renderers disagreed on the same bytes, and the git diff showed a whole fence "changing" while no
 * value changed. One law, one module, both callers importing it.
 *
 * The fixture pins the committed form of `bags/crossroads/ha.ka.ba/lares/library/oracles/doa/index.mem`
 * (read via `git show HEAD:`), whose fence carried the wider column.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { memeticWikitextDeserializer, expandMemeRefs, type TiddlerFields } from "../src/deserializer.js";
import { normalizeMemeSource, alignMetaTomlColumns } from "../src/meme-normalize.js";

const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const URI = "lar:///ha.ka.ba/lares/library/oracles/doa/index";

function projectorRender(src: string, uri: string): string {
  const records = memeticWikitextDeserializer(src, { title: uri });
  const map = new Map(records.map((r) => [String(r.title), r] as const));
  const out = expandMemeRefs((t: string): TiddlerFields | undefined => map.get(t), uri);
  if (out === null) throw new Error("render null");
  return out;
}

describe("the projector's render and normalize's render byte-agree", () => {
  const src = readFileSync(join(FIXTURES, "doa-index.committed.mem"), "utf8");

  test("doa/index.mem (committed form): projector === normalize, byte for byte", () => {
    expect(normalizeMemeSource(src).text).toBe(projectorRender(src, URI));
  });

  test("the committed fence carried one extra column, so normalize reports a change and names it", () => {
    const r = normalizeMemeSource(src);
    expect(r.changed).toBe(true);
    expect(r.notes.join("\n")).toMatch(/meta columns/);
  });

  test("idempotent: normalize over its own output changes nothing", () => {
    const once = normalizeMemeSource(src).text;
    expect(normalizeMemeSource(once).text).toBe(once);
  });
});

describe("the column law itself", () => {
  test("equals-signs align to the longest key, one space each side", () => {
    expect(alignMetaTomlColumns('a = 1\nlonger-key = "x"\nmid   =   true')).toBe(
      'a          = 1\nlonger-key = "x"\nmid        = true',
    );
  });

  test("CONTROL — a fence already aligned by the law passes through unchanged", () => {
    const body = 'cacheable = true\nmana      = 14\ntype      = "text/memetic-wikitext+tiddlywiki"';
    expect(alignMetaTomlColumns(body)).toBe(body);
  });

  test("CONTROL — a value carrying ` = ` inside its quotes keeps every byte of the value", () => {
    const body = 'role = "a = b = c"\nx    = 1';
    expect(alignMetaTomlColumns(body)).toBe('role = "a = b = c"\nx    = 1');
  });

  test("a table header ends the top-level block; lines beneath it stay as written", () => {
    const body = 'a = 1\n[lar]\nzz   = 2';
    expect(alignMetaTomlColumns(body)).toBe('a = 1\n[lar]\nzz   = 2');
  });
});
