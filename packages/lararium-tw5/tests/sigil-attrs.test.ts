/**
 * sigil-attrs — the one reader of a sigil's named parameters.
 *
 * Every vector here names a shape the corpus actually carries, or a shape that would break if quoted.
 */
import { describe, test, expect } from "vitest";
import { readSigilAttrs, sigilAttrValue, quotableAttrs } from "../src/sigil-attrs.js";

describe("both spellings reach one reading", () => {
  test("★ bare and quoted name the same value ★", () => {
    expect(sigilAttrValue(" #x from=? -> to=lar:///d family=code role=has", "family")).toBe("code");
    expect(sigilAttrValue(' #x from="?" -> to="lar:///d" family="code" role="has"', "family")).toBe("code");
  });

  test("the quote flag reports which spelling stood", () => {
    expect(readSigilAttrs("a=1")[0]!.quoted).toBe(false);
    expect(readSigilAttrs('a="1"')[0]!.quoted).toBe(true);
  });

  test("a single-quoted value reads too — the corpus carries 36", () => {
    expect(sigilAttrValue("voice:'ink-clerk'", "voice")).toBe("ink-clerk");
  });

  test("★ a `:` separator reads the same as `=` ★", () => {
    expect(sigilAttrValue("family:code", "family")).toBe("code");
    expect(readSigilAttrs("family:code")[0]!.sep).toBe(":");
  });
});

describe("★ THE SEPARATOR DECIDES WHAT A VALUE MAY BE ★", () => {
  // `=` in a CALL arrived to unlock the indirect forms; `:` predates them. Read out of TiddlyWiki
  // 5.5.0 `parseMacroParameterAsAttribute`: only `isNewStyleSeparator` (`=`) opens the branch that
  // looks for a filtered, indirect, macro or substituted value.
  test("★ `=` opens the new-style values ★", () => {
    expect(readSigilAttrs("p={{{[tag[x]]}}}")[0]!.kind).toBe("filtered");
    expect(readSigilAttrs("p={{Some Tiddler}}")[0]!.kind).toBe("indirect");
    expect(readSigilAttrs("p=<<name>>")[0]!.kind).toBe("macro");
    expect(readSigilAttrs("p=`subst`")[0]!.kind).toBe("substituted");
  });

  test("★ `:` opens NONE of them — it takes a string and nothing else ★", () => {
    expect(readSigilAttrs("p:<<name>>")[0]?.kind).not.toBe("macro");
    expect(readSigilAttrs("p:{{Some Tiddler}}")[0]?.kind).not.toBe("indirect");
  });

  test("★ a string literal wears FOUR delimiters, all legal after either separator ★", () => {
    for (const sep of ["=", ":"]) {
      expect(sigilAttrValue(`p${sep}"A Title"`, "p")).toBe("A Title");
      expect(sigilAttrValue(`p${sep}'A Title'`, "p")).toBe("A Title");
      expect(sigilAttrValue(`p${sep}[[A Title]]`, "p")).toBe("A Title");
      expect(sigilAttrValue(`p${sep}"""A "quoted" Title"""`, "p")).toBe('A "quoted" Title');
    }
  });

  test("★ a bracketed title reports QUOTED — it needs no further wrapping ★", () => {
    const a = readSigilAttrs("p=[[A Title]]")[0]!;
    expect(a.quoted).toBe(true);
    expect(a.kind).toBe("string");
    expect(quotableAttrs("p=[[A Title]] q=bare")).toHaveLength(1);
  });

  test("a QUOTED value stands legal after either separator", () => {
    expect(sigilAttrValue('p="v"', "p")).toBe("v");
    expect(sigilAttrValue('p:"v"', "p")).toBe("v");
  });

  test("★ the colon demands a STRICT identifier ★", () => {
    // "to avoid mis-parsing values like `$:/foo`" — where the name is not [A-Za-z0-9-_]+ the parser
    // discards name AND separator, and the token reads as a positional.
    expect(readSigilAttrs("a.b:v").map((x) => x.name)).not.toContain("a.b");
    expect(sigilAttrValue("a.b=v", "a.b")).toBe("v");        // …but `=` takes the wide name
    expect(sigilAttrValue("a-b:v", "a-b")).toBe("v");        // …and a strict name still binds
  });
});

describe("★ a TYPED value is not a string, and quoting would break it ★", () => {
  // 13 stand in the corpus, all shaped `name=<<name>>`. Quoting one makes it a string and the macro
  // stops being called — so no canonicalizer may touch it.
  test("a macro-valued param reports its kind and keeps its source", () => {
    const a = readSigilAttrs("season name=<<name>>")[0]!;
    expect(a.name).toBe("name");
    expect(a.kind).toBe("macro");
    expect(a.value).toBe("<<name>>");
  });

  test("an indirect and a filtered value each report their kind", () => {
    expect(readSigilAttrs("p={{Some Tiddler}}")[0]!.kind).toBe("indirect");
    expect(readSigilAttrs("p={{{[tag[x]]}}}")[0]!.kind).toBe("filtered");
  });

  test("★ quotableAttrs REFUSES every typed value ★", () => {
    const body = 'season name=<<name>> family=code p={{X}} q={{{[tag[t]]}}} role="has"';
    expect(quotableAttrs(body).map((a) => a.name)).toEqual(["family"]);
  });
});

describe("a scheme is not a parameter", () => {
  test("★ `lar:///x` carries no key named lar ★", () => {
    expect(readSigilAttrs(" lar:///ha.ka.ba/lares/api/pono/meme").map((a) => a.name)).toEqual([]);
  });

  test("nor do ni: or did:", () => {
    expect(readSigilAttrs("ni:///sha-256;AAA did:web:example.com").map((a) => a.name)).toEqual([]);
  });

  test("but a real key beside a URI still reads", () => {
    expect(sigilAttrValue("from=? -> to=lar:///d family=code", "to")).toBe("lar:///d");
  });
});

describe("a `>` rides as content", () => {
  test("a bare value carrying one bracket survives", () => {
    expect(sigilAttrValue("to=lar:///a>b family=code", "to")).toBe("lar:///a>b");
  });
});

describe("an unquoted value stops where the parser stops", () => {
  // Both measured against TiddlyWiki 5.5.0 over the whole corpus.
  test("★ a quote may DELIMIT, so a bare value cannot contain one ★", () => {
    expect(sigilAttrValue("Phonology=don't", "Phonology")).toBe("don");
  });

  test("★ the name charset is the parser's — `+` `.` `$` `#` all ride ★", () => {
    expect(sigilAttrValue("operational-closure+structural-coupling=Varela", "operational-closure+structural-coupling")).toBe("Varela");
    expect(sigilAttrValue("a.b=v", "a.b")).toBe("v");
  });

  test("but a `/` breaks a name, as it does for the parser", () => {
    expect(readSigilAttrs("a/b=v").map((x) => x.name)).not.toContain("a/b");
  });
});

describe("offsets and ordering", () => {
  test("offsets bracket the parameter in its own body", () => {
    const body = "from=? -> to=lar:///d";
    const to = readSigilAttrs(body).find((a) => a.name === "to")!;
    expect(body.slice(to.start, to.end)).toBe("to=lar:///d");
  });

  test("the LAST of a repeated name wins, as TiddlyWiki reads it", () => {
    expect(sigilAttrValue("a=1 a=2", "a")).toBe("2");
  });

  test("a positional argument carries no name and appears in no result", () => {
    expect(readSigilAttrs(" ahu #/orient/ha-fields").map((a) => a.name)).toEqual([]);
  });
});

describe("the corpus shapes, verbatim", () => {
  test("★ a pranala, whole ★", () => {
    const b = " #source from=? -> to=packages/lararium-mesh/src/crypto.ts family=code role=has";
    const a = Object.fromEntries(readSigilAttrs(b).map((x) => [x.name, x.value]));
    expect(a).toEqual({ from: "?", to: "packages/lararium-mesh/src/crypto.ts", family: "code", role: "has" });
  });

  test("★ a panel, whole ★", () => {
    const b = ' hud="yield" mode="strike" focus="14/arc" drift-ward="* · a note"';
    const a = Object.fromEntries(readSigilAttrs(b).map((x) => [x.name, x.value]));
    expect(a["drift-ward"]).toBe("* · a note");
    expect(a["focus"]).toBe("14/arc");
  });

  test("★ a turn bearing, whole ★", () => {
    const b = " aim from=lar://mara:operator@crossroads/a.b.c -> to=lar://compita:agent@crossroads/d.e.f";
    const a = Object.fromEntries(readSigilAttrs(b).map((x) => [x.name, x.value]));
    expect(a["from"]).toBe("lar://mara:operator@crossroads/a.b.c");
    expect(a["to"]).toBe("lar://compita:agent@crossroads/d.e.f");
  });
});
