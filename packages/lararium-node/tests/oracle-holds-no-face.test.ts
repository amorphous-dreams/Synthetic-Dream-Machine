/**
 * oracle-holds-no-face — the shared oracle document names no face, no catalog and no plane of a person.
 * Reconciling writes the oracle's own url, the lares url and the daemon url, and nothing else; a second
 * call over the same values writes nothing.
 */
import { describe, test, expect } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  emptyLarDoc, tiddlerText, ORACLE_DOC_URI, LARES_DOC_URI, DAEMON_BAG_ID, CATALOG_DOC_URI,
  personaBagIdFor, personaSiblingBagIds, type LarDoc,
} from "@lararium/mesh";
import { reconcileWellKnownTiddlers } from "../src/genesis-artifact.js";

const G = "33".repeat(16);
const face = personaSiblingBagIds(personaBagIdFor(G));

const reconcile = (h: ReturnType<Repo["create"]>) =>
  (reconcileWellKnownTiddlers as unknown as (...a: unknown[]) => void)(h, "automerge:lares", "automerge:daemon");

describe("the oracle holds no face", () => {
  test("reconcile writes the lares url alone: no self pointer, no daemon, no face tag, no catalog", () => {
    const repo = new Repo({ network: [] });
    const h = repo.create<LarDoc>(emptyLarDoc());
    reconcile(h);
    const keys = Object.keys(h.doc()!.tiddlers);
    expect(keys).toEqual([LARES_DOC_URI]);
    expect(keys).not.toContain(DAEMON_BAG_ID);
    expect(keys).not.toContain(ORACLE_DOC_URI);
    for (const k of [face.identities, face.circles, face.sessions, CATALOG_DOC_URI]) expect(keys).not.toContain(k);
  });

  test("CONTROL: lares stands at its value, and a second call writes nothing", () => {
    const repo = new Repo({ network: [] });
    const h = repo.create<LarDoc>(emptyLarDoc());
    reconcile(h);
    expect(tiddlerText(h.doc()!.tiddlers[LARES_DOC_URI])).toBe("automerge:lares");
    const before = JSON.stringify(h.doc());
    reconcile(h);
    expect(JSON.stringify(h.doc())).toBe(before);
  });
});
