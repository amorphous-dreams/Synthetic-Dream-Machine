/**
 * ONE DID SPELLING — a wiki's draft FLOOR doc keys under `wikis/<slug>/drafts/<did>`, and the vessel
 * mints `<did>` from its verifying key through the one law (`didFromVerifyingKey`: "0x" + the bare
 * 32-byte hex). A second spelling forks the key: the resolver reads one doc, a stray writer another.
 *
 * The gate: `wikiDraftDocKey` admits the one spelling and refuses every other — a `did:web:` stub, a
 * bare verifying key — so no host can key a floor under a spelling the others cannot find.
 */
import { describe, test, expect } from "vitest";
import { didFromVerifyingKey, isLarDid, wikiDraftDocKey, wikiUri } from "../src/index.js";

const VERIFYING_KEY = "ab".repeat(32);

describe("★ the vessel DID carries ONE spelling across every host ★", () => {
  test("the minter and the shape law agree; the floor key derives from the minter alone", () => {
    const did = didFromVerifyingKey(VERIFYING_KEY);
    expect(did).toBe(`0x${VERIFYING_KEY}`);
    expect(isLarDid(did)).toBe(true);
    expect(wikiDraftDocKey("garden", did)).toBe(`${wikiUri("garden")}/drafts/${encodeURIComponent(did)}`);
  });

  test("★ a second spelling refuses loud: a did:web stub, a bare key, an uppercase hex ★", () => {
    for (const stray of ["did:web:elyncia.app/vessels/host%3Agarden", VERIFYING_KEY, `0x${VERIFYING_KEY.toUpperCase()}`, "0xdid", ""]) {
      expect(isLarDid(stray), stray).toBe(false);
      expect(() => wikiDraftDocKey("garden", stray), stray).toThrow(/one spelling|0x/);
    }
  });
});
