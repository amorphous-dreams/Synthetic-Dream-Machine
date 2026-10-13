/**
 * node-persona-admit-store — sealed custody rows and per-vessel admission/pending state.
 *
 * Vectors: P1 sealed-at-rest + empty/no-file control; P2 causal supersede, replay ties, bounds/oldest eviction,
 * withdraw one/all, consume-once takes, and peek order; P3 standing torn/key-failed and bare rows refuse every
 * door without moving bytes, with intact-write control; P4 malformed admissions/enrollment/grant shapes refuse
 * without moving bytes, with valid-shape control; P5 every door refuses at the floor without file movement;
 * P6 retired/stranger key tamper probe with rotated-key read/write control; P7 concurrent two-holder enrollment
 * updates preserve all six entries; P8 inherited-slot prefixes remain ordinary keys; P9 no-op acts write nothing;
 * P10 an offer binds to the first grant named for it: the same grant binds again and moves no byte, another grant
 * reads bound-other, an absent offer reads absent, and the bound enrollment keeps its secret (control: an unbound
 * offer takes any grant).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PERSONA_GRANT_DOMAIN, PERSONA_JOIN_DOMAIN, hex, TreeVkRefusal, mintVk, readVkCarrier, writeSealedCarrier,
  type JoinRecord, type EnrollmentSecret, type SentGrantMemo,
} from "@lararium/mesh";
import { CustodyLocked, CustodyRowUnavailable } from "../src/custody-holder.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { rotateCustody } from "../src/custody-session.js";
import { vkSlotsPath } from "../src/vault-carriers.js";
import { seatCustody } from "../src/custody-seat.js";
import { ADMISSIONS_FILE, PENDING_ENROLL_FILE, PENDING_GRANT_FILE, recordAdmittedPersona, listAdmittedPersonas,
  isPersonaAdmitted, stashEnrollmentSecret, takeEnrollmentSecret, peekEnrollmentSecrets, withdrawAdmitOffer,
  stashSentMemo, peekSentMemo, takeSentMemo, withdrawAdmitGrant, clearPersonaAdmitPending, bindEnrollmentToGrant,
} from "../src/node-persona-admit-store.js";
import { seatScratchCustody, FIXTURE_PASSPHRASE } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });
const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v, null, 2));
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const joinRec = (prefix: string, opts: { granterSeq?: number; nonceA?: string } = {}): JoinRecord => ({
  kind: PERSONA_JOIN_DOMAIN, personaRef: { prefix, verifyingKey: "aa".repeat(32) }, targetVesselId: "bb".repeat(32),
  granterKey: "aa".repeat(32), nonceA: opts.nonceA ?? "01".repeat(16), nonceB: "02".repeat(16), grantSig: "cc".repeat(64),
  ...(opts.granterSeq === undefined ? {} : { granterSeq: opts.granterSeq }),
});
const secretFor = (n: number): EnrollmentSecret => ({ ephemeralSecret: new Uint8Array(32).fill(n), targetVesselId: "bb".repeat(32), nonceB: n.toString(16).padStart(2, "0").repeat(16) });
const memoFor = (nonceA: string): SentGrantMemo => ({ transcript: { kind: PERSONA_GRANT_DOMAIN,
  personaRef: { prefix: "Epersona_memo", verifyingKey: "aa".repeat(32) }, targetVesselId: "bb".repeat(32),
  nonceB: "02".repeat(16), nonceA }, grantSig: "cc".repeat(64) });

describe("node-persona-admit-store", () => {
  let c: Awaited<ReturnType<typeof seatScratchCustody>>;
  beforeEach(async () => { c = await seatScratchCustody("persona-admit"); });
  afterEach(async () => { await c.drop(); });
  const at = (f: string) => join(c.homes.identity, f);
  const rows = [ADMISSIONS_FILE, PENDING_ENROLL_FILE, PENDING_GRANT_FILE];

  test("P1 every row seals at rest and round-trips; absent reads are empty", async () => {
    expect(await listAdmittedPersonas()).toEqual([]);
    expect(await isPersonaAdmitted("Epersona_sealed")).toBe(false);
    expect(await peekEnrollmentSecrets()).toEqual([]);
    expect(await peekSentMemo("0a".repeat(16))).toBeNull();
    for (const f of rows) expect(existsSync(at(f)), `${f}: no reader makes a file`).toBe(false);
    const join = joinRec("Epersona_sealed");
    const secret = secretFor(7);
    const memo = memoFor("0a".repeat(16));
    await recordAdmittedPersona(join);
    await stashEnrollmentSecret("ephemeral-pub-synthetic", secret);
    await stashSentMemo(memo);
    for (const f of rows) {
      const resting = readFileSync(at(f));
      expect(readVkCarrier(resting), f).toBe("sealed");
      for (const clear of ["Epersona_", "ephemeral-pub-synthetic", hex(secret.ephemeralSecret), memo.transcript.nonceA, join.nonceB]) {
        expect(resting.includes(Buffer.from(clear)), `${f} carries ${clear.slice(0, 12)} in the clear`).toBe(false);
      }
      // control: the same strings DO stand in the row's plaintext, so the absence above measures the seal
      const opened = await c.holder.readRow("identity", f);
      expect(opened.reading).toBe("opens");
    }
    const enrollPlain = await c.holder.readRow("identity", PENDING_ENROLL_FILE);
    expect(enrollPlain.reading === "opens" && dec(enrollPlain.plaintext).includes(hex(secret.ephemeralSecret))).toBe(true);
    expect(await listAdmittedPersonas()).toEqual([join]);
    expect((await takeEnrollmentSecret("ephemeral-pub-synthetic"))?.ephemeralSecret).toEqual(secret.ephemeralSecret);
    expect(await peekSentMemo(memo.transcript.nonceA)).toEqual(memo);
  });

  test("P2 causal supersede, replay ties, count bounds, withdrawal, consume-once, and peek order", async () => {
    await recordAdmittedPersona(joinRec("A", { granterSeq: 3 }));
    await recordAdmittedPersona(joinRec("A", { granterSeq: 5 }));
    await recordAdmittedPersona(joinRec("A", { granterSeq: 2 }));
    expect((await listAdmittedPersonas()).find(x => x.personaRef.prefix === "A")?.granterSeq).toBe(5);
    await recordAdmittedPersona(joinRec("B", { nonceA: "01".repeat(16) }));
    await recordAdmittedPersona(joinRec("B", { nonceA: "02".repeat(16) }));
    const replay = joinRec("B", { nonceA: "02".repeat(16) });
    await recordAdmittedPersona(replay);
    await recordAdmittedPersona(joinRec("B", { nonceA: "00".repeat(16) }));
    expect((await listAdmittedPersonas()).find(x => x.personaRef.prefix === "B")).toEqual(replay);
    await recordAdmittedPersona(joinRec("C", { nonceA: "ff".repeat(16) }));
    await recordAdmittedPersona(joinRec("C", { granterSeq: 0, nonceA: "00".repeat(16) }));
    await recordAdmittedPersona(joinRec("C", { nonceA: "ff".repeat(16) }));
    expect((await listAdmittedPersonas()).find(x => x.personaRef.prefix === "C")?.granterSeq).toBe(0);
    await stashEnrollmentSecret("e1", secretFor(1), 2); await stashEnrollmentSecret("e2", secretFor(2), 2);
    expect((await peekEnrollmentSecrets()).map(x => x.ephemeralPubkey)).toEqual(["e1", "e2"]);
    await stashEnrollmentSecret("e3", secretFor(3), 2);
    expect((await peekEnrollmentSecrets()).map(x => x.ephemeralPubkey)).toEqual(["e2", "e3"]);
    expect(await takeEnrollmentSecret("e1")).toBeNull();
    expect(await takeEnrollmentSecret("e3")).not.toBeNull();
    expect(await takeEnrollmentSecret("e3")).toBeNull();
    await stashEnrollmentSecret("withdraw-one", secretFor(4));
    expect(await withdrawAdmitOffer("withdraw-one")).toBe(1);
    expect(await withdrawAdmitOffer("withdraw-one")).toBe(0);
    await stashEnrollmentSecret("wa", secretFor(5)); await stashEnrollmentSecret("wb", secretFor(6));
    expect(await withdrawAdmitOffer("all")).toBe(3);   // e2 (it outlived the bound and the takes), wa and wb
    expect(await peekEnrollmentSecrets()).toEqual([]);
    expect(await withdrawAdmitOffer("all")).toBe(0);
    const n1 = "a1".repeat(16), n2 = "a2".repeat(16), n3 = "a3".repeat(16);
    await stashSentMemo(memoFor(n1), 2); await stashSentMemo(memoFor(n2), 2); await stashSentMemo(memoFor(n3), 2);
    expect(await peekSentMemo(n1)).toBeNull();
    expect(await peekSentMemo(n2)).not.toBeNull();
    expect(await takeSentMemo(n2)).not.toBeNull();
    expect(await takeSentMemo(n2)).toBeNull();
    expect(await withdrawAdmitGrant(n3)).toBe(true);
    expect(await withdrawAdmitGrant(n3)).toBe(false);
  });

  test("P3 standing rows that do not open refuse all doors without moving bytes", async () => {
    const ops: Record<string, [() => unknown, () => unknown]> = {
      [ADMISSIONS_FILE]: [() => listAdmittedPersonas(), () => recordAdmittedPersona(joinRec("z"))],
      [PENDING_ENROLL_FILE]: [() => peekEnrollmentSecrets(), () => stashEnrollmentSecret("z", secretFor(8))],
      [PENDING_GRANT_FILE]: [() => peekSentMemo("z"), () => stashSentMemo(memoFor("z"))],
    };
    for (const f of rows) {
      if (f === ADMISSIONS_FILE) await recordAdmittedPersona(joinRec("seed"));
      if (f === PENDING_ENROLL_FILE) await stashEnrollmentSecret("seed", secretFor(9));
      if (f === PENDING_GRANT_FILE) await stashSentMemo(memoFor("seed"));
      const intact = readFileSync(at(f));
      for (const [label, damaged, message] of [["moved", (() => { const b = Buffer.from(intact); b[b.length - 7] = b[b.length - 7]! ^ 1; return b; })(), /reads (key-fails|torn)/],
        ["truncated", intact.subarray(0, Math.max(1, intact.length - 7)), /reads (key-fails|torn)/],
        ["bare", Buffer.from(JSON.stringify({ row: {} })), /reads bare/]] as const) {
        writeFileSync(at(f), damaged);
        expect(readFileSync(at(f)).equals(intact)).toBe(false);
        for (const [kind, run] of [["read", ops[f]![0]], ["write", ops[f]![1]]] as const) {
          await expect(Promise.resolve().then(run), `${f} ${label} ${kind}`).rejects.toThrow(CustodyRowUnavailable);
          await expect(Promise.resolve().then(run), `${f} ${label} ${kind} message`).rejects.toThrow(message);
        }
        expect(readFileSync(at(f)).equals(damaged)).toBe(true);
      }
      writeFileSync(at(f), intact);
      await Promise.resolve(ops[f]![1]());
    }
  });

  test("P4 malformed plaintext shapes refuse without changing bytes; valid rows read", async () => {
    const shapes: Record<string, string[]> = {
      [ADMISSIONS_FILE]: ["not JSON", JSON.stringify({ admissions: [] }), JSON.stringify({ admissions: { A: joinRec("B") } }), JSON.stringify({ admissions: { A: { ...joinRec("A"), nonceA: undefined } } }), JSON.stringify({ admissions: { A: { ...joinRec("A"), grantSig: undefined } } }), JSON.stringify({ admissions: { A: { ...joinRec("A"), personaRef: { prefix: "A" } } } }), JSON.stringify({ admissions: { A: { ...joinRec("A"), granterSeq: "3" } } })],
      [PENDING_ENROLL_FILE]: [JSON.stringify({ pending: {} }), JSON.stringify({ order: ["missing"], pending: {} }), JSON.stringify({ order: [], pending: { extra: { ephemeralSecretHex: "aa".repeat(32), targetVesselId: "x", nonceB: "y" } } }), JSON.stringify({ order: ["x", "x"], pending: { x: { ephemeralSecretHex: "aa".repeat(32), targetVesselId: "x", nonceB: "y" } } }), JSON.stringify({ order: ["x"], pending: { x: { ephemeralSecretHex: "aa".repeat(31), targetVesselId: "x", nonceB: "y" } } })],
      [PENDING_GRANT_FILE]: [JSON.stringify({ order: ["x"], pending: { x: { transcript: {} } } }), JSON.stringify({ order: ["x"], pending: { x: { transcript: memoFor("x").transcript } } }), JSON.stringify({ order: ["x"], pending: { x: { ...memoFor("x"), transcript: { ...memoFor("x").transcript, personaRef: null } } } })],
    };
    for (const f of rows) {
      const opened = f === ADMISSIONS_FILE ? { admissions: {} } : { order: [], pending: {} };
      await c.holder.writeRow("identity", f, enc(opened));
      const ops: Array<() => unknown> = f === ADMISSIONS_FILE ? [() => listAdmittedPersonas(), () => isPersonaAdmitted("x"), () => recordAdmittedPersona(joinRec("x"))]
        : f === PENDING_ENROLL_FILE ? [() => peekEnrollmentSecrets(), () => takeEnrollmentSecret("x"), () => withdrawAdmitOffer("x"), () => stashEnrollmentSecret("x", secretFor(1))]
        : [() => peekSentMemo("x"), () => takeSentMemo("x"), () => withdrawAdmitGrant("x"), () => stashSentMemo(memoFor("x"))];
      for (const shape of shapes[f]!) {
        await c.holder.writeRow("identity", f, new TextEncoder().encode(shape));
        const bytes = readFileSync(at(f));
        for (const op of ops) await expect(Promise.resolve().then(op)).rejects.toThrow(/reads malformed/);
        expect(readFileSync(at(f)).equals(bytes)).toBe(true);
      }
      await c.holder.writeRow("identity", f, enc(opened));
      if (f === ADMISSIONS_FILE) expect(await listAdmittedPersonas()).toEqual([]);
      else if (f === PENDING_ENROLL_FILE) expect(await peekEnrollmentSecrets()).toEqual([]);
      else expect(await peekSentMemo("x")).toBeNull();
    }
  });

  test("P5 every door refuses at the floor and no file moves", async () => {
    await recordAdmittedPersona(joinRec("floor")); await stashEnrollmentSecret("floor", secretFor(2)); await stashSentMemo(memoFor("floor"));
    const before = rows.map(f => readFileSync(at(f)));
    await c.holder.lock();
    const ops = [() => listAdmittedPersonas(), () => isPersonaAdmitted("floor"), () => recordAdmittedPersona(joinRec("x")),
      () => peekEnrollmentSecrets(), () => takeEnrollmentSecret("floor"), () => withdrawAdmitOffer("floor"), () => stashEnrollmentSecret("x", secretFor(3)),
      () => peekSentMemo("floor"), () => takeSentMemo("floor"), () => withdrawAdmitGrant("floor"), () => stashSentMemo(memoFor("x")), () => clearPersonaAdmitPending()];
    for (const op of ops) await expect(Promise.resolve().then(op)).rejects.toThrow(CustodyLocked);
    rows.forEach((f, i) => expect(readFileSync(at(f)).equals(before[i]!)).toBe(true));
  });

  test("P6 retired and stranger keys cannot alter rows; rotated-key control", async () => {
    await recordAdmittedPersona(joinRec("tamper")); await stashEnrollmentSecret("tamper", secretFor(3)); await stashSentMemo(memoFor("tamper"));
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldVk: c.vk, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const standing = rows.map(f => readFileSync(at(f)));
    const reads = [() => listAdmittedPersonas(), () => peekEnrollmentSecrets(), () => peekSentMemo("tamper")];
    const writes = [() => recordAdmittedPersona(joinRec("retired")), () => stashEnrollmentSecret("retired", secretFor(4)), () => stashSentMemo(memoFor("retired"))];
    for (const op of [...reads, ...writes]) await expect(Promise.resolve().then(op)).rejects.toThrow(/reads key-fails/);
    const stranger = mintVk();
    for (const f of rows) await expect(writeSealedCarrier({ io: c.io, vk: stranger, treePath: vkSlotsPath(c.homes.identity),
      carrier: { name: `identity/${f}`, path: at(f), keyClass: null }, plaintext: enc({ stranger: true }) })).rejects.toThrow(TreeVkRefusal);
    rows.forEach((f, i) => { expect(readFileSync(at(f)).equals(standing[i]!)).toBe(true); expect(existsSync(`${at(f)}.vk-sealing`)).toBe(false); });
    // control: a holder over the key the tree now commits to reads all three rows and takes a write
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes }); await fresh.adopt(rotated.vk);
    seatCustody(fresh);
    expect((await listAdmittedPersonas()).map((j) => j.personaRef.prefix)).toEqual(["tamper"]);
    expect((await peekEnrollmentSecrets()).map((p) => p.ephemeralPubkey)).toEqual(["tamper"]);
    expect(await peekSentMemo("tamper")).not.toBeNull();
    await recordAdmittedPersona(joinRec("after-rotation"));
    expect(await isPersonaAdmitted("after-rotation")).toBe(true);
    await fresh.lock();
    seatCustody(c.holder);
  });

  test("P7 two holders over one tree preserve all six pending entries", async () => {
    const other = makeCustodyHolder({ io: new FsCustodyIo(c.homes), homes: c.homes }); await other.adopt(c.vk);
    const viaOther = (key: string): Promise<void> => other.updateRow("identity", PENDING_ENROLL_FILE, standing => {
      if (standing.reading === "unavailable" || standing.reading === "locked") throw new Error(`row reads ${standing.reading}`);
      const shape = standing.reading === "opens" ? JSON.parse(dec(standing.plaintext)) as { order: string[]; pending: Record<string, { ephemeralSecretHex: string; targetVesselId: string; nonceB: string }> } : { order: [], pending: {} };
      shape.order.push(key); shape.pending[key] = { ephemeralSecretHex: "ab".repeat(32), targetVesselId: "bb".repeat(32), nonceB: "02".repeat(16) };
      return { plaintext: enc(shape), value: undefined };
    });
    await Promise.all([stashEnrollmentSecret("s0", secretFor(0)), viaOther("o1"), stashEnrollmentSecret("s2", secretFor(2)), viaOther("o3"), stashEnrollmentSecret("s4", secretFor(4)), viaOther("o5")]);
    expect((await peekEnrollmentSecrets()).map(x => x.ephemeralPubkey).sort()).toEqual(["s0", "o1", "s2", "o3", "s4", "o5"].sort());
    await other.lock();
  });

  test("P8 inherited-looking prefixes are ordinary keys", async () => {
    await recordAdmittedPersona(joinRec("__proto__")); await recordAdmittedPersona(joinRec("constructor"));
    expect((await listAdmittedPersonas()).map(x => x.personaRef.prefix)).toEqual(["__proto__", "constructor"]);
    expect(await isPersonaAdmitted("__proto__")).toBe(true); expect(await isPersonaAdmitted("constructor")).toBe(true);
    expect(await isPersonaAdmitted("toString")).toBe(false);
  });

  test("P9 no-op acts write nothing", async () => {
    await clearPersonaAdmitPending();
    expect(rows.every(f => !existsSync(at(f)))).toBe(true);
    await recordAdmittedPersona(joinRec("noop", { granterSeq: 8 }));
    await stashEnrollmentSecret("present", secretFor(8));
    const admissionBefore = readFileSync(at(ADMISSIONS_FILE)), enrollBefore = readFileSync(at(PENDING_ENROLL_FILE));
    await recordAdmittedPersona(joinRec("noop", { granterSeq: 7 }));
    await takeEnrollmentSecret("absent"); await withdrawAdmitOffer("absent");
    expect(readFileSync(at(ADMISSIONS_FILE)).equals(admissionBefore)).toBe(true);
    expect(readFileSync(at(PENDING_ENROLL_FILE)).equals(enrollBefore)).toBe(true);
    await withdrawAdmitGrant("absent"); await takeSentMemo("absent");
    expect(existsSync(at(PENDING_GRANT_FILE))).toBe(false);
    // control: a clear over a set that holds an entry DOES move the row
    await clearPersonaAdmitPending();
    expect(readFileSync(at(PENDING_ENROLL_FILE)).equals(enrollBefore)).toBe(false);
    expect(await peekEnrollmentSecrets()).toEqual([]);
    const cleared = readFileSync(at(PENDING_ENROLL_FILE));
    await clearPersonaAdmitPending();
    expect(readFileSync(at(PENDING_ENROLL_FILE)).equals(cleared)).toBe(true);
  });

  test("P10 an offer binds to the first grant named for it", async () => {
    await stashEnrollmentSecret("offer-1", secretFor(11)); await stashEnrollmentSecret("offer-2", secretFor(12));
    expect(await bindEnrollmentToGrant("offer-1", "grant-a")).toBe("bound");
    const bound = readFileSync(at(PENDING_ENROLL_FILE));
    expect(await bindEnrollmentToGrant("offer-1", "grant-a")).toBe("bound");          // the same grant, a retry
    expect(await bindEnrollmentToGrant("offer-1", "grant-b")).toBe("bound-other");
    expect(await bindEnrollmentToGrant("offer-9", "grant-a")).toBe("absent");
    expect(readFileSync(at(PENDING_ENROLL_FILE)).equals(bound)).toBe(true);
    expect(await bindEnrollmentToGrant("offer-2", "grant-b")).toBe("bound");          // control: an unbound offer takes any grant
    const peeked = await peekEnrollmentSecrets();
    expect(peeked.map((p) => p.ephemeralPubkey)).toEqual(["offer-1", "offer-2"]);
    expect(peeked[0]!.secret.ephemeralSecret).toEqual(secretFor(11).ephemeralSecret);
    expect((await takeEnrollmentSecret("offer-1"))?.nonceB).toBe(secretFor(11).nonceB);
    expect(await bindEnrollmentToGrant("offer-1", "grant-a")).toBe("absent");
    await c.holder.writeRow("identity", PENDING_ENROLL_FILE, enc({ order: ["x"], pending: { x: { ephemeralSecretHex: "aa".repeat(32), targetVesselId: "x", nonceB: "y", boundTo: 7 } } }));
    await expect(peekEnrollmentSecrets()).rejects.toThrow(/reads malformed/);
  });
});
