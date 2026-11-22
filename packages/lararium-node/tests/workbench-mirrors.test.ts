/**
 * workbench-mirrors — where a wiki's realm workbench and a face's personal layer rest on disk (cabal-realm#/the-workbench).
 *
 * Projection follows placement: a record reaches plaintext only through a resting layer with a mirror. A wiki's working slot
 * rests in its realm workbench and projects to `<projections>/realms/<realm pet name>/wikis/<slug>` (the realm label that holds
 * it), or to the operator workspace its share row names
 * (`<root>/workspaces/<name>`, the host shim's `/lar/workspaces/<name>` bind); a face's personal layer carries its private
 * personal layer over the workbench and projects in the face's root to `<projections>/faces/<pet name>/personal/<slug>` (operator rulings
 * 2026-11-11, 2026-11-18).
 *
 * M1 a workspace resolves under `<root>/workspaces`, and one that resolves inside the repository checkout binds (founding road
 *    rank 4j, operator 2026-11-18: the checkout stands as the cabal's working surface, no carve-out); one inside the hearth
 *    refuses by name, a checkout-sourced slug refuses (its one workbench folder already rests beside its canon source, in that
 *    working surface), and a workspace with no directory waits unbound.
 * M2 one shared resolution, two host grants: the disk-holding host (a node pool's grant) roots the workbench in its workspace
 *    and the personal layer per face; a host that holds no disk grant (a browser leaf's empty grant) mirrors nothing and
 *    reads the same recipe. No face worn: no personal mirror.
 * M3 (personal survives export -> reset -> seed, the disk half) a reset clears the hearth alone, and the personal folder the
 *    projector wrote stands where the seed reads it back (`<projections>/faces/<pet name>/personal/<slug>`). The seed's landing into the
 *    face's own personal layer rides the CLI seed wave (`seed-mirrors.ts`), CI-proved.
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDiskMirrors, type DiskMirrorGrant } from "../../lararium-mesh/src/vessel-island-pool-core.js";
import { expandRecipe, wikiSlotUri } from "../../lararium-mesh/src/wiki-recipe.js";
import { workspaceRootsOf, facePersonalRoot, FACES_PROJECTION_DIR, houseIgnored, houseExcludeLines, WORKSPACE_EXCLUDE_LINES, REALM_EXCLUDE_LINES } from "../src/bag-paths.js";
import { publishWikiRender, trackedTreeRoots } from "../src/render-output.js";
import { execFileSync, spawn } from "node:child_process";
import { isWatchNoise, WORKSPACE_SKIP } from "../src/watch-core.js";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
function house(): { root: string; checkout: string; workspaces: string; hearth: string; projections: string } {
  const base = mkdtempSync(join(tmpdir(), "workbench-mirrors-"));
  dirs.push(base);
  const root = join(base, "house"), checkout = join(base, "checkout");
  for (const d of [join(root, "workspaces"), join(root, "hearth"), join(root, "projections"), join(checkout, "bags")]) mkdirSync(d, { recursive: true });
  return { root, checkout, workspaces: join(root, "workspaces"), hearth: join(root, "hearth"), projections: join(root, "projections") };
}

describe("M1 — a workspace binds in the working surface and never rests inside the hearth", () => {
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
      workspacesHome: h.workspaces, hearth: h.hearth, sourcedSlugs: ["sdm"],
    });
    expect(Object.keys(read.roots).sort()).toEqual(["notes", "tree"]);
    expect(read.roots["notes"]).toMatch(/workspaces\/field-notes$/);
    // The checkout counts as the cabal's working surface: a workspace resting inside it binds at its real path.
    expect(read.roots["tree"]).toBe(realpathSync(join(h.checkout, "notes-in-tree")));
    expect(read.refused.join("\n")).not.toMatch(/inside the checkout/);
    expect(read.refused.join("\n")).toMatch(/deep: workspace "in-hearth" resolves inside the hearth/);
    expect(read.refused.join("\n")).toMatch(/sdm: workbench-checkout-sourced \(its one workbench folder rests beside its canon source, in the working surface\)/);
    expect(read.refused).toHaveLength(2);
    expect(read.unbound.join("\n")).toMatch(/later: workspace "not-bound" stands unbound/);
  });
  test("a workspace naming the hearth root itself refuses", () => {
    const h = house();
    symlinkSync(h.hearth, join(h.workspaces, "the-hearth"));
    const read = workspaceRootsOf({ rows: [{ slug: "hot", kind: "wiki", workspace: "the-hearth" }], workspacesHome: h.workspaces, hearth: h.hearth, sourcedSlugs: [] });
    expect(read.roots).toEqual({});
    expect(read.refused.join("\n")).toMatch(/hot: workspace "the-hearth" resolves inside the hearth/);
    expect(read.closed).toEqual(["hot"]);
  });
  test("a workspace inside config or sensoriums refuses as the hearth does, and every refused or unbound slug stands closed", () => {
    const h = house();
    for (const state of ["config", "sensoriums"]) { mkdirSync(join(h.root, state, "inner"), { recursive: true }); symlinkSync(join(h.root, state, "inner"), join(h.workspaces, state)); }
    mkdirSync(join(h.workspaces, "field-notes"));
    const read = workspaceRootsOf({ rows: [
      { slug: "conf", kind: "wiki", workspace: "config" }, { slug: "sense", kind: "wiki", workspace: "sensoriums" },
      { slug: "later", kind: "wiki", workspace: "not-bound" }, { slug: "notes", kind: "wiki", workspace: "field-notes" },
    ], workspacesHome: h.workspaces, hearth: h.hearth, sourcedSlugs: [] });
    expect(Object.keys(read.roots)).toEqual(["notes"]);
    expect(read.refused.join("\n")).toMatch(/conf: workspace "config" resolves inside the house's state/);
    expect(read.refused.join("\n")).toMatch(/sense: workspace "sensoriums" resolves inside the house's state/);
    expect(read.closed).toEqual(["conf", "sense", "later"]);
  });
});

describe("M2 — one shared resolution, two host grants", () => {
  const grant = (roots: Record<string, string>, face: string | null): DiskMirrorGrant => [
    { bagId: "working", mirrorRoot: "/lar/projections/realms", scope: "working", wikiSlot: "working", workspaceRoots: roots, realmBase: (slug) => slug === "notes" ? "/lar/projections/realms/Garden/wikis" : null },
    { bagId: "personal", mirrorRoot: `/lar/projections/${FACES_PROJECTION_DIR}`, scope: "personal", wikiSlot: "personal", faceFolder: () => face },
  ];
  const designation = [wikiSlotUri("notes", "working"), wikiSlotUri("notes", "personal")];

  test("the disk-holding host roots the workbench in its workspace and the personal layer per face", () => {
    expect(resolveDiskMirrors(grant({ notes: "/lar/workspaces/field-notes" }, "Heron"), designation, "notes")).toEqual([
      { bagId: wikiSlotUri("notes", "working"), mirrorRoot: "/lar/workspaces/field-notes", scope: "working", wikiSlot: "working" },
      { bagId: wikiSlotUri("notes", "personal"), mirrorRoot: "/lar/projections/faces/Heron/personal/notes", scope: "personal", wikiSlot: "personal" },
    ]);
    // No workspace named: the workbench projects in the realm whose label holds the wiki.
    expect(resolveDiskMirrors(grant({}, "Heron"), designation, "notes")[0]!.mirrorRoot).toBe("/lar/projections/realms/Garden/wikis/notes");
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
    const folder = join(facePersonalRoot(h.projections, "Heron"), "notes");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "Private page.tid"), "title: Private page\n\nmine alone\n");
    writeFileSync(join(h.hearth, "vessel.key"), "secret");
    // THE RESET (`lares-container.sh reset`): every entry inside the hearth leaves; nothing beside it moves.
    rmSync(h.hearth, { recursive: true, force: true });
    mkdirSync(h.hearth);
    expect(existsSync(join(h.hearth, "vessel.key"))).toBe(false);
    expect(readFileSync(join(h.projections, FACES_PROJECTION_DIR, "Heron", "personal", "notes", "Private page.tid"), "utf8")).toContain("mine alone");
    expect(() => facePersonalRoot(h.projections, "../escape")).toThrow(/face-segment-separator/);
  });
});

describe("render output custody in a bound workbench", () => {
  const files = [{ name: "a.html", text: "first", source: "A" }, { name: "nested/b.html", text: "second", source: "B" }];
  test("publishes a has-led manifest and a repeated request returns its first receipt", () => {
    const h = house();
    const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    const a = publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: ["C"] });
    expect(a).toMatchObject({ outcome: "written", files: [{ name: "a.html", bytes: 5 }, { name: "nested/b.html", bytes: 6 }], skipped: ["C"] });
    expect(a.has).toMatch(/^<<~ has /);
    expect(readFileSync(join(workbench, "rendered", "a.html"), "utf8")).toBe("first");
    expect(houseIgnored("rendered/a.html")).not.toBeNull();
    expect(isWatchNoise("rendered/a.html")).toBe(true);
    expect(WORKSPACE_SKIP).toContain("rendered");
    expect(publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: ["C"] })).toEqual(a);
    writeFileSync(join(workbench, "rendered", "a.html"), "edited later");
    expect(publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: ["C"] })).toEqual(a);
  });
  test("preflights every path and existing output before any byte lands", () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    for (const name of ["/tmp/out", "../out", "C:/out", "nested/../out", "nested\\out"]) {
      expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [files[0]!, { name, text: "x", source: "B" }], skipped: [] })).toThrow(/render-path-refused/);
      expect(existsSync(join(workbench, "rendered", "a.html"))).toBe(false);
    }
    expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [files[0]!, { ...files[0]!, source: "B" }], skipped: [] })).toThrow(/render-name-duplicate/);
    expect(existsSync(join(workbench, "rendered", "a.html"))).toBe(false);
    mkdirSync(join(workbench, "rendered")); writeFileSync(join(workbench, "rendered", "nested"), "obstruction");
    expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: [] })).toThrow(/render-path-refused/);
    expect(existsSync(join(workbench, "rendered", "a.html"))).toBe(false);
  });
  test("refuses symlink escape, a hearth root and an unbound workbench", () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    mkdirSync(join(workbench, "rendered")); symlinkSync(h.hearth, join(workbench, "rendered", "nested"));
    expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: [] })).toThrow(/render-path-symlink/);
    expect(existsSync(join(workbench, "rendered", "a.html"))).toBe(false);
    expect(() => publishWikiRender({ workbench: h.hearth, hearth: h.hearth, tracked: [], files, skipped: [] })).toThrow(/render-workbench-in-hearth/);
    expect(() => publishWikiRender({ workbench: join(h.workspaces, "absent"), hearth: h.hearth, tracked: [], files, skipped: [] })).toThrow(/render-workbench-unbound/);
  });
  test("refuses a workbench inside the canon source's tracked tree, so derived bytes never land in the checkout", () => {
    const h = house(); mkdirSync(join(h.checkout, ".git"));
    const tracked = trackedTreeRoots(join(h.checkout, "bags"), h.root);
    const checkoutBench = join(h.checkout, "notes"); mkdirSync(checkoutBench);
    symlinkSync(checkoutBench, join(h.workspaces, "checkout"));
    const sourcedBench = join(h.checkout, "wikis", "sdm"); mkdirSync(sourcedBench, { recursive: true });
    for (const workbench of [join(h.workspaces, "checkout"), sourcedBench, join(h.checkout, "bags")]) {
      expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked, files: [files[0]!], skipped: [] })).toThrow(/render-output-tracked-tree/);
    }
    expect(existsSync(join(checkoutBench, "rendered"))).toBe(false);
    expect(existsSync(join(sourcedBench, "rendered"))).toBe(false);
    const operatorBench = join(h.workspaces, "notes"); mkdirSync(operatorBench);
    expect(publishWikiRender({ workbench: operatorBench, hearth: h.hearth, tracked, files: [files[0]!], skipped: [] }).outcome).toBe("written");
    // A house resting inside a tracked home names no checkout: only the canon source and its wikis stay closed.
    mkdirSync(join(h.root, ".git"));
    expect(trackedTreeRoots(join(h.root, "bags"), h.root)).toEqual([join(realpathSync(h.root), "bags"), join(realpathSync(h.root), "wikis")]);
  });
  test("a workbench inside a git work tree whose exclude leaves rendered/ unignored refuses before any byte lands; one that ignores it writes", () => {
    const h = house();
    const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();
    const status = (cwd: string) => git(cwd, "status", "--porcelain", "-uall").trim();
    // A plain clone bound as a workspace under a canon source that names no checkout (road 4j).
    const clone = join(h.root, "..", "clone"); mkdirSync(clone); git(clone, "init", "-q"); git(clone, "commit", "-q", "--allow-empty", "-m", "seed");
    symlinkSync(clone, join(h.workspaces, "repo"));
    const tracked = trackedTreeRoots(join(h.root, "bags"), h.root);
    expect(() => publishWikiRender({ workbench: join(h.workspaces, "repo"), hearth: h.hearth, tracked, files: [files[0]!], skipped: [] })).toThrow(/render-output-tracked-tree/);
    expect(status(clone)).toBe("");
    // A linked worktree, whose `.git` stands as a file, refuses the same way, and from a folder nested inside it.
    const worktree = join(h.root, "..", "linked"); git(clone, "worktree", "add", "-q", worktree);
    mkdirSync(join(worktree, "notes"));
    for (const workbench of [worktree, join(worktree, "notes")]) {
      expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked, files: [files[0]!], skipped: [] })).toThrow(/render-output-tracked-tree/);
    }
    expect(status(worktree)).toBe("");
    // A clone whose own exclude ignores /rendered/ takes the bytes, and git sees nothing new.
    const ignoring = join(h.root, "..", "ignoring"); mkdirSync(ignoring); git(ignoring, "init", "-q");
    writeFileSync(join(ignoring, ".git", "info", "exclude"), "/rendered/\n");
    expect(publishWikiRender({ workbench: ignoring, hearth: h.hearth, tracked, files, skipped: [] }).outcome).toBe("written");
    expect(readFileSync(join(ignoring, "rendered", "nested", "b.html"), "utf8")).toBe("second");
    expect(status(ignoring)).toBe("");
    // An empty `.git` left behind marks no work tree, for git or for the publisher.
    const stray = join(h.workspaces, "stray"); mkdirSync(join(stray, ".git"), { recursive: true });
    expect(publishWikiRender({ workbench: stray, hearth: h.hearth, tracked, files: [files[0]!], skipped: [] }).outcome).toBe("written");
  });
  test("refuses config and sensoriums as it refuses the hearth, read by the house root's structure", () => {
    const h = house();
    for (const state of ["config", "sensoriums"]) {
      mkdirSync(join(h.root, state, "inner"), { recursive: true });
      symlinkSync(join(h.root, state, "inner"), join(h.workspaces, state));
      for (const workbench of [join(h.root, state), join(h.workspaces, state)]) {
        expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [files[0]!], skipped: [] })).toThrow(/render-workbench-in-hearth/);
      }
      expect(existsSync(join(h.root, state, "inner", "rendered"))).toBe(false);
    }
    expect(() => publishWikiRender({ workbench: h.root, hearth: h.hearth, tracked: [], files: [files[0]!], skipped: [] })).toThrow(/render-workbench-in-hearth/);
  });
  test("a partial answer names no host path, and the staging folder leaves with the publication", () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    const partial = publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: [], beforeWrite: (name) => { if (name === "nested/b.html") throw new Error(`EACCES at ${workbench}/rendered/nested`); } });
    expect(partial.outcome).toBe("partial");
    expect(JSON.stringify(partial)).not.toContain(h.root);
    expect(readdirSync(join(workbench, "rendered")).filter((n) => n.startsWith(".stage-"))).toEqual([]);
    expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [{ name: ".stage-x/a.html", text: "x", source: "X" }], skipped: [] })).toThrow(/render-path-refused/);
  });
  test("a parent swapped for a symlink mid-publication lands nothing outside the workbench", async () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); const outside = join(h.root, "outside");
    mkdirSync(join(workbench, "rendered", "nested"), { recursive: true }); mkdirSync(outside);
    const nested = join(workbench, "rendered", "nested");
    // The racer swaps rendered/nested between a real folder and a symlink to a folder outside, as fast as it can.
    const racer = spawn(process.execPath, ["-e", `
const fs = require("fs"); const n = ${JSON.stringify(nested)}, out = ${JSON.stringify(outside)};
const end = Date.now() + 4000;
while (Date.now() < end) { try { fs.rmSync(n, { recursive: true, force: true }); fs.symlinkSync(out, n); } catch {} try { fs.unlinkSync(n); fs.mkdirSync(n); } catch {} }
`], { stdio: "ignore" });
    const exited = new Promise((done) => racer.on("exit", done));
    const end = Date.now() + 3500;
    let tries = 0, landed = 0;
    try {
      while (Date.now() < end) {
        tries++;
        try { if (publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [{ name: `nested/f${tries}.html`, text: "x", source: "s" }], skipped: [] }).outcome === "written") landed++; }
        catch { /* a refusal is custody holding */ }
      }
    } finally { racer.kill(); await exited; }
    expect(tries).toBeGreaterThan(100);
    expect(readdirSync(outside)).toEqual([]);
  }, 20_000);
  test("selection budgets and an empty result keep the workbench bounded", () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: Array.from({ length: 129 }, (_, i) => ({ name: `${i}.html`, text: "x", source: `${i}` })), skipped: [] })).toThrow(/render-count-budget/);
    expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [{ name: "large.html", text: "x".repeat(4_194_305), source: "A" }], skipped: [] })).toThrow(/render-byte-budget/);
    expect(existsSync(join(workbench, "rendered", "0.html"))).toBe(false);
    expect(publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [], skipped: ["A"] })).toMatchObject({ outcome: "written", files: [], skipped: ["A"] });
  });
  test("reserves manifest names and refuses overlong path segments before writing", () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    for (const name of [".manifest-forged.json", "a".repeat(256)]) {
      expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [{ name, text: "x", source: "X" }], skipped: [] })).toThrow(/render-path-refused/);
    }
    expect(existsSync(join(workbench, "rendered"))).toBe(false);
  });
  test("rendered exclusion stays anchored to a workbench", () => {
    expect(houseExcludeLines()).not.toContain("rendered/");
    expect(WORKSPACE_EXCLUDE_LINES).toContain("/rendered/");
    expect(REALM_EXCLUDE_LINES).toContain("/wikis/*/rendered/");
  });
  test("an overwrite request gets a distinct receipt and restores the prepared bytes", () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    const initial = publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [files[0]!], skipped: [] });
    writeFileSync(join(workbench, "rendered", "a.html"), "tampered");
    const retry = publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [files[0]!], skipped: [], overwrite: true });
    expect(retry.receipt).not.toBe(initial.receipt);
    expect(readFileSync(join(workbench, "rendered", "a.html"), "utf8")).toBe("first");
  });
  test("an interrupted publication names the partial set; retry completes with the same bytes", () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    const partial = publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: [], beforeWrite: (name) => { if (name === "nested/b.html") throw new Error("interrupted"); } });
    expect(partial).toMatchObject({ outcome: "partial", files: [{ name: "a.html" }], refusal: "interrupted" });
    expect(existsSync(join(workbench, "rendered", "nested", "b.html"))).toBe(false);
    const final = publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: [] });
    expect(final).toMatchObject({ outcome: "written", files: [{ name: "a.html" }, { name: "nested/b.html" }] });
    expect(publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files, skipped: [] })).toEqual(final);
    expect(() => publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [{ name: "a.html", text: "changed", source: "A" }], skipped: [] })).toThrow(/render-overwrite-refused/);
    expect(publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [{ name: "a.html", text: "changed", source: "A" }], skipped: [], overwrite: true }).outcome).toBe("written");
  });
  test("a competing writer cannot turn the no-overwrite grant into a replacement", () => {
    const h = house(); const workbench = join(h.workspaces, "notes"); mkdirSync(workbench);
    const first = publishWikiRender({ workbench, hearth: h.hearth, tracked: [], files: [files[0]!], skipped: [],
      beforeWrite: () => writeFileSync(join(workbench, "rendered", "a.html"), "other writer") });
    expect(first).toMatchObject({ outcome: "partial", files: [] });
    expect(readFileSync(join(workbench, "rendered", "a.html"), "utf8")).toBe("other writer");
  });
});
