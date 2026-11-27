/**
 * affordance-rows — the pure reading of an affordance carrier's rows, and the spellings every skin derives by rule
 * (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-loom #/slots). RED-FIRST: written by smith#1, run by the familiar.
 */
import { describe, expect, test } from "vitest";
import {
  addressMatcher, addressOfTitle, bodyOf, digestOf, edgesOf, exampleCall, kaheaTitles, neutralCallOf, parseHasRows, parseParams, proseOf, renderCall,
  seatsOf, spellArg, tokenize, usageOf, unfoldRead, type HasRow,
} from "../src/affordance-rows.js";
import { affordView, carrierOf, carrierViewOfText, seatTitleOf } from "../src/affordance-read.js";

const TAKES = [
  "!! takes ~ recipe · bag · asking · fresh",
  "<<has entity=`arg` name=`recipe` params=`takes/slug needs/one-of:recipe,bag ~ the wiki that takes the cast`>>",
  "<<has entity=`arg` name=`bag` params=`takes/slug needs/one-of:recipe,bag ~ the bag that takes the cast`>>",
  "<<~ has entity=`arg` name=`asking` params=`takes/words needs/seat ~ the question, named before the throw`>>",
  "<<has entity=`arg` name=`fresh` params=`gate/hand ~ a new throw for the same words`>>",
].join("\n");

describe("the row reader", () => {
  test("RED 1: a has row reads entity, name, key/value params, bare tokens and the ~ line; the sigil form reads alike", () => {
    const rows = parseHasRows(TAKES);
    expect(rows.map((r) => r.name)).toEqual(["recipe", "bag", "asking", "fresh"]);
    expect(rows[2]).toEqual({ entity: "arg", name: "asking", params: { takes: "words", needs: "seat" }, bare: [], role: "the question, named before the throw" });
    expect(parseHasRows(TAKES, "band")).toEqual([]);
  });

  test("RED 2: [[…]] brackets a value with spaces; a token with no slash reads bare", () => {
    expect(tokenize("recipe/default asking/[[which road first?]] fresh")).toEqual(["recipe/default", "asking/which road first?", "fresh"]);
    expect(parseParams("recipe/default fresh ~ a line")).toEqual({ params: { recipe: "default" }, bare: ["fresh"], role: "a line" });
    expect(parseParams("~ only a line")).toEqual({ params: {}, bare: [], role: "only a line" });
  });

  test("RED 3: the digest, the prose, the kahea calls and the loulou edges read off a slot's text", () => {
    expect(digestOf(TAKES)).toBe("takes ~ recipe · bag · asking · fresh");
    expect(proseOf("! head ~ one\n\nfirst para\nruns on\n\n<<has entity=`x` name=`y`>>\nsecond")).toEqual(["one", "first para runs on", "second"]);
    // The body leaves the head's tagline out: a surface that names the role on its own line names it once.
    expect(bodyOf("! head ~ one\n\nfirst para\nruns on\n\n<<has entity=`x` name=`y`>>\nsecond")).toEqual(["first para runs on", "second"]);
    expect(bodyOf("!! takes ~ a · b\n\nonly prose")).toEqual(["only prose"]);
    expect(kaheaTitles("<<~ kahea ahu slot=`#/takes/container` to=`lar:///ha.ka.ba/lares/api/pono/affordance`>>"))
      .toEqual(["lar:///ha.ka.ba/lares/api/pono/affordance#/takes/container"]);
    expect(edgesOf("!! edges\n<<~ loulou uri=`lar:///ha.ka.ba/lares/api/pono/oracle-loop`>>")).toEqual(["lar:///ha.ka.ba/lares/api/pono/oracle-loop"]);
  });
});

describe("the skins derive spellings by rule", () => {
  const skin = (maps: string): HasRow => ({ entity: "skin", name: "mcp", params: { spells: "oracle_cast", maps }, bare: [], role: "" });

  test("RED 4: cli --kebab, mcp snake_case, tw5 attribute, console key; a skin row names only its exceptions", () => {
    expect(spellArg("cli", "dry_run")).toBe("--dry-run");
    expect(spellArg("mcp", "dry-run")).toBe("dry_run");
    expect(spellArg("tw5", "dryRun")).toBe("dry-run");
    expect(spellArg("console", "asking")).toBe("asking");
    expect(spellArg("mcp", "asking", skin("asking:query"))).toBe("query");
  });

  test("RED 5: one neutral call renders runnable on every surface", () => {
    const call = neutralCallOf("oracle.library.consults recipe/default asking/<words>", "lar:///x.y.z");
    expect(call.address).toBe("lar:///oracle.library.consults");
    expect(renderCall("cli", "lares oracle cast", call)).toBe("lares oracle cast --recipe default --asking <words>");
    expect(renderCall("mcp", "oracle_cast", call)).toBe(`oracle_cast(recipe="default", asking="<words>")`);
    expect(renderCall("tw5", "action-oracle-cast", call)).toBe(`<$action-oracle-cast recipe="default" asking="<words>"/>`);
    expect(renderCall("console", "", call)).toBe(`$tw.lares.afford.run("oracle.library.consults", {"recipe": "default", "asking": "<words>"})`);
    const example = parseHasRows("<<has entity=`example` name=`e` params=`recipe/default asking/[[which road first?]] fresh then/oracle.read.casts ~ x`>>")[0]!;
    expect(renderCall("cli", "lares oracle cast", exampleCall(example, "lar:///oracle.library.consults"))).toBe("lares oracle cast --recipe default --asking 'which road first?' --fresh");
  });

  test("RED 6: the usage spine groups a one-of choice and brackets every optional arg", () => {
    const rows = parseHasRows(TAKES);
    expect(usageOf("cli", "lares oracle cast", rows)).toBe("usage: lares oracle cast (--recipe <slug> | --bag <slug>) [--asking <words>] [--fresh]");
    expect(usageOf("mcp", "oracle_cast", rows)).toBe("oracle_cast((recipe=<slug> | bag=<slug>), [asking=<words>], [fresh])");
  });

  test("RED 7: the unfold read speaks the read door's own words on each surface", () => {
    expect(unfoldRead("cli", "lar:///oracle.library.consults", "#/refuses")).toBe("lares tiddler get lar:///oracle.library.consults#/refuses --recipe lares --meme");
    expect(unfoldRead("mcp", "lar:///oracle.library.consults", "#/refuses")).toContain(`grain="slot", slot="#/refuses"`);
  });
});

describe("addresses and wildcards (DAM law 2)", () => {
  test("RED 8: t2/t3 wildcards match; a t1 wildcard refuses by name", () => {
    expect(addressMatcher("oracle.*")("lar:///oracle.library.consults")).toBe(true);
    expect(addressMatcher("oracle.library.*")("oracle.library.consults")).toBe(true);
    expect(addressMatcher("custody.hand.*")("oracle.library.consults")).toBe(false);
    expect(() => addressMatcher("*.cast.throws")).toThrow(/afford-wildcard-heading/);
  });

  test("RED 9: the reader answers views over records, and an unknown view throws rather than reading empty", () => {
    const records: Record<string, string> = {
      "lar:///oracle.library.consults#/takes": TAKES,
      "lar:///oracle.library.consults#/skins/cli": "<<has entity=`skin` name=`cli` params=`spells/[[lares oracle cast]]`>>",
      "lar:///oracle.library.consults#/head": "! oracle.library.consults ~ cast the coins\n\nA line sums three coins.",
    };
    const textOf = (t: string): string | undefined => records[t];
    expect(affordView(textOf, "lar:///oracle.library.consults", "spells", "cli", "")).toEqual(["lares oracle cast"]);
    expect(affordView(textOf, "lar:///oracle.library.consults", "spells", "mcp", "")).toEqual([]);
    expect(JSON.parse(affordView(textOf, "lar:///oracle.library.consults", "rows", "cli", "#/takes")[2]!)).toMatchObject({ name: "asking", spell: "--asking", value: "words" });
    expect(affordView(textOf, "lar:///oracle.library.consults", "prose", "mcp", "#/head")).toEqual(["cast the coins", "A line sums three coins."]);
    expect(affordView(textOf, "lar:///oracle.library.consults", "body", "mcp", "#/head")).toEqual(["A line sums three coins."]);
    expect(() => affordView(textOf, "lar:///oracle.library.consults", "nope", "cli", "")).toThrow(/afford-view-unknown/);
  });
});

describe("the canon seat (weaver#1: canon seats no bare root)", () => {
  test("RED 10: a carrier's title carries its address, at the bare root or at the stable afford seat", () => {
    expect(addressOfTitle("lar:///oracle.library.consults")).toBe("lar:///oracle.library.consults");
    expect(addressOfTitle("lar:///ha.ka.ba/lares/afford/oracle.library.consults")).toBe("lar:///oracle.library.consults");
    expect(addressOfTitle("lar:///ha.ka.ba/lares/api/pono/affordance")).toBeNull();
  });

  test("RED 11: the canon kahea spelling resolves; `fresh/true` reads as a switch", () => {
    expect(kaheaTitles("<<~ kahea uri=`lar:///ha.ka.ba/lares/api/pono/affordance#/takes/container`>>"))
      .toEqual(["lar:///ha.ka.ba/lares/api/pono/affordance#/takes/container"]);
    const call = neutralCallOf("oracle.library.consults fresh/true", "lar:///x.y.z");
    expect(renderCall("cli", "lares oracle cast", call)).toBe("lares oracle cast --fresh");
  });
});

describe("a positional arg (`seat/N`)", () => {
  const DATE = [
    "<<has entity=`arg` name=`format` params=`takes/words seat/1 as/+FORMAT lead/+ ~ the format codes`>>",
    "<<has entity=`arg` name=`day` params=`takes/number seat/2 as/<day> needs/all-of:day,month,year ~ the day`>>",
    "<<has entity=`arg` name=`month` params=`takes/number seat/3 as/<month> needs/all-of:day,month,year ~ the month`>>",
    "<<has entity=`arg` name=`year` params=`takes/number seat/4 as/<year> needs/all-of:day,month,year ~ the year`>>",
    "<<has entity=`arg` name=`json` params=`~ the envelope`>>",
  ].join("\n");
  const rows = parseHasRows(DATE);

  test("RED 1: the cli rides it bare in its seat, the lead glued on; the code surfaces ride it by name, a whole number bare", () => {
    const call = exampleCall(parseHasRows("<<has entity=`example` name=`x` params=`json day/5 format/[[%X]] month/1 ~ a day`>>")[0]!, "lar:///oracle.calendar.dates");
    expect(renderCall("cli", "lares ddate", call, undefined, seatsOf(rows))).toBe("lares ddate '+%X' 5 1 --json");
    expect(renderCall("mcp", "ddate", call)).toBe(`ddate(day=5, format="%X", month=1, json=True)`);
  });

  test("RED 2: the cli usage spine leads with the positionals in seat order, then the flags", () => {
    expect(usageOf("cli", "lares ddate", rows)).toBe("usage: lares ddate [+FORMAT] [<day> <month> <year>] [--json]");
    expect(usageOf("mcp", "ddate", rows)).toBe("ddate([format=<words>], [day=<number>, month=<number>, year=<number>], [json])");
  });

  test("RED 3: `needs/all-of:` groups args that ride together or not at all, one bracket for the group, in seat order", () => {
    const shuffled = parseHasRows([
      "<<has entity=`arg` name=`year` params=`takes/number seat/4 as/<year> needs/all-of:day,month,year ~ the year`>>",
      "<<has entity=`arg` name=`day` params=`takes/number seat/2 as/<day> needs/all-of:day,month,year ~ the day`>>",
      "<<has entity=`arg` name=`month` params=`takes/number seat/3 as/<month> needs/all-of:day,month,year ~ the month`>>",
    ].join("\n"));
    expect(usageOf("cli", "lares ddate", shuffled)).toBe("usage: lares ddate [<day> <month> <year>]");
    expect(usageOf("mcp", "ddate", shuffled)).toBe("ddate([year=<number>, day=<number>, month=<number>])");
  });
});

describe("a bare root resolves, and the stack decides (`carrierOf`)", () => {
  const SEAT = "lar:///ha.ka.ba/lares/afford/oracle.library.consults";
  const BARE = "lar:///oracle.library.consults";
  const carrier = (title: string, role: string): Record<string, string> => ({
    [title]: "",
    [`${title}#/skins/cli`]: "<<has entity=`skin` name=`cli` params=`spells/[[lares oracle cast]]`>>",
    [`${title}#/head`]: `! oracle.library.consults ~ ${role}\n\nA line sums three coins.`,
  });
  const viewOf = (records: Record<string, string>) => {
    const textOf = (t: string): string | undefined => records[t];
    return { textOf, carriers: carrierViewOfText(textOf) };
  };

  test("RED 1: the stable seat answers a bare root no record titles; every spelling of the address names the same carrier", () => {
    const { carriers } = viewOf(carrier(SEAT, "canon line"));
    expect(carrierOf(carriers, BARE)).toBe(SEAT);
    expect(carrierOf(carriers, "oracle.library.consults")).toBe(SEAT);
    expect(carrierOf(carriers, SEAT)).toBe(SEAT);
    expect(seatTitleOf(BARE)).toBe(SEAT);
  });

  test("RED 2: a record titled with the bare root wins over the seat, whichever spelling asks", () => {
    const { carriers } = viewOf({ ...carrier(SEAT, "canon line"), ...carrier(BARE, "working line") });
    expect(carrierOf(carriers, BARE)).toBe(BARE);
    expect(carrierOf(carriers, SEAT)).toBe(BARE);
  });

  test("RED 3: a mesh seat answers where the house seat stands empty; a tagged carrier answers past both; nothing answers null", () => {
    const mesh = "lar:///ha.ka.ba/lararium/afford/oracle.library.consults";
    expect(carrierOf(viewOf(carrier(mesh, "mesh line")).carriers, BARE)).toBe(mesh);
    const other = "lar:///ha.ka.ba/elsewhere/afford/oracle.library.consults";
    const tagged = { has: (t: string) => t === other, tagged: (a: string) => (a === BARE ? [other] : []) };
    expect(carrierOf(tagged, BARE)).toBe(other);
    expect(carrierOf(viewOf({}).carriers, BARE)).toBeNull();
    expect(carrierOf(viewOf(carrier(SEAT, "x")).carriers, "lar:///ha.ka.ba/lares/api/pono/affordance")).toBeNull();
  });

  test("RED 4: every view reads through the carrier the stack seats: a bare root reads the seat's rows, and a bare-root carrier above the seat answers in its place", () => {
    const canon = viewOf(carrier(SEAT, "canon line"));
    expect(affordView(canon.textOf, BARE, "prose", "cli", "#/head")).toEqual(["canon line", "A line sums three coins."]);
    expect(affordView(canon.textOf, BARE, "spells", "cli", "")).toEqual(["lares oracle cast"]);
    const stacked = viewOf({ ...carrier(SEAT, "canon line"), ...carrier(BARE, "working line") });
    expect(affordView(stacked.textOf, SEAT, "prose", "cli", "#/head")[0]).toBe("working line");
    expect(affordView(stacked.textOf, BARE, "prose", "cli", "#/head")[0]).toBe("working line");
  });

  test("RED 5: `match` answers the carrier that answers, so the seat and the bare root above it name one address once", () => {
    const stacked = viewOf({ ...carrier(SEAT, "canon line"), ...carrier(BARE, "working line") });
    expect(affordView(stacked.textOf, SEAT, "match", "cli", "oracle.*")).toEqual([BARE]);
    expect(affordView(stacked.textOf, BARE, "match", "cli", "oracle.*")).toEqual([BARE]);
    expect(affordView(viewOf(carrier(SEAT, "canon line")).textOf, SEAT, "match", "cli", "")).toEqual([SEAT]);
  });
});
