/**
 * herm-rungs.test.ts — the herm's rung ladder (pronaos#/the-rung-ladder).
 *
 *   SILENT (default) — the herm hands over its bulb by CID alone. Every unknown, withheld or refused request draws
 *     ONE closed door, byte-identical to the dispatcher's terminal refusal: a stranger cannot tell a path no face
 *     claims from a CID the herm withholds, a listing route, the well-known name, or a wrong method. A traveler who
 *     brings the bulb CID kindles.
 *   WAYMARK (opt-in, `herm.waymark`) — one unsigned descriptor at `/.well-known/lar`: format, route shapes, bulb CID.
 *     It shares the arrival descriptor's dispatcher key, so it never mounts beside a Pronaos.
 *   TEMPLE — the lararium's own Pronaos; the house's origins always include every reach face, so a mirror on the
 *     house's own origin refuses on every standing.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, request, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import {
  buildGenesisDoc, didKeyFromVerifyingKey, sha256HexBytesSync, utf8Bytes, LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
  type GenesisInputs,
} from "@lararium/mesh";
import { mountBulbReadFace, mountHermWaymark, hermWaymarkBytes, publicCasShore, WAYMARK_FORMAT } from "../src/bulb-read-face.js";
import { CLOSED_DOOR } from "../src/bulb-routes.js";
import { type BulbArtifact } from "../src/bulb.js";
import { genesisSeedFileBytes, genesisSeedCid } from "../src/genesis-artifact.js";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { pullBulb, kindleFromBulb, httpBulbTransport } from "../src/kindle.js";
import {
  arrivalDescriptorBytes, houseOriginsOf, mountPronaosReadFace, pronaosRouteInventoryForProjection,
  type PronaosFile, type PronaosPreparedProjection,
} from "../src/pronaos-adapter.js";
import { hermWaymarkDeclared, type LaresConfig } from "../src/lares-config.js";

function fixtureBulb(): BulbArtifact {
  const coreBlob   = utf8Bytes("fake-tw5-core-for-bulb");
  const pluginBlob = utf8Bytes("fake-lares-memetic-wikitext-plugin");
  const inputs: GenesisInputs = {
    actorSeed: "abc123", coreBlob, coreVersion: "5.0.0-test",
    plugins: [{ id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "0.1.0", sha256: sha256HexBytesSync(pluginBlob), mimeType: "application/json", blob: pluginBlob }],
  };
  const a = buildGenesisDoc(inputs);
  return { seedBytes: genesisSeedFileBytes(a.seed), casEntries: a.casEntries };
}

/** One answer as a stranger sees it: status, every header but the date, and the body bytes. */
interface Answer { readonly status: number; readonly headers: readonly string[]; readonly body: string }

function ask(origin: string, path: string, method = "GET"): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}${path}`, { method, headers: { connection: "close" } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const headers: string[] = [];
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
          if (res.rawHeaders[i]!.toLowerCase() === "date") continue;
          headers.push(`${res.rawHeaders[i]!.toLowerCase()}: ${res.rawHeaders[i + 1]}`);
        }
        resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const servers: Server[] = [];
const dirs: string[] = [];
const repos: Repo[] = [];
const priorLarRoot = process.env["LAR_ROOT"];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const r of repos.splice(0)) await r.shutdown();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorLarRoot;
});

async function standHerm(opts: { waymark?: boolean } = {}): Promise<{ origin: string; bulb: BulbArtifact; server: Server; dispatcher: ReturnType<typeof mountHttpFaceDispatcher> }> {
  const bulb = fixtureBulb();
  const storageDir = mkdtempSync(join(tmpdir(), "lr-herm-rungs-")); dirs.push(storageDir);
  const server = createServer(); servers.push(server);
  const dispatcher = mountHttpFaceDispatcher(server);
  await mountBulbReadFace({
    httpServer: server, bulb, dispatcher,
    publicCas: publicCasShore({ casDir: join(storageDir, "cas"), references: () => [], bagTier: () => null }),
  });
  if (opts.waymark) mountHermWaymark({ httpServer: server, dispatcher, bulbCid: genesisSeedCid(bulb.seedBytes) });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, bulb, server, dispatcher };
}

describe("SILENT — the herm hands over its bulb by CID and describes nothing", () => {
  test("every unknown, withheld or refused request draws one closed door, byte-identical to the dispatcher's", async () => {
    const { origin, bulb } = await standHerm();
    const known = genesisSeedCid(bulb.seedBytes);
    const wrong = sha256HexBytesSync(utf8Bytes("a cid this herm never held"));

    // The reference: a path no face claims, answered by the dispatcher itself.
    const door = await ask(origin, "/nothing-here");
    expect(door.status).toBe(CLOSED_DOOR.status);
    expect(door.body).toBe(CLOSED_DOOR.body);
    expect(door.body).not.toMatch(/lar|bulb|herm|cid|genesis/i);

    const probes: Array<[string, string]> = [
      ["GET",     "/an/other/unknown"],
      ["GET",     "/bulb/manifest"],
      ["GET",     "/.well-known/lar"],
      ["GET",     `/bulb/${wrong}.bin`],
      ["GET",     "/bulb/not-a-cid.bin"],
      ["GET",     `/cas/${wrong}`],
      ["GET",     `/cas/${known}`],
      ["POST",    `/bulb/${known}.bin`],
      ["OPTIONS", `/bulb/${known}.bin`],
      ["DELETE",  `/cas/${wrong}`],
    ];
    for (const [method, path] of probes) {
      expect(await ask(origin, path, method), `${method} ${path}`).toEqual(door);
    }
  });

  test("CONTROL: a traveler who brings the bulb CID pulls the bulb and kindles a sovereign of its own", async () => {
    const { origin, bulb } = await standHerm();
    const served = await ask(origin, `/bulb/${genesisSeedCid(bulb.seedBytes)}.bin`);
    expect(served.status).toBe(200);

    const pulled = await pullBulb(httpBulbTransport(origin), genesisSeedCid(bulb.seedBytes));
    expect(pulled.seedBytes).toEqual(bulb.seedBytes);
    process.env["LAR_ROOT"] = mkdtempSync(join(tmpdir(), "lr-herm-rungs-root-")); dirs.push(process.env["LAR_ROOT"]);
    const storageDir = mkdtempSync(join(tmpdir(), "lr-herm-rungs-device-")); dirs.push(storageDir);
    const repo = new Repo({ sharePolicy: async () => true }); repos.push(repo);
    const k = await kindleFromBulb({ bulb: pulled, repo, storageDir });
    expect(k.did).toBe(didKeyFromVerifyingKey(k.deviceVerifyingKey));
  }, 30_000);

  test("CONTROL: a traveler without the CID learns nothing — a pull by a wrong CID refuses", async () => {
    const { origin } = await standHerm();
    await expect(pullBulb(httpBulbTransport(origin), sha256HexBytesSync(utf8Bytes("guess")))).rejects.toThrow(/404/);
  });
});

describe("WAYMARK — an opt-in, unsigned descriptor naming the bulb CID", () => {
  test("the waymark answers /.well-known/lar with format, route shapes and the bulb CID — nothing else", async () => {
    const { origin, bulb } = await standHerm({ waymark: true });
    const answer = await ask(origin, "/.well-known/lar");
    expect(answer.status).toBe(200);
    expect(answer.body).toBe(new TextDecoder().decode(hermWaymarkBytes(genesisSeedCid(bulb.seedBytes))));
    const waymark = JSON.parse(answer.body) as Record<string, unknown>;
    expect(Object.keys(waymark).sort()).toEqual(["bulb", "format", "routes"]);
    expect(waymark["format"]).toBe(WAYMARK_FORMAT);
    expect(waymark["bulb"]).toBe(genesisSeedCid(bulb.seedBytes));
    expect(waymark["routes"]).toEqual(["/bulb/<cid>.bin", "/cas/<cid>"]);

    // A wrong method on the waymark draws the same closed door as any unknown path.
    expect(await ask(origin, "/.well-known/lar", "POST")).toEqual(await ask(origin, "/nothing-here"));
  });

  test("a waymark never mounts beside a Pronaos — the two share the well-known name's one dispatcher key", () => {
    const file = (text: string, contentType: string): PronaosFile => ({ bytes: new TextEncoder().encode(text), contentType });
    const cas = file("seed-named-cas", "application/octet-stream");
    const prepared: PronaosPreparedProjection = {
      index: file("<!doctype html>", "text/html; charset=utf-8"), assets: new Map(),
      genesisSeed: file('{"seed":"public"}', "application/json"),
      cas: new Map([[sha256HexBytesSync(cas.bytes), cas]]),
    };
    const server = createServer(); servers.push(server);
    const dispatcher = mountHttpFaceDispatcher(server);
    mountPronaosReadFace(server, { ...prepared, routeInventory: pronaosRouteInventoryForProjection(prepared) }, dispatcher);
    expect(() => mountHermWaymark({ httpServer: server, dispatcher, bulbCid: genesisSeedCid(fixtureBulb().seedBytes) }))
      .toThrow(/route key already owned: well-known:lar/);
  });

  test("the knob reads `herm.waymark` off the node config: absent stays silent, a non-boolean surfaces", () => {
    expect(hermWaymarkDeclared({})).toBe(false);
    expect(hermWaymarkDeclared({ herm: {} })).toBe(false);
    expect(hermWaymarkDeclared({ herm: { waymark: false } })).toBe(false);
    expect(hermWaymarkDeclared({ herm: { waymark: true } })).toBe(true);
    expect(() => hermWaymarkDeclared({ herm: { waymark: "yes" } } as unknown as LaresConfig)).toThrow(/herm\.waymark/);
    expect(() => hermWaymarkDeclared({ herm: [] } as unknown as LaresConfig)).toThrow(/herm must be an object/);
  });
});

describe("TEMPLE — the house's origins include every reach face on every standing", () => {
  const reach = [{ origin: "http://192.168.1.20:8080" }, { origin: "http://house.lan:8080" }];

  test("a standing that composes no origin still names each reach face, so a mirror on one refuses", () => {
    const house = houseOriginsOf(reach, null);
    expect(house).toEqual(["http://192.168.1.20:8080", "http://house.lan:8080"]);
    const file = (text: string, contentType: string): PronaosFile => ({ bytes: new TextEncoder().encode(text), contentType });
    const cas = file("seed-named-cas", "application/octet-stream");
    const cid = sha256HexBytesSync(cas.bytes);
    const prepared: PronaosPreparedProjection = {
      index: file("<!doctype html>", "text/html; charset=utf-8"), assets: new Map(),
      genesisSeed: file('{"seed":"public"}', "application/json"), cas: new Map([[cid, cas]]),
    };
    const projection = { ...prepared, routeInventory: pronaosRouteInventoryForProjection(prepared) };
    expect(() => arrivalDescriptorBytes(projection, { houseOrigins: house, mirrors: [{ cid, origin: "http://house.lan:8080" }] }))
      .toThrow(/house's own/);
    // CONTROL: a mirror on an origin of its own stands.
    expect(() => arrivalDescriptorBytes(projection, { houseOrigins: house, mirrors: [{ cid, origin: "https://mirror.example" }] }))
      .not.toThrow();
  });

  test("composed origins join the reach faces, each named once", () => {
    const composed = [{ webOrigin: "https://house.example", relayOrigin: "http://house.lan:8080", oracleOrigin: "https://oracle.house.example" }];
    expect(houseOriginsOf(reach, composed)).toEqual([
      "http://192.168.1.20:8080", "http://house.lan:8080", "https://house.example", "https://oracle.house.example",
    ]);
  });
});
