/**
 * floor-porch.test — W26 slice 4: the Nexus answers a stranger with its floor at the porch, and the stranger verifies it.
 *
 * Over a REAL http server with the vessel's one dispatcher: `GET /floor/<AID>` hands the release rows the crossroads board
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
import {
  assembleFloorRelease, crossroadsDocUrl, cutFloorSnapshot, floorManifestBytes, materializeSharedLarDoc, openFloorReleaseBody, readFloorAnswer,
  sha256HexBytesSync, writeFloorRelease, type FloorRelease,
} from "@lararium/mesh";
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
  const manifestBytes = floorManifestBytes({ format: "lararium-floor/v1", engine: "e".repeat(64), grammar: "a".repeat(64), plugins: "b".repeat(64), lares: lares.cid, lararium: lararium.cid });
  const manifestCid = sha256HexBytesSync(manifestBytes);
  const secret = new TextEncoder().encode("a private blob this vessel holds");
  const secretCid = sha256HexBytesSync(secret);
  writeCasEntriesFs([
    { cid: lares.cid, bytes: lares.bytes }, { cid: lararium.cid, bytes: lararium.bytes }, { cid: manifestCid, bytes: manifestBytes }, { cid: secretCid, bytes: secret },
  ], casDir);
  const [steward] = await c.signers([0]);
  const release = await assembleFloorRelease({
    body: openFloorReleaseBody({ nexus: c.aid, epoch: c.head.epochCid, prior: null, manifest: manifestCid }),
    lineage: c.chain, manifestBytes, steward: steward!, approvers: [...await c.signers()],
  });
  const board = await materializeSharedLarDoc(repo, crossroadsDocUrl(c.aid), "board:crossroads");
  const server = createServer(); servers.push(server);
  const dispatcher = mountHttpFaceDispatcher(server);
  const porch = mountFloorPorch({ httpServer: server, dispatcher, repo, nexusPubkey: c.aid, casDir, serveCas: opts.serveCas ?? true });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { c, board, release, casDir, origin, porch, ids: { lares: lares.cid, lararium: lararium.cid, manifest: manifestCid, secret: secretCid } };
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
    if (read.ok) { expect(read.head.cid).toBe(r.release.cid); expect(Object.keys(read.lares)).toEqual(["lar:///t/lares"]); }
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
    // CONTROL: the lawful release names exactly the manifest and its two snapshots
    land(r, r.release);
    expect([...await releasedFloorCids({ board: r.board.doc(), nexus: r.c.aid, casDir: r.casDir })].sort()).toEqual([r.ids.lares, r.ids.lararium, r.ids.manifest].sort());
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
