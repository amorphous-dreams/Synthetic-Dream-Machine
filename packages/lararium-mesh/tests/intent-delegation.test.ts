import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { INTENT_DELEGATION_DOMAIN, INTENT_ENTRY_DOMAIN } from "../src/domains.js";
import { argsWithinPolicy, validDelegationPolicy, verbInPrefix } from "../src/intent-delegation.js";
import { buildAgentIntent, buildDelegation, IntentRefusal } from "../src/intent-issue.js";
import { readIntentEntry, signIntentEntry } from "../src/intent-entry.js";
import { fixtureIntentVerbs } from "../src/intent-verbs.js";
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const policy = { kind: "closed-args" as const, args: { title: { type: "string" as const, oneOf: ["a", "b"] }, count: { type: "integer" as const, optional: true } } };
const bound = { until: { roster: "a".repeat(64) } };

describe("intent delegation image", () => {
  test("RED: wildcard prefixes and unknown policies read shape; CONTROL: a narrow grant reads under its own domain", async () => {
    const root = await who(1), agent = await who(2);
    for (const prefix of ["*", "MOVE/*", ""]) await expect(buildDelegation({ group: "face", signer: root, epoch: 0, agent: agent.key, prefix, policy, bound, nonce: "n" })).rejects.toMatchObject({ name: "delegation-shape" });
    for (const bad of [{ kind: "open", args: {} }, { ...policy, extra: true }, { kind: "closed-args", args: { title: { type: "string", oneOf: [1] } } }]) {
      expect(validDelegationPolicy(bad)).toBe(false);
      await expect(buildDelegation({ group: "face", signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy: bad as typeof policy, bound, nonce: "n" })).rejects.toMatchObject({ name: "delegation-shape" });
    }
    const grant = await buildDelegation({ group: "face", signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy, bound, nonce: "n" });
    expect(grant.body.kind).toBe(INTENT_DELEGATION_DOMAIN);
    expect(readIntentEntry(grant, { group: "face", authorize: () => true }).ok).toBe(true);
    expect(verbInPrefix("MOVE", "MOVE/child")).toBe(true);
    expect(verbInPrefix("MOVE", "MOVEMENT")).toBe(false);
  });

  test("RED: cross-domain bodies and wrong group refuse; CONTROL: ordinary plane entries retain their domain", async () => {
    const root = await who(1), agent = await who(2), grant = await buildDelegation({ group: "face", signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy, bound, nonce: "n" });
    const ordinary = await signIntentEntry({ group: "face", entry: "claim", refs: [], intent: "x" }, agent);
    expect(ordinary.body.kind).toBe(INTENT_ENTRY_DOMAIN);
    expect(readIntentEntry(grant, { group: "wrong", authorize: () => true })).toMatchObject({ ok: false, refusal: "group" });
    for (const [entry, wrong] of [[grant, INTENT_ENTRY_DOMAIN], [ordinary, INTENT_DELEGATION_DOMAIN]] as const) {
      expect(readIntentEntry({ ...entry, body: { ...entry.body, kind: wrong } }, { group: "face", authorize: () => true })).toMatchObject({ ok: false, refusal: "domain" });
    }
  });

  test("RED: changed args and widened verb refuse at issue; CONTROL: exact values issue", async () => {
    const root = await who(1), agent = await who(2), verbs = fixtureIntentVerbs({ MOVE: "per-device", "MOVE/child": "per-device", OTHER: "per-device" });
    const grant = await buildDelegation({ group: "face", signer: root, epoch: 0, agent: agent.key, prefix: "MOVE", policy, bound, nonce: "n" });
    const input = { group: "face", signer: agent, delegation: "", within: grant, verb: "MOVE", args: { title: "a" }, nonce: "n", audience: { mode: "every" as const }, verbs };
    const { intentEntryCid } = await import("../src/intent-entry.js");
    const ready = { ...input, delegation: intentEntryCid(grant) };
    for (const args of [{ title: "c" }, { title: "a", extra: true }, { title: "a", count: "1" }, { title: { nested: true } }]) {
      expect(argsWithinPolicy(policy, args)).toBe(false);
      await expect(buildAgentIntent({ ...ready, args })).rejects.toMatchObject({ name: "delegation-shape" });
    }
    await expect(buildAgentIntent({ ...ready, verb: "OTHER" })).rejects.toMatchObject({ name: "delegation-shape" });
    expect((await buildAgentIntent(ready)).body.delegation).toBe(ready.delegation);
    expect(IntentRefusal.name).toBe("IntentRefusal");
  });

  test("RED: prototype-sensitive argument names, odd integers and slash lookalikes refuse; CONTROL: a nested slash prefix and a plain argument pass", async () => {
    const root = await who(1), agent = await who(2);
    for (const name of ["__proto__", "constructor", "prototype"]) {
      expect(validDelegationPolicy({ kind: "closed-args", args: { [name]: { type: "string" } } })).toBe(false);
      expect(argsWithinPolicy(policy, JSON.parse(`{"${name}":"a","title":"a"}`))).toBe(false);
    }
    const counted = { kind: "closed-args" as const, args: { count: { type: "integer" as const } } };
    expect(argsWithinPolicy(counted, { count: 3 })).toBe(true);
    for (const bad of [-0, Number.NaN, Number.MAX_SAFE_INTEGER + 1, 1.5, [1], "1"]) expect(argsWithinPolicy(counted, { count: bad })).toBe(false);
    expect(argsWithinPolicy(counted, [])).toBe(false);
    expect(argsWithinPolicy(counted, Object.create({ count: 1 }))).toBe(false);
    for (const prefix of ["MOVE//x", "/MOVE", "MOVE/", "MOVE/*", "MOVE /x"]) await expect(buildDelegation({ group: "face", signer: root, epoch: 0, agent: agent.key, prefix, policy, bound, nonce: "n" })).rejects.toMatchObject({ name: "delegation-shape" });
    const nested = await buildDelegation({ group: "face", signer: root, epoch: 0, agent: agent.key, prefix: "MOVE/x", policy, bound, nonce: "n" });
    expect(readIntentEntry(nested, { group: "face", authorize: () => true }).ok).toBe(true);
    expect(verbInPrefix("MOVE/x", "MOVE/x")).toBe(true);
    expect(verbInPrefix("MOVE/x", "MOVE/x/y")).toBe(true);
    expect(verbInPrefix("MOVE/x", "MOVE/xy")).toBe(false);
    expect(verbInPrefix("MOVE/x", "MOVE")).toBe(false);
  });
});
