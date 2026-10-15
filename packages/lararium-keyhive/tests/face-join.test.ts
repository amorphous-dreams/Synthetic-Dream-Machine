/**
 * face-join — the gate that decides who reaches the group key.
 *
 * The edges here get SIGNED for real (`buildDeviceDelegation`), so a refusal proves the crypto refused and
 * never that a stub returned false. The provider stands as a recording fake: this file fences the DECISION —
 * which summons earns a seat, which gets turned away, and whether a repeat re-keys — and leaves keyhive's own
 * CGKA behaviour to keyhive's tests.
 */
import { describe, test, expect } from "vitest";
import { buildDeviceDelegation } from "@lararium/mesh";
import { runFaceJoin, gateFaceJoin, type FaceJoinProvider, type FaceJoinContext } from "../src/face-join.js";

const FOUNDER_SEED = new Uint8Array(32).fill(7);
const OTHER_SEED   = new Uint8Array(32).fill(9);
// A REAL verifying key (RFC 8032 §7.1 TEST 1): a device edge names only a key the Ed25519 door accepts.
const JOINEE_KEY   = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const HEARTH       = "bafkreift7cvcpxxqusdb4lkxsxnt3mzv5uip6tpytinrh7ibgrvu7ceqwa";

/** The identifier a card derives ends in the raw verifying key — the relationship the Binding Gate leans on. */
const cardIdFor = (key: string) => `0x${key}`;

async function edgeFor(opts: { seed?: Uint8Array; key?: string; hearth?: string } = {}) {
  return buildDeviceDelegation({
    personaRootSeed:    opts.seed ?? FOUNDER_SEED,
    deviceVerifyingKey: opts.key  ?? JOINEE_KEY,
    hearthTrueName:     opts.hearth ?? HEARTH,
    boundEpoch:         0,
  });
}

interface Calls { received: number; added: string[]; events: number; resealed: string[] }

function fakeProvider(opts: { seated?: boolean; cardId?: string } = {}): FaceJoinProvider & { calls: Calls } {
  const calls: Calls = { received: 0, added: [], events: 0, resealed: [] };
  return {
    calls,
    async receiveContactCard() { calls.received++; return { id: opts.cardId ?? cardIdFor(JOINEE_KEY) }; },
    async verifyGroupMembership() { return opts.seated ? { ok: true } : { ok: false, reason: "no access" }; },
    async addGroupMember(member, group) { calls.added.push(`${member}@${group}`); },
    async reSealBag(bagUrl) { calls.resealed.push(bagUrl); return [{ contentRef: new Uint8Array([7]), ciphertext: new Uint8Array([8, 9]) }]; },
    async eventsForPeer() { calls.events++; return [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]; },
    async contactCard() { return new TextEncoder().encode('{"founder":"card"}'); },
  };
}

async function ctxFor(): Promise<FaceJoinContext> {
  const own = await edgeFor();
  return {
    personaRootDid:       own.personaRootDid,
    hearthTrueName:       HEARTH,
    personaGroupId:       "ab".repeat(16),
    dyad: () => "clear", leaseEpoch:           0,          // an unfed resource — the epoch a founding's grants bind to
  };
}

const summons = (deviceEdge: Awaited<ReturnType<typeof edgeFor>>, force?: boolean) =>
  ({ kind: "face-join/v1" as const, contactCard: '{"joinee":"card"}', deviceEdge, ...(force !== undefined ? { force } : {}) });

describe("the gate — a signature, never a list", () => {
  test("an edge this root signed, for this hearth, naming this card → admitted", async () => {
    const ctx = await ctxFor();
    const out = await runFaceJoin(fakeProvider(), summons(await edgeFor()), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.grant.capEvents).toHaveLength(2);
    expect(out.grant.founderCard).toBe('{"founder":"card"}');
    expect(out.grant.reKeyed).toBe(true);
  });

  test("an edge signed by ANOTHER root → refused, and nothing enters local state", async () => {
    const ctx = await ctxFor();
    const p   = fakeProvider();
    const out = await runFaceJoin(p, summons(await edgeFor({ seed: OTHER_SEED })), ctx);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toMatch(/pinned root|edge refused/i);
    expect(p.calls.received).toBe(0);   // the card never reached the provider
    expect(p.calls.added).toEqual([]);
  });

  test("an edge bound to a DIFFERENT hearth → refused before the card is read", async () => {
    const ctx = await ctxFor();
    const p   = fakeProvider();
    const out = await runFaceJoin(p, summons(await edgeFor({ hearth: "bafkreiOTHERPLACE" })), ctx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/different hearth/i);
    expect(p.calls.received).toBe(0);
  });

  test("a VALID edge presented with somebody ELSE'S card → refused, and no seat is granted", async () => {
    const ctx = await ctxFor();
    // The card resolves to a different key than the edge licenses — the impersonation this binding exists for.
    const p   = fakeProvider({ cardId: cardIdFor("a".repeat(64)) });
    const out = await runFaceJoin(p, summons(await edgeFor()), ctx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/different key/i);
    expect(p.calls.added).toEqual([]);   // received, but never seated
  });

  test("a summons carrying no edge → refused, never thrown", async () => {
    const ctx = await ctxFor();
    const out = await runFaceJoin(fakeProvider(), { kind: "face-join/v1", contactCard: "{}", deviceEdge: undefined as never }, ctx);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/no device-delegation/i);
  });

  test("a grant bound BELOW the resource's lease epoch reads stale — the lease decides, not the clock", async () => {
    const ctx = await ctxFor();
    // The wall clock still reads inside the window; only the max-register moved. A gate that consulted the
    // clock alone would admit this, resting the decision on each device's own narration of "now".
    const rolled = { ...ctx, leaseEpoch: 3 };
    const p   = fakeProvider();
    const out = await runFaceJoin(p, summons(await edgeFor()), rolled);   // the edge binds epoch 0
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/lease stale|epoch rolled/i);
    expect(p.calls.received).toBe(0);
  });

  test("a lease that has NOT rolled admits the same edge — staleness, never mere age", async () => {
    const ctx = await ctxFor();
    const out = await runFaceJoin(fakeProvider(), summons(await edgeFor()), { ...ctx, leaseEpoch: 0 });
    expect(out.ok).toBe(true);
  });

  test("gateFaceJoin runs its edge checks with no card at all", async () => {
    const ctx = await ctxFor();
    await expect(gateFaceJoin({ edge: await edgeFor(), ctx })).resolves.toEqual({ ok: true });
  });
});

describe("the re-seal — a seat that reaches what the group already held", () => {
  test("a fresh seat re-seals the named bags' standing chunks, AFTER the add, and the grant carries them", async () => {
    const ctx = { ...(await ctxFor()), reseal: ["lar:///ha.ka.ba/bags/catalog", "lar:///ha.ka.ba/bags/persona"] };
    const p   = fakeProvider();
    const out = await runFaceJoin(p, summons(await edgeFor()), ctx);
    expect(out.ok).toBe(true);
    expect(p.calls.added).toHaveLength(1);
    expect(p.calls.resealed).toEqual(["lar:///ha.ka.ba/bags/catalog", "lar:///ha.ka.ba/bags/persona"]);
    if (out.ok) expect(out.grant.reSealed.map((c) => c.bagUrl)).toEqual(["lar:///ha.ka.ba/bags/catalog", "lar:///ha.ka.ba/bags/persona"]);
  });

  test("a seat with NO bag named to re-seal carries no chunk — the earlier span stays unreached, visibly", async () => {
    // The group carries the seat into every bag it reaches, forward; what stood sealed before stays keyed to an
    // epoch the member stands outside of, and only an empty `reSealed` says so.
    const ctx = await ctxFor();                     // no `reseal` — the daemon named no standing bags
    const out = await runFaceJoin(fakeProvider(), summons(await edgeFor()), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.grant.reKeyed).toBe(true);
    expect(out.grant.reSealed).toEqual([]);
  });

  test("an already-seated device re-seals NOTHING — no seat moved, no epoch moved", async () => {
    const ctx = { ...(await ctxFor()), reseal: ["lar:///ha.ka.ba/bags/catalog"] };
    const p   = fakeProvider({ seated: true });
    await runFaceJoin(p, summons(await edgeFor()), ctx);
    expect(p.calls.resealed).toEqual([]);
  });

  test("a REFUSED summons re-seals nothing", async () => {
    const ctx = { ...(await ctxFor()), reseal: ["lar:///ha.ka.ba/bags/catalog"] };
    const p   = fakeProvider();
    await runFaceJoin(p, summons(await edgeFor({ seed: OTHER_SEED })), ctx);
    expect(p.calls.resealed).toEqual([]);
  });
});

describe("the repeat — membership lives founder-side", () => {
  test("an already-seated device gets its events back with NO re-key", async () => {
    const ctx = await ctxFor();
    const p   = fakeProvider({ seated: true });
    const out = await runFaceJoin(p, summons(await edgeFor()), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.grant.reKeyed).toBe(false);
    expect(p.calls.added).toEqual([]);          // the group epoch never moved
    expect(out.grant.capEvents).toHaveLength(2); // and it still recovers its material
  });

  test("a device whose group was RE-FOUNDED holds no seat → the add genuinely runs", async () => {
    const ctx = await ctxFor();
    const p   = fakeProvider({ seated: false });
    const out = await runFaceJoin(p, summons(await edgeFor()), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.grant.reKeyed).toBe(true);
    expect(p.calls.added).toEqual([`${cardIdFor(JOINEE_KEY)}@${ctx.personaGroupId}`]);
  });

  test("force re-keys a seated device — the answer to a suspected-but-unrevoked key", async () => {
    const ctx = await ctxFor();
    const p   = fakeProvider({ seated: true });
    const out = await runFaceJoin(p, summons(await edgeFor(), true), ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.grant.reKeyed).toBe(true);
    expect(p.calls.added).toHaveLength(1);
  });

  test("force NEVER lifts the gate — an unlicensed edge stays refused", async () => {
    const ctx = await ctxFor();
    const p   = fakeProvider({ seated: true });
    const out = await runFaceJoin(p, summons(await edgeFor({ seed: OTHER_SEED }), true), ctx);
    expect(out.ok).toBe(false);
    expect(p.calls.added).toEqual([]);
  });
});


describe("the Binding Gate reads the dyad's shadow", () => {
  test("an aside device draws the signature refusal", async () => {
    const base = await ctxFor(), p = fakeProvider();
    const refused = await runFaceJoin(p, summons(await edgeFor()), { ...base, dyad: () => "aside" });
    // MU: word for word what an edge with a false signature draws at this door.
    const forged = await runFaceJoin(fakeProvider(), summons({ ...(await edgeFor()), signature: "00".repeat(64) }), base);
    expect(forged).toEqual({ ok: false, reason: "edge refused: signature mismatch" });
    expect(refused).toEqual(forged);
    expect(p.calls.received).toBe(0); expect(p.calls.added).toEqual([]);
    const control = await runFaceJoin(fakeProvider(), summons(await edgeFor()), { ...base, dyad: () => "clear" });
    expect(control.ok).toBe(true);
  });
  test("the shadow lookup receives the summons device key", async () => {
    const base = await ctxFor(), seen: string[] = [];
    await runFaceJoin(fakeProvider(), summons(await edgeFor()), { ...base, dyad: (key) => { seen.push(key); return "clear"; } });
    expect(seen).toContain(JOINEE_KEY);
  });
  test("a returned device receives a fresh seat without resealing old bags", async () => {
    const base = await ctxFor(), ctx = { ...base, dyad: () => "returned" as const, reseal: ["bag"] };
    const p = fakeProvider();
    const result = await runFaceJoin(p, summons(await edgeFor()), ctx);
    expect(result.ok).toBe(true); expect(p.calls.added).toHaveLength(1); expect(p.calls.resealed).toEqual([]);
    if (result.ok) expect(result.grant.reSealed).toEqual([]);
    const control = fakeProvider();
    await runFaceJoin(control, summons(await edgeFor()), { ...base, dyad: () => "clear", reseal: ["bag"] });
    expect(control.calls.resealed).toEqual(["bag"]);
  });
});

describe("a device that returns takes a fresh seat, and an earlier seat leaves first", () => {
  type Rolling = ReturnType<typeof fakeProvider> & { revoked: string[]; revokeGroupSeat: (a: string, g: string) => Promise<{ how: "revoked" | "gone" | "no-authority" }> };
  const rolling = (how: "revoked" | "gone" | "no-authority", seated = true): Rolling => {
    const p = fakeProvider({ seated }) as Rolling;
    p.revoked = [];
    p.revokeGroupSeat = async (a) => { p.revoked.push(a); return { how }; };
    return p;
  };

  test("an owing device that still holds its earlier seat gets that seat revoked, then a fresh one", async () => {
    const base = await ctxFor(), p = rolling("revoked");
    const out = await runFaceJoin(p, summons(await edgeFor()), { ...base, dyad: () => "owing" });
    expect(out.ok).toBe(true);
    expect(p.revoked).toHaveLength(1);
    expect(p.calls.added).toHaveLength(1);
    if (out.ok) expect(out.grant.reKeyed).toBe(true);
  });

  test("CONTROL: a returned device whose raises all got answered keeps the seat it holds", async () => {
    const base = await ctxFor(), p = rolling("revoked");
    const out = await runFaceJoin(p, summons(await edgeFor()), { ...base, dyad: () => "returned" });
    expect(out.ok).toBe(true);
    expect(p.revoked).toEqual([]);
    expect(p.calls.added).toEqual([]);
  });

  test("where this hand holds no authority over the earlier seat, the join refuses and seats nobody", async () => {
    const base = await ctxFor(), p = rolling("no-authority");
    const out = await runFaceJoin(p, summons(await edgeFor()), { ...base, dyad: () => "owing" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toMatch(/roll stays owed/);
    expect(p.calls.added).toEqual([]);
  });

  test("a provider with no revoke capability refuses the same join, forced or not", async () => {
    const base = await ctxFor(), p = fakeProvider({ seated: true });
    const out = await runFaceJoin(p, summons(await edgeFor(), true), { ...base, dyad: () => "owing" });
    expect(out.ok).toBe(false);
    expect(p.calls.added).toEqual([]);
  });

  test("an owing device with no seat left takes a fresh seat and no re-seal", async () => {
    const base = await ctxFor(), p = rolling("revoked", false);
    const out = await runFaceJoin(p, summons(await edgeFor()), { ...base, dyad: () => "owing", reseal: ["bag"] });
    expect(out.ok).toBe(true);
    expect(p.revoked).toEqual([]);
    expect(p.calls.added).toHaveLength(1);
    expect(p.calls.resealed).toEqual([]);
  });
});
