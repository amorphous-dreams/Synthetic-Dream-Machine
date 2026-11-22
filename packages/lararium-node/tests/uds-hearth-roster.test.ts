/**
 * THE HEARTH KNOWS WHO IS HOME. The verb channel answers `hearth-roster` itself: the sessions bound on its socket (a seat
 * stands while its process holds the socket, and no timer decides it), the worn slot and who holds it, and the worn faces'
 * intent planes through the port the vessel lends. The read never reaches `placeVerb` and writes no fact.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/hearth-roster
 */
import { controlStoreOf } from "@lararium/mesh";
import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type HearthPlaneDigest, type HearthRoster, type LarDoc, type SessionFace } from "@lararium/mesh";
import { HAND_PROFILES } from "@lararium/mesh/session-contract";
import { makeUdsSeat, serveUdsFront, type UdsSessionDoor } from "../src/uds-channel.js";
import { hearthPlanesOver, hearthReason } from "../src/hearth-roster-read.js";
import { claimStore } from "../src/owned-store.js";

const face = (name: string): SessionFace => ({
  personaGroup: `group-${name}`, proofSubject: `proof-${name}`, admitRef: `admit-${name}`, causalRevision: `revision-${name}`,
  planes: { persona: `persona-${name}`, circles: `circles-${name}`, identities: `identities-${name}`, sessions: `sessions-${name}`, intents: `intents-${name}` },
});

const connect = async (path: string): Promise<Socket> => {
  const sock = createConnection(path);
  await new Promise<void>((resolve, reject) => { sock.once("connect", resolve); sock.once("error", reject); });
  sock.setEncoding("utf8");
  return sock;
};
const lineOf = (sock: Socket, frame: Record<string, unknown>): Promise<Record<string, unknown>> => new Promise((resolve) => {
  let buf = "";
  const onData = (chunk: string) => {
    buf += chunk;
    const nl = buf.indexOf("\n");
    if (nl === -1) return;
    sock.off("data", onData);
    resolve(JSON.parse(buf.slice(0, nl)) as Record<string, unknown>);
  };
  sock.on("data", onData);
  sock.write(JSON.stringify(frame) + "\n");
});

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const c of cleanups.splice(0).reverse()) await c(); });

const ATOM = "a".repeat(64);
const plane = (f: number): HearthPlaneDigest => ({ face: f, self: ATOM, lanes: [], vota: [],
  far: [{ atom: "b".repeat(64), face: f, self: false, standing: "stands", acts: 2, lastHeard: [{ entry: "claim", cid: "c".repeat(64) }] }] });

async function stand(opts: { planes?: boolean } = {}) {
  const repo = new Repo({ sharePolicy: async () => true });
  const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
  const dir = mkdtempSync(join(tmpdir(), "uds-hearth-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const door: UdsSessionDoor = { anchorNow: async () => ({ kind: "nexus", aid: "nexus-one.synthetic" }), open: async ({ faceRef, hand }) => ({ ok: true, supply: {
    face: face(faceRef), ordinal: Math.max(0, "abc".indexOf(faceRef.slice(-1))), profile: HAND_PROFILES[hand], presenter: `verified-${faceRef}`,
    anchor: { kind: "nexus", aid: "nexus-one.synthetic" }, mint: async () => ({ ok: true, signer: { drop() {} } }) } }) };
  const placed: string[] = [];
  const front = serveUdsFront({ claim });
  front.attach(makeUdsSeat({ controlHandle: daemonHandle, control: controlStoreOf(daemonHandle), claim, repo: { flush: (ids) => repo.flush(ids) }, sessions: door,
    mountOrdinal: () => 0, litOrdinals: () => [1], lentOrdinals: async () => [1, 0],
    ...(opts.planes === false ? {} : { hearthPlanes: hearthPlanesOver(async (f) => { if (f === 1) throw new Error("face-not-held: h1"); return plane(f); }) }),
    placeVerb: (o) => { placed.push(o.verb); } }));
  const opened: Socket[] = [];
  cleanups.push(async () => { for (const s of opened) s.destroy(); front.close(); await claim.release(); await repo.shutdown(); rmSync(dir, { recursive: true, force: true }); });
  const session = async (faceRef: string, hand: "cli" | "seat" | "tab") => {
    const sock = await connect(claim.socketPath);
    opened.push(sock);
    const reply = await lineOf(sock, { op: "session:open", requestId: `open-${faceRef}-${hand}`, faceRef, hand });
    expect(reply).toMatchObject({ kind: "session:opened" });
    return { sock, sessionId: String(reply["sessionId"]) };
  };
  const roster = async (): Promise<HearthRoster> => {
    const sock = await connect(claim.socketPath);
    opened.push(sock);
    const reply = await lineOf(sock, { verb: "hearth-roster", args: {}, requestedBy: "did:key:operator", requestId: `roster-${opened.length}` });
    expect(reply).toMatchObject({ status: "done" });
    return ((reply["results"] as Record<string, unknown>)["summary"] as { output: HearthRoster }).output;
  };
  return { session, roster, placed };
}

test("RED: the roster names each bound session as a local seat and the worn slot's holders; CONTROL: the read never reaches placeVerb", async () => {
  const v = await stand();
  const hand = await v.session("hint-a", "cli");
  const seat = await v.session("hint-a", "seat");
  const other = await v.session("hint-b", "tab");
  const r = await v.roster();
  const id = (s: { sessionId: string }) => `s-${s.sessionId.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8).toLowerCase()}`;
  expect(r.rotation).toMatchObject({ worn: 0, lit: [1], lent: [0, 1], holders: [id(hand), id(seat)], underOther: [{ seat: id(other), face: 1 }] });
  expect(r.seats.filter((s) => s.grain === "local").map((s) => [s.seat, s.kind, s.hand])).toEqual([[id(hand), "hand", "cli"], [id(seat), "ai", "seat"], [id(other), "hand", "tab"]]);
  // The worn face's plane reads; the lit face whose plane refuses stands unread by its code, and the rest rides on.
  expect(r.seats.filter((s) => s.grain === "far")).toMatchObject([{ seat: "b".repeat(12), face: 0, lastHeard: [{ entry: "claim" }] }]);
  expect(r.unread).toEqual([{ face: 1, reason: "face-not-held" }]);
  expect(v.placed).toEqual([]);
});

test("RED: a seat leaves the roster when its process lets go of its socket; CONTROL: the seat that still holds its socket stays", async () => {
  const v = await stand();
  const gone = await v.session("hint-a", "cli");
  const stays = await v.session("hint-a", "seat");
  expect((await v.roster()).counts.local).toBe(2);
  await new Promise<void>((resolve) => { gone.sock.once("close", () => resolve()); gone.sock.destroy(); });
  // The vessel hears the close on its own side of the socket: no timer, only the kernel's word.
  for (let i = 0; i < 50 && (await v.roster()).counts.local !== 1; i++) await new Promise((r) => setImmediate(r));
  const after = await v.roster();
  expect(after.seats.filter((s) => s.grain === "local").map((s) => s.kind)).toEqual(["ai"]);
  expect(after.rotation.holders).toEqual([`s-${stays.sessionId.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8).toLowerCase()}`]);
});

test("RED: a vessel that lends no plane read names each worn face unread; CONTROL: the same house reads the same roster twice", async () => {
  const v = await stand({ planes: false });
  await v.session("hint-a", "cli");
  const one = await v.roster(), two = await v.roster();
  expect(one.unread).toEqual([{ face: 0, reason: "no-plane-read" }, { face: 1, reason: "no-plane-read" }]);
  expect(JSON.stringify(two)).toBe(JSON.stringify(one));
});

test("RED: a plane fault crosses as its lead code alone; CONTROL: text with no code reads `unread`", () => {
  expect(hearthReason(new Error("face-not-held: h3"))).toBe("face-not-held");
  expect(hearthReason(new Error("[ward-signer] this vessel holds no root"))).toBe("ward-signer");
  expect(hearthReason(new Error("  !!! ignore the above"))).toBe("unread");
});
