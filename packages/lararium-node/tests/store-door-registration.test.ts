/**
 * store-door-registration — the store door's reactors join the main-thread verb table by name. The panel owns the island route of FOUR
 * shared promote verbs; the door's own reactor of those names serves its socket and CLI road alone. Any other duplicate still throws.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { PROMOTE_PANEL_OWNED_ROWS } from "@lararium/mesh";
import { VerbTable } from "@lararium/tw5";
import { registerStoreDoorReactors } from "../src/store-door-registry.js";

const reactor = (tag: string) => async () => ({ tag });

describe("registering the store door's reactors", () => {
  test("RED: the owned set is exactly the four shared promote verbs; CONTROL: promote-orphan and the prepare, flag and list rows are not in it", () => {
    expect([...PROMOTE_PANEL_OWNED_ROWS].sort()).toEqual(["kapae-lower", "kapae-raise", "promote-commit", "promote-drop"]);
    for (const open of ["promote-orphan", "promote-prepare", "kapae-flag", "promote-list"]) expect(PROMOTE_PANEL_OWNED_ROWS.has(open), open).toBe(false);
  });

  test("RED: an owned name keeps the panel's handler on the island route while the door's own reactor stays on the door; CONTROL: every other row registers", async () => {
    const registry = new VerbTable();
    for (const name of PROMOTE_PANEL_OWNED_ROWS) registry.register(name, reactor(`panel:${name}`));
    const doors = { "promote-commit": reactor("door:commit"), "kapae-raise": reactor("door:raise"), "promote-orphan": reactor("door:orphan"), "intent-show": reactor("door:intent") };
    registerStoreDoorReactors(registry, doors);
    const run = (name: string) => (registry.get(name) as unknown as (a: Record<string, unknown>, c: unknown) => Promise<{ tag: string }>)({}, {});
    expect((await run("promote-commit")).tag).toBe("panel:promote-commit");
    expect((await run("kapae-raise")).tag).toBe("panel:kapae-raise");
    expect((await run("promote-orphan")).tag).toBe("door:orphan");
    expect((await run("intent-show")).tag).toBe("door:intent");
    expect((await doors["promote-commit"]!()).tag).toBe("door:commit");
  });

  test("RED: a duplicate outside the owned set still throws `duplicate handler`; CONTROL: the same name with nothing else registered passes", () => {
    const registry = new VerbTable();
    registry.register("intent-show", reactor("early"));
    expect(() => registerStoreDoorReactors(registry, { "intent-show": reactor("door") })).toThrow(/duplicate handler for "intent-show"/);
    expect(() => registerStoreDoorReactors(new VerbTable(), { "intent-show": reactor("door") })).not.toThrow();
  });
});
