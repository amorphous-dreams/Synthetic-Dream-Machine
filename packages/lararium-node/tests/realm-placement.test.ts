/**
 * realm-placement — A SHARED WIKI LAYS UNDER THE REALM THAT HOLDS IT, AND EVERY REALM CARRIES A PET NAME (operator rulings
 * 2026-11-19). The node's per-wiki grants mint a realm's default label on first read (its slug) and read the labels at each
 * mount, so nothing waits and no plaintext mirror goes dark; a rename or regroup moves the folder at a quiet point, and until
 * then each mount reads the folder where it stands. The ingest scan reads a realm's `wikis` and `bags` planes back.
 *
 *   RP1 default on mint: a wiki with no label lays at once under `realms/<slug>/wikis/<slug>` and `realms/<slug>/bags/<slug>`,
 *       its label written once; never a plain `wikis/<slug>`
 *   RP2 a rename re-places the next mount only once the quiet point moves the folder; before it, the mount reads where it stands
 *   RP3 the scan derives a realm workbench file's title against its plane, and a file beside the planes reads none
 *   RP4 the vessel mints each standing realm's label at boot, settles at the re-stand and at the last workbench watch's lock,
 *       and wires both per-wiki grants to the realm base
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDiskMirrors, type DiskMirrorGrant } from "../../lararium-mesh/src/vessel-island-pool-core.js";
import { wikiBagUri, wikiSlotUri } from "../../lararium-mesh/src/wiki-recipe.js";
import { REALMS_PROJECTION_DIR } from "../src/bag-paths.js";
import { ensureRealmLabel, nameRealm, readRealmLabels, realmPlacement, settleRealmMoves } from "../src/realm-labels.js";
import { fileToUriForSource } from "../src/ingest-scan.js";

let p: string;
beforeEach(() => { p = mkdtempSync(join(tmpdir(), "lar-realm-placement-")); });
afterEach(() => { rmSync(p, { recursive: true, force: true }); });

/** The node vessel's two per-wiki grants, as `open-node-vessel.ts` composes them: mint the default label, then read. */
const base = (plane: "wikis" | "bags") => (slug: string): string | null => {
  ensureRealmLabel(p, slug, null);
  const at = realmPlacement(p);
  return plane === "wikis" ? at.wikisBase(slug) : at.bagsBase(slug);
};
const grant = (): DiskMirrorGrant => [
  { bagId: "working", mirrorRoot: join(p, REALMS_PROJECTION_DIR), scope: "working", wikiSlot: "working", sourcedRoots: {}, workspaceRoots: {}, realmBase: base("wikis") },
  { bagId: "self", mirrorRoot: join(p, REALMS_PROJECTION_DIR), scope: "self", perWikiSlug: true, selfCanon: true, sourcedRoots: {}, realmBase: base("bags") },
];
const mount = (slug: string): string[] => resolveDiskMirrors(grant(), [wikiSlotUri(slug, "working"), wikiBagUri(slug)], slug).map((m) => m.mirrorRoot);

describe("a shared wiki's placement", () => {
  test("RP1 a wiki with no label lays at once under its default pet name", () => {
    expect(mount("notes")).toEqual([join(p, "realms", "notes", "wikis", "notes"), join(p, "realms", "notes", "bags", "notes")]);
    expect(readRealmLabels(p).map((l) => l.petName)).toEqual(["notes"]);
    expect(mount("notes")).toEqual([join(p, "realms", "notes", "wikis", "notes"), join(p, "realms", "notes", "bags", "notes")]);
    expect(readRealmLabels(p)).toHaveLength(1);
    for (const root of mount("notes")) expect(root.startsWith(join(p, "wikis"))).toBe(false);
  });

  test("RP2 a rename re-places the next mount once the quiet point moves the folder", () => {
    mount("notes");
    mkdirSync(join(p, "realms", "notes", "wikis", "notes"), { recursive: true });
    nameRealm(p, "Garden", { from: "notes" });
    expect(mount("notes")[0], "until the quiet point, the folder where it stands").toBe(join(p, "realms", "notes", "wikis", "notes"));
    settleRealmMoves(p);
    expect(mount("notes")[0]).toBe(join(p, "realms", "Garden", "wikis", "notes"));
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

  test("RP4 the vessel mints standing realms' labels at boot, settles at quiet points, and wires both grants", () => {
    const vessel = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
    expect(vessel).toMatch(/bagId: "working",[^\n]*realmBase: realmBaseOf\("wikis"\)/);
    expect(vessel).toMatch(/bagId: "self",[^\n]*realmBase: realmBaseOf\("bags"\)/);
    expect(vessel).toMatch(/ensureRealmLabel\(projectionRoot, slug, realmIdOf\(slug\)\)/);
    expect(vessel).toMatch(/for \(const slug of \[\.\.\.standingRealms\]\.sort\(\)\)[^\n]*ensureRealm\(slug\)/);
    expect(vessel).toMatch(/settleRealmFolders\(\);\n/);
    expect(vessel).toMatch(/if \(workspaceWatches\.size === 0\) settleRealmFolders\(\);/);
    expect(vessel).not.toMatch(/mirrorRoot: join\(projectionRoot, "wikis"\)/);
    expect(vessel).not.toMatch(/realmWaitingLine/);
  });
});
