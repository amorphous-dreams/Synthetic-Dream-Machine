/**
 * ruled-siting — a `$:/config/FileSystemPaths` rule sites a carrier, and the projector honours it.
 *
 * The render shore (`exportCarrierFile`) hands back `relPath` ONLY when a siting rule reached the
 * title; the projector then writes there, remembers the siting per mirror (the stock adaptor's
 * `$tw.boot.files` memory), unlinks the previous files when a rule moves a carrier, and unlinks
 * at the remembered path on delete — when the tiddler is gone and no rule can be re-run. With no
 * rule the loci law sites `lar:///w.w.w/…` at its uri-path, as before.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import type { CarrierFile } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const URI = "lar:///ha.ka.ba/lares/parity/note";
type Flushable = { flush: (b: string, u: string) => Promise<void>; _scheduleUnlinkByTitle: (t: string) => Promise<void> };

function rig(file: () => CarrierFile | null): { projector: Flushable; root: string } {
  root = mkdtempSync(join(tmpdir(), "lar-ruled-siting-"));
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "lares", mirrorRoot: root }],
    carrierFileFn: async () => file(),
    debounceMs: 1,
  }) as unknown as Flushable;
  return { projector, root };
}

describe("ruled siting — the projector sites where the FileSystemPaths rule says", () => {
  test("★ a ruled relPath wins over the loci law ★", async () => {
    const { projector, root } = rig(() => ({ ext: ".md", body: "# note", metaBody: "type: text/markdown\n", relPath: "notes/note.md" }));
    await projector.flush("lares", URI);
    expect(existsSync(join(root, "notes/note.md"))).toBe(true);
    expect(existsSync(join(root, "notes/note.md.meta"))).toBe(true);
    expect(existsSync(join(root, "ha.ka.ba/lares/parity/note.md"))).toBe(false);
  });

  test("no rule: the loci law sites the uri-path, as before", async () => {
    const { projector, root } = rig(() => ({ ext: ".md", body: "# note", metaBody: "type: text/markdown\n" }));
    await projector.flush("lares", URI);
    expect(readFileSync(join(root, "ha.ka.ba/lares/parity/note.md"), "utf8")).toBe("# note");
  });

  test("a rule that moves a carrier unlinks its previous files (cleanupTiddlerFiles)", async () => {
    let relPath: string | undefined = "a/note.md";
    const { projector, root } = rig(() => ({ ext: ".md", body: "# note", metaBody: "type: text/markdown\n", ...(relPath ? { relPath } : {}) }));
    await projector.flush("lares", URI);
    expect(existsSync(join(root, "a/note.md"))).toBe(true);
    relPath = "b/note.md";
    await projector.flush("lares", URI);
    expect(existsSync(join(root, "b/note.md"))).toBe(true);
    expect(existsSync(join(root, "a/note.md"))).toBe(false);
    expect(existsSync(join(root, "a/note.md.meta"))).toBe(false);
  });

  test("★ a delete unlinks at the REMEMBERED siting — the rule cannot be re-run for a gone tiddler ★", async () => {
    const { projector, root } = rig(() => ({ ext: ".md", body: "# note", metaBody: "type: text/markdown\n", relPath: "notes/note.md" }));
    await projector.flush("lares", URI);
    await projector._scheduleUnlinkByTitle(URI);
    expect(existsSync(join(root, "notes/note.md"))).toBe(false);
    expect(existsSync(join(root, "notes/note.md.meta"))).toBe(false);
  });

  test("a ruled path that escapes the mirror is refused by the disk ward, loudly", async () => {
    const refusals: string[] = [];
    root = mkdtempSync(join(tmpdir(), "lar-ruled-siting-"));
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "lares", mirrorRoot: root }],
      carrierFileFn: async () => ({ ext: ".md", body: "# note", relPath: "../escape.md" }),
      debounceMs: 1,
      onRefusal: (r) => refusals.push(r.reason),
    }) as unknown as Flushable;
    await projector.flush("lares", URI);
    expect(refusals).toHaveLength(1);
    expect(existsSync(join(root, "..", "escape.md"))).toBe(false);
  });
});
