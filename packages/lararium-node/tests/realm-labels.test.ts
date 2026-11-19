/**
 * realm-labels — A REALM HOLDS ITS WIKIS UNDER THE PET NAME THE OPERATOR GIVES IT (operator ruling 2026-11-19: "The filepath for
 * realms should include their 'pet-name' to match faces."). The label rests local beside the face labels, at
 * `<projections>/realm-labels/<pet name>.json` (0600), and names the canon realms it holds (`{ id, slug }`: the realm id the
 * vessel's workbench ledger binds for the slug, null until read) and the domain bags beside them. Never a share row, never a
 * replicated document.
 *
 *   RL1 a label round-trips: name, place a wiki (its canon bag rides with it), read back; a second naming says "already"
 *   RL2 the pet-name rule refuses by name: empty, a separator, a colon, NUL, a leading dot (`.`, `..`), a case twin of another
 *       realm, and a face's pet name
 *   RL3 one slug rests in one realm: placing a slug another realm holds refuses by name
 *   RL4 a rename moves the realm's folder with its label; a rename onto a standing folder refuses and moves nothing
 *   RL5 the placement reads the labels: a wiki in a named realm lays under `realms/<pet>/wikis`, its bag under
 *       `realms/<pet>/bags`; a slug no realm holds answers null (it waits by name)
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  nameRealm, placeInRealm, readRealmLabels, realmLabelPath, realmPlacement, RealmRefused, REALM_LABEL_SCHEMA,
} from "../src/realm-labels.js";
import { realmRoot, REALMS_PROJECTION_DIR } from "../src/bag-paths.js";

let p: string;
beforeEach(() => { p = mkdtempSync(join(tmpdir(), "lar-realm-labels-")); });
afterEach(() => { rmSync(p, { recursive: true, force: true }); });

const code = (f: () => unknown): string => { try { f(); } catch (e) { return e instanceof RealmRefused ? e.code : `other: ${String(e)}`; } return "none"; };

describe("the realm label", () => {
  test("RL1 round-trips local, beside the face labels, at 0600", () => {
    expect(nameRealm(p, "Garden").did).toBe("named");
    placeInRealm(p, "Garden", { slug: "notes", id: "ab".repeat(32) });
    placeInRealm(p, "Garden", { slug: "works", id: null });
    const path = realmLabelPath("Garden", p);
    expect(path).toBe(join(p, "realm-labels", "Garden.json"));
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      schema: REALM_LABEL_SCHEMA, petName: "Garden",
      realms: [{ slug: "notes", id: "ab".repeat(32) }, { slug: "works", id: null }], bags: ["notes", "works"],
    });
    expect(readRealmLabels(p).map((l) => l.petName)).toEqual(["Garden"]);
    expect(nameRealm(p, "Garden").did).toBe("already");
    // A placement again changes nothing, and a later read of the id fills it.
    placeInRealm(p, "Garden", { slug: "works", id: "cd".repeat(32) });
    expect(readRealmLabels(p)[0]!.realms).toEqual([{ slug: "notes", id: "ab".repeat(32) }, { slug: "works", id: "cd".repeat(32) }]);
  });

  test("RL2 the pet-name rule refuses by name", () => {
    expect(code(() => nameRealm(p, ""))).toBe("realm-name-empty");
    expect(code(() => nameRealm(p, "a/b"))).toBe("realm-name-separator");
    expect(code(() => nameRealm(p, "a\\b"))).toBe("realm-name-separator");
    expect(code(() => nameRealm(p, "a:b"))).toBe("realm-name-colon");
    expect(code(() => nameRealm(p, "a\0b"))).toBe("realm-name-nul");
    expect(code(() => nameRealm(p, "."))).toBe("realm-name-leading-dot");
    expect(code(() => nameRealm(p, ".."))).toBe("realm-name-leading-dot");
    nameRealm(p, "Garden");
    expect(code(() => nameRealm(p, "garden"))).toBe("realm-name-collision");
    expect(code(() => nameRealm(p, "Engineer", { faceNames: ["engineer"] }))).toBe("realm-name-face");
    expect(readRealmLabels(p).map((l) => l.petName)).toEqual(["Garden"]);
  });

  test("RL3 one slug rests in one realm", () => {
    nameRealm(p, "Garden"); nameRealm(p, "Forge");
    placeInRealm(p, "Garden", { slug: "notes", id: null });
    expect(code(() => placeInRealm(p, "Forge", { slug: "notes", id: null }))).toBe("realm-slug-held");
    expect(code(() => placeInRealm(p, "Nowhere", { slug: "works", id: null }))).toBe("realm-unnamed");
    expect(code(() => placeInRealm(p, "Forge", { slug: "daemon", id: null }))).toBe("realm-slug-private");
  });

  test("RL4 a rename moves the folder with the label, and refuses onto a standing folder", () => {
    nameRealm(p, "Garden");
    placeInRealm(p, "Garden", { slug: "notes", id: "ab".repeat(32) });
    mkdirSync(join(realmRoot(p, "Garden"), "wikis", "notes"), { recursive: true });
    writeFileSync(join(realmRoot(p, "Garden"), "wikis", "notes", "a.tid"), "title: a\n\nx\n");
    // By the canon realm id it holds, as by its old pet name.
    const r = nameRealm(p, "Orchard", { from: "ab".repeat(32) });
    expect(r.did).toBe("renamed");
    expect(existsSync(join(p, REALMS_PROJECTION_DIR, "Garden"))).toBe(false);
    expect(readFileSync(join(realmRoot(p, "Orchard"), "wikis", "notes", "a.tid"), "utf8")).toContain("x");
    expect(existsSync(realmLabelPath("Garden", p))).toBe(false);
    expect(readRealmLabels(p).map((l) => [l.petName, l.realms.map((x) => x.slug)])).toEqual([["Orchard", ["notes"]]]);
    // A folder standing under the new name already: refused, nothing moves.
    mkdirSync(realmRoot(p, "Grove"), { recursive: true });
    expect(code(() => nameRealm(p, "Grove", { from: "Orchard" }))).toBe("realm-folder-standing");
    expect(existsSync(join(realmRoot(p, "Orchard"), "wikis", "notes", "a.tid"))).toBe(true);
    expect(code(() => nameRealm(p, "Elsewhere", { from: "Nobody" }))).toBe("realm-unnamed");
  });

  test("RL5 the placement waits by name until a realm holds the slug", () => {
    expect(realmPlacement(p).wikisBase("notes")).toBeNull();
    expect(realmPlacement(p).bagsBase("notes")).toBeNull();
    nameRealm(p, "Garden");
    placeInRealm(p, "Garden", { slug: "notes", id: null });
    const at = realmPlacement(p);
    expect(at.wikisBase("notes")).toBe(join(p, "realms", "Garden", "wikis"));
    expect(at.bagsBase("notes")).toBe(join(p, "realms", "Garden", "bags"));
    expect(at.petNameOf("notes")).toBe("Garden");
    expect(at.wikisBase("works")).toBeNull();
  });
});
