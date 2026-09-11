/**
 * cas-read.test.ts — `lares bag cas`, the inspection read over the cleartext `cid/` tier.
 *
 * Pure local inspection, no daemon: it lists the CAS dir's blobs and DERIVES which of them the disk
 * projection references (a `.tid` / `.meta` under bags/ or wikis/ carrying `textCid`, or a
 * `lar:///…/cid/<hash>` `_canonical_uri`), then reports blobs · referenced · unreferenced · bytes,
 * naming the genesis-manifest blobs as protected. It never sweeps — the sweep runs where the
 * composite stands (the daemon), off the authoritative `casReferences(composite.entries())`.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const ROOT = mkdtempSync(join(tmpdir(), "lr-cas-read-"));
const CAS  = join(ROOT, "cas");
const cidOf = (s: string): string => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

let readCas: (opts: { casDir: string; bagsDir: string; wikisDir: string; genesisDir: string }) => {
  blobs: number; referenced: number; unreferenced: number; pending: number; bytes: number;
  protected: string[]; entries: { cid: string; size: number; refs: string[]; protected: boolean }[];
};

beforeAll(async () => {
  mkdirSync(CAS, { recursive: true });
  ({ readCas } = await import("../src/commands/cas.js"));
});
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("lares bag cas — blobs · referenced · unreferenced · bytes, references derived from the projection", () => {
  test("a projected pointer references its blob; an orphan reads unreferenced; a genesis cid reads protected", () => {
    const held = "held png bytes", orphan = "orphan bytes", core = "engine core";
    for (const s of [held, orphan, core]) writeFileSync(join(CAS, cidOf(s)), s);
    const bagDir = join(ROOT, "bags/lares/t.w.b");
    mkdirSync(bagDir, { recursive: true });
    writeFileSync(join(bagDir, "photo.tid"), `_is_skinny: yes\ntextCid: ${cidOf(held)}\ntitle: lar:///t.w.b/photo\ntype: image/png\n\n`);
    const genesisDir = join(ROOT, "genesis");
    mkdirSync(genesisDir, { recursive: true });
    writeFileSync(join(genesisDir, "island.manifest.json"), JSON.stringify({
      format: "lararium-genesis-cas/v1", engineCid: "", pluginsCid: "",
      blobs: [{ cid: cidOf(core), id: "tiddlywikicore", mimeType: "application/javascript", version: "1" }],
    }));
    const r = readCas({ casDir: CAS, bagsDir: join(ROOT, "bags"), wikisDir: join(ROOT, "wikis"), genesisDir });
    expect(r.blobs).toBe(3);
    expect(r.referenced).toBe(1);
    expect(r.unreferenced).toBe(2);
    expect(r.pending).toBe(0);
    expect(r.bytes).toBe(held.length + orphan.length + core.length);
    expect(r.protected).toEqual([cidOf(core)]);
    const heldRow = r.entries.find((e) => e.cid === cidOf(held));
    expect(heldRow?.refs).toEqual(["bags/lares/t.w.b/photo.tid"]);
    expect(r.entries.find((e) => e.cid === cidOf(orphan))?.refs).toEqual([]);
    expect(r.entries.find((e) => e.cid === cidOf(core))?.protected).toBe(true);
  });
});
