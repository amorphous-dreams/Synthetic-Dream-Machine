/**
 * persona-kel-drop.test — a herm keeps a PersonaGroup's KEL successors only when each verifies against the
 * predecessor its deposit carries, and vouches for none of them; the leaf's reader folds plural values through the
 * one reader and verifies every quorum itself.
 *
 * Proven, each red beside its control:
 *   · a drop's name binds the predecessor's cid and the herm's gate key under its own domain;
 *   · RED: the herm keeps only a successor that verifies against the predecessor its deposit carries — a stripped,
 *     re-addressed, re-cid'd, unsigned or junk-quorum event, or a forged predecessor, is refused;
 *   · RED (F1): sixteen junk rotations under a real name file nothing, and the lawful successor still lands;
 *   · RED (F1b): sixteen copies of the real event under junk signature sets hold one place, idempotently;
 *   · RED (F2): four thousand junk events under invented predecessors file nothing, and the herm stays open;
 *   · RED (F3): a quarter-megabyte unsigned event files nothing;
 *   · RED: the budget lets go of the drop it heard from least lately, never the one it files into;
 *   · RED: vetoes and rotations hold separate places, so an op-key holder's vetoes never crowd out a quorum's
 *     rotation; a veto naming a held provisional displaces one naming none;
 *   · a drop holds plural values: a provisional rotation and its veto share a predecessor, and both stay;
 *   · a journal hands a restarted herm back what it verified, re-verified;
 *   · RED: the reader refuses a stripped or swapped successor and names it; CONTROL: the honest copy extends;
 *   · RED (M1): two quorum-signed successors at one seat surface as a fork, whichever herm answers first;
 *   · RED (H): a herm that answers nothing is named, and the pull proceeds on the others;
 *   · the reader walks several hops, and folds a veto a first pull missed over the provisional it holds;
 *   · a deposit files every event of a chain, with its predecessor, under that predecessor's name at every herm.
 */
import { describe, test, expect } from "vitest";
import { canonicalJsonBytes, hex, sha256HexSync } from "../src/crypto.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { PERSONA_KEL_DROP_DOMAIN } from "../src/domains.js";
import { enrolmentDigestOf, personaEventCidOf, headOpKey, type PersonaKelEvent } from "../src/persona-kel.js";
import {
  personaKelDropName, makePersonaKelDropStore, localPersonaKelDropHerm, pullPersonaKelSuccessors, depositPersonaKelChain,
  PERSONA_KEL_DROP_READ_CAP, type PersonaKelDropHerm, type PersonaKelDropDeposit,
} from "../src/persona-kel-drop.js";
import { attestAndRotate } from "../src/recovery-keel-core.js";
import { rollEnrolments } from "../src/persona-group-secret.js";
import { mintVeto } from "../src/persona-kel.js";
import {
  SEEDS, pubOf, didOf, signerOf, founded, rotatedKeeping, rotatedTwice, provisionalKeeping, DROP_GATES,
} from "./fixtures/sibling-fleet.js";

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const nameAt = (gate: string, cid: string) => personaKelDropName(cid, gate);
const dep = (prev: PersonaKelEvent, event: unknown): PersonaKelDropDeposit => copy({ prev, event }) as PersonaKelDropDeposit;

/** A rotation that looks lawful and carries no quorum: its cid recomputes, nothing signs it. */
function junkRotationOf(prev: PersonaKelEvent, n: number): PersonaKelEvent {
  const core = {
    seq: prev.seq + 1, prefix: prev.prefix, opKeyDid: `0x${sha256HexSync(`junk-${n}`)}`, recoverySetHash: prev.recoverySetHash,
    nextRecoverySetHash: prev.nextRecoverySetHash, prevEventCid: prev.eventCid, provisional: false, vetoOfCid: null,
    enrolmentDigest: enrolmentDigestOf([]),
  };
  return { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] };
}

/** The KEL rotated from the inception to `op`, keeping `keep` — a second quorum-signed successor at seq 1. */
async function rotatedTo(op: Uint8Array, keep: readonly Uint8Array[]): Promise<PersonaKelEvent[]> {
  const { inception, guardianRecoveryKeys, recoveryThreshold } = await founded();
  const guardianSigners = await Promise.all([SEEDS.g1, SEEDS.g2].map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const devices = await Promise.all(keep.map(async (d) => ({ deviceVerifyingKey: await pubOf(d), hearthTrueName: "", boundEpoch: 0 })));
  const enrolments = await rollEnrolments({ prefix: inception.prefix, opSeed: op, devices });
  const rot = await attestAndRotate({ head: inception, freshOpKeyDid: await didOf(op), guardianRecoveryKeys, recoveryThreshold, guardianSigners, enrolments });
  if (!rot.ok) throw new Error(rot.reason);
  return [inception, rot.event];
}

describe("persona-kel-drop — the herm's side: it keeps what verifies, and vouches for nothing", () => {
  test("a drop's name binds the predecessor's cid and the herm's gate key under its own domain", () => {
    const name = personaKelDropName("pkel0-abc", DROP_GATES[0]);
    expect(name).toBe(hex(sha256(canonicalJsonBytes({ domain: PERSONA_KEL_DROP_DOMAIN, prev: "pkel0-abc", gate: DROP_GATES[0] }))));
    expect(personaKelDropName("pkel0-abc", DROP_GATES[1])).not.toBe(name);
    expect(personaKelDropName("pkel0-abd", DROP_GATES[0])).not.toBe(name);
  });

  test("RED: the herm keeps only a successor that verifies against the predecessor its deposit carries; CONTROL: the lawful one stays", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const [inception, rot] = chain as [PersonaKelEvent, PersonaKelEvent];
    const store = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    const name = nameAt(DROP_GATES[0], inception.eventCid);
    expect(store.deposit(name, dep(inception, { ...rot, enrolments: rot.enrolments!.slice(1) })), "a stripped enrolment list").toBe(false);
    expect(store.deposit(name, dep(inception, { ...rot, eventCid: "pkel1-forged" })), "a cid that does not recompute").toBe(false);
    expect(store.deposit(name, dep(inception, { ...rot, rotationSigs: [] })), "a rotation no quorum signs").toBe(false);
    expect(store.deposit(name, dep(inception, junkRotationOf(inception, 0))), "a junk rotation whose cid recomputes").toBe(false);
    expect(store.deposit(nameAt(DROP_GATES[1], inception.eventCid), dep(inception, rot)), "another herm's name").toBe(false);
    expect(store.deposit(nameAt(DROP_GATES[0], rot.eventCid), dep(inception, rot)), "the name of another predecessor").toBe(false);
    expect(store.deposit(name, dep({ ...inception, nextRecoverySetHash: "forged" }, rot)), "a predecessor whose cid does not recompute").toBe(false);
    expect(store.deposit(name, copy(rot)), "a bare event, no predecessor").toBe(false);
    expect(store.deposit(name, "junk"), "bytes that read as no deposit").toBe(false);
    expect(store.pull(name)).toEqual([]);
    expect(store.deposit(name, dep(inception, rot))).toBe(true);
    expect(store.deposit(name, dep(inception, rot)), "a re-deposit of a verified event holds, idempotent").toBe(true);
    expect(store.pull(name).map((e) => e.eventCid)).toEqual([rot.eventCid]);
  });

  test("RED (F1): sixteen junk rotations under a real name file nothing, and the lawful successor still lands at both herms", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const [inception, rot] = chain as [PersonaKelEvent, PersonaKelEvent];
    const stores = DROP_GATES.map((gatePubKey) => makePersonaKelDropStore({ gatePubKey }));
    let kept = 0;
    for (const s of stores) for (let i = 0; i < 16; i++) if (s.deposit(nameAt(s.gatePubKey, inception.eventCid), dep(inception, junkRotationOf(inception, i)))) kept++;
    expect(kept).toBe(0);
    const herms = stores.map(localPersonaKelDropHerm);
    await depositPersonaKelChain(chain, herms);
    const pulled = await pullPersonaKelSuccessors([inception], herms);
    expect(pulled.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, rot.eventCid]);
  });

  test("RED (F1b): sixteen copies of the real event under junk signature sets hold ONE place, and the real deposit stays idempotent", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const [inception, rot] = chain as [PersonaKelEvent, PersonaKelEvent];
    const s = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    const name = nameAt(DROP_GATES[0], inception.eventCid);
    for (let i = 0; i < 16; i++) {
      s.deposit(name, dep(inception, { ...rot, rotationSigs: [{ signer: "00".repeat(32), sig: i.toString(16).padStart(128, "0") }] }));
      s.deposit(name, dep(inception, { ...rot, rotationSigs: [...rot.rotationSigs, { signer: "00".repeat(32), sig: i.toString(16).padStart(128, "0") }] }));
    }
    expect(s.deposit(name, dep(inception, rot))).toBe(true);
    expect(s.pull(name)).toHaveLength(1);
  });

  test("RED (F2): four thousand junk events under invented predecessors file nothing, and the herm takes the lawful deposit after", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const [inception, rot] = chain as [PersonaKelEvent, PersonaKelEvent];
    const s = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    let kept = 0;
    for (let i = 0; i < 4096; i++) {
      const fakePrev = { ...inception, eventCid: `pkel0-fake-${i}` };
      if (s.deposit(nameAt(DROP_GATES[0], fakePrev.eventCid), dep(fakePrev, junkRotationOf(fakePrev, i)))) kept++;
    }
    expect(kept).toBe(0);
    expect(s.bytes).toBe(0);
    expect(s.deposit(nameAt(DROP_GATES[0], inception.eventCid), dep(inception, rot))).toBe(true);
  });

  test("RED (F3): a quarter-megabyte unsigned event files nothing", async () => {
    const { inception } = await founded();
    const boxes = Array.from({ length: 520 }, (_, i) => ({ kind: "sealed-enrolment", e: "ab".repeat(32), n: "cd".repeat(12), c: "ef".repeat(100) + i.toString(16).padStart(4, "0"), sig: "00".repeat(64) }));
    const core = {
      seq: 1, prefix: inception.prefix, opKeyDid: "0x" + "11".repeat(32), recoverySetHash: inception.recoverySetHash,
      nextRecoverySetHash: inception.nextRecoverySetHash, prevEventCid: inception.eventCid, provisional: false, vetoOfCid: null,
      enrolmentDigest: enrolmentDigestOf(boxes as never),
    };
    const ev = { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [], enrolments: boxes };
    expect(JSON.stringify(ev).length).toBeGreaterThan(240_000);
    const s = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    expect(s.deposit(nameAt(DROP_GATES[0], inception.eventCid), dep(inception, ev))).toBe(false);
    expect(s.bytes).toBe(0);
  });

  test("RED: past its byte budget the herm lets go of the drop it heard from least lately, never the one it files into", async () => {
    const twice = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX]);
    const first = dep(twice[0]!, twice[1]!), second = dep(twice[1]!, twice[2]!);
    const [a, b] = [first, second].map((d) => JSON.stringify(d).length) as [number, number];
    const tight = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0], quota: { bytes: b + Math.floor(a / 2) } });
    expect(tight.deposit(nameAt(DROP_GATES[0], twice[0]!.eventCid), first)).toBe(true);
    expect(tight.deposit(nameAt(DROP_GATES[0], twice[1]!.eventCid), second)).toBe(true);
    expect(tight.pull(nameAt(DROP_GATES[0], twice[0]!.eventCid)), "the least lately heard drop went").toEqual([]);
    expect(tight.pull(nameAt(DROP_GATES[0], twice[1]!.eventCid)).map((e) => e.eventCid)).toEqual([twice[2]!.eventCid]);
    // CONTROL: the default budget keeps both.
    const roomy = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    expect(roomy.deposit(nameAt(DROP_GATES[0], twice[0]!.eventCid), first) && roomy.deposit(nameAt(DROP_GATES[0], twice[1]!.eventCid), second)).toBe(true);
    expect(roomy.pull(nameAt(DROP_GATES[0], twice[0]!.eventCid))).toHaveLength(1);
  });

  test("RED: vetoes and rotations hold separate places — an op-key holder's vetoes never crowd out a quorum's rotation", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX]);
    const [inception, rot] = chain as [PersonaKelEvent, PersonaKelEvent];
    const s = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0], quota: { perName: 2 } });
    const name = nameAt(DROP_GATES[0], inception.eventCid);
    // The standing op-key signs vetoes naming provisionals no one holds — each verifies, and each spends a veto place.
    const idle: PersonaKelEvent[] = [];
    for (let i = 0; i < 3; i++) {
      const contested = { ...junkRotationOf(inception, 100 + i), provisional: true };
      idle.push(await mintVeto({ contested: { ...contested, eventCid: personaEventCidOf(contested) }, standing: inception, sign: signerOf(SEEDS.opA) }));
    }
    expect(idle.map((v) => s.deposit(name, dep(inception, v)))).toEqual([true, true, false]);
    expect(s.deposit(name, dep(inception, rot)), "the quorum's rotation still files").toBe(true);
    // A veto naming a provisional the drop holds displaces one naming none.
    const { provisional, veto } = await provisionalKeeping([SEEDS.deviceX]);
    expect(s.deposit(name, dep(inception, provisional))).toBe(true);
    expect(s.deposit(name, dep(inception, veto))).toBe(true);
    expect(s.pull(name).map((e) => e.eventCid)).toContain(veto.eventCid);
  });

  test("a drop holds plural values: a provisional rotation and its veto share a predecessor, and both stay", async () => {
    const { inception, provisional, veto } = await provisionalKeeping([SEEDS.deviceX]);
    const store = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    const name = nameAt(DROP_GATES[0], inception.eventCid);
    expect(store.deposit(name, dep(inception, provisional)) && store.deposit(name, dep(inception, veto))).toBe(true);
    expect(store.pull(name).map((e) => e.eventCid).sort()).toEqual([provisional.eventCid, veto.eventCid].sort());
  });

  test("a journal hands a restarted herm back what it verified, re-verified; a line planted in it files nothing", async () => {
    const twice = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX]);
    let lines: Array<{ name: string; deposit: unknown }> = [];
    const journal = {
      load: () => lines,
      append: (name: string, deposit: PersonaKelDropDeposit) => { lines.push(copy({ name, deposit })); },
      rewrite: (all: readonly { name: string; deposit: PersonaKelDropDeposit }[]) => { lines = copy([...all]); },
    };
    const first = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0], journal });
    await depositPersonaKelChain(twice, [localPersonaKelDropHerm(first)]);
    lines.push({ name: nameAt(DROP_GATES[0], twice[2]!.eventCid), deposit: dep(twice[2]!, junkRotationOf(twice[2]!, 7)) });
    const restarted = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0], journal });
    expect(restarted.pull(nameAt(DROP_GATES[0], twice[0]!.eventCid)).map((e) => e.eventCid)).toEqual([twice[1]!.eventCid]);
    expect(restarted.pull(nameAt(DROP_GATES[0], twice[1]!.eventCid)).map((e) => e.eventCid)).toEqual([twice[2]!.eventCid]);
    expect(restarted.pull(nameAt(DROP_GATES[0], twice[2]!.eventCid)), "the planted line").toEqual([]);
    expect(lines).toHaveLength(2);
  });
});

describe("persona-kel-drop — the leaf's side: the reader folds and verifies every quorum", () => {
  /** A herm that serves exactly `values` under every name. */
  const serving = (gatePubKey: string, values: readonly unknown[]): PersonaKelDropHerm => ({
    gatePubKey, pull: async () => values, deposit: async () => {},
  });

  test("RED: a stripped or swapped successor is refused and named; CONTROL: the honest copy beside it extends the chain", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const forged = await rotatedKeeping([SEEDS.deviceX]);
    const stripped = { ...chain[1]!, enrolments: [] };
    const swapped = { ...forged[1]!, rotationSigs: [] };
    const hostile = serving(DROP_GATES[0], [stripped, swapped, "junk"]);
    const alone = await pullPersonaKelSuccessors([chain[0]!], [hostile]);
    expect(alone.kel.map((e) => e.eventCid)).toEqual([chain[0]!.eventCid]);
    expect(alone.refused).toHaveLength(3);
    expect(alone.refused.join("\n")).toMatch(/does not verify/);
    expect(alone.refused.join("\n")).toMatch(/read as no KEL event/);
    const store = makePersonaKelDropStore({ gatePubKey: DROP_GATES[1] });
    await depositPersonaKelChain(chain, [localPersonaKelDropHerm(store)]);
    const beside = await pullPersonaKelSuccessors([chain[0]!], [hostile, localPersonaKelDropHerm(store)]);
    expect(beside.kel.map((e) => e.eventCid)).toEqual(chain.map((e) => e.eventCid));
    expect(beside.refused.length).toBeGreaterThanOrEqual(2);
  });

  test("RED: an event filed under another predecessor's name is refused, never folded in", async () => {
    const twice = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX]);
    const misfiled = await pullPersonaKelSuccessors([twice[0]!], [serving(DROP_GATES[0], [twice[2]!])]);
    expect(misfiled.kel).toHaveLength(1);
    expect(misfiled.refused.join("\n")).toMatch(/predecessor is another/);
  });

  test("the reader walks several hops, and reads at most its cap from one herm under one name", async () => {
    const twice = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX]);
    const store = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    await depositPersonaKelChain(twice, [localPersonaKelDropHerm(store)]);
    const walked = await pullPersonaKelSuccessors([twice[0]!], [localPersonaKelDropHerm(store)]);
    expect(walked.kel.map((e) => e.eventCid)).toEqual(twice.map((e) => e.eventCid));
    expect(walked.refused).toEqual([]);
    const flood = Array.from({ length: PERSONA_KEL_DROP_READ_CAP + 10 }, (_, i) => `junk-${i}`);
    expect((await pullPersonaKelSuccessors([twice[0]!], [serving(DROP_GATES[1], flood)])).refused).toHaveLength(PERSONA_KEL_DROP_READ_CAP);
  });

  test("a veto a first pull missed folds over the provisional the leaf holds", async () => {
    const { inception, provisional, veto } = await provisionalKeeping([SEEDS.deviceX]);
    const store = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    store.deposit(nameAt(DROP_GATES[0], inception.eventCid), dep(inception, veto));
    const pulled = await pullPersonaKelSuccessors([inception, provisional], [localPersonaKelDropHerm(store)]);
    expect(pulled.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, veto.eventCid]);
    // CONTROL: with no veto in any drop, the provisional stays where the leaf holds it.
    const none = await pullPersonaKelSuccessors([inception, provisional], [localPersonaKelDropHerm(makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] }))]);
    expect(none.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, provisional.eventCid]);
  });

  test("RED (M1): two quorum-signed successors at one seat surface as a fork, whichever herm answers first", async () => {
    const b = await rotatedTo(SEEDS.opB, [SEEDS.deviceX]);
    const c = await rotatedTo(SEEDS.opC, [SEEDS.deviceX]);
    const inception = b[0]!;
    const mk = (ev: PersonaKelEvent, g: string): PersonaKelDropHerm => {
      const st = makePersonaKelDropStore({ gatePubKey: g });
      expect(st.deposit(nameAt(g, inception.eventCid), dep(inception, ev))).toBe(true);
      return localPersonaKelDropHerm(st);
    };
    const h1 = mk(b[1]!, DROP_GATES[0]), h2 = mk(c[1]!, DROP_GATES[1]);
    const p12 = await pullPersonaKelSuccessors([inception], [h1, h2]);
    const p21 = await pullPersonaKelSuccessors([inception], [h2, h1]);
    for (const p of [p12, p21]) {
      expect(p.kel.map((e) => e.eventCid), "the lineage stops before the fork").toEqual([inception.eventCid]);
      expect(p.fork?.seq).toBe(1);
      expect(p.fork?.events.map((e) => e.eventCid).sort()).toEqual([b[1]!.eventCid, c[1]!.eventCid].sort());
    }
    expect(await headOpKey(p12.kel)).toBe(await headOpKey(p21.kel));
    // CONTROL: one herm alone serves one successor, and the lineage extends with no fork.
    const alone = await pullPersonaKelSuccessors([inception], [h1]);
    expect(alone.fork).toBeNull();
    expect(alone.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, b[1]!.eventCid]);
  });

  test("RED (H): a herm that answers nothing is named and asked nothing more; the pull proceeds on the others", async () => {
    const twice = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX]);
    const store = makePersonaKelDropStore({ gatePubKey: DROP_GATES[1] });
    await depositPersonaKelChain(twice, [localPersonaKelDropHerm(store)]);
    let asked = 0;
    const hung: PersonaKelDropHerm = {
      gatePubKey: DROP_GATES[0],
      pull: async () => { asked++; throw new Error("unanswered"); },
      deposit: async () => { throw new Error("unanswered"); },
    };
    for (const herms of [[hung, localPersonaKelDropHerm(store)], [localPersonaKelDropHerm(store), hung]]) {
      asked = 0;
      const pulled = await pullPersonaKelSuccessors([twice[0]!], herms);
      expect(pulled.kel.map((e) => e.eventCid)).toEqual(twice.map((e) => e.eventCid));
      expect(pulled.unanswered).toEqual([DROP_GATES[0]]);
      expect(asked, "a silent herm is asked once per pull").toBe(1);
      expect((await depositPersonaKelChain(twice, herms)).unanswered).toEqual([DROP_GATES[0]]);
    }
  });

  test("a deposit files every event past inception under its predecessor's name at every herm", async () => {
    const twice = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX]);
    const stores = DROP_GATES.map((gatePubKey) => makePersonaKelDropStore({ gatePubKey }));
    await depositPersonaKelChain(twice, stores.map(localPersonaKelDropHerm));
    for (const store of stores) {
      expect(store.pull(nameAt(store.gatePubKey, twice[0]!.eventCid)).map((e) => e.eventCid)).toEqual([twice[1]!.eventCid]);
      expect(store.pull(nameAt(store.gatePubKey, twice[1]!.eventCid)).map((e) => e.eventCid)).toEqual([twice[2]!.eventCid]);
      expect(store.pull(nameAt(store.gatePubKey, twice[2]!.eventCid))).toEqual([]);
    }
  });
});
