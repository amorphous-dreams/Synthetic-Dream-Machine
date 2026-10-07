/**
 * oracle-read-client — peers prove first, then the reader rule runs.
 *
 * A fake channel plays the peer's gate exactly as the node face speaks: lar:challenge → (the reader's
 * lar:auth, its proof checked here) → a gate-signed lar:auth-ok → the pointer frame → the snapshot bytes.
 */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import { exportOracleSnapshot, buildOraclePointer, type OraclePointer, type OracleSnapshot } from "../src/oracle-substrate.js";
import {
  pullAndVerifyOracle, oracleSocketUrl, ORACLE_POINTER_FRAME, ORACLE_SOCKET_ROUTE, type OracleChannel,
} from "../src/oracle-read-client.js";
import {
  mkLarChallenge, mkLarAuthOk, mkLarAuthDenied, isLarAuthMsg, authOkBytes, verifyAuthProof,
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, type LeafIdentity,
} from "../src/auth-wire.js";
import { DAEMON_BAG_ID } from "../src/lar-uris.js";

const SEED   = Uint8Array.from({ length: 32 }, (_, i) => i + 1);     // the peer's vessel key (gate + publisher)
const OTHER  = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);   // another vessel
const READER = Uint8Array.from({ length: 32 }, (_, i) => 90 + i);    // the dialer

async function serve(seed = SEED, parents: readonly string[] = [], text = "the constitution"):
  Promise<{ snap: OracleSnapshot; ptr: OraclePointer }> {
  const snap = await exportOracleSnapshot(A.from({ tiddlers: { oracle: { text } } }));
  const ptr = await buildOraclePointer({ snapshot: snap, parents, signerSeed: seed });
  return { snap, ptr };
}

async function readerIdentity(seed = READER): Promise<LeafIdentity> {
  const pub = await ed25519VerifyingKeyFromSeed(seed);
  // The fake gate reads the card as the reader's key — the shape the keyholder derives from a real card.
  return { contactCard: pub, peerPubKey: pub, sign: ed25519SignerFromSeed(seed) };
}

interface GateScript {
  readonly gateSeed?:   Uint8Array;            // the key the gate holds and names
  readonly ptr?:        OraclePointer | null;  // null → the face publishes nothing
  readonly bytes?:      Uint8Array;
  readonly deny?:       boolean;               // the shore refuses the reader
  readonly unsigned?:   boolean;               // auth-ok carries a signature of a key the gate never named
}

/** A channel whose far end is a peer's gate and oracle face. Records whether any map frame left. */
function gateChannel(script: GateScript): { open: (url: string) => Promise<OracleChannel>; sentMap: () => boolean; dialed: () => string } {
  let mapSent = false;
  let dialedUrl = "";
  const open = async (url: string): Promise<OracleChannel> => {
    dialedUrl = url;
    const gateSeed = script.gateSeed ?? SEED;
    const gatePub = await ed25519VerifyingKeyFromSeed(gateSeed);
    const nonce = "ab".repeat(32);
    const out: Array<string | Uint8Array | null> = [JSON.stringify(mkLarChallenge(nonce, gatePub))];
    let waiter: ((f: string | Uint8Array | null) => void) | null = null;
    const push = (f: string | Uint8Array | null): void => { if (waiter) { const w = waiter; waiter = null; w(f); } else out.push(f); };
    return {
      recv: () => out.length ? Promise.resolve(out.shift()!) : new Promise((r) => { waiter = r; }),
      close: () => {},
      send: (text) => {
        void (async () => {
          const msg = JSON.parse(text) as unknown;
          if (!isLarAuthMsg(msg)) { push(null); return; }
          const proof = msg.sig && msg.ts
            ? await verifyAuthProof({ nonce, gatePubKey: gatePub, peerPubKey: msg.contactCard, aud: DAEMON_BAG_ID, ts: msg.ts, sig: msg.sig })
            : { ok: false };
          if (script.deny || !proof.ok) { push(JSON.stringify(mkLarAuthDenied("insufficient capability"))); push(null); return; }
          const signer = ed25519SignerFromSeed(script.unsigned ? OTHER : gateSeed);
          const sig = await signer(authOkBytes({ nonce, leafNonce: msg.leafNonce, gatePubKey: gatePub, peerPubKey: msg.contactCard, aud: DAEMON_BAG_ID }));
          push(JSON.stringify(mkLarAuthOk(sig)));
          if (!script.ptr) { push(null); return; }
          mapSent = true;
          push(JSON.stringify({ type: ORACLE_POINTER_FRAME, pointer: script.ptr }));
          push(script.bytes ?? new Uint8Array());
          push(null);
        })();
      },
    };
  };
  return { open, sentMap: () => mapSent, dialed: () => dialedUrl };
}

describe("oracle-read-client — peers prove first", () => {
  test("a proven reader verifies and loads; the dial rides the oracle socket", async () => {
    const { snap, ptr } = await serve();
    const g = gateChannel({ ptr, bytes: snap.bytes });
    const res = await pullAndVerifyOracle<{ tiddlers: Record<string, { text: string }> }>("http://peer:8080", { identity: await readerIdentity(), openChannel: g.open });
    expect(res.ok, res.reason).toBe(true);
    expect(res.cid).toBe(snap.cid);
    expect(res.doc!.tiddlers.oracle.text).toBe("the constitution");
    expect(g.dialed()).toBe(`ws://peer:8080${ORACLE_SOCKET_ROUTE}`);
  });

  test("a reader the gate refuses reads nothing, and no map frame leaves the face", async () => {
    const { snap, ptr } = await serve();
    const g = gateChannel({ ptr, bytes: snap.bytes, deny: true });
    const res = await pullAndVerifyOracle("http://peer", { identity: await readerIdentity(), openChannel: g.open });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/gate refused/);
    expect(g.sentMap()).toBe(false);
  });

  test("a reader whose proof does not hold its claimed key is refused", async () => {
    const { snap, ptr } = await serve();
    const g = gateChannel({ ptr, bytes: snap.bytes });
    const forged = { ...(await readerIdentity()), sign: ed25519SignerFromSeed(OTHER) };
    const res = await pullAndVerifyOracle("http://peer", { identity: forged, openChannel: g.open });
    expect(res.ok).toBe(false);
    expect(g.sentMap()).toBe(false);
  });

  test("a verdict the named gate key never signed reads as a refusal", async () => {
    const { snap, ptr } = await serve();
    const g = gateChannel({ ptr, bytes: snap.bytes, unsigned: true });
    const res = await pullAndVerifyOracle("http://peer", { identity: await readerIdentity(), openChannel: g.open });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/gate refused/);
  });

  test("a pointer signed by a key other than the gate this socket proved to is refused", async () => {
    const foreign = await serve(OTHER);
    const g = gateChannel({ ptr: foreign.ptr, bytes: foreign.snap.bytes });
    const res = await pullAndVerifyOracle("http://peer", { identity: await readerIdentity(), openChannel: g.open });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/unpinned/);
  });

  test("a pinned publisher refuses a gate that names another key, before proving anything", async () => {
    const { snap, ptr } = await serve();
    const g = gateChannel({ gateSeed: OTHER, ptr, bytes: snap.bytes });
    const res = await pullAndVerifyOracle("http://peer", {
      identity: await readerIdentity(), verifyingKey: ptr.pub, openChannel: g.open,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not the pinned publisher/);
    expect(g.sentMap()).toBe(false);
  });

  test("missing causal parent is unavailable", async () => {
    const { snap, ptr } = await serve(SEED, ["f".repeat(64)]);
    const g = gateChannel({ ptr, bytes: snap.bytes });
    const res = await pullAndVerifyOracle("http://peer", { identity: await readerIdentity(), knownPointerIds: [], openChannel: g.open });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/unavailable/);
  });

  test("corrupted snapshot bytes fail the content address", async () => {
    const { snap, ptr } = await serve();
    const bytes = new Uint8Array([...snap.bytes].map((b, i) => i === 0 ? b ^ 0xff : b));
    const g = gateChannel({ ptr, bytes });
    const res = await pullAndVerifyOracle("http://peer", { identity: await readerIdentity(), openChannel: g.open });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/hash mismatch/);
  });

  test("a signed pointer with a mismatched Automerge frontier is refused", async () => {
    const honest = await serve();
    const forged = await buildOraclePointer({ snapshot: { ...honest.snap, heads: ["f".repeat(64)] }, parents: [], signerSeed: SEED });
    const g = gateChannel({ ptr: forged, bytes: honest.snap.bytes });
    const res = await pullAndVerifyOracle("http://peer", { identity: await readerIdentity(), openChannel: g.open });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/heads mismatch/);
  });

  test("a face with no pointer yet sends no map", async () => {
    const g = gateChannel({ ptr: null });
    const res = await pullAndVerifyOracle("http://peer", { identity: await readerIdentity(), openChannel: g.open });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/no pointer/);
  });

  test("dead peer fails closed", async () => {
    const res = await pullAndVerifyOracle("http://peer", {
      identity: await readerIdentity(), openChannel: async () => { throw new Error("ECONNREFUSED"); },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/dial failed: ECONNREFUSED/);
  });

  test("the socket URL maps http(s) to ws(s) and keeps a ws base", () => {
    expect(oracleSocketUrl("http://a:1/")).toBe("ws://a:1/oracle");
    expect(oracleSocketUrl("https://a")).toBe("wss://a/oracle");
    expect(oracleSocketUrl("ws://a:2")).toBe("ws://a:2/oracle");
  });
});
