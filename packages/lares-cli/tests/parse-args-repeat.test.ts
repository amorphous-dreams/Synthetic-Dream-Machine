/**
 * A REPEATED LIST FLAG UNIONS, NEVER KEEPS THE LAST.
 *
 * Measured before the cure: `tiddler put T --tag-add a --tag-add b` landed only `b` (the parser overwrote the option),
 * while `--tag-add '[[a]] [[b]]'` landed both, so the loss ran silent. Course lar:///ha.ka.ba/kahua/memory/course/tag-add-keeps-one-list.
 */
import { describe, test, expect } from "vitest";
import { parseArgs } from "../src/parse-args.js";

describe("parseArgs: a repeated list flag UNIONS, never keeps the last", () => {
  test("★ `--tag-add a --tag-add b` lands both (the silent-loss red) ★", () => {
    expect(parseArgs(["tiddler", "put", "T", "--tag-add", "a", "--tag-add", "b"]).options["tag-add"]).toBe("a b");
    expect(parseArgs(["tiddler", "put", "T", "--tag-add=a", "--tag-add", "[[b c]]"]).options["tag-add"]).toBe("a [[b c]]");
  });
  test("`--tag-remove` unions the same way; a single use reads as before", () => {
    expect(parseArgs(["tiddler", "put", "T", "--tag-remove", "a", "--tag-remove", "b"]).options["tag-remove"]).toBe("a b");
    expect(parseArgs(["tiddler", "put", "T", "--tag-add", "[[a]] [[b]]"]).options["tag-add"]).toBe("[[a]] [[b]]");
  });
  test("share filters (`--read`, `--write`, `--read-remove`, `--write-remove`) union as filter lists", () => {
    const a = parseArgs(["wiki", "share", "s", "--read", "h1", "--read", "h2", "--write-remove", "x", "--write-remove", "y"]);
    expect(a.options["read"]).toBe("h1 h2");
    expect(a.options["write-remove"]).toBe("x y");
  });
  test("`--unset` joins comma lists; a scalar flag still keeps the last", () => {
    expect(parseArgs(["tiddler", "put", "T", "--unset", "a", "--unset", "b,c"]).options["unset"]).toBe("a,b,c");
    expect(parseArgs(["x", "--recipe", "one", "--recipe", "two"]).options["recipe"]).toBe("two");
  });
  test("`wiki filter --fields` unions as a comma list; `tiddler put --fields` (JSON) keeps the last", () => {
    expect(parseArgs(["wiki", "filter", "f", "--fields", "title", "--fields", "tags"]).options["fields"]).toBe("title,tags");
    expect(parseArgs(["tiddler", "put", "T", "--fields", "{\"a\":\"1\"}", "--fields", "{\"b\":\"2\"}"]).options["fields"]).toBe("{\"b\":\"2\"}");
  });
});
