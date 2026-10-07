/**
 * pronaos-kindle.test.ts — the first arrival kindles from the lararium's OWN Pronaos (pronaos#/the-first-arrival).
 *
 * A cold device reads the house's arrival descriptor at `/.well-known/lar`, pulls `genesis/seed.json` and every
 * seed-named CAS member off the same origin, verifies each against its CID, and kindles a sovereign hearth under a
 * key it mints itself. Two devices kindling from one house become two sovereigns, exactly as the bulb path does.
 *
 * CONTROLS: a tampered member and a descriptor that disagrees with its own seed both refuse before any kindle.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import {
  buildGenesisDoc, didKeyFromVerifyingKey, LARES_MEMETIC_WIKITEXT_PLUGIN_URI, sha256HexBytesSync, utf8Bytes,
  type GenesisInputs,
} from "@lararium/mesh";
import {
  mountPronaosReadFace, pronaosRouteInventoryForProjection, ARRIVAL_WELL_KNOWN_ROUTE,
  type PronaosFile, type PronaosPreparedProjection,
} from "../src/pronaos-adapter.js";
import { pullArrival, kindleFromBulb, httpBulbTransport, type BulbPullTransport, type KindleResult } from "../src/kindle.js";

const file = (bytes: Uint8Array, contentType: string): PronaosFile => ({ bytes, contentType });

/** A house's prepared Pronaos over a real genesis fixture (core + the Lares plugin `validateGenesisBytes` requires). */
function housePronaos(): PronaosPreparedProjection {
  const coreBlob   = utf8Bytes("fake-tw5-core-for-pronaos");
  const pluginBlob = utf8Bytes("fake-lares-plugin-for-pronaos");
  const inputs: GenesisInputs = {
    actorSeed: "abc456", coreBlob, coreVersion: "5.0.0-test",
    plugins: [{
      id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "0.1.0",
      sha256: sha256HexBytesSync(pluginBlob), mimeType: "application/json", blob: pluginBlob,
    }],
  };
  const artifact = buildGenesisDoc(inputs);
  return {
    index: file(utf8Bytes("<!doctype html><title>arrival</title>"), "text/html; charset=utf-8"),
    assets: new Map([["/assets/wiki.worker-abc.js", file(utf8Bytes("self.postMessage('w')"), "application/javascript")]]),
    genesisSeed: file(utf8Bytes(JSON.stringify(artifact.seed)), "application/json"),
    cas: new Map(artifact.casEntries.map((entry) => [entry.cid, file(entry.bytes, "application/octet-stream")])),
  };
}

describe("the first arrival — kindle from the lararium's own Pronaos", () => {
  const servers: Server[] = [];
  const repos: Repo[] = [];
  const dirs: string[] = [];
  const priorLarRoot = process.env["LAR_ROOT"];
  const mkDir = (t: string): string => { const d = mkdtempSync(join(tmpdir(), `lares-arrival-${t}-`)); dirs.push(d); return d; };

  afterEach(async () => {
    for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
    for (const r of repos.splice(0)) await r.shutdown();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
  });

  async function serveHouse(prepared: PronaosPreparedProjection): Promise<string> {
    const server = createServer(); servers.push(server);
    mountPronaosReadFace(server, { ...prepared, routeInventory: pronaosRouteInventoryForProjection(prepared) });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }

  /** A distinct LAR_ROOT stands in for a distinct cold device: each mints its OWN key. */
  async function kindleAsFreshDevice(origin: string, tag: string): Promise<KindleResult> {
    const fire = await pullArrival(httpBulbTransport(origin));
    process.env["LAR_ROOT"] = mkDir(`root-${tag}`);
    const repo = new Repo({ sharePolicy: async () => true }); repos.push(repo);
    try { return await kindleFromBulb({ bulb: fire, repo, storageDir: mkDir(`store-${tag}`) }); }
    finally { if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot; }
  }

  test("CONTROL: the kindle pulled from the Pronaos kindles a distinct sovereign key, as the bulb path does", async () => {
    const origin = await serveHouse(housePronaos());
    const a = await kindleAsFreshDevice(origin, "a");
    const b = await kindleAsFreshDevice(origin, "b");
    expect(a.did).toBe(didKeyFromVerifyingKey(a.deviceVerifyingKey));
    expect(b.did).toBe(didKeyFromVerifyingKey(b.deviceVerifyingKey));
    expect(a.deviceVerifyingKey).not.toBe(b.deviceVerifyingKey);
    expect(a.did).not.toBe(b.did);
  }, 30_000);

  test("CONTROL: a member whose bytes miss their CID refuses before any kindle", async () => {
    const prepared = housePronaos();
    const origin = await serveHouse(prepared);
    const [tamperedCid] = [...prepared.cas.keys()];
    const real = httpBulbTransport(origin);
    const tampering: BulbPullTransport = {
      getJson: (path) => real.getJson(path),
      getBytes: async (path) => path === `/genesis/cas/${tamperedCid}` ? utf8Bytes("tampered") : real.getBytes(path),
    };
    await expect(pullArrival(tampering)).rejects.toThrow(/content-address/);
  });

  test("CONTROL: a descriptor whose members disagree with its own seed refuses", async () => {
    const origin = await serveHouse(housePronaos());
    const real = httpBulbTransport(origin);
    const widened: BulbPullTransport = {
      getJson: async (path) => {
        const descriptor = await real.getJson(path) as { routes: unknown[] };
        if (path !== ARRIVAL_WELL_KNOWN_ROUTE) return descriptor;
        return { ...descriptor, routes: [...descriptor.routes, { kind: "genesis-member", path: `/genesis/cas/${"d".repeat(64)}`, cid: "d".repeat(64), cache: "immutable", refusal: "integrity" }] };
      },
      getBytes: (path) => real.getBytes(path),
    };
    await expect(pullArrival(widened)).rejects.toThrow(/seed-derived/);
  });
});
