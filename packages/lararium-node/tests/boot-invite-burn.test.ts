/**
 * boot-invite-burn.test.ts — the node-side invite: minted by the inviter's per-Nexus face, spent once on the
 * newcomer's island, remembered by no one.
 *
 * Proven, over two scratch LAR_ROOTs (the inviter's and the newcomer's):
 *   · the invite is signed by the persona's per-Nexus LEAF — never the vessel key, never the persona root,
 *   · mint → spend ADMITS once and burns the id LOCALLY; a SECOND spend refuses `already-spent`,
 *   · a null invite → `no-invite`, a foreign-Nexus invite → `wrong-nexus`; each burns nothing,
 *   · the MINT writes nothing at the inviter,
 *   · NO WHO-INVITED-WHOM DATUM PERSISTS: after the spend, no file under either root carries the inviter's
 *     leaf key, its admit, its contract seal, or the invite's signature; the burn ledger holds one opaque id.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  signCarriageQuorum, signCarriageContract, carriageEntryActCid, makeMultiSigQuorumVerifier, hex,
  type CarriageEntry, type InviteStandingContext,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { nexusLeafFor } from "../src/nexus-leaf.js";
import {
  runBootInviteMint, runBootInviteSpend, bootInviteBurnPath, isBurned, bootInviteId,
} from "../src/boot-invite-burn.js";

const AID   = "nexus-aid-genesis-0a1b2c";
const EPOCH = "epoch-cid-genesis";
const KAHU  = [new Uint8Array(32).fill(1), new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)];
const WARDENS = [new Uint8Array(32).fill(11), new Uint8Array(32).fill(12)];
const pub = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);

let inviterRoot: string;
let newcomerRoot: string;
let priorLarRoot: string | undefined;
const asRoot = (root: string) => { process.env["LAR_ROOT"] = root; };

beforeEach(() => {
  inviterRoot  = mkdtempSync(join(tmpdir(), "lares-invite-inviter-"));
  newcomerRoot = mkdtempSync(join(tmpdir(), "lares-invite-newcomer-"));
  priorLarRoot = process.env["LAR_ROOT"];
});
afterEach(() => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  rmSync(inviterRoot, { recursive: true, force: true });
  rmSync(newcomerRoot, { recursive: true, force: true });
});

async function standingCtx(): Promise<InviteStandingContext> {
  return {
    roster:          { keys: await Promise.all(KAHU.map(pub)), threshold: 2, sealEpochCid: EPOCH },
    denyBoard:       [],
    antigen:         [],
    antigenRoster:   { keys: await Promise.all(WARDENS.map(pub)), threshold: 2, sealEpochCid: EPOCH },
    antigenVerifier: makeMultiSigQuorumVerifier(),
  };
}

/** Stand a persona at the inviter's root and have the kahu quorum admit its per-Nexus leaf. */
async function standInviter(): Promise<{ leafKey: string; admit: CarriageEntry; rootKey: string; vesselKey: string }> {
  asRoot(inviterRoot);
  await generateOrLoadVesselIdentity();
  const root = await generateOrLoadPersonaGroupRoot(0);
  const leaf = await nexusLeafFor(0, AID);
  const contract = await signCarriageContract(leaf.verifyingKey, EPOCH,
    async (bytes) => hex(await ed.signAsync(bytes, leaf.seed)));
  const admit = await signCarriageQuorum(
    { nym: leaf.verifyingKey, action: "admit", parents: [], sealEpochCid: EPOCH },
    await Promise.all(KAHU.slice(0, 2).map(async (s) => ({ signer: await pub(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)) }))),
    contract,
  );
  return { leafKey: leaf.verifyingKey, admit, rootKey: root.verifyingKey.toLowerCase(), vesselKey: (await loadVesselVerifyingKey()).toLowerCase() };
}

/** Every file under `dir`, read whole. */
function allFiles(dir: string): Array<{ path: string; body: string }> {
  const out: Array<{ path: string; body: string }> = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...allFiles(p));
    else out.push({ path: p, body: readFileSync(p).toString("latin1") });
  }
  return out;
}

describe("the node invite — signed by the inviter's face, burned once, remembered by no one", () => {
  it("the invite is signed by the per-Nexus LEAF — not the vessel key, not the persona root", async () => {
    const who = await standInviter();
    const inv = await runBootInviteMint({ handleIndex: 0, nexusAid: AID, standing: { kind: "admit", admit: who.admit, lineage: [] } });
    expect(inv.inviterKey).toBe(who.leafKey);
    expect(inv.inviterKey).not.toBe(who.vesselKey);
    expect(inv.inviterKey).not.toBe(who.rootKey);
  });

  it("mint → spend ADMITS once and burns the id; a SECOND spend refuses already-spent", async () => {
    const who = await standInviter();
    const inv = await runBootInviteMint({ handleIndex: 0, nexusAid: AID, standing: { kind: "admit", admit: who.admit, lineage: [] } });

    asRoot(newcomerRoot);
    const first = await runBootInviteSpend({ invite: inv, nexusAid: AID, standing: await standingCtx() });
    expect(first).toEqual({ admitted: true, burnId: bootInviteId(inv) });
    expect(isBurned(larDataDir(), bootInviteId(inv))).toBe(true);

    const second = await runBootInviteSpend({ invite: inv, nexusAid: AID, standing: await standingCtx() });
    expect(second).toEqual({ admitted: false, refusal: "already-spent" });
  });

  it("a null invite → no-invite and a foreign-Nexus invite → wrong-nexus; each burns nothing", async () => {
    const who = await standInviter();
    const foreign = await runBootInviteMint({ handleIndex: 0, nexusAid: "nexus-aid-elsewhere", standing: { kind: "admit", admit: who.admit, lineage: [] } });

    asRoot(newcomerRoot);
    expect(await runBootInviteSpend({ invite: null, nexusAid: AID, standing: await standingCtx() }))
      .toEqual({ admitted: false, refusal: "no-invite" });
    expect(await runBootInviteSpend({ invite: foreign, nexusAid: AID, standing: await standingCtx() }))
      .toEqual({ admitted: false, refusal: "wrong-nexus" });
    expect(existsSync(bootInviteBurnPath(larDataDir()))).toBe(false);
  });

  it("NO WHO-INVITED-WHOM DATUM PERSISTS — not at the inviter, not at the newcomer", async () => {
    const who = await standInviter();
    const before = allFiles(inviterRoot).map((f) => `${f.path}\n${f.body}`).sort();
    const inv = await runBootInviteMint({ handleIndex: 0, nexusAid: AID, standing: { kind: "admit", admit: who.admit, lineage: [] } });
    expect(allFiles(inviterRoot).map((f) => `${f.path}\n${f.body}`).sort()).toEqual(before);   // the mint writes nothing

    asRoot(newcomerRoot);
    expect((await runBootInviteSpend({ invite: inv, nexusAid: AID, standing: await standingCtx() })).admitted).toBe(true);

    const traces = [who.leafKey, carriageEntryActCid(who.admit), who.admit.contractSig!.sig, inv.sig, inv.nonce];
    const files = [...allFiles(newcomerRoot), ...allFiles(inviterRoot)];
    // CONTROL: the scan reads the newcomer's root — it finds the burn ledger it must find.
    expect(files.some((f) => f.path === bootInviteBurnPath(larDataDir()) && f.body.includes(bootInviteId(inv)))).toBe(true);
    for (const f of files) {
      for (const t of traces) expect(f.body.toLowerCase().includes(t.toLowerCase()), `${f.path} carries ${t}`).toBe(false);
    }
    expect(readFileSync(bootInviteBurnPath(larDataDir()), "utf8")).toBe(`${bootInviteId(inv)}\n`);
  });
});
