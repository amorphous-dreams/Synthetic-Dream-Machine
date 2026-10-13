/**
 * walker-carry.test.ts — the walker's carriage end to end over the session verbs: the walker seals, the hearth
 * carries, the walker's own receipt opens, and the walker's PROVEN LEAF reaches its carriage again from a fresh
 * lineage — no key is ever handed out.
 *
 * Proven, the walk client (mesh) against the hearth's carriage service (node) over an in-memory session:
 *   · a carried document comes back and opens under the walker's receipt; the bytes the hearth served are not it,
 *     and no answer names the record;
 *   · RED: after the grant lapsed past two rolls and the walker walked back in on a fresh lineage under the SAME
 *     leaf, its carriage answers by proof; CONTROL: another leaf's grant, holding the receipt, reaches nothing
 *     (silence);
 *   · walking back in on a new invite keeps the receipts;
 *   · a hearth's notice marks the record at risk.
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  carryDocument, fetchDocument, openCarried, watchCarryNotice, takeInvite, issueGrant, encodeInvite, mintHostToken, utf8Bytes, hex,
  walkCarrySecret, walkCarryDocumentKey, sha256HexBytesSync, base64UrlEncode, base64UrlDecode, verifyCiphertextCid,
  HOSTING_NOTICE_SESSION_KIND, type HostingGrant, type LarSessionMsg, type WalkRecord, type WalkStore,
} from "@lararium/mesh";
import { serveHostingCarry } from "../src/hosting-carry.js";
import { rollHosting, readHostingState, liveEpochs, hostingDir } from "../src/hosting-store.js";

const AID = "epoch0-" + "a".repeat(64);
const HEARTH = new Uint8Array(32).fill(71);
const GATE = "ee".repeat(32);
// A REAL verifying key (RFC 8032 §7.1): a grant names only a walker leaf the Ed25519 door accepts.
const LEAF = { verifyingKey: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", seed: new Uint8Array(32).fill(72) };
const OTHER_LEAF = { verifyingKey: "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c", seed: new Uint8Array(32).fill(73) };
let storageDir = "";
beforeEach(() => { storageDir = mkdtempSync(join(tmpdir(), "walker-carry-")); });
afterEach(() => { rmSync(storageDir, { recursive: true, force: true }); });

function memoryStore(): WalkStore & { map: Map<string, WalkRecord> } {
  const map = new Map<string, WalkRecord>();
  return {
    map,
    async read(g) { return map.get(g) ?? null; },
    // Reads, decides and writes with no await between: this store's own lock.
    async update(g, decide) { const next = decide(map.get(g) ?? null); if (next) map.set(g, structuredClone(next)); return next; },
  };
}

/** One walker socket at the hearth's carriage service, standing on `grant()`. */
function wire(grant: () => HostingGrant) {
  const socket = {} as never;
  const gateListeners: Array<(s: never, m: LarSessionMsg) => void> = [];
  const walkerListeners: Array<(m: LarSessionMsg) => void> = [];
  const served: LarSessionMsg[] = [];
  serveHostingCarry({
    onSession: (l) => { gateListeners.push(l as never); return () => {}; },
    sendSession: (_s, kind, body) => { const m = { type: "lar:session" as const, kind, body }; served.push(m); for (const l of walkerListeners) l(m); return true; },
    getClassForSocket: () => "walker",
    getGrantForSocket: () => grant(),
  }, { storageDir, leafSeedFor: async () => HEARTH });
  const transport = {
    onSession: (l: (m: LarSessionMsg) => void) => { walkerListeners.push(l); return () => { walkerListeners.splice(walkerListeners.indexOf(l), 1); }; },
    sendSession: (kind: string, body: unknown) => { for (const l of gateListeners) l(socket, { type: "lar:session", kind, body }); return true; },
  };
  return { transport, served, push: (m: LarSessionMsg) => { for (const l of walkerListeners) l(m); } };
}

async function grantAtCurrent(lineage: string, leaf: string = LEAF.verifyingKey): Promise<HostingGrant> {
  const live = liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!;
  return issueGrant(live.current, { leaf, lineage, survived: 0, from: "host" });
}

describe("the walker's carriage over the session verbs", () => {
  test("a carried document comes back under the walker's receipt; the hearth served only ciphertext and named no record", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    const grant = await grantAtCurrent("1".repeat(64));
    const store = memoryStore();
    await store.update(GATE, () => ({ nexusAid: AID, grant }));
    const { transport, served } = wire(() => grant);
    const plaintext = utf8Bytes("field notes the hearth carries and cannot read");
    const carried = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 2_000 });
    expect(carried).toMatchObject({ held: true });
    const back = await fetchDocument({ transport, store, gatePubKey: GATE, cid: carried!.cid, withinMs: 2_000 });
    expect(back && hex(back)).toBe(hex(plaintext));
    expect(JSON.stringify(served)).not.toContain("field notes");
    // No answer hands out a record key: the carried answer names the document and its outcome alone.
    const answer = served.find((m) => m.kind === "hosting/carried")!;
    expect(Object.keys(answer.body as object).sort()).toEqual(["cid", "held"]);
  });

  test("RED: the same leaf on a fresh lineage reaches its carriage by proof; CONTROL: another leaf holding the receipt reaches nothing", async () => {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    let grant = await grantAtCurrent("1".repeat(64));
    const store = memoryStore();
    await store.update(GATE, () => ({ nexusAid: AID, grant }));
    const { transport } = wire(() => grant);
    const plaintext = utf8Bytes("kept across a lapse");
    const carried = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 2_000 });
    // The grant lapses past two rolls; the walker walks back in on a fresh invite — a new lineage, the same leaf.
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    const invite = encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: mintHostToken(liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!.current) });
    await takeInvite(store, invite);
    grant = await grantAtCurrent("2".repeat(64));
    await store.update(GATE, (held) => ({ ...held!, grant }));
    const back = await fetchDocument({ transport, store, gatePubKey: GATE, cid: carried!.cid, withinMs: 2_000 });
    expect(back && hex(back)).toBe(hex(plaintext));
    // CONTROL (the stolen-key probe): another leaf's grant, holding the victim's receipt, asks for the same
    // document — silence.
    const thiefStore = memoryStore();
    grant = await grantAtCurrent("3".repeat(64), OTHER_LEAF.verifyingKey);
    const lifted = (await store.read(GATE))!.carried!;
    await thiefStore.update(GATE, () => ({ nexusAid: AID, grant, carried: lifted }));
    expect(await fetchDocument({ transport, store: thiefStore, gatePubKey: GATE, cid: carried!.cid, withinMs: 300 })).toBeNull();
  });

  /** Every file under the hearth's hosting dir that holds carried bytes: path and bytes. */
  function carriedFiles(): { path: string; bytes: Uint8Array }[] {
    const out: { path: string; bytes: Uint8Array }[] = [];
    const walk = (d: string, inBlobs: boolean) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, f === "blobs"); else if (inBlobs) out.push({ path: p, bytes: new Uint8Array(readFileSync(p)) }); } };
    walk(hostingDir(storageDir, AID), false);
    return out;
  }
  /** The hearth names a carried file by its address's hex. */
  const fileOf = (cid: string): string => cid.replace(/^blake3:/, "");
  async function walkerAtHearth() {
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    const grant = await grantAtCurrent("1".repeat(64));
    const store = memoryStore();
    await store.update(GATE, () => ({ nexusAid: AID, grant }));
    return { store, ...wire(() => grant) };
  }

  test("the receipt names the address, the document's digest and the walker's own key; the hearth sees none of the last two", async () => {
    const { store, transport: bare, served } = await walkerAtHearth();
    const sent: unknown[] = [];
    const transport = { onSession: bare.onSession, sendSession: (kind: string, body: unknown) => { sent.push({ kind, body }); return bare.sendSession(kind, body); } };
    const plaintext = utf8Bytes("a page the walker wrote");
    const carried = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 2_000 });
    const receipts = (await store.read(GATE))!.carried!;
    const ref = sha256HexBytesSync(plaintext);
    // The key belongs to this document alone: the walker's carry secret and the document's digest derive it.
    const documentKey = hex(walkCarryDocumentKey(LEAF.seed, AID, ref));
    expect(receipts).toEqual([{ cid: carried!.cid, ref, key: documentKey }]);
    expect(documentKey).not.toBe(hex(walkCarrySecret(LEAF.seed, AID)));
    expect(sent.length).toBeGreaterThan(0);                                   // the setup took: the carry crossed this transport
    const wire = JSON.stringify(sent) + JSON.stringify(served) + carriedFiles().map((f) => hex(f.bytes)).join("");
    expect(wire).not.toContain(receipts[0]!.ref);
    expect(wire).not.toContain(receipts[0]!.key);
    expect(carriedFiles().length).toBe(1);                                    // the setup took: the hearth holds the value
  });

  test("ORDER: the receipt rests before the sealed value leaves", async () => {
    const { store, transport } = await walkerAtHearth();
    const seenAtSend: number[] = [];
    const watching = { onSession: transport.onSession, sendSession: (kind: string, body: unknown) => { if (kind === "hosting/carry") seenAtSend.push(store.map.get(GATE)?.carried?.filter((r) => r.cid === (body as { cid: string }).cid).length ?? 0); return transport.sendSession(kind, body); } };
    await carryDocument({ transport: watching, store, gatePubKey: GATE, leaf: LEAF, plaintext: utf8Bytes("written down first"), withinMs: 2_000 });
    expect(seenAtSend).toEqual([1]);
  });

  test("one exposed receipt opens one document: each carried document takes a key of its own", async () => {
    const { store, transport } = await walkerAtHearth();
    const first = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext: utf8Bytes("the first page"), withinMs: 2_000 });
    const second = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext: utf8Bytes("the second page"), withinMs: 2_000 });
    const [r1, r2] = (await store.read(GATE))!.carried!;
    expect(r1!.key).not.toBe(r2!.key);
    // A holder of the first receipt alone, handed the second document's address and bytes, opens nothing.
    const held = carriedFiles();
    const secondBytes = held.find((f) => f.path.endsWith(fileOf(second!.cid)))!.bytes;
    const thief = memoryStore();
    await thief.update(GATE, () => ({ nexusAid: AID, carried: [{ cid: second!.cid, ref: r2!.ref, key: r1!.key }] }));
    expect(await openCarried(thief, GATE, { cid: second!.cid, ciphertext: base64UrlEncode(secondBytes) })).toBeNull();
    // CONTROL: the second receipt opens it.
    expect(hex((await openCarried(store, GATE, { cid: second!.cid, ciphertext: base64UrlEncode(secondBytes) }))!)).toBe(hex(utf8Bytes("the second page")));
    expect(first!.cid).not.toBe(second!.cid);
  });

  test("carries that start together lose no receipt, and one document started twice deposits once", async () => {
    const { store, transport } = await walkerAtHearth();
    const pages = ["page one", "page two", "page three"].map((t) => utf8Bytes(t));
    const outcomes = await Promise.all(pages.map((plaintext) => carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 2_000 })));
    expect(outcomes.every((o) => o !== null && "held" in o)).toBe(true);
    const receipts = (await store.read(GATE))!.carried!;
    expect(receipts.map((r) => r.cid).sort()).toEqual(outcomes.map((o) => o!.cid).sort());
    expect(carriedFiles().length).toBe(3);
    for (const [i, o] of outcomes.entries()) {
      const back = await fetchDocument({ transport, store, gatePubKey: GATE, cid: o!.cid, withinMs: 2_000 });
      expect(back && hex(back)).toBe(hex(pages[i]!));
    }
    // The same document, started twice in one tick: one value at the hearth, one receipt, one address.
    const twin = utf8Bytes("handed over twice at once");
    const [a, b] = await Promise.all([0, 1].map(() => carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext: twin, withinMs: 2_000 })));
    expect(a!.cid).toBe(b!.cid);
    expect(carriedFiles().length).toBe(4);
    expect((await store.read(GATE))!.carried!.length).toBe(4);
  });

  test("a hearth that alters, swaps or cuts what it carries hands back nothing that opens", async () => {
    const { store, transport } = await walkerAtHearth();
    const first = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext: utf8Bytes("pay the gardener forty"), withinMs: 2_000 });
    const second = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext: utf8Bytes("pay the gardener ninety"), withinMs: 2_000 });
    const held = carriedFiles();
    expect(held.length).toBe(2);
    const bytesOf = (cid: string): Uint8Array => held.find((f) => f.path.endsWith(fileOf(cid)))!.bytes;
    const answer = (cid: string, bytes: Uint8Array) => ({ cid, ciphertext: base64UrlEncode(bytes) });
    // CONTROL: the true bytes under the true address open.
    expect(hex((await openCarried(store, GATE, answer(first!.cid, bytesOf(first!.cid))))!)).toBe(hex(utf8Bytes("pay the gardener forty")));
    expect(hex((await openCarried(store, GATE, answer(second!.cid, bytesOf(second!.cid))))!)).toBe(hex(utf8Bytes("pay the gardener ninety")));
    // Swapped: the hearth answers the first address with the second document's bytes.
    expect(hex(bytesOf(second!.cid))).not.toBe(hex(bytesOf(first!.cid)));
    expect(await openCarried(store, GATE, answer(first!.cid, bytesOf(second!.cid)))).toBeNull();
    // Altered: one stored byte moves.
    const altered = Uint8Array.from(bytesOf(first!.cid)); altered[altered.length - 1] = altered[altered.length - 1]! ^ 1;
    expect(hex(altered)).not.toBe(hex(bytesOf(first!.cid)));
    expect(await openCarried(store, GATE, answer(first!.cid, altered))).toBeNull();
    // Cut short.
    expect(await openCarried(store, GATE, answer(first!.cid, bytesOf(first!.cid).slice(0, 90)))).toBeNull();
    // An address the walker wrote no receipt for opens nothing, whatever bytes ride it.
    const foreign = bytesOf(second!.cid);
    const stranger = memoryStore();
    await stranger.update(GATE, () => ({ nexusAid: AID, carried: [] }));
    expect(verifyCiphertextCid(foreign, second!.cid)).toBe(true);
    expect(await openCarried(stranger, GATE, answer(second!.cid, foreign))).toBeNull();
    // A receipt whose digest names another document opens nothing: the sealed value binds its own document.
    const crossed = memoryStore();
    const receipts = (await store.read(GATE))!.carried!;
    await crossed.update(GATE, () => ({ nexusAid: AID, carried: [{ ...receipts[0]!, ref: receipts[1]!.ref }] }));
    expect(await openCarried(crossed, GATE, answer(first!.cid, bytesOf(first!.cid)))).toBeNull();
    // The stored file altered on the hearth's own disk: the fetch door answers nothing that opens.
    const victim = held.find((f) => f.path.endsWith(fileOf(first!.cid)))!;
    writeFileSync(victim.path, altered);
    expect(await fetchDocument({ transport, store, gatePubKey: GATE, cid: first!.cid, withinMs: 300 })).toBeNull();
    expect(base64UrlDecode(base64UrlEncode(altered)).length).toBe(altered.length);
  });

  test("a document carried twice deposits once; a document the hearth lost seals afresh and its receipt moves", async () => {
    const { store, transport } = await walkerAtHearth();
    const plaintext = utf8Bytes("the same page, handed over twice");
    const first = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 2_000 });
    const again = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 2_000 });
    expect(again).toEqual({ cid: first!.cid, held: true });
    expect(carriedFiles().length).toBe(1);
    expect((await store.read(GATE))!.carried!.length).toBe(1);
    // The hearth loses the value: the next carry seals afresh under a new address, and one receipt stands.
    rmSync(carriedFiles()[0]!.path);
    const third = await carryDocument({ transport, store, gatePubKey: GATE, leaf: LEAF, plaintext, withinMs: 300 });
    expect(third).toMatchObject({ held: true });
    expect(third!.cid).not.toBe(first!.cid);
    expect((await store.read(GATE))!.carried!.map((r) => r.cid)).toEqual([third!.cid]);
    const back = await fetchDocument({ transport, store, gatePubKey: GATE, cid: third!.cid, withinMs: 2_000 });
    expect(back && hex(back)).toBe(hex(plaintext));
  });

  test("walking back in keeps the receipts", async () => {
    const store = memoryStore();
    await store.update(GATE, () => ({ nexusAid: AID, carried: [{ cid: "blake3:" + "d".repeat(64), ref: "c".repeat(64), key: "e".repeat(64) }] }));
    await rollHosting({ storageDir, nexusAid: AID, leafSeed: HEARTH });
    await takeInvite(store, encodeInvite({ nexusAid: AID, gatePubKey: GATE, token: mintHostToken(liveEpochs(readHostingState(storageDir, AID)!, HEARTH)!.current) }));
    expect(await store.read(GATE)).toMatchObject({ carried: [{ cid: "blake3:" + "d".repeat(64), ref: "c".repeat(64), key: "e".repeat(64) }] });
  });

  test("a hearth's notice marks the record at risk", async () => {
    const store = memoryStore();
    await store.update(GATE, () => ({ nexusAid: AID }));
    const listeners: Array<(m: LarSessionMsg) => void> = [];
    watchCarryNotice({ onSession: (l) => { listeners.push(l); return () => {}; } }, store, GATE, (fault) => { throw fault.error; });
    // The store says when the notice's update returned: a handshake, no clock.
    const marked = new Promise<void>((done) => {
      const update = store.update.bind(store);
      store.update = async (g, decide) => { try { return await update(g, decide); } finally { done(); } };
    });
    for (const l of listeners) l({ type: "lar:session", kind: HOSTING_NOTICE_SESSION_KIND, body: { pending: true } });
    await marked;
    expect((await store.read(GATE))?.atRisk).toBe(true);
  });
});
