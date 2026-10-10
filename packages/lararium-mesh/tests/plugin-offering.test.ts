/**
 * THE OFFERING — one operator publishing their own collection, and why it needs no second hand.
 *
 * `pluginsCid` folds THIS operator's collection. Publishing it is a GIFT: a taker verifies the blobs BY
 * HASH against the declared region, so nothing stands for a co-signer to attest that the hash does not
 * already settle. One signature, one announce, no steward set (operator ruling).
 *
 * That reasoning only holds if the verify ACTUALLY RECOMPUTES the region. A verify that checked the
 * signature alone would let a signed offering declare one region and carry another's blobs — the offeror
 * attesting bytes nobody folded, which is exactly the second-hand problem the hash was supposed to retire.
 *
 * R2a extends the signed preimage with PUBLISHER PROVENANCE (source, immutable commit, artifact path,
 * licence, author-as-claim, dependent pairing, supported runtimes) and makes verify name each distinct
 * failure by CODE, not just free text.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { computePluginsCid } from "../src/genesis-doc.js";
import {
  pluginOfferingBytes, pluginOfferingCid, signPluginOffering, verifyPluginOffering,
  type OfferedBlob, type PluginProvenance,
} from "../src/plugin-offering.js";
import { PLUGIN_OFFERING_DOMAIN } from "../src/domains.js";

const SEED = new Uint8Array(32).fill(21);
const signer = async (bytes: Uint8Array): Promise<string> => hex(await ed.signAsync(bytes, SEED));
const offerorKey = async (): Promise<string> => hex(await ed.getPublicKeyAsync(SEED));

const BLOBS: readonly OfferedBlob[] = [
  { id: "$:/plugins/sq/streams", version: "1.2.0", sha256: "aa".repeat(32) },
  { id: "$:/plugins/joe/notes",  version: "0.4.1", sha256: "bb".repeat(32) },
];

async function offer(blobs: readonly OfferedBlob[]) {
  return signPluginOffering(
    { offeror: await offerorKey(), pluginsCid: computePluginsCid(blobs), blobs }, signer);
}

describe("a plugin offering", () => {
  test("the complete signed record has a deterministic content CID", async () => {
    const offering = await offer(BLOBS);
    const reordered = await offer([...BLOBS].reverse());
    expect(pluginOfferingCid(offering)).toBe(pluginOfferingCid({ ...offering }));
    expect(pluginOfferingCid(reordered)).toBe(pluginOfferingCid(offering));
    expect(pluginOfferingCid({ ...offering, sig: "00".repeat(64) })).not.toBe(pluginOfferingCid(offering));
  });
  test("★ a taker VERIFIES the blobs against the declared region — the hash is what a co-signer would have attested ★", async () => {
    const offering = await offer(BLOBS);
    expect(offering.kind).toBe(PLUGIN_OFFERING_DOMAIN);
    await expect(verifyPluginOffering(offering)).resolves.toEqual({ ok: true });
  });

  test("★ a SIGNED offering whose blobs fold elsewhere REFUSES as fold-mismatch — the signature never stands in for the fold ★", async () => {
    const honest = await offer(BLOBS);
    // The offeror swaps one blob AFTER declaring the region, then re-signs: a perfectly valid signature
    // over a body whose blobs no longer fold to what it declares.
    const swapped = [{ ...BLOBS[0]!, sha256: "cc".repeat(32) }, BLOBS[1]!];
    const forged = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: honest.pluginsCid, blobs: swapped }, signer);
    const verdict = await verifyPluginOffering(forged);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.code).toBe("fold-mismatch");
    expect(verdict.reason).toMatch(/region|fold|cid/i);
  });

  test("a TAMPERED signature refuses as bad-signature, and the bytes are what got signed", async () => {
    const offering = await offer(BLOBS);
    const tampered = { ...offering, sig: "00".repeat(64) };
    const verdict = await verifyPluginOffering(tampered);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("bad-signature");
    // CONTROL — the preimage covers the region AND the blobs, so neither moves unnoticed.
    const a = pluginOfferingBytes({ offeror: offering.offeror, pluginsCid: offering.pluginsCid, blobs: BLOBS });
    const b = pluginOfferingBytes({ offeror: offering.offeror, pluginsCid: "bafyOTHER", blobs: BLOBS });
    expect(hex(a)).not.toBe(hex(b));
  });

  test("★ a malformed digest is refused, by code malformed, before it can describe a collection ★", async () => {
    const bad = [{ ...BLOBS[0]!, sha256: "not-a-digest" }];
    const malformed = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(bad), blobs: bad }, signer);
    await expect(verifyPluginOffering(malformed)).resolves.toEqual({ ok: false, code: "malformed", reason: "malformed plugin offering" });
  });

  test("★ duplicate blob IDs within one offering refuse, by code duplicate-plugin, before they make the region fold order-sensitive ★", async () => {
    const duplicate = [BLOBS[0]!, { ...BLOBS[1]!, id: BLOBS[0]!.id, sha256: "cc".repeat(32) }];
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(duplicate), blobs: duplicate }, signer);
    const verdict = await verifyPluginOffering(offering);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("duplicate-plugin");
  });

  test("★ an offering names ONE offeror and carries ONE signature — a gift, never a quorum act ★", async () => {
    const offering = await offer(BLOBS);
    // The shape itself refuses a steward set: there is no field for one, and adding a second hand would
    // make a gift into a collective act.
    expect(Object.keys(offering).sort()).toEqual(["blobs", "kind", "offeror", "pluginsCid", "sig"]);
  });

  test("CONTROL — an EMPTY collection still offers honestly (an operator may publish nothing)", async () => {
    const offering = await offer([]);
    await expect(verifyPluginOffering(offering)).resolves.toEqual({ ok: true });
  });
});

/**
 * ★ R2a — PUBLISHER PROVENANCE inside the signed preimage. ★
 */
describe("★ publisher provenance ★", () => {
  const PROV: PluginProvenance = {
    source: "https://github.com/tiddlywiki/tiddlywiki5",
    commit: "23859c84a",
    path: "plugins/tiddlywiki/highlight",
    licence: "BSD-3-Clause",
    author: "Jeremy Ruston",
  };
  const PROVENANCE_BLOBS: readonly OfferedBlob[] = [
    { id: "$:/plugins/tiddlywiki/highlight", version: "0.9.0", sha256: "dd".repeat(32), provenance: PROV },
  ];

  test("a provenance-bearing offering verifies, and the claim rides the SIGNED bytes", async () => {
    const offering = await offer(PROVENANCE_BLOBS);
    await expect(verifyPluginOffering(offering)).resolves.toEqual({ ok: true });
    const bare = await offer([{ ...PROVENANCE_BLOBS[0]!, provenance: undefined } as unknown as OfferedBlob]);
    expect(hex(pluginOfferingBytes(offering))).not.toBe(hex(pluginOfferingBytes(bare)));
  });

  test("★ MUTATION PROOF — tampering the provenance block after signing moves the preimage, so a stale signature refuses as bad-signature ★", async () => {
    const offering = await offer(PROVENANCE_BLOBS);
    const tampered = {
      ...offering,
      blobs: [{ ...PROVENANCE_BLOBS[0]!, provenance: { ...PROV, commit: "evil-commit" } }],
    };
    const verdict = await verifyPluginOffering(tampered);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("bad-signature");
  });

  test("authorship rides as a CLAIM, never a second signature — the shape carries no author-signature field", () => {
    expect(Object.keys(PROV).sort()).toEqual(["author", "commit", "licence", "path", "source"]);
  });

  test("★ a malformed provenance block (empty commit) refuses by code malformed-provenance ★", async () => {
    const broken = [{ ...PROVENANCE_BLOBS[0]!, provenance: { ...PROV, commit: "" } }];
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(broken), blobs: broken }, signer);
    const verdict = await verifyPluginOffering(offering);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("malformed-provenance");
  });

  test("★ a declared licence that isn't an SPDX-shaped token refuses by code malformed-provenance ★", async () => {
    const broken = [{ ...PROVENANCE_BLOBS[0]!, provenance: { ...PROV, licence: "whatever you want lol" } }];
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(broken), blobs: broken }, signer);
    const verdict = await verifyPluginOffering(offering);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("malformed-provenance");
  });

  test("CONTROL — a provenance block with no author claim still verifies (authorship is optional)", async () => {
    const noAuthor = [{ ...PROVENANCE_BLOBS[0]!, provenance: { ...PROV, author: undefined } }];
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid(noAuthor), blobs: noAuthor }, signer);
    await expect(verifyPluginOffering(offering)).resolves.toEqual({ ok: true });
  });
});

/**
 * ★ R2a — complete-pairs dependents ("offered only as complete pairs": dynannotate+dynaview etc). ★
 */
describe("★ dependent pairing ★", () => {
  test("CONTROL — a pair offered whole, with its dependent present, verifies", async () => {
    const a: OfferedBlob = { id: "$:/plugins/tiddlywiki/dynannotate", version: "0.1.0", sha256: "ee".repeat(32),
      provenance: { source: "s", commit: "c", path: "p", licence: "MIT", dependents: ["$:/plugins/tiddlywiki/dynaview"] } };
    const b: OfferedBlob = { id: "$:/plugins/tiddlywiki/dynaview", version: "0.1.0", sha256: "ff".repeat(32),
      provenance: { source: "s", commit: "c", path: "p", licence: "MIT" } };
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid([a, b]), blobs: [a, b] }, signer);
    await expect(verifyPluginOffering(offering)).resolves.toEqual({ ok: true });
  });

  test("★ a half-pair (dependent declared but absent) refuses by code unmet-dependents ★", async () => {
    const a: OfferedBlob = { id: "$:/plugins/tiddlywiki/dynannotate", version: "0.1.0", sha256: "ee".repeat(32),
      provenance: { source: "s", commit: "c", path: "p", licence: "MIT", dependents: ["$:/plugins/tiddlywiki/dynaview"] } };
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid([a]), blobs: [a] }, signer);
    const verdict = await verifyPluginOffering(offering);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.code).toBe("unmet-dependents");
      expect(verdict.reason).toMatch(/dynaview/);
    }
  });
});

/**
 * ★ R2a — unsupported runtime refuses by name, never silently passes an opaque tag through. ★
 */
describe("★ runtime tagging ★", () => {
  test("CONTROL — a node-only blob verifies when it names a recognised runtime", async () => {
    const blob: OfferedBlob = { id: "$:/plugins/tiddlywiki/filesystem", version: "0.1.0", sha256: "11".repeat(32),
      provenance: { source: "s", commit: "c", path: "p", licence: "BSD-3-Clause", runtimes: ["node"] } };
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid([blob]), blobs: [blob] }, signer);
    await expect(verifyPluginOffering(offering)).resolves.toEqual({ ok: true });
  });

  test("★ an unrecognised runtime tag refuses by code unsupported-runtime ★", async () => {
    const blob: OfferedBlob = { id: "$:/plugins/tiddlywiki/filesystem", version: "0.1.0", sha256: "11".repeat(32),
      provenance: { source: "s", commit: "c", path: "p", licence: "BSD-3-Clause", runtimes: ["deno" as never] } };
    const offering = await signPluginOffering(
      { offeror: await offerorKey(), pluginsCid: computePluginsCid([blob]), blobs: [blob] }, signer);
    const verdict = await verifyPluginOffering(offering);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("unsupported-runtime");
  });
});
