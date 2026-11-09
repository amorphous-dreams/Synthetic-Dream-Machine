/**
 * projection-filter-equivalence — THE ONE RULE gives the verdicts the hand-written matchers gave.
 *
 * The projection filters (`projection-filter.ts`) replaced six hand matchers. Each old matcher stands below VERBATIM as a
 * reference (its measured semantics, frozen here and nowhere in the product), and a table of titles (every family, encoded
 * and `..`-laden spellings, near misses that must project) runs through both:
 *
 *   E1  every mirror's verdict equals the old projector filter (`neverOnDisk`) for the four mirror shapes;
 *   E2  the thin predicates agree: `isDaemonCanonWithheld` and `isTempLayerInternalTitle` give the old verdict OR the base
 *       filter's (the base family every mirror already withheld), `neverProjects` covers its old families;
 *   E3  editing a filter's text changes a verdict: a family added stops projecting, a run taken away projects again;
 *   E4  an operator outside the subset, or a torn text, withholds rather than guess.
 */
import { describe, test, expect } from "vitest";
import { PROJECTION_FILTER, PROJECTION_FILTER_TEXT, projectionFilterTitle, projectionWithheld, filterSelects, ProjectionFilterUnreadable } from "../src/projection-filter.js";
import { isDaemonCanonWithheld, resolvedTitlePath } from "../src/lar-uris.js";
import { neverProjects } from "../src/verb-tiddler.js";

// ── the old matchers, verbatim (measured 2026-11-08) ──────────────────────────────────────────────────────────────
const D = "lar:///ha.ka.ba/bags/daemon";
const oldSwarm = (t: string) => t.startsWith("$:/lares/swarm/") || resolvedTitlePath(t).startsWith("$:/lares/swarm/");
const oldControl = (t: string) => resolvedTitlePath(t).startsWith(`${D}/`) || oldSwarm(t);
const oldVolatile = (t: string) => t.startsWith("lar:///lararium.local.vm/");
const oldEffect = (t: string) => /^lar:\/\/\/[^/]+\/.+\/ledger\/residency\/[^/]+$/.test(t);
const oldManifest = (t: string) => /^lar:\/\/\/ha\.ka\.ba\/bags\/[^/#?]+$/.test(t);
const oldRealm = (t: string) => t.startsWith("lar:///ha.ka.ba/dreamnet/realm-bag-announce/");
const oldNexusHandles = (t: string) => t.startsWith("lar:///ha.ka.ba/bags/nexus/") && t.endsWith("/handles");
const oldTempInternal = (t: string) => oldVolatile(t) || t.startsWith("$:/") || t.startsWith("lar:///ha.ka.ba/lararium/config/");
const oldDaemonWithheld = (t: string) => {
  if (oldControl(t) || t.startsWith("$:/")) return true;
  const p = resolvedTitlePath(t);
  return p.startsWith("lar:///ha.ka.ba/bags/") || p.startsWith("lar:///ha.ka.ba/dreamnet/") || p.startsWith("$:/");
};
const oldNeverProjects = (t: string) => t.startsWith(`${D}/receipts/`) || t.startsWith(`${D}/summons/`) || t.startsWith(`${D}/ledger/ward/`) || oldSwarm(t);
interface Mirror { daemon?: boolean; temp?: boolean; guard?: boolean }
const oldNeverOnDisk = (m: Mirror, t: string) =>
  (m.guard === true && oldNexusHandles(t)) || oldVolatile(t) || (m.temp === true && oldTempInternal(t)) || oldEffect(t) || oldControl(t)
  || (m.daemon === true && oldDaemonWithheld(t)) || oldRealm(t) || oldManifest(t);
const classesOf = (m: Mirror) => [...(m.daemon ? ["daemon" as const] : []), ...(m.temp ? ["temp" as const] : []), ...(m.guard ? ["nexus-handles" as const] : [])];
const base = (t: string) => projectionWithheld(t);

const TITLES = [
  // the control plane, every spelling
  `${D}/outcomes/req-1`, `${D}/cap/0123/abc`, `${D}/receipts/r1`, `${D}/summons/s1`, `${D}/ledger/ward/w1`, `${D}/pin/x`,
  "lar:///ha.ka.ba/bags/%64aemon/outcomes/o", "lar:///ha.ka.ba/kahua/../bags/daemon/flows/f", "LAR:///ha.ka.ba/bags/daemon/x",
  "lar:///ha.ka.ba/bags/./daemon/x", "lar:///ha.ka.ba//bags/daemon/x", "lar:///ha.ka.ba/bags/daemon", "lar:///ha.ka.ba/bags/daemonic/x",
  "$:/lares/swarm/lanes/one", "$:/lares/swarm/../x", "$:/lares/x/../swarm/y", "$:/lares/swarmy",
  // the house identity families
  "lar:///ha.ka.ba/bags/persona/group-secret/abc", "lar:///ha.ka.ba/bags/persona/binding/signer-did", "lar:///ha.ka.ba/dreamnet/dyad/d1",
  "lar:///ha.ka.ba/dreamnet/face-founding-checkpoint/c1", "lar:///ha.ka.ba/dreamnet/persona-act/g/1/x", "lar:///ha.ka.ba/kahua/../dreamnet/x",
  "lar:///ha.ka.ba/%62ags/persona/x", "lar:///ha.ka.ba/dreamnetwork/x",
  // volatile, effect, manifest, realm, nexus handles
  "lar:///lararium.local.vm/verbs/v1", "lar:///lararium.local.vmx/y", "lar:///ha.ka.ba/bags/garden/ledger/residency/e1",
  "lar:///ha.ka.ba/wikis/x/working/ledger/residency/e2", "lar:///ha.ka.ba/ledger/residency/e3", "lar:///ha.ka.ba/bags/garden/ledger/residency/e/4",
  "lar:///ha.ka.ba/bags/garden", "lar:///ha.ka.ba/bags/garden#x", "lar:///ha.ka.ba/bags/", "lar:///ha.ka.ba/bags/garden/rose",
  "lar:///ha.ka.ba/dreamnet/realm-bag-announce/r1", "lar:///ha.ka.ba/bags/nexus/abc/handles", "lar:///ha.ka.ba/bags/nexus/abc/handlesx",
  // TiddlyWiki system and the house config plane
  "$:/temp/x", "$:/state/folded/y", "$:/StoryList", "$:/core", "$:/config/lares/ProjectionFilter", "lar:///ha.ka.ba/lararium/config/current-wiki-temp",
  "lar:///ha.ka.ba/lararium/configx",
  // near misses that must project everywhere
  "lar:///ha.ka.ba/kahua/memory/heron", "lar:///ha.ka.ba/lares/docs/x", "A Plain Note", "Draft of 'x'", "lar:///ha.ka.ba/notes/%2e%2e/pond",
  "", "lar://alias:grant@host/a.b.c/x", "lar:///ha.ka.ba/kahua/memory/bags/daemon/x",
];
const MIRRORS: Mirror[] = [{}, { daemon: true }, { temp: true }, { guard: true }, { temp: true, guard: true }];

describe("the projection filters give the old matchers' verdicts", () => {
  test("E1 — every mirror shape: the filters equal the old projector filter, title for title", () => {
    for (const m of MIRRORS) for (const t of TITLES) expect(projectionWithheld(t, classesOf(m)), `${JSON.stringify(m)} ${t}`).toBe(oldNeverOnDisk(m, t));
  });

  test("E2 — the thin predicates: the old verdict, or the base family every mirror already withheld", () => {
    for (const t of TITLES) {
      expect(isDaemonCanonWithheld(t), t).toBe(oldDaemonWithheld(t) || base(t));
      expect(projectionWithheld(t, ["temp"]), t).toBe(oldTempInternal(t) || base(t));
      if (oldNeverProjects(t)) expect(neverProjects(t), t).toBe(true);
      expect(neverProjects(t), t).toBe(base(t));
    }
  });

  test("E2 — the near misses project through every mirror", () => {
    for (const t of ["lar:///ha.ka.ba/kahua/memory/heron", "A Plain Note", "lar:///ha.ka.ba/bags/garden/rose", "lar:///ha.ka.ba/kahua/memory/bags/daemon/x"]) {
      for (const m of [{}, { guard: true }]) expect(projectionWithheld(t, classesOf(m)), t).toBe(false);
    }
  });

  test("E3 — editing a filter changes the verdict: a family added stops projecting; a run taken away projects again", () => {
    const memory = "lar:///ha.ka.ba/kahua/memory/heron";
    expect(projectionWithheld(memory, ["daemon"])).toBe(false);
    const added = (title: string) => (title === projectionFilterTitle("daemon") ? `${PROJECTION_FILTER_TEXT.daemon}\n[prefix[lar:///ha.ka.ba/kahua/memory/]]` : undefined);
    expect(projectionWithheld(memory, ["daemon"], added)).toBe(true);
    const outcome = `${D}/outcomes/req-1`;
    const lifted = (title: string) => (title === PROJECTION_FILTER ? PROJECTION_FILTER_TEXT.base.split("\n").filter((r) => !r.includes("bags/daemon/")).join("\n") : undefined);
    expect(projectionWithheld(outcome, [], lifted)).toBe(false);
    expect(projectionWithheld(outcome)).toBe(true);
  });

  test("E4 — an operator outside the subset, or a torn text, withholds", () => {
    expect(() => filterSelects("[tag[x]]", "a")).toThrow(ProjectionFilterUnreadable);
    expect(() => filterSelects("[prefix[a]", "a")).toThrow(ProjectionFilterUnreadable);
    expect(projectionWithheld("A Plain Note", [], (t) => (t === PROJECTION_FILTER ? "[tag[x]]" : undefined))).toBe(true);
  });
});
