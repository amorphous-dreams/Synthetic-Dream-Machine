/**
 * workbench-mirrors — where a wiki's realm workbench and a face's personal margin rest on disk (cabal-realm#/the-workbench).
 *
 * Projection follows placement: a record reaches plaintext only through a resting layer with a mirror. A wiki's working slot
 * rests in its realm workbench and projects to `<projections>/wikis/<slug>`, or to the operator workspace its share row names
 * (`<root>/workspaces/<name>`, the host shim's `/lar/workspaces/<name>` bind); a face's personal layer carries its private
 * margin over the workbench and projects per face to `<projections>/personal/<F>/<slug>` (operator ruling 2026-11-11).
 *
 * M1 a workspace resolves under `<root>/workspaces`; one that resolves inside the checkout or the hearth refuses by name, a
 *    checkout-sourced slug refuses, and a workspace with no directory waits unbound (red 6, the vessel's half of tree-clean).
 * M2 one shared resolution, two host grants: the disk-holding host (a node pool's grant) roots the workbench in its workspace
 *    and the personal margin per face; a host that holds no disk grant (a browser leaf's empty grant) mirrors nothing and
 *    reads the same recipe. No face worn: no personal mirror.
 * M3 (personal survives export -> reset -> seed, the disk half) a reset clears the hearth alone, and the personal folder the
 *    projector wrote stands where the seed reads it back (`<projections>/personal/<F>/<slug>`). The seed's landing into the
 *    face's own personal layer rides the CLI seed wave (`seed-mirrors.ts`), CI-proved.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDiskMirrors, type DiskMirrorGrant } from "../../lararium-mesh/src/vessel-island-pool-core.js";
import { expandRecipe, wikiSlotUri } from "../../lararium-mesh/src/wiki-recipe.js";
import { workspaceRootsOf, personalFaceRoot, PERSONAL_PROJECTION_DIR } from "../src/bag-paths.js";

const F = "0b0e2c1a-1111-4222-8333-944445555666";
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function house(): { root: string; checkout: string; workspaces: string; hearth: string; projections: string } {
  const base = mkdtempSync(join(tmpdir(), "workbench-mirrors-"));
  dirs.push(base);
  const root = join(base, "house"), checkout = join(base, "checkout");
  for (const d of [join(root, "workspaces"), join(root, "hearth"), join(root, "projections"), join(checkout, "bags")]) mkdirSync(d, { recursive: true });
  return { root, checkout, workspaces: join(root, "workspaces"), hearth: join(root, "hearth"), projections: join(root, "projections") };
}

describe("M1 — a workspace never rests inside the checkout or the hearth", () => {
  test("bound, refused and unbound workspaces, each by name", () => {
    const h = house();
    mkdirSync(join(h.workspaces, "field-notes"));
    mkdirSync(join(h.checkout, "notes-in-tree"));
    symlinkSync(join(h.checkout, "notes-in-tree"), join(h.workspaces, "in-tree"));
    mkdirSync(join(h.hearth, "inner"));
    symlinkSync(join(h.hearth, "inner"), join(h.workspaces, "in-hearth"));
    mkdirSync(join(h.workspaces, "sdm-notes"));
    const read = workspaceRootsOf({
      rows: [
        { slug: "notes", kind: "wiki", workspace: "field-notes" },
        { slug: "tree", kind: "wiki", workspace: "in-tree" },
        { slug: "deep", kind: "wiki", workspace: "in-hearth" },
        { slug: "sdm", kind: "wiki", workspace: "sdm-notes" },
        { slug: "later", kind: "wiki", workspace: "not-bound" },
        { slug: "a-bag", kind: "bag", workspace: "field-notes" },
      ],
      workspacesHome: h.workspaces, checkoutRoot: h.checkout, hearth: h.hearth, sourcedSlugs: ["sdm"],
    });
    expect(Object.keys(read.roots)).toEqual(["notes"]);
    expect(read.roots["notes"]).toMatch(/workspaces\/field-notes$/);
    expect(read.refused.join("\n")).toMatch(/tree: workspace "in-tree" resolves inside the checkout/);
    expect(read.refused.join("\n")).toMatch(/deep: workspace "in-hearth" resolves inside the hearth/);
    expect(read.refused.join("\n")).toMatch(/sdm: workbench-checkout-sourced/);
    expect(read.unbound.join("\n")).toMatch(/later: workspace "not-bound" stands unbound/);
  });
});

describe("M2 — one shared resolution, two host grants", () => {
  const grant = (roots: Record<string, string>, face: string | null): DiskMirrorGrant => [
    { bagId: "working", mirrorRoot: "/lar/projections/wikis", scope: "working", wikiSlot: "working", workspaceRoots: roots },
    { bagId: "personal", mirrorRoot: `/lar/projections/${PERSONAL_PROJECTION_DIR}`, scope: "personal", wikiSlot: "personal", faceFolder: () => face },
  ];
  const designation = [wikiSlotUri("notes", "working"), wikiSlotUri("notes", "personal")];

  test("the disk-holding host roots the workbench in its workspace and the personal margin per face", () => {
    expect(resolveDiskMirrors(grant({ notes: "/lar/workspaces/field-notes" }, F), designation, "notes")).toEqual([
      { bagId: wikiSlotUri("notes", "working"), mirrorRoot: "/lar/workspaces/field-notes", scope: "working", wikiSlot: "working" },
      { bagId: wikiSlotUri("notes", "personal"), mirrorRoot: `/lar/projections/personal/${F}/notes`, scope: "personal", wikiSlot: "personal" },
    ]);
    // No workspace named: the workbench projects where the wiki's working layer always did.
    expect(resolveDiskMirrors(grant({}, F), designation, "notes")[0]!.mirrorRoot).toBe("/lar/projections/wikis/notes");
  });
  test("no face worn: no personal mirror; a host with no disk grant mirrors nothing and reads the same recipe", () => {
    expect(resolveDiskMirrors(grant({}, null), designation, "notes").map((m) => m.bagId)).toEqual([wikiSlotUri("notes", "working")]);
    expect(resolveDiskMirrors([], designation, "notes")).toEqual([]);
    // Both hosts compose one recipe: the stack never forks by host.
    expect(expandRecipe({ wikiSlug: "notes" })).toContain(wikiSlotUri("notes", "personal"));
  });
});

describe("M3 — personal survives a reset", () => {
  test("a reset clears the hearth alone; the face's personal folder stands where the seed reads it back", () => {
    const h = house();
    const folder = join(personalFaceRoot(h.projections, F), "notes");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "Private margin.tid"), "title: Private margin\n\nmine alone\n");
    writeFileSync(join(h.hearth, "vessel.key"), "secret");
    // THE RESET (`lares-container.sh reset`): every entry inside the hearth leaves; nothing beside it moves.
    rmSync(h.hearth, { recursive: true, force: true });
    mkdirSync(h.hearth);
    expect(existsSync(join(h.hearth, "vessel.key"))).toBe(false);
    expect(readFileSync(join(h.projections, PERSONAL_PROJECTION_DIR, F, "notes", "Private margin.tid"), "utf8")).toContain("mine alone");
    expect(() => personalFaceRoot(h.projections, "not-a-relation")).toThrow(/invalid relation/);
  });
});
