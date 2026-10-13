/**
 * edge-kapae at the doors — a shadow raised with `lares edge kapae` holds at the crossing that decides standing.
 *
 * Driven through the real commands over a temp LAR_ROOT: `runEdgeKapae` writes the acts, `runCabalVouch`
 * stakes the vouch, and `runCabalJoin` reads BOTH boards. A voucher who sets a vouch aside removes it from
 * the crossing; a racing lower with no causal order beside the raise leaves it aside; only a lower that
 * causally follows the raise returns it. A hand that never held the vouch moves nothing.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/kapae
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, signCabalInvite, signEdgeKapae, writeEdgeKapae, vouchEdgeId, CABAL_INVITE_DOMAIN,
  DAEMON_BAG_ID, seedDaemonDoc, edgeKapaeBoardDocUrl, materializeSharedLarDoc, type CabalInvite,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey,
  loadPersonaGroupRootSeed, loadVesselVerifyingKey,
} from "../src/node-vessel-identity.js";
import { larDataDir, larBootstrapPath } from "../src/vessel-paths.js";
import { ownedStore } from "../src/owned-store.js";
import { runCabalVouch } from "../src/commands/cabal-vouch.js";
import { runCabalJoin } from "../src/commands/cabal-join.js";
import { runEdgeKapae } from "../src/commands/edge-kapae-cmd.js";
import { direct } from "./direct-store.js";

let root: string;
let priorLarRoot: string | undefined;

const REALM = "a".repeat(64);
const EPOCH = "epoch0-aaa";

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-shadow-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity();
  await generateOrLoadPersonaGroupRoot(0);
  await generateOrLoadPersonaGroupRoot(1);
  await ownedStore(larDataDir(), async (repo) => {
    const handle = seedDaemonDoc(repo);
    await repo.flush();
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    const packed = { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: handle.url, kind: "oracle" } };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: packed }) }), "utf8");
  });
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((r) => setTimeout(r, 200));
  rmSync(root, { recursive: true, force: true });
});

const foreignSeed = (byte: number) => new Uint8Array(32).fill(byte);
const foreignNym  = (byte: number) => ed.getPublicKeyAsync(foreignSeed(byte)).then(hex);
const edgeOf = (v: { realm: string; voucherDid: string; joiner: string }) => vouchEdgeId({
  kind: CABAL_INVITE_DOMAIN, realmDocIdHex: v.realm, voucherDid: v.voucherDid, joinerIdentityHex: v.joiner, boundEpoch: "0", sig: "",
} as CabalInvite);

/** Land an act on the shadow board signed by a seed this vessel does NOT hold as the vouch's voucher. */
async function writeForeignAct(edgeId: string, raised: boolean, parents: string[], seed: Uint8Array): Promise<void> {
  const act = await signEdgeKapae({ edgeId, raised, parents, epochCid: EPOCH }, (b) => ed.signAsync(b, seed).then(hex));
  await ownedStore(larDataDir(), async (repo) => {
    const handle = await materializeSharedLarDoc(repo, edgeKapaeBoardDocUrl(await loadVesselVerifyingKey()), "board:edge-kapae");
    handle.change((d) => writeEdgeKapae(d, act));
    await repo.flush();
  });
}

describe("lares edge kapae — the verb reports what a standing reader will read", () => {
  it("★ a lower racing the raise leaves the shadow STANDING, and the verb says so ★", async () => {
    const edge = "dyad-".padEnd(20, "c");
    const up   = await direct(runEdgeKapae)({ edgeId: edge, raised: true,  epochCid: EPOCH });
    // `parents: []` writes the lower from the EMPTY frontier — the act a partitioned hand that never saw the raise writes.
    const race = await direct(runEdgeKapae)({ edgeId: edge, raised: false, epochCid: EPOCH, parents: [] });
    expect(up.shadowStands).toBe(true);
    expect(race.parents).toEqual([]);
    expect(race.shadowStands).toBe(true);
    expect((race as { verdict?: string }).verdict).toBe("unsettled");
  });

  it("CONTROL — a lower that cites the raise lifts, and a later lower citing BOTH contested heads settles", async () => {
    const edge = "dyad-".padEnd(20, "d");
    const up   = await direct(runEdgeKapae)({ edgeId: edge, raised: true,  epochCid: EPOCH });
    const down = await direct(runEdgeKapae)({ edgeId: edge, raised: false, epochCid: EPOCH });
    expect(down.parents).toEqual([up.actCid]);
    expect(down.shadowStands).toBe(false);

    const edge2 = "dyad-".padEnd(20, "e");
    const up2   = await direct(runEdgeKapae)({ edgeId: edge2, raised: true,  epochCid: EPOCH });
    const race2 = await direct(runEdgeKapae)({ edgeId: edge2, raised: false, epochCid: EPOCH, parents: [] });
    const settle = await direct(runEdgeKapae)({ edgeId: edge2, raised: false, epochCid: EPOCH });   // the default cites every head
    expect(settle.parents).toEqual([up2.actCid, race2.actCid].sort());
    expect(settle.shadowStands).toBe(false);
  });
});

describe("lares cabal join — the crossing reads the shadow board", () => {
  it("★ a vouch its voucher set aside no longer carries the crossing, and the result names what stood aside ★", async () => {
    const joiner = await foreignNym(31);
    const vouch  = await direct(runCabalVouch)({ joiner, realm: REALM });
    expect((await direct(runCabalJoin)({ realm: REALM, applicant: joiner })).admitted).toBe(true);   // CONTROL: no shadow → admitted

    await direct(runEdgeKapae)({ edgeId: edgeOf(vouch), raised: true, epochCid: EPOCH });
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });
    expect(v.admitted).toBe(false);
    expect(v.refusal).toBe("set-aside");
    expect((v as { setAside?: readonly { edgeId: string; verdict: string }[] }).setAside)
      .toEqual([expect.objectContaining({ edgeId: edgeOf(vouch), verdict: "held", joinerIdentityHex: joiner })]);
  });

  it("★ a lower RACING the raise leaves the vouch aside; a lower that FOLLOWS it returns the crossing ★", async () => {
    const joiner = await foreignNym(32);
    const vouch  = await direct(runCabalVouch)({ joiner, realm: REALM });
    const edge   = edgeOf(vouch);
    await direct(runEdgeKapae)({ edgeId: edge, raised: true,  epochCid: EPOCH });
    await direct(runEdgeKapae)({ edgeId: edge, raised: false, epochCid: EPOCH, parents: [] });

    const contested = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });
    expect(contested.admitted).toBe(false);
    expect((contested as { setAside?: readonly { verdict: string }[] }).setAside?.[0]?.verdict).toBe("unsettled");

    // The deliberate hand: a lower citing the whole frontier. Order by causality still lifts.
    await direct(runEdgeKapae)({ edgeId: edge, raised: false, epochCid: EPOCH });
    const lifted = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });
    expect(lifted.admitted).toBe(true);
    expect((lifted as { setAside?: readonly unknown[] }).setAside).toEqual([]);
  });

  it("★ a forged lower never returns the crossing, and a raise by a hand that never held the vouch sets nothing aside ★", async () => {
    const joiner = await foreignNym(33);
    const vouch  = await direct(runCabalVouch)({ joiner, realm: REALM });
    const edge   = edgeOf(vouch);

    // A stranger, and this vessel's OTHER root, each raise over a vouch root 0 made: neither holds it.
    await writeForeignAct(edge, true, [], foreignSeed(41));
    await direct(runEdgeKapae)({ edgeId: edge, raised: true, epochCid: EPOCH, handleIndex: 1 });
    expect((await direct(runCabalJoin)({ realm: REALM, applicant: joiner })).admitted).toBe(true);

    const up = await direct(runEdgeKapae)({ edgeId: edge, raised: true, epochCid: EPOCH, handleIndex: 0 });
    await writeForeignAct(edge, false, [up.actCid], foreignSeed(41));                    // a forged causal lower
    await direct(runEdgeKapae)({ edgeId: edge, raised: false, epochCid: EPOCH, handleIndex: 1 });   // another root's lower
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner });
    expect(v.admitted).toBe(false);
    expect((v as { setAside?: readonly { verdict: string }[] }).setAside?.[0]?.verdict).toBe("held");
  });

  it("★ a vouch carried out of band meets the same shadow ★", async () => {
    const joiner = await foreignNym(34);
    const voucherDid = (await loadPersonaGroupRootVerifyingKey(0))!;
    const seed = await loadPersonaGroupRootSeed(0);
    const invite = await signCabalInvite(
      { realmDocIdHex: REALM, joinerIdentityHex: joiner, voucherDid, boundEpoch: "0" }, (b) => ed.signAsync(b, seed).then(hex));
    expect((await direct(runCabalJoin)({ realm: REALM, applicant: joiner, invite })).admitted).toBe(true);   // CONTROL

    await direct(runEdgeKapae)({ edgeId: vouchEdgeId(invite), raised: true, epochCid: EPOCH });
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, invite });
    expect(v.admitted).toBe(false);
    expect(v.refusal).toBe("set-aside");
  });

  it("★ a carried invite that never verified names no shadow and lends no mass ★", async () => {
    const joiner = await foreignNym(35);
    const attacker = foreignSeed(42);
    const attackerDid = await ed.getPublicKeyAsync(attacker).then(hex);
    // A carried invite naming the attacker as voucher, under a signature that verifies for nobody.
    const forged: CabalInvite = {
      kind: CABAL_INVITE_DOMAIN, realmDocIdHex: REALM, joinerIdentityHex: joiner, voucherDid: attackerDid, boundEpoch: "0", sig: "00".repeat(64),
    };
    await writeForeignAct(vouchEdgeId(forged), true, [], attacker);   // the attacker "sets aside" a vouch nobody made
    const v = await direct(runCabalJoin)({ realm: REALM, applicant: joiner, invite: forged });
    expect(v.admitted).toBe(false);
    expect(v.refusal).toBe("bad-signature");                          // the structural gate's own word, never "set-aside"
    expect(v.setAside).toEqual([]);

    // Under an OPEN policy no gate reads the presented invite, so the fold must never receive an unverified one.
    // Root 0 holds one real vouch; a forged second edge in its name would trip a cap of one.
    const real = await direct(runCabalVouch)({ joiner: await foreignNym(36), realm: REALM });
    const padded: CabalInvite = { ...forged, voucherDid: real.voucherDid, joinerIdentityHex: joiner };
    const open = await direct(runCabalJoin)({
      realm: REALM, applicant: joiner, invite: padded, policy: { kind: "open" }, maxVouchesPerVoucher: 1,
    });
    expect(open.capped).toEqual([]);

    // CONTROL: a carried invite that verifies still joins the fold, and the cap then turns one edge away.
    const seed = await loadPersonaGroupRootSeed(0);
    const honest = await signCabalInvite(
      { realmDocIdHex: REALM, joinerIdentityHex: joiner, voucherDid: real.voucherDid, boundEpoch: "0" }, (b) => ed.signAsync(b, seed).then(hex));
    const counted = await direct(runCabalJoin)({
      realm: REALM, applicant: joiner, invite: honest, policy: { kind: "open" }, maxVouchesPerVoucher: 1,
    });
    expect(counted.capped).toHaveLength(1);
  });

  it("★ mutual removal — two faces set each other's vouch aside, both crossings refuse, and each reads both shadows ★", async () => {
    const face0 = (await loadPersonaGroupRootVerifyingKey(0))!.toLowerCase();
    const face1 = (await loadPersonaGroupRootVerifyingKey(1))!.toLowerCase();
    const v01 = await direct(runCabalVouch)({ joiner: face1, realm: REALM, handleIndex: 0 });
    const v10 = await direct(runCabalVouch)({ joiner: face0, realm: REALM, handleIndex: 1 });
    expect((await direct(runCabalJoin)({ realm: REALM, applicant: face0 })).admitted).toBe(true);   // CONTROL
    expect((await direct(runCabalJoin)({ realm: REALM, applicant: face1 })).admitted).toBe(true);

    await direct(runEdgeKapae)({ edgeId: edgeOf(v01), raised: true, epochCid: EPOCH, handleIndex: 0 });   // 0 removes 1
    await direct(runEdgeKapae)({ edgeId: edgeOf(v10), raised: true, epochCid: EPOCH, handleIndex: 1 });   // 1 removes 0
    // Each tries to lift the shadow over ITSELF — the edge belongs to the other hand.
    await direct(runEdgeKapae)({ edgeId: edgeOf(v01), raised: false, epochCid: EPOCH, handleIndex: 1 });
    await direct(runEdgeKapae)({ edgeId: edgeOf(v10), raised: false, epochCid: EPOCH, handleIndex: 0 });

    const a = await direct(runCabalJoin)({ realm: REALM, applicant: face0 });
    const b = await direct(runCabalJoin)({ realm: REALM, applicant: face1 });
    for (const v of [a, b]) {
      expect(v.admitted).toBe(false);
      expect(v.refusal).toBe("set-aside");
      // Both shadows surface at either crossing: no authority stands, and the reader sees the whole fork.
      expect(v.setAside.map((s) => s.edgeId).sort()).toEqual([edgeOf(v01), edgeOf(v10)].sort());
      // Each self-lift came from a hand that holds no authority over that edge, so each shadow reads plainly held.
      expect(v.setAside.map((s) => s.verdict)).toEqual(["held", "held"]);
    }
  });
});
