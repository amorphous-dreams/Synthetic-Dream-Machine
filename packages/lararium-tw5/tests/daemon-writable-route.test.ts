import { describe, expect, test } from "vitest";
import { wikiSlotUri } from "@lararium/mesh";
import { makeDaemonBehavior } from "../src/daemon-behavior.js";
import type { IslandContext } from "../src/island-context.js";

const pointer = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

describe("daemon writable marker", () => {
  test("waits for the working pointer before onEa", async () => {
    const working = wikiSlotUri("daemon", "working");
    let value = "";
    let listener: ((changes: Record<string, unknown>) => void) | undefined;
    let defaultBag = "";
    const ctx = {
      recipe: { wikiSlug: "daemon" },
      composite: { defaultWritableBagId: () => defaultBag, hasWritableBag: () => true },
      tw5: { $tw: { wiki: {
        getTiddlerText: () => value,
        addEventListener: (_: string, cb: typeof listener) => { listener = cb; },
        removeEventListener: () => { listener = undefined; },
      } } },
    } as unknown as IslandContext;
    const behavior = makeDaemonBehavior({ onWritable: async () => {
      defaultBag = working;
      return { state: "standing" };
    } });
    let settled = false;
    const standing = behavior.onWritable!(ctx).then((result) => { settled = true; return result; });
    await Promise.resolve();
    await Promise.resolve();
    expect(defaultBag).toBe(working);
    expect(settled).toBe(false);
    value = working;
    listener?.({ [pointer]: {} });
    await expect(standing).resolves.toEqual({ state: "standing" });
    expect(value).toBe(working);
  });
});
