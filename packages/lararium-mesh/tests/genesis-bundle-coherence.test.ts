/**
 * Genesis seed/CAS manifest coherence controls.
 *
 * The seed and manifest remain separately consumable planes. These tests only require that their
 * shared identity fields and region witnesses agree when both are present at a build boundary.
 */
import { describe, expect, it } from "vitest";
import {
  buildGenesisDoc,
  genesisCasManifestFromSeed,
  validateGenesisBundleCoherence,
  type GenesisInputs,
  type GenesisPluginEntry,
  type GenesisSeed,
} from "../src/genesis-doc.js";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "../src/lar-uris.js";

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);
const plugin = (id: string, sha256: string): GenesisPluginEntry => ({
  id,
  version: "1.0",
  sha256,
  mimeType: "application/json",
  blob: bytes(id),
});
const inputs = (): GenesisInputs => ({
  actorSeed: "00".repeat(32),
  coreBlob: bytes("tw5-core"),
  coreVersion: "5.5.0",
  plugins: [plugin(LARES_MEMETIC_WIKITEXT_PLUGIN_URI, "11".repeat(32))],
});

describe("genesis seed/CAS manifest coherence", () => {
  it("derives the exact logical CAS inventory from seed alone", () => {
    const artifact = buildGenesisDoc(inputs());
    expect(genesisCasManifestFromSeed(artifact.seed)).toEqual(artifact.casManifest);
    const mutatedOracle = { ...artifact.seed, tiddlers: { ...artifact.seed.tiddlers, unrelated: { tiddler: { cid: "forged" } } } };
    expect(genesisCasManifestFromSeed(mutatedOracle)).toEqual(artifact.casManifest);
  });

  it("refuses malformed seed inventory instead of widening or emptying it", () => {
    const artifact = buildGenesisDoc(inputs());
    const [id, original] = Object.entries(artifact.seed.blobs)[0]!;
    expect(() => genesisCasManifestFromSeed({
      ...artifact.seed,
      blobs: { ...artifact.seed.blobs, [id]: { ...original, sha256: "not-a-cid" } },
    })).toThrow(/noncanonical SHA-256/);
    expect(() => genesisCasManifestFromSeed({
      ...artifact.seed,
      tiddlers: { ...artifact.seed.tiddlers, "lar:///ha.ka.ba/bags/oracle/genesis-cid-engine": undefined },
    })).toThrow(/region witness/);
  });

  it("accepts the seed and manifest emitted by a real artifact", () => {
    const artifact = buildGenesisDoc(inputs());

    expect(() => validateGenesisBundleCoherence(artifact.seed, artifact.casManifest)).not.toThrow();
  });

  it("refuses an altered seed shared blob identity", () => {
    const artifact = buildGenesisDoc(inputs());
    const [id, original] = Object.entries(artifact.seed.blobs)[0]!;
    const alteredSeed: GenesisSeed = {
      ...artifact.seed,
      blobs: {
        ...artifact.seed.blobs,
        [id]: { ...original, sha256: `${original.sha256}-altered` },
      },
    };

    expect(() => validateGenesisBundleCoherence(alteredSeed, artifact.casManifest))
      .toThrow(/blob identity mismatch/);
  });

  it("refuses an altered manifest region identity", () => {
    const artifact = buildGenesisDoc(inputs());
    const alteredManifest = {
      ...artifact.casManifest,
      engineCid: `${artifact.casManifest.engineCid}-altered`,
    };

    expect(() => validateGenesisBundleCoherence(artifact.seed, alteredManifest))
      .toThrow(/engine region witness mismatch/);
  });
});
