/**
 * affordance-pack-bake — the renderer in the wiki VM, measured: a vessel-less engine ingests an affordance carrier, the skin
 * templates render it on every surface at every depth, and the bake writes one content-addressed pack whose routes derive from
 * the carrier's own skins. The fixture carrier (`fixtures/affordance-oracle.ts`) stands in until the canon carrier lands.
 * RED-FIRST: written by smith#1, run by the familiar after `build:plugin` packs the templates and the `afford` operator.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { bakeAffordancePack, briefOf, canonTexts, canonicalJson } from "../scripts/build-affordance-pack.js";
import { affordFaceOf } from "../src/modules/afford-face.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { FIXTURE_ADDRESS, FIXTURE_LIMIT, FIXTURE_TITLE, oracleFixtureCarrier } from "./fixtures/affordance-oracle.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe.skipIf(wikiSkip)(`the affordance bake over the fixture carrier${skipNote}`, () => {
  test("RED 1: the carrier bakes; the cli whole leads with the derived usage spine and carries the head, examples, flags and cures", async () => {
    const pack = await bakeAffordancePack([oracleFixtureCarrier()]);
    const carrier = pack.carriers[FIXTURE_ADDRESS];
    expect(carrier).toBeDefined();
    const whole = carrier!.renders["cli"]!["whole"]!.join("\n");
    expect(carrier!.renders["cli"]!["whole"]![0]).toBe("usage: lares oracle cast (--recipe <slug> | --bag <slug>) [--asking <words>] [--fresh] [--seed <words>] [--coins <values>] [--caster <name>]");
    expect(whole).toContain("lares oracle cast — Cast the I Ching by three coins; the cast lands as a tiddler.");
    expect(whole).toContain(FIXTURE_LIMIT);
    expect(whole).toContain("guess");
    expect(whole).toContain("  lares oracle cast --recipe default --asking 'which road first?'    # a seat's cast at its own open fork");
    expect(whole).toContain("    cure: lares oracle cast --recipe default --asking <words>");
    expect(whole).toContain("  replayed (exit 0)  the cast already standing answers");
    expect(whole).toContain("Gate (the carrier's testimony; the door checks):");
    expect(whole).toContain("  lar:///ha.ka.ba/lares/api/pono/oracle-loop");
    expect(whole).toContain("  lares oracle cast --recipe default --asking 'which road first?' --fresh    # a person asks the same words anew");
    expect(whole).toContain("    cure: tiddler.get.reads --title <cast>");
    expect(whole).not.toContain("--at");   // `at` skins mcp, tw5 and console alone: the cli reads the time once
    expect(whole).toContain(`lares tiddler get ${FIXTURE_TITLE} --recipe lares --meme --skinny`);
    expect(carrier!.title).toBe(FIXTURE_TITLE);
    expect(carrier!.calls["cli"]).not.toContain("tiddler.get.reads --title <cast>");   // a foreign cure is no call this door parses
  });

  test("RED 2: the routes derive from the carrier's skins, and the oracle door reads the carrier's whole", async () => {
    const pack = await bakeAffordancePack([oracleFixtureCarrier()]);
    expect(pack.routes["cli"]).toEqual({ "oracle cast": FIXTURE_ADDRESS });
    expect(pack.routes["mcp"]).toEqual({ oracle_cast: FIXTURE_ADDRESS });
    expect(pack.routes["tw5"]).toEqual({ "action-oracle-cast": FIXTURE_ADDRESS });
    expect(pack.routes["console"]).toEqual({ "library.oracle.speaks": FIXTURE_ADDRESS });
    expect(pack.doors["oracle"]!.addresses).toEqual([FIXTURE_ADDRESS]);
    expect(pack.doors["oracle"]!.help).toEqual(pack.carriers[FIXTURE_ADDRESS]!.renders["cli"]!["whole"]);
    expect(pack.doors["oracle"]!.brief).toBe("Cast the I Ching by three coins; the cast lands as a tiddler.");
    expect(pack.index["cli"]).toEqual(["  lares oracle cast  Cast the I Ching by three coins; the cast lands as a tiddler."]);
  });

  test("RED 3 (W7): every surface's line carries the carrier's one line; skins add framing, never words", async () => {
    const pack = await bakeAffordancePack([oracleFixtureCarrier()]);
    const c = pack.carriers[FIXTURE_ADDRESS]!;
    for (const surface of ["cli", "mcp", "tw5", "console"]) expect(c.renders[surface]!["line"]!.join("\n").toLowerCase()).toContain(c.role.toLowerCase());
    expect(c.renders["mcp"]!["whole"]![0]).toBe(c.role);
    // The mcp whole names the role once: its line leads, and the head's tagline (the role restated) rides no second line.
    const said = c.renders["mcp"]!["whole"]!.join("\n").toLowerCase().split(c.role.toLowerCase()).length - 1;
    expect(said).toBe(1);
    expect(c.renders["mcp"]!["whole"]!.join("\n")).toContain("A line sums three coins");   // the head's body still rides
    expect(c.renders["mcp"]!["whole"]!.join("\n")).toContain("Refuses: query-unnamed · record-torn.");   // the skin names every refusal row, the foreign cure's too
    expect(c.params["asking"]).toBe("the question, named before the throw");
    expect(Object.keys(c.params).sort()).toEqual(["asking", "at", "bag", "caster", "coins", "recipe"]);   // the mcp skin omits fresh, seed
    expect(c.takes["cli"]).toEqual(["--recipe", "--bag", "--asking", "--fresh", "--seed", "--coins", "--caster"]);
    expect(c.params["coins"]).toBe("six line values, bottom first (a person's hand alone; a seat reads asks)");
    expect(c.renders["tw5"]!["#/shows"]!.join("\n")).toContain(`<$action-oracle-cast recipe="default" coins="7,8,9,6,7,7"/>`);
  });

  test("RED 4 (W3 seam): one input bakes one byte string, and the hash moves with any carrier byte", async () => {
    const a = canonicalJson(await bakeAffordancePack([oracleFixtureCarrier()]));
    const b = canonicalJson(await bakeAffordancePack([oracleFixtureCarrier()]));
    expect(a).toBe(b);
    const moved = await bakeAffordancePack([oracleFixtureCarrier().replace("who cast", "who threw")]);
    expect(JSON.parse(a).hash).not.toBe(moved.hash);
    expect(moved.carriers[FIXTURE_ADDRESS]!.bcc).not.toBe(JSON.parse(a).carriers[FIXTURE_ADDRESS].bcc);
  });

  test("RED 5: no carrier, an empty pack (a door falls to its legacy help, never a throw)", async () => {
    const pack = await bakeAffordancePack([]);
    expect(pack.carriers).toEqual({});
    expect(pack.doors).toEqual({});
  });

  test("RED 6: the console face renders the bytes the bake baked, from the same templates", async () => {
    const engine = await bootTestWiki();
    engine.ingestCarrier(FIXTURE_TITLE, oracleFixtureCarrier());
    const face = affordFaceOf(engine.wiki as never, { print: false });
    const pack = await bakeAffordancePack([oracleFixtureCarrier()]);
    expect(face.whole("library.oracle.speaks")).toEqual(pack.carriers[FIXTURE_ADDRESS]!.renders["console"]!["whole"]);
    expect(face.slot("library.oracle.speaks", "refuses")).toEqual(pack.carriers[FIXTURE_ADDRESS]!.renders["console"]!["#/refuses"]);
    expect(face.list("library.*")).toEqual(["library.oracle.speaks"]);
    expect(() => face.list("*.oracle.speaks")).toThrow(/afford-wildcard-heading/);
    // The face reads the live stack's routes (landing 4 burned `run`: a call rides `$tw.lares.call`).
    expect(face.routes().routes["console"]["library.oracle.speaks"]).toBe(FIXTURE_ADDRESS);
    expect(face.routes().routes["tw5"]["action-oracle-cast"]).toBe(FIXTURE_ADDRESS);
    expect("run" in face).toBe(false);
  });

  test("RED 7: the tw5 view folds each slot and names the gate as testimony", async () => {
    const engine = await bootTestWiki();
    engine.ingestCarrier(FIXTURE_TITLE, oracleFixtureCarrier());
    const html = engine.wiki.renderTiddler("text/html", "lar:///ha.ka.ba/lararium/tw5/afford/view", { variables: { currentTiddler: FIXTURE_TITLE } });
    expect(html).toContain("<code>library.oracle.speaks</code>");
    expect(html).toContain("the door checks the ocap");
    for (const label of ["head", "shows", "takes", "gate", "refuses", "answers", "skins", "edges"]) expect(html).toContain(`▸ ${label}`);
  });

  test("RED 9: a `door/part` skin routes its spelling and gathers no door entry; its own whole still bakes", async () => {
    const text = oracleFixtureCarrier().replace("spells/[[lares oracle cast]]", "spells/[[lares oracle cast]] door/part");
    const pack = await bakeAffordancePack([text]);
    expect(pack.routes["cli"]).toEqual({ "oracle cast": FIXTURE_ADDRESS });
    expect(pack.doors).toEqual({});
    expect(pack.carriers[FIXTURE_ADDRESS]!.renders["cli"]!["whole"]![0]).toMatch(/^usage: lares oracle cast /);
  });

  test("RED 8: a skin row's `also` spellings route to the one address, and a door of several addresses lists them by name", async () => {
    const text = oracleFixtureCarrier().replace("spells/[[lares oracle cast]]", "spells/[[lares oracle cast]] also/[[lares oracle throw]]");
    const pack = await bakeAffordancePack([text]);
    expect(pack.routes["cli"]).toEqual({ "oracle cast": FIXTURE_ADDRESS, "oracle throw": FIXTURE_ADDRESS });
    expect(pack.doors["oracle"]!.addresses).toEqual([FIXTURE_ADDRESS]);   // two spellings, one address, one door entry
    expect(briefOf("oracle", ["cast a throw", "read a cast"], ["oracle cast", "oracle read"])).toBe("cast a throw · read a cast");
    const roles = ["x".repeat(40), "y".repeat(40)];
    expect(briefOf("shore", roles, ["shore flush", "shore list", "shore log"])).toBe("flush · list · log");   // the joined roles overrun the list's line: the door names its verbs
    // Progressive display retires the screen budget: the joined roles hold the carrier's width law (a role, 72 or fewer), and
    // past it the door's one line names every verb whole, never cut to a terminal's columns; `lares shore --help` unfolds the rest.
    expect(briefOf("oracle", ["x".repeat(35), "y".repeat(34)], ["oracle cast", "oracle read"])).toBe(`${"x".repeat(35)} · ${"y".repeat(34)}`);
    expect(briefOf("oracle", ["x".repeat(35), "y".repeat(35)], ["oracle cast", "oracle read"])).toBe("cast · read");
    const many = Array.from({ length: 30 }, (_, i) => `shore verb-${i}`);
    const brief = briefOf("shore", roles, many);
    expect(brief).not.toContain("…");
    expect(brief.split(" · ")).toHaveLength(30);
  });
});

/** The core verbs' carriers (comms-ux-enacts landing 1; candidate addresses) and the spellings each skin routes to them. */
const CORE_ROUTES: ReadonlyArray<readonly [string, string, string | null]> = [
  ["lar:///engine.record.reads", "tiddler get", "tiddler_get"],
  ["lar:///engine.record.puts", "tiddler put", "tiddler_put"],
  ["lar:///engine.record.removes", "tiddler delete", "tiddler_delete"],
  ["lar:///engine.record.renames", "tiddler rename", null],
  ["lar:///engine.filter.pages", "wiki filter", "wiki_filter"],
];

describe.skipIf(wikiSkip)(`the core verbs bake from canon${skipNote}`, () => {
  test("RED 10: the five canon carriers bake, each routed from its cli and mcp spelling; the tiddler door gathers four, the wiki door none", async () => {
    const pack = await bakeAffordancePack(canonTexts(path.join(REPO, "bags")));
    for (const [address, cli, mcp] of CORE_ROUTES) {
      expect(pack.carriers[address], address).toBeDefined();
      expect(pack.routes["cli"]![cli]).toBe(address);
      if (mcp !== null) expect(pack.routes["mcp"]![mcp]).toBe(address);
      expect(pack.carriers[address]!.renders["cli"]!["whole"]![0]).toMatch(new RegExp(`^usage: lares ${cli} `));
    }
    expect(pack.routes["mcp"]!["tiddler_rename"]).toBeUndefined();
    expect([...pack.doors["tiddler"]!.addresses].sort()).toEqual(CORE_ROUTES.slice(0, 4).map(([a]) => a).sort());
    expect(pack.doors["wiki"]).toBeUndefined();
    // The persona hearing rides the filter's examples: a literal search beside the line lens.
    expect(pack.carriers["lar:///engine.filter.pages"]!.calls["cli"]).toContain("lares wiki filter '[all[tiddlers]search:text:literal[Lares (Stranger)]]' --match 'Lares (Stranger)' --recipe default");
    // The seat's spellings break the rule by the skin's maps alone: the put's tags, cut and replacement words.
    expect(Object.keys(pack.carriers["lar:///engine.record.puts"]!.params).sort()).toEqual(
      ["append", "bag", "base", "create", "cut", "fields", "recipe", "replace", "replace_with", "slot", "tags_add", "tags_remove", "text", "title", "unset"]);
  }, 60_000);   // a whole-canon bake boots a wiki and renders every carrier: a loaded floor slot runs it past the 5 s default
});
