/**
 * THE ROOT LAW, ONE SPELLING — the address law the three doors share, and the two leans it rests on.
 *
 * Phase 0 of the syncer-seams roundtable (`bags/lares/ha.ka.ba/lares/docs/pono/syncer-seams-roundtable.mem`)
 * collides two claims BEFORE any cure rests on them; Phase 1 moves the law itself. A lean is not a
 * measurement, so each probe here names the sentence it tests and carries its own CONTROL.
 */

import { describe, test, expect } from "vitest";

// The scanner's law is read through the surfaces that CONSUME it — the Confluence gate's
// `declaredStructure` and the deserializer's split — never by reaching into `meme-ast` directly
// (the grammar boundary, `tests/vm-grammar-boundary.test.ts`). Those two are where the law bites.
import { memeticIngestOps } from "../src/ingest-gate.js";
import { framedRootOf, memePathOf } from "../src/place-meme.js";
import { nativeDoorGate } from "../src/native-door-gate.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import {
  memeticWikitextDeserializer,
  expandMemeRefs,
  type TiddlerFields,
} from "../src/deserializer.js";

const URI = "lar:///t/a";

/** The structural slot-set the Confluence gate grades a round-trip against. */
const declared = (text: string): ReadonlySet<string> => memeticIngestOps.declaredStructure(text);

/** A framed carrier declaring one `ahu` block per name. */
const carrier = (uri: string, slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n\`\`\`toml meta\nuri-path = "t/a"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

function recordsOf(uri: string, text: string): Map<string, TiddlerFields> {
  const out = new Map<string, TiddlerFields>();
  for (const f of memeticWikitextDeserializer(text, { title: uri }, { wiki: null })) {
    out.set(String(f["title"]), f as TiddlerFields);
  }
  return out;
}

describe("Phase 0 · the leans collided", () => {
  // ── the recompose lean ──────────────────────────────────────────────────────────────────────────
  // `syncer-back-parity.mem` #/leans says of widening the backstop: "which would also close (c′)".
  // `deserializer.ts:1013` says otherwise — a missing child keeps its marker, honest residue, never
  // invented bytes. THE PROBE READS THE CODE'S ANSWER, not the lean's.
  test("a root recomposed after a member's tombstone KEEPS the dangling `kahea` — the lean that widening the backstop closes (c′) reads FALSE", () => {
    const records = recordsOf(URI, carrier(URI, ["a", "b"]));
    expect(records.has(`${URI}#/b`)).toBe(true);

    // The lone member dies, as the native delete door lets it (`routes/native-delete-door.ts:86`).
    records.delete(`${URI}#/b`);

    const recomposed = expandMemeRefs((t) => records.get(t), URI);
    expect(recomposed).not.toBeNull();
    // MEASURED: the call stands, unexpanded, in the root's own recomposed body.
    expect(recomposed!).toContain("<<~ kahea ahu #/b>>");
    // And the slot it named is gone — the residue is a CALL, never a revived block.
    expect(recomposed!).not.toContain("<<~ ahu #/b>>");
  });

  test("CONTROL · a root whose members all stand recomposes every block — the probe reads the recompose, not the fixture", () => {
    const records = recordsOf(URI, carrier(URI, ["a", "b"]));
    const recomposed = expandMemeRefs((t) => records.get(t), URI);
    expect(recomposed!).toContain("<<~ ahu #/b>>");
    expect(recomposed!).not.toContain("<<~ kahea ahu #/b>>");
  });

  // ── the scanner lean ────────────────────────────────────────────────────────────────────────────
  // `AHU_OPEN_RE` reads `~[^>]*\bahu`, which swallows the `kahea` in `<<~ kahea ahu #/b>>`. Block
  // pairing saves the splitter (an unmatched opener yields no block); `collectAhuSlots` does no
  // pairing, so the ahu-drop guard (`ingest-gate.ts:167-178`) reads a CALL as a DECLARED slot.
  // A DECLARATION opens a block; a CALL names one. The cure belongs in the scanner, never the guard.
  test("a `kahea ahu` CALL declares NO slot — only an `ahu` block does", () => {
    expect([...declared("<<~ kahea ahu #/b>>")]).toEqual([]);
  });

  test("CONTROL · a true `ahu` block still declares its slot, at every depth", () => {
    expect([...declared("<<~ ahu #/b>>\nbody\n<<~/ahu>>")]).toEqual(["#/b"]);
    expect([...declared("<<~ ahu #/a>>\n<<~ ahu #/c>>\nx\n<<~/ahu>>\n<<~/ahu>>")].sort())
      .toEqual(["#/a", "#/c"]);
    // The English spelling reads the same — two spellings, one structure.
    expect([...declared("<<fragment #/b>>\nbody\n<</fragment>>")]).toEqual(["#/b"]);
  });

  test("CONTROL · a call and a block over the SAME slot declare that slot exactly once", () => {
    expect([...declared("<<~ kahea ahu #/b>>\n\n<<~ ahu #/b>>\nbody\n<<~/ahu>>")]).toEqual(["#/b"]);
  });

  test("a call standing BEFORE a block no longer eats its pairing — the slot still lands as a child record", () => {
    // The call used to push onto the pairing stack, so the real block's closer popped at depth 1, the
    // block never emitted as top-level, and the slot's body landed in NO child at all.
    const text = carrier(URI, []).replace("<<^ code=\"&#x0002;\">>\n\n",
      "<<^ code=\"&#x0002;\">>\n\n<<~ kahea ahu #/b>>\n\n<<~ ahu #/b>>\n\n! b\n\n<<~/ahu>>\n\n");
    const records = recordsOf(URI, text);
    expect([...records.keys()]).toContain(`${URI}#/b`);
    expect(String(records.get(`${URI}#/b`)!["text"])).toContain("! b");
  });

  test("CONTROL · a quoted call or block declares nothing — the fence mask holds", () => {
    expect([...declared("```\n<<~ ahu #/b>>\nx\n<<~/ahu>>\n```")]).toEqual([]);
    expect([...declared("`<<~ kahea ahu #/b>>`")]).toEqual([]);
  });
});

describe("Phase 1 · the root law, one spelling", () => {
  // `isMemeRoot` (`place-meme.ts:223`) carries the warning: "a second spelling of it would drift the
  // day one of them moved." `framedRootOf` was the second spelling and it moved — it read the MARK
  // (the carrier type plus a SOH head) and never asked whether the record IS a root. Three doors read
  // it: the charm, the native door's gate, the backstop.
  const CHILD_TITLE = `${URI}#/a`;
  /** A slot child whose author pasted a whole framed carrier into its text. */
  const childFields = (): Record<string, unknown> => ({
    title: CHILD_TITLE,
    type: CARRIER_TYPE,
    "uri-path": "t/a#/a",
    "$fragment-parent": URI,
    "$slot": "#/a",
    text: carrier(CHILD_TITLE, ["z"]),
  });

  test("a slot child carrying a framed head is NOT a founding — `framedRootOf` answers null", () => {
    expect(framedRootOf(childFields())).toBeNull();
  });

  test("a record whose TITLE carries a fragment is not a founding, even with no `$fragment-parent`", () => {
    const bare = { ...childFields() };
    delete bare["$fragment-parent"];
    expect(framedRootOf(bare)).toBeNull();
  });

  test("the native door PASSES that child — a 422 here would stall the stock syncer's queue forever", () => {
    const body = JSON.stringify({ title: CHILD_TITLE, text: String(childFields()["text"]), fields: {
      type: CARRIER_TYPE, "uri-path": "t/a#/a", "$fragment-parent": URI, "$slot": "#/a",
    } });
    const reply = nativeDoorGate(body, undefined, "default");
    expect(reply.kind).toBe("pass");
  });

  test("CONTROL · a true framed root still answers the URI its head names", () => {
    expect(framedRootOf({ title: URI, type: CARRIER_TYPE, text: carrier(URI, ["a"]) })).toBe(URI);
  });

  test("CONTROL · the native door still REFUSES a true framed root with 422, naming the `/memes/` door", () => {
    const body = JSON.stringify({ title: URI, text: carrier(URI, ["a"]), fields: { type: CARRIER_TYPE } });
    const reply = nativeDoorGate(body, undefined, "default");
    expect(reply.kind).toBe("refuse");
    if (reply.kind !== "refuse") return;
    expect(reply.status).toBe(422);
    expect(reply.body["door"]).toBe(memePathOf(URI, { kind: "recipes", name: "default" }));
  });

  test("CONTROL · a plain tiddler and a SPLIT root both pass the native door untouched", () => {
    for (const fields of [
      { title: "lar:///t/a-plain", type: "text/vnd.tiddlywiki", text: "plain" },
      { title: URI, type: CARRIER_TYPE, text: "<<~ kahea ahu #/a>>" },  // split: a body of calls, no head
    ]) {
      expect(framedRootOf(fields)).toBeNull();
    }
  });
});
