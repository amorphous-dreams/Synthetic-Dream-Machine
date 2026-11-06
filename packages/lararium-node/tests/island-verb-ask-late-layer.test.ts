/**
 * island-verb-ask-late-layer — AN ASK PLACED BEFORE ITS WORKING LAYER MOUNTS READS THE OUTCOME THE LAYER BRINGS.
 *
 * The boot's own asks (the fold's `seat-duties`, the store and backup doors) can go out before the boot caller
 * mounts the host's daemon working layer, the document each outcome lands in. The ask checks once, then waits on the
 * composite's change events. A layer that arrives hands every title it already holds to the composite's
 * subscribers (`CompositeStore.addLayer`), so an outcome that landed while the layer stood unmounted still reaches
 * the ask. The full boot road stands in `tests/e2e/seat-settle-before-mount.test.ts`.
 *
 *   L1  an outcome written into the unmounted working document, then the mount: the ask answers it.
 *   L2  an error outcome the same way: the ask refuses by the island's name for it.
 *   L3  CONTROL: a mounted layer that holds no outcome leaves the ask waiting; only its abandon ends it.
 */
import { Repo } from "@automerge/automerge-repo";
import { describe, expect, test } from "vitest";
import { AutomergeDocStore, CompositeStore, DAEMON_BAG_ID, OUTCOME_URI_PREFIX, concludeVerb, emptyLarDoc, wikiSlotUri, type LarDoc } from "@lararium/mesh";
import { IslandAskAbandoned, IslandVerbRefused, askIslandVerb } from "../src/island-verb-ask.js";

const WORKING = wikiSlotUri("daemon", "working");

/** A daemon composite as openNodeVessel returns it (the daemon bag alone), and the island's working document beside it, unmounted. */
function unmounted() {
  const repo = new Repo({});
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()) as never, DAEMON_BAG_ID), writable: true, defaultWritable: false });
  const working = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), WORKING);
  let onPlace: (requestId: string) => void = () => {};
  const placed = new Promise<string>((resolve) => { onPlace = resolve; });
  const mount = (): void => { composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true }); working.markSyncComplete(); };
  const ask = (requestId: string) => askIslandVerb({ composite, placeVerb: (o) => onPlace(o.requestId), verb: "seat-duties", args: {}, requestedBy: "0xab", requestId });
  return { composite, working, placed, mount, ask };
}

describe("an ask placed before its working layer mounts", () => {
  test("L1 — a done outcome that landed while unmounted answers once the layer mounts", async () => {
    const s = unmounted();
    const ask = s.ask("late-1");
    expect(await s.placed).toBe("late-1");
    await s.working.put(concludeVerb({ requestId: "late-1", verb: "seat-duties", status: "done", cause: "test-island", batchMode: "best-effort", results: { summary: { ok: true, output: { ran: true } } } }), { kind: "lares-verb", requestId: "late-1" });
    // The window: the outcome stands in the working document, and the daemon composite reads none of it yet.
    expect(await s.composite.get(`${OUTCOME_URI_PREFIX}late-1`)).toBeNull();
    s.mount();
    await expect(ask.answer).resolves.toEqual({ ran: true });
  });

  test("L2 — an error outcome that landed while unmounted refuses by name once the layer mounts", async () => {
    const s = unmounted();
    const ask = s.ask("late-2");
    await s.placed;
    await s.working.put(concludeVerb({ requestId: "late-2", verb: "seat-duties", status: "error", cause: "test-island", batchMode: "best-effort", errorMessage: "the key shore stands shut", refusal: "shore-shut" }), { kind: "lares-verb", requestId: "late-2" });
    s.mount();
    const refused = await ask.answer.then(() => null, (err: unknown) => err);
    expect(refused).toBeInstanceOf(IslandVerbRefused);
    expect((refused as IslandVerbRefused).reason).toBe("shore-shut");
  });

  test("L3 — CONTROL: a mounted layer that holds no outcome leaves the ask waiting until it is abandoned", async () => {
    const s = unmounted();
    const ask = s.ask("late-3");
    await s.placed;
    s.mount();
    let settled = false;
    void ask.answer.then(() => { settled = true; }, () => { settled = true; });
    // A known positive on the same composite after the mount: once its outcome answers, the mount's replay and that
    // landing have both reached every subscriber, and the waiting ask read neither as its own.
    const probe = s.ask("late-3-probe");
    await s.working.put(concludeVerb({ requestId: "late-3-probe", verb: "seat-duties", status: "done", cause: "test-island", batchMode: "best-effort", results: { summary: { ok: true, output: { probe: true } } } }), { kind: "lares-verb", requestId: "late-3-probe" });
    await expect(probe.answer).resolves.toEqual({ probe: true });
    expect(settled).toBe(false);
    ask.abandon();
    await expect(ask.answer).rejects.toBeInstanceOf(IslandAskAbandoned);
  });
});
