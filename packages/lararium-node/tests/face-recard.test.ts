/**
 * face-recard — a face whose Archive fell behind its own cards lights again under its own identity.
 *
 * A face that restored a stale Archive light after light walked its live prekeys past every secret it held, and its light
 * refuses `FaceHoldsNoPrekeySecret` (#492 cures the cause; this repairs a face already there). The recard (`lares vault
 * recard --face N`, riding the face's next light) mints the stand's card BEFORE its bags, so every Document it mints rides a
 * prekey whose secret it holds, and rests the Archive after that card:
 *
 *   R1  a stale face that refuses lights after a recard, under the same atom key, and its next ordinary light opens.
 *   R2  content written after the recard reads at the next light.
 *   R3  what a recard keeps and loses, read: content the face sealed in its own Documents across the stale walk reads again
 *       (keyhive's replay carries their key chains), and content a PEER sealed to a card the face minted in a stand whose
 *       Archive nobody kept reads unreadable BY NAME (`ContentKeyNotHeld`), never a crash; the recard's line says both.
 *   R4  a healthy face's recard reminted nothing: it lit as it would.
 *   R5  a recard whose Archive could not rest refuses before its card mints (`archive-unrouted`).
 *   R6  no key reaches a log: no seed, no address secret, no archive bytes.
 */
import { afterEach, expect, test, vi } from "vitest";
import { ContentKeyNotHeld, InMemoryEventStore, KeyhiveProvider } from "@lararium/keyhive";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { BAG_IDS, DAEMON_BAG_ID } from "@lararium/mesh";
import { standFoundedIsland } from "./stand-founded-island.js";
vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) teardown.pop()!(); vi.restoreAllMocks(); });

const STANDS = 120;
const OWN_BAG = "lar:///probe.sibling.own";
/** A durable ground bag the founding never registered: its first Document mints in a stand whose Archive nobody keeps. */
const LATE_BAG = BAG_IDS.catalog;
const PEER_BAG = "lar:///probe.peer.bag";
const HANDLE = 3;
const text = (s: string): Uint8Array => new TextEncoder().encode(s);

async function twoFaces() {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret } = b.daemonAuth;
  const sibling = (archive: Uint8Array, recard?: true) => ({ atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex,
    veilArchiveBytes: archive, faceAddressSecret, handleIndex: HANDLE, registerBags: [DAEMON_BAG_ID, LATE_BAG, OWN_BAG], ...(recard ? { recard } : {}) });
  return { a, sibling, siblingKey: atom.key, siblingSeed: atom.seed, faceAddressSecret, siblingGroup: personaGroupId, founded: veilArchiveBytes! };
}

/** One stand of the composition: the sibling's provider (null where it did not light) and every log line it printed. */
async function standOnce(a: Awaited<ReturnType<typeof standFoundedIsland>>, joined: unknown, siblingKey: string,
  persistVeilArchive?: (bytes: Uint8Array, face: string) => void) {
  const providers: KeyhiveProvider[] = [];
  const init = KeyhiveProvider.prototype.init;
  const spy = vi.spyOn(KeyhiveProvider.prototype, "init").mockImplementation(function (this: KeyhiveProvider, ...args) { providers.push(this); return init.apply(this, args); });
  const lines: string[] = [];
  const hear = (...line: unknown[]) => { lines.push(line.map(String).join(" ")); };
  const quiet = (["log", "warn", "error", "info", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation(hear));
  try {
    await operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [joined] } } as never,
      { dyadReading: () => "clear", ...(persistVeilArchive ? { persistVeilArchive } : {}) }).verifierFactory!(a.ctx);
    let sibling: KeyhiveProvider | null = null;
    for (const p of providers) {
      try { if ((await p.whoami()).toLowerCase().endsWith(siblingKey.toLowerCase().replace(/^0x/, ""))) sibling = p; } catch { /* disposed: did not light */ }
    }
    const refused = lines.filter((w) => w.toLowerCase().includes("refused"));
    return { sibling, providers, lines, refused, dispose: () => Promise.all(providers.map((p) => p.dispose().catch(() => {}))) };
  } finally { spy.mockRestore(); for (const q of quiet) q.mockRestore(); }
}

/**
 * Walk the face stale the way the live face walked: no writer stands, so every light restores the founding Archive and mints
 * one card more. Each light that stands seals one line into the daemon bag; the last such seal rests under a Document whose
 * Archive nobody kept. Answers the refusal and that ciphertext.
 */
async function walkStale(f: Awaited<ReturnType<typeof twoFaces>>) {
  let lateSeal: Uint8Array | null = null;
  let keptSeal: Uint8Array | null = null;
  // A PEER seals to the card the face minted at its first light, a stand whose Archive nobody kept.
  let peerShare: { readonly docId: string; readonly seal: Uint8Array; readonly events: Uint8Array[] } | null = null;
  for (let i = 0; i < STANDS; i++) {
    const s = await standOnce(f.a, f.sibling(f.founded), f.siblingKey);
    try {
      if (s.refused.length > 0) { expect(s.sibling, `stand ${i}`).toBeNull(); return { refusal: s.refused, lateSeal: lateSeal!, keptSeal: keptSeal!, peerShare: peerShare! }; }
      lateSeal = await s.sibling!.encryptContent(LATE_BAG, text(`late at stand ${i}`));
      keptSeal = await s.sibling!.encryptContent(DAEMON_BAG_ID, text(`kept at stand ${i}`));
      const card = await s.sibling!.contactCard();
      if (peerShare === null) {
        const peer = new KeyhiveProvider();
        await peer.init({ seed: new Uint8Array(32).fill(0x6e), eventStore: new InMemoryEventStore() });
        try {
          const { id } = await peer.receiveContactCard(card);
          const { docId } = await peer.registerBag(PEER_BAG);
          await peer.delegate({ audience: id, bagUrl: PEER_BAG, access: "read" });
          const seal = await peer.encryptContent(PEER_BAG, text("sealed by a peer"));
          peerShare = { docId, seal, events: await peer.eventsForPeer(id) };
        } finally { await peer.dispose(); }
      }
    } finally { await s.dispose(); }
  }
  throw new Error("the face never walked stale within the bound");
}

test("R1-R3, R6: a stale face recards under its own identity; its own seals and content after read, a peer's seal to a lost prekey reads unreadable by name, and no key reaches a log", async () => {
  const f = await twoFaces();
  const { refusal, lateSeal, keptSeal, peerShare } = await walkStale(f);
  expect(peerShare).toBeTruthy();
  // THE STALE FACE REFUSES BY NAME, and the refusal names the command that recards it.
  expect(refusal.join(" ")).toContain("holds no prekey secret");
  expect(refusal.join(" ")).toContain(`lares vault recard --face ${HANDLE}`);

  const rows = new Map<string, Uint8Array>();
  const write = (bytes: Uint8Array, face: string) => { rows.set(face, Uint8Array.from(bytes)); };
  // R1 — THE RECARD: the same stale Archive, asked to recard, lights.
  const recard = await standOnce(f.a, f.sibling(f.founded, true), f.siblingKey, write);
  let after: Uint8Array;
  try {
    expect(recard.refused).toEqual([]);
    expect(recard.sibling, "the stale face lit under its recard").not.toBeNull();
    expect((await recard.sibling!.whoami()).toLowerCase().endsWith(f.siblingKey.toLowerCase().replace(/^0x/, "")), "the same atom key").toBe(true);
    expect(rows.has(f.siblingGroup), "the Archive rested after the card").toBe(true);
    const line = recard.lines.find((l) => l.includes(`face h${HANDLE} recarded`));
    expect(line, "the recard says what it did").toBeTruthy();
    // R3 — the bag whose Document it lost is named, and its old seal reads unreadable by name, never a crash.
    expect(line).toContain("ContentKeyNotHeld");
    // WHAT THE RECARD KEEPS: the face's own seals across the stale walk read again, in the founding's bag and in a bag whose
    // Document a stand nobody kept minted.
    expect(new TextDecoder().decode(await recard.sibling!.decryptContent(DAEMON_BAG_ID, keptSeal))).toMatch(/^kept at stand \d+$/);
    expect(new TextDecoder().decode(await recard.sibling!.decryptContent(LATE_BAG, lateSeal))).toMatch(/^late at stand \d+$/);
    // WHAT IT LOSES: the peer's seal to the unkept card's prekey reads unreadable by name, never a crash.
    await recard.sibling!.ingestPeerEvents(peerShare.events);
    recard.sibling!.adoptBag(PEER_BAG, peerShare.docId);
    const unreadable = await recard.sibling!.decryptContent(PEER_BAG, peerShare.seal).then(() => null, (e: unknown) => e);
    expect(unreadable).toBeInstanceOf(ContentKeyNotHeld);
    expect((unreadable as ContentKeyNotHeld).bag).toBe(PEER_BAG);
    expect((unreadable as Error).message).toContain("lares bag share");
    // R2 — content written after the recard.
    after = await recard.sibling!.encryptContent(DAEMON_BAG_ID, text("written after the recard"));
    // R6 — NO KEY REACHES A LOG: not the atom seed, not the address secret, not the Archive's bytes, and no hex run longer than
    // a public key.
    const all = recard.lines.join("\n");
    expect(all).not.toContain(f.siblingSeed);
    if (f.faceAddressSecret) expect(all).not.toContain(f.faceAddressSecret);
    expect(all).not.toContain(Buffer.from(rows.get(f.siblingGroup)!).toString("hex").slice(0, 64));
    expect(all).not.toContain(Buffer.from(rows.get(f.siblingGroup)!).toString("base64").slice(0, 64));
    expect(all).not.toMatch(/[0-9a-f]{65,}/i);
  } finally { await recard.dispose(); }

  // R1 — THE NEXT ORDINARY LIGHT, from the row the recard rested, opens; R2 — and the content written after reads.
  const next = await standOnce(f.a, f.sibling(rows.get(f.siblingGroup)!), f.siblingKey, write);
  try {
    expect(next.refused).toEqual([]);
    expect(next.sibling).not.toBeNull();
    expect(new TextDecoder().decode(await next.sibling!.decryptContent(DAEMON_BAG_ID, after!))).toBe("written after the recard");
  } finally { await next.dispose(); }
});

test("R4: a healthy face's recard reminted nothing: it lit as it would and says so", async () => {
  const f = await twoFaces();
  const rows = new Map<string, Uint8Array>();
  const write = (bytes: Uint8Array, face: string) => { rows.set(face, Uint8Array.from(bytes)); };
  const first = await standOnce(f.a, f.sibling(f.founded), f.siblingKey, write);
  let sealed: Uint8Array;
  try { sealed = await first.sibling!.encryptContent(DAEMON_BAG_ID, text("held")); } finally { await first.dispose(); }
  const again = await standOnce(f.a, f.sibling(rows.get(f.siblingGroup)!, true), f.siblingKey, write);
  try {
    expect(again.refused).toEqual([]);
    expect(again.lines.some((l) => l.includes(`face h${HANDLE} recard: its stand held a live prekey secret`))).toBe(true);
    expect(again.lines.some((l) => l.includes("recarded"))).toBe(false);
    expect(new TextDecoder().decode(await again.sibling!.decryptContent(DAEMON_BAG_ID, sealed!))).toBe("held");
  } finally { await again.dispose(); }
});

test("R5: a recard whose Archive could not rest refuses before its card mints, by name, naming the command", async () => {
  const f = await twoFaces();
  const card = vi.spyOn(KeyhiveProvider.prototype, "contactCard");
  // No writer stands: the vessel rests no Archive for this face.
  const s = await standOnce(f.a, f.sibling(f.founded, true), f.siblingKey);
  try {
    expect(s.sibling).toBeNull();
    const refusal = s.refused.join(" ");
    expect(refusal).toContain("FaceRecardRefused");
    expect(refusal).toContain("archive-unrouted");
    expect(refusal).toContain(`lares vault recard --face ${HANDLE}`);
    // The mounted face mints its own card at its floor; the sibling's stand never stood, so no sibling card minted.
    const siblingCards = await Promise.all(card.mock.contexts.map(async (p) => {
      try { return (await (p as KeyhiveProvider).whoami()).toLowerCase().endsWith(f.siblingKey.toLowerCase().replace(/^0x/, "")); } catch { return false; }
    }));
    expect(siblingCards.filter(Boolean)).toEqual([]);
  } finally { await s.dispose(); }
});
