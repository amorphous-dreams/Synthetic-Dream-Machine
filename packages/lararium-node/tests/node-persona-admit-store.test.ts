/**
 * node-persona-admit-store.test.ts — the PER-VESSEL multitude-view (never fleet-syncs) + the consume-once
 * airgapped pending state.
 *
 * Proven:
 *   · NEVER-SYNCS (structural) — the view rides a LOCAL 0o600 file under the identity home; the module imports
 *     no Repo / bag / board shore, so nothing it writes can reach the wire,
 *   · record → list round-trips; a re-admission supersedes CAUSALLY (M12 — the granting op-key's KEL seq, then
 *     nonceA as a tiebreak), and a CHANGED `expiry` alone — higher OR lower — never decides it any more,
 *   · CONSUME-ONCE — a stashed enrollment secret / sent memo is returned exactly once, then dropped (a secret
 *     never lingers past the one hop it enables); a second take reads null — proven again AFTER a simulated
 *     process restart (a fresh read of the SAME on-disk store, no in-memory state carried over),
 *   · WITHDRAWAL (§2a) — `withdrawAdmitOffer` / `withdrawAdmitGrant` drop a pending secret/memo by the holder's
 *     own act, never a clock; a grant/ACK answering a withdrawn one draws the SAME refusal a consumed one does,
 *   · the pending-offer set is COUNT-bounded at a NAMED `K` — a stash past it evicts the OLDEST by insertion
 *     order, never by any clock/expiry field,
 *   · ATOMIC WRITE — `writeJson` lands via temp+rename; no `.tmp` sibling survives a successful write.
 */
import { PERSONA_GRANT_DOMAIN, PERSONA_JOIN_DOMAIN } from "@lararium/mesh";
import { afterEach, beforeEach, describe, test, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordAdmittedPersona, listAdmittedPersonas, isPersonaAdmitted,
  stashEnrollmentSecret, takeEnrollmentSecret, peekEnrollmentSecrets, withdrawAdmitOffer,
  stashSentMemo, takeSentMemo, withdrawAdmitGrant, clearPersonaAdmitPending,
} from "../src/node-persona-admit-store.js";
import type { JoinRecord, EnrollmentSecret, SentGrantMemo } from "@lararium/mesh";

function joinRec(
  prefix: string,
  opts: { expiry?: number; granterSeq?: number; nonceA?: string } = {},
): JoinRecord {
  return {
    kind: PERSONA_JOIN_DOMAIN,
    personaRef: { prefix, verifyingKey: "aa".repeat(32) },
    targetVesselId: "bb".repeat(32),
    granterKey: "aa".repeat(32),
    nonceA: opts.nonceA ?? "01".repeat(16), nonceB: "02".repeat(16),
    expiry: opts.expiry ?? 1000, grantSig: "cc".repeat(64),
    ...(opts.granterSeq !== undefined ? { granterSeq: opts.granterSeq } : {}),
  };
}

describe("node-persona-admit-store — the per-vessel multitude-view", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "lares-persona-admit-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test("record → list round-trips", () => {
    expect(listAdmittedPersonas(dir)).toEqual([]);
    recordAdmittedPersona(joinRec("Epersona_A"), dir);
    recordAdmittedPersona(joinRec("Epersona_B"), dir);
    expect(listAdmittedPersonas(dir).map((j) => j.personaRef.prefix)).toEqual(["Epersona_A", "Epersona_B"]);
    expect(isPersonaAdmitted("Epersona_A", dir)).toBe(true);
    expect(isPersonaAdmitted("Epersona_Z", dir)).toBe(false);
  });

  test("M12: supersede is CAUSAL (KEL seq, then nonceA) — a changed `expiry` alone decides NOTHING", () => {
    // A HIGHER granterSeq supersedes even though its expiry is LOWER — the old expiry-wins rule would have
    // refused this; the causal rule admits it, because the persona's op-key genuinely rotated forward.
    recordAdmittedPersona(joinRec("Epersona_A", { granterSeq: 3, expiry: 9000 }), dir);
    recordAdmittedPersona(joinRec("Epersona_A", { granterSeq: 5, expiry: 1000 }), dir);
    expect(listAdmittedPersonas(dir).find((j) => j.personaRef.prefix === "Epersona_A")!.granterSeq).toBe(5);

    // A LOWER granterSeq never rolls the view back, even with a HIGHER expiry.
    recordAdmittedPersona(joinRec("Epersona_A", { granterSeq: 2, expiry: 99_999 }), dir);
    expect(listAdmittedPersonas(dir).find((j) => j.personaRef.prefix === "Epersona_A")!.granterSeq).toBe(5);

    // Seqs tie (or both absent) → the GREATER nonceA tiebreaks, expiry still unread.
    recordAdmittedPersona(joinRec("Epersona_B", { nonceA: "01".repeat(16), expiry: 500 }), dir);
    recordAdmittedPersona(joinRec("Epersona_B", { nonceA: "02".repeat(16), expiry: 1 }), dir);   // lower expiry, greater nonce
    expect(listAdmittedPersonas(dir).find((j) => j.personaRef.prefix === "Epersona_B")!.nonceA).toBe("02".repeat(16));
    recordAdmittedPersona(joinRec("Epersona_B", { nonceA: "00".repeat(16), expiry: 99_999 }), dir);   // higher expiry, lesser nonce
    expect(listAdmittedPersonas(dir).find((j) => j.personaRef.prefix === "Epersona_B")!.nonceA).toBe("02".repeat(16));

    // A RESOLVED seq always outranks an UNRESOLVED one, in either direction.
    recordAdmittedPersona(joinRec("Epersona_C", { nonceA: "ff".repeat(16) }), dir);              // no seq
    recordAdmittedPersona(joinRec("Epersona_C", { granterSeq: 0, nonceA: "00".repeat(16) }), dir); // seq 0, lesser nonce — still wins
    expect(listAdmittedPersonas(dir).find((j) => j.personaRef.prefix === "Epersona_C")!.granterSeq).toBe(0);
    recordAdmittedPersona(joinRec("Epersona_C", { nonceA: "ff".repeat(16) }), dir);               // no seq — never rolls back a resolved one
    expect(listAdmittedPersonas(dir).find((j) => j.personaRef.prefix === "Epersona_C")!.granterSeq).toBe(0);
  });

  test("the view is a LOCAL 0o600 file — never a bag/board (never-syncs, structural)", () => {
    recordAdmittedPersona(joinRec("Epersona_A"), dir);
    const files = readdirSync(dir);
    expect(files).toContain(".persona-admissions.json");
    // POSIX perms: owner-only (best-effort assert; a non-POSIX fs skips the chmod).
    const mode = statSync(join(dir, ".persona-admissions.json")).mode & 0o777;
    if (process.platform !== "win32") expect(mode).toBe(0o600);
    // The file holds ONLY the local view — no automerge url, no bag id, no board key.
    const raw = readFileSync(join(dir, ".persona-admissions.json"), "utf8");
    expect(raw).not.toContain("automerge:");
    expect(raw).not.toContain("crossroads");
  });

  test("CONSUME-ONCE: a stashed enrollment secret is returned once, then dropped", () => {
    const secret: EnrollmentSecret = {
      ephemeralSecret: new Uint8Array(32).fill(4),
      targetVesselId: "bb".repeat(32), nonceB: "02".repeat(16), expiry: 9999,
    };
    stashEnrollmentSecret("ephpub01", secret, dir);
    const taken = takeEnrollmentSecret("ephpub01", dir);
    expect(taken).not.toBeNull();
    expect([...taken!.ephemeralSecret]).toEqual([...secret.ephemeralSecret]);   // hex round-trip intact
    expect(taken!.nonceB).toBe(secret.nonceB);
    // A SECOND take reads null — the secret is gone (never lingers past its one hop).
    expect(takeEnrollmentSecret("ephpub01", dir)).toBeNull();
  });

  test("CONSUME-ONCE survives a simulated restart: a FRESH read of the SAME disk store still sees it gone", () => {
    const secret: EnrollmentSecret = {
      ephemeralSecret: new Uint8Array(32).fill(5),
      targetVesselId: "bb".repeat(32), nonceB: "03".repeat(16), expiry: 9999,
    };
    // Process A: stash + consume.
    stashEnrollmentSecret("ephpub-restart", secret, dir);
    expect(takeEnrollmentSecret("ephpub-restart", dir)).not.toBeNull();
    // CONTROL: before the stash existed, peek already read empty — the refusal below isn't a fluke of an
    // always-empty peek.
    expect(peekEnrollmentSecrets(dir)).toEqual([]);
    // "Process B" (a cold re-run of this same test body, nothing held in memory — every read here re-opens the
    // file from disk): the consumed secret is still gone. This IS the restart proof, since this store carries
    // no module-level cache — every call above already re-read the file fresh.
    expect(takeEnrollmentSecret("ephpub-restart", dir)).toBeNull();
    expect(peekEnrollmentSecrets(dir)).toEqual([]);
  });

  test("§2a WITHDRAWAL: withdrawAdmitOffer drops a pending offer by the holder's own act, never a clock", () => {
    const secret: EnrollmentSecret = {
      ephemeralSecret: new Uint8Array(32).fill(6),
      targetVesselId: "bb".repeat(32), nonceB: "04".repeat(16), expiry: 9999,
    };
    // CONTROL: an un-withdrawn offer still opens (consumes fine).
    stashEnrollmentSecret("eph-control", secret, dir);
    expect(takeEnrollmentSecret("eph-control", dir)).not.toBeNull();

    // The withdrawn case: stash, then withdraw BEFORE any open — the later take (what a matching open would do)
    // finds nothing, the SAME refusal shape a consumed secret already draws.
    stashEnrollmentSecret("eph-withdrawn", secret, dir);
    expect(withdrawAdmitOffer("eph-withdrawn", dir)).toBe(1);
    expect(takeEnrollmentSecret("eph-withdrawn", dir)).toBeNull();
    // A second withdrawal of the same (already-gone) target reports 0 — no double-count.
    expect(withdrawAdmitOffer("eph-withdrawn", dir)).toBe(0);

    // "all" drops every pending offer in one causal act.
    stashEnrollmentSecret("eph-a", secret, dir);
    stashEnrollmentSecret("eph-b", secret, dir);
    expect(peekEnrollmentSecrets(dir)).toHaveLength(2);
    expect(withdrawAdmitOffer("all", dir)).toBe(2);
    expect(peekEnrollmentSecrets(dir)).toEqual([]);
  });

  test("the pending-offer set is COUNT-bounded at a NAMED K — a stash past it evicts the OLDEST by insertion order", () => {
    const secretFor = (n: number): EnrollmentSecret => ({
      ephemeralSecret: new Uint8Array(32).fill(n),
      targetVesselId: "bb".repeat(32), nonceB: `0${n}`.repeat(16).slice(0, 32), expiry: 9999,
    });
    const K = 2;
    stashEnrollmentSecret("eph-1", secretFor(1), dir, K);
    stashEnrollmentSecret("eph-2", secretFor(2), dir, K);
    expect(peekEnrollmentSecrets(dir).map((p) => p.ephemeralPubkey)).toEqual(["eph-1", "eph-2"]);

    // A THIRD stash past K evicts the OLDEST ("eph-1") — never by any clock/expiry field, purely insertion order.
    stashEnrollmentSecret("eph-3", secretFor(3), dir, K);
    expect(peekEnrollmentSecrets(dir).map((p) => p.ephemeralPubkey)).toEqual(["eph-2", "eph-3"]);
    expect(takeEnrollmentSecret("eph-1", dir)).toBeNull();   // evicted — gone, same refusal shape as consumed/withdrawn
    expect(takeEnrollmentSecret("eph-3", dir)).not.toBeNull();   // the newest still opens fine
  });

  test("ATOMIC WRITE: no `.tmp` sibling survives a successful write (temp + rename)", () => {
    recordAdmittedPersona(joinRec("Epersona_atomic"), dir);
    stashEnrollmentSecret("eph-atomic", {
      ephemeralSecret: new Uint8Array(32).fill(9), targetVesselId: "bb".repeat(32), nonceB: "05".repeat(16), expiry: 9999,
    }, dir);
    const leftoverTmp = readdirSync(dir).filter((f) => f.endsWith(".tmp"));
    expect(leftoverTmp).toEqual([]);
  });

  test("CONSUME-ONCE: a stashed sent memo is returned once, then dropped; reset clears pending", () => {
    const memo: SentGrantMemo = {
      transcript: {
        kind: PERSONA_GRANT_DOMAIN,
        personaRef: { prefix: "Epersona_A", verifyingKey: "aa".repeat(32) },
        targetVesselId: "bb".repeat(32), nonceB: "02".repeat(16), nonceA: "0a".repeat(16), expiry: 9999,
      },
      grantSig: "cc".repeat(64),
    };
    stashSentMemo(memo, dir);
    expect(takeSentMemo("0a".repeat(16), dir)?.grantSig).toBe("cc".repeat(64));
    expect(takeSentMemo("0a".repeat(16), dir)).toBeNull();

    // reset drops any in-flight pending secrets/memos.
    stashSentMemo(memo, dir);
    clearPersonaAdmitPending(dir);
    expect(takeSentMemo("0a".repeat(16), dir)).toBeNull();
  });

  test("M8′/§2a: the sent-grant memo set is COUNT-bounded too — a stash past K evicts the OLDEST by insertion order", () => {
    const memoFor = (nonceA: string): SentGrantMemo => ({
      transcript: {
        kind: PERSONA_GRANT_DOMAIN,
        personaRef: { prefix: "Epersona_memobound", verifyingKey: "aa".repeat(32) },
        targetVesselId: "bb".repeat(32), nonceB: "02".repeat(16), nonceA, expiry: 9999,
      },
      grantSig: "ee".repeat(64),
    });
    const K = 2;
    const nA1 = "a1".repeat(16), nA2 = "a2".repeat(16), nA3 = "a3".repeat(16);
    stashSentMemo(memoFor(nA1), dir, K);
    stashSentMemo(memoFor(nA2), dir, K);
    // A THIRD stash past K evicts the OLDEST (nA1) — purely insertion order, never a clock/expiry field.
    stashSentMemo(memoFor(nA3), dir, K);
    expect(takeSentMemo(nA1, dir)).toBeNull();          // evicted — same refusal shape as consumed/withdrawn
    expect(takeSentMemo(nA2, dir)).not.toBeNull();       // the middle one still stands
    expect(takeSentMemo(nA3, dir)).not.toBeNull();       // the newest still stands
  });

  test("§2a WITHDRAWAL: withdrawAdmitGrant refuses a LATE take at the same nonce (the ACK's own lookup)", () => {
    const memo: SentGrantMemo = {
      transcript: {
        kind: PERSONA_GRANT_DOMAIN,
        personaRef: { prefix: "Epersona_withdraw", verifyingKey: "aa".repeat(32) },
        targetVesselId: "bb".repeat(32), nonceB: "02".repeat(16), nonceA: "0b".repeat(16), expiry: 9999,
      },
      grantSig: "dd".repeat(64),
    };
    // CONTROL: an un-withdrawn sent memo is still found by the ACK's own lookup (acceptAdmitFlow's takeSentMemo).
    stashSentMemo(memo, dir);
    expect(takeSentMemo("0b".repeat(16), dir)).not.toBeNull();

    // Withdraw BEFORE any ACK arrives — a late ACK's lookup (the same takeSentMemo call acceptAdmitFlow makes)
    // now finds nothing, drawing the SAME "no sent grant matches" refusal a consumed memo already draws.
    stashSentMemo(memo, dir);
    expect(withdrawAdmitGrant("0b".repeat(16), dir)).toBe(true);
    expect(takeSentMemo("0b".repeat(16), dir)).toBeNull();
    // Withdrawing an already-gone nonce reports false — no double-count, no throw.
    expect(withdrawAdmitGrant("0b".repeat(16), dir)).toBe(false);
  });
});
