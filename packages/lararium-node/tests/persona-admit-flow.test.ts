/**
 * persona-admit-flow — two custody-seated vessels walk the airgapped admission ceremony and its commit points.
 *
 *   F0  the ported laws: the full flow; an enrollment dropped on open; photograph-inert on a third vessel;
 *       rotate-not-resurrect; the two withdraw laws; L10; M8. Each carries its own control.
 *   F1  THE ADMISSION COMMITS, AND THE ACKNOWLEDGMENT TRAVELS WHATEVER THE DROP DOES (target side). The drop of
 *       the enrollment fails once after the record: the open still answers its acknowledgment and says the
 *       enrollment stands; the admission holds; the SAME grant opens again to the same acknowledgment and the
 *       enrollment drops; the granter accepts it.          control: F0's full flow, where no drop fails
 *   F2  a death BEFORE the admission leaves the enrollment pending and records nothing; the same grant then opens.
 *   F3  the granting side: the memo's drop fails once after the record; the accept still answers the join and
 *       says the memo stands; the same ACK accepts again and the memo drops.
 *   F4  an ACK that fails verification costs the grant nothing: no admission, the memo stands, the genuine ACK accepts.
 *   F5  the floor: locked holders refuse the offer, the grant and the accept.
 *   F6  ONE OFFER, ONE GRANT. Two grants ride one offer; the first commits and its enrollment's drop fails. The
 *       SECOND grant then refuses by name, signs no acknowledgment and leaves the first admission standing; the
 *       FIRST grant still opens again to its own acknowledgment and the enrollment drops.
 *       The same holds where the first open died BEFORE its record: the offer stands bound to the first grant,
 *       the second refuses, the first completes.
 *                                                          control: an offer nothing opened takes the second of
 *                                                          two grants sealed to it
 */
import { afterEach, beforeEach, describe, test, expect, vi } from "vitest";
import * as ed from "@noble/ed25519";
import { ed25519SignerFromSeed, hex, type PersonaRef } from "@lararium/mesh";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { seatCustody } from "../src/custody-seat.js";
import { CustodyLocked, type CustodyHolder } from "../src/custody-holder.js";
import { parseAckCarriage, toAckCarriage } from "../src/persona-admit-carriage.js";
import {
  offerAdmitFlow, grantAdmitFlow, openAdmitFlow, acceptAdmitFlow,
  withdrawOfferFlow, withdrawGrantFlow,
} from "../src/persona-admit-flow.js";
import {
  ADMISSIONS_FILE, PENDING_ENROLL_FILE, PENDING_GRANT_FILE,
  listAdmittedPersonas, peekEnrollmentSecrets, peekSentMemo,
} from "../src/node-persona-admit-store.js";

vi.setConfig({ testTimeout: 120_000 });

const A_PERSONA_SEED = new Uint8Array(32).fill(1);
const B_DEVICE_SEED = new Uint8Array(32).fill(2);
const PREFIX = "EpersonaAID_flow_01";
const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);

async function as<T>(vessel: SeatedScratchCustody, fn: () => Promise<T>): Promise<T> {
  const prior = process.env["LAR_ROOT"];
  process.env["LAR_ROOT"] = vessel.root;
  try { return await fn(); }
  finally { if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior; }
}

describe("persona-admit-flow — two custody-seated vessels", () => {
  let a: SeatedScratchCustody;
  let b: SeatedScratchCustody;

  beforeEach(async () => {
    a = await seatScratchCustody("admit-A");
    b = await seatScratchCustody("admit-B");
  });
  afterEach(async () => {
    await b.drop();
    await a.drop();
  });

  async function fixtures() {
    const personaKey = await pubOf(A_PERSONA_SEED);
    const deviceKey = await pubOf(B_DEVICE_SEED);
    const personaRef: PersonaRef = { prefix: PREFIX, verifyingKey: personaKey };
    const personaSigner = ed25519SignerFromSeed(A_PERSONA_SEED);
    const deviceSigner = ed25519SignerFromSeed(B_DEVICE_SEED);
    const resolveHeadOpKey = (prefix: string): string | null => prefix === PREFIX ? personaKey : null;
    return { personaKey, deviceKey, personaRef, personaSigner, deviceSigner, resolveHeadOpKey };
  }

  async function offer(f: Awaited<ReturnType<typeof fixtures>>) {
    return as(b, () => offerAdmitFlow({ deviceVerifyingKey: f.deviceKey }));
  }
  async function grant(f: Awaited<ReturnType<typeof fixtures>>, offerCarriage: string) {
    return as(a, () => grantAdmitFlow({ offerCarriage, personaRef: f.personaRef, personaSigner: f.personaSigner }));
  }
  async function open(f: Awaited<ReturnType<typeof fixtures>>, grantCarriage: string) {
    return as(b, () => openAdmitFlow({ grantCarriage, resolveHeadOpKey: f.resolveHeadOpKey, deviceSigner: f.deviceSigner }));
  }
  async function accept(ackCarriage: string) {
    return as(a, () => acceptAdmitFlow({ ackCarriage }));
  }

  test("THE FULL FLOW: both vessels end holding the SAME join in their OWN local view", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    expect(enrollment.terminalQr.length).toBeGreaterThan(0);
    expect(enrollment.carriage.startsWith("#enroll=")).toBe(true);
    const granted = await grant(f, enrollment.carriage);
    expect("error" in granted).toBe(false);
    if ("error" in granted) return;
    expect(granted.carriage.startsWith("#grant=")).toBe(true);
    const opened = await open(f, granted.carriage);
    expect("error" in opened).toBe(false);
    if ("error" in opened) return;
    expect(opened.carriage.startsWith("#ack=")).toBe(true);
    const accepted = await accept(opened.carriage);
    expect("error" in accepted).toBe(false);
    if ("error" in accepted) return;
    const aView = await as(a, listAdmittedPersonas);
    const bView = await as(b, listAdmittedPersonas);
    expect(aView).toHaveLength(1);
    expect(bView).toHaveLength(1);
    expect(aView[0]!.personaRef.prefix).toBe(PREFIX);
    expect(aView[0]).toEqual(bView[0]);
    expect(aView[0]!.targetVesselId).toBe(f.deviceKey);
  });

  test("B's ephemeral secret is CONSUMED on open (a replayed grant finds no pending enrollment)", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    const first = await open(f, granted.carriage);
    expect("error" in first).toBe(false);
    const second = await open(f, granted.carriage);
    expect("error" in second).toBe(true);
  });

  test("PHOTOGRAPH-INERT: a captured grant opened on a THIRD vessel (no pending enrollment) records nothing", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    const thief = await seatScratchCustody("admit-thief");
    try {
      const stolen = await as(thief, () => openAdmitFlow({ grantCarriage: granted.carriage, resolveHeadOpKey: f.resolveHeadOpKey, deviceSigner: f.deviceSigner }));
      expect("error" in stolen).toBe(true);
      expect(await as(thief, listAdmittedPersonas)).toEqual([]);
    } finally { await thief.drop(); }
  });

  test("§2a: a WITHDRAWN offer refuses a fresh grant (same refusal shape as consumed) — nothing that opened before stops opening", async () => {
    const f = await fixtures();
    const controlOffer = await offer(f);
    const controlGrant = await grant(f, controlOffer.carriage);
    if ("error" in controlGrant) throw new Error("control grant failed");
    const controlOpened = await open(f, controlGrant.carriage);
    expect("error" in controlOpened).toBe(false);
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    expect(await as(b, () => withdrawOfferFlow(enrollment.offer.ephemeralPubkey))).toBe(1);
    expect((await as(b, peekEnrollmentSecrets)).find((p) => p.ephemeralPubkey === enrollment.offer.ephemeralPubkey)).toBeUndefined();
    const opened = await open(f, granted.carriage);
    expect("error" in opened).toBe(true);
    expect(await as(b, listAdmittedPersonas)).toHaveLength(1);
  });

  test("§2a: a WITHDRAWN grant refuses its own late ACK — nothing that accepted before stops accepting", async () => {
    const f = await fixtures();
    const controlOffer = await offer(f);
    const controlGrant = await grant(f, controlOffer.carriage);
    if ("error" in controlGrant) throw new Error("control grant failed");
    const controlOpened = await open(f, controlGrant.carriage);
    if ("error" in controlOpened) throw new Error("control open failed");
    expect("error" in await accept(controlOpened.carriage)).toBe(false);
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    const opened = await open(f, granted.carriage);
    if ("error" in opened) throw new Error("open failed");
    expect(await as(a, () => withdrawGrantFlow(granted.sealed.nonceA)).then(Boolean)).toBe(true);
    expect("error" in await accept(opened.carriage)).toBe(true);
    expect(await as(a, listAdmittedPersonas)).toHaveLength(1);   // only the control's join: the withdrawn one records nothing on A
  });

  test("M8: onlyEphemeral scopes the match to THIS offer alone — a grant answering a DIFFERENT pending offer is NOT consumed", async () => {
    const f = await fixtures();
    const offerX = await offer(f);
    const offerY = await offer(f);
    const grantY = await grant(f, offerY.carriage);
    if ("error" in grantY) throw new Error("grant failed");
    expect("error" in await open(f, grantY.carriage)).toBe(false);
    expect((await as(b, peekEnrollmentSecrets)).some((p) => p.ephemeralPubkey === offerX.offer.ephemeralPubkey)).toBe(true);
    expect((await as(b, peekEnrollmentSecrets)).some((p) => p.ephemeralPubkey === offerY.offer.ephemeralPubkey)).toBe(false);
    const offerX2 = await offer(f);
    const offerY2 = await offer(f);
    const grantY2 = await grant(f, offerY2.carriage);
    if ("error" in grantY2) throw new Error("grant failed");
    const scopedOpen = await as(b, () => openAdmitFlow({ grantCarriage: grantY2.carriage, resolveHeadOpKey: f.resolveHeadOpKey, deviceSigner: f.deviceSigner, onlyEphemeral: offerX2.offer.ephemeralPubkey }));
    expect("error" in scopedOpen).toBe(true);
    const pending = await as(b, peekEnrollmentSecrets);
    expect(pending.some((p) => p.ephemeralPubkey === offerX2.offer.ephemeralPubkey)).toBe(true);
    expect(pending.some((p) => p.ephemeralPubkey === offerY2.offer.ephemeralPubkey)).toBe(true);
  });

  test("L10: a non-decrypt refusal (a real cause) is reported over a merely-unmatched offer's decrypt-failed", async () => {
    const f = await fixtures();
    await offer(f);
    const offerY = await offer(f);
    const grantY = await grant(f, offerY.carriage);
    if ("error" in grantY) throw new Error("grant failed");
    const rotatedHead = await pubOf(new Uint8Array(32).fill(9));
    const opened = await as(b, () => openAdmitFlow({ grantCarriage: grantY.carriage, resolveHeadOpKey: () => rotatedHead, deviceSigner: f.deviceSigner }));
    expect("error" in opened).toBe(true);
    if (!("error" in opened)) throw new Error("expected a refusal");
    expect(opened.error.startsWith("decrypt-failed")).toBe(false);
    expect(opened.error).toContain("rotated/superseded");
  });

  test("ROTATE-NOT-RESURRECT: a grant the head resolver rejects records nothing on B", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    const rotatedHead = await pubOf(new Uint8Array(32).fill(9));
    const opened = await as(b, () => openAdmitFlow({ grantCarriage: granted.carriage, resolveHeadOpKey: () => rotatedHead, deviceSigner: f.deviceSigner }));
    expect("error" in opened).toBe(true);
    expect(await as(b, listAdmittedPersonas)).toEqual([]);
  });

  function failingHolder(vessel: SeatedScratchCustody, thenFile: string, firstFile?: string): CustodyHolder {
    let sawFirst = false;
    let failed = false;
    const real = vessel.holder;
    return {
      ...real,
      updateRow: async <T>(home: Parameters<CustodyHolder["updateRow"]>[0], file: string, decide: Parameters<CustodyHolder["updateRow"]>[2]) => {
        if (firstFile && file === firstFile) sawFirst = true;
        if (!failed && (!firstFile || sawFirst) && file === thenFile) { failed = true; throw new Error("the process died here"); }
        return real.updateRow(home, file, decide) as Promise<T>;
      },
    };
  }

  test("F1: THE CRASH BETWEEN THE TWO WRITES RESUMES (target side)", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    seatCustody(failingHolder(b, PENDING_ENROLL_FILE, ADMISSIONS_FILE));
    const first = await open(f, granted.carriage);
    if ("error" in first) throw new Error(`the committed open lost its acknowledgment: ${first.error}`);
    expect(first.pendingStands).toBe(true);
    const committed = await as(b, async () => {
      seatCustody(b.holder);
      return { admissions: await listAdmittedPersonas(), pending: await peekEnrollmentSecrets() };
    });
    expect(committed.admissions).toHaveLength(1);
    expect(committed.pending.some((p) => p.ephemeralPubkey === enrollment.offer.ephemeralPubkey)).toBe(true);
    const resumed = await open(f, granted.carriage);
    expect("error" in resumed).toBe(false);
    if ("error" in resumed) return;
    expect(resumed.pendingStands).toBeUndefined();
    expect(resumed.carriage).toBe(first.carriage);            // the same grant answers the same acknowledgment
    expect((await as(b, peekEnrollmentSecrets)).some((p) => p.ephemeralPubkey === enrollment.offer.ephemeralPubkey)).toBe(false);
    expect(await as(b, listAdmittedPersonas)).toHaveLength(1);
    const accepted = await accept(resumed.carriage);
    expect("error" in accepted).toBe(false);
    expect(await as(a, listAdmittedPersonas)).toHaveLength(1);
  });

  test("F2: A DEATH BEFORE THE ADMISSION LEAVES THE ENROLLMENT PENDING", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    seatCustody(failingHolder(b, ADMISSIONS_FILE));
    await expect(open(f, granted.carriage)).rejects.toThrow("the process died here");
    const state = await as(b, async () => {
      seatCustody(b.holder);
      return { admissions: await listAdmittedPersonas(), pending: await peekEnrollmentSecrets() };
    });
    expect(state.admissions).toEqual([]);
    expect(state.pending.some((p) => p.ephemeralPubkey === enrollment.offer.ephemeralPubkey)).toBe(true);
    expect("error" in await open(f, granted.carriage)).toBe(false);
  });

  test("F3: the granting side resumes after admission and before its memo drops", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    const opened = await open(f, granted.carriage);
    if ("error" in opened) throw new Error("open failed");
    seatCustody(failingHolder(a, PENDING_GRANT_FILE, ADMISSIONS_FILE));
    const firstAccept = await accept(opened.carriage);
    if ("error" in firstAccept) throw new Error(`the committed accept lost its join: ${firstAccept.error}`);
    expect(firstAccept.pendingStands).toBe(true);
    const state = await as(a, async () => {
      seatCustody(a.holder);
      return { admissions: await listAdmittedPersonas(), memo: await peekSentMemo(granted.sealed.nonceA) };
    });
    expect(state.admissions).toHaveLength(1);
    expect(state.memo).not.toBeNull();
    expect("error" in await accept(opened.carriage)).toBe(false);
    expect(await as(a, () => peekSentMemo(granted.sealed.nonceA))).toBeNull();
    expect(await as(a, listAdmittedPersonas)).toHaveLength(1);
  });

  test("F4: AN ACK THAT FAILS VERIFICATION COSTS THE GRANT NOTHING", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    const opened = await open(f, granted.carriage);
    if ("error" in opened) throw new Error("open failed");
    const parsed = parseAckCarriage(opened.carriage);
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("ACK carriage did not parse");
    expect(parsed.joinRecord.nonceA).toBe(granted.sealed.nonceA);
    const replacement = parsed.ackSig[0] === "0" ? "1" : "0";
    const tampered = toAckCarriage({ ...parsed, ackSig: replacement + parsed.ackSig.slice(1) });
    expect(tampered).not.toBe(opened.carriage);
    const refused = await accept(tampered);
    expect("error" in refused).toBe(true);
    expect(await as(a, listAdmittedPersonas)).toEqual([]);
    expect(await as(a, () => peekSentMemo(granted.sealed.nonceA))).not.toBeNull();
    expect("error" in await accept(opened.carriage)).toBe(false);
  });

  test("F5: THE FLOOR — locked holders refuse offer, grant, and accept", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const granted = await grant(f, enrollment.carriage);
    if ("error" in granted) throw new Error("grant failed");
    const opened = await open(f, granted.carriage);
    if ("error" in opened) throw new Error("open failed");
    await b.holder.lock();
    await expect(as(b, () => offerAdmitFlow({ deviceVerifyingKey: f.deviceKey }))).rejects.toThrow(CustodyLocked);
    await a.holder.lock();
    await expect(as(a, () => grantAdmitFlow({ offerCarriage: enrollment.carriage, personaRef: f.personaRef, personaSigner: f.personaSigner }))).rejects.toThrow(CustodyLocked);
    await expect(as(a, () => acceptAdmitFlow({ ackCarriage: opened.carriage }))).rejects.toThrow(CustodyLocked);
  });

  test("F6: ONE OFFER, ONE GRANT — an offer binds to the first grant that verifies and completes no other", async () => {
    const f = await fixtures();
    const enrollment = await offer(f);
    const g1 = await grant(f, enrollment.carriage);
    const g2 = await grant(f, enrollment.carriage);
    if ("error" in g1 || "error" in g2) throw new Error("grant failed");
    seatCustody(failingHolder(b, PENDING_ENROLL_FILE, ADMISSIONS_FILE));
    const committed = await open(f, g1.carriage);
    if ("error" in committed) throw new Error("the first grant failed to commit");
    expect(committed.pendingStands).toBe(true);
    await as(b, async () => { seatCustody(b.holder); });
    const standing = (await as(b, listAdmittedPersonas))[0]!;
    expect(standing.nonceA).toBe(g1.sealed.nonceA);

    const other = await open(f, g2.carriage);
    expect("error" in other).toBe(true);
    if ("error" in other) expect(other.error).toMatch(/stands bound to another grant/);
    expect((await as(b, listAdmittedPersonas))[0]).toEqual(standing);            // the first admission stands, byte for byte
    // the first grant still completes: its own carriage opens again to its own acknowledgment, and the enrollment drops
    const again = await open(f, g1.carriage);
    if ("error" in again) throw new Error(`the bound grant lost its retry: ${again.error}`);
    expect(again.carriage).toBe(committed.carriage);
    expect((await as(b, peekEnrollmentSecrets)).some((p) => p.ephemeralPubkey === enrollment.offer.ephemeralPubkey)).toBe(false);

    // the same holds where the first open died BEFORE its record: bound, nothing recorded for it
    const early = await offer(f);
    const e1 = await grant(f, early.carriage);
    const e2 = await grant(f, early.carriage);
    if ("error" in e1 || "error" in e2) throw new Error("grant failed");
    seatCustody(failingHolder(b, ADMISSIONS_FILE));
    await expect(open(f, e1.carriage)).rejects.toThrow("the process died here");
    await as(b, async () => { seatCustody(b.holder); });
    const refused = await open(f, e2.carriage);
    expect("error" in refused && /stands bound to another grant/.test(refused.error)).toBe(true);
    expect("error" in await open(f, e1.carriage)).toBe(false);

    // control: an offer nothing opened takes the second of two grants sealed to it
    const liveOffer = await offer(f);
    const unopened = await grant(f, liveOffer.carriage);
    const second = await grant(f, liveOffer.carriage);
    if ("error" in unopened || "error" in second) throw new Error("grant failed");
    expect(second.sealed.nonceA).not.toBe(unopened.sealed.nonceA);
    expect("error" in await open(f, second.carriage)).toBe(false);
  });
});
