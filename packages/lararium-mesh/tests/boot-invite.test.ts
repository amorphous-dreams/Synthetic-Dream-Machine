/**
 * boot-invite.test.ts — an invite from any standing face, burned once, remembered by no one.
 *
 * Proven:
 *   · an invite signed by a MEMBER's per-Nexus leaf, carrying its held admit, ADMITS and names a burn id,
 *   · a `seat` invite refuses `seat-standing-owed`, even from a key a chair carries: a chair holds a
 *     PersonaGroup root, so a Kahu invites through the `admit` arm on its leaf,
 *   · an inviter whose admit a counted revoke closes, a stranger with no admit, an admit naming a different
 *     key, and a missing standing context each withhold `inviter-not-standing`,
 *   · SINGLE-USE — once `isSpent` reports the burn id, a re-present draws `already-spent`,
 *   · garbled / absent → `no-invite`; wrong Nexus → `wrong-nexus`; a tampered or foreign seal → `bad-signature`,
 *   · NO CLOCK — the invite carries no expiry, and the module source names no clock,
 *   · ONE HOP, REMEMBERED BY NO ONE — the burn id digests the Nexus and nonce alone: two inviters' invites with
 *     one nonce burn as one, and the id derives nothing of the inviter or its standing,
 *   · the OPEN policy admits with no invite at all,
 *   · THE HOSTED ARM — a user face stands by the hearth that hosts it: a countersigned user invite ADMITS; one
 *     without a countersign withholds `no-countersign`; a countersign from a revoked or unadmitted hearth
 *     refuses `host-not-standing`; one over a different nonce, Nexus or walker refuses `bad-countersign`; a
 *     Kapae'd walker withholds `inviter-not-standing`,
 *   · THE HEARTH'S SIDE countersigns only over a live session the walker's leaf signed, only for its own Nexus,
 *     and only with an admit on its own leaf; what it returns and what it signs name no guest.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalJsonBytes, sha256HexBytesSync } from "../src/crypto.js";
import {
  signBootInvite, bootInviteId, decideBootInvite,
  countersignHostedInvite, signHostCountersignRequest, hostCountersignBytes,
  NEXUS_INVITE_DOMAIN, HOST_COUNTERSIGN_DOMAIN, type BootInvite, type InviterStanding, type InviteStandingContext,
  type HostSession, type HostedStanding,
} from "../src/boot-invite.js";
import { carriageEntryActCid, type CarriageEntry } from "../src/carriage-registry.js";
import { signAntigenEntry, makeMultiSigQuorumVerifier } from "../src/kapae-antigen.js";
import { pubOf, signerOf, kahuRoster, kahuSigners, carriageAct } from "./fixtures/carriage.js";

const EPOCH = "epoch-cid-genesis";
const AID   = "nexus-aid-genesis-0a1b2c";
const SEEDS = {
  guru:     new Uint8Array(32).fill(1),
  telarus:  new Uint8Array(32).fill(2),
  lindwyrm: new Uint8Array(32).fill(3),
  member:   new Uint8Array(32).fill(5),   // a Lamplighter's per-Nexus leaf
  user:     new Uint8Array(32).fill(6),
  stranger: new Uint8Array(32).fill(7),
  warden1:  new Uint8Array(32).fill(11),
  warden2:  new Uint8Array(32).fill(12),
};
const neverSpent = () => false;

async function ctx(over: Partial<InviteStandingContext> = {}): Promise<InviteStandingContext> {
  return {
    roster:          await kahuRoster([SEEDS.guru, SEEDS.telarus, SEEDS.lindwyrm], 2, EPOCH),
    denyBoard:       [],
    antigen:         [],
    antigenRoster:   await kahuRoster([SEEDS.warden1, SEEDS.warden2], 2, EPOCH),
    antigenVerifier: makeMultiSigQuorumVerifier(),
    ...over,
  };
}

const admitOf = (seed: Uint8Array): Promise<CarriageEntry> =>
  carriageAct(seed, "admit", { kahu: [SEEDS.guru, SEEDS.telarus], epoch: EPOCH });

async function invite(
  signer: Uint8Array,
  standing: InviterStanding,
  over: { nexusAid?: string; nonce?: string } = {},
): Promise<BootInvite> {
  return signBootInvite({
    nexusAid:   over.nexusAid ?? AID,
    nonce:      over.nonce ?? "a1b2c3d4e5f60718",
    inviterKey: await pubOf(signer),
    standing,
  }, signerOf(signer));
}

async function decide(inv: BootInvite | null, over: { standing?: InviteStandingContext | null; isSpent?: (id: string) => boolean } = {}) {
  return decideBootInvite({
    policy: { kind: "invite-only" }, nexusAid: AID, invite: inv,
    standing: over.standing === undefined ? await ctx() : over.standing,
    isSpent:  over.isSpent ?? neverSpent,
  });
}

describe("decideBootInvite — any standing face invites", () => {
  test("a MEMBER's leaf invite, carrying its held admit, ADMITS and names its burn id", async () => {
    const inv = await invite(SEEDS.member, { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] });
    const v = await decide(inv);
    expect(v).toEqual({ admitted: true, burnId: bootInviteId(inv) });
  });

  test("a `seat` invite REFUSES `seat-standing-owed` — a chair carries a PersonaGroup root, and a root proof never rides a wire", async () => {
    // guru's key sits in the roster as a chair (a root key): a hand-built `seat` invite it signs must not stand.
    const chair = await invite(SEEDS.guru, { kind: "seat" });
    expect(await decide(chair)).toEqual({ admitted: false, refusal: "seat-standing-owed" });
    // A key no chair carries refuses the same way: the arm is refused before any roster is read.
    expect(await decide(await invite(SEEDS.user, { kind: "seat" })))
      .toEqual({ admitted: false, refusal: "seat-standing-owed" });
    // CONTROL: a leaf invite through the `admit` arm stands on the same Nexus material.
    const leaf = await invite(SEEDS.member, { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] });
    expect((await decide(leaf)).admitted).toBe(true);
  });

  test("an inviter whose admit a counted revoke closes withholds — the deny board decides", async () => {
    const admit  = await admitOf(SEEDS.member);
    const revoke = await carriageAct(SEEDS.member, "revoke", {
      kahu: [SEEDS.guru, SEEDS.telarus], epoch: EPOCH, parents: [carriageEntryActCid(admit)],
    });
    const inv = await invite(SEEDS.member, { kind: "admit", admit, lineage: [] });
    expect((await decide(inv)).admitted).toBe(true);   // control: the same invite stands on an empty board
    expect(await decide(inv, { standing: await ctx({ denyBoard: [revoke] }) }))
      .toEqual({ admitted: false, refusal: "inviter-not-standing" });
  });

  test("an admit naming a DIFFERENT key than the signing leaf withholds (standing never lends)", async () => {
    const inv = await invite(SEEDS.stranger, { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] });
    expect(await decide(inv)).toEqual({ admitted: false, refusal: "inviter-not-standing" });
  });

  test("no standing context → an invite-only gate withholds; it never admits on an unread standing", async () => {
    const inv = await invite(SEEDS.member, { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] });
    expect(await decide(inv, { standing: null })).toEqual({ admitted: false, refusal: "inviter-not-standing" });
  });

  test("SINGLE-USE — a burned invite draws `already-spent` (withhold, not a throw)", async () => {
    const inv = await invite(SEEDS.member, { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] });
    const id  = bootInviteId(inv);
    expect(await decide(inv, { isSpent: (b) => b === id })).toEqual({ admitted: false, refusal: "already-spent" });
  });

  test("GARBLED / ABSENT → no-invite; WRONG NEXUS → wrong-nexus; a tampered or foreign seal → bad-signature", async () => {
    const standing: InviterStanding = { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] };
    expect(await decide(null)).toEqual({ admitted: false, refusal: "no-invite" });
    expect(await decide({ garbage: true } as unknown as BootInvite)).toEqual({ admitted: false, refusal: "no-invite" });

    const elsewhere = await invite(SEEDS.member, standing, { nexusAid: "nexus-aid-elsewhere" });
    expect(await decide(elsewhere)).toEqual({ admitted: false, refusal: "wrong-nexus" });

    const inv = await invite(SEEDS.member, standing);
    expect(await decide({ ...inv, nonce: "deadbeefdeadbeef" })).toEqual({ admitted: false, refusal: "bad-signature" });
    // A stranger re-signs nothing: swapping in the member's key under the stranger's seal fails the seal.
    const forged = await invite(SEEDS.stranger, standing);
    expect(await decide({ ...forged, inviterKey: await pubOf(SEEDS.member) }))
      .toEqual({ admitted: false, refusal: "bad-signature" });
  });

  test("OPEN policy admits with NO invite at all", async () => {
    const v = await decideBootInvite({ policy: { kind: "open" }, nexusAid: AID, invite: null, standing: null, isSpent: neverSpent });
    expect(v.admitted).toBe(true);
  });
});

describe("no clock, one hop, remembered by no one", () => {
  test("the invite carries no expiry, and the module source names no clock", async () => {
    const inv = await invite(SEEDS.member, { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] });
    expect(inv.kind).toBe(NEXUS_INVITE_DOMAIN);
    expect(Object.keys(inv).sort()).toEqual(["inviterKey", "kind", "nexusAid", "nonce", "sig", "standing"]);
    const src = readFileSync(new URL("../src/boot-invite.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/Date\b|expiresAt|\bnow\b|performance\.|setTimeout/);
  });

  test("the burn id digests the Nexus and nonce ALONE — two inviters, one nonce, one burn", async () => {
    const a = await invite(SEEDS.member, { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] });
    const b = await invite(SEEDS.user, { kind: "admit", admit: await admitOf(SEEDS.user), lineage: [] });
    expect(bootInviteId(a)).toBe(bootInviteId(b));
    expect(bootInviteId(a)).toBe(sha256HexBytesSync(canonicalJsonBytes({ kind: NEXUS_INVITE_DOMAIN, nexusAid: AID, nonce: a.nonce })));
    // A spent-set holding member A's burn refuses user B's invite on the same nonce: the burn knows no inviter.
    expect(await decide(b, { isSpent: (id) => id === bootInviteId(a) })).toEqual({ admitted: false, refusal: "already-spent" });
    // And a different nonce burns apart.
    expect(bootInviteId(await invite(SEEDS.member, { kind: "admit", admit: await admitOf(SEEDS.member), lineage: [] }, { nonce: "ffff" }))).not.toBe(bootInviteId(a));
  });

  test("the verdict names nobody — no inviter key, no admit, no standing rides out", async () => {
    const admit = await admitOf(SEEDS.member);
    const inv = await invite(SEEDS.member, { kind: "admit", admit, lineage: [] });
    const v = await decide(inv);
    expect(Object.keys(v).sort()).toEqual(["admitted", "burnId"]);
    const blob = JSON.stringify(v);
    expect(blob).not.toContain(await pubOf(SEEDS.member));
    expect(blob).not.toContain(carriageEntryActCid(admit));
  });
});

// ── THE HOSTED ARM ─────────────────────────────────────────────────────────────────────────────────

const HEARTH = SEEDS.member;              // a Lamplighter's leaf, admitted: the hearth that hosts the walker
const WALKER = SEEDS.user;                // a user face: holds no admit
const GATE   = new Uint8Array(32).fill(21);
const NONCE  = "a1b2c3d4e5f60718";

async function session(nonce = "5e5510a0000000000000000000000001"): Promise<HostSession> {
  return { nonce, gatePubKey: await pubOf(GATE) };
}

/** The hearth countersigns a walker's request over `sess`; throws on a refusal (the fixtures expect a lend). */
async function hostedStanding(over: {
  hearth?: Uint8Array; admitSeed?: Uint8Array; walker?: Uint8Array; nonce?: string; nexusAid?: string;
} = {}): Promise<HostedStanding> {
  const hearth = over.hearth ?? HEARTH;
  const walker = over.walker ?? WALKER;
  const sess = await session();
  const request = await signHostCountersignRequest(
    { session: sess, nexusAid: over.nexusAid ?? AID, nonce: over.nonce ?? NONCE, walkerKey: await pubOf(walker) }, signerOf(walker),
  );
  const v = await countersignHostedInvite({
    session: sess, request, nexusAid: over.nexusAid ?? AID,
    hearth: { key: await pubOf(hearth), admit: await admitOf(over.admitSeed ?? hearth), lineage: [], sign: signerOf(hearth) },
  });
  if (!v.ok) throw new Error(`countersign refused: ${v.refusal}`);
  return v.standing;
}

const userInvite = async (standing: InviterStanding, over: { nonce?: string; walker?: Uint8Array } = {}) =>
  invite(over.walker ?? WALKER, standing, { nonce: over.nonce ?? NONCE });

describe("the hosted arm — a user stands by the hearth that hosts it", () => {
  test("CONTROL: a user invite countersigned by its standing hearth ADMITS", async () => {
    const inv = await userInvite(await hostedStanding());
    expect(await decide(inv)).toEqual({ admitted: true, burnId: bootInviteId(inv) });
  });

  test("a user invite WITHOUT a countersign is withheld (`no-countersign`)", async () => {
    const lent = await hostedStanding();
    expect(await decide(await userInvite({ ...lent, countersig: "" })))
      .toEqual({ admitted: false, refusal: "no-countersign" });
    const { countersig: _drop, ...bare } = lent;
    expect(await decide(await userInvite(bare as unknown as InviterStanding)))
      .toEqual({ admitted: false, refusal: "no-countersign" });
  });

  test("a countersign from a NON-STANDING hearth is refused (`host-not-standing`)", async () => {
    // A hearth whose admit a counted revoke closes.
    const lent = await hostedStanding();
    const inv = await userInvite(lent);
    const revoke = await carriageAct(HEARTH, "revoke", {
      kahu: [SEEDS.guru, SEEDS.telarus], epoch: EPOCH, parents: [carriageEntryActCid(lent.admit)],
    });
    expect(await decide(inv, { standing: await ctx({ denyBoard: [revoke] }) }))
      .toEqual({ admitted: false, refusal: "host-not-standing" });
    // A stranger hearth presenting a member's admit: the admit never lends to a key it does not name.
    const borrowed: HostedStanding = { ...(await hostedStanding({ hearth: SEEDS.stranger, admitSeed: SEEDS.stranger })), admit: lent.admit };
    expect(await decide(await userInvite(borrowed))).toEqual({ admitted: false, refusal: "host-not-standing" });
    // A hearth the kahu quorum never admitted: its admit counts under no seat.
    const unseated = { ...(await ctx()), roster: await kahuRoster([SEEDS.warden1, SEEDS.warden2], 2, EPOCH) };
    expect(await decide(inv, { standing: unseated })).toEqual({ admitted: false, refusal: "host-not-standing" });
  });

  test("a countersign over a DIFFERENT nonce, Nexus or walker is refused (`bad-countersign`)", async () => {
    const lent = await hostedStanding({ nonce: "0000000000000001" });
    expect(await decide(await userInvite(lent))).toEqual({ admitted: false, refusal: "bad-countersign" });
    // CONTROL: the same lend on its own nonce stands.
    expect((await decide(await userInvite(lent, { nonce: "0000000000000001" }))).admitted).toBe(true);
    // A lend made for another Nexus does not cross into this one.
    const foreign = await hostedStanding({ nexusAid: "nexus-aid-elsewhere" });
    expect(await decide(await userInvite(foreign))).toEqual({ admitted: false, refusal: "bad-countersign" });
    // A lend to one walker never stands for another walker on the same nonce.
    expect(await decide(await userInvite(await hostedStanding(), { walker: SEEDS.stranger })))
      .toEqual({ admitted: false, refusal: "bad-countersign" });
  });

  test("a Kapae'd walker withholds even with a standing hearth's countersign", async () => {
    const wardens = await Promise.all([SEEDS.warden1, SEEDS.warden2].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
    const kapae = await signAntigenEntry({ nym: await pubOf(WALKER), action: "kapae", parents: [], sealEpochCid: EPOCH }, wardens);
    const inv = await userInvite(await hostedStanding());
    expect(await decide(inv, { standing: await ctx({ antigen: [kapae] }) }))
      .toEqual({ admitted: false, refusal: "inviter-not-standing" });
  });

  test("the countersign names no guest, and the verdict names neither walker nor hearth", async () => {
    const lent = await hostedStanding();
    expect(Object.keys(lent).sort()).toEqual(["admit", "countersig", "hearthKey", "kind", "lineage"]);
    expect(JSON.parse(new TextDecoder().decode(hostCountersignBytes({ nexusAid: AID, nonce: NONCE, walkerKey: await pubOf(WALKER) }))))
      .toEqual({ kind: HOST_COUNTERSIGN_DOMAIN, nexusAid: AID, nonce: NONCE, walkerKey: await pubOf(WALKER) });
    const v = await decide(await userInvite(lent));
    expect(Object.keys(v).sort()).toEqual(["admitted", "burnId"]);
    const blob = JSON.stringify(v);
    expect(blob).not.toContain(await pubOf(WALKER));
    expect(blob).not.toContain(await pubOf(HEARTH));
  });
});

describe("countersignHostedInvite — the hearth lends only over a live session", () => {
  async function ask(over: {
    session?: HostSession | null; proveOver?: HostSession; nexusAid?: string; admitSeed?: Uint8Array;
  } = {}) {
    const live = await session();
    const request = await signHostCountersignRequest(
      { session: over.proveOver ?? live, nexusAid: AID, nonce: NONCE, walkerKey: await pubOf(WALKER) }, signerOf(WALKER),
    );
    return countersignHostedInvite({
      session: over.session === undefined ? live : over.session, request, nexusAid: over.nexusAid ?? AID,
      hearth: { key: await pubOf(HEARTH), admit: await admitOf(over.admitSeed ?? HEARTH), lineage: [], sign: signerOf(HEARTH) },
    });
  }

  test("CONTROL: a request proven over the live session is countersigned", async () => {
    expect((await ask()).ok).toBe(true);
  });

  test("no live session → `no-live-session`", async () => {
    expect(await ask({ session: null })).toEqual({ ok: false, refusal: "no-live-session" });
  });

  test("a proof over ANOTHER session (a replayed request) → `bad-session-proof`", async () => {
    expect(await ask({ proveOver: await session("5e5510a0000000000000000000000002") }))
      .toEqual({ ok: false, refusal: "bad-session-proof" });
    expect(await ask({ proveOver: { nonce: (await session()).nonce, gatePubKey: await pubOf(SEEDS.stranger) } }))
      .toEqual({ ok: false, refusal: "bad-session-proof" });
  });

  test("a request for another Nexus → `wrong-nexus`; an admit on another key → `hearth-not-admitted`", async () => {
    expect(await ask({ nexusAid: "nexus-aid-elsewhere" })).toEqual({ ok: false, refusal: "wrong-nexus" });
    expect(await ask({ admitSeed: SEEDS.stranger })).toEqual({ ok: false, refusal: "hearth-not-admitted" });
  });
});
