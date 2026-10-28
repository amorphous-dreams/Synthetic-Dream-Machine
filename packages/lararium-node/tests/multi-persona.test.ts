/**
 * multi-persona.test — Plurality Pono at the identity layer (#63).
 *
 * A human contains multitudes; a vessel may HOLD a SET of persona-roots (one per handle-index); each command
 * names the face it acts as, and the unlock names the one face the composition mounts. This proves the generalization stands AND that a one-persona vessel behaves byte-identically
 * to today (back-compat): the founding persona (index 0) spells with NO `-h` suffix and needs no selector file.
 *
 * Custody-by-TYPE survives: each persona-root is the vessel's OWN sovereign secret (a distinct ed25519 key),
 * so N roots widen the self-surface, never a held-principal honeypot — and mounting a face whose root the
 * vessel does not hold stands no composition (the custody wall in mask form). Recovery splits PER persona-root.
 */
import { faceRowNames, handleRowPath } from "./face-paths.js";
import { afterEach, beforeEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed25519 from "@noble/ed25519";
import { assembleQuorum, reconstructFromQuorum, decodeShareBytes, type RecoveryShare } from "@lararium/mesh";
import {
  generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed,
  personaRootExists, listPersonaRoots,
  setMountedFace, sovereignStands,
} from "../src/node-vessel-identity.js";
import { FaceNotNamed, resolveFace } from "../src/face-selector.js";
import { persistIdentityAnchors, loadIdentityAnchors, listAnchoredPersonas, type IdentityAnchors } from "../src/identity-anchors.js";
import { readWornPersonaMount } from "../src/worn-mount.js";
import type { DeviceDelegationTiddler, LarDid } from "@lararium/mesh";
import { provisionRecoveryAtFounding } from "../src/recovery-keel.js";
import { loadRecoveryDeviceShare } from "../src/recovery-share-store.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { seatScratchCustody } from "./custody-seat-fixture.js";

const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string | undefined): void => {
  saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
};

function seededRng(seed: number) {
  let s = seed >>> 0;
  return {
    getRandomValues<T extends Uint8Array<ArrayBuffer>>(arr: T): T {
      for (let i = 0; i < arr.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; arr[i] = (s >>> 24) & 0xff; }
      return arr;
    },
    randomUUID(): string { return "00000000-0000-0000-0000-000000000000"; },
  };
}

const pubHexOf = async (seed: Uint8Array): Promise<string> =>
  Buffer.from(await ed25519.getPublicKeyAsync(seed)).toString("hex");

/** A signed device→persona edge, shaped as the founding mints one. Its SIGNATURE is checked downstream by
 *  the Binding Gate, never here — the switch decides WHICH edge is presented, never whether it is checked. */
const edgeFor = (rootDid: string): DeviceDelegationTiddler => ({
  kind: "device-delegation",
  personaRootDid: rootDid as LarDid,
  deviceDid: "0xbb22" as LarDid,
  deviceVerifyingKey: "cc".repeat(32),
  hearthTrueName: "",
  boundEpoch: "1",
  signature: "dd".repeat(64),
});
const anchorsFor = (n: number, withMount: boolean): IdentityAnchors => ({
  personaGroupId: `aa${n}`, meshCabalDocIdHex: `bb${n}`,
  // A full mount names this face's public signer, KEL prefix and device edge.
  ...(withMount ? { signerDid: `0xdid${n}`, personaKelPrefix: `EKEL${n}`, deviceEdge: edgeFor(`0xdid${n}`) } : {}),
});

describe("multi-persona-per-vessel (#63)", () => {
  let root: string;
  let seated: Awaited<ReturnType<typeof seatScratchCustody>>;
  const dataDir = () => root;   // identityDir ignores it — the store resolves under XDG state
  beforeEach(async () => {
    setMountedFace(undefined);
    root = mkdtempSync(join(tmpdir(), "lares-multipersona-"));
    setEnv("LAR_ROOT", undefined);
    setEnv("XDG_STATE_HOME", join(root, "state"));
    setEnv("XDG_DATA_HOME", join(root, "state"));   // identity/seal/library answer HERE
    seated = await seatScratchCustody("multi-persona");
  });
  afterEach(async () => {
    setMountedFace(undefined);
    await seated.drop();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  test("UNIFORM keying — the founding persona spells `-h0`, its mint records the explicit roster, a command resolves the sole unlocked face", async () => {
    const founding = await generateOrLoadPersonaGroupRoot();   // default index 0
    expect(founding.created).toBe(true);

    const idDir = larIdentityDir();
    const rootFiles = faceRowNames().filter((f) => /^\.persona-group-root/.test(f));
    expect(rootFiles.length, "exactly one root file at founding").toBe(1);
    expect(rootFiles[0], "uniform keying — the founding persona carries the -h0 suffix").toMatch(/-h0\.json$/);

    // The roster is the store's OWN explicit written record (no dir-scan), and the mint recorded index 0.
    expect(await listPersonaRoots()).toEqual([0]);

    // No selector row lands; a command naming no face resolves the sole unlocked one.
    expect(existsSync(join(idDir, ".active-persona.json")) || readdirSync(idDir).some((f) => f.startsWith(".active-persona"))).toBe(false);
    expect(await resolveFace()).toBe(0);
  });

  test("a vessel HOLDS two distinct persona-roots (multitude-of-one), each its own sovereign key", async () => {
    const p0 = await generateOrLoadPersonaGroupRoot(0);
    const p1 = await generateOrLoadPersonaGroupRoot(1);
    expect(p0.created && p1.created).toBe(true);
    expect(p0.verifyingKey).not.toBe(p1.verifyingKey);       // two DISTINCT quorum-identities

    // Idempotent per index — a reload returns the SAME key, created:false, and never crosses indices.
    const p1b = await generateOrLoadPersonaGroupRoot(1);
    expect(p1b.created).toBe(false);
    expect(p1b.verifyingKey).toBe(p1.verifyingKey);

    // Each seed signs AS its own persona: its ed25519 public key matches its OWN root, differs from the other.
    const seed0 = await loadPersonaGroupRootSeed(0);
    const seed1 = await loadPersonaGroupRootSeed(1);
    expect(await pubHexOf(seed0)).toBe(p0.verifyingKey);
    expect(await pubHexOf(seed1)).toBe(p1.verifyingKey);
    expect(await pubHexOf(seed0)).not.toBe(await pubHexOf(seed1));

    expect(await listPersonaRoots()).toEqual([0, 1]);
  });

  test("NAME a mask — with two faces open a command names its face, and the mount moves no command", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    await generateOrLoadPersonaGroupRoot(1);

    await expect(resolveFace()).rejects.toBeInstanceOf(FaceNotNamed);   // two open, none named — no inference
    expect(await resolveFace(1)).toBe(1);   // the mask the command names
    expect(await resolveFace(0)).toBe(0);   // and the other — the house beneath unchanged
    setMountedFace(1);                      // the composition's mount is not a command's choice
    await expect(resolveFace()).rejects.toBeInstanceOf(FaceNotNamed);
  });

  test("custody wall in mask form — a mount naming a face whose root the vessel does not hold stands no composition", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    expect(await personaRootExists(7)).toBe(false);
    setMountedFace(7);
    expect(sovereignStands()).toBe(false);
    // The custody guard reads uniformly — index 0 stands only because its root was just minted (held).
    setMountedFace(0);
    expect(sovereignStands()).toBe(true);
  });

  test("handle-index guard rejects out-of-range indices (SLIP-0010 hardened ceiling)", async () => {
    await expect(generateOrLoadPersonaGroupRoot(-1)).rejects.toThrow(/out of range/);
    await expect(generateOrLoadPersonaGroupRoot(0x80000000)).rejects.toThrow(/out of range/);
  });

  test("recovery splits PER persona — persona-1's quorum reconstructs persona-1's root, not persona-0's", async () => {
    await generateOrLoadPersonaGroupRoot(0);
    await generateOrLoadPersonaGroupRoot(1);

    const { recordedCode, escrowCarrier } = await provisionRecoveryAtFounding(dataDir(), seededRng(11), 1, 1);

    // The device-share for persona 1 landed at ITS OWN keyed carrier; persona 0's carrier stays untouched.
    expect((await loadRecoveryDeviceShare(1))?.custodian).toBe("device");
    expect(await loadRecoveryDeviceShare(0)).toBeNull();

    // The two off-device carriers reconstruct persona-1's REAL root — and NOT persona-0's.
    const codeShare:   RecoveryShare = { bytes: decodeShareBytes(recordedCode),  custodian: "recorded-code", recoveryEpoch: 1 };
    const escrowShare: RecoveryShare = { bytes: decodeShareBytes(escrowCarrier), custodian: "escrow-peer",   recoveryEpoch: 1 };
    const recovered = reconstructFromQuorum(assembleQuorum([codeShare, escrowShare], 2));
    expect([...recovered]).toEqual([...await loadPersonaGroupRootSeed(1)]);
    expect([...recovered]).not.toEqual([...await loadPersonaGroupRootSeed(0)]);
  });

  test("veiled-Handle anchors extend to a SET — each persona anchors to its OWN PersonaGroup", async () => {
    const a0 = { personaGroupId: "a0".repeat(32), meshCabalDocIdHex: "b0".repeat(32) };
    const a1 = { personaGroupId: "a1".repeat(32), meshCabalDocIdHex: "b1".repeat(32) };
    await persistIdentityAnchors(a0);          // default index 0 (founding) → anchors-h0.json, uniform keying
    await persistIdentityAnchors(a1, 1);       // persona 1 → anchors-h1.json

    expect(await loadIdentityAnchors()).toEqual(a0);       // the founding-persona read round-trips
    expect(await loadIdentityAnchors(1)).toEqual(a1);
    expect(existsSync(handleRowPath("anchors-h0.json"))).toBe(true);   // uniform founding spelling
    expect(await listAnchoredPersonas()).toEqual([0, 1]);   // the explicit roster record
  });

  /**
   * THE UNLOCK MOUNT-SWITCH. `lares vault unlock --face N` names the face the composition mounts; the daemon doc's
   * singular pins were written by the FOUNDING face and never move again. So a boot mounting a non-founding face must
   * re-pin from that face's own material, never come up on h0's pins whatever face the unlock named. The switched
   * face's material lives in its OWN anchors, persisted at founding: signer DID, persona-KEL prefix, and the
   * SIGNED device edge, all public re-pin material.
   */
  describe("the unlock mount-switch — a boot mounts the face the unlock NAMED", () => {
    test("★ a mounted NON-founding persona resolves ITS OWN mount material from anchors-hN ★", async () => {
      await generateOrLoadPersonaGroupRoot(0);
      await generateOrLoadPersonaGroupRoot(1);
      await persistIdentityAnchors(anchorsFor(1, true), 1);
      setMountedFace(1);

      const mounted = await readWornPersonaMount(dataDir());
      expect(mounted?.handleIndex).toBe(1);
      expect(mounted?.signerDid).toBe("0xdid1");
      expect(mounted?.personaKelPrefix).toBe("EKEL1");
      expect(mounted?.personaGroupId, "the switched face's OWN group, not h0's").toBe("aa1");
      expect(mounted?.meshCabalDocIdHex).toBe("bb1");
      expect(mounted?.deviceEdge.kind).toBe("device-delegation");
    });

    test("CONTROL — the FOUNDING face resolves NO switch: the daemon-doc pins already name h0", async () => {
      await generateOrLoadPersonaGroupRoot(0);
      await persistIdentityAnchors(anchorsFor(0, true), 0);
      setMountedFace(0);
      expect(await readWornPersonaMount(dataDir()), "h0 needs no re-pin — the pins are already its own").toBeNull();
    });

    test("CONTROL — anchors carrying NO mount material read as no switch (pre-slot anchors, or a joinee)", async () => {
      await generateOrLoadPersonaGroupRoot(0);
      await generateOrLoadPersonaGroupRoot(1);
      await persistIdentityAnchors(anchorsFor(1, false), 1);   // doc-ids only — no signer, prefix or edge
      setMountedFace(1);
      expect(await readWornPersonaMount(dataDir()), "a half-anchor never re-pins a mount").toBeNull();
    });

    test("CONTROL — naming no face resolves no switch (the sole face h0 mounts)", async () => {
      await generateOrLoadPersonaGroupRoot(0);
      expect(await readWornPersonaMount(dataDir())).toBeNull();
    });
  });

});
