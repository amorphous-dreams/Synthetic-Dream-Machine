/**
 * highlight-offering.test.ts — the PoC signed offering (golden-path-p2-recipe.md OPERATOR RULING
 * 2026-10-10, R2c) actually verifies, and a recipe naming it selects EXACTLY its one blob — never
 * more, never less, and never when the recipe does not name it.
 *
 * `offering.json` is minted by `scripts/pack-highlight-offering.ts`, reproducibly, from the TW5
 * submodule's pinned commit. This test reads the committed artifact rather than re-running the pack
 * (packing shells out to the TW5 CLI; re-running it on every test run would make this suite as slow
 * and as network/toolchain-fragile as the pack step itself) — `pack-highlight-offering.test.ts`
 * covers reproducibility by re-running the script itself and diffing the bytes.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { verifyPluginOffering, pluginOfferingCid, selectPluginBlobs, selectedPluginCids, type PluginOffering } from "@lararium/mesh";

const OFFERING = new URL("./offering.json", import.meta.url);
const offering = JSON.parse(readFileSync(OFFERING, "utf8")) as PluginOffering;
const CID = pluginOfferingCid(offering);

describe("the highlight offering (R2c PoC)", () => {
  test("verifies: signature, fold, and shape all hold", async () => {
    const verdict = await verifyPluginOffering(offering);
    expect(verdict.ok).toBe(true);
  });

  test("CONTROL: a tampered licence claim moves the CID and breaks the signature", async () => {
    const tampered: PluginOffering = {
      ...offering,
      blobs: offering.blobs.map((b) => ({ ...b, provenance: { ...b.provenance!, licence: "MIT" } })),
    };
    const verdict = await verifyPluginOffering(tampered);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("bad-signature");
  });

  test("a recipe naming its CID selects exactly its one blob", async () => {
    const lookup = (cid: string) => (cid === CID ? offering : undefined);
    const verdict = await selectPluginBlobs([CID], lookup);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.blobs.map((b) => b.id)).toEqual(["$:/plugins/tiddlywiki/highlight"]);
      expect(selectedPluginCids(verdict.blobs)).toEqual([offering.blobs[0]!.sha256]);
    }
  });

  test("CONTROL: an empty recipe (never naming it) selects nothing", async () => {
    const lookup = () => undefined;
    const verdict = await selectPluginBlobs([], lookup);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.blobs).toEqual([]);
  });

  test("a recipe naming an unannounced CID refuses as unknown, never an empty success", async () => {
    const lookup = () => undefined;
    const verdict = await selectPluginBlobs(["sha256:not-announced-anywhere"], lookup);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.failure.code).toBe("unknown");
  });
});
