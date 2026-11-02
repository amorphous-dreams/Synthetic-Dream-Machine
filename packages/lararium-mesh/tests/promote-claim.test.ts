/**
 * promote-claim — the vessel's page-facing promote object offers reads freely and its actions ONCE, to the first claimant.
 *
 * The page realm shares a JS realm with mirror content. The object the vessel exposes carries `snapshot` and `subscribe` and a
 * `claim()` that hands the action api to the first caller alone (the panel, at mount); no later script reaches a commit, drop, keep,
 * raise or lower as a callable. Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { claimablePromoteApi } from "../src/promote-claim.js";

const actions = () => {
  const calls: string[] = [];
  const api = {
    snapshot: async () => ({ wikis: [] }), subscribe: (_fn: () => void) => () => {},
    commit: async (w: string, d: string) => { calls.push(`commit ${w} ${d}`); }, drop: async () => {}, orphan: async () => {}, raise: async () => {}, lower: async () => {},
  };
  return { api, calls };
};

describe("the claimable api", () => {
  test("RED: the public object carries no action; the first claim returns the actions and every later claim returns null; CONTROL: snapshot and subscribe stay readable", async () => {
    const { api, calls } = actions();
    const pub = claimablePromoteApi(api as never);
    expect(Object.keys(pub).sort()).toEqual(["claim", "snapshot", "subscribe"]);
    for (const name of ["commit", "drop", "orphan", "raise", "lower"]) expect((pub as unknown as Record<string, unknown>)[name], name).toBeUndefined();
    expect(await pub.snapshot()).toEqual({ wikis: [] });
    const mine = pub.claim();
    expect(mine).not.toBeNull();
    expect(pub.claim()).toBeNull();
    expect(pub.claim()).toBeNull();
    await mine!.commit("daemon", "d".repeat(64));
    expect(calls).toEqual([`commit daemon ${"d".repeat(64)}`]);
  });
});
