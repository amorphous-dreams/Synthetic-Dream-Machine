/**
 * Node's startup face consumes the seed-derived CAS inventory from the filesystem.
 * The worker must receive only hash-valid immutable bytes, including when a prior
 * runtime CAS already has a file under a named CID.
 */
import { afterEach, describe, expect, test } from "vitest";
import { buildGenesisDoc, LARES_MEMETIC_WIKITEXT_PLUGIN_URI, sha256HexBytesSync, utf8Bytes } from "@lararium/mesh";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mirrorGenesisCasFs } from "../src/node-cas.js";

describe("Node startup contract — seed-derived CAS source", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  test("mirrors exactly the seed inventory and verifies a pre-existing runtime member", () => {
    const core = utf8Bytes("node startup core");
    const plugin = utf8Bytes("node startup plugin");
    const artifact = buildGenesisDoc({
      actorSeed: "01".repeat(32),
      coreBlob: core,
      coreVersion: "test",
      plugins: [{
        id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
        version: "test",
        sha256: sha256HexBytesSync(plugin),
        mimeType: "application/javascript",
        blob: plugin,
      }],
    });
    const source = mkdtempSync(join(tmpdir(), "lar-genesis-source-"));
    const runtime = mkdtempSync(join(tmpdir(), "lar-genesis-runtime-"));
    dirs.push(source, runtime);
    const sourceCas = join(source, "cas");
    const runtimeCas = join(runtime, "cas");
    mkdirSync(sourceCas, { recursive: true });
    for (const entry of artifact.casEntries) writeFileSync(join(sourceCas, entry.cid), entry.bytes);

    expect(mirrorGenesisCasFs(artifact.casManifest, sourceCas, runtimeCas)).toBe(artifact.casEntries.length);
    expect(mirrorGenesisCasFs(artifact.casManifest, sourceCas, runtimeCas)).toBe(0);

    const firstCid = artifact.casManifest.blobs[0]!.cid;
    writeFileSync(join(runtimeCas, firstCid), "tampered runtime bytes");
    expect(() => mirrorGenesisCasFs(artifact.casManifest, sourceCas, runtimeCas))
      .toThrow(/runtime CAS file failed content-address verification/);
  });

  test("refuses a malformed seed-named source byte before a worker can start", () => {
    const core = utf8Bytes("malformed source core");
    const plugin = utf8Bytes("malformed source plugin");
    const artifact = buildGenesisDoc({
      actorSeed: "02".repeat(32),
      coreBlob: core,
      coreVersion: "test",
      plugins: [{
        id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
        version: "test",
        sha256: sha256HexBytesSync(plugin),
        mimeType: "application/javascript",
        blob: plugin,
      }],
    });
    const source = mkdtempSync(join(tmpdir(), "lar-genesis-source-"));
    const runtime = mkdtempSync(join(tmpdir(), "lar-genesis-runtime-"));
    dirs.push(source, runtime);
    const sourceCas = join(source, "cas");
    mkdirSync(sourceCas, { recursive: true });
    const firstCid = artifact.casManifest.blobs[0]!.cid;
    writeFileSync(join(sourceCas, firstCid), "wrong source bytes");
    expect(() => mirrorGenesisCasFs(artifact.casManifest, sourceCas, join(runtime, "cas")))
      .toThrow(/genesis CAS file failed content-address verification/);
  });
});
