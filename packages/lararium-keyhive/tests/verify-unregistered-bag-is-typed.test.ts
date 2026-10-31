/**
 * The keyholder verifier refuses an unregistered bag by TYPE, carrying the bag uri: `{ ok: false, kind: "bag-not-registered", bagUrl }`.
 * The mount trigger in the verb dispatcher reads that type; a reader of the message text would mount on any denial that
 * happened to spell the words. CONTROL: a denial for another reason (a registered bag nobody granted) carries no such kind.
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventStore, KeyhiveProvider } from "../src/index.js";

const BAG = "lar:///porch5.typed/unregistered-bag";

describe("verify names an unregistered bag by type", () => {
  test("RED: an unregistered bag refuses with kind `bag-not-registered` and its uri", async () => {
    const provider = new KeyhiveProvider();
    await provider.init({ seed: new Uint8Array(32).fill(7), eventStore: new InMemoryEventStore() });
    const answer = await provider.verify({ bagUrl: BAG, presenter: "00".repeat(32), access: "read" });
    expect(answer.ok).toBe(false);
    expect(answer).toMatchObject({ kind: "bag-not-registered", bagUrl: BAG });
  });

  test("CONTROL: a bag that stands registered but grants this presenter nothing carries no such kind", async () => {
    const provider = new KeyhiveProvider();
    await provider.init({ seed: new Uint8Array(32).fill(8), eventStore: new InMemoryEventStore() });
    await provider.registerBag(BAG);
    const answer = await provider.verify({ bagUrl: BAG, presenter: "00".repeat(32), access: "read" });
    expect(answer.ok).toBe(false);
    expect(answer.kind).toBeUndefined();
  });
});
