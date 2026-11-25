/**
 * relink-sigil-core.test.ts — the pure law the house's Relink handler reads a sigil opener by (`relink/relink-sigil`): which
 * named values name a record, and what the opener reads once that record moves. The VM walk through Relink itself rides the
 * offering's suite (`offerings/relink/relink-offering.test.ts`).
 */
import { describe, test, expect } from "vitest";
import { denyListPrefix, localRecordOf, relinkSigilOpener, sigilReferences } from "../src/relink-sigil-core.js";

const OLD = "lar:///t/old";
const NEW = "lar:///t/new";

describe("relink-sigil-core", () => {
  test("a named local URI follows the rename, a slot fragment rides along, and every other byte of the opener stays", () => {
    expect(relinkSigilOpener("<<~ loulou uri=`lar:///t/old`>>", OLD, NEW)).toEqual({ output: "<<~ loulou uri=`lar:///t/new`>>" });
    expect(relinkSigilOpener("<<~ pranala slot=`#source` from=`?` to=`lar:///t/old#/a` role=`has`>>", OLD, NEW))
      .toEqual({ output: "<<~ pranala slot=`#source` from=`?` to=`lar:///t/new#/a` role=`has`>>" });
    expect(relinkSigilOpener("<<^ code=`&#x0001;` from=`lar:///t/old` to=`lar:///t/old`>>", OLD, NEW))
      .toEqual({ output: "<<^ code=`&#x0001;` from=`lar:///t/new` to=`lar:///t/new`>>" });
    expect(relinkSigilOpener('<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec="lar:///t/old">>', OLD, NEW))
      .toEqual({ output: '<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec="lar:///t/new">>' });
  });

  test("CONTROL: a prefix-sharing title, the session form, a digest and a bare word name no moved record", () => {
    expect(relinkSigilOpener("<<~ loulou uri=`lar:///t/older`>>", OLD, NEW)).toBeUndefined();
    expect(relinkSigilOpener("<<~ set from=`lar://mara:operator@crossroads/t/old` to=`?`>>", "lar://mara:operator@crossroads/t/old", NEW)).toBeUndefined();
    expect(relinkSigilOpener("<<^ code=`&#x0003;` bcc=`ni:///sha-256;abc`>>", "ni:///sha-256;abc", NEW)).toBeUndefined();
    expect(relinkSigilOpener("<<~ has entity=`x` name=`Old`>>", "Old", "New")).toBeUndefined();
  });

  test("a value that cannot hold the new title answers impossible and rewrites nothing", () => {
    expect(relinkSigilOpener("<<~ loulou uri=`lar:///t/old`>>", OLD, "lar:///t/has`tick")).toEqual({ impossible: true });
    expect(relinkSigilOpener("<<~ loulou uri=`lar:///t/old`>>", OLD, "Plain Title")).toEqual({ impossible: true });
    expect(relinkSigilOpener("<<~ loulou uri=lar:///t/old>>", OLD, "lar:///t/with space")).toEqual({ impossible: true });
    expect(relinkSigilOpener("<<~ loulou uri=lar:///t/old>>", OLD, NEW)).toEqual({ output: "<<~ loulou uri=lar:///t/new>>" });
  });

  test("references name the record without its fragment, at the value's own offsets", () => {
    const opener = "<<~ pranala from=`?` to=```lar:///t/old#/a```>>";
    const [ref] = sigilReferences(opener);
    expect(ref).toMatchObject({ name: "to", value: "lar:///t/old#/a", title: OLD, delimiter: "```" });
    expect(opener.slice(ref!.start, ref!.end)).toBe("lar:///t/old#/a");
    expect(localRecordOf("lar://alias:grant@host/x")).toBeNull();
  });

  test("the memetic deny list rides as one rules pragma line; an empty list adds none", () => {
    expect(denyListPrefix("")).toBe("");
    expect(denyListPrefix("  codeblock  dash ")).toBe("\\rules except codeblock dash\n");
  });
});
