/**
 * realm-labels — A REALM HOLDS ITS WIKIS UNDER THE PET NAME THE OPERATOR GIVES IT (operator ruling 2026-11-19: "The filepath for
 * realms should include their 'pet-name' to match faces."). The label rests local beside the face labels, at
 * `<projections>/realm-labels/<pet name>.json` (0600), and names the canon realms it holds (`{ id, slug }`: the realm id the
 * vessel's workbench ledger binds for the slug, null until read) and the domain bags beside them. Never a share row, never a
 * replicated document. EVERY REALM CARRIES A PET NAME: one minted with none takes its slug, so nothing waits.
 *
 *   RL1 a label round-trips: name, place a wiki (its canon bag rides with it), read back; a second naming says "already"
 *   RL2 the pet-name rule refuses by name: empty, a separator, a colon, NUL, a leading dot (`.`, `..`), a case twin of another
 *       realm, and a face's pet name
 *   RL3 one slug rests in one realm: placing it in another regroups it; it reads where it stands until the quiet point's
 *       settle moves its folder (its `.git` with it), and an emptied realm folder leaves
 *   RL3c a wiki moving between two realm trees: its files leave one tree and land in the other, each side commits, and each
 *       commit names both ends
 *   RL4 a rename relabels at once; the settle moves the realm's whole root (its one tree with it), and a folder standing in
 *       both places moves nothing, named
 *   RL5 the default pet name: a realm with no label takes its slug, written once (`realms/<slug>/wikis`, `/bags`); a default that
 *       meets another realm's pet name takes the slug plus the shortest prefix of its canon realm id, or the shortest counter
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureRealmLabel, moveWikiToRealm, nameRealm, placeInRealm, readRealmLabels, realmLabelPath, realmPlacement, RealmRefused, REALM_LABEL_SCHEMA, settleRealmMoves,
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

  test("RL3 one slug rests in one realm: placing it elsewhere regroups it, and its folder follows at the quiet point", () => {
    nameRealm(p, "Garden"); nameRealm(p, "Forge");
    placeInRealm(p, "Garden", { slug: "notes", id: "ab".repeat(32) });
    mkdirSync(join(realmRoot(p, "Garden"), "wikis", "notes", ".git"), { recursive: true });
    placeInRealm(p, "Forge", { slug: "notes", id: null });
    expect(readRealmLabels(p).map((l) => [l.petName, l.realms, l.bags])).toEqual([
      ["Forge", [{ slug: "notes", id: "ab".repeat(32) }], ["notes"]],
      ["Garden", [], []],
    ]);
    // Until the quiet point, the wiki reads where it stands: no mount lays a second folder.
    expect(realmPlacement(p).wikisBase("notes")).toBe(join(p, "realms", "Garden", "wikis"));
    expect(settleRealmMoves(p).moved).toEqual([{ from: join(p, "realms", "Garden", "wikis", "notes"), to: join(p, "realms", "Forge", "wikis", "notes") }]);
    expect(existsSync(join(p, "realms", "Forge", "wikis", "notes", ".git")), "the history moves with the folder").toBe(true);
    expect(existsSync(join(p, "realms", "Garden")), "an emptied realm folder leaves").toBe(false);
    expect(realmPlacement(p).wikisBase("notes")).toBe(join(p, "realms", "Forge", "wikis"));
    expect(code(() => placeInRealm(p, "Nowhere", { slug: "works", id: null }))).toBe("realm-unnamed");
    expect(code(() => placeInRealm(p, "Forge", { slug: "daemon", id: null }))).toBe("realm-slug-private");
  });

  test("★ RL3c a wiki moving between two realm trees: the files leave one tree and land in the other, each side commits, each commit names both ends ★", () => {
    const g = (cwd: string, ...args: string[]): string => {
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
      const r = spawnSync("git", ["-c", "core.quotepath=off", ...args], { cwd, env, encoding: "utf8" });
      if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
      return (r.stdout ?? "").trim();
    };
    const tree = (dir: string, who: string): void => {
      mkdirSync(dir, { recursive: true });
      g(dir, "init", "-q", "-b", "main"); g(dir, "config", "user.name", who); g(dir, "config", "user.email", `${who.toLowerCase()}@realm.invalid`); g(dir, "config", "commit.gpgsign", "false");
    };
    nameRealm(p, "Garden"); nameRealm(p, "Forge");
    placeInRealm(p, "Garden", { slug: "notes", id: null });
    placeInRealm(p, "Garden", { slug: "lore", id: null });
    placeInRealm(p, "Forge", { slug: "works", id: null });
    const garden = realmRoot(p, "Garden"), forge = realmRoot(p, "Forge");
    tree(garden, "Garden"); tree(forge, "Forge");
    for (const [root, slug] of [[garden, "notes"], [garden, "lore"], [forge, "works"]] as const) {
      mkdirSync(join(root, "wikis", slug), { recursive: true });
      writeFileSync(join(root, "wikis", slug, "a.tid"), `title: a\n\n${slug}\n`);
      g(root, "add", "-A"); g(root, "commit", "-q", "--no-verify", "-m", `lays ${slug}`);
    }
    placeInRealm(p, "Forge", { slug: "notes", id: null });
    const r = settleRealmMoves(p);
    expect(r.moved).toEqual([{ from: join(garden, "wikis", "notes"), to: join(forge, "wikis", "notes") }]);
    expect(g(garden, "ls-tree", "-r", "--name-only", "HEAD").split("\n")).toEqual(["wikis/lore/a.tid"]);
    expect(g(forge, "ls-tree", "-r", "--name-only", "HEAD").split("\n")).toEqual(["wikis/notes/a.tid", "wikis/works/a.tid"]);
    for (const root of [garden, forge]) {
      const msg = g(root, "log", "-1", "--format=%B");
      expect(msg).toContain("lar:///wiki.moves.between-realms/notes");
      expect(msg).toContain('the realm "Garden"');
      expect(msg).toContain('the realm "Forge"');
      expect(g(root, "status", "--porcelain")).toBe("");
    }
    expect(g(forge, "log", "-1", "--format=%an")).toBe("Forge");
    expect(g(garden, "log", "-1", "--format=%an")).toBe("Garden");
  });

  test("RL3b a move mints the target realm where none wears it, keeps the canon realm id, and drops the label it empties", () => {
    ensureRealmLabel(p, "notes", "ab".repeat(32));
    const r = moveWikiToRealm(p, "notes", "Garden");
    expect(r).toEqual({ label: { schema: REALM_LABEL_SCHEMA, petName: "Garden", realms: [{ slug: "notes", id: "ab".repeat(32) }], bags: ["notes"] }, from: "notes", minted: true, dropped: ["notes"] });
    expect(readRealmLabels(p).map((l) => l.petName)).toEqual(["Garden"]);
    expect(code(() => moveWikiToRealm(p, "notes", "a/b"))).toBe("realm-name-separator");
  });

  test("RL4 a rename relabels at once; the folder moves at the quiet point, and never half-moved", () => {
    nameRealm(p, "Garden");
    placeInRealm(p, "Garden", { slug: "notes", id: "ab".repeat(32) });
    mkdirSync(join(realmRoot(p, "Garden"), "wikis", "notes"), { recursive: true });
    writeFileSync(join(realmRoot(p, "Garden"), "wikis", "notes", "a.tid"), "title: a\n\nx\n");
    // By the canon realm id it holds, as by its current pet name.
    const r = nameRealm(p, "Orchard", { from: "ab".repeat(32) });
    expect(r.did).toBe("renamed");
    expect(existsSync(realmLabelPath("Garden", p))).toBe(false);
    expect(readRealmLabels(p).map((l) => [l.petName, l.realms.map((x) => x.slug)])).toEqual([["Orchard", ["notes"]]]);
    expect(realmPlacement(p).wikisBase("notes"), "read where it stands until the quiet point").toBe(join(p, "realms", "Garden", "wikis"));
    // The realm's whole root moves in one rename (its one tree with it), since every folder it holds goes to one realm none holds yet.
    expect(settleRealmMoves(p).moved).toEqual([{ from: join(p, "realms", "Garden"), to: join(p, "realms", "Orchard") }]);
    expect(existsSync(join(p, REALMS_PROJECTION_DIR, "Garden"))).toBe(false);
    expect(readFileSync(join(realmRoot(p, "Orchard"), "wikis", "notes", "a.tid"), "utf8")).toContain("x");
    // Both places standing: nothing moves, and the settle names it.
    nameRealm(p, "Grove", { from: "Orchard" });
    mkdirSync(join(realmRoot(p, "Grove"), "wikis", "notes"), { recursive: true });
    const held = settleRealmMoves(p);
    expect(held.moved).toEqual([]);
    expect(held.held.join("\n")).toMatch(/where a folder already stands/);
    expect(existsSync(join(realmRoot(p, "Orchard"), "wikis", "notes", "a.tid"))).toBe(true);
    expect(code(() => nameRealm(p, "Elsewhere", { from: "Nobody" }))).toBe("realm-unnamed");
  });

  test("RL5 every realm carries a pet name: the default is the slug, written once; a collision takes the shortest id prefix", () => {
    expect(realmPlacement(p).wikisBase("notes")).toBeNull();
    const first = ensureRealmLabel(p, "notes", "ab".repeat(32));
    expect(first.minted).toBe(true);
    expect(first.line).toMatch(/default pet name "notes"/);
    expect(readRealmLabels(p)).toEqual([{ schema: REALM_LABEL_SCHEMA, petName: "notes", realms: [{ slug: "notes", id: "ab".repeat(32) }], bags: ["notes"] }]);
    expect(ensureRealmLabel(p, "notes", null).minted, "written once").toBe(false);
    const at = realmPlacement(p);
    expect(at.wikisBase("notes")).toBe(join(p, "realms", "notes", "wikis"));
    expect(at.bagsBase("notes")).toBe(join(p, "realms", "notes", "bags"));
    expect(at.petNameOf("notes")).toBe("notes");
    // THE COLLISION: an operator-named realm "Works" holds another wiki; the wiki `works` takes `works-` plus the shortest prefix.
    nameRealm(p, "Works");
    placeInRealm(p, "Works", { slug: "garden", id: null });
    nameRealm(p, "works-c");
    const collided = ensureRealmLabel(p, "works", "cd".repeat(32));
    expect(collided.label.petName).toBe("works-cd");
    expect(collided.line).toMatch(/names another realm already, so this realm takes "works-cd"/);
    // No id read yet: the shortest counter names it apart.
    nameRealm(p, "Pond");
    expect(ensureRealmLabel(p, "pond", null).label.petName).toBe("pond-2");
  });
});
