/**
 * promote-claim-order — the page claims the promote actions BEFORE any glass mirror mounts or any page-realm TW5 boots.
 *
 * Only mirror-rendered TW5 content and promoted modules run in the page realm beside `main.ts`; a claim taken before the first
 * mirror mount leaves every later script with null. An ordering weld over the leader path of `main.ts`. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import mainSource from "../src/main.ts?raw";
import { claimablePromoteApi } from "../../lararium-mesh/src/promote-claim.js";

describe("the claim comes first", () => {
  test("RED: main.ts claims the promote api once, after the vessel returns and before the first mirror mount or topology serve; CONTROL: the claim is taken exactly once in the source", () => {
    const claims = [...mainSource.matchAll(/promote\??\.claim\(\)/g)];
    expect(claims).toHaveLength(1);
    const at = claims[0]!.index!;
    const opened = mainSource.indexOf("await openBrowserVessel(");
    const firstMount = mainSource.search(/^\s*mirrorTrigger\(\);/m);
    const serve = mainSource.indexOf("topology?.serve(");
    expect(opened).toBeGreaterThan(-1);
    expect(firstMount).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(opened);
    expect(at).toBeLessThan(firstMount);
    expect(at).toBeLessThan(serve);
  });

  test("RED: a claim attempted by anyone after the panel's own claim gets null; CONTROL: the first claim holds the actions", () => {
    const api = { snapshot: async () => ({ wikis: [] }), subscribe: () => () => {}, commit: async () => {}, drop: async () => {}, orphan: async () => {}, raise: async () => {}, lower: async () => {} };
    const pub = claimablePromoteApi(api as never);
    expect(pub.claim()).not.toBeNull();
    expect(pub.claim()).toBeNull();
  });
});
