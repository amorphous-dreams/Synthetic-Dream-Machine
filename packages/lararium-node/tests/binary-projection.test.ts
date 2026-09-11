/**
 * binary-projection — a binary filetype (image/PDF) lands as RAW bytes on disk.
 *
 * Two shapes reach the same two files. An INLINE base64 tiddler: the render shore marks
 * `encoding: "base64"`, the projector DECODES the body and writes the real bytes. A POINTER
 * (THE BLOB LAW): the shore hands back `pointerCid` and an empty body; the projector resolves
 * the RAW bytes from the local cid/ tier, verifies `sha256(bytes) == cid`, and writes
 * `photo.png` beside `photo.png.meta` — git-LFS's smudge. Where the tier lacks the bytes the
 * `.meta` lands ALONE and a `photo.png` the projector did not write is never swept. The
 * Synced-tree observation hashes the base64 string (the carrier form the ingest gesture
 * reads), so the echo gate compares like with like.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey } from "../src/index.js";
import { carrierHash } from "@lararium/mesh";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe, 0x01]);
const CID = createHash("sha256").update(PNG).digest("hex");
const META = `_integrity: ni:///sha-256;x\n_is_skinny: yes\nsize: ${PNG.length}\ntextCid: ${CID}\ntitle: lar:///ha.ka.ba/lares/api/photo\ntype: image/png`;
const flushOf = (p: LarDiskProjector) => (p as unknown as { flush: (b: string, u: string) => Promise<void> }).flush.bind(p);

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

describe("binary projection — base64 body decodes to raw bytes on disk", () => {
  test("a base64 carrier writes the decoded image bytes + a .meta sidecar", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-binproj-"));
    // A tiny PNG-ish byte sequence (a real signature + noise) — the point is that
    // it is NOT valid utf8, so a utf8 write would mangle it.
    const rawBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe, 0x01]);
    const b64 = rawBytes.toString("base64");

    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "lares", mirrorRoot: root }],
      carrierFileFn: async () => ({ ext: ".png", body: b64, metaBody: "type: image/png\n", encoding: "base64" }),
      debounceMs: 1,
    });
    await (projector as unknown as { flush: (b: string, u: string) => Promise<void> })
      .flush("lares", "lar:///ha.ka.ba/lares/api/pic");

    const file = join(root, "ha.ka.ba/lares/api/pic.png");
    expect(existsSync(file)).toBe(true);
    // the file holds the RAW decoded bytes — byte-identical to the source
    expect(readFileSync(file).equals(rawBytes)).toBe(true);
    // and the .meta sidecar carries the fields as utf8
    expect(existsSync(file + ".meta")).toBe(true);
    expect(readFileSync(file + ".meta", "utf8")).toContain("image/png");
  });
});

describe("THE POINTER projects as the WHOLE FILE beside its .meta", () => {
  test("★ bytes the local cid/ holds → photo.png (raw, verified) + photo.png.meta; the observation hashes the base64 form ★", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-ptrproj-"));
    const tree = new SyncedTree(join(root, "synced-tree.json"));
    const asked: string[] = [];
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "lares", mirrorRoot: root }],
      carrierFileFn: async () => ({ ext: ".png", body: "", metaBody: META, encoding: "base64", pointerCid: CID }),
      resolveByCid: async (cid) => { asked.push(cid); return cid === CID ? new Uint8Array(PNG) : null; },
      syncedTree: tree,
      debounceMs: 1,
    });
    await flushOf(projector)("lares", "lar:///ha.ka.ba/lares/api/photo");

    const file = join(root, "ha.ka.ba/lares/api/photo.png");
    expect(asked).toEqual([CID]);
    expect(readFileSync(file).equals(PNG)).toBe(true);
    expect(readFileSync(file + ".meta", "utf8")).toBe(META);
    expect(tree.get(syncedTreeKey("lares", "lar:///ha.ka.ba/lares/api/photo"))).toBe(carrierHash(PNG.toString("base64"), META));
  });

  test("★ bytes the tier LACKS → the .meta lands ALONE, and a photo.png the projector did not write stays ★", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-ptrproj-"));
    const dir = join(root, "ha.ka.ba/lares/api");
    mkdirSync(dir, { recursive: true });
    const foreign = Buffer.from("an operator-laid file the projector never wrote");
    writeFileSync(join(dir, "photo.png"), foreign);
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "lares", mirrorRoot: root }],
      carrierFileFn: async () => ({ ext: ".png", body: "", metaBody: META, encoding: "base64", pointerCid: CID }),
      resolveByCid: async () => null,
      debounceMs: 1,
    });
    await flushOf(projector)("lares", "lar:///ha.ka.ba/lares/api/photo");
    expect(readFileSync(join(dir, "photo.png.meta"), "utf8")).toBe(META);
    expect(readFileSync(join(dir, "photo.png")).equals(foreign)).toBe(true);
  });

  test("bytes that fail `sha256(bytes) == cid` never reach disk — the .meta lands alone", async () => {
    root = mkdtempSync(join(tmpdir(), "lar-ptrproj-"));
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "lares", mirrorRoot: root }],
      carrierFileFn: async () => ({ ext: ".png", body: "", metaBody: META, encoding: "base64", pointerCid: CID }),
      resolveByCid: async () => new Uint8Array(Buffer.from("tampered")),
      debounceMs: 1,
    });
    await flushOf(projector)("lares", "lar:///ha.ka.ba/lares/api/photo");
    expect(existsSync(join(root, "ha.ka.ba/lares/api/photo.png"))).toBe(false);
    expect(existsSync(join(root, "ha.ka.ba/lares/api/photo.png.meta"))).toBe(true);
  });
});
