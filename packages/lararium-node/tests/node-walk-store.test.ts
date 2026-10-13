/**
 * node-walk-store — a walk record rests as one row per hearth under the vessel key, and its acts ride the custody door.
 *
 *   W1  a record rests as a VK-sealed row named by a digest of the hearth's gate key; its relay, its invite and a
 *       carried document's key appear nowhere in the file, and it reads back identically and lists.
 *                                                 control: nothing at a hearth's path reads as no walk there
 *   W2  RED: A WRONG KEY REPLACES NO RECORD. A row another vessel sealed refuses the read, the list and the update
 *       by name; its bytes never move; the sealing vessel still opens it.   control: its own key writes
 *   W3  RED: moved bytes, bare bytes (an earlier build's cleartext record), another shape, a malformed wallet, and
 *       a record filed under another hearth's name each refuse the read, the list and the update. A stray file no
 *       row could carry lists as no hearth. An update whose decision answers a malformed record seals nothing.
 *   W4  RED: THE FLOOR READS NO WALK RECORD. A locked seat refuses the read, the list and the update by name, and
 *       the composing vessel reads a walk row under a sovereign composition alone (every read site in
 *       `open-node-vessel.ts` stands behind `sovereign`).
 *   W5  THE ROW RESTS IN THE CUSTODY HOME: the store takes no directory, and a row lands under the storage home of
 *       the seated custody. No `walk/` directory lists as walking nowhere; a `walk` that refuses its listing
 *       refuses the list by name.
 *   W6  THE WALK ACTS: `walk.take` keeps a carried invite and answers `dialing: "now"` with ONE re-presentation
 *       when the hearth's gate equals the standing dial's, `next-stand` otherwise and with no dial standing; a
 *       walk door's own refusal crosses as `act-refused` with its words; `walk.state` answers off the sealed
 *       record; `walk.invite` hands out a real invite, a second one hands out another, and an empty wallet refuses.
 *   W7  ONE HAND: two hand-outs that start together over one token answer it once, under the one custody holder;
 *       an update that declines moves no byte. ONE HEARTH: the one-hearth store refuses a keep while any other
 *       hearth's row stands, inside the same custody hold.
 *   W8  RED: A LOCK UNDER A LIVE WALK. The key locks, then a grant arrives on the riding walk: the store refuses
 *       `CustodyLocked`, the walk tells its fault port, and nothing floats.   control: unlocked, the grant keeps
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  HOSTING_GRANT_SESSION_KIND, decodeInvite, encodeInvite, issueGrant, mintHostToken, mintHostingAct, popInvite, readVkCarrier, walkOver,
  type LarSessionMsg, type LeafIdentity, type WalkFault, type WalkRecord,
} from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { writeCustodyRow } from "../src/custody-seat.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity, wearPersona } from "../src/node-vessel-identity.js";
import { listWalkRecords, nodeWalkStore, walkRowFile, WalksElsewhere } from "../src/node-walk-store.js";
import { runSealedAct, type SealedActContext } from "../src/sealed-acts.js";
import { larDataDir } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

const AID = "epoch0-" + "a".repeat(64);
const GATE = "ee".repeat(32), OTHER_GATE = "dd".repeat(32);
const RELAY = "ws://a-synthetic-hearth/ws";
const HEARTH = new Uint8Array(32).fill(91);
const CARRIED_INVITE = encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: { purpose: "host-invite", n: "5a".repeat(32), y: "6b".repeat(64) } });
const RECORD: WalkRecord = {
  nexusAid: AID, relay: RELAY, invite: CARRIED_INVITE,
  carried: [{ cid: "blake3:" + "ab".repeat(32), ref: "cd".repeat(32), key: "9f".repeat(32) }],
};
const rowPath = (gate = GATE): string => join(larDataDir(), ...walkRowFile(gate).split("/"));

const drops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const drop of drops.splice(0).reverse()) await drop(); });
async function custody(label: string): Promise<SeatedScratchCustody> {
  const c = await seatScratchCustody(label);
  drops.push(() => c.drop());
  return c;
}
const refusal = async (act: Promise<unknown>): Promise<unknown> => act.then(() => "landed", (e: unknown) => e);
const store = () => nodeWalkStore();
/** Seal `record` whole over whatever record stands. */
const put = (gate: string, record: WalkRecord): Promise<WalkRecord | null> => store().update(gate, () => record);

describe("a walk record at rest", () => {
  test("W1 — a record rests sealed under the vessel key, reads back and lists", async () => {
    await custody("walk-w1");
    expect(await store().read(GATE)).toBeNull();                                   // control: no walk there
    expect(await listWalkRecords()).toEqual([]);
    await put(GATE, RECORD);
    const file = readFileSync(rowPath());
    expect(readVkCarrier(file)).toBe("sealed");
    for (const secret of [RELAY, CARRIED_INVITE, "5a".repeat(32), "9f".repeat(32), GATE]) expect(file.includes(Buffer.from(secret)), secret).toBe(false);
    expect(readdirSync(join(larDataDir(), "walk")).every((n) => /^[0-9a-f]{32}\.json$/.test(n))).toBe(true);
    expect(await store().read(GATE)).toEqual(RECORD);
    expect(await listWalkRecords()).toEqual([{ gatePubKey: GATE, record: RECORD }]);
  });

  test("W2 — a wrong key replaces no record", async () => {
    const b = await custody("walk-w2-b");
    const a = await custody("walk-w2-a");
    const as = (c: SeatedScratchCustody): void => { process.env["LAR_ROOT"] = c.root; };
    as(b);
    await put(GATE, RECORD);
    const foreign = readFileSync(rowPath()), bPath = rowPath();
    as(a);
    await put(GATE, { ...RECORD, relay: "ws://another-synthetic-hearth/ws" });
    expect(readFileSync(rowPath()).equals(foreign)).toBe(false);                   // two keys, two encodings
    copyFileSync(bPath, rowPath());
    const read = await refusal(store().read(GATE));
    expect(read).toBeInstanceOf(CustodyRowUnavailable);
    expect(read).toMatchObject({ home: "storage", file: walkRowFile(GATE) });
    expect(await refusal(listWalkRecords())).toBeInstanceOf(CustodyRowUnavailable);
    expect(await refusal(put(GATE, { nexusAid: AID }))).toBeInstanceOf(CustodyRowUnavailable);   // a wallet never lands over it
    expect(readFileSync(rowPath()).equals(foreign)).toBe(true);
    const aRow = rowPath();
    as(b);
    copyFileSync(aRow, rowPath());
    expect(await store().read(GATE)).toEqual(RECORD);                              // the sealing vessel still opens it
    await put(GATE, { nexusAid: AID });                                  // CONTROL: its own key writes
    expect(await store().read(GATE)).toEqual({ nexusAid: AID });
    as(a);
  });

  test("W3 — moved bytes, bare bytes, another shape and a misfiled record refuse; a stray file lists as no hearth", async () => {
    await custody("walk-w3");
    await put(GATE, RECORD);
    const sealed = readFileSync(rowPath());
    const moved = Buffer.from(sealed);
    moved[moved.length - 1] = moved[moved.length - 1]! ^ 0x01;
    for (const standing of [moved, Buffer.from(JSON.stringify({ gatePubKey: GATE, record: RECORD }))]) {
      writeFileSync(rowPath(), standing);
      expect(await refusal(store().read(GATE))).toBeInstanceOf(CustodyRowUnavailable);
      expect(await refusal(listWalkRecords())).toBeInstanceOf(CustodyRowUnavailable);
      expect(await refusal(put(GATE, RECORD))).toBeInstanceOf(CustodyRowUnavailable);
      expect(readFileSync(rowPath()).equals(standing)).toBe(true);
    }
    writeFileSync(rowPath(), sealed);                                              // the true row again: the sealed writer replaces only what the key sealed
    const enc = (v: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(v));
    const shapes = [
      { gatePubKey: GATE }, { gatePubKey: GATE, record: { relay: RELAY } }, { gatePubKey: OTHER_GATE, record: RECORD },
      { gatePubKey: GATE, record: { ...RECORD, wallet: "x" } },                    // a wallet that holds no tokens
      { gatePubKey: GATE, record: { ...RECORD, carried: [{ cid: "blake3:" + "ab".repeat(32), ref: "cd".repeat(32) }] } },   // a receipt with no key
      { gatePubKey: GATE.toUpperCase(), record: RECORD },                          // a gate key outside its one spelling
      { gatePubKey: GATE, record: RECORD, extra: 1 },
      // Each field whole, and the record disagrees with its hearth: an invite for another gate, or another Nexus; a grant of another Nexus.
      { gatePubKey: GATE, record: { ...RECORD, invite: encodeInvite({ nexusAid: AID, gatePubKey: OTHER_GATE, token: { purpose: "host-invite", n: "5a".repeat(32), y: "6b".repeat(64) } }) } },
      { gatePubKey: GATE, record: { ...RECORD, nexusAid: "epoch0-" + "b".repeat(64) } },
      { gatePubKey: GATE, record: { nexusAid: AID, grant: { nexusAid: "epoch0-" + "b".repeat(64), leaf: "ab".repeat(32), epoch: "e".repeat(64), lineage: "d".repeat(64), survived: 0, from: "host", tag: "f".repeat(128) } } },
    ];
    for (const shape of shapes) {
      await writeCustodyRow("storage", walkRowFile(GATE), enc(shape));              // sealed under the right key, of the wrong shape
      expect(await refusal(store().read(GATE))).toMatchObject({ reading: "malformed" });
      expect(await refusal(listWalkRecords())).toMatchObject({ reading: "malformed" });
      expect(await refusal(put(GATE, RECORD))).toMatchObject({ reading: "malformed" });
    }
    await writeCustodyRow("storage", walkRowFile(GATE), enc({ gatePubKey: GATE, record: RECORD }));   // control: the true shape opens again
    writeFileSync(join(larDataDir(), "walk", "a-stray-name.txt"), "not a row");
    expect(await listWalkRecords()).toEqual([{ gatePubKey: GATE, record: RECORD }]);
    // An update whose decision answers a malformed record seals nothing, and the standing row stays.
    const standing = readFileSync(rowPath());
    expect(String(await refusal(store().update(GATE, (held) => ({ ...held!, wallet: "x" as never }))))).toMatch(/reads malformed; nothing sealed/);
    expect(String(await refusal(store().update(GATE, (held) => ({ ...held!, nexusAid: "epoch0-" + "b".repeat(64) }))))).toMatch(/reads malformed; nothing sealed/);
    expect(readFileSync(rowPath()).equals(standing)).toBe(true);
  });

  test("W4 — the floor reads no walk record", async () => {
    const c = await custody("walk-w4");
    await put(GATE, RECORD);
    const standing = readFileSync(rowPath());
    await c.holder.lock();
    expect(await refusal(store().read(GATE))).toBeInstanceOf(CustodyLocked);
    expect(await refusal(listWalkRecords())).toBeInstanceOf(CustodyLocked);
    expect(await refusal(put(GATE, { nexusAid: AID }))).toBeInstanceOf(CustodyLocked);
    expect(readFileSync(rowPath()).equals(standing)).toBe(true);
    // THE COMPOSING VESSEL reads a walk row under a sovereign composition alone: each read site names `sovereign`.
    const compose = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8").split("\n");
    // Two reads decide whether this composition walks at all: the default relay's, and the dial's own record.
    // (The walk dial's later reads stand inside the block that second read opens.)
    const reads = compose.filter((line) => /\.walkRecords\(|const walkRecord\s*=/.test(line) && !/^\s*(\/\/|\*)/.test(line));
    expect(reads.length).toBeGreaterThanOrEqual(2);                                // control: the search finds the read sites
    for (const line of reads) expect(/\bsovereign\b/.test(line), line.trim()).toBe(true);
  });

  test("W5 — the row rests in the custody home, and the store takes no directory", async () => {
    const c = await custody("walk-w5");
    expect(nodeWalkStore.length).toBe(0);
    expect(listWalkRecords.length).toBe(0);
    expect(await listWalkRecords()).toEqual([]);                                   // control: no `walk/` directory, walking nowhere
    expect(existsSync(join(c.homes.storage, "walk"))).toBe(false);
    await put(GATE, RECORD);
    expect(readVkCarrier(readFileSync(join(c.homes.storage, ...walkRowFile(GATE).split("/"))))).toBe("sealed");
    // A `walk` that stands and refuses its listing refuses the list by name: it never reads as walking nowhere.
    rmSync(join(c.homes.storage, "walk"), { recursive: true });
    writeFileSync(join(c.homes.storage, "walk"), "a file where the directory belongs");
    const listed = await refusal(listWalkRecords());
    expect(listed).toBeInstanceOf(CustodyRowUnavailable);
    expect(listed).toMatchObject({ home: "storage", file: "walk" });
    expect(String((listed as Error).message)).toMatch(/unlistable \(ENOTDIR\)/);
  });

  test("W6 — the walk acts keep, answer and re-present through the door's context", async () => {
    await custody("walk-w6");
    await generateOrLoadVesselIdentity();
    await generateOrLoadPersonaGroupRoot(0);
    const epoch = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: null, cap: 3 });
    const invite = (gate = GATE): string => encodeInvite({ nexusAid: AID, gatePubKey: gate, token: mintHostToken(epoch), relay: RELAY });
    let represented = 0;
    const ctx = (dialGate: string | null, dialStands: boolean): SealedActContext => ({
      kelHead: null, personaSelves: null,
      walk: { dialGate: () => dialGate, represent: dialStands ? async () => { represented += 1; } : null },
    });
    const reason = async (act: Promise<unknown>): Promise<string> => act.then(() => "ran", (e: { reason?: string; message?: string }) => `${e.reason}: ${e.message}`);
    // A walk door's own refusal crosses as the act's refusal, with its words: no face worn, so nothing lands.
    expect(await reason(runSealedAct("walk.take", { carried: invite() }, ctx(GATE, true)))).toMatch(/^act-refused: .*wears no face/);
    expect(await reason(runSealedAct("walk.invite", {}, ctx(null, false)))).toMatch(/^act-refused: .*walks nowhere/);
    expect(represented).toBe(0);
    expect(existsSync(rowPath())).toBe(false);
    await wearPersona(0);
    // The standing dial pins this hearth: the take re-presents once and says so.
    expect(await runSealedAct("walk.take", { carried: invite() }, ctx(GATE, true))).toMatchObject({ gatePubKey: GATE, nexusAid: AID, relay: RELAY, dialing: "now" });
    expect(represented).toBe(1);
    // No walk dial stands, or no dial at all: the invite waits for the next stand, and nothing re-presents.
    expect(await runSealedAct("walk.take", { carried: invite() }, ctx(GATE, false))).toMatchObject({ dialing: "next-stand" });
    expect(await runSealedAct("walk.take", { carried: invite() }, { kelHead: null, personaSelves: null, walk: null })).toMatchObject({ dialing: "next-stand" });
    expect(await runSealedAct("walk.take", { carried: invite() }, ctx(null, true))).toMatchObject({ dialing: "next-stand" });   // a dial that pins no hearth re-presents nothing
    expect(represented).toBe(1);
    // A dial pinned elsewhere refuses the take, as the door's own rule says.
    expect(await reason(runSealedAct("walk.take", { carried: invite() }, ctx(OTHER_GATE, true)))).toMatch(/^act-refused: .*dial stands to the hearth/);
    expect(await runSealedAct("walk.state", {}, ctx(null, false))).toEqual({ walks: [expect.objectContaining({ gatePubKey: GATE, relay: RELAY, redeeming: true, wallet: 0 })] });
    expect(readVkCarrier(readFileSync(rowPath()))).toBe("sealed");
    // THE HAND-OUT, for real: an empty wallet refuses; two tokens leave as two invites, newest first, each once.
    expect(await reason(runSealedAct("walk.invite", {}, ctx(null, false)))).toMatch(/^act-refused: .*holds no invite/);
    const older = mintHostToken(epoch), newer = mintHostToken(epoch);
    await store().update(GATE, (held) => ({ ...held!, wallet: [{ epoch: epoch.cid, token: older }, { epoch: epoch.cid, token: newer }] }));
    const first = await runSealedAct("walk.invite", {}, ctx(null, false)) as { invite: string; left: number };
    const second = await runSealedAct("walk.invite", {}, ctx(null, false)) as { invite: string; left: number };
    expect(decodeInvite(first.invite)).toMatchObject({ nexusAid: AID, gatePubKey: GATE, relay: RELAY, token: newer });
    expect(decodeInvite(second.invite)).toMatchObject({ token: older });
    expect([first.left, second.left]).toEqual([1, 0]);
    expect(await reason(runSealedAct("walk.invite", {}, ctx(null, false)))).toMatch(/^act-refused: .*holds no invite/);
    expect(await reason(runSealedAct("walk.take", { carried: invite(), dialGate: GATE }, ctx(null, false)))).toMatch(/^bad-args/);   // the dial rides the context, never the frame
  });

  test("W7 — two hand-outs that start together over one token answer it once", async () => {
    await custody("walk-w7");
    const epoch = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: null, cap: 3 });
    const token = mintHostToken(epoch);
    await put(GATE, { nexusAid: AID, wallet: [{ epoch: epoch.cid, token }] });
    const sealed = readFileSync(rowPath());
    expect(await store().update(GATE, () => null)).toBeNull();                     // a declined update moves no byte
    expect(readFileSync(rowPath()).equals(sealed)).toBe(true);
    const handed = await Promise.all([popInvite(store(), GATE), popInvite(nodeWalkStore(), GATE)]);
    expect(handed.filter((i) => i !== null)).toHaveLength(1);
    expect(decodeInvite(handed.find((i) => i !== null)!)!.token).toEqual(token);
    expect((await store().read(GATE))!.wallet).toEqual([]);
    // ONE HEARTH, decided inside the custody hold: a row that stands for another hearth, readable or not, refuses
    // a keep under the one-hearth store, and the plain store still serves the hearth already walked at.
    const sole = nodeWalkStore({ oneHearth: true });
    expect(await refusal(sole.update(OTHER_GATE, () => ({ nexusAid: AID })))).toBeInstanceOf(WalksElsewhere);
    expect(existsSync(rowPath(OTHER_GATE))).toBe(false);
    expect(await sole.update(GATE, (held) => ({ ...held!, relay: RELAY }))).toMatchObject({ relay: RELAY });   // CONTROL: its own hearth
    writeFileSync(rowPath(OTHER_GATE), "bytes no key sealed");
    expect(await refusal(sole.update(GATE, (held) => held))).toBeInstanceOf(WalksElsewhere);
  });

  test("W8 — a key that locks under a live walk costs one grant and tells the fault port", async () => {
    const c = await custody("walk-w8");
    const epoch = await mintHostingAct({ leafSeed: HEARTH, nexusAid: AID, prev: null, cap: 3 });
    // A REAL verifying key (RFC 8032 §7.1): a grant names only a walker leaf the Ed25519 door accepts.
    const leaf = { verifyingKey: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", seed: new Uint8Array(32).fill(52) };
    const grant = issueGrant(epoch, { leaf: leaf.verifyingKey, lineage: "1".repeat(64), survived: 0, from: "host" });
    const base: LeafIdentity = { contactCard: "d".repeat(64), peerPubKey: "d".repeat(64), sign: async () => "00".repeat(64) };
    await put(GATE, { nexusAid: AID, relay: RELAY });
    const listeners: Array<(m: LarSessionMsg) => void> = [];
    const represented: LeafIdentity[] = [];
    const faults: WalkFault[] = [];
    let told: (() => void) | null = null;
    const walk = {
      onSession: (l: (m: LarSessionMsg) => void) => { listeners.push(l); return () => {}; },
      sendSession: () => true,
      represent: (identity: LeafIdentity) => { represented.push(identity); told?.(); },
      on: () => undefined,
      identity: base,
    };
    walkOver({ transport: walk, store: store(), gatePubKey: GATE, leaf, base, onFault: (f) => { faults.push(f); told?.(); } });
    const frame = (): Promise<void> => new Promise((done) => {
      told = done;
      for (const l of listeners) l({ type: "lar:session", kind: HOSTING_GRANT_SESSION_KIND, body: { grant } });
    });
    await c.holder.lock();                                                         // the key drops while the dial still stands
    await frame();
    expect(faults.map((f) => f.at)).toEqual(["grant"]);
    expect(faults[0]!.error).toBeInstanceOf(CustodyLocked);
    expect(represented).toHaveLength(0);
    await c.holder.adopt(c.vk);                                                    // CONTROL: unlocked, the same grant keeps
    expect((await store().read(GATE))!.grant).toBeUndefined();
    await frame();
    expect((await store().read(GATE))!.grant).toEqual(grant);
    expect(represented).toHaveLength(1);
    expect(faults).toHaveLength(1);
  });
});
