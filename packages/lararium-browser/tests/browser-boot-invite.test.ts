/**
 * browser-boot-invite.test.ts — the Nexus invite on the browser (island-of-one), over REAL IndexedDB + REAL
 * @noble/ed25519.
 *
 * Proven:
 *   · an invite signed by a standing member's leaf ADMITS and BURNS its id LOCALLY (spend-on-boot) — the burn
 *     lands in this island's OWN IndexedDB, and the burned key names no inviter,
 *   · SINGLE-USE — a re-present of the burned invite WITHHOLDS (`already-spent`), never a throw,
 *   · a GARBLED / ABSENT / WRONG-NEXUS / UNSTANDING invite WITHHOLDS and BURNS NOTHING,
 *   · the OPEN policy admits with no invite (no burn, no record).
 */
import { describe, test, expect, afterEach } from "vitest";
import {
  signBootInvite, bootInviteId, signCarriageQuorum, signCarriageContract, makeMultiSigQuorumVerifier, hex,
  type BootInvite, type CarriageEntry, type InviteStandingContext,
} from "@lararium/mesh";
import * as ed from "@noble/ed25519";
import {
  runBrowserBootInviteSpend, isBootInviteBurned, readBootInviteBurnSet,
} from "../src/browser-boot-invite-burn.js";

const AID    = "nexus-aid-genesis-0a1b2c";
const EPOCH  = "epoch-cid-genesis";
const KAHU   = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const MEMBER = new Uint8Array(32).fill(5);
const pub    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const signer = (s: Uint8Array) => async (b: Uint8Array) => hex(await ed.signAsync(b, s));

async function standing(): Promise<InviteStandingContext> {
  return {
    roster:          { keys: await Promise.all(KAHU.map(pub)), threshold: 2, sealEpochCid: EPOCH },
    denyBoard:       [],
    antigen:         [],
    antigenRoster:   { keys: [await pub(new Uint8Array(32).fill(11))], threshold: 1, sealEpochCid: EPOCH },
    antigenVerifier: makeMultiSigQuorumVerifier(),
  };
}

async function memberAdmit(seed: Uint8Array): Promise<CarriageEntry> {
  const nym = await pub(seed);
  return signCarriageQuorum(
    { nym, action: "admit", parents: [], sealEpochCid: EPOCH },
    await Promise.all(KAHU.slice(0, 2).map(async (s) => ({ signer: await pub(s), sign: signer(s) }))),
    await signCarriageContract(nym, EPOCH, signer(seed)),
  );
}

async function invite(over: { nexusAid?: string; seed?: Uint8Array } = {}): Promise<BootInvite> {
  const seed = over.seed ?? MEMBER;
  return signBootInvite({
    nexusAid:   over.nexusAid ?? AID,
    nonce:      "a1b2c3d4e5f60718",
    inviterKey: await pub(seed),
    standing:   { kind: "admit", admit: await memberAdmit(seed), lineage: [] },
  }, signer(seed));
}

let created = 0;
const opened = new Set<string>();
function idb(): string { const n = `lares:test-boot-invite:${created++}:${Math.random().toString(36).slice(2)}`; opened.add(n); return n; }
function deleteIdb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
afterEach(async () => { for (const n of opened) await deleteIdb(n); opened.clear(); });

const spend = async (idbName: string, inv: BootInvite | null, ctx: InviteStandingContext | null = null) =>
  runBrowserBootInviteSpend({ idbName, nexusAid: AID, standing: ctx ?? await standing(), invite: inv });

describe("runBrowserBootInviteSpend — any standing face, single-use, remembered by no one (real IDB)", () => {
  test("a standing member's invite ADMITS and BURNS an id that names no inviter", async () => {
    const name = idb();
    const inv  = await invite();
    const v = await spend(name, inv);
    expect(v).toEqual({ admitted: true, burnId: bootInviteId(inv) });
    expect(await isBootInviteBurned(name, bootInviteId(inv))).toBe(true);
    const burned = [...await readBootInviteBurnSet(name)];
    expect(burned).toEqual([bootInviteId(inv)]);
    expect(burned.join()).not.toContain(inv.inviterKey);
  });

  test("SINGLE-USE — a re-present of the burned invite WITHHOLDS (already-spent, not a throw)", async () => {
    const name = idb();
    const inv  = await invite();
    await spend(name, inv);
    expect(await spend(name, inv)).toEqual({ admitted: false, refusal: "already-spent" });
  });

  test("a GARBLED / ABSENT invite WITHHOLDS and BURNS NOTHING", async () => {
    const name = idb();
    expect(await spend(name, null)).toEqual({ admitted: false, refusal: "no-invite" });
    expect([...await readBootInviteBurnSet(name)]).toEqual([]);
  });

  test("a WRONG-NEXUS or UNSTANDING invite WITHHOLDS and writes no record", async () => {
    const nameA = idb();
    expect(await spend(nameA, await invite({ nexusAid: "nexus-aid-elsewhere" })))
      .toEqual({ admitted: false, refusal: "wrong-nexus" });
    expect([...await readBootInviteBurnSet(nameA)]).toEqual([]);

    const nameB = idb();
    const noRoster = { ...(await standing()), roster: { keys: [await pub(new Uint8Array(32).fill(9))], threshold: 1, sealEpochCid: EPOCH } };
    expect(await spend(nameB, await invite(), noRoster)).toEqual({ admitted: false, refusal: "inviter-not-standing" });
    expect([...await readBootInviteBurnSet(nameB)]).toEqual([]);
  });

  test("the OPEN policy admits with no invite (no burn, no record)", async () => {
    const name = idb();
    const v = await runBrowserBootInviteSpend({ idbName: name, nexusAid: AID, standing: null, invite: null, policy: { kind: "open" } });
    expect(v.admitted).toBe(true);
    expect(v.burnId).toBeUndefined();
    expect([...await readBootInviteBurnSet(name)]).toEqual([]);
  });
});
