/**
 * ONE SEED, ONE CID — a herm and a lararium name one genesis seed by one CID.
 *
 * A traveler arriving with "the stock seed CID" must find the same coal at either door. Both doors read the
 * genesis dir the build writes (`seed.json` + `cas/`); the CID is sha256 over the seed.json bytes AS PUBLISHED.
 * The herm hands those bytes over at `/bulb/<cid>.bin`; the lararium's Pronaos serves them at `/genesis/seed.json`
 * and names them `seedCid` in its arrival descriptor. A second derivation (a re-serialization of the parsed seed)
 * names the same seed twice, and a traveler holding one name draws the closed door at the other.
 *
 * CONTROL: a different seed names a different CID at both doors.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, request, type Server } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildGenesisDoc, sha256HexBytesSync, utf8Bytes, LARES_MEMETIC_WIKITEXT_PLUGIN_URI, type GenesisInputs,
} from "@lararium/mesh";
import { readBulbArtifact } from "../src/bulb.js";
import { mountBulbReadFace } from "../src/bulb-read-face.js";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { ARRIVAL_WELL_KNOWN_ROUTE, mountPronaosReadFace, pronaosRouteInventoryForProjection } from "../src/pronaos-adapter.js";
import { writeCasEntriesFs } from "../src/node-cas.js";
import { genesisCasDir } from "../src/genesis-artifact.js";

const servers: Server[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A genesis dir exactly as the build writes one: pretty-printed seed.json plus the seed-named CAS blobs. */
function genesisDir(actorSeed: string): string {
  const coreBlob   = utf8Bytes("fake-tw5-core-for-one-seed");
  const pluginBlob = utf8Bytes("fake-lares-plugin-for-one-seed");
  const inputs: GenesisInputs = {
    actorSeed, coreBlob, coreVersion: "5.0.0-test",
    plugins: [{ id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "0.1.0", sha256: sha256HexBytesSync(pluginBlob), mimeType: "application/json", blob: pluginBlob }],
  };
  const artifact = buildGenesisDoc(inputs);
  const dir = mkdtempSync(join(tmpdir(), "lr-one-seed-")); dirs.push(dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "seed.json"), JSON.stringify(artifact.seed, null, 2) + "\n", "utf8");
  writeCasEntriesFs(artifact.casEntries, genesisCasDir(dir));
  return dir;
}

function get(origin: string, path: string): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, { headers: { connection: "close" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}

/** Stand a herm's bulb face off the genesis dir. */
async function standHerm(dir: string): Promise<string> {
  const bulb = readBulbArtifact(dir);
  if (!bulb) throw new Error("fixture genesis unreadable");
  const server = createServer(); servers.push(server);
  const dispatcher = mountHttpFaceDispatcher(server);
  await mountBulbReadFace({ httpServer: server, bulb, dispatcher });
  return listen(server);
}

/** Stand a lararium's Pronaos off the same genesis dir; return its origin and the seed CID its descriptor names. */
async function standPronaos(dir: string): Promise<{ origin: string; seedCid: string }> {
  const seedBytes = new Uint8Array(readFileSync(join(dir, "seed.json")));
  const bulb = readBulbArtifact(dir)!;
  const prepared = {
    index:  { bytes: utf8Bytes("<!doctype html><title>arrival</title>"), contentType: "text/html; charset=utf-8" },
    assets: new Map([["/assets/wiki.worker-abc.js", { bytes: utf8Bytes("self.postMessage('w')"), contentType: "application/javascript" }]]),
    genesisSeed: { bytes: seedBytes, contentType: "application/json" },
    cas: new Map(bulb.casEntries.map((e) => [e.cid, { bytes: e.bytes, contentType: "application/octet-stream" }])),
  };
  const server = createServer(); servers.push(server);
  mountPronaosReadFace(server, { ...prepared, routeInventory: pronaosRouteInventoryForProjection(prepared) });
  const origin = await listen(server);
  const descriptor = JSON.parse((await get(origin, ARRIVAL_WELL_KNOWN_ROUTE)).body.toString("utf8")) as { routes: { kind: string; seedCid?: string }[] };
  const seedCid = descriptor.routes.find((r) => r.kind === "genesis-seed")?.seedCid;
  if (!seedCid) throw new Error("descriptor names no genesis seed");
  return { origin, seedCid };
}

describe("one seed, one CID — the herm's bulb and the lararium's Pronaos name one seed alike", () => {
  test("the seed CID a lararium's descriptor names opens the herm's bulb door, and both serve the published bytes", async () => {
    const dir = genesisDir("abc123");
    const published = readFileSync(join(dir, "seed.json"));
    const herm = await standHerm(dir);
    const { origin: lararium, seedCid } = await standPronaos(dir);

    expect(seedCid).toBe(sha256HexBytesSync(new Uint8Array(published)));   // the CID names the bytes as published
    const atHerm = await get(herm, `/bulb/${seedCid}.bin`);
    expect(atHerm.status).toBe(200);
    expect(atHerm.body.equals(published)).toBe(true);
    const atLararium = await get(lararium, "/genesis/seed.json");
    expect(atLararium.status).toBe(200);
    expect(atLararium.body.equals(atHerm.body)).toBe(true);
  });

  test("CONTROL: a different seed names a different CID at both doors, and neither door opens to the other's", async () => {
    const one = genesisDir("abc123");
    const two = genesisDir("def456");
    const { seedCid: cidOne } = await standPronaos(one);
    const { seedCid: cidTwo } = await standPronaos(two);
    expect(cidTwo).not.toBe(cidOne);
    const hermTwo = await standHerm(two);
    expect((await get(hermTwo, `/bulb/${cidTwo}.bin`)).status).toBe(200);
    expect((await get(hermTwo, `/bulb/${cidOne}.bin`)).status).toBe(404);
  });
});
