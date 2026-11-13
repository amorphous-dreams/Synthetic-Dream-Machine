import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { INTENT_ENTRY_DOMAIN, PERSONA_ACT_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { intentEntryRecordsOfGroup, intentId, readIntentEntry, signIntentEntry, writeIntentEntry } from "../src/intent-entry.js";

const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const doc = (): LarDoc => ({ tiddlers: {} } as LarDoc);

describe("intent entry image", () => {
  test("RED: domain, group, changed signed fields and unauthorized hand refuse; CONTROL: a stored entry round-trips", async () => {
    const a = await signer(1), b = await signer(2);
    const signed = await signIntentEntry({ group: "face", entry: "intent", refs: [], issuer: a.key, verb: "test", args: { x: 1 }, nonce: "", audience: { mode: "pinned", atom: a.key }, bound: { void: "edge" } }, a);
    const read = (raw: unknown, group = "face", authorized = true) => readIntentEntry(raw, { group, authorize: () => authorized });
    for (const field of ["args", "audience", "bound", "refs"] as const) {
      const mutated = { ...signed, body: { ...signed.body, [field]: field === "refs" ? ["new"] : field === "args" ? { x: 2 } : field === "bound" ? { void: "other" } : { mode: "pinned", atom: b.key } } };
      expect(read(mutated)).toEqual({ ok: false, refusal: "signature" });
    }
    expect(read({ ...signed, body: { ...signed.body, kind: PERSONA_ACT_DOMAIN } })).toEqual({ ok: false, refusal: "domain" });
    expect(read(signed, "other")).toEqual({ ok: false, refusal: "group" });
    expect(read(signed, "face", false)).toEqual({ ok: false, refusal: "unauthorized" });
    const plane = doc(); writeIntentEntry(plane, signed); writeIntentEntry(plane, signed);
    expect(intentEntryRecordsOfGroup(plane, "face")).toHaveLength(1);
    expect(read(intentEntryRecordsOfGroup(plane, "face")[0])).toMatchObject({ ok: true, entry: signed });
    expect(read({ ...signed, body: { kind: PERSONA_ACT_DOMAIN, group: "face", seq: 0, prior: null } })).toEqual({ ok: false, refusal: "domain" });
    expect(INTENT_ENTRY_DOMAIN).not.toBe(PERSONA_ACT_DOMAIN);
  });

  test("RED: replay preserves the four-field id; CONTROL: a new nonce moves it", async () => {
    const a = await signer(1);
    const parts = { issuer: a.key, verb: "test", args: { x: 1 }, nonce: "same" };
    expect(intentId(parts)).toBe(intentId({ ...parts }));
    expect(intentId(parts)).not.toBe(intentId({ ...parts, nonce: "fresh" }));
  });
});
