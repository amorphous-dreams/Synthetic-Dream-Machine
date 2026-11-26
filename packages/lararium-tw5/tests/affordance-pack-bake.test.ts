/**
 * affordance-pack-bake — the renderer in the wiki VM, measured: a vessel-less engine ingests an affordance carrier, the skin
 * templates render it on every surface at every depth, and the bake writes one content-addressed pack whose routes derive from
 * the carrier's own skins. The fixture carrier (`fixtures/affordance-oracle.ts`) stands in until the canon carrier lands.
 * RED-FIRST: written by smith#1, run by the familiar after `build:plugin` packs the templates and the `afford` operator.
 */
import { describe, expect, test } from "vitest";
import { bakeAffordancePack, canonicalJson } from "../scripts/build-affordance-pack.js";
import { affordFaceOf } from "../src/modules/afford-face.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { FIXTURE_ADDRESS, FIXTURE_LIMIT, FIXTURE_TITLE, oracleFixtureCarrier } from "./fixtures/affordance-oracle.js";

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
    expect(pack.routes["console"]).toEqual({ "oracle.cast.throws": FIXTURE_ADDRESS });
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
    expect(c.renders["mcp"]!["whole"]!.join("\n")).toContain("Refuses: query-unnamed.");
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
    const face = affordFaceOf(engine.wiki as never, { print: false, invoke: () => {} });
    const pack = await bakeAffordancePack([oracleFixtureCarrier()]);
    expect(face.whole("oracle.cast.throws")).toEqual(pack.carriers[FIXTURE_ADDRESS]!.renders["console"]!["whole"]);
    expect(face.slot("oracle.cast.throws", "refuses")).toEqual(pack.carriers[FIXTURE_ADDRESS]!.renders["console"]!["#/refuses"]);
    expect(face.list("oracle.*")).toEqual(["oracle.cast.throws"]);
    expect(() => face.list("*.cast.throws")).toThrow(/afford-wildcard-heading/);
    expect(face.run("oracle.cast.throws", { recipe: "default" })).toEqual({ invoked: `<$action-oracle-cast recipe="default"/>` });
  });

  test("RED 7: the tw5 view folds each slot and names the gate as testimony", async () => {
    const engine = await bootTestWiki();
    engine.ingestCarrier(FIXTURE_TITLE, oracleFixtureCarrier());
    const html = engine.wiki.renderTiddler("text/html", "lar:///ha.ka.ba/lararium/tw5/afford/view", { variables: { currentTiddler: FIXTURE_TITLE } });
    expect(html).toContain("<code>oracle.cast.throws</code>");
    expect(html).toContain("the door checks the ocap");
    for (const label of ["head", "shows", "takes", "gate", "refuses", "answers", "skins", "edges"]) expect(html).toContain(`▸ ${label}`);
  });
});
