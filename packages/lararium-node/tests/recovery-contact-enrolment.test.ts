/**
 * recovery-contact-enrolment (node) — a face on this vessel enrols its first recovery contacts, on the real doors.
 *
 * A hearth founds (place, seed charter, persona zero) and lights a second face; recovery contacts mint their halves; the
 * face's own key signs the typed first enrolment; the record lands sealed and the event lands on the board.
 *
 *   G1  CONTROL: a fresh key per face enrols; the board's lineage reads the typed event under the same prefix and
 *       key, and the record holds the set.
 *   G2  RED: a key face 0 already holds, offered to face 1, refuses recovery-contact-key-serves-another-face; nothing moves.
 *   G3  a second enrolment refuses face-holds-recovery contacts; an offer for another face refuses possession-unproven; a
 *       malformed line refuses offer-malformed; each before any write.
 *   G4  a run that stopped after the record lands the event when the same offers run again; other offers refuse
 *       record-names-another-set.
 *
 * Scratch roots, synthetic keys. Canon: lar:///ha.ka.ba/lararium/mesh/persona-kel#/the-enrolment
 */
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as ed from "@noble/ed25519";
import {
  RECOVERY_CONTACT_ENROLMENT_KIND, coldKeySeedFromCode, foldPersonaContests, recoveryContactPossessionBytes, hex, sealKeySetHash,
} from "@lararium/mesh";
import * as init from "../src/commands/init.js";
import { seatedCustody, unseatCustody, writeCustodyRow } from "../src/custody-seat.js";
import {
  RecoveryContactEnrolmentRefused, recoveryContactOffer, recoveryContactSetFile, recoveryContactStanding, readRecoveryContactSet, runRecoveryContactEnrolment,
} from "../src/recovery-contact-enrolment.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { ownedStore } from "../src/owned-store.js";
import { readLocalPersonaKelEvents } from "../src/local-persona-kel.js";
import { larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const foundFace = direct(init.runFoundTheFace);
const withRepo = <T>(act: Parameters<typeof ownedStore<T>>[1]): Promise<T> => ownedStore(larDataDir(), act);

const roots: string[] = [];
const priorRoot = process.env["LAR_ROOT"];
async function leave(): Promise<void> {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
}
/** A hearth with two faces lit: h0 and h1. */
async function twoFaces(): Promise<{ prefix0: string; prefix1: string }> {
  await leave();
  const root = mkdtempSync(join(tmpdir(), "lar-recovery-contact-"));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true });
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  await seatSeedCharter({ name: "recovery-contact-keeper" });
  await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 0 });
  await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 1 });
  return {
    prefix0: (await loadIdentityAnchors(0))!.personaKelPrefix!,
    prefix1: (await loadIdentityAnchors(1))!.personaKelPrefix!,
  };
}
afterEach(async () => {
  await leave();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const enrol = (handleIndex: number, offers: readonly string[], threshold: number) =>
  withRepo((repo) => runRecoveryContactEnrolment({ repo, handleIndex, offers, threshold }));
const refusalOf = async (p: Promise<unknown>): Promise<string> => {
  try { await p; return "LANDED"; } catch (err) { return err instanceof RecoveryContactEnrolmentRefused ? err.refusal : `THREW ${String(err)}`; }
};
const lineage = (prefix: string) => withRepo(async (repo) => foldPersonaContests(await readLocalPersonaKelEvents(repo, prefix)).kel);

describe("a face enrols its first recovery contacts on this vessel", () => {
  test("G1 + G2 — a fresh key per face enrols; a key another face holds refuses recovery-contact-key-serves-another-face", async () => {
    const { prefix0, prefix1 } = await twoFaces();
    const a = await recoveryContactOffer(prefix0), b = await recoveryContactOffer(prefix0);
    const done = await enrol(0, [a.offer, b.offer], 2);
    expect(done).toMatchObject({ handleIndex: 0, prefix: prefix0, threshold: 2, recoveryContacts: 2, seq: 1 });
    expect(done.recoveryContactSetHash).toBe(sealKeySetHash([a.recoveryPubKey, b.recoveryPubKey], 2));
    const kel = await lineage(prefix0);
    expect(kel).toHaveLength(2);
    expect(kel[1]!.kind).toBe(RECOVERY_CONTACT_ENROLMENT_KIND);
    expect(kel[1]!.opKeyDid).toBe(kel[0]!.opKeyDid);
    expect((await readRecoveryContactSet(0))?.recoveryContacts.map((g) => g.recoveryPubKey)).toEqual([a.recoveryPubKey, b.recoveryPubKey]);

    // The same person guards face 1 with the key it already holds for face 0: the vessel refuses, naming face 0.
    // Its proof over face 1 comes from the card the recovery contact keeps.
    const proof = hex(await ed.signAsync(recoveryContactPossessionBytes(prefix1, a.recoveryPubKey), coldKeySeedFromCode(a.code)));
    const shared = `lar-recovery-contact-offer:${a.recoveryPubKey}:${proof}`;
    expect(await refusalOf(enrol(1, [shared], 1))).toBe("recovery-contact-key-serves-another-face");
    expect(await lineage(prefix1)).toHaveLength(1);
    expect(await readRecoveryContactSet(1)).toBeNull();
    // CONTROL: a fresh key for face 1 enrols.
    const fresh = await recoveryContactOffer(prefix1);
    expect((await enrol(1, [fresh.offer], 1)).seq).toBe(1);
  });

  test("G3 — a second enrolment, an offer for another face and a malformed line each refuse before any write", async () => {
    const { prefix0, prefix1 } = await twoFaces();
    expect(await refusalOf(enrol(0, [(await recoveryContactOffer(prefix1)).offer], 1))).toBe("possession-unproven");
    expect(await refusalOf(enrol(0, ["lar-recovery-contact-offer:zz"], 1))).toBe("offer-malformed");
    expect(await readRecoveryContactSet(0)).toBeNull();
    expect(await lineage(prefix0)).toHaveLength(1);
    await enrol(0, [(await recoveryContactOffer(prefix0)).offer], 1);
    expect(await refusalOf(enrol(0, [(await recoveryContactOffer(prefix0)).offer], 1))).toBe("face-holds-recovery-contacts");
    expect(await lineage(prefix0)).toHaveLength(2);
  });

  test("G4 — a stopped run completes with the same offers; other offers refuse record-names-another-set", async () => {
    const { prefix0 } = await twoFaces();
    const a = await recoveryContactOffer(prefix0);
    // The record landed and the event did not: write the record a stopped run leaves.
    const record = { prefix: prefix0, recoveryContactSetHash: sealKeySetHash([a.recoveryPubKey], 1), threshold: 1,
      recoveryContacts: [{ slot: "contact-a", label: "Recovery-contact-A (unassigned)", recoveryPubKey: a.recoveryPubKey, confirmPhrase: "" }] };
    await writeCustodyRow("identity", recoveryContactSetFile(0), new TextEncoder().encode(JSON.stringify(record)));
    expect(await refusalOf(enrol(0, [(await recoveryContactOffer(prefix0)).offer], 1))).toBe("record-names-another-set");
    expect(await lineage(prefix0)).toHaveLength(1);
    expect(await withRepo((repo) => recoveryContactStanding(repo, 0))).toMatchObject({ committed: false, headSet: null, recoveryContactSetHash: record.recoveryContactSetHash });
    expect((await enrol(0, [a.offer], 1)).seq).toBe(1);
    expect(await lineage(prefix0)).toHaveLength(2);
    expect(await withRepo((repo) => recoveryContactStanding(repo, 0))).toMatchObject({ committed: true, headSet: record.recoveryContactSetHash });
  });
});
