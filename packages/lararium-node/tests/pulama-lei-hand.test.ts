/**
 * pulama-lei-hand — THE LEI HAND DOOR AT THE PŪLAMA (road 4b, backlog-awakens Wave 4b lane B).
 *
 * Under a pūlama the vessel holds no face root, so `lei kui`, `restring` and `unstring` reach the pūlama as the hand's own acts:
 * the hand door's `lei` act opens the face root fresh under the operator's route (a ward act, in the pūlama, where the key rests),
 * signs ONE record (a lei, or an unstring), and answers it. It writes nothing: the vessel lands the record and runs the co-sign
 * gate there. Everything the door can judge without the route refuses before the route reads, and no answer carries the route.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, swarmActCid, swarmLeiRecordTitle, swarmLeiUnstrungTitle, verifySwarmRecord, WardRefused, type Credential, type SwarmSignerPort } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { pulamaHandDoor } from "../src/pulama-hand.js";
import { servePulama } from "../src/pulama-server.js";
import { pulamaImage, pulamaRecords } from "../src/pulama-state.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";
import { SESSION_DERIVES, fixtureSlots, lend, openGate, standPulama, type PulamaFixture } from "./pulama-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const GROUP = "group-lei-hand", BRANCH = "main";
const route = [{ kind: "passphrase" as const, passphrase: FIXTURE_PASSPHRASE }];
let fx: PulamaFixture | null = null;
const dirs: string[] = [];
afterEach(async () => { await fx?.drop(); fx = null; for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

async function stand(opts: { readonly lei?: boolean; readonly unanchored?: boolean } = {}) {
  fx = await standPulama("pulama-lei-hand", () => openGate({ faces: lend(0), coldReads: [] }));
  await fx.kept.foundFace({ group: personaGroupDigest(GROUP), ordinal: 0, slots: fixtureSlots });
  const holder = makeCustodyHolder({ io: new FsCustodyIo(fx.seat.homes), homes: fx.seat.homes });
  const server = servePulama({ holder, gate: openGate({ faces: lend(0), coldReads: [] }), derives: SESSION_DERIVES });
  const dir = mkdtempSync(join(tmpdir(), "lar-pulama-lei-")); dirs.push(dir);
  const records = pulamaRecords(dir);
  const root: SwarmSignerPort = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(7)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(7)) };
  // THE FACE ROOT, as a ward act opens it: only the face's own route opens it, and each opening signs one act.
  const opened: number[] = [];
  const lei = {
    group: async (ordinal: number) => (ordinal === 0 && opts.unanchored !== true ? GROUP : null),
    signer: async (ordinal: number, credentials: readonly Credential[]): Promise<SwarmSignerPort> => {
      opened.push(ordinal);
      if (credentials.some((c) => c.kind !== "passphrase" || c.passphrase !== FIXTURE_PASSPHRASE)) throw new WardRefused("ward-no-slot-opens", "the route opens no slot of this face's ward (2 attempt(s) left)");
      return root;
    },
  };
  const lines: string[] = [];
  const door = pulamaHandDoor({ holder, server, image: pulamaImage(dir), records, onLog: (l) => lines.push(l), ...(opts.lei === false ? {} : { lei }) } as Parameters<typeof pulamaHandDoor>[0]);
  const light = () => door({ op: "light", credentials: route });
  const verify = (record: unknown, title: string) => verifySwarmRecord(JSON.stringify(record), title, { hand: (k) => k === root.key, vessel: () => false, place: () => false, lead: () => false }, GROUP);
  return { door, light, records, root, opened, lines, verify };
}

describe("the hand strings, restrings and unstrings a lei at the pūlama's hand door", () => {
  test("RED: a lit pūlama signs a kui, a restring after the tip and an unstring under the face's route, writes nothing, and no answer carries the route; CONTROL: status answers as it stood", async () => {
    const s = await stand();
    await s.light();
    expect(await s.door({ op: "status" })).toMatchObject({ op: "status", lit: true, faces: 1 });
    const kui = await s.door({ op: "lei", act: "kui", face: 0, rite: "kukulu", branch: BRANCH, returns: 2, credentials: route });
    expect(kui).toMatchObject({ op: "lei", act: "kui", reading: "signed", face: 0 });
    const record = kui["record"] as Parameters<typeof swarmActCid>[0];
    const cid = swarmActCid(record);
    expect(kui["cid"]).toBe(cid);
    expect(s.verify(record, swarmLeiRecordTitle("kukulu", BRANCH, cid))).toMatchObject({ ok: true, act: { body: { act: "lei", group: GROUP, rite: "kukulu", branch: BRANCH, after: null, reach: "wide", returns: 2 } } });
    // A RESTRING RIDES KUI: it names the tip it follows, and the record it signs reads as a lei after that tip.
    const restring = await s.door({ op: "lei", act: "restring", face: 0, rite: "kukulu", branch: BRANCH, after: cid, reach: "head", head: "a".repeat(40), credentials: route });
    expect(restring).toMatchObject({ reading: "signed", restrung: cid, record: { body: { act: "lei", after: cid, reach: "head", head: "a".repeat(40) } } });
    const unstring = await s.door({ op: "lei", act: "unstring", face: 0, rite: "kukulu", branch: BRANCH, lei: cid, credentials: route });
    expect(s.verify(unstring["record"], swarmLeiUnstrungTitle(cid))).toMatchObject({ ok: true, act: { body: { act: "lei-unstrung", lei: cid } } });
    // SIGN-ONLY: the pūlama's own store holds no lei; the vessel lands each record.
    expect(await s.records.list("$:/")).toEqual([]);
    expect(JSON.stringify([kui, restring, unstring, s.lines])).not.toContain(FIXTURE_PASSPHRASE);
    expect(s.opened).toEqual([0, 0, 0]);
  });

  test("RED: an unlit pūlama, an unopened face, malformed terms, an unconfirmed large count and a restring naming no tip each refuse before the route reads; CONTROL: the same kui with its terms whole signs", async () => {
    const s = await stand();
    const kui = { op: "lei", act: "kui", face: 0, rite: "kukulu", branch: BRANCH, returns: 2, credentials: route };
    expect(await s.door(kui)).toMatchObject({ reading: "pulama-locked" });
    await s.light();
    for (const [frame, reading] of [
      [{ ...kui, face: 3 }, "face-locked"],
      [{ ...kui, act: "issue" }, "lei-malformed"],
      [{ ...kui, face: "0" }, "lei-malformed"],
      [{ ...kui, rite: "merge" }, "lei-malformed"],
      [{ ...kui, returns: 0 }, "lei-malformed"],
      [{ ...kui, after: "not-a-cid" }, "lei-malformed"],
      [{ ...kui, returns: 40 }, "swarm-lei-returns-unconfirmed"],
      [{ ...kui, act: "restring" }, "lei-restring-names-the-tip"],
      [{ ...kui, act: "unstring", lei: "nope" }, "lei-malformed"],
      [{ ...kui, credentials: undefined }, "malformed"],
    ] as const) expect(await s.door(frame), JSON.stringify(frame)).toMatchObject({ op: "lei", reading });
    expect(s.opened).toEqual([]);
    expect(await s.door({ ...kui, returns: 40, confirm: true })).toMatchObject({ reading: "signed", record: { body: { returns: 40 } } });
  });

  test("RED: a wrong route signs nothing and answers the ward's reading, and a pūlama seated with no lei hand answers `lei-unavailable`; CONTROL: the right route signs", async () => {
    const s = await stand();
    await s.light();
    const wrong = await s.door({ op: "lei", act: "kui", face: 0, rite: "kukulu", branch: BRANCH, returns: 1, credentials: [{ kind: "passphrase", passphrase: "a-wrong-route" }] });
    expect(wrong).toMatchObject({ op: "lei", reading: "ward-no-slot-opens" });
    expect(wrong["record"]).toBeUndefined();
    expect(JSON.stringify(wrong)).not.toContain("a-wrong-route");
    expect(await s.door({ op: "lei", act: "kui", face: 0, rite: "kukulu", branch: BRANCH, returns: 1, credentials: route })).toMatchObject({ reading: "signed" });
    await fx!.drop(); fx = null;
    const bare = await stand({ lei: false });
    await bare.light();
    expect(await bare.door({ op: "lei", act: "kui", face: 0, rite: "kukulu", branch: BRANCH, returns: 1, credentials: route })).toEqual({ op: "lei", reading: "lei-unavailable" });
  });

  test("RED: a face whose anchors name no group refuses `face-group-unread` before the route; CONTROL: h0 names its group", async () => {
    const s = await stand();
    await s.light();
    expect(await s.door({ op: "lei", act: "kui", face: 0, rite: "kukulu", branch: BRANCH, returns: 1, credentials: route })).toMatchObject({ reading: "signed", record: { body: { group: GROUP } } });
    await fx!.drop(); fx = null;
    const bare = await stand({ unanchored: true });
    await bare.light();
    expect(await bare.door({ op: "lei", act: "kui", face: 0, rite: "kukulu", branch: BRANCH, returns: 1, credentials: route })).toMatchObject({ op: "lei", reading: "face-group-unread", face: 0 });
    expect(bare.opened).toEqual([]);
  });
});
