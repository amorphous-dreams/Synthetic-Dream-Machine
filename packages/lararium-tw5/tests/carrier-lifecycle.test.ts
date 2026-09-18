/**
 * carrier-lifecycle — the STAGE a governed carrier stands in, and what each stage owes.
 *
 * The lifecycle rides `tags`, the mechanism TiddlyWiki already runs, so `[tag[lifecycle/designed]]`
 * answers in the wiki and a stage RENDERS. A carrier carrying no `lifecycle/*` tag stands UNGOVERNED
 * — law, record, reference — and the gate enforces nothing new on it.
 *
 * ── THE FIXTURES DECLARE NOTHING ────────────────────────────────────────────────────────────────
 * Every carrier text below gets assembled from parts at read time and carries neither a DOCTYPE line
 * nor a bare `type` line, so this file never enters `carrierFiles` and then fails a corpus law
 * on a fixture nobody poured. The CONTROL at the foot of the suite proves it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/otakiage
 */

import { describe, expect, test } from "vitest";

import {
  LIFECYCLE_STAGES,
  readCarrierLifecycle,
  checkCarrierLifecycle,
  RETIRED_META_KEYS,
} from "../src/carrier-lifecycle.js";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { carrierFiles } from "../src/carrier-files.js";
import { REPO } from "./test-wiki.js";

/** A meta fence assembled at read time — the opener joins its label here, never in the source. */
function meta(lines: readonly string[]): string {
  return ["```" + "toml meta", ...lines, "```"].join("\n");
}

/** A carrier body: a meta fence, then whatever slots the case needs. */
function carrier(metaLines: readonly string[], body = ""): string {
  return `${meta(metaLines)}\n\n${body}\n`;
}

const LEANS = (...items: string[]) => ["<<~ ahu #/leans>>", "", ...items, "", "<<~/ahu>>"].join("\n");

describe("carrier-lifecycle — the tag family carries the stage", () => {
  test("the five stages are the whole vocabulary", () => {
    expect([...LIFECYCLE_STAGES]).toEqual(["designed", "standing", "folded", "harvest", "retiring"]);
  });

  test("the stage reads off tags, never off a status key", () => {
    const src = carrier([`tags = ["api/pono/meme", "lifecycle/standing"]`]);
    expect(readCarrierLifecycle(src).stage).toBe("standing");
  });

  /**
   * THE CONTROL THAT MATTERS MOST. 669 of 726 carriers enter no lifecycle at all, and a missing tag
   * MUST read as "this carrier declines the ladder" rather than as a stage. A gate that faulted them
   * would fault the whole shelf.
   */
  test("CONTROL — an untagged carrier stands ungoverned and owes nothing", () => {
    const src = carrier([`tags = ["api/pono/meme"]`], LEANS("# a question stands. `-> ?`"));
    expect(readCarrierLifecycle(src).stage).toBeNull();
    expect(checkCarrierLifecycle(src)).toEqual([]);
  });

  /** A rite names a KIND, never a rung — `talk-story` will never "advance" to standing. */
  test("CONTROL — kind/rite carries no stage and enters no rite", () => {
    const src = carrier([`tags = ["api/pono/meme", "kind/rite"]`]);
    expect(readCarrierLifecycle(src).stage).toBeNull();
    expect(readCarrierLifecycle(src).kinds).toEqual(["rite"]);
    expect(checkCarrierLifecycle(src)).toEqual([]);
  });

  test("a designed carrier may hold an open lean", () => {
    const src = carrier([`tags = ["lifecycle/designed"]`], LEANS("# the fork stands unruled. `-> ?`"));
    expect(checkCarrierLifecycle(src)).toEqual([]);
  });

  test("a standing carrier may NOT hold an open lean", () => {
    const src = carrier([`tags = ["lifecycle/standing"]`], LEANS("# the fork stands unruled. `-> ?`"));
    expect(checkCarrierLifecycle(src)).toEqual([
      "lifecycle/standing: an open lean `-> ?` stands in #/leans — a ruling closes it, or the stage reads designed",
    ]);
  });

  /** The lean law reaches the `#/leans` slot alone; a bearing arrow in prose is not a lean. */
  test("CONTROL — an open arrow outside #/leans is not an open lean", () => {
    const src = carrier([`tags = ["lifecycle/standing"]`], "The turn hands back `-> ?` and waits.");
    expect(checkCarrierLifecycle(src)).toEqual([]);
  });

  test("a folded carrier owes every content slot a fold pointer", () => {
    const body = [
      "<<~ ahu #/one>>",
      "",
      "folded to lar:///ha.ka.ba/lares/api/pono/meme",
      "",
      "<<~/ahu>>",
      "",
      "<<~ ahu #/two>>",
      "",
      "the argument still sits here.",
      "",
      "<<~/ahu>>",
    ].join("\n");
    expect(checkCarrierLifecycle(carrier([`tags = ["lifecycle/folded"]`], body))).toEqual([
      "lifecycle/folded: #/two carries no fold pointer — every slot names where its content went",
    ]);
  });

  test("CONTROL — a folded carrier whose every slot points is clean", () => {
    const body = [
      "<<~ ahu #/one>>",
      "",
      "folded to lar:///ha.ka.ba/lares/api/pono/meme",
      "",
      "<<~/ahu>>",
    ].join("\n");
    expect(checkCarrierLifecycle(carrier([`tags = ["lifecycle/folded"]`], body))).toEqual([]);
  });

  test("a harvest carrier names the living bag it folds into", () => {
    expect(checkCarrierLifecycle(carrier([`tags = ["lifecycle/harvest"]`]))).toEqual([
      'lifecycle/harvest: no harvest-to — name the living bag, harvest-to = "lar:///ha.ka.ba/bags/<bag>"',
    ]);
    const named = carrier([
      `harvest-to = "lar:///ha.ka.ba/bags/lares"`,
      `tags       = ["lifecycle/harvest"]`,
    ]);
    expect(checkCarrierLifecycle(named)).toEqual([]);
    expect(readCarrierLifecycle(named).harvestTo).toBe("lar:///ha.ka.ba/bags/lares");
  });

  /** `retiring` owes ZERO INBOUND, which only the whole shelf can answer — never this reader. */
  test("CONTROL — retiring owes nothing a single file can answer", () => {
    expect(checkCarrierLifecycle(carrier([`tags = ["lifecycle/retiring"]`]))).toEqual([]);
    expect(readCarrierLifecycle(carrier([`tags = ["lifecycle/retiring"]`])).stage).toBe("retiring");
  });

  test("a carrier carrying two stages names the collision", () => {
    const src = carrier([`tags = ["lifecycle/designed", "lifecycle/standing"]`]);
    expect(checkCarrierLifecycle(src)).toEqual([
      "lifecycle: two stages stand — designed, standing; a carrier holds one",
    ]);
  });
});

describe("carrier-lifecycle — the retired keys", () => {
  test("status and retain name themselves retired", () => {
    expect([...RETIRED_META_KEYS]).toEqual(["retain", "status"]);
  });

  test("normalize WARNS on status and leaves the bytes alone", () => {
    const src = carrier([`status = "standing"`, `tags   = ["lifecycle/standing"]`]);
    const res = normalizeMemeSource(src);
    expect(res.flags).toContain("`status` retired — the stage rides `tags`");
    expect(res.text).toContain(`status = "standing"`);
  });

  test("normalize WARNS on retain", () => {
    const res = normalizeMemeSource(carrier([`retain = true`, `tags   = ["api/pono/meme"]`]));
    expect(res.flags).toContain("`retain` retired — the disposition rides the `lifecycle/*` tag");
  });

  /** `cacheable` instructs the API server behind the Lares. No house code reads it and none may. */
  test("CONTROL — cacheable draws no warning", () => {
    const res = normalizeMemeSource(carrier([`cacheable = true`, `tags      = ["api/pono/meme"]`]));
    expect(res.flags).toEqual([]);
  });
});

describe("carrier-lifecycle — a domain field is not a carrier's own key", () => {
  /**
   * A CARRIER'S FIELDS RIDE THE TOP-LEVEL BLOCK ALONE. `open-phases.mem` describes two authority
   * modes in a `[[authority-modes]]` array-of-tables and gives each one a `status` of its own — a
   * DOMAIN field naming what that mode holds, nothing to do with the carrier's standing. A reader
   * scanning the whole fence reads it as the carrier's key and reports a retirement that is not
   * there. `alignMetaTomlColumns` already stops at the first `[`; so does this.
   */
  test("a `status` beneath a [table] header belongs to the table, never to the carrier", () => {
    const src = carrier([
      `tags = ["api/pono/meme"]`,
      ``,
      `[[authority-modes]]`,
      `mode   = "keyhive"`,
      `status = "stub — pending encrypted group sync"`,
    ]);
    expect(readCarrierLifecycle(src).retiredKeys).toEqual([]);
    expect(normalizeMemeSource(src).flags).toEqual([]);
  });

  test("CONTROL — the same key ABOVE the header is the carrier's own, and retires", () => {
    const src = carrier([
      `status = "standing"`,
      `tags   = ["api/pono/meme"]`,
      ``,
      `[[authority-modes]]`,
      `mode = "keyhive"`,
    ]);
    expect(readCarrierLifecycle(src).retiredKeys).toEqual(["status"]);
  });
});

describe("carrier-lifecycle — the fixtures declare nothing", () => {
  /** A fixture that DECLARES is a carrier to every sweep, gate and normalize run in the tree. */
  test("CONTROL — this suite is not itself corpus", () => {
    expect(carrierFiles(REPO).some((f) => f.includes("carrier-lifecycle.test"))).toBe(false);
  });
});
