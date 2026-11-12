/** The carried seat's two files: their shapes, the device and face they bind, and the seat's second source. */
import { describe, expect, test } from "vitest";
import { tiddlerText, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, faceIntentVerbs, intentEntryRecordsOfGroup, readIntentEntry, type DeviceDelegationTiddler, type DocHandle, type LarDoc } from "@lararium/mesh";
import {
  carriedSeatGrants, composeSeatRequest, keepCarriedSeatGrant, placeSeatRequest, readSeatGrant, readSeatRequest, seatGrantOnPlane, seatRequestDevice,
} from "../src/carried-seat.js";
import { faceGrantTitle, type FaceGrantRecord } from "../src/face-grant-record.js";

const GROUP = "0xb7f1c2a9d4e60381";
const seed = (n: number) => new Uint8Array(32).fill(n);
/** A document handle over plain memory: `change` runs the draft, `doc` reads it. */
const memoryDoc = (): DocHandle<LarDoc> => { const doc = { tiddlers: {} } as unknown as LarDoc; return { change: (fn: (d: LarDoc) => void) => fn(doc), doc: () => doc } as unknown as DocHandle<LarDoc>; };
const grantFor = (device: string, group = GROUP) => ({ kind: "fleet-seat-grant", personaGroup: group, title: faceGrantTitle(group, device),
  record: { kind: "face-join-grant", groupId: group, joineeAgentIdHex: device, founderCard: "{}", capEvents: ["AAAA"], reKeyed: true, serial: 1, reSealed: [], founderEdge: {} as DeviceDelegationTiddler, sig: "ab".repeat(64) } satisfies FaceGrantRecord });

describe("the carried seat's files", () => {
  test("RED: a seat request carries the joined leaf's own signed face-join intent, pinned to the hearth, and lands on a plane as a synced one would", async () => {
    const key = await ed25519VerifyingKeyFromSeed(seed(3)), hearth = await ed25519VerifyingKeyFromSeed(seed(4));
    const edge = { deviceVerifyingKey: key } as DeviceDelegationTiddler;
    const request = await composeSeatRequest({ group: GROUP, atom: { key, sign: ed25519SignerFromSeed(seed(3)) }, hearthAtom: `0x${hearth.toUpperCase()}`, contactCard: "{\"card\":1}", deviceEdge: edge });
    const read = readSeatRequest(JSON.parse(JSON.stringify(request)), GROUP);
    expect(seatRequestDevice(read)).toBe(key);
    const plane = memoryDoc();
    placeSeatRequest(plane, read);
    const [raw] = intentEntryRecordsOfGroup(plane.doc(), GROUP);
    const entry = readIntentEntry(raw, { group: GROUP, authorize: (signer) => signer.toLowerCase() === key });
    expect("refusal" in (entry as object)).toBe(false);
    const body = (request.entry.body as unknown as { audience: unknown; verb: string; args: { summons: { contactCard: string } } });
    expect(body.audience).toEqual({ mode: "pinned", atom: hearth });
    expect(body.args.summons.contactCard).toBe("{\"card\":1}");
    expect(faceIntentVerbs()).toBeDefined();
    // Another face, another verb, a file of another kind: each refuses by name.
    expect(() => readSeatRequest(request, "0x0123456789abcdef")).toThrow(/seat-request-other-face/);
    expect(() => readSeatRequest({ ...request, entry: { ...request.entry, body: { ...request.entry.body, verb: "promote" } } }, GROUP)).toThrow(/seat-request-other-verb/);
    expect(() => readSeatRequest({ kind: "fleet-join-request" }, GROUP)).toThrow(/seat-request-malformed/);
  });

  test("RED: a seat grant for another device or another face refuses by name; this device's own reads", () => {
    const mine = "aa".repeat(32), theirs = "bb".repeat(32);
    expect(readSeatGrant(JSON.parse(JSON.stringify(grantFor(mine))), { group: GROUP, deviceKey: mine }).record.capEvents).toEqual(["AAAA"]);
    expect(() => readSeatGrant(grantFor(theirs), { group: GROUP, deviceKey: mine })).toThrow(/seat-grant-other-device/);
    // A grant whose title names this device over a record that seats another.
    expect(() => readSeatGrant({ ...grantFor(theirs), title: faceGrantTitle(GROUP, mine) }, { group: GROUP, deviceKey: mine })).toThrow(/seat-grant-other-device/);
    expect(() => readSeatGrant(grantFor(mine, "0x0123456789abcdef"), { group: GROUP, deviceKey: mine })).toThrow(/seat-grant-other-face/);
    expect(() => readSeatGrant({ ...grantFor(mine), record: { kind: "face-join-grant" } }, { group: GROUP, deviceKey: mine })).toThrow(/seat-grant-malformed/);
  });

  test("RED: a kept grant answers the seat's second source for its own device alone, and a replayed keep leaves one record", async () => {
    const mine = "aa".repeat(32), theirs = "bb".repeat(32);
    const home = memoryDoc();
    const store = {
      listVisible: async () => Object.keys(home.doc()!.tiddlers),
      get: async (title: string) => { const text = tiddlerText((home.doc()!.tiddlers as Record<string, never>)[title]); return typeof text === "string" ? { tiddler: { text } } : undefined; },
    };
    expect(await carriedSeatGrants(store, GROUP, mine)).toEqual([]);
    const grant = readSeatGrant(grantFor(mine), { group: GROUP, deviceKey: mine });
    keepCarriedSeatGrant(home, grant);
    keepCarriedSeatGrant(home, grant);
    expect(Object.keys(home.doc()!.tiddlers)).toEqual([faceGrantTitle(GROUP, mine)]);
    expect(seatGrantOnPlane(home.doc(), GROUP, mine)?.record.sig).toBe(grant.record.sig);
    expect(seatGrantOnPlane(home.doc(), GROUP, theirs)).toBeNull();
    expect((await carriedSeatGrants(store, GROUP, mine)).map((g) => [g.title, g.record.sig])).toEqual([[faceGrantTitle(GROUP, mine), grant.record.sig]]);
    expect(await carriedSeatGrants(undefined, GROUP, mine)).toEqual([]);
    expect(await carriedSeatGrants(store, GROUP, theirs)).toEqual([]);
  });
});
