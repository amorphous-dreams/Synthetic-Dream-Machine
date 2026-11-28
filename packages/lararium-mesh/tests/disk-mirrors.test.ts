/**
 * disk-mirrors.test — the per-wiki working → wikis/{slug} projector mirror.
 *
 * resolveDiskMirrors intersects the held disk grant (AUTHORITY) with the recipe's
 * mirrorBags (DESIGNATION), and slug-expands a per-wiki grant's bag + leaf from the
 * recipe's wikiSlug at mount time — so a `wikiSlot:"working"` grant projects
 * `wikis/{slug}/working` → disk `wikis/{slug}`, while lares/lararium keep their
 * static bags/ roots. OCAP-clean: authority in the grant, designation in the
 * recipe, the per-instance bag + subdir resolved here.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/wiki-layer-ontology (#shore-law)
 */

import { describe, test, expect } from "vitest";
import { resolveDiskMirrors, type DiskMirrorGrant } from "../src/vessel-island-pool-core.js";
import { wikiSlotUri, wikiBagUri } from "@lararium/mesh/wiki-recipe";
import { personaScopedBagIds } from "../src/persona-scope.js";

const LARES = "lar:///ha.ka.ba/bags/lares";

// The node vessel's real grant shape: a `wikiSlot` entry slug-expands BOTH its
// bagId (→ wikis/{slug}/working) and its leaf (→ wikis/{slug}); a literal grant
// (lares) keeps its static root.
const grant: DiskMirrorGrant = [
  { bagId: LARES,      mirrorRoot: "/root/bags/lares", scope: "lares" },
  { bagId: "working",  mirrorRoot: "/root/wikis",       scope: "working",  wikiSlot: "working" },
];

// + the per-wiki CANON authority — a minted wiki's own bags/{slug} bag projects
// to bags/{slug}; system wikis keep their literal roots.
const canonGrant: DiskMirrorGrant = [
  ...grant,
  { bagId: "self",  mirrorRoot: "/root/bags", scope: "self",  perWikiSlug: true, selfCanon: true },
];

describe("resolveDiskMirrors — authority ∩ designation + per-wiki slug expansion", () => {
  test("RED: a face intents bag never gains a mirror root, even when designated; CONTROL: the same grant projects a wiki", () => {
    const intents = personaScopedBagIds("founded-face").intents;
    const wiki = wikiBagUri("garden");
    const roots = resolveDiskMirrors([
      { bagId: intents, mirrorRoot: "/root/bags/intents", scope: "literal" },
      { bagId: wiki, mirrorRoot: "/root/bags/garden", scope: "literal" },
    ], [intents, wiki], "garden");
    expect(roots.some((r) => r.bagId === intents)).toBe(false);
    expect(roots.find((r) => r.bagId === wiki)?.mirrorRoot).toBe("/root/bags/garden");
  });
  test("a wikiSlot grant (working) slug-expands its bag + leaf to wikis/{slug}", () => {
    const workingSlot = wikiSlotUri("myproject", "working");
    const out = resolveDiskMirrors(grant, [LARES, workingSlot], "myproject");
    const working = out.find((m) => m.bagId === workingSlot);
    expect(working?.bagId).toBe("lar:///ha.ka.ba/wikis/myproject/working");
    expect(working?.mirrorRoot).toBe("/root/wikis/myproject");
    // a non-per-wiki grant keeps its static bag + root.
    expect(out.find((m) => m.bagId === LARES)?.mirrorRoot).toBe("/root/bags/lares");
  });

  test("authority ∩ designation — a bag absent from mirrorBags never mirrors", () => {
    const out = resolveDiskMirrors(grant, [LARES], "myproject"); // working slot not designated
    expect(out.map((m) => m.bagId)).toEqual([LARES]);
  });

  test("absent/empty mirrorBags → no mirrors (a designation-less mount writes no disk)", () => {
    expect(resolveDiskMirrors(grant, undefined, "x")).toEqual([]);
    expect(resolveDiskMirrors(grant, [], "x")).toEqual([]);
  });

  describe("self-canon — the minted wiki's own canon → bags/{slug}", () => {
    test("a minted user wiki projects its bags/{slug} canon to bags/{slug}", () => {
      const slug = "my-world";
      const out = resolveDiskMirrors(canonGrant, [wikiSlotUri(slug, "working"), wikiBagUri(slug)], slug);
      const self = out.find((m) => m.bagId === wikiBagUri(slug));
      expect(self?.mirrorRoot).toBe("/root/bags/my-world");
      // the working slot still resolves its own per-slug leaf
      expect(out.find((m) => m.bagId === wikiSlotUri(slug, "working"))?.mirrorRoot).toBe("/root/wikis/my-world");
    });

    test("★ bags/ projects on the Kahu's vessel alone: with no literal grant, a system wiki's canon never reaches disk by self-canon ★", () => {
      // A vessel the Kahu cabal did not admit grants neither literal mirror (the node vessel's grant omits them), so the
      // lares wiki's designated canon finds only the self-canon entry, which refuses system canon.
      for (const slug of ["lares", "lararium"]) {
        const out = resolveDiskMirrors(canonGrant.filter((g) => g.bagId !== LARES), [wikiBagUri(slug), wikiSlotUri(slug, "working")], slug);
        expect(out.some((m) => m.bagId === wikiBagUri(slug))).toBe(false);
        expect(out.find((m) => m.bagId === wikiSlotUri(slug, "working"))?.mirrorRoot).toBe(`/root/wikis/${slug}`);      // its working layer still projects
      }
      // CONTROL: a user wiki of the same shape projects its canon.
      expect(resolveDiskMirrors(canonGrant.filter((g) => g.bagId !== LARES), [wikiBagUri("garden")], "garden").some((m) => m.bagId === wikiBagUri("garden"))).toBe(true);
    });

    test("a system wiki (literal grant covers its slug) never double-projects", () => {
      // the lares wiki designates its own canon (lares) but a literal grant
      // already covers it → self-canon yields nothing, only the literal root.
      const out = resolveDiskMirrors(canonGrant, [LARES, wikiSlotUri("lares", "working")], "lares");
      const laresMirrors = out.filter((m) => m.bagId === LARES);
      expect(laresMirrors).toHaveLength(1);
      expect(laresMirrors[0]?.mirrorRoot).toBe("/root/bags/lares");
    });

    test("self-canon yields nothing unless the recipe designates the own-canon bag", () => {
      // working designated, but NOT the wiki's own canon → no self mirror
      const workingSlot = wikiSlotUri("my-world", "working");
      const out = resolveDiskMirrors(canonGrant, [workingSlot], "my-world");
      expect(out.map((m) => m.bagId)).toEqual([workingSlot]);
    });
  });
});

// THE MIRROR ROOT SPLITS BY ORIGIN (operator ruling, 2026-11-01): a wiki whose bag stands in the canon source projects back
// beside that source (the checkout, for source control); a wiki the house minted for itself projects under the state root.
describe("resolveDiskMirrors — a per-wiki grant's root splits by the slug's origin", () => {
  const split: DiskMirrorGrant = [
    { bagId: "working", mirrorRoot: "/state/wikis", scope: "working", wikiSlot: "working", sourcedRoots: { elyncia: "/workspace/wikis" } },
    { bagId: "self", mirrorRoot: "/state/bags", scope: "self", perWikiSlug: true, selfCanon: true, sourcedRoots: { elyncia: "/workspace/bags" } },
  ];
  test("RED: a sourced slug's working layer and canon project under the source's roots", () => {
    const out = resolveDiskMirrors(split, [wikiSlotUri("elyncia", "working"), wikiBagUri("elyncia")], "elyncia");
    expect(out.find((m) => m.bagId === wikiSlotUri("elyncia", "working"))?.mirrorRoot).toBe("/workspace/wikis/elyncia");
    expect(out.find((m) => m.bagId === wikiBagUri("elyncia"))?.mirrorRoot).toBe("/workspace/bags/elyncia");
  });
  test("CONTROL: a slug with no source stays under the state roots", () => {
    const out = resolveDiskMirrors(split, [wikiSlotUri("notes", "working"), wikiBagUri("notes")], "notes");
    expect(out.find((m) => m.bagId === wikiSlotUri("notes", "working"))?.mirrorRoot).toBe("/state/wikis/notes");
    expect(out.find((m) => m.bagId === wikiBagUri("notes"))?.mirrorRoot).toBe("/state/bags/notes");
  });
});

// ONE FOLDER FOR A WORKBENCH (cabal-realm#/the-workbench; operator, 2026-11-14): a wiki's workbench stands as ONE document on a
// vessel, so its mirror rests in one folder whichever seated writer wears, and a sourced wiki's rests beside its canon source,
// in the repo workspace. Nothing face-private lands beside a canon source.
describe("resolveDiskMirrors — one folder answers a workbench, and nothing face-private rests beside a canon source", () => {
  /** Two faces' roots, by pet name (`faces/<pet name>`). */
  const A = "Heron", B = "Egret";
  /** The node's own grant shape for a wiki's four instance slots, under one worn face: the workbench in its realm pool, the
   *  face-private three in the wearing face's root. */
  const grant = (face: string | null, workspaces: Record<string, string> = {}): DiskMirrorGrant => [
    { bagId: "working", mirrorRoot: "/state/wikis", scope: "working", wikiSlot: "working", sourcedRoots: { lares: "/checkout/wikis" }, workspaceRoots: workspaces },
    { bagId: "personal", mirrorRoot: "/state/faces", scope: "personal", wikiSlot: "personal", faceFolder: () => face },
    { bagId: "draft", mirrorRoot: "/state/faces", scope: "draft", wikiSlot: "draft", faceFolder: () => face },
    { bagId: "temp", mirrorRoot: "/state/faces", scope: "temp", wikiSlot: "temp", consentSlugs: ["lares", "notes"], faceFolder: () => face },
  ];
  const slots = (slug: string): string[] => (["working", "personal", "draft", "temp"] as const).map((k) => wikiSlotUri(slug, k));
  const rootOf = (g: DiskMirrorGrant, slug: string, kind: "working" | "personal" | "draft" | "temp" = "working"): string | undefined =>
    resolveDiskMirrors(g, slots(slug), slug).find((m) => m.bagId === wikiSlotUri(slug, kind))?.mirrorRoot;
  test("two faces of one vessel resolve ONE folder for one wiki, and it names no face", () => {
    expect(rootOf(grant(A), "notes")).toBe("/state/wikis/notes");
    expect(rootOf(grant(B), "notes")).toBe("/state/wikis/notes");
    expect(rootOf(grant(null), "notes")).toBe("/state/wikis/notes");
  });
  test("a sourced wiki's workbench rests beside its canon source for ANY face's wear: no face alone writes back", () => {
    expect(rootOf(grant(A), "lares")).toBe("/checkout/wikis/lares");
    expect(rootOf(grant(B), "lares")).toBe("/checkout/wikis/lares");
  });
  test("nothing face-private lands beside the canon source: personal, draft and temp of a sourced wiki rest in the wearing face's root, and no checkout path names a face", () => {
    for (const face of [A, B]) {
      const resolved = resolveDiskMirrors(grant(face), slots("lares"), "lares");
      expect(rootOf(grant(face), "lares", "personal")).toBe(`/state/faces/${face}/personal/lares`);
      expect(rootOf(grant(face), "lares", "draft")).toBe(`/state/faces/${face}/recovery/lares`);
      expect(rootOf(grant(face), "lares", "temp")).toBe(`/state/faces/${face}/temp/lares`);
      const inCheckout = resolved.filter((m) => m.mirrorRoot.startsWith("/checkout/"));
      expect(inCheckout.map((m) => m.bagId), "the workbench alone rests in the checkout").toEqual([wikiSlotUri("lares", "working")]);
      for (const m of inCheckout) expect(m.mirrorRoot).not.toContain(face);
    }
    // The daemon wiki, face-private whole, resolves no per-wiki mirror through this grant at all.
    expect(resolveDiskMirrors(grant(A), slots("daemon"), "daemon").filter((m) => m.mirrorRoot.startsWith("/checkout/"))).toEqual([]);
  });
  test("a mount that designates no working mirror (a face with no writer's seat) writes nothing into the workbench's folder", () => {
    const unseated = resolveDiskMirrors(grant(A), slots("lares").filter((s) => s !== wikiSlotUri("lares", "working")), "lares");
    expect(unseated.some((m) => m.bagId === wikiSlotUri("lares", "working"))).toBe(false);
    expect(unseated.some((m) => m.mirrorRoot.startsWith("/checkout/"))).toBe(false);
    expect(unseated.find((m) => m.bagId === wikiSlotUri("lares", "personal"))?.mirrorRoot).toBe(`/state/faces/${A}/personal/lares`);
  });
  test("CONTROL: a shared wiki's workbench under an operator workspace keeps its one folder, and the resolved entry carries none of the grant's resolvers", () => {
    expect(rootOf(grant(A, { notes: "/lar/workspaces/field-notes" }), "notes")).toBe("/lar/workspaces/field-notes");
    expect(Object.keys(resolveDiskMirrors(grant(A), [wikiSlotUri("notes", "working")], "notes")[0]!).sort()).toEqual(["bagId", "mirrorRoot", "scope", "wikiSlot"]);
  });
});

// A REALM HOLDS ITS WIKIS UNDER ITS PET NAME (operator rulings 2026-11-19): the node's per-wiki grants read the realm labels at
// each mount (`realmBase`, which mints a realm's default label on first read), so a wiki lays its workbench under
// `realms/<pet>/wikis/<slug>` and its canon bag under `realms/<pet>/bags/<slug>`, never under a plain `wikis/`. A base that names
// no folder (a refusal the host logs) lays none. A workspace a share row binds and a sourced slug's canon source answer first.
describe("resolveDiskMirrors — a realm's pet name roots its wikis and bags", () => {
  const realms: Record<string, string> = {};
  const grant = (workspaces: Record<string, string> = {}): DiskMirrorGrant => [
    { bagId: "working", mirrorRoot: "/state/realms", scope: "working", wikiSlot: "working", sourcedRoots: { elyncia: "/checkout/wikis" }, workspaceRoots: workspaces, realmBase: (slug) => realms[slug] === undefined ? null : `/state/realms/${realms[slug]}/wikis` },
    { bagId: "self", mirrorRoot: "/state/realms", scope: "self", perWikiSlug: true, selfCanon: true, sourcedRoots: { elyncia: "/checkout/bags" }, realmBase: (slug) => realms[slug] === undefined ? null : `/state/realms/${realms[slug]}/bags` },
  ];
  const designation = (slug: string): string[] => [wikiSlotUri(slug, "working"), wikiBagUri(slug)];
  test("a realm base that names no folder lays neither the workbench nor the canon bag", () => {
    expect(resolveDiskMirrors(grant(), designation("notes"), "notes")).toEqual([]);
  });
  test("named: both lay under the realm's pet name, and the resolved entry carries no resolver", () => {
    realms["notes"] = "Garden";
    const out = resolveDiskMirrors(grant(), designation("notes"), "notes");
    expect(out.map((m) => m.mirrorRoot)).toEqual(["/state/realms/Garden/wikis/notes", "/state/realms/Garden/bags/notes"]);
    for (const m of out) expect(Object.keys(m)).not.toContain("realmBase");
    delete realms["notes"];
  });
  test("CONTROL: a workspace and a sourced slug answer before any realm", () => {
    expect(resolveDiskMirrors(grant({ notes: "/lar/workspaces/notes" }), [wikiSlotUri("notes", "working")], "notes")[0]!.mirrorRoot).toBe("/lar/workspaces/notes");
    expect(resolveDiskMirrors(grant(), designation("elyncia"), "elyncia").map((m) => m.mirrorRoot)).toEqual(["/checkout/wikis/elyncia", "/checkout/bags/elyncia"]);
  });
});

test("a draft grant sites designated drafts in the wiki's recovery folder, apart from working", () => {
  const draft = wikiSlotUri("garden", "draft");
  const working = wikiSlotUri("garden", "working");
  const draftGrant = [
    { bagId: "working", mirrorRoot: "/state/wikis", scope: "working", wikiSlot: "working" as const },
    { bagId: "draft", mirrorRoot: "/state/wikis", scope: "draft", wikiSlot: "draft" as const },
  ];
  const mirrors = resolveDiskMirrors(draftGrant, [draft, working], "garden");
  expect(mirrors.find((m) => m.bagId === draft)?.mirrorRoot).toBe("/state/wikis/garden/recovery");
  expect(mirrors.find((m) => m.bagId === working)?.mirrorRoot).toBe("/state/wikis/garden");
  expect(resolveDiskMirrors(draftGrant.slice(0, 1), [draft], "garden")).toEqual([]);
});
