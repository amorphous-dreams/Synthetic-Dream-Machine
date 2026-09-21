/**
 * Browser's startup face consumes the seed-derived inventory over its HTTP byte
 * source, then verifies the exact named bytes in OPFS before a worker is eligible.
 */
import { describe, expect, test, vi } from "vitest";
import {
  buildGenesisDoc,
  genesisCasManifestFromSeed,
  LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
  sha256HexBytesSync,
  utf8Bytes,
} from "@lararium/mesh";
import { fetchGenesisCasToOpfs, readCasBlobFromOpfs } from "../src/browser-genesis.js";

describe("Browser startup contract — seed-derived HTTP/OPFS source", () => {
  test("fetches exactly the seed inventory and retains hash-valid bytes in OPFS", async () => {
    const core = utf8Bytes("browser startup core");
    const plugin = utf8Bytes("browser startup plugin");
    const artifact = buildGenesisDoc({
      actorSeed: "03".repeat(32),
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
    const manifest = genesisCasManifestFromSeed(artifact.seed);
    const bytesByCid = new Map(artifact.casEntries.map(({ cid, bytes }) => [cid, bytes]));
    const requested: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      const cid = url.slice(url.lastIndexOf("/") + 1);
      requested.push(cid);
      const bytes = bytesByCid.get(cid);
      return bytes
        ? new Response(bytes.slice(), { status: 200 })
        : new Response("missing", { status: 404 });
    });
    try {
      await fetchGenesisCasToOpfs(manifest, "https://genesis.invalid/genesis");
      expect(requested).toEqual(manifest.blobs.map(({ cid }) => cid));
      for (const { cid } of manifest.blobs) {
        const bytes = await readCasBlobFromOpfs(cid);
        expect(bytes).not.toBeNull();
        expect(sha256HexBytesSync(bytes!)).toBe(cid);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("refuses a source response whose bytes do not match its seed-named CID", async () => {
    const core = utf8Bytes("browser malformed source core");
    const plugin = utf8Bytes("browser malformed source plugin");
    const artifact = buildGenesisDoc({
      actorSeed: "04".repeat(32),
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
    const manifest = genesisCasManifestFromSeed(artifact.seed);
    vi.stubGlobal("fetch", async () => new Response(utf8Bytes("wrong bytes"), { status: 200 }));
    try {
      await expect(fetchGenesisCasToOpfs(manifest, "https://genesis.invalid/genesis"))
        .rejects.toThrow(/failed content-address verification/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
