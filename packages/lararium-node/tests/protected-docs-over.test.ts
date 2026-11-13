/**
 * protected-docs-over — the readings the one share guard takes for the vessel's protected documents, built from the Kahu
 * canon holder and the vessel-private book (T22, test-recut-road, wave 0; defence in depth).
 *
 * The composer stands the Kahu holder late, in `systemCanon`; until then its cell reads null. The guard read that null as
 * "nothing classed, nothing incomplete", so it withheld nothing from a wire peer. Only the build order (gates stand at
 * `afterDaemon`, after `systemCanon`) kept a peer out of that window, so no boot reaches it today: this red has no runtime
 * twin, and the pure builder carries the law instead.
 *   · RED: an unstood holder reads INCOMPLETE, so the guard withholds every document from every wire peer;
 *   · CONTROL: a stood holder reads its own ids, its own pending and incomplete state, the vessel-private ids beneath;
 *   · a torn vessel-private book reads incomplete whatever the holder says.
 */
import { describe, expect, test } from "vitest";
import { protectedDocsOver } from "../src/kahu-realm.js";

type Holder = Parameters<typeof protectedDocsOver>[0] extends () => infer H ? NonNullable<H> : never;
const holderOf = (ids: string[], state: { pending?: boolean; incomplete?: boolean } = {}): Holder => ({
  ids: () => new Map(ids.map((id) => [id, "kahu-canon" as const])),
  settled: () => Promise.resolve(),
  pending: () => state.pending === true,
  incomplete: () => state.incomplete === true,
});
const book = (ids: string[], torn = false) => ({ ids: () => new Set(ids), torn: () => torn });

describe("the protected readings over a holder that may not stand yet", () => {
  test("RED: an unstood Kahu holder reads incomplete, so every document withholds", () => {
    const over = protectedDocsOver(() => null, book([]));
    expect(over.incomplete()).toBe(true);
    expect(over.pending()).toBe(false);
    expect(over.ids().size).toBe(0);
  });

  test("CONTROL: a stood holder reads its own ids over the vessel-private ones, and its own state", async () => {
    let holder: Holder | null = null;
    const over = protectedDocsOver(() => holder, book(["priv-1"]));
    holder = holderOf(["kahu-1"]);
    expect(over.incomplete()).toBe(false);
    expect([...over.ids()]).toEqual([["priv-1", "vessel-private"], ["kahu-1", "kahu-canon"]]);
    await over.settled();
    holder = holderOf(["kahu-1"], { pending: true, incomplete: true });
    expect(over.pending()).toBe(true);
    expect(over.incomplete()).toBe(true);
  });

  test("a torn vessel-private book reads incomplete under a whole holder", () => {
    expect(protectedDocsOver(() => holderOf([]), book([], true)).incomplete()).toBe(true);
  });
});
