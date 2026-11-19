/**
 * realm-placement — A SHARED WIKI LAYS UNDER THE REALM THAT HOLDS IT, OR WAITS BY NAME (operator ruling 2026-11-19). The node's
 * per-wiki grants read the realm labels at each mount, so a wiki whose realm stands unnamed lays no workbench and no canon bag,
 * and the same wiki lays under `realms/<pet>/` at its first mount after the operator names the realm and places it. The ingest
 * scan reads a realm's `wikis` and `bags` planes back, one folder per slug.
 *
 *   RP1 the vessel's grant shape: no named realm, no mirror; named and placed, the workbench under `realms/<pet>/wikis/<slug>`
 *       and the canon bag under `realms/<pet>/bags/<slug>`; never a plain `wikis/<slug>`
 *   RP2 a rename re-places the next mount under the new pet name
 *   RP3 the scan derives a realm workbench file's title against its plane, and a file beside the planes reads none
 *   RP4 the vessel wires both per-wiki grants to the realm base and names the waiting line
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDiskMirrors, type DiskMirrorGrant } from "../../lararium-mesh/src/vessel-island-pool-core.js";
import { wikiBagUri, wikiSlotUri } from "../../lararium-mesh/src/wiki-recipe.js";
import { REALMS_PROJECTION_DIR } from "../src/bag-paths.js";
import { nameRealm, placeInRealm, realmPlacement, realmWaitingLine } from "../src/realm-labels.js";
import { fileToUriForSource } from "../src/ingest-scan.js";

let p: string;
beforeEach(() => { p = mkdtempSync(join(tmpdir(), "lar-realm-placement-")); });
afterEach(() => { rmSync(p, { recursive: true, force: true }); });

/** The node vessel's two per-wiki grants, as `open-node-vessel.ts` composes them. */
const grant = (): DiskMirrorGrant => [
  { bagId: "working", mirrorRoot: join(p, REALMS_PROJECTION_DIR), scope: "working", wikiSlot: "working", sourcedRoots: {}, workspaceRoots: {}, realmBase: (slug) => realmPlacement(p).wikisBase(slug) },
  { bagId: "self", mirrorRoot: join(p, REALMS_PROJECTION_DIR), scope: "self", perWikiSlug: true, selfCanon: true, sourcedRoots: {}, realmBase: (slug) => realmPlacement(p).bagsBase(slug) },
];
const mount = (slug: string): string[] => resolveDiskMirrors(grant(), [wikiSlotUri(slug, "working"), wikiBagUri(slug)], slug).map((m) => m.mirrorRoot);

describe("a shared wiki's placement", () => {
  test("RP1 waits by name, then lays under the realm once named and placed", () => {
    expect(mount("notes")).toEqual([]);
    nameRealm(p, "Garden");
    expect(mount("notes"), "a named realm that holds no such wiki places nothing").toEqual([]);
    placeInRealm(p, "Garden", { slug: "notes", id: null });
    expect(mount("notes")).toEqual([join(p, "realms", "Garden", "wikis", "notes"), join(p, "realms", "Garden", "bags", "notes")]);
    for (const root of mount("notes")) expect(root.startsWith(join(p, "wikis"))).toBe(false);
    expect(realmWaitingLine("works")).toMatch(/works: waits by name.*`lares realm name <pet>`.*`lares realm add <pet> works`/);
  });

  test("RP2 a rename re-places the next mount under the new pet name", () => {
    nameRealm(p, "Garden");
    placeInRealm(p, "Garden", { slug: "notes", id: null });
    nameRealm(p, "Orchard", { from: "Garden" });
    expect(mount("notes")[0]).toBe(join(p, "realms", "Orchard", "wikis", "notes"));
  });

  test("RP3 the scan reads a realm's wikis and bags planes back", () => {
    const bench = join(p, "realms", "Garden", "wikis", "notes");
    mkdirSync(join(bench, "ha.ka.ba", "notes"), { recursive: true });
    const file = join(bench, "ha.ka.ba", "notes", "pond.mem");
    writeFileSync(file, "a pond");
    const derive = fileToUriForSource(p, bench, { bags: join(p, "bags"), wikis: join(p, "wikis"), projections: p });
    expect(derive(p, file)).toBe("lar:///ha.ka.ba/notes/pond");
    const loose = join(p, "realms", "Garden", "stray.tid");
    writeFileSync(loose, "title: stray\n\nx\n");
    expect(fileToUriForSource(p, join(p, "realms", "Garden"), { bags: join(p, "bags"), wikis: join(p, "wikis"), projections: p })(p, loose)).toEqual({ why: expect.stringMatching(/outside any realm's wikis or bags/) });
  });

  test("RP4 the vessel wires both per-wiki grants to the realm base and names the waiting line", () => {
    const vessel = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
    expect(vessel).toMatch(/bagId: "working",[^\n]*realmBase: realmBaseOf\("wikis"\)/);
    expect(vessel).toMatch(/bagId: "self",[^\n]*realmBase: realmBaseOf\("bags"\)/);
    expect(vessel).toMatch(/console\.warn\(`\[realms\] \$\{realmWaitingLine\(slug\)\}`\)/);
    expect(vessel).not.toMatch(/mirrorRoot: join\(projectionRoot, "wikis"\)/);
  });
});
