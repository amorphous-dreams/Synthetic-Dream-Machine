/**
 * cabal-join — the applicant crosses through the realm's shared vouch board, or learns which gate refused.
 *
 * THE LAST TEST CARRIES THE WEIGHT. `admitToRealm` takes a vouch DAG already folded, so the
 * per-voucher cap — the choke on how much mass one hand injects into a lineage — falls to whoever
 * assembled the edges. `admitOnLineage` folds inside the gate, where it cannot be left out. A door
 * onto the wrong one of those two passes every test here except that one.
 *
 * A refused applicant ANERGIZES: it stays at the floor. Vouch and join resolve their records by realm id,
 * including when the vessel stands under a seated charter.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import * as ed from "@noble/ed25519";
import { hex, hexToBytes, signCabalInvite, writeVouch, realmVouchBoardDocUrl, materializeSharedLarDoc, DEFAULT_JOIN_POLICY, DAEMON_BAG_ID, seedDaemonDoc } from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey,
  wearPersona,
} from "../src/node-vessel-identity.js";
import { larDataDir, larSealHome, larBootstrapPath } from "../src/vessel-paths.js";
import { readNexusDoc, writeNexusDoc } from "../src/nexus-doc.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { ownedStore } from "../src/owned-store.js";
import { runCabalVouch } from "../src/commands/cabal-vouch.js";
import { runCabalJoin, CabalJoinError } from "../src/commands/cabal-join.js";
import { runEdgeKapae } from "../src/commands/edge-kapae-cmd.js";
import { direct } from "./direct-store.js";
import { fixtureKey } from "./fixture-keys.js";
import { seatChairs } from "./seat-fixture.js";
import { seatOwnCharter, wear } from "./worn-face-fixture.js";
import { seedFaceAtom } from "./atom-fixture.js";

let root: string;
let priorLarRoot: string | undefined;

const REALM = "a".repeat(64);
const OTHER_REALM = "d".repeat(64);
const NOW = Date.parse("2026-07-14T00:00:00Z");

const verify = (bytes: Uint8Array, sigHex: string, did: string) =>
  ed.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(did)).catch(() => false);

/**
 * §2.1 — seed a REAL daemon doc (`seedDaemonDoc`, the same factory the founding path uses) and point this
 * vessel's bootstrap file at it, in the EXACT shape `runInit`'s `bootstrapPlugin`/`placeTiddlers` write
 * (`daemonDocUrlFromBootstrap` reads a flat `tiddlers[DAEMON_BAG_ID].text`, not a `mutableLarRecord`-nested
 * one — that nesting belongs to the DOC's own tiddlers, not the bootstrap file's). Prior to this, every
 * fixture here stood a vessel identity with NO social bootstrap at all, so `resolveBoundEpoch` /
 * `runCabalJoin`'s own board read found `daemonDocUrlFromBootstrap()` returning null and refused — the
 * CODE was already fail-closed per §2b; these fixtures were simply stale (episkopos-2 §2.1).
 */
async function seedDaemonBootstrap(): Promise<void> {
  await ownedStore(larDataDir(), async (repo) => {
    const handle = seedDaemonDoc(repo);
    await repo.flush();
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    const packedTiddlers = { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: handle.url, kind: "oracle" } };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: packedTiddlers }) }), "utf8");
  });
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-join-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot();
  await seedFaceAtom(0);
  await seedDaemonBootstrap();
  // The realm stands under this vessel's own charter, and the worn face's key there vouches.
  await seatOwnCharter([0]);
  face = await wear(0);
});
let face: string;
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((r) => setTimeout(r, 200));
  rmSync(root, { recursive: true, force: true });
});

/** A joiner nym this vessel does not hold — the crossing must never assume the applicant is local. */
async function foreignNym(seedByte: number): Promise<string> {
  const seed = new Uint8Array(32).fill(seedByte);
  return hex(await ed.getPublicKeyAsync(seed));
}

describe("cabal join — the crossing, and what it refuses", () => {
  it("a verified invite without its voucher head waits; the real vouch registers the hand", async () => {
    const joiner = await foreignNym(30), seed = new Uint8Array(32).fill(31);
    const voucherDid = hex(await ed.getPublicKeyAsync(seed));
    const invite = await signCabalInvite({ realmDocIdHex: REALM, joinerIdentityHex: joiner, voucherDid, boundEpoch: "0" },
      async (bytes) => hex(await ed.signAsync(bytes, seed)));
    await ownedStore(larDataDir(), async (repo) => {
      const board = await materializeSharedLarDoc(repo, realmVouchBoardDocUrl(REALM), "board:vouch-registry");
      board.change((d) => writeVouch(d, invite));
      await repo.flush();
    });
    const waiting = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });
    expect(waiting).toMatchObject({ admitted: false, refusal: "frontier-unknown" });
    expect(waiting.missing).toContainEqual(expect.objectContaining({ hand: `holder:${voucherDid}` }));
    const vouched = await direct(runCabalVouch)({ joiner, realm: REALM });
    expect(vouched.bundle.frontiers.map((f) => f.hand)).toContain(`holder:${vouched.voucherDid}`);
    const entered = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });
    expect(entered.admitted).toBe(true);
  });
  it("admits a joiner the realm vouched for, and names the voucher the co-pay charges", async () => {
    const joiner = await foreignNym(7);
    const vouched = await direct(runCabalVouch)({ joiner, realm: REALM }, NOW);

    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });

    expect(v.admitted).toBe(true);
    // The co-pay charges the hand that staked; an admission that forgot who vouched charges nobody.
    expect(v.voucherDid).toBe(face);
    expect(v.voucherDid).not.toBe((await loadPersonaGroupRootVerifyingKey(0))?.toLowerCase());
    const bundled = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, bundle: vouched.bundle });
    expect(bundled).toMatchObject({ admitted: true, frontier: { asOf: { quorum: { seq: 0 } } } });
    await expect(direct(runCabalJoin)({ realm: REALM, applicant: joiner,
      bundle: { ...vouched.bundle, realm: "ee".repeat(32) } })).rejects.toThrow(/bad-bundle/);
  });

  it("a separate vessel with the charter but no realm boards admits on the carried invite and frontier", async () => {
    const joiner = await foreignNym(72);
    const vouched = await direct(runCabalVouch)({ joiner, realm: REALM });
    const charter = readNexusDoc(larSealHome());
    expect(charter).not.toBeNull();
    const firstRoot = root;
    const secondRoot = mkdtempSync(join(tmpdir(), "lares-join-independent-"));
    try {
      process.env["LAR_ROOT"] = secondRoot;
      await generateOrLoadVesselIdentity();
      await generateOrLoadPersonaGroupRoot(0);
      await seedFaceAtom(0);
      await wearPersona(0);
      writeNexusDoc(larSealHome(), charter!);
      await seedDaemonBootstrap();
      const withoutHeads = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, invite: vouched.bundle.invite });
      expect(withoutHeads).toMatchObject({ admitted: false, refusal: "frontier-unknown" });
      const joined = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, bundle: vouched.bundle });
      expect(joined).toMatchObject({ admitted: true, frontier: { asOf: { quorum: { seq: 0 } } } });
      await expect(direct(runCabalJoin)({ realm: REALM, applicant: joiner,
        bundle: { ...vouched.bundle, realm: OTHER_REALM } })).rejects.toThrow(/bad-bundle/);
    } finally {
      process.env["LAR_ROOT"] = firstRoot;
      rmSync(secondRoot, { recursive: true, force: true });
    }
  });

  it("a bundle's head never vouches for its own raises: stripped of the acts it counts, the head waits; with them the joiner admits", async () => {
    const joiner = await foreignNym(73), other = await foreignNym(74);
    await direct(runEdgeKapae)({ member: other, realm: REALM, raised: true, hand: "quorum" });
    const vouched = await direct(runCabalVouch)({ joiner, realm: REALM });
    expect(vouched.bundle.acts.length).toBeGreaterThan(0);
    const charter = readNexusDoc(larSealHome());
    const firstRoot = root;
    const secondRoot = mkdtempSync(join(tmpdir(), "lares-join-stripped-"));
    try {
      process.env["LAR_ROOT"] = secondRoot;
      await generateOrLoadVesselIdentity();
      await generateOrLoadPersonaGroupRoot(0);
      await seedFaceAtom(0);
      await wearPersona(0);
      writeNexusDoc(larSealHome(), charter!);
      await seedDaemonBootstrap();
      const stripped = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, bundle: { ...vouched.bundle, acts: [] } });
      expect(stripped).toMatchObject({ admitted: false, refusal: "frontier-unknown" });
      const whole = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, bundle: vouched.bundle });
      expect(whole).toMatchObject({ admitted: true, frontier: { asOf: { quorum: { seq: 1 } } } });
    } finally {
      process.env["LAR_ROOT"] = firstRoot;
      rmSync(secondRoot, { recursive: true, force: true });
    }
  });

  it("refuses a joiner nobody vouched for — invite-only is the fail-closed default", async () => {
    const stranger = await foreignNym(8);
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: stranger });

    expect(DEFAULT_JOIN_POLICY.kind).toBe("invite-only");
    expect(v.admitted).toBe(false);
    expect(v.refusal).toBe("no-invite");
  });

  it("★ a refusal ANERGIZES — the applicant stays at the floor and is never banned ★", async () => {
    const stranger = await foreignNym(9);
    await direct(runCabalJoin)({ realm: REALM, applicant: stranger });

    // Kapae takes a quorum. A ban on failed presentation would let any hand block a face by
    // presenting a bad invite in its name.
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: stranger });
    expect(v.refusal).toBe("no-invite");
    expect(v.banned).toBeUndefined();
  });

  it("refuses an invite that names a different realm", async () => {
    const joiner = await foreignNym(10);
    await direct(runCabalVouch)({ joiner, realm: OTHER_REALM }, NOW);

    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });
    expect(v.admitted).toBe(false);
    expect(v.refusal).toBe("no-invite");   // none for THIS realm — the board is read per-realm
  });

  it("★ an invite is never BEARER — it names its joiner ★", async () => {
    const named = await foreignNym(11);
    const thief = await foreignNym(12);
    await direct(runCabalVouch)({ joiner: named, realm: REALM }, NOW);

    // The thief presents against a board that carries a valid invite — for somebody else.
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: thief });
    expect(v.admitted).toBe(false);
    expect(v.refusal).toBe("no-invite");
  });

  it("refuses an invite whose vouch has lapsed — the realm rolled its fence past it", async () => {
    const joiner = await foreignNym(13);
    // Minted bound at the realm's genesis epoch, which is where a fresh realm stands.
    await direct(runCabalVouch)({ joiner, realm: REALM, boundEpoch: 0 }, NOW);

    // THE ROLL IS THE LAPSE, and it takes no clock. A reading that lapsed by timestamp could be
    // un-lapsed by the applicant's own machine, which is the one hand that must not hold the dial.
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, epoch: 1 });
    expect(v.admitted).toBe(false);
    expect(v.refusal).toBe("expired");
  });

  it("refuses an invite signed by nobody the realm licenses", async () => {
    const joiner = await foreignNym(14);
    const impostorSeed = new Uint8Array(32).fill(99);
    const forged = await signCabalInvite(
      { realmDocIdHex: REALM, joinerIdentityHex: joiner, voucherDid: await foreignNym(15), boundEpoch: "0" },
      async (b: Uint8Array) => hex(await ed.signAsync(b, impostorSeed)),
    );
    expect(await verify(new Uint8Array(), forged.sig, forged.voucherDid)).toBe(false);

    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, invite: forged });
    expect(v.admitted).toBe(false);
    expect(v.refusal).toBe("bad-signature");
  });

  it("★ M16 — an unreadable daemon doc refuses CROSSING as an INCOMPLETE VIEW, never as a guessed genesis fence ★", async () => {
    const joiner = await foreignNym(20);
    // CONTROL: with the bootstrap seeded (beforeEach), a vouch bound at genesis (0) admits against epoch 0.
    await direct(runCabalVouch)({ joiner, realm: REALM, boundEpoch: 0 }, NOW);
    const control = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });
    expect(control.admitted).toBe(true);

    // MUTATION: tear out the bootstrap pointer — this vessel can no longer read ANY daemon doc. The OLD
    // (fail-open) shape fell to `boardEpoch = 0` here and priced the SAME crossing as "standing at
    // genesis"; the fix refuses outright, since a 0 it cannot verify is indistinguishable from a roll it
    // never saw.
    if (existsSync(larBootstrapPath())) unlinkSync(larBootstrapPath());
    const joiner2 = await foreignNym(21);
    await expect(
      direct(runCabalJoin)({ realm: REALM, applicant: joiner2 }),
    ).rejects.toMatchObject({ message: expect.stringContaining("incomplete-view") });

    // An explicit --epoch still overrides — the caller stated its OWN fence by hand, which this refusal
    // must never block.
    const explicit = await direct(runCabalJoin)({ realm: REALM, applicant: joiner2, epoch: 0 });
    expect(explicit.refusal).toBe("no-invite");   // reaches the REAL gate (no vouch for joiner2), not the view refusal
  });

  it("refuses before reading a board when the realm is not 64 hex", async () => {
    await expect(direct(runCabalJoin)({ realm: "not-a-realm", applicant: await foreignNym(16) }))
      .rejects.toBeInstanceOf(CabalJoinError);
  });

  it("★ the crossing folds the DAG ITSELF, so the per-voucher cap cannot be skipped ★", async () => {
    // `capped` exists only on the lineage shore — `admitToRealm` returns no such field.
    const joiner = await foreignNym(17);
    await direct(runCabalVouch)({ joiner, realm: REALM }, NOW);

    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, now: NOW, maxVouchesPerVoucher: 1 });

    // What the fold turned away rides back rather than vanishing, so a caller reads the budget spent
    // instead of trusting a graph that came back quietly shorter than the invites handed in.
    expect(v.capped).toBeDefined();
    expect(Array.isArray(v.capped)).toBe(true);
  });

  it("a climbed vessel's join reads the realm board its vouch wrote", async () => {
    // Vouch and join resolve the board from the same realm id even while a charter is seated.
    const steward = (await seatChairs([0])).keys[0]!;
    writeNexusDoc(larSealHome(), heldCharter({ keys: [steward], threshold: 1 }).doc({ labels: ["steward"] }));
    const joiner = await foreignNym(18);
    await direct(runCabalVouch)({ joiner, realm: REALM }, NOW);
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, now: NOW });

    expect(v.refusal).toBeUndefined();
    expect(v.admitted).toBe(true);
  });

  it("a climbed vessel whose charter seats it does not hold waits for the quorum frontier", async () => {
    const steward = fixtureKey(0xb2);
    writeNexusDoc(larSealHome(), heldCharter({ keys: [steward], threshold: 1 }).doc({ labels: ["steward"] }));
    const joiner = await foreignNym(19);
    await direct(runCabalVouch)({ joiner, realm: REALM }, NOW);

    const waiting = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, now: NOW });
    expect(waiting.admitted).toBe(false);
    expect(waiting.refusal).toBe("frontier-unknown");
    expect(waiting.missing).toContainEqual(expect.objectContaining({ hand: "quorum" }));
  });
});
