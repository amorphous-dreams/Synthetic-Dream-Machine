/**
 * cabal-vouch — one hand stakes its own standing, end-to-end through the node.
 *
 * Proven against a real vessel identity and real persona roots on a temp LAR_ROOT: a vouch lands on the
 * board and reads back through the VERIFYING read (the only read that stands), a voucher's out-degree grows
 * with each distinct joiner and NOT with re-minting, and every fail-closed shore refuses before writing.
 *
 * What this deliberately does NOT assert: that the vouch admitted anyone. A vouch grants nothing on its
 * own — it rides as signal-2 on the lineage, and the crossing runs elsewhere (`admitOnLineage`).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  hex, hexToBytes, vouchBoardDocUrl, verifiedVouchesFromBoard, materializeSharedLarDoc, vouchDagFromInvites,
  decideCabalJoin, DEFAULT_JOIN_POLICY,
} from "@lararium/mesh";
import {
  generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadVesselVerifyingKey,
  loadPersonaGroupRootVerifyingKey,
} from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { runCabalVouch, CabalVouchError } from "../src/commands/cabal-vouch.js";
import { direct } from "./direct-store.js";

let root: string;
let priorLarRoot: string | undefined;

const REALM  = "a".repeat(64);
const JOINER = "b".repeat(64);
const OTHER  = "c".repeat(64);

const verify = (bytes: Uint8Array, sigHex: string, did: string) =>
  ed.verifyAsync(hexToBytes(sigHex), bytes, hexToBytes(did)).catch(() => false);

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "lares-vouch-"));
  priorLarRoot = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = root;
  await generateOrLoadVesselIdentity();   // the REALM's key — scopes the board
  await generateOrLoadPersonaGroupRoot(); // the HUMAN's face — the hand that stakes
});
afterEach(async () => {
  if (priorLarRoot === undefined) delete process.env["LAR_ROOT"];
  else process.env["LAR_ROOT"] = priorLarRoot;
  await new Promise((r) => setTimeout(r, 200));       // past the storage debounce, as the sibling suites do
  rmSync(root, { recursive: true, force: true });
});

/** Read the board back the way any consumer must — through the verifying read. */
async function boardVouches(realm = REALM) {
  const repo   = new Repo({ storage: new NodeFSStorageAdapter(larDataDir()) });
  const handle = await materializeSharedLarDoc(repo, vouchBoardDocUrl(await loadVesselVerifyingKey()), "board:vouch-registry");
  const out    = await verifiedVouchesFromBoard(handle.doc(), realm, verify);
  await repo.flush();
  return out;
}

describe("runCabalVouch — the vouch lands, verified, and dilutes the hand that made it", () => {
  it("mints a vouch that reads back through the VERIFYING read, signed by the held face", async () => {
    const r = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });

    expect(r.voucherDid).toBe(await loadPersonaGroupRootVerifyingKey(0));
    expect(r.outDegreeFloor).toBe(1);
    expect(r.reMinted).toBe(false);

    const onBoard = await boardVouches();
    expect(onBoard).toHaveLength(1);
    expect(onBoard[0]!.joinerIdentityHex).toBe(JOINER);
    expect(onBoard[0]!.voucherDid).toBe(r.voucherDid);
  });

  it("out-degree GROWS with a distinct joiner and does NOT with a re-mint — re-minting buys no branching", async () => {
    const first = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    expect(first.outDegreeFloor).toBe(1);

    const second = await direct(runCabalVouch)({ joiner: OTHER, realm: REALM, boundEpoch: 0 });
    expect(second.outDegreeFloor).toBe(2);            // a real second edge — the voucher's mass now splits two ways

    const again = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    expect(again.reMinted).toBe(true);
    expect(again.outDegreeFloor).toBe(2);             // STILL two — a re-mint is one edge, never a free dilution

    const dag = vouchDagFromInvites(await boardVouches());
    expect(dag.edges).toHaveLength(2);
  });

  it("REFUSES to vouch for itself — self-boosting is unrepresentable on a lineage", async () => {
    const self = (await loadPersonaGroupRootVerifyingKey(0))!;
    await expect(direct(runCabalVouch)({ joiner: self, realm: REALM, boundEpoch: 0 }))
      .rejects.toThrow(CabalVouchError);
    expect(await boardVouches()).toHaveLength(0);   // and nothing landed
  });

  it("CARRIES NO EXPIRY AT ALL — the wall-clock mint gate is RETIRED (operator ruling 2026-10-10) and " +
     "the field itself is gone, not merely unread: a vouch binds to the realm's lease epoch, never a clock",
  async () => {
    const r = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    expect(r).not.toHaveProperty("expiresAt");
    expect((r as unknown as { expiresAt?: unknown }).expiresAt).toBeUndefined();
    const onBoard = await boardVouches();
    expect(onBoard).toHaveLength(1);
    expect(onBoard[0]!).not.toHaveProperty("expiresAt");
  });

  it("SET-BACK and SET-FORWARD clocks change nothing — only the bound epoch decides", async () => {
    const past   = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 3 });
    const future = await direct(runCabalVouch)({ joiner: OTHER,  realm: REALM, boundEpoch: 3 });
    expect(past.boundEpoch).toBe("3");
    expect(future.boundEpoch).toBe("3");
    expect(await boardVouches()).toHaveLength(2);
  });

  it("binds to an EXPLICIT boundEpoch exactly, as a string, for the fence that actually gates", async () => {
    const r = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 7 });
    expect(r.boundEpoch).toBe("7");
  });

  it("a vouch bound at N stands while the realm's epoch holds at N and lapses once it rolls past — the fence, " +
     "not the clock, decides; feeds straight into decideCabalJoin", async () => {
    await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 5 });
    const invite = (await boardVouches())[0]!;

    const stillLive = await decideCabalJoin({
      policy: DEFAULT_JOIN_POLICY, realmDocIdHex: REALM, joinerIdentityHex: JOINER,
      invite, effectiveEpoch: 5, verify,
    });
    expect(stillLive.admitted).toBe(true);

    const rolledPast = await decideCabalJoin({
      policy: DEFAULT_JOIN_POLICY, realmDocIdHex: REALM, joinerIdentityHex: JOINER,
      invite, effectiveEpoch: 6, verify,
    });
    expect(rolledPast.admitted).toBe(false);
    expect(rolledPast.refusal).toBe("expired");

    // A set-back/set-forward wall clock moves neither verdict — decideCabalJoin takes no `now` at all.
    const underSetBackClock = await decideCabalJoin({
      policy: DEFAULT_JOIN_POLICY, realmDocIdHex: REALM, joinerIdentityHex: JOINER,
      invite, effectiveEpoch: 6, verify,
    });
    expect(underSetBackClock.admitted).toBe(false);
  });

  it("REFUSES to mint when the realm's lease epoch cannot be resolved and none was given — fail-closed, " +
     "never a guessed genesis (M10 control)", async () => {
    // No bootstrap file exists on this scratch root (vessel never stood a full boot), so the daemon doc
    // is unreadable. Before the fix this silently bound at `0`; now it refuses by name.
    await expect(direct(runCabalVouch)({ joiner: JOINER, realm: REALM })).rejects.toThrow(CabalVouchError);
    await expect(direct(runCabalVouch)({ joiner: JOINER, realm: REALM })).rejects.toThrow(/lease epoch/);
    expect(await boardVouches()).toHaveLength(0);
  });

  it("REFUSES a malformed joiner or realm, and an unheld persona root — before anything is written", async () => {
    await expect(direct(runCabalVouch)({ joiner: "nope", realm: REALM })).rejects.toThrow(CabalVouchError);
    await expect(direct(runCabalVouch)({ joiner: JOINER, realm: "nope" })).rejects.toThrow(CabalVouchError);
    await expect(direct(runCabalVouch)({ joiner: JOINER, realm: REALM, handleIndex: 99 })).rejects.toThrow(CabalVouchError);
    expect(await boardVouches()).toHaveLength(0);
  });

  it("scopes to the realm it names — a vouch elsewhere is not this realm's lineage", async () => {
    await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    await direct(runCabalVouch)({ joiner: OTHER,  realm: "d".repeat(64), boundEpoch: 0 });

    expect(await boardVouches(REALM)).toHaveLength(1);
    expect(await boardVouches("d".repeat(64))).toHaveLength(1);
  });

  it("the CabalVouchOptions/Result surface carries no expiry field to default in the first place", async () => {
    // Inverted control: the old proof was "the default expiry lands between now and +31d". Now there is no
    // default to default — the type carries no `expiresAt` member at all, src included, not merely unread.
    const src = runCabalVouch.toString();
    expect(src).not.toMatch(/expiresAt/);
    const r = await direct(runCabalVouch)({ joiner: JOINER, realm: REALM, boundEpoch: 0 });
    expect(Object.keys(r).sort()).toEqual(
      ["boardUrl", "boundEpoch", "joiner", "outDegreeFloor", "reMinted", "realm", "voucherDid"],
    );
  });
});
