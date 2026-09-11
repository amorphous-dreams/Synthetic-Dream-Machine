/**
 * ONE DID SPELLING — a wiki's draft doc keys under `wikis/<slug>/drafts/<did>`, and every host mints
 * `<did>` from the vessel's verifying key through the one law (`didFromVerifyingKey`: "0x" + the bare
 * 32-byte hex). A second spelling on any host forks the key: the mount reads one doc, the daemon's
 * writers put to another, and a `--recipe` placement fails loud with the keys it tried.
 *
 * The gate: `wikiDraftDocKey` admits the one spelling and refuses every other — a `did:web:` stub, a
 * bare verifying key — so no host can key a draft under a spelling the others cannot find.
 */
import { describe, test, expect } from "vitest";
import { didFromVerifyingKey, isLarDid, recipeHostFacets, wikiDraftDocKey, wikiUri } from "../src/index.js";

const VK = "ab".repeat(32);

describe("★ the vessel DID carries ONE spelling across every host ★", () => {
  test("the minter and the shape law agree; the draft key derives from the minter alone", () => {
    const did = didFromVerifyingKey(VK);
    expect(did).toBe(`0x${VK}`);
    expect(isLarDid(did)).toBe(true);
    // The two paths a host walks — the facets projection at mount, the draft-key writer at put — land
    // on ONE key for one verifying key.
    expect(recipeHostFacets("garden", did).draftOracleTitle).toBe(wikiDraftDocKey("garden", did));
    expect(wikiDraftDocKey("garden", did)).toBe(`${wikiUri("garden")}/drafts/${encodeURIComponent(did)}`);
  });

  test("★ a second spelling refuses loud: a did:web stub, a bare key, an uppercase hex ★", () => {
    for (const stray of ["did:web:elyncia.app/vessels/host%3Agarden", VK, `0x${VK.toUpperCase()}`, "0xdid", ""]) {
      expect(isLarDid(stray), stray).toBe(false);
      expect(() => wikiDraftDocKey("garden", stray), stray).toThrow(/one spelling|0x/);
      expect(() => recipeHostFacets("garden", stray), stray).toThrow(/one spelling|0x/);
    }
  });
});
