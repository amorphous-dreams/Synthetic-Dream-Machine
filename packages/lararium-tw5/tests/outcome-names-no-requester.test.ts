/**
 * K20: AN OUTCOME NAMES NO REQUESTER. The invocation carries who asked (it rests in the island's memory and leaves with
 * its verb); the outcome the daemon document keeps names the verb, its status and its result, never the presenter.
 * So the `realm-feed` outcome, which lands in the document whose slot write names the face's leaf, never names the
 * face's atom beside it, and no other outcome pairs a requester with what it answered. Nothing reads `requested-by`
 * off an outcome (`island-verb-ask.ts` outcomeOf, the UDS result reader and the dispatcher's dedup read status,
 * output, error, refusal and digest).
 */
import { expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, OUTCOME_URI_PREFIX, VERB_RESULT_KEY, type Verb } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { copyEffectOutcome, writeOutcome } from "../src/verb-vm.js";

const ATOM = `0x${"a7".repeat(32)}`;
const REALM = "c1ab".repeat(16);

function daemon(): CompositeStore {
  const d = new CompositeStore();
  d.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  return d;
}
const feed = (requestId: string): Verb => ({
  requestId, title: `lar:///lararium.local.vm/verbs/${requestId}`, action: "realm-feed", args: { realm: REALM }, targets: [],
  batchMode: "best-effort", status: "pending", requestedBy: ATOM, requestedAt: "2026-10-31T00:00:00Z",
} as unknown as Verb);

test("RED: the realm-feed outcome names no requester, and its bytes never carry the atom; CONTROL: it keeps its verb, status and result", async () => {
  const d = daemon();
  await writeOutcome(d, { invocation: feed("feed-1"), status: "done", result: { realm: REALM, fed: true } });
  const outcome = await d.getLive(`${OUTCOME_URI_PREFIX}feed-1`);
  expect(outcome, "the outcome landed").not.toBeNull();
  expect(Object.keys(outcome!.tiddler)).not.toContain("requested-by");
  expect(JSON.stringify(outcome!.tiddler)).not.toContain(ATOM.slice(2));
  expect(outcome!.tiddler["verb"]).toBe("realm-feed");
  expect(outcome!.tiddler["status"]).toBe("done");
  expect(JSON.parse(String(outcome!.tiddler["results"]))[VERB_RESULT_KEY]).toEqual({ ok: true, output: { realm: REALM, fed: true } });
});

test("RED: an error outcome and an effect copy name no requester either; CONTROL: each keeps its own status", async () => {
  const d = daemon();
  await writeOutcome(d, { invocation: feed("feed-2"), status: "error", errorMessage: "realm-feed-not-local" });
  const tw5 = { $tw: { wiki: { deleteTiddler: () => {} } } };
  await copyEffectOutcome(tw5 as never, d, feed("feed-3"), { priorRequestId: "feed-1", priorResults: { [VERB_RESULT_KEY]: { ok: true } }, inputDigest: "sha256:00" });
  for (const id of ["feed-2", "feed-3"]) {
    const outcome = await d.getLive(`${OUTCOME_URI_PREFIX}${id}`);
    expect(outcome, id).not.toBeNull();
    expect(Object.keys(outcome!.tiddler), id).not.toContain("requested-by");
    expect(JSON.stringify(outcome!.tiddler), id).not.toContain(ATOM.slice(2));
  }
  expect((await d.getLive(`${OUTCOME_URI_PREFIX}feed-2`))!.tiddler["status"]).toBe("error");
  expect((await d.getLive(`${OUTCOME_URI_PREFIX}feed-3`))!.tiddler["effect-of"]).toBe("feed-1");
});
