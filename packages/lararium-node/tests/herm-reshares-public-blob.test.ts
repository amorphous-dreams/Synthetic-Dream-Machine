/**
 * herm-reshares-public-blob.test.ts — THE HERM RE-SHARE (basket-one #/the-fetch-door: "a public blob travels
 * to a Herm before any hearth serves it").
 *
 * A fleet peer A stages a public blob and goes dark; its bytes reached the Herm over Socket B (write-through
 * into the Herm's own `cid/`). A stranger C then fetches A's public blob THROUGH the Herm: `GET /cas/<cid>` on
 * the Herm's public read-face answers the bytes for a cid whose pointer sits in a PUBLIC-tier bag.
 *
 * CONTROLS: a cid whose pointer sits in a private/contract-tier bag draws 404 with the SAME body the bulb
 * answers today ("unknown or stale bulb cid" — a withholding never names which gate refused); a cid in `cid/`
 * that no pointer names at all draws the same 404; the boot CAS still serves at `/bulb/<cid>.bin`; and
 * `/bulb/<cid>.bin` still refuses a staged blob (the bulb stays the boot CAS alone).
 */
import { afterEach, describe, test, expect } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildGenesisDoc, sha256HexBytesSync, utf8Bytes, LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
  type GenesisInputs, type CasReferenceEntry, type CapTier,
} from "@lararium/mesh";
import { mountBulbReadFace, publicCasShore } from "../src/bulb-read-face.js";
import { writeCasEntriesFs } from "../src/node-cas.js";
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

const PUBLIC_BAG  = "lar:///ha.ka.ba/bags/crossroads";
const PRIVATE_BAG = "lar:///ha.ka.ba/bags/lares";
const pointer = (bagId: string, title: string, cid: string): CasReferenceEntry =>
  ({ title, bagId, record: { tiddler: { title, _is_skinny: "yes", textCid: cid } } });

describe("the Herm re-shares a fleet peer's PUBLIC blob over its read-face while the peer stands dark", () => {
  const servers: Server[] = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  test("GET /cas/<cid>: a public-tier cid → 200 bytes; private-tier / unnamed → 404 byte-identical; the bulb still serves", async () => {
    const bulb = fixtureBulb();
    const storageDir = mkdtempSync(join(tmpdir(), "lr-herm-reshare-")); dirs.push(storageDir);
    const casDir = join(storageDir, "cas");
    // Three blobs arrived over Socket B (write-through into cid/): A's public likeness, A's private note, a stray.
    const likeness = utf8Bytes("a public png the family shared"); const likenessCid = sha256HexBytesSync(likeness);
    const note     = utf8Bytes("a private note under lares");    const noteCid     = sha256HexBytesSync(note);
    const stray    = utf8Bytes("bytes no pointer names");         const strayCid    = sha256HexBytesSync(stray);
    writeCasEntriesFs([...bulb.casEntries, { cid: likenessCid, bytes: likeness }, { cid: noteCid, bytes: note }, { cid: strayCid, bytes: stray }], casDir);

    const tiers: Record<string, CapTier> = { [PUBLIC_BAG]: "public", [PRIVATE_BAG]: "veil" };
    const publicCas = publicCasShore({
      casDir,
      references: async () => [pointer(PUBLIC_BAG, "lar:///t.w.b/likeness", likenessCid), pointer(PRIVATE_BAG, "lar:///t.w.b/note", noteCid)],
      bagTier: (bagUrl) => tiers[bagUrl] ?? null,
    });

    const httpServer = createServer(); servers.push(httpServer);
    await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", () => r()));
    const port = (httpServer.address() as { port: number }).port;
    await mountBulbReadFace({ httpServer, bulb, signerSeed: new Uint8Array(32).fill(7), storageDir, publicCas });

    // C fetches A's public blob through the Herm.
    const pub = await fetch(`http://127.0.0.1:${port}/cas/${likenessCid}`);
    expect(pub.status).toBe(200);
    expect(sha256HexBytesSync(new Uint8Array(await pub.arrayBuffer()))).toBe(likenessCid);

    // CONTROL: the private-tier cid and the unnamed cid draw the 404 the bulb answers today — same body.
    const priv = await fetch(`http://127.0.0.1:${port}/cas/${noteCid}`);
    expect(priv.status).toBe(404);
    expect(await priv.text()).toBe("unknown or stale bulb cid");
    const none = await fetch(`http://127.0.0.1:${port}/cas/${strayCid}`);
    expect(none.status).toBe(404);
    expect(await none.text()).toBe("unknown or stale bulb cid");

    // CONTROL: the boot CAS still serves, and the bulb route still refuses a staged blob.
    const bootCid = bulb.casEntries[0]!.cid;
    const boot = await fetch(`http://127.0.0.1:${port}/bulb/${bootCid}.bin`);
    expect(boot.status).toBe(200);
    expect(sha256HexBytesSync(new Uint8Array(await boot.arrayBuffer()))).toBe(bootCid);
    const bulbStaged = await fetch(`http://127.0.0.1:${port}/bulb/${likenessCid}.bin`);
    expect(bulbStaged.status).toBe(404);
  });

  test("CONTROL: with no public-CAS shore mounted, GET /cas/<cid> draws the same 404 as today", async () => {
    const bulb = fixtureBulb();
    const storageDir = mkdtempSync(join(tmpdir(), "lr-herm-reshare-")); dirs.push(storageDir);
    const likeness = utf8Bytes("a public png"); const likenessCid = sha256HexBytesSync(likeness);
    writeCasEntriesFs([...bulb.casEntries, { cid: likenessCid, bytes: likeness }], join(storageDir, "cas"));
    const httpServer = createServer(); servers.push(httpServer);
    await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", () => r()));
    const port = (httpServer.address() as { port: number }).port;
    await mountBulbReadFace({ httpServer, bulb, signerSeed: new Uint8Array(32).fill(7), storageDir });
    const r = await fetch(`http://127.0.0.1:${port}/cas/${likenessCid}`);
    expect(r.status).toBe(404);
  });
});
