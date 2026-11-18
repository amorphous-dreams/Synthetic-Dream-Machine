/**
 * keep-house-only — THE KEEP CUTS HOUSE-ONLY CONTENT (K2). A sourced wiki's one workbench folder rests beside the canon
 * source; where that folder rests inside the checkout, git already holds it, so a KEEP leaves it out and names it under the
 * manifest's `elsewhere`. The rule reads where each mirror rests, never a slug list; a plain export keeps carrying it.
 *
 *   H1  a keep over a house whose sourced workbench rests in the checkout (`<checkout>/wikis/lares`) carries none of its files
 *       and names it under `elsewhere` (its slug, its working bag, the checkout-relative place); every house-only class rides whole;
 *   H2  the same workbench resting OUTSIDE the checkout (a house with no checkout beside its canon) still rides the keep, and
 *       `elsewhere` names nothing;
 *   H3  a plain export (no keep) over the checkout's workbench carries it as before, and names no `elsewhere`.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { houseExport, type BundleDoors } from "../src/commands/house-bundle.js";
import { verifyBundle } from "../src/bundle-manifest.js";

const F1 = "11111111-1111-4111-8111-111111111111";
const tid = (title: string, text: string): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${text}\n`;
let root: string, out: string;
const put = (rel: string, text: string): void => { const p = join(root, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };

/** The checkout's own `wikis/` dir and the first sourced workbench standing there, read only. */
const checkoutWikis = join(repoRoot, "wikis");
const SOURCED = readdirSync(checkoutWikis, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()[0]!;

function doors(canonWikis: string): BundleDoors {
  const no = async (): Promise<never> => { throw new Error("no import here"); };
  return {
    census: async () => ({ clean: true, items: [], unanswered: [] }),
    faces: async () => [{ handleIndex: 0, petname: "steward", relation: F1, handle: null, seat: false, chair: null, kahua: [] }],
    tempConsented: () => [],
    rename: no, declareHandle: no, standSeat: no, ingest: no, mintBag: no, kahuaLift: no,
    heldSlugs: async () => new Set<string>(),
    canonWikis: () => canonWikis,
    sourced: (slug) => slug === SOURCED,
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-keep-house-only-"));
  writeFileSync(join(root, ".lar-test-scratch"), "keep house-only suite\n");
  process.env["LAR_ROOT"] = root;
  out = join(root, "workspaces", "backup", "house");
  mkdirSync(dirname(out), { recursive: true });
  // House-only classes: the face's daemon working layer, its kahua stage, a user wiki's workbench, a minted bag.
  put(`projections/wikis/daemon-${F1}/ha.ka.ba/kahua/memory/heron.tid`, tid("lar:///ha.ka.ba/kahua/memory/heron", "remember the heron"));
  put(`projections/bags/kahua-${F1}/ha.ka.ba/kahua/memory/heron.tid`, tid("lar:///ha.ka.ba/kahua/memory/heron", "remember the heron"));
  put("projections/wikis/notes/ha.ka.ba/notes/pond.tid", tid("lar:///ha.ka.ba/notes/pond", "the pond at dusk"));
  put("projections/bags/garden/ha.ka.ba/garden/rose.tid", tid("lar:///ha.ka.ba/garden/rose", "a rose"));
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const workspace = (): string => join(root, "workspaces", "backup");
const houseOnly = ["faces/f0/working/ha.ka.ba/kahua/memory/heron.tid", "faces/f0/kahua/ha.ka.ba/kahua/memory/heron.tid", "wikis/notes/working/ha.ka.ba/notes/pond.tid", "bags/garden/ha.ka.ba/garden/rose.tid"];

describe("the keep cuts house-only content", () => {
  test("H1 RED: a keep leaves a workbench resting in the checkout out and names it under `elsewhere`; CONTROL: every house-only class rides whole", async () => {
    expect(existsSync(join(checkoutWikis, SOURCED))).toBe(true);
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: doors(checkoutWikis), workspace: workspace(), houseOnly: true });
    expect(manifest.files.filter((f) => f.path.startsWith(`wikis/${SOURCED}/`))).toEqual([]);
    expect(manifest.elsewhere).toEqual([{ slug: SOURCED, layer: "wiki-working", bag: `lar:///ha.ka.ba/wikis/${SOURCED}/working`, holder: "checkout", path: relative(repoRoot, join(checkoutWikis, SOURCED)).split("\\").join("/") }]);
    for (const p of houseOnly) expect(manifest.files.map((f) => f.path)).toContain(p);
    expect(verifyBundle(out).manifest.elsewhere).toEqual(manifest.elsewhere);
  });

  test("H2 RED-CONTROL: the same workbench resting outside the checkout still rides the keep, and `elsewhere` names nothing", async () => {
    const outside = join(root, "canon", "wikis");
    put(`canon/wikis/${SOURCED}/ha.ka.ba/x/page.tid`, tid("lar:///ha.ka.ba/x/page", "a page"));
    const { manifest } = await houseExport(out, { acceptOmissions: false, doors: doors(outside), workspace: workspace(), houseOnly: true });
    expect(manifest.files.map((f) => f.path)).toContain(`wikis/${SOURCED}/working/ha.ka.ba/x/page.tid`);
    expect(manifest.elsewhere ?? []).toEqual([]);
  });

  test("H3 CONTROL: a plain export carries the checkout's workbench as before and names no `elsewhere`", async () => {
    const plain = join(mkdtempSync(join(tmpdir(), "lar-keep-plain-out-")), "bundle");
    try {
      const { manifest } = await houseExport(plain, { acceptOmissions: false, doors: doors(checkoutWikis) });
      expect(manifest.files.some((f) => f.path.startsWith(`wikis/${SOURCED}/working/`))).toBe(true);
      expect(manifest.elsewhere).toBeUndefined();
    } finally { rmSync(dirname(plain), { recursive: true, force: true }); }
  });
});
