/**
 * keyslot-opener — an open names WHICH of the presented credentials opened the slot, so a caller acts on the proved route alone.
 *
 * `gatherCredentials` hands a door several credentials at once (a typo, then the right passphrase); a caller that seats anything
 * under "the first passphrase" would seat under the typo. The open reports the credentials whose pins yielded the shares.
 *
 *   KO1  RED: a typo then the right passphrase opens, and the opener names the right one's index alone. CONTROL: the tree opens.
 *   KO2  RED: a 2-of-2 slot (passphrase and paper) names both indexes; a stray passphrase beside them stays out.
 */
import { describe, expect, test, vi } from "vitest";
import { bindSlot, confirmPaperPin, draftPaperPin, nobleKdf, openTreeKey } from "../src/keyslot.js";
import { mintTreeKey } from "../src/tree-key.js";

vi.setConfig({ testTimeout: 120_000 });

describe("the open names its opener", () => {
  test("KO1 RED: a typo and the right passphrase: the opener names the right one", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [{ kind: "passphrase", passphrase: "the right words" }] }, nobleKdf);
    const u = await openTreeKey(tree, [{ kind: "passphrase", passphrase: "the rigth words" }, { kind: "passphrase", passphrase: "the right words" }], nobleKdf);
    expect(u.reading, "CONTROL: the tree opens").toBe("opens");
    expect((u as { opener?: readonly number[] }).opener).toEqual([1]);
  });

  test("KO2 RED: a 2-of-2 slot names both pins' credentials, and a stray passphrase stays out", async () => {
    const draft = draftPaperPin();
    const confirmed = confirmPaperPin(draft, draft.sheets);
    const tree = await bindSlot(null, mintTreeKey(), { t: 2, pins: [{ kind: "passphrase", passphrase: "half a route" }, { kind: "paper", confirmed }] }, nobleKdf);
    const u = await openTreeKey(tree, [{ kind: "passphrase", passphrase: "a stray" }, { kind: "paper", sheets: draft.sheets }, { kind: "passphrase", passphrase: "half a route" }], nobleKdf);
    expect(u.reading).toBe("opens");
    expect([...((u as { opener?: readonly number[] }).opener ?? [])].sort()).toEqual([1, 2]);
  });
});
