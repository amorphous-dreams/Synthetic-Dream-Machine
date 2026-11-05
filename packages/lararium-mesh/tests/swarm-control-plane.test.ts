/**
 * swarm-control-plane — the swarm's live controls rest in the daemon wiki under `$:/lares/swarm/`, and that prefix reads as
 * control plane: no mirror projects it, the kahua stage refuses to lift it, and `neverProjects` names it so a file standing at
 * such an address never ingests.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, test, expect } from "vitest";
import { isControlPlaneUri } from "../src/lar-uris.js";
import { neverProjects } from "../src/verb-tiddler.js";

const TITLES = ["house-cap", "lane/lane-a/share", "go/feature%2Fx", "lane/lane-a/state", "roster/seat-1", `receipt/${"a".repeat(40)}`].map((t) => `$:/lares/swarm/${t}`);

describe("the swarm prefix is control plane", () => {
  test("RED: every swarm title reads as control plane and never projects; every spelling that resolves under the prefix does too", () => {
    for (const title of [...TITLES, "$:/lares/./swarm/go/x", "$:/lares/other/../swarm/go/x", "$:/lares/%73warm/go/x", "$:/lares//swarm/go/x"]) {
      expect(isControlPlaneUri(title), title).toBe(true);
      expect(neverProjects(title), title).toBe(true);
    }
  });

  test("CONTROL: a title beside the prefix, a TW5 system title and a plain title read as neither", () => {
    for (const title of ["$:/lares/swarmish/x", "$:/lares/swarm", "$:/lares/other/x", "$:/lares/swarm/../other/x", "$:/core/x", "Plain Note"]) {
      expect(isControlPlaneUri(title), title).toBe(false);
      expect(neverProjects(title), title).toBe(false);
    }
  });
});
