/**
 * realm-cmd — `lares realm`: a realm's pet name decides where its wikis rest (operator rulings 2026-11-19: "The filepath for
 * realms should include their 'pet-name' to match faces."; every realm carries a pet name, so nothing waits). The verb, then the
 * thing acted on, then `--to` its destination. Local alone: the label rests at `projections/realm-labels/<pet>.json`.
 *
 *   RC1 `realm move <slug> --to <pet>` names the realm where none wears the pet name and gathers the wiki, recording the canon
 *       realm id the vessel's ledger binds; `realm list` reads it back; a move that empties a label drops it and says so
 *   RC2 refusals by name: a bad pet name, a face's pet name, an unknown realm to rename; a missing `--to` or a stray word
 *       refuses as usage naming the corrected form; the retired `name` refuses (no alias)
 *   RC3 THE RENAME MOVE: `realm rename <cur> --to <new>` moves `realms/<cur>/` to `realms/<new>/` in one rename (its one tree with
 *       it) at once while no vessel answers;
 *       while one does, the label moves and the folder waits for the vessel's next lock or re-stand, and the line says so
 *   RC4 `wiki init <slug> --realm <pet>` places the wiki into an existing realm before the mint (an unknown realm refuses before
 *       anything mints); with no `--realm` the wiki takes its own realm under its slug
 *   RC5 the help: `realm` stands in the table with its accepts row, and the top-level list keeps its 66-line ceiling
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureRealmLabel, readRealmLabels, writeFaceLabel } from "@lararium/node";
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
  test("RC1 move names the realm, gathers the wiki, drops the label it empties; list reads it back", async () => {
    ensureRealmLabel(p, "notes", null);   // the default every realm carries: its slug
    live = true;
    expect(await run(["move", "notes"], { to: "Garden" })).toBe(0);
    expect(readRealmLabels(p)).toEqual([{ schema: "lar-realm-label", petName: "Garden", realms: [{ slug: "notes", id: ID }], bags: ["notes"] }]);
    expect(said.join("\n")).toMatch(/the realm "notes" holds no wiki now, so its label leaves/);
    said = [];
    expect(await run(["list"])).toBe(0);
    expect(said.join("\n")).toContain("Garden");
    expect(said.join("\n")).toContain(join(p, "realms", "Garden", "wikis", "notes"));
    expect(said.join("\n")).toContain(ID.slice(0, 12));
    expect(await run(["move", "notes"], { to: "Garden" })).toBe(0);
    expect(readRealmLabels(p)).toHaveLength(1);
  });

  test("RC2 refuses by name, and usage names the corrected form", async () => {
    writeFaceLabel({ relation: "00000000-0000-4000-8000-000000000001", petname: "Heron", handleIndex: 0 }, p);
    expect(await run(["move", "notes"], { to: "a/b" })).toBe(1);
    expect(said.join("\n")).toMatch(/realm-name-separator/);
    expect(await run(["move", "notes"], { to: "heron" })).toBe(1);
    expect(said.join("\n")).toMatch(/realm-name-face/);
    expect(await run(["rename", "Nowhere"], { to: "Garden" })).toBe(1);
    expect(said.join("\n")).toMatch(/realm-unnamed/);
    const err: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => { err.push(a.map(String).join(" ")); });
    expect(await run(["rename", "notes"])).toBe(2);
    expect(err.join("\n")).toContain("lares realm rename <current pet> --to <new pet>");
    expect(await run(["move", "notes"])).toBe(2);
    expect(err.join("\n")).toContain("lares realm move <wiki slug> --to <realm pet>");
    expect(await run(["list", "stray"])).toBe(2);
    expect(await run(["name", "Garden"]), "no alias for the retired verb").toBe(2);
    expect(await run(["add", "Garden", "notes"]), "no alias for the retired verb").toBe(2);
  });

  test("RC3 a rename moves the folder at once while no vessel answers, and at the vessel's next quiet point while one does", async () => {
    await run(["move", "notes"], { to: "Garden" });
    mkdirSync(join(p, "realms", "Garden", "wikis", "notes", ".git"), { recursive: true });
    live = true;
    expect(await run(["rename", "Garden"], { to: "Orchard" })).toBe(0);
    expect(said.join("\n")).toMatch(/moves at the vessel's next lock or re-stand/);
    expect(readRealmLabels(p).map((l) => l.petName)).toEqual(["Orchard"]);
    expect(existsSync(join(p, "realms", "Garden", "wikis", "notes")), "never half-moved: it stands whole where it stood").toBe(true);
    live = false;
    said = [];
    expect(await run(["rename", "Orchard"], { to: "Grove" })).toBe(0);
    expect(said.join("\n")).toContain(`moved ${join(p, "realms", "Garden")} -> ${join(p, "realms", "Grove")}`);
    expect(existsSync(join(p, "realms", "Grove", "wikis", "notes", ".git"))).toBe(true);
    expect(existsSync(join(p, "realms", "Garden"))).toBe(false);
  });

  test("RC4 a wiki placed at init lays under an existing realm; an unknown realm refuses before the mint; no --realm takes the slug", async () => {
    await run(["move", "lore"], { to: "Garden" });
    expect((await placeWikiInRealm(doors, "works", "Garden")).petName).toBe("Garden");
    expect(readRealmLabels(p)[0]!.realms).toEqual([{ slug: "lore", id: null }, { slug: "works", id: null }]);
    await expect(placeWikiInRealm(doors, "works", "Elsewhere")).rejects.toThrow(/realm-unnamed/);
    expect(readFileSync(join(p, "realm-labels", "Garden.json"), "utf8")).toContain("works");
    live = true;
    const own = await ensureWikiRealm(doors, "notes");
    expect(own.label).toEqual({ schema: "lar-realm-label", petName: "notes", realms: [{ slug: "notes", id: ID }], bags: ["notes"] });
  });

  test("RC5 the help keeps its row and the ceiling", async () => {
    const row = COMMANDS.find((c) => c.name === "realm");
    expect(row).toBeDefined();
    expect(row!.accepts).toEqual(["to"]);
    for (const door of ["realm", "realm rename", "realm move", "realm list"]) expect(COMMAND_HELP[door], door).toBeDefined();
    for (const gone of ["realm name", "realm add"]) expect(COMMAND_HELP[gone], gone).toBeUndefined();
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a) => { out.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await dispatch(["help"])).toBe(0);
    expect(out.join("\n").split("\n").length).toBeLessThanOrEqual(66);
    expect(out.join("\n")).toMatch(/^\s+realm\s/m);
  });
});
