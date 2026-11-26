/**
 * vessel-lock-names — THE FOUR WEB LOCK NAMES STAND PINNED (the Pono Browser, wave W2; story T-X3).
 *
 * A tab on one build and a tab on another exclude each other from one store only while both ask the SAME lock names. A
 * renamed lock lets two generations open one store, and no hello ever crosses between them to refuse it. So each name
 * stands here as its bytes: a rename moves this file in the same change, where a reader sees it.
 *
 *   L1 RED      the store lock, the leader lock, the owner lock and the session lock read their pinned bytes for the default
 *               store and for another store's name.
 *   L2 CONTROL  the four names for one store differ from each other, and a second store shares none of them.
 */
import { expect, test } from "vitest";
import { vesselLeaderLockName, vesselLockName, vesselOwnerLockName, vesselSessionLockName } from "../src/vessel-lock.js";

test("L1 RED the four lock names read their pinned bytes", () => {
  expect(vesselLockName("lares:vessel")).toBe("lares:vessel:lares:vessel");
  expect(vesselLeaderLockName("lares:vessel")).toBe("lares:vessel:lares:vessel:leader");
  expect(vesselOwnerLockName("lares:vessel")).toBe("lares:vessel-owner:lares:vessel");
  expect(vesselSessionLockName("s1")).toBe("lares:vessel-session:s1");
  expect(vesselLockName("other")).toBe("lares:vessel:other");
  expect(vesselLeaderLockName("other")).toBe("lares:vessel:other:leader");
  expect(vesselOwnerLockName("other")).toBe("lares:vessel-owner:other");
});

test("L2 CONTROL one store's names differ from each other, and another store shares none", () => {
  const names = (store: string) => [vesselLockName(store), vesselLeaderLockName(store), vesselOwnerLockName(store), vesselSessionLockName(store)];
  expect(new Set(names("a")).size).toBe(4);
  expect(names("a").filter((name) => names("b").includes(name))).toEqual([]);
});
