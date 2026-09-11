/**
 * bulb-serves-boot-cas-alone.test.ts — the MEASURE the cross-operator blob crossing rests on.
 *
 * The law (tiddler-carriage #/law) says a PUBLIC pointer's bytes ride the public CAS and any peer
 * holding the pointer fetches them by cid. The bulb is the one content-addressed READ-FACE the house
 * serves over the public floor today — so the question is whether it serves an ARBITRARY public blob
 * a hearth staged, or the boot CAS alone. Measured here against the real read-face: the bulb answers
 * `GET /bulb/<cid>.bin` from the genesis manifest's blobs ONLY (`bulb-read-face.ts` builds `blobByCid`
 * off `buildBulb(bulb)`); a blob sitting in the same vessel's `cid/` dir, absent from the manifest,
 * draws 404 "unknown or stale bulb cid". A boot blob draws 200 with its own bytes (the CONTROL).
 */
import { afterEach, describe, test, expect } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildGenesisDoc, sha256HexBytesSync, utf8Bytes, LARES_MEMETIC_WIKITEXT_PLUGIN_URI, type GenesisInputs,
} from "@lararium/mesh";
import { mountBulbReadFace } from "../src/bulb-read-face.js";
import { writeCasEntriesFs, readCasBlobFromFs } from "../src/node-cas.js";
import type { BulbArtifact } from "../src/bulb.js";

function fixtureBulb(): BulbArtifact {
  const coreBlob   = utf8Bytes("fake-tw5-core-for-bulb");
  const pluginBlob = utf8Bytes("fake-lares-memetic-wikitext-plugin");
  const inputs: GenesisInputs = {
    actorSeed: "abc123", coreBlob, coreVersion: "5.0.0-test",
    plugins: [{ id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "0.1.0", sha256: sha256HexBytesSync(pluginBlob), mimeType: "application/json", blob: pluginBlob }],
  };
  const a = buildGenesisDoc(inputs);
  return { seed: a.seed, casManifest: a.casManifest, casEntries: a.casEntries, bootstrap: {}, sealEpochCid: null };
}

describe("the bulb read-face serves the BOOT CAS alone — an operator's staged blob draws 404", () => {
  const servers: Server[] = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  test("GET /bulb/<cid>.bin: a genesis blob → 200 (CONTROL); a cid/ blob outside the manifest → 404", async () => {
    const bulb = fixtureBulb();
    const storageDir = mkdtempSync(join(tmpdir(), "lr-bulb-cas-")); dirs.push(storageDir);
    // A hearth stages a public pointer's bytes into its OWN cid/ tier beside the boot material.
    const casDir = join(storageDir, "cas");
    const staged = utf8Bytes("a public png the operator staged under crossroads");
    const stagedCid = sha256HexBytesSync(staged);
    writeCasEntriesFs([...bulb.casEntries, { cid: stagedCid, bytes: staged }], casDir);
    expect(readCasBlobFromFs(stagedCid, casDir)).not.toBeNull();

    const httpServer = createServer(); servers.push(httpServer);
    await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", () => r()));
    const port = (httpServer.address() as { port: number }).port;
    await mountBulbReadFace({ httpServer, bulb, signerSeed: new Uint8Array(32).fill(7), storageDir });

    const bootCid = bulb.casEntries[0]!.cid;
    const control = await fetch(`http://127.0.0.1:${port}/bulb/${bootCid}.bin`);
    expect(control.status).toBe(200);
    expect(sha256HexBytesSync(new Uint8Array(await control.arrayBuffer()))).toBe(bootCid);

    const probe = await fetch(`http://127.0.0.1:${port}/bulb/${stagedCid}.bin`);
    expect(probe.status).toBe(404);
    expect(await probe.text()).toBe("unknown or stale bulb cid");
  });
});
