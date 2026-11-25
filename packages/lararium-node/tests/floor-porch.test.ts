/**
 * floor-porch.test — W26 slice 4: the Nexus answers a stranger with its floor at the porch, and the stranger verifies it.
 *
 * Over a REAL http server with the vessel's one dispatcher: `GET /floor/<AID>` hands the release rows the publication board
 * carries (each with its charter lineage), and `GET /cas/<cid>` the blobs the HEAD release names. A reader holding the AID
 * alone reads the whole floor across the wire (`readFloorAnswer`), every step verified.
 *
 * CONTROLS draw the one closed door, byte-identical to a path nobody claims: an AID this vessel does not answer for, a wrong
 * method, a private blob in the same CAS, a blob only an UNVERIFIED board row names, and (on a herm) `/cas` beside the porch.
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { assembleFloorRelease, openFloorReleaseBody, writeFloorRelease, type FloorRelease } from "@lararium/mesh/floor-release";
import { crossroadsDocUrl, publicationDocUrl, materializeSharedLarDoc } from "@lararium/mesh/deterministic-doc";
import { cutFloorSnapshot, floorManifestBytes } from "@lararium/mesh/floor-manifest";
import { readFloorAnswer } from "@lararium/mesh/floor-answer";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { signFloorOffering } from "@lararium/mesh/floor-offering";
import { mountHttpFaceDispatcher } from "../src/http-face-dispatcher.js";
import { mountFloorPorch, releasedFloorCids } from "../src/floor-porch.js";
import { writeCasEntriesFs } from "../src/node-cas.js";
import { seatedCharter } from "../../lararium-mesh/tests/charter-fixture.js";

const servers: Server[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

async function rig(opts: { serveCas?: boolean } = {}) {
  const c = await seatedCharter({ seats: 3, threshold: 1 });
  const repo = new Repo({ network: [] });
  const casDir = mkdtempSync(join(tmpdir(), "floor-porch-")); dirs.push(casDir);
  const lares = cutFloorSnapshot({ "lar:///t/lares": { tiddler: { title: "lar:///t/lares", text: "lares" } } });
  const lararium = cutFloorSnapshot({ "lar:///t/lararium": { tiddler: { title: "lar:///t/lararium", text: "lararium" } } });
  // v2: one snapshot per house-canon bag; sdm rides beside the system canon and the porch serves it under the release.
  const sdm = cutFloorSnapshot({ "lar:///t/sdm": { tiddler: { title: "lar:///t/sdm", text: "sdm" } } });
  // The plugins offering the floor names, its one blob in the same CAS: the porch serves both under the release.
  const pluginBytes = new TextEncoder().encode("plugin bytes");
  const offering = await signFloorOffering({ seed: new Uint8Array(32).fill(3), blobs: [{
    id: "lar:///ha.ka.ba/lararium/plugins/lares/memetic-wikitext", version: "unknown", sha256: sha256HexBytesSync(pluginBytes),
    provenance: { source: "https://example.test", commit: "0".repeat(40), path: "plugin.json", licence: "MIT" },
  }] });
  const pluginCid = offering.offering.blobs[0]!.sha256;
  const manifestBytes = floorManifestBytes({ format: "lararium-floor", engine: "e".repeat(64), plugins: offering.cid, snapshots: { lares: lares.cid, lararium: lararium.cid, sdm: sdm.cid } });
  const manifestCid = sha256HexBytesSync(manifestBytes);
  const secret = new TextEncoder().encode("a private blob this vessel holds");
  const secretCid = sha256HexBytesSync(secret);
  writeCasEntriesFs([
    { cid: lares.cid, bytes: lares.bytes }, { cid: lararium.cid, bytes: lararium.bytes }, { cid: sdm.cid, bytes: sdm.bytes }, { cid: manifestCid, bytes: manifestBytes }, { cid: secretCid, bytes: secret },
    { cid: offering.cid, bytes: offering.bytes }, { cid: pluginCid, bytes: pluginBytes },
  ], casDir);
  const [steward] = await c.signers([0]);
  const release = await assembleFloorRelease({
    body: openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior: null, manifest: manifestCid }),
    lineage: c.chain, manifestBytes, steward: steward!, approvers: [...await c.signers()],
  });
  const board = await materializeSharedLarDoc(repo, publicationDocUrl(c.aid), "board:publication");
  const crossroads = await materializeSharedLarDoc(repo, crossroadsDocUrl(c.aid), "board:crossroads");
  const server = createServer(); servers.push(server);
  const dispatcher = mountHttpFaceDispatcher(server);
  const porch = mountFloorPorch({ httpServer: server, dispatcher, repo, nexusPubkey: c.aid, casDir, serveCas: opts.serveCas ?? true });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { c, board, crossroads, release, casDir, origin, porch, ids: { lares: lares.cid, lararium: lararium.cid, sdm: sdm.cid, manifest: manifestCid, secret: secretCid, offering: offering.cid, plugin: pluginCid } };
}
const land = (r: Awaited<ReturnType<typeof rig>>, release: FloorRelease) => r.board.change((d) => writeFloorRelease(d, release));
const bodyOf = async (res: Response) => ({ status: res.status, text: await res.text(), cache: res.headers.get("cache-control") });

describe("the porch answers for the Nexus's floor", () => {
  test("a reader holding the AID alone reads the whole floor across the wire, every step verified", async () => {
    const r = await rig();
    land(r, r.release);
    const answer = await (await fetch(`${r.origin}/floor/${r.c.aid}`)).json();
    const read = await readFloorAnswer({
      nexus: r.c.aid, answer,
      fetchCas: async (cid) => { const res = await fetch(`${r.origin}/cas/${cid}`); return res.status === 200 ? new Uint8Array(await res.arrayBuffer()) : null; },
    });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.head.cid).toBe(r.release.cid); expect(Object.keys(read.snapshots["lares"]!)).toEqual(["lar:///t/lares"]);
      expect(Object.keys(read.snapshots["sdm"]!)).toEqual(["lar:///t/sdm"]);
    }
    expect((await fetch(`${r.origin}/cas/${r.ids.sdm}`)).status).toBe(200);
    // the head's blobs serve with the immutable cache header
    expect((await bodyOf(await fetch(`${r.origin}/cas/${r.ids.manifest}`))).cache).toContain("immutable");
  });

  test("CONTROLS: another AID, a wrong method, a private blob, an unclaimed path all draw the SAME closed door", async () => {
    const r = await rig();
    land(r, r.release);
    const shut = await bodyOf(await fetch(`${r.origin}/nowhere`));
    expect(shut).toMatchObject({ status: 404, text: "route unavailable" });
    expect(await bodyOf(await fetch(`${r.origin}/floor/nexus-${"ab".repeat(32)}`))).toEqual(shut);
    expect(await bodyOf(await fetch(`${r.origin}/floor/${r.c.aid}`, { method: "POST" }))).toEqual(shut);
    expect(await bodyOf(await fetch(`${r.origin}/cas/${r.ids.secret}`))).toEqual(shut);                       // in this CAS, named by no release
    expect(await bodyOf(await fetch(`${r.origin}/cas/${"0".repeat(64)}`))).toEqual(shut);
  });

  test("a board row that names a private blob but verifies as no release opens nothing", async () => {
    const r = await rig();
    // no release lands; a forged row names the secret as its manifest
    const forged = { ...r.release, body: { ...r.release.body, manifest: r.ids.secret } };
    r.board.change((d) => { d.tiddlers[`$:/lar/floor-release/${r.release.cid}`] = { tiddler: { title: `$:/lar/floor-release/${r.release.cid}`, text: JSON.stringify(forged) } } as never; });
    expect((await releasedFloorCids({ board: r.board.doc(), nexus: r.c.aid, casDir: r.casDir })).size).toBe(0);
    expect((await bodyOf(await fetch(`${r.origin}/cas/${r.ids.secret}`))).status).toBe(404);
    // CONTROL: the lawful release names exactly the manifest, each snapshot it keys, its plugins offering and the offering's blob
    land(r, r.release);
    expect([...await releasedFloorCids({ board: r.board.doc(), nexus: r.c.aid, casDir: r.casDir })].sort()).toEqual([r.ids.lares, r.ids.lararium, r.ids.sdm, r.ids.manifest, r.ids.offering, r.ids.plugin].sort());
    expect((await bodyOf(await fetch(`${r.origin}/cas/${r.ids.plugin}`))).status).toBe(200);
  });

  test("a release hand-placed in the mirrored crossroads document answers as no release and opens no blob", async () => {
    const r = await rig();
    r.crossroads.change((d) => writeFloorRelease(d, r.release));
    const answer = await (await fetch(`${r.origin}/floor/${r.c.aid}`)).json() as { releases?: unknown[] };
    expect(answer.releases, "the porch read a release off the crossroads mirror").toEqual([]);
    expect((await bodyOf(await fetch(`${r.origin}/cas/${r.ids.manifest}`))).status).toBe(404);
    // CONTROL: the same release on the publication board answers.
    land(r, r.release);
    expect((await bodyOf(await fetch(`${r.origin}/cas/${r.ids.manifest}`))).status).toBe(200);
  });

  test("a herm's porch (no /cas of its own) answers the floor route and leaves /cas to its bulb face", async () => {
    const r = await rig({ serveCas: false });
    land(r, r.release);
    expect((await fetch(`${r.origin}/floor/${r.c.aid}`)).status).toBe(200);
    expect((await bodyOf(await fetch(`${r.origin}/cas/${r.ids.manifest}`))).status).toBe(404);
  });

  test("a porch whose island reads as no AID answers no Nexus at all", async () => {
    const repo = new Repo({ network: [] });
    const server = createServer(); servers.push(server);
    const dispatcher = mountHttpFaceDispatcher(server);
    mountFloorPorch({ httpServer: server, dispatcher, repo, nexusPubkey: "ab".repeat(32), casDir: tmpdir(), serveCas: true });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    expect((await fetch(`${origin}/floor/nexus-${"ab".repeat(32)}`)).status).toBe(404);
  });
});
