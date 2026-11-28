/**
 * affordance-rows — the pure reading of an affordance carrier's rows, and the spellings every skin derives by rule
 * (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-loom #/slots). RED-FIRST: written by smith#1, run by the familiar.
 */
import { beforeAll, describe, expect, test } from "vitest";
import {
  addressMatcher, addressOfTitle, bodyOf, digestOf, edgesOf, exampleCall, kaheaTitles, neutralCallOf, parseHasRows, parseParams, proseOf, renderCall,
  seatsOf, sigilQuote, spellArg, tokenize, usageOf, unfoldRead, type HasRow, type NeutralCall,
} from "../src/affordance-rows.js";
import { affordView, carrierOf, carrierRootsIn, carrierViewOfText, routeOfCall, routesOf, seatTitleOf } from "../src/affordance-read.js";
import { callOfSigil, type MacroCallParse } from "../src/modules/call.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

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
    const call = neutralCallOf("library.oracle.speaks recipe/default asking/<words>", "lar:///x.y.z");
    expect(call.address).toBe("lar:///library.oracle.speaks");
    expect(renderCall("cli", "lares oracle cast", call)).toBe("lares oracle cast recipe=default asking=<words>");
    expect(renderCall("mcp", "oracle_cast", call)).toBe(`oracle_cast(recipe="default", asking="<words>")`);
    expect(renderCall("tw5", "action-oracle-cast", call)).toBe(`<$action-oracle-cast recipe="default" asking="<words>"/>`);
    expect(renderCall("console", "", call)).toBe(`$tw.lares.call("library.oracle.speaks", {"recipe": "default", "asking": "<words>"})`);
    // A carrier that skins a console spelling (a verb word) renders the call by that word.
    expect(renderCall("console", "get", { address: "lar:///engine.record.reads", args: [["title", "Room 4"]] })).toBe(`$tw.lares.call("get", {"title": "Room 4"})`);
    const example = parseHasRows("<<has entity=`example` name=`e` params=`recipe/default asking/[[which road first?]] fresh then/oracle.read.casts ~ x`>>")[0]!;
    expect(renderCall("cli", "lares oracle cast", exampleCall(example, "lar:///library.oracle.speaks"))).toBe("lares oracle cast recipe=default asking='which road first?' fresh=true");
  });

  test("RED 6: the usage spine groups a one-of choice and brackets every optional arg", () => {
    const rows = parseHasRows(TAKES);
    expect(usageOf("cli", "lares oracle cast", rows)).toBe("usage: lares oracle cast (recipe=<slug> | bag=<slug>) [asking=<words>] [fresh=true]");
    expect(usageOf("mcp", "oracle_cast", rows)).toBe("oracle_cast((recipe=<slug> | bag=<slug>), [asking=<words>], [fresh])");
  });

  test("RED: a cli skin row reading grammar/call speaks the call shape: name=value, a flag name=true, a spaced value shell-quoted, no position; its usage reads name=<kind>", () => {
    const called = (spells: string): HasRow => ({ entity: "skin", name: "cli", params: { spells, grammar: "call" }, bare: [], role: "" });
    expect(spellArg("cli", "max_bytes", called("[[lares get]]"))).toBe("max-bytes");
    expect(renderCall("cli", "lares get", { address: "lar:///engine.record.reads", args: [["title", "x"], ["aperture", "measure"]] }, called("[[lares get]]"))).toBe("lares get title=x aperture=measure");
    expect(renderCall("cli", "lares put", { address: "lar:///engine.record.puts", args: [["title", "Room 4"], ["create", true]] }, called("[[lares put]]"))).toBe("lares put 'title=Room 4' create=true");
    expect(usageOf("cli", "lares oracle cast", parseHasRows(TAKES), called("[[lares oracle cast]]"))).toBe("usage: lares oracle cast (recipe=<slug> | bag=<slug>) [asking=<words>] [fresh=<true>]");
    // A seat/N row rides by name under the call shape: no position.
    const seated = parseHasRows("<<has entity=`arg` name=`title` params=`takes/title seat/1 as/<title> ~ the record`>>");
    expect(usageOf("cli", "lares get", seated, called("[[lares get]]"))).toBe("usage: lares get [title=<title>]");
    expect(renderCall("cli", "lares get", { address: "lar:///engine.record.reads", args: [["title", "x"]] }, called("[[lares get]]"), seatsOf(seated))).toBe("lares get title=x");
    // CONTROL: a cli row with no grammar/call keeps its door's --flag table.
    expect(usageOf("cli", "lares oracle cast", parseHasRows(TAKES))).toBe("usage: lares oracle cast (recipe=<slug> | bag=<slug>) [asking=<words>] [fresh=true]");
  });

  test("RED 7: the unfold read speaks the read door's own words on each surface", () => {
    expect(unfoldRead("cli", "lar:///library.oracle.speaks", "#/refuses")).toBe("lares get title=lar:///library.oracle.speaks#/refuses recipe=lares aperture=arc");
    expect(unfoldRead("cli", "lar:///library.oracle.speaks")).toBe("lares get title=lar:///library.oracle.speaks recipe=lares aperture=measure");
    expect(unfoldRead("mcp", "lar:///library.oracle.speaks", "#/refuses")).toContain(`grain="slot", slot="#/refuses"`);
  });
});

describe("addresses and wildcards (DAM law 2)", () => {
  test("RED 8: t2/t3 wildcards match; a t1 wildcard refuses by name", () => {
    expect(addressMatcher("library.*")("lar:///library.oracle.speaks")).toBe(true);
    expect(addressMatcher("library.oracle.*")("library.oracle.speaks")).toBe(true);
    expect(addressMatcher("custody.hand.*")("library.oracle.speaks")).toBe(false);
    expect(() => addressMatcher("*.oracle.speaks")).toThrow(/afford-wildcard-heading/);
  });

  test("RED 9: the reader answers views over records, and an unknown view throws rather than reading empty", () => {
    const records: Record<string, string> = {
      "lar:///library.oracle.speaks#/takes": TAKES,
      "lar:///library.oracle.speaks#/skins/cli": "<<has entity=`skin` name=`cli` params=`spells/[[lares oracle cast]]`>>",
      "lar:///library.oracle.speaks#/head": "! library.oracle.speaks ~ cast the coins\n\nA line sums three coins.",
    };
    const textOf = (t: string): string | undefined => records[t];
    expect(affordView(textOf, "lar:///library.oracle.speaks", "spells", "cli", "")).toEqual(["lares oracle cast"]);
    expect(affordView(textOf, "lar:///library.oracle.speaks", "spells", "mcp", "")).toEqual([]);
    expect(JSON.parse(affordView(textOf, "lar:///library.oracle.speaks", "rows", "cli", "#/takes")[2]!)).toMatchObject({ name: "asking", spell: "--asking", value: "words" });
    expect(affordView(textOf, "lar:///library.oracle.speaks", "prose", "mcp", "#/head")).toEqual(["cast the coins", "A line sums three coins."]);
    expect(affordView(textOf, "lar:///library.oracle.speaks", "body", "mcp", "#/head")).toEqual(["A line sums three coins."]);
    expect(() => affordView(textOf, "lar:///library.oracle.speaks", "nope", "cli", "")).toThrow(/afford-view-unknown/);
  });
});

describe("the canon seat (weaver#1: canon seats no bare root)", () => {
  test("RED 10: a carrier's title carries its address, at the bare root or at the stable afford seat", () => {
    expect(addressOfTitle("lar:///library.oracle.speaks")).toBe("lar:///library.oracle.speaks");
    expect(addressOfTitle("lar:///ha.ka.ba/lares/afford/library.oracle.speaks")).toBe("lar:///library.oracle.speaks");
    expect(addressOfTitle("lar:///ha.ka.ba/lares/api/pono/affordance")).toBeNull();
  });

  test("RED 11: the canon kahea spelling resolves; `fresh/true` reads as a switch", () => {
    expect(kaheaTitles("<<~ kahea uri=`lar:///ha.ka.ba/lares/api/pono/affordance#/takes/container`>>"))
      .toEqual(["lar:///ha.ka.ba/lares/api/pono/affordance#/takes/container"]);
    const call = neutralCallOf("library.oracle.speaks fresh/true", "lar:///x.y.z");
    expect(renderCall("cli", "lares oracle cast", call)).toBe("lares oracle cast fresh=true");
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
    expect(renderCall("cli", "lares ddate", call, undefined, seatsOf(rows))).toBe("lares ddate '+%X' 5 1 json=true");
    expect(renderCall("mcp", "ddate", call)).toBe(`ddate(day=5, format="%X", month=1, json=True)`);
  });

  test("RED 2: the cli usage spine leads with the positionals in seat order, then the flags", () => {
    expect(usageOf("cli", "lares ddate", rows)).toBe("usage: lares ddate [+FORMAT] [<day> <month> <year>] [json=<true>]");
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
  const SEAT = "lar:///ha.ka.ba/lares/afford/library.oracle.speaks";
  const BARE = "lar:///library.oracle.speaks";
  const carrier = (title: string, role: string): Record<string, string> => ({
    [title]: "",
    [`${title}#/skins/cli`]: "<<has entity=`skin` name=`cli` params=`spells/[[lares oracle cast]]`>>",
    [`${title}#/head`]: `! library.oracle.speaks ~ ${role}\n\nA line sums three coins.`,
  });
  const viewOf = (records: Record<string, string>) => {
    const textOf = (t: string): string | undefined => records[t];
    return { textOf, carriers: carrierViewOfText(textOf) };
  };

  test("RED 1: the stable seat answers a bare root no record titles; every spelling of the address names the same carrier", () => {
    const { carriers } = viewOf(carrier(SEAT, "canon line"));
    expect(carrierOf(carriers, BARE)).toBe(SEAT);
    expect(carrierOf(carriers, "library.oracle.speaks")).toBe(SEAT);
    expect(carrierOf(carriers, SEAT)).toBe(SEAT);
    expect(seatTitleOf(BARE)).toBe(SEAT);
  });

  test("RED 2: a record titled with the bare root wins over the seat, whichever spelling asks", () => {
    const { carriers } = viewOf({ ...carrier(SEAT, "canon line"), ...carrier(BARE, "working line") });
    expect(carrierOf(carriers, BARE)).toBe(BARE);
    expect(carrierOf(carriers, SEAT)).toBe(BARE);
  });

  test("RED 3: a mesh seat answers where the house seat stands empty; a tagged carrier answers past both; nothing answers null", () => {
    const mesh = "lar:///ha.ka.ba/lararium/afford/library.oracle.speaks";
    expect(carrierOf(viewOf(carrier(mesh, "mesh line")).carriers, BARE)).toBe(mesh);
    const other = "lar:///ha.ka.ba/elsewhere/afford/library.oracle.speaks";
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
    expect(affordView(stacked.textOf, SEAT, "match", "cli", "library.*")).toEqual([BARE]);
    expect(affordView(stacked.textOf, BARE, "match", "cli", "library.*")).toEqual([BARE]);
    expect(affordView(viewOf(carrier(SEAT, "canon line")).textOf, SEAT, "match", "cli", "")).toEqual([SEAT]);
  });
});

describe("routes read the live stack (`routesOf`)", () => {
  const SEAT = "lar:///ha.ka.ba/lares/afford/library.oracle.speaks";
  const BARE = "lar:///library.oracle.speaks";
  const skinned = (title: string, cli: string, mcp = "oracle_cast"): Record<string, string> => ({
    [title]: "",
    [`${title}#/skins/cli`]: `<<has entity=\`skin\` name=\`cli\` params=\`spells/[[${cli}]]\`>>`,
    [`${title}#/skins/mcp`]: `<<has entity=\`skin\` name=\`mcp\` params=\`spells/${mcp}\`>>`,
  });
  const routed = (records: Record<string, string>) => routesOf((t) => records[t], Object.keys(records));

  test("RED 1: canon's seat routes its spellings per surface, the console its bare key", () => {
    const r = routed(skinned(SEAT, "lares oracle cast"));
    expect(r.routes.cli).toEqual({ "oracle cast": BARE });
    expect(r.routes.mcp).toEqual({ oracle_cast: BARE });
    expect(r.routes.console).toEqual({ "library.oracle.speaks": BARE });
    expect(r.carriers).toEqual({ [BARE]: SEAT });
    expect(r.twice).toEqual([]);
  });

  test("RED 2: a working-layer `skin` row moves a route: a bare-root carrier above the seat answers, and canon's spelling routes no more", () => {
    const r = routed({ ...skinned(SEAT, "lares oracle cast"), ...skinned(BARE, "lares lantern lit", "lantern_lit") });
    expect(r.routes.cli).toEqual({ "lantern lit": BARE });
    expect(r.routes.mcp).toEqual({ lantern_lit: BARE });
    expect(r.carriers[BARE]).toBe(BARE);
    // The seat re-shaped in a working layer (the topmost layer's text answers the seat title) moves the route alike.
    const atSeat = routed(skinned(SEAT, "lares oracle consult"));
    expect(atSeat.routes.cli).toEqual({ "oracle consult": BARE });
  });

  test("RED 3: a bare-root carrier with no type tag routes by its skins alone; a skinless alias record routes nothing", () => {
    const spirit = "lar:///lantern.wick.trims";
    expect(carrierRootsIn([`${spirit}#/skins/cli`, `${spirit}#/head`])).toEqual([spirit]);
    const skin = "<<has entity=`skin` name=`cli` params=`spells/[[lares wick trim]]`>>";
    const r = routesOf((t) => (t === `${spirit}#/skins/cli` ? skin : undefined), [`${spirit}#/skins/cli`], { has: (t) => t === spirit });
    expect(r.routes.cli).toEqual({ "wick trim": spirit });
    const alias = routed({ "lar:///ha.ka.ba/lares/afford/lantern.wick.lit": "forwards" });
    expect(alias.routes.console).toEqual({});
  });

  test("RED 4: `also/` routes beside the own spelling, `door/part` names its spelling, and two addresses on one spelling land in `twice`", () => {
    const other = "lar:///ha.ka.ba/lares/afford/oracle.calendar.dates";
    const records: Record<string, string> = {
      [SEAT]: "",
      [`${SEAT}#/skins/cli`]: "<<has entity=`skin` name=`cli` params=`spells/[[lares oracle cast]] also/[[lares oracle throw]] door/part`>>",
      [other]: "",
      [`${other}#/skins/cli`]: "<<has entity=`skin` name=`cli` params=`spells/[[lares oracle throw]]`>>",
    };
    const r = routed(records);
    expect(r.own[BARE]).toBe("oracle cast");
    expect(r.part).toEqual(["oracle cast"]);
    expect(r.routes.cli["oracle cast"]).toBe(BARE);
    // First claim wins in sorted-address order: `library.oracle.speaks` sorts before `oracle.calendar.dates`.
    expect(r.routes.cli["oracle throw"]).toBe(BARE);
    expect(r.twice).toEqual([{ surface: "cli", spelling: "oracle throw", addresses: [BARE, "lar:///oracle.calendar.dates"] }]);
  });
});

describe("one verb word, two addresses: a `by/` skin row chooses (comms-ux-enacts fork 2, landing 4)", () => {
  const READS = "lar:///ha.ka.ba/lares/afford/engine.record.reads";
  const PAGES = "lar:///ha.ka.ba/lares/afford/engine.filter.pages";
  const records: Record<string, string> = {
    [READS]: "",
    [`${READS}#/skins/console`]: "<<has entity=`skin` name=`console` params=`spells/get by/title default/true`>>",
    [`${READS}#/skins/cli`]: "<<has entity=`skin` name=`cli` params=`spells/[[lares get]] by/title default/true grammar/call`>>",
    [PAGES]: "",
    [`${PAGES}#/skins/console`]: "<<has entity=`skin` name=`console` params=`spells/get by/filter`>>",
    [`${PAGES}#/skins/cli`]: "<<has entity=`skin` name=`cli` params=`spells/[[lares get]] by/filter grammar/call`>>",
  };
  const r = routesOf((t) => records[t], Object.keys(records));

  test("RED: the shared word claims no route and lands in no twice; each carrier joins the word's choices by its param", () => {
    expect(r.routes.console["get"]).toBeUndefined();
    expect(r.twice).toEqual([]);
    expect(r.chosen.console["get"]).toEqual([{ address: "lar:///engine.filter.pages", by: "filter" }, { address: "lar:///engine.record.reads", by: "title", default: true }]);
    // The terminal's `lares get` joins the same choices: it claims no cli route of its own.
    expect(r.routes.cli["get"]).toBeUndefined();
    expect(r.chosen.cli["get"]).toEqual([{ address: "lar:///engine.filter.pages", by: "filter" }, { address: "lar:///engine.record.reads", by: "title", default: true }]);
  });

  test("RED: a call's leading word routes by the param it names; an address stands for itself; a skin spelling routes too", () => {
    expect(routeOfCall(r, "get", { title: "Room 4" })).toEqual({ address: "lar:///engine.record.reads" });
    expect(routeOfCall(r, "get", { filter: "[tag[x]]" })).toEqual({ address: "lar:///engine.filter.pages" });
    expect(routeOfCall(r, "lar:///engine.filter.pages", {})).toEqual({ address: "lar:///engine.filter.pages" });
    expect(routeOfCall(r, "engine.record.reads", {})).toEqual({ address: "lar:///engine.record.reads" });
    // CONTROL: a word nothing spells reaches nothing; a shared word naming both params hands back the choices.
    expect(routeOfCall(r, "fetch", {})).toBeNull();
    expect(routeOfCall(r, "tiddler get", { title: "x" })).toBeNull();
    expect(routeOfCall(r, "get", { title: "a", filter: "b" })).toMatchObject({ address: null });
  });

  test("RED: a call naming no choice takes the one row reading `default/true`; two such rows leave the word ambiguous", () => {
    expect(routeOfCall(r, "get", {})).toEqual({ address: "lar:///engine.record.reads" });
    expect(routeOfCall(r, "get", { meme: true })).toEqual({ address: "lar:///engine.record.reads" });
    const twice = routesOf((t) => ({ ...records, [`${PAGES}#/skins/console`]: "<<has entity=`skin` name=`console` params=`spells/get by/filter default/true`>>" })[t], Object.keys(records));
    expect(routeOfCall(twice, "get", {})).toMatchObject({ address: null, choices: expect.arrayContaining([expect.objectContaining({ by: "filter", default: true }), expect.objectContaining({ by: "title", default: true })]) });
    // CONTROL: a named choice still wins over the default rows.
    expect(routeOfCall(twice, "get", { filter: "[tag[x]]" })).toEqual({ address: "lar:///engine.filter.pages" });
    // With no default row at all, a call naming neither stays ambiguous.
    const none = routesOf((t) => ({ ...records, [`${READS}#/skins/console`]: "<<has entity=`skin` name=`console` params=`spells/get by/title`>>", [`${READS}#/skins/cli`]: "<<has entity=`skin` name=`cli` params=`spells/[[lares get]] by/title grammar/call`>>" })[t], Object.keys(records));
    expect(routeOfCall(none, "get", {})).toMatchObject({ address: null });
  });
});

// ── a sigil goes in, a sigil comes out (comms-ux-enacts landing 5) ──────────────────────────────────

describe.skipIf(wikiSkip)(`the call sigil: rendered by renderCall, read back by TiddlyWiki's own macro-call parser${skipNote}`, () => {
  let parse: MacroCallParse;
  let engine: TW5Engine;
  beforeAll(async () => {
    engine = await bootTestWiki();
    const utils = (engine.$tw as unknown as { utils: { parseMacroInvocationAsTransclusion: MacroCallParse } }).utils;
    parse = utils.parseMacroInvocationAsTransclusion.bind(utils);
  }, 60_000);
  /** What a neutral call reads back as: its word and its params, a switch `true`. */
  const asRead = (word: string, call: NeutralCall) => ({ word, params: Object.fromEntries(call.args) });

  test("RED: one neutral call renders as a call sigil in the house's value grammar, a switch as a bare word, an address bare", () => {
    expect(renderCall("sigil", "get", { address: "lar:///engine.record.reads", args: [["title", "Room 4"]] })).toBe("<<~ get title=`Room 4`>>");
    const call = neutralCallOf("library.oracle.speaks recipe/default asking/<words> fresh", "lar:///x.y.z");
    expect(renderCall("sigil", "", call)).toBe("<<~ library.oracle.speaks recipe=`default` asking=`<words>` fresh>>");
    // A word the parser would split (an address with its scheme, a spelling with a space) rides a string literal.
    expect(renderCall("sigil", "lar:///library.oracle.speaks", { address: "", args: [] })).toBe(`<<~ "lar:///library.oracle.speaks">>`);
    expect(renderCall("sigil", "oracle cast", { address: "", args: [] })).toBe(`<<~ "oracle cast">>`);
  });

  test("RED: parse of render returns the call, for a backtick, a single quote, both quotes, and the seed's own ${copula} mock", () => {
    const values = [
      "plain words",
      "it's `odd` here",
      "`leads` with a tick",
      "ends with a tick`",
      "`a` 'b' \"c\"",
      "say \"hi\"",
      "the seed's own ${copula} mock",
      "a ``` triple inside",
      "",
    ];
    for (const value of values) {
      const call: NeutralCall = { address: "", args: [["title", value], ["fresh", true]] };
      const sigil = renderCall("sigil", "get", call);
      expect(callOfSigil(sigil, parse), sigil).toEqual(asRead("get", call));
    }
    // A cure's word may name an address: the string literal keeps its scheme, and so does the bare scheme the parser splits.
    expect(callOfSigil(renderCall("sigil", "lar:///library.oracle.speaks", { address: "", args: [["asking", "which road?"]] }), parse)).toEqual({ word: "lar:///library.oracle.speaks", params: { asking: "which road?" } });
    expect(callOfSigil("<<~ lar:///library.oracle.speaks asking=`x`>>", parse)).toEqual({ word: "lar:///library.oracle.speaks", params: { asking: "x" } });
    expect(callOfSigil("<<~get title=```it's `odd` ok```>>", parse)).toEqual({ word: "get", params: { title: "it's `odd` ok" } });
  });

  test("RED: THE TRIPLE-QUOTE SUBSTITUTION LAW: a value holding $(…)$ or ${…}$ rides the triple quote, which no engine substitutes", () => {
    expect(sigilQuote("$(who)$ greets")).toBe(`"""$(who)$ greets"""`);
    expect(sigilQuote("a ${ [[x]] }$ filter")).toBe(`"""a ${"${ [[x]] }$"} filter"""`);
    expect(sigilQuote("the seed's own ${copula} mock")).toBe("`the seed's own ${copula} mock`");   // no closing `}$`: no substitution
    expect(sigilQuote(`$(who)$ said "hi"`)).toBe(`'$(who)$ said "hi"'`);   // a value ending on a quote falls to the next literal
    for (const value of ["$(who)$ greets", "a ${ [[x]] }$ filter", `$(who)$ said "hi"`]) {
      expect(callOfSigil(renderCall("sigil", "put", { address: "", args: [["text", value]] }), parse)).toEqual({ word: "put", params: { text: value } });
    }
    // WHY: where the engine runs the value (a glass button's attribute), the tick substitutes and the triple quote keeps its bytes.
    const glass = (attr: string): string => engine.wiki.renderText("text/plain", "text/vnd.tiddlywiki", `<$let who="Aloha"><$text text=${attr}/></$let>`).trim();
    expect(glass("`$(who)$ greets`")).toBe("Aloha greets");
    expect(glass(sigilQuote("$(who)$ greets"))).toBe("$(who)$ greets");
  });

  test("RED: a malformed sigil refuses sigil-malformed in the parser's own measure; a value typed for a render names its cure", () => {
    expect(() => callOfSigil("<<~ get title=`x`", parse)).toThrow(/sigil-malformed: TiddlyWiki's macro-call parser .* reads no call/);
    expect(() => callOfSigil("<<~ get title=`x`>> and more", parse)).toThrow(/sigil-malformed: .*ending at offset 19; " and more" stays unread/);
    expect(() => callOfSigil("<<~>>", parse)).toThrow(/sigil-malformed: .*names no verb/);
    expect(() => callOfSigil("<<~ get title={{Room 4}}>>", parse)).toThrow(/sigil-malformed: .*title \(indirect\).*cure: <<~ get title=`\{\{Room 4\}\}`>>/);
    expect(() => callOfSigil("<<~ get title=`x`>>", undefined)).toThrow(/sigil-malformed: no TiddlyWiki engine stands here/);
  });
});
