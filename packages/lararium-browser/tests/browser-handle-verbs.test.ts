/**
 * browser-handle-verbs.test.ts — a browser/phone vessel BURNS and ATTESTS its own face with no node CLI in
 * reach. The isomorphic twins of node's `runHandleBurn` (self · owner-burn) and `runHandleAttest`.
 *
 * The acts are platform-blind (`burnOwnHandle` · `attestUnderHead`, @lararium/mesh); THIS pins the browser
 * adapters that supply the shores from the origin's own IndexedDB (persona vault for the seed, public-handle
 * store for the announced nym) while the caller supplies the resolved WHO board its boot already holds. The
 * proof is isomorphism-by-composition: the browser twin produces the SAME burned chain / attestation the node
 * adapter does. The owner-burn HAND mirrors node's `resolveOwnerBurnHand` case-for-case.
 */
import { describe, test, expect, afterEach } from "vitest";
import {
  PERSONA_KEL_PREFIX_TIDDLER, currentOwnerSet, isBurned, headHandleKey, verifyAttestation,
  type LarDoc, type HandleKelEvent,
} from "@lararium/mesh";
import { generateOrLoadBrowserPersonaRoot } from "../src/browser-vessel-identity.js";
import { publishHandleBrowser } from "../src/browser-handle-publish.js";
import { burnFaceBrowser, attestFaceBrowser, resolveOwnerBurnHandBrowser } from "../src/browser-handle-verbs.js";
import * as ed25519 from "@noble/ed25519";

let created = 0;
const opened = new Set<string>();
function idb(): string { const n = `lares:test-hverbs:${Date.now()}:${created++}`; opened.add(n); return n; }
function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
afterEach(async () => { for (const n of opened) await deleteIdb(n); opened.clear(); });

/** A fake WHO board — a LarDoc with doc()/change(), the shape publishHandleBrowser + burnOwnHandle drive. */
function makeFakeBoard(): { doc(): LarDoc; change(fn: (d: LarDoc) => void): void } {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  return { doc: () => d, change: (fn) => fn(d) };
}
/** A fake persona-KEL board carrying no chain for the prefix — the owner-burn fail-closed control. */
function makeEmptyKelBoard(): { doc(): LarDoc } {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  return { doc: () => d };
}
const OWNER = "persona-" + "ab".repeat(32);
const ROOT  = new Uint8Array(32).fill(9);
const hexOf = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

function daemonDoc(prefix?: string): LarDoc {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  if (prefix) {
    (d.tiddlers as Record<string, unknown>)[PERSONA_KEL_PREFIX_TIDDLER] =
      { tiddler: { title: PERSONA_KEL_PREFIX_TIDDLER, text: prefix, kind: "persona-kel-prefix" } };
  }
  return d;
}

/** Publish a face onto the board + into the origin's store, returning the board + idb the twins read. */
async function publishFace(): Promise<{ name: string; board: ReturnType<typeof makeFakeBoard>; publishedCardId: string; version: number }> {
  const name = idb();
  await generateOrLoadBrowserPersonaRoot(name, 0);
  const board = makeFakeBoard();
  const card = await publishHandleBrowser({
    daemonDoc: daemonDoc(OWNER), board: board as never,
    handleIndex: 0, glamour: "Guru-Josh", idbName: name, now: 100,
  });
  return { name, board, publishedCardId: card.prev === null ? "" : card.prev, version: card.version };
}

describe("the browser burn twin — a phone vessel closes its own name", () => {
  test("★ SELF-burn: the seated handle key buries the name; the chain reads terminal ★", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);
    const board = makeFakeBoard();
    const published = await publishHandleBrowser({
      daemonDoc: daemonDoc(OWNER), board: board as never,
      handleIndex: 0, glamour: "Guru-Josh", idbName: name, now: 100,
    });

    const burned = await burnFaceBrowser({ board: board as never, handleIndex: 0, idbName: name, now: 200 });

    expect(isBurned(burned.chain as HandleKelEvent[]), "the chain ends in a burn").toBe(true);
    expect(headHandleKey(burned.chain as HandleKelEvent[]), "a buried name seats no key").toBeNull();
    expect(burned.version, "the burned card supersedes the published one").toBe(published.version + 1);
    expect(burned.nym, "the name is unchanged — the same face is buried").toBe(published.nym);
    // The genesis owner still binds — a burn changes no set.
    const owners = currentOwnerSet(burned.chain as HandleKelEvent[])!;
    expect(owners.members).toEqual([OWNER]);
  });

  test("★ owner-burn FAILS CLOSED when the persona-KEL head is unreachable — honest, toward self-burn ★", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);
    const board = makeFakeBoard();
    await publishHandleBrowser({
      daemonDoc: daemonDoc(OWNER), board: board as never,
      handleIndex: 0, glamour: "Guru-Josh", idbName: name, now: 100,
    });
    await expect(burnFaceBrowser({
      board: board as never, handleIndex: 0, idbName: name, now: 200,
      fromPersona: true, daemonDoc: daemonDoc(OWNER), kelBoard: makeEmptyKelBoard() as never,
    })).rejects.toThrow(/unreachable|fail-closed|self/i);
  });

  test("no published face at the index refuses — publish first", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);
    await expect(burnFaceBrowser({ board: makeFakeBoard() as never, handleIndex: 0, idbName: name }))
      .rejects.toThrow(/no published face/i);
  });
});

describe("resolveOwnerBurnHandBrowser — the owner-hand mirrors node case-for-case", () => {
  const PREFIX = OWNER;
  test("★ never-rotated (head == root DID) → the root seed signs the owner-burn ★", async () => {
    const rootDid = "0x" + hexOf(await ed25519.getPublicKeyAsync(ROOT));
    const r = await resolveOwnerBurnHandBrowser({ personaKelPrefix: PREFIX, headOpKeyDid: rootDid, rootSeed: ROOT });
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.ownerBurn.ownerAuthMemberPrefix).toBe(PREFIX);
    expect(r.ownerBurn.ownerAuthKeyDid.toLowerCase()).toBe(rootDid.toLowerCase());
    const msg = Uint8Array.from([1, 2, 3, 4]);
    const sig = await r.ownerBurn.sign(msg);
    const sigBytes = Uint8Array.from(sig.match(/../g)!.map((h) => parseInt(h, 16)));
    expect(await ed25519.verifyAsync(sigBytes, msg, await ed25519.getPublicKeyAsync(ROOT)),
      "the resolved signer verifies as the persona root").toBe(true);
  });

  test("★ ROTATED (head != root) → REFUSES, fail-closed toward self-burn ★", async () => {
    const otherDid = "0x" + hexOf(await ed25519.getPublicKeyAsync(new Uint8Array(32).fill(7)));
    const r = await resolveOwnerBurnHandBrowser({ personaKelPrefix: PREFIX, headOpKeyDid: otherDid, rootSeed: ROOT });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/rotated|self/i);
  });

  test("★ unreachable head (null) → REFUSES, fail-closed ★", async () => {
    const r = await resolveOwnerBurnHandBrowser({ personaKelPrefix: PREFIX, headOpKeyDid: null, rootSeed: ROOT });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unreachable|fail-closed|self/i);
  });
});

describe("the browser attest twin — a face signs a claim under its head", () => {
  test("★ attests under the head; the statement verifies reader-locally against the chain ★", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);
    const board = makeFakeBoard();
    const card = await publishHandleBrowser({
      daemonDoc: daemonDoc(OWNER), board: board as never,
      handleIndex: 0, glamour: "Guru-Josh", idbName: name, now: 100,
    });

    const statement = await attestFaceBrowser({ board: board as never, handleIndex: 0, claim: "controls example.net", idbName: name });

    expect(statement.prefix, "the claim speaks for the published nym").toBe(card.nym);
    expect(statement.claim).toBe("controls example.net");
    const v = await verifyAttestation(card.chain as HandleKelEvent[], statement);
    expect(v.ok, v.reason).toBe(true);
  });

  test("an empty claim attests nothing — refuse", async () => {
    const name = idb();
    await generateOrLoadBrowserPersonaRoot(name, 0);
    const board = makeFakeBoard();
    await publishHandleBrowser({
      daemonDoc: daemonDoc(OWNER), board: board as never,
      handleIndex: 0, glamour: "Guru-Josh", idbName: name, now: 100,
    });
    await expect(attestFaceBrowser({ board: board as never, handleIndex: 0, claim: "   ", idbName: name }))
      .rejects.toThrow(/empty claim/i);
  });
});
