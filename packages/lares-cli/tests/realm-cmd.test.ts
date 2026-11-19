/**
 * realm-cmd — `lares realm`: a realm's pet name decides where its wikis rest (operator rulings 2026-11-19: "The filepath for
 * realms should include their 'pet-name' to match faces."; every realm carries a pet name, so nothing waits). Local alone: the
 * label rests at `projections/realm-labels/<pet>.json`, never in a share row.
 *
 *   RC1 `realm name <pet>` names a realm; `realm add <pet> <slug>` places a wiki, recording the canon realm id the vessel's
 *       workbench ledger binds; `realm list` reads both back; a second naming says already
 *   RC2 refusals by name: a bad pet name, a face's pet name, an unnamed realm, a stray word; `add` into another realm regroups
 *   RC3 THE RENAME MOVE: `realm name <new> --realm <cur>` moves `realms/<cur>/` to `realms/<new>/` at once while no vessel
 *       answers; while one does, the label moves and the folder waits for the vessel's next lock or re-stand, and the line says so
 *   RC4 `wiki init <slug> --realm <pet>` places the wiki into an existing realm before the mint (an unnamed realm refuses before
 *       anything mints); with no `--realm` the wiki takes its own realm under its slug
 *   RC5 the help: `realm` stands in the table with its accepts row, and the top-level list keeps its 66-line ceiling
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRealmLabels, writeFaceLabel } from "@lararium/node";
import { cmdRealm, ensureWikiRealm, placeWikiInRealm, type RealmDoors } from "../src/commands/realm.js";
import { COMMANDS, dispatch } from "../src/bin/lares.js";
import { COMMAND_HELP } from "../src/command-help.js";
import type { ParsedArgs } from "../src/parse-args.js";

const ID = "ab".repeat(32);
let p: string;
let said: string[];
let live: boolean;
let doors: RealmDoors;
beforeEach(() => {
  p = mkdtempSync(join(tmpdir(), "lar-realm-cmd-"));
  said = []; live = false;
  doors = {
    projections: () => p,
    seat: async (slug) => (live ? { answered: true, realms: slug === "notes" ? [ID] : [] } : { answered: false, realms: [] }),
    out: (l) => { said.push(l); },
    err: (l) => { said.push(l); },
  };
});
afterEach(() => { rmSync(p, { recursive: true, force: true }); vi.restoreAllMocks(); });

const args = (positional: string[], options: Record<string, string> = {}): ParsedArgs => ({ command: "realm", positional, options, flags: { json: false } });
const run = (positional: string[], options: Record<string, string> = {}): Promise<number> => cmdRealm(args(positional, options), doors);

describe("lares realm", () => {
  test("RC1 names, places, lists, and a second naming says already", async () => {
    expect(await run(["name", "Garden"])).toBe(0);
    live = true;
    expect(await run(["add", "Garden", "notes"])).toBe(0);
    expect(readRealmLabels(p)).toEqual([{ schema: "lar-realm-label", petName: "Garden", realms: [{ slug: "notes", id: ID }], bags: ["notes"] }]);
    said = [];
    expect(await run(["list"])).toBe(0);
    expect(said.join("\n")).toContain("Garden");
    expect(said.join("\n")).toContain(join(p, "realms", "Garden", "wikis", "notes"));
    expect(said.join("\n")).toContain(ID.slice(0, 12));
    said = [];
    expect(await run(["name", "Garden"])).toBe(0);
    expect(said.join("\n")).toMatch(/already/);
  });

  test("RC2 refuses by name", async () => {
    writeFaceLabel({ relation: "00000000-0000-4000-8000-000000000001", petname: "Heron", handleIndex: 0 }, p);
    expect(await run(["name", "a/b"])).toBe(1);
    expect(said.join("\n")).toMatch(/realm-name-separator/);
    expect(await run(["name", "heron"])).toBe(1);
    expect(said.join("\n")).toMatch(/realm-name-face/);
    expect(await run(["add", "Nowhere", "notes"])).toBe(1);
    expect(said.join("\n")).toMatch(/realm-unnamed/);
    await run(["name", "Garden"]); await run(["name", "Forge"]);
    await run(["add", "Garden", "notes"]);
    expect(await run(["add", "Forge", "notes"]), "add into another realm regroups").toBe(0);
    expect(readRealmLabels(p).find((l) => l.petName === "Forge")!.realms.map((r) => r.slug)).toEqual(["notes"]);
    expect(await run(["name"])).toBe(2);
    expect(await run(["list", "stray"])).toBe(2);
  });

  test("RC3 a rename moves the folder at once while no vessel answers, and at the vessel's next quiet point while one does", async () => {
    await run(["name", "Garden"]);
    await run(["add", "Garden", "notes"]);
    mkdirSync(join(p, "realms", "Garden", "wikis", "notes", ".git"), { recursive: true });
    live = true;
    expect(await run(["name", "Orchard"], { realm: "Garden" })).toBe(0);
    expect(said.join("\n")).toMatch(/moves at the vessel's next lock or re-stand/);
    expect(readRealmLabels(p).map((l) => l.petName)).toEqual(["Orchard"]);
    expect(existsSync(join(p, "realms", "Garden", "wikis", "notes")), "never half-moved: it stands whole where it stood").toBe(true);
    live = false;
    said = [];
    expect(await run(["name", "Grove"], { realm: "Orchard" })).toBe(0);
    expect(said.join("\n")).toContain(`moved ${join(p, "realms", "Garden", "wikis", "notes")} -> ${join(p, "realms", "Grove", "wikis", "notes")}`);
    expect(existsSync(join(p, "realms", "Grove", "wikis", "notes", ".git"))).toBe(true);
    expect(existsSync(join(p, "realms", "Garden"))).toBe(false);
  });

  test("RC4 a wiki placed at init lays under the realm; an unnamed realm refuses before the mint", async () => {
    await run(["name", "Garden"]);
    expect((await placeWikiInRealm(doors, "works", "Garden")).petName).toBe("Garden");
    expect(readRealmLabels(p)[0]!.realms).toEqual([{ slug: "works", id: null }]);
    await expect(placeWikiInRealm(doors, "works", "Elsewhere")).rejects.toThrow(/realm-unnamed/);
    expect(readFileSync(join(p, "realm-labels", "Garden.json"), "utf8")).toContain("works");
    // No `--realm`: the wiki takes its own realm under its slug, with the realm id the vessel binds.
    live = true;
    const own = await ensureWikiRealm(doors, "notes");
    expect(own.label).toEqual({ schema: "lar-realm-label", petName: "notes", realms: [{ slug: "notes", id: ID }], bags: ["notes"] });
  });

  test("RC5 the help keeps its row and the ceiling", async () => {
    const row = COMMANDS.find((c) => c.name === "realm");
    expect(row).toBeDefined();
    expect(row!.accepts).toContain("realm");
    for (const door of ["realm", "realm name", "realm add", "realm list"]) expect(COMMAND_HELP[door], door).toBeDefined();
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dispatch(["help"])).toBe(0);
    const lines = out.join("\n").split("\n");
    expect(lines.length).toBeLessThanOrEqual(66);
    expect(out.join("\n")).toMatch(/^\s+realm\s/m);
  });
});
