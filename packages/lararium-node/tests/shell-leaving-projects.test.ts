/**
 * shell-leaving-projects — a shell's record of leaving rests in the face's daemon working layer and projects to the face's root
 * (`faces/<pet name>/wikis/daemon/`), which a re-found leaves standing. Its title rests outside every residency ledger, so the
 * projector's audit skip (`isEffectRecordUri`) never holds it back (lar:///ha.ka.ba/lararium/api/residency-model#/effect-record-surface).
 * The carrier's own bytes round-trip in the tw5 suite (`shell-leaving-carrier.test.ts`).
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { daemonWorkingMirror } from "../src/bag-paths.js";
import { isEffectRecordUri } from "@lararium/mesh/effect-record";
import { retiredShellUri } from "@lararium/mesh/shell-leaving-record";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import type { CarrierFile } from "@lararium/tw5";

const DAEMON_WORKING = wikiSlotUri("daemon", "working");
const SITE = { relation: "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31", segment: "Heron" };
type Flushable = { flush: (b: string, u: string) => Promise<void> };

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

function rig(): Flushable {
  root = mkdtempSync(join(tmpdir(), "lar-shell-leaving-"));
  const file: CarrierFile = { ext: ".txt", body: "{}\n" };
  return new LarDiskProjector({ mirrors: [daemonWorkingMirror(root, SITE)], carrierFileFn: async () => file }) as unknown as Flushable;
}
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

describe("the record of leaving projects with the face's memory", () => {
  test("★ `shell-leavings/<slug>` in wikis/daemon/working projects under faces/<pet name>/wikis/daemon/ ★", async () => {
    const title = retiredShellUri("elyncia-referee");
    expect(isEffectRecordUri(title)).toBe(false);
    await rig().flush(DAEMON_WORKING, title);
    const face = join(root, "faces", "Heron", "wikis", "daemon");
    expect(existsSync(face)).toBe(true);
    expect(walk(face).some((f) => f.includes("shell-leavings") && f.endsWith(".txt")), walk(face).join("\n")).toBe(true);
  });

});
