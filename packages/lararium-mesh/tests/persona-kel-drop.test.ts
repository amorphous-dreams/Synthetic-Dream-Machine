/**
 * persona-kel-drop.test — a herm keeps a PersonaGroup's KEL successors by content address and vouches for none of
 * them; the leaf's reader folds plural values and verifies every quorum itself.
 *
 * Proven, each red beside its control:
 *   · a drop's name binds the predecessor's cid and the herm's gate key under its own domain;
 *   · RED: the herm keeps only an event whose cid recomputes, whose enrolments match the digest that cid commits
 *     and whose predecessor the name commits — a stripped, re-addressed, re-cid'd or inception event is refused;
 *   · RED: the herm's write quota refuses past its bound, per name and in all;
 *   · a drop holds plural values: a provisional rotation and its veto share a predecessor, and both stay;
 *   · RED: the reader refuses a stripped or swapped successor and names it; CONTROL: the honest copy extends;
 *   · the reader walks several hops, and folds a veto a first pull missed over the provisional it holds;
 *   · a deposit files every event of a chain under its predecessor's name at every herm.
 */
import { describe, test, expect } from "vitest";
import { canonicalJsonBytes, hex } from "../src/crypto.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { PERSONA_KEL_DROP_DOMAIN } from "../src/domains.js";
import {
  personaKelDropName, makePersonaKelDropStore, localPersonaKelDropHerm, pullPersonaKelSuccessors, depositPersonaKelChain,
  PERSONA_KEL_DROP_READ_CAP, type PersonaKelDropHerm,
} from "../src/persona-kel-drop.js";
import { SEEDS, rotatedKeeping, rotatedTwice, provisionalKeeping, DROP_GATES } from "./fixtures/sibling-fleet.js";

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const nameAt = (gate: string, cid: string) => personaKelDropName(cid, gate);

describe("persona-kel-drop — the herm's side: availability by content address, never a vouch", () => {
  test("a drop's name binds the predecessor's cid and the herm's gate key under its own domain", () => {
    const name = personaKelDropName("pkel0-abc", DROP_GATES[0]);
    expect(name).toBe(hex(sha256(canonicalJsonBytes({ domain: PERSONA_KEL_DROP_DOMAIN, prev: "pkel0-abc", gate: DROP_GATES[0] }))));
    expect(personaKelDropName("pkel0-abc", DROP_GATES[1])).not.toBe(name);
    expect(personaKelDropName("pkel0-abd", DROP_GATES[0])).not.toBe(name);
  });

  test("RED: the herm keeps only a self-certifying successor filed under its predecessor's name; CONTROL: the lawful one stays", async () => {
    const chain = await rotatedKeeping([SEEDS.deviceX, SEEDS.deviceY]);
    const store = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    const name = nameAt(DROP_GATES[0], chain[0]!.eventCid);
    const rot = chain[1]!;
    expect(store.deposit(name, copy({ ...rot, enrolments: rot.enrolments!.slice(1) })), "a stripped enrolment list").toBe(false);
    expect(store.deposit(name, copy({ ...rot, eventCid: "pkel1-forged" })), "a cid that does not recompute").toBe(false);
    expect(store.deposit(nameAt(DROP_GATES[1], chain[0]!.eventCid), copy(rot)), "another herm's name").toBe(false);
    expect(store.deposit(nameAt(DROP_GATES[0], rot.eventCid), copy(rot)), "the name of another predecessor").toBe(false);
    expect(store.deposit(name, copy(chain[0]!)), "an inception, which succeeds nothing").toBe(false);
    expect(store.deposit(name, "junk"), "bytes that read as no event").toBe(false);
    expect(store.pull(name)).toEqual([]);
    expect(store.deposit(name, copy(rot))).toBe(true);
    expect(store.deposit(name, copy(rot)), "the same bytes again hold").toBe(true);
    expect(store.pull(name).map((e) => e.eventCid)).toEqual([rot.eventCid]);
  });

  test("RED: the write quota refuses past its bound, per name and in all", async () => {
    const chain = await rotatedTwice([SEEDS.deviceX], [SEEDS.deviceX]);
    const perName = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0], quota: { perName: 1 } });
    const name = nameAt(DROP_GATES[0], chain[0]!.eventCid);
    expect(perName.deposit(name, copy(chain[1]!))).toBe(true);
    expect(perName.deposit(name, copy({ ...chain[1]!, rotationSigs: chain[1]!.rotationSigs.slice(0, 1) }))).toBe(false);
    const inAll = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0], quota: { values: 1 } });
    expect(inAll.deposit(name, copy(chain[1]!))).toBe(true);
    expect(inAll.deposit(nameAt(DROP_GATES[0], chain[1]!.eventCid), copy(chain[2]!))).toBe(false);
    // CONTROL: the default quota keeps both.
    const roomy = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    expect(roomy.deposit(name, copy(chain[1]!)) && roomy.deposit(nameAt(DROP_GATES[0], chain[1]!.eventCid), copy(chain[2]!))).toBe(true);
  });

  test("a drop holds plural values: a provisional rotation and its veto share a predecessor, and both stay", async () => {
    const { inception, provisional, veto } = await provisionalKeeping([SEEDS.deviceX]);
    const store = makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] });
    const name = nameAt(DROP_GATES[0], inception.eventCid);
    expect(store.deposit(name, copy(provisional)) && store.deposit(name, copy(veto))).toBe(true);
    expect(store.pull(name).map((e) => e.eventCid).sort()).toEqual([provisional.eventCid, veto.eventCid].sort());
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
    store.deposit(nameAt(DROP_GATES[0], inception.eventCid), copy(veto));
    const pulled = await pullPersonaKelSuccessors([inception, provisional], [localPersonaKelDropHerm(store)]);
    expect(pulled.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, veto.eventCid]);
    // CONTROL: with no veto in any drop, the provisional stays where the leaf holds it.
    const none = await pullPersonaKelSuccessors([inception, provisional], [localPersonaKelDropHerm(makePersonaKelDropStore({ gatePubKey: DROP_GATES[0] }))]);
    expect(none.kel.map((e) => e.eventCid)).toEqual([inception.eventCid, provisional.eventCid]);
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
