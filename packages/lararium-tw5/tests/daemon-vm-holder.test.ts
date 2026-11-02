/**
 * daemon-vm-holder — ONE indirection holds the daemon VM, so an in-process re-open reaches every consumer.
 *
 * `holdDaemonVm({ vm, reopen })` returns `{ vm, restart(reason), restarts }`. `vm` stands as a `DaemonVmCore` facade that
 * the vessel hands to every consumer ONCE; `restart` rejects every call still pending with `daemon-restarting` (a call never stalls it), shuts the old VM down, asks
 * `reopen(reason)` for a fresh VM (which re-resolves its boot inputs itself), replays the registrations the consumers
 * made (verbs, camera and residency doors, lit faces) onto it, and swaps. A call that arrives mid-swap refuses by name
 * (`daemon-restarting`) and never hangs; a failed re-open leaves the facade refusing `daemon-down` until a later
 * restart recovers. Scripted fake VMs stand in for islands: every assertion reads what crossed, never a clock.
 * Each test ships a CONTROL beside it, so the instrument is proven able to read red.
 */
import { describe, expect, test } from "vitest";
import type { DaemonVmCore } from "../src/daemon-vm-core.js";
import { holdDaemonVm } from "../src/daemon-vm-holder.js";

const log: string[] = [];
let live = 0;
let serial = 0;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

interface Fake extends DaemonVmCore {
  readonly id: number;
  readonly calls: string[];
  readonly downs: number;
  readonly registered: string[];
  pluginCids: readonly string[];
  gate: { promise: Promise<unknown>; resolve: (v: unknown) => void } | null;
}

function fakeVm(pluginCids: readonly string[] = []): Fake {
  const id = ++serial;
  live += 1;
  let downs = 0;
  const calls: string[] = [];
  const registered: string[] = [];
  const self = {
    id, calls, registered, pluginCids, gate: null as Fake["gate"],
    get downs() { return downs; },
    daemonHandle: { id } as never,
    composite: { id } as never,
    worker: { id } as never,
    workerEa: Promise.resolve(),
    mountHostWorkingLayer: async () => { calls.push("mountHostWorkingLayer"); },
    syncLegReady: async () => `leg-${id}`,
    mountMainVerbs: () => { registered.push("mountMainVerbs"); },
    placeVerb: (o: { verb: string }) => { calls.push(`placeVerb:${o.verb}`); },
    retireAsk: (r: string) => { calls.push(`retireAsk:${r}`); },
    runAsFace: async (o: { verb: string }) => { calls.push(`runAsFace:${o.verb}`); return { vm: id }; },
    lightFace: async (e: { atom: { key: string } }) => { registered.push(`lightFace:${e.atom.key}`); },
    dropFace: async (k: string) => { registered.push(`dropFace:${k}`); },
    placeTelemetry: () => { calls.push("placeTelemetry"); },
    placeStructurepalaceKapae: () => { calls.push("kapae"); },
    worldlineCompare: async () => { calls.push("worldlineCompare"); return { order: `vm${id}` }; },
    worldlineTrajectory: async () => ({ trajectory: id }) as never,
    resolveBinding: async () => {
      calls.push("resolveBinding:start");
      if (self.gate) await self.gate.promise;
      calls.push("resolveBinding:end"); log.push(`vm${id}:resolveBinding:end`);
      return { personalUrl: `p${id}`, draftUrl: `d${id}`, workingUrl: `w${id}` };
    },
    shutdown: async () => { downs += 1; live -= 1; log.push(`vm${id}:shutdown`); return { acked: true }; },
    dispose: () => { downs += 1; live -= 1; },
    onEvictRequest: () => { registered.push("onEvictRequest"); },
    onResidencyOp: () => { registered.push("onResidencyOp"); },
    onWikiAlert: () => { registered.push("onWikiAlert"); },
    onFrame: () => { registered.push("onFrame"); },
    onControlResult: () => { registered.push("onControlResult"); },
    sendControlEvent: () => { calls.push("sendControlEvent"); },
    resend: () => { calls.push("resend"); },
    onVerbEvent: () => { registered.push("onVerbEvent"); },
  };
  return self as unknown as Fake;
}

const entry = (key: string) => ({ atom: { key } }) as never;

describe("the holder routes every consumer to the NEW daemon VM", () => {
  test("after a restart each call class reaches the new VM; a planted stale capture reads red", async () => {
    const first = fakeVm();
    const next = fakeVm();
    const held = holdDaemonVm({ vm: first, reopen: async () => next });
    const staleCapture = first;                       // CONTROL: a consumer that kept the raw VM
    const facade = held.vm;
    const placeVerb = facade.placeVerb;               // a destructured method must survive the swap
    await held.restart("kapae-raise");
    placeVerb({ origin: "channel", verb: "open-wiki", args: {} } as never);
    facade.retireAsk("r1");
    expect(await facade.runAsFace({ verb: "v", args: {}, worn: {} as never })).toEqual({ vm: next.id });
    expect((await facade.worldlineCompare({ a: "a", b: "b", opens: [] })).order).toBe(`vm${next.id}`);
    expect(await facade.syncLegReady()).toBe(`leg-${next.id}`);
    expect((await facade.resolveBinding("f", { wikiDocId: "w", libraryBagDocIds: [] }, "s")).personalUrl).toBe(`p${next.id}`);
    expect(facade.daemonHandle).toBe(next.daemonHandle);
    expect(facade.composite).toBe(next.composite);
    expect(facade.worker).toBe(next.worker);
    expect(next.calls).toEqual(expect.arrayContaining(["placeVerb:open-wiki", "retireAsk:r1", "runAsFace:v", "worldlineCompare"]));
    expect(first.calls).toEqual([]);                  // nothing landed on the disposed VM
    // CONTROL: the raw capture still answers from the old VM, so the instrument reads a stale capture as red.
    expect(await staleCapture.syncLegReady()).toBe(`leg-${first.id}`);
    expect(await staleCapture.syncLegReady()).not.toBe(await facade.syncLegReady());
  });

  test("workerEa reads the new VM's promise after the swap", async () => {
    const first = fakeVm();
    const next = fakeVm();
    const gate = deferred<void>();
    (next as { workerEa: Promise<void> }).workerEa = gate.promise;
    const held = holdDaemonVm({ vm: first, reopen: async () => next });
    expect(held.vm.workerEa).toBe(first.workerEa);
    await held.restart("r");
    expect(held.vm.workerEa).toBe(gate.promise);
  });
});

describe("a restart never waits on a call in flight: it rejects the pending call by name", () => {
  test("a call that never settles on the old VM rejects daemon-restarting, the restart completes, the new VM answers", async () => {
    log.length = 0;
    const first = fakeVm();
    const next = fakeVm();
    first.gate = deferred<unknown>();               // never resolved by this test: the call stands forever
    const held = holdDaemonVm({ vm: first, reopen: async () => { log.push("reopen"); return next; } });
    const done = await held.vm.syncLegReady();       // a call that COMPLETED before the restart keeps its result
    const stuck = held.vm.resolveBinding("f", { wikiDocId: "w", libraryBagDocIds: [] }, "s");
    const stuckOutcome = stuck.then(() => "resolved", (e: Error) => e.message);
    const restarting = held.restart("kapae-raise");
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).toThrow(/daemon-restarting/);
    await expect(held.vm.runAsFace({ verb: "x", args: {}, worn: {} as never })).rejects.toThrow(/daemon-restarting/);
    await restarting;                                 // completes with the stuck call still standing on the old VM
    expect(await stuckOutcome).toBe("daemon-restarting");
    expect(done).toBe(`leg-${first.id}`);
    expect(log).toEqual([`vm${first.id}:shutdown`, "reopen"]);
    expect(await held.vm.runAsFace({ verb: "y", args: {}, worn: {} as never })).toEqual({ vm: next.id });
    // The old VM's late answer lands on nothing: the settled promise holds and the new VM carries no trace of it.
    first.gate.resolve(undefined);
    await Promise.resolve();
    expect(await stuckOutcome).toBe("daemon-restarting");
    expect(next.calls).toEqual(["runAsFace:y"]);
  });

  test("a call that rejected mid-swap records no lit face on the new VM", async () => {
    const first = fakeVm();
    const next = fakeVm();
    const gate = deferred<void>();
    (first as { lightFace: Fake["lightFace"] }).lightFace = async () => { await gate.promise; };
    const held = holdDaemonVm({ vm: first, reopen: async () => next });
    const lighting = held.vm.lightFace(entry("late")).catch((e: Error) => e.message);
    await held.restart("r");
    gate.resolve();
    expect(await lighting).toBe("daemon-restarting");
    expect(next.registered).toEqual([]);
  });

  test("CONTROL: with no restart standing, the same calls are not refused", async () => {
    const first = fakeVm();
    const held = holdDaemonVm({ vm: first, reopen: async () => fakeVm() });
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).not.toThrow();
    await expect(held.vm.runAsFace({ verb: "x", args: {}, worn: {} as never })).resolves.toEqual({ vm: first.id });
  });

  test("a failed re-open leaves the facade refusing daemon-down, and a later restart recovers", async () => {
    const first = fakeVm();
    const next = fakeVm();
    let attempt = 0;
    const held = holdDaemonVm({ vm: first, reopen: async () => { attempt += 1; if (attempt === 1) throw new Error("boot refused"); return next; } });
    await expect(held.restart("r")).rejects.toThrow(/boot refused/);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).toThrow(/daemon-down/);
    await expect(held.vm.syncLegReady()).rejects.toThrow(/daemon-down/);
    await held.restart("r2");
    expect(await held.vm.syncLegReady()).toBe(`leg-${next.id}`);
  });

  test("overlapping restarts coalesce into one re-open", async () => {
    const first = fakeVm();
    let opens = 0;
    const held = holdDaemonVm({ vm: first, reopen: async () => { opens += 1; return fakeVm(); } });
    const [a, b] = await Promise.all([held.restart("a"), held.restart("b")]);
    expect(opens).toBe(1);
    expect(a).toEqual(b);
    expect(held.restarts).toBe(1);
  });
});

describe("the consumers' registrations replay onto the new VM", () => {
  test("verbs, camera, residency doors and lit faces replay in order; a dropped face does not", async () => {
    const first = fakeVm();
    const next = fakeVm();
    const held = holdDaemonVm({ vm: first, reopen: async () => next });
    held.vm.mountMainVerbs({} as never);
    held.vm.onEvictRequest(async () => undefined);
    held.vm.onResidencyOp(async () => undefined);
    held.vm.onWikiAlert(() => undefined);
    held.vm.onFrame(() => undefined);
    held.vm.onControlResult(() => undefined);
    held.vm.onVerbEvent(() => undefined);
    await held.vm.lightFace(entry("a1"));
    await held.vm.lightFace(entry("a2"));
    await held.vm.dropFace("a1");
    await held.restart("r");
    expect(next.registered).toEqual([
      "mountMainVerbs", "onEvictRequest", "onResidencyOp", "onWikiAlert", "onFrame", "onControlResult", "onVerbEvent", "lightFace:a2",
    ]);
    // CONTROL: the first VM saw its registrations live, including the dropped face, so the replay above filtered it.
    expect(first.registered).toContain("lightFace:a1");
    expect(first.registered).toContain("dropFace:a1");
  });

  test("a re-open that re-resolves its boot inputs loads an added plugin CID and drops a removed one", async () => {
    let cids = ["cid-a", "cid-b"];
    const reasons: string[] = [];
    const first = fakeVm([...cids]);
    const held = holdDaemonVm({ vm: first, reopen: async (reason) => { reasons.push(reason); return fakeVm([...cids]); } });
    cids = ["cid-a", "cid-b", "cid-c"];
    await held.restart("kapae-add");
    expect((held.vm as unknown as Fake).pluginCids).toEqual(["cid-a", "cid-b", "cid-c"]);
    cids = ["cid-a", "cid-c"];
    await held.restart("kapae-remove");
    expect((held.vm as unknown as Fake).pluginCids).toEqual(["cid-a", "cid-c"]);
    expect(reasons).toEqual(["kapae-add", "kapae-remove"]);
    expect(first.pluginCids).toEqual(["cid-a", "cid-b"]);   // CONTROL: the first VM kept the inputs it booted with
  });
});

describe("the restart loop leaves no leak", () => {
  test("25 restarts in a row: one live VM, every old one shut down exactly once", async () => {
    live = 0;
    const all: Fake[] = [];
    const make = () => { const vm = fakeVm(); all.push(vm); return vm; };
    const held = holdDaemonVm({ vm: make(), reopen: async () => make() });
    for (let i = 0; i < 25; i += 1) await held.restart(`loop-${i}`);
    expect(held.restarts).toBe(25);
    expect(all).toHaveLength(26);
    expect(live).toBe(1);
    expect(all.slice(0, 25).every((vm) => vm.downs === 1)).toBe(true);
    expect(all[25]!.downs).toBe(0);
    await held.vm.shutdown();
    expect(live).toBe(0);
  });

  test("CONTROL: the live counter reads a leak when a VM opens and nothing shuts the old one", () => {
    live = 0;
    fakeVm(); fakeVm();
    expect(live).toBe(2);
  });
});
