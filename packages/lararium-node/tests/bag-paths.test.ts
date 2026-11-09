import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { carrierBaseRelPath, projectionRoots, daemonWorkingMirror } from "../src/bag-paths.js";

describe("carrierBaseRelPath — the extension-less carrier siting function", () => {
  // Post-#37: the siting returns the carrier's base path with NO extension — the caller adds the
  // filetype's own (a .mem/.tid/.md all site at the same uri-path, only the extension differs).

  test("a stable name sites at its full uri-path (no extension)", () => {
    expect(carrierBaseRelPath("lar:///ha.ka.ba/lares/api/pono/meme"))
      .toBe("ha.ka.ba/lares/api/pono/meme");
  });

  test("a FOREIGN name sites whole — any bag holds any name (the crack, closed)", () => {
    expect(carrierBaseRelPath("lar:///ha.ka.ba/bags/other/v2/notes/thing"))
      .toBe("ha.ka.ba/bags/other/v2/notes/thing");
  });

  test("fragments live inside their parent carrier — null", () => {
    expect(carrierBaseRelPath("lar:///ha.ka.ba/lares/api/pono/meme#head")).toBeNull();
  });

  test("unstable or rootless forms carry no siting", () => {
    expect(carrierBaseRelPath("lar:///nope/x")).toBeNull();
    expect(carrierBaseRelPath("$:/temp/x")).toBeNull();
  });

  test("unstable attitude roots DO site when projected (session-bag adoption path)", () => {
    expect(carrierBaseRelPath("lar:///threshold.uncertain.opens/note"))
      .toBe("threshold.uncertain.opens/note");
  });
});

describe("the projection pre-check — what the founding rite reads before it trusts the layout", () => {
  const TAG = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
  const made: string[] = [];
  afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const fixtureCanon = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "bag-paths-canon-"));
    made.push(dir);
    for (const slug of ["lares", "lararium"]) mkdirSync(join(dir, "bags", slug), { recursive: true });
    return join(dir, "bags");
  };

  test("a canon source sources no `daemon` slug, and the daemon working mirror lands under the projections root as daemon-<tag>", () => {
    const canonBags = fixtureCanon();
    const roots = projectionRoots({ projectionRoot: "/state", canonBags });
    expect(roots.sourcedSlugs()).not.toContain("daemon");
    expect(daemonWorkingMirror("/state", TAG).mirrorRoot).toBe(`/state/wikis/daemon-${TAG}`);
  });

  test("the checkout's real bags/ sources no `daemon` slug either", () => {
    const realBags = join(import.meta.dirname, "..", "..", "..", "bags");
    const roots = projectionRoots({ projectionRoot: "/state", canonBags: realBags });
    expect(roots.sourcedSlugs().length, "the checkout's bags/ stands").toBeGreaterThan(0);
    expect(roots.sourcedSlugs()).not.toContain("daemon");
  });

  test("CONTROL: a sourced slug lands under the canon parent, its wiki beside the canon source", () => {
    const canonBags = fixtureCanon();
    const roots = projectionRoots({ projectionRoot: "/state", canonBags });
    expect(roots.sourcedSlugs()).toContain("lares");
    expect(roots.bagRoot("lares")).toBe(join(canonBags, "lares"));
    expect(roots.wikisRootFor("lares")).toBe(join(dirname(canonBags), "wikis"));
    expect(roots.wikisRootFor("daemon")).toBe("/state/wikis");
  });
});
