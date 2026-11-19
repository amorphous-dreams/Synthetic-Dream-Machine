/**
 * THE UNBOUND INSTRUMENT READS A CAP'S UNPOINTED MINT.
 *
 * `unboundMints` once read binding mints alone, so a cap that minted a fresh document at every compose (the meshpalace
 * cap, 79 orphans in the operator's root store on 2026-11-19) printed `unbound documents: 0` over every one of them. A
 * compose mints nothing it cannot find again: a document a cap creates while it builds, and names under no pointer,
 * reads here as a `cap-mint`, so the next such leak reads non-zero.
 *
 * Controls: a cap that names its pointer reads bound; a create outside any compose stays this instrument's silence (a
 * verb's mint answers to its own rows). The cured meshpalace map, which creates nothing, reads zero in the mesh's own
 * suite (`meshpalace-mints-once`), where a real Repo stands.
 */
import { describe, expect, test } from "vitest";
import {
  DAEMON_BAG_ID, type CompositeStore, composeVessel,
  seatMintCensus, pointMint, capMintsUnpointed, type CapModule,
} from "@lararium/mesh";
import { unboundMints } from "../src/resolve-binding.js";

const noRows = { entries: async () => [] } as unknown as CompositeStore;

/** The Repo surface the census wraps: `create` mints a fresh, random address. */
function fakeRepo() {
  let n = 0;
  return { create: (_initial?: unknown) => ({ url: `automerge:minted-${++n}` }) };
}

describe("the unbound instrument reads a cap's unpointed mint", () => {
  test("a planted cap that creates a document under no pointer reads as one cap-mint", async () => {
    const repo = fakeRepo();
    seatMintCensus(repo);
    let planted = "";
    const leak: CapModule = { id: "planted-leak", requires: [], build: () => { planted = repo.create({ tiddlers: {} }).url; return {}; } };
    await composeVessel([leak]);
    expect(await unboundMints(noRows, capMintsUnpointed(repo))).toEqual([{ kind: "cap-mint", fingerprint: "planted-leak", url: planted }]);
  });

  test("CONTROL: a pointed create and a create outside any compose read zero", async () => {
    const repo = fakeRepo();
    seatMintCensus(repo);
    const pointed: CapModule = { id: "pointed", requires: [], build: () => { pointMint(repo.create({ tiddlers: {} }).url); return {}; } };
    await composeVessel([pointed]);
    repo.create({ tiddlers: {} });
    expect(await unboundMints(noRows, capMintsUnpointed(repo))).toEqual([]);
  });

  test("the binding mints still read as before, beside the cap mints", async () => {
    const rows = new Map([[`${DAEMON_BAG_ID}/x-minted/f/doc`, { tiddler: { title: "m", text: "automerge:loose", kind: "binding-mint", "binding-kind": "draft-binding", fingerprint: "f" } }]]);
    const store = { entries: async () => [...rows].map(([title, record]) => ({ title, record, bagId: DAEMON_BAG_ID })) } as unknown as CompositeStore;
    expect(await unboundMints(store)).toEqual([{ kind: "draft-binding", fingerprint: "f", url: "automerge:loose" }]);
  });
});
