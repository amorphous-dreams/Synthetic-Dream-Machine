/**
 * realm-standing-doc-url — a vessel's own catalog names the doc a realm's standing registration keeps for a bag, and only
 * while the vessel stands in that realm: the realm id, the pinned realm-doc pointer and the folded verdict all read.
 */
import { describe, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { LARES_DOC_URI, LARARIUM_DOC_URI } from "../src/lar-uris.js";
import { REALM_ID_TIDDLER, realmDocPointer, realmDocUrl, realmStandingDocUrl, realmStandingPointer, REALM_BAG_DOMAIN } from "../src/realm-bag.js";

const REALM = "ab".repeat(32);
const rec = (bagUri: string, docUrl: string) => ({ kind: REALM_BAG_DOMAIN, realmId: REALM, bagUri, docUrl, keptBy: ["cd".repeat(32)], readTier: "contract", signatures: [{ signer: "cd".repeat(32), sig: "00".repeat(64) }] });

function catalog(opts: { pin?: boolean; id?: boolean; standing?: boolean } = {}): LarDoc {
  const doc = emptyLarDoc();
  const put = (k: string, text: string) => { doc.tiddlers[k] = storedLarRecord(k, { text }, "test") as never; };
  if (opts.id !== false) put(REALM_ID_TIDDLER, REALM);
  if (opts.pin !== false) put(realmDocPointer(REALM), realmDocUrl(REALM));
  if (opts.standing !== false) put(realmStandingPointer(REALM), JSON.stringify([rec(LARES_DOC_URI, "automerge:lares-live")]));
  return doc;
}

describe("realmStandingDocUrl", () => {
  test("names the doc a standing registration keeps for a bag the realm carries", () => {
    expect(realmStandingDocUrl(catalog(), LARES_DOC_URI)).toBe("automerge:lares-live");
  });
  test("CONTROLS: a bag no registration keeps, a vessel with no realm id, no pinned realm doc, no verdict, and no catalog read none", () => {
    expect(realmStandingDocUrl(catalog(), LARARIUM_DOC_URI)).toBeNull();
    expect(realmStandingDocUrl(catalog({ id: false }), LARES_DOC_URI)).toBeNull();
    expect(realmStandingDocUrl(catalog({ pin: false }), LARES_DOC_URI)).toBeNull();
    expect(realmStandingDocUrl(catalog({ standing: false }), LARES_DOC_URI)).toBeNull();
    expect(realmStandingDocUrl(undefined, LARES_DOC_URI)).toBeNull();
  });
});
