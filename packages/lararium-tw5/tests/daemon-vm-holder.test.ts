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
    mountHostWorkingLayer: async () => { registered.push("mountHostWorkingLayer"); },
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

describe("prepare runs before anything is torn down", () => {
  test("the prepared boot inputs reach reopen, after prepare and after the old VM's shutdown", async () => {
    log.length = 0;
    const first = fakeVm();
    const next = fakeVm();
    const held = holdDaemonVm({
      vm: first,
      prepare: async (reason) => { log.push(`prepare:${reason}`); return { cids: ["c1"] }; },
      reopen: async (_reason, prepared) => { log.push(`reopen:${prepared.cids.join(",")}`); return next; },
    });
    await held.restart("kapae-raise");
    expect(log).toEqual(["prepare:kapae-raise", `vm${first.id}:shutdown`, "reopen:c1"]);
  });

  test("a prepare that refuses leaves the old VM standing, its pending call alive, and the facade ready", async () => {
    const first = fakeVm();
    const gate = deferred<unknown>();
    first.gate = gate;
    let reopened = 0;
    const held = holdDaemonVm({
      vm: first,
      prepare: async () => { throw new Error("plugin resolution refused"); },
      reopen: async () => { reopened += 1; return fakeVm(); },
    });
    const pending = held.vm.resolveBinding("f", { wikiDocId: "w", libraryBagDocIds: [] }, "s");
    await expect(held.restart("r")).rejects.toThrow(/plugin resolution refused/);
    expect(first.downs).toBe(0);
    expect(reopened).toBe(0);
    expect(held.restarts).toBe(0);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).not.toThrow();
    gate.resolve(undefined);
    expect((await pending).personalUrl).toBe(`p${first.id}`);   // the pending call was never rejected
    await held.restart("r2").catch(() => undefined);              // a later restart still tries (prepare refuses again)
    expect(first.downs).toBe(0);
  });
});

describe("an ask in flight settles by name when the island restarts (guardAsk)", () => {
  const ask = <T,>() => {
    const gate = deferred<T>();
    let abandoned = 0;
    return { gate, ask: { answer: gate.promise, abandon: () => { abandoned += 1; } }, abandoned: () => abandoned };
  };

  test("a pending ask rejects daemon-restarting, is abandoned once, and the restart never waits on it", async () => {
    const held = holdDaemonVm({ vm: fakeVm(), reopen: async () => fakeVm() });
    const a = ask<string>();
    const guarded = held.guardAsk(a.ask);
    const outcome = guarded.answer.then(() => "answered", (e: Error) => e.message);
    await held.restart("kapae-raise");
    expect(await outcome).toBe("daemon-restarting");
    expect(a.abandoned()).toBe(1);
    a.gate.resolve("late");                         // the old island's late answer lands on nothing
    await Promise.resolve();
    expect(await outcome).toBe("daemon-restarting");
  });

  test("an ask that answered before the restart keeps its answer and is never abandoned by it", async () => {
    const held = holdDaemonVm({ vm: fakeVm(), reopen: async () => fakeVm() });
    const a = ask<string>();
    const guarded = held.guardAsk(a.ask);
    a.gate.resolve("done");
    expect(await guarded.answer).toBe("done");
    await held.restart("r");
    expect(a.abandoned()).toBe(0);
  });

  test("the caller's own abandon forwards once and takes the ask out of the restart's reach", async () => {
    const held = holdDaemonVm({ vm: fakeVm(), reopen: async () => fakeVm() });
    const a = ask<string>();
    const guarded = held.guardAsk(a.ask);
    guarded.answer.catch(() => undefined);
    guarded.abandon();
    await held.restart("r");
    expect(a.abandoned()).toBe(1);
  });

  test("guarding an ask while the island restarts abandons it and refuses by name", async () => {
    const first = fakeVm();
    const reopened = deferred<DaemonVmCore>();
    const held = holdDaemonVm({ vm: first, reopen: () => reopened.promise });
    const restarting = held.restart("r");
    await Promise.resolve(); await Promise.resolve();
    const a = ask<string>();
    expect(() => held.guardAsk(a.ask)).toThrow(/daemon-restarting/);
    expect(a.abandoned()).toBe(1);
    reopened.resolve(fakeVm());
    await restarting;
  });

  test("CONTROL: an ask NOT guarded stays pending across the restart, so the hazard reads real", async () => {
    const held = holdDaemonVm({ vm: fakeVm(), reopen: async () => fakeVm() });
    const a = ask<string>();
    let settled = false;
    a.ask.answer.then(() => { settled = true; }, () => { settled = true; });
    await held.restart("r");
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(settled).toBe(false);
  });
});

describe("onRestarted runs after the swap, on success alone", () => {
  test("a listener fires once per completed restart with the new VM serving; unsubscribe stops it; a throwing listener never fails the restart", async () => {
    const first = fakeVm();
    const next = fakeVm();
    const held = holdDaemonVm({ vm: first, reopen: async () => next });
    const seen: Array<{ reason: string; restarts: number; leg: string }> = [];
    const off = held.onRestarted(async ({ reason, restarts }) => { seen.push({ reason, restarts, leg: await held.vm.syncLegReady() }); });
    held.onRestarted(() => { throw new Error("a listener fault"); });
    await expect(held.restart("kapae-raise")).resolves.toEqual({ restarts: 1 });
    expect(seen).toEqual([{ reason: "kapae-raise", restarts: 1, leg: `leg-${next.id}` }]);
    off();
    await held.restart("again");
    expect(seen).toHaveLength(1);
  });

  test("CONTROL: a refused prepare and a failed re-open fire no listener", async () => {
    let fired = 0;
    const refusing = holdDaemonVm({ vm: fakeVm(), prepare: async () => { throw new Error("no"); }, reopen: async () => fakeVm() });
    refusing.onRestarted(() => { fired += 1; });
    await expect(refusing.restart("r")).rejects.toThrow(/no/);
    const failing = holdDaemonVm({ vm: fakeVm(), reopen: async () => { throw new Error("boot refused"); } });
    failing.onRestarted(() => { fired += 1; });
    await expect(failing.restart("r")).rejects.toThrow(/boot refused/);
    expect(fired).toBe(0);
  });
});

describe("restart against a direct shutdown, and against a replay that throws (Luna 1, P1)", () => {
  test("a shutdown that starts while prepare awaits ends the restart by name: no replacement opens beside the closing island", async () => {
    const first = fakeVm();
    const prepared = deferred<void>();
    let reopened = 0;
    const held = holdDaemonVm({
      vm: first,
      prepare: async () => { await prepared.promise; },
      reopen: async () => { reopened += 1; return fakeVm(); },
    });
    const restarting = held.restart("r");
    const outcome = restarting.then(() => "restarted", (e: Error) => e.message);
    await Promise.resolve();
    await held.vm.shutdown();
    prepared.resolve();
    expect(await outcome).toBe("daemon-down");
    expect(reopened).toBe(0);
    expect(first.downs).toBe(1);
  });

  test("CONTROL: with no shutdown standing, the same prepare lets the restart re-open", async () => {
    const prepared = deferred<void>();
    let reopened = 0;
    const held = holdDaemonVm({ vm: fakeVm(), prepare: async () => { await prepared.promise; }, reopen: async () => { reopened += 1; return fakeVm(); } });
    const restarting = held.restart("r");
    prepared.resolve();
    await restarting;
    expect(reopened).toBe(1);
  });

  test("a replay that throws shuts the replacement down, leaves the facade down, and a later restart recovers without a leak", async () => {
    live = 0;
    const first = fakeVm();
    const broken = fakeVm();
    (broken as { onFrame: () => void }).onFrame = () => { throw new Error("replay refused"); };
    const third = fakeVm();
    let opens = 0;
    const held = holdDaemonVm({ vm: first, reopen: async () => (++opens === 1 ? broken : third) });
    held.vm.onFrame(() => undefined);
    await expect(held.restart("r")).rejects.toThrow(/replay refused/);
    expect(broken.downs).toBe(1);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).toThrow(/daemon-down/);
    expect(broken.downs).toBe(1);
    await held.restart("r2");
    expect(await held.vm.syncLegReady()).toBe(`leg-${third.id}`);
    expect(live).toBe(1);                           // only the recovered island stands
    held.vm.dispose();                              // disposal is final (Sol train #8): it closes the recovered island once
    held.vm.dispose();
    expect(third.downs).toBe(1);
    expect(live).toBe(0);
  });
});

describe("the host working layer mounts on every island (CI e2e: a read after the restart hung)", () => {
  test("mountHostWorkingLayer replays on the new VM before the facade turns ready; CONTROL: a facade that never mounted replays none", async () => {
    const first = fakeVm();
    const next = fakeVm();
    const held = holdDaemonVm({ vm: first, reopen: async () => next });
    await held.vm.mountHostWorkingLayer();
    await held.restart("r");
    expect(first.registered).toEqual(["mountHostWorkingLayer"]);
    expect(next.registered).toEqual(["mountHostWorkingLayer"]);
    const unmounted = fakeVm();
    const bare = holdDaemonVm({ vm: fakeVm(), reopen: async () => unmounted });
    await bare.restart("r");
    expect(unmounted.registered).toEqual([]);
  });

  test("a mount that throws on the new VM leaves the facade down and closes that VM", async () => {
    const first = fakeVm();
    const bad = fakeVm();
    (bad as { mountHostWorkingLayer: () => Promise<void> }).mountHostWorkingLayer = async () => { throw new Error("no working layer"); };
    const held = holdDaemonVm({ vm: first, reopen: async () => bad });
    await held.vm.mountHostWorkingLayer();
    await expect(held.restart("r")).rejects.toThrow(/no working layer/);
    expect(bad.downs).toBe(1);
  });
});

describe("the new island may be read for readiness while its registrations replay (local e2e: the rest door asked the facade mid-mount)", () => {
  test("syncLegReady answers from the new VM during replay; CONTROL: every other door still refuses daemon-restarting", async () => {
    const first = fakeVm();
    const next = fakeVm();
    let held!: ReturnType<typeof holdDaemonVm>;
    let during: { leg?: string; place?: string } = {};
    (next as { mountHostWorkingLayer: () => Promise<void> }).mountHostWorkingLayer = async () => {
      during.leg = await held.vm.syncLegReady();          // the vessel's rest door awaits the island's leg through the facade
      try { held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never); } catch (e) { during.place = (e as Error).message; }
    };
    held = holdDaemonVm({ vm: first, reopen: async () => next });
    await held.vm.mountHostWorkingLayer();
    await held.restart("r");
    expect(during.leg).toBe(`leg-${next.id}`);
    expect(during.place).toMatch(/daemon-restarting/);
  });
});

describe("the kapae arrival restart keeps the no-wait law (a promote act in flight waits in FRONT of the restart, never inside it)", () => {
  test("a call and an ask that never answer both reject daemon-restarting at once and the restart completes; CONTROL: the same pair, answered first, keeps its answers", async () => {
    const first = fakeVm(); first.gate = deferred<unknown>();
    const held = holdDaemonVm({ vm: first, reopen: async () => fakeVm() });
    const call = held.vm.resolveBinding("f", { wikiDocId: "w", libraryBagDocIds: [] }, "s").then(() => "resolved", (e: Error) => e.message);
    const gate = deferred<string>();
    const guarded = held.guardAsk({ answer: gate.promise, abandon: () => undefined });
    const ask = guarded.answer.then((v) => v, (e: Error) => e.message);
    await held.restart("kapae-raise");
    expect(await call).toBe("daemon-restarting");
    expect(await ask).toBe("daemon-restarting");
    expect(held.restarts).toBe(1);
    const second = fakeVm();
    const control = holdDaemonVm({ vm: second, reopen: async () => fakeVm() });
    const ok = control.guardAsk({ answer: Promise.resolve("kept"), abandon: () => undefined });
    expect(await ok.answer).toBe("kept");
    await control.restart("kapae-raise");
    expect(control.restarts).toBe(1);
  });
});

describe("Sol train read: dispose wins, an emergency fails closed, the node replays no face (#8, #5, #1)", () => {
  test("#8 dispose during prepare ends the restart by name: no replacement opens, the island closes once", async () => {
    const first = fakeVm();
    const prepared = deferred<void>();
    let reopened = 0;
    const held = holdDaemonVm({ vm: first, prepare: async () => { await prepared.promise; }, reopen: async () => { reopened += 1; return fakeVm(); } });
    const restarting = held.restart("r");
    const outcome = restarting.then(() => "restarted", (e: Error) => e.message);
    await Promise.resolve();
    held.vm.dispose();
    prepared.resolve();
    expect(await outcome).toBe("daemon-down");
    expect(reopened).toBe(0);
    expect(first.downs).toBe(1);
    await expect(held.restart("again")).rejects.toThrow(/daemon-down/);   // a disposed facade restarts no more
  });

  test("#8 dispose while the replacement opens closes that replacement and leaves the facade down", async () => {
    const first = fakeVm();
    const next = fakeVm();
    const opening = deferred<DaemonVmCore>();
    const held = holdDaemonVm({ vm: first, reopen: () => opening.promise });
    const restarting = held.restart("r");
    const outcome = restarting.then(() => "restarted", (e: Error) => e.message);
    await Promise.resolve(); await Promise.resolve();
    held.vm.dispose();
    opening.resolve(next);
    expect(await outcome).toBe("daemon-down");
    expect(next.downs).toBe(1);
    expect(first.downs).toBe(1);                    // the old island closed once, by the restart's own shutdown
  });

  test("#8 CONTROL: with no dispose standing the same restart opens its replacement", async () => {
    const next = fakeVm();
    const held = holdDaemonVm({ vm: fakeVm(), prepare: async () => undefined, reopen: async () => next });
    await held.restart("r");
    expect(next.downs).toBe(0);
  });

  test("#5 an emergency restart whose prepare refuses closes the old island and stands daemon-down: zero calls accepted", async () => {
    const first = fakeVm();
    const held = holdDaemonVm({
      vm: first,
      emergency: (reason) => reason.startsWith("kapae"),
      prepare: async () => { throw new Error("floor blob corrupt"); },
      reopen: async () => fakeVm(),
    });
    await expect(held.restart("kapae-raise")).rejects.toThrow(/floor blob corrupt/);
    expect(first.downs).toBe(1);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).toThrow(/daemon-down/);
    await expect(held.vm.runAsFace({ verb: "x", args: {}, worn: {} as never })).rejects.toThrow(/daemon-down/);
    expect(first.calls).toEqual([]);
  });

  test("#5 an emergency pending call settles by name; a later restart recovers once prepare answers", async () => {
    const first = fakeVm();
    const next = fakeVm();
    first.gate = deferred<unknown>();
    let refuse = true;
    const held = holdDaemonVm({
      vm: first, emergency: (r) => r.startsWith("kapae"),
      prepare: async () => { if (refuse) throw new Error("floor blob corrupt"); },
      reopen: async () => next,
    });
    const stuck = held.vm.resolveBinding("f", { wikiDocId: "w", libraryBagDocIds: [] }, "s").then(() => "resolved", (e: Error) => e.message);
    await expect(held.restart("kapae-raise")).rejects.toThrow(/floor blob corrupt/);
    expect(await stuck).toBe("daemon-restarting");
    refuse = false;
    await held.restart("kapae-raise");
    expect(await held.vm.syncLegReady()).toBe(`leg-${next.id}`);
  });

  test("#5 CONTROL: an ordinary restart whose prepare refuses keeps the old island ready", async () => {
    const first = fakeVm();
    const held = holdDaemonVm({
      vm: first, emergency: (r) => r.startsWith("kapae"),
      prepare: async () => { throw new Error("plugin resolution refused"); },
      reopen: async () => fakeVm(),
    });
    await expect(held.restart("operator")).rejects.toThrow(/plugin resolution refused/);
    expect(first.downs).toBe(0);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).not.toThrow();
  });

  test("#1 a holder told the manifest carries the faces replays none, and records none", async () => {
    const next = fakeVm();
    const held = holdDaemonVm({ vm: fakeVm(), faces: "manifest", reopen: async () => next });
    held.vm.onFrame(() => undefined);
    await held.vm.lightFace(entry("a1"));
    await held.restart("r");
    expect(next.registered).toEqual(["onFrame"]);
  });
});

describe("an emergency that cannot restart still fails closed through the host's own door (Sol train #7)", () => {
  test("failClosed replaces the shutdown on an emergency refusal: the host detaches, the holder stands daemon-down", async () => {
    const first = fakeVm();
    const closed: number[] = [];
    const held = holdDaemonVm({
      vm: first,
      emergency: (r) => r === "brake",
      failClosed: async (vm) => { closed.push((vm as Fake).id); },
      prepare: async () => { throw new Error("daemon-restart-shared-holder"); },
      reopen: async () => fakeVm(),
    });
    await expect(held.restart("brake")).rejects.toThrow(/daemon-restart-shared-holder/);
    expect(closed).toEqual([first.id]);
    expect(first.downs).toBe(0);                    // the shared island's own teardown never ran
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).toThrow(/daemon-down/);
  });

  test("CONTROL: an ordinary reason refuses by name and the tab stays ready, failClosed untouched", async () => {
    const closed: number[] = [];
    const held = holdDaemonVm({
      vm: fakeVm(), emergency: (r) => r === "brake", failClosed: async (vm) => { closed.push((vm as Fake).id); },
      prepare: async () => { throw new Error("daemon-restart-shared-holder"); }, reopen: async () => fakeVm(),
    });
    await expect(held.restart("operator")).rejects.toThrow(/daemon-restart-shared-holder/);
    expect(closed).toEqual([]);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).not.toThrow();
  });
});

describe("an emergency that overlaps an ordinary restart is never downgraded (Sol 2)", () => {
  const brake = (r: string) => r === "brake";

  test("an ordinary restart in prepare, an overlapping emergency, then a prepare refusal: the island closes and stands daemon-down, zero calls accepted", async () => {
    const first = fakeVm();
    const prepared = deferred<void>();
    const held = holdDaemonVm({
      vm: first, emergency: brake,
      prepare: async () => { await prepared.promise; throw new Error("floor blob corrupt"); },
      reopen: async () => fakeVm(),
    });
    const ordinary = held.restart("operator");
    const ordinaryOutcome = ordinary.then(() => "restarted", (e: Error) => e.message);
    await Promise.resolve();
    const emergency = held.restart("brake");           // joins the restart standing in prepare
    const emergencyOutcome = emergency.then(() => "restarted", (e: Error) => e.message);
    prepared.resolve();
    expect(await ordinaryOutcome).toMatch(/floor blob corrupt/);
    expect(await emergencyOutcome).toMatch(/floor blob corrupt/);
    expect(first.downs).toBe(1);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).toThrow(/daemon-down/);
    expect(first.calls).toEqual([]);
  });

  test("CONTROL: two ordinary restarts overlapping a refusing prepare leave the island ready", async () => {
    const first = fakeVm();
    const prepared = deferred<void>();
    const held = holdDaemonVm({ vm: first, emergency: brake, prepare: async () => { await prepared.promise; throw new Error("refused"); }, reopen: async () => fakeVm() });
    const a = held.restart("operator").catch(() => "x");
    await Promise.resolve();
    const b = held.restart("also-ordinary").catch(() => "x");
    prepared.resolve();
    await Promise.all([a, b]);
    expect(first.downs).toBe(0);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).not.toThrow();
  });

  test("an emergency that arrives after the standing restart passed prepare schedules one follow-up emergency restart, never dropped", async () => {
    const first = fakeVm();
    const second = fakeVm();
    const opening = deferred<DaemonVmCore>();
    const reasons: string[] = [];
    let opens = 0;
    const held = holdDaemonVm({
      vm: first, emergency: brake,
      prepare: async (reason) => { reasons.push(reason); if (reason === "brake") throw new Error("floor blob corrupt"); },
      reopen: () => (++opens === 1 ? opening.promise : Promise.resolve(fakeVm())),
    });
    const ordinary = held.restart("operator");
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const emergency = held.restart("brake");
    const emergencyOutcome = emergency.then(() => "restarted", (e: Error) => e.message);
    opening.resolve(second);
    await ordinary;                                   // the ordinary restart completes onto its replacement
    expect(await emergencyOutcome).toMatch(/floor blob corrupt/);
    expect(reasons).toEqual(["operator", "brake"]);   // the emergency ran its own prepare after the ordinary restart finished
    expect(second.downs).toBe(1);                      // fail closed on the replacement
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).toThrow(/daemon-down/);
  });

  test("CONTROL: an ordinary request after the standing restart passed prepare schedules nothing", async () => {
    const opening = deferred<DaemonVmCore>();
    const reasons: string[] = [];
    const held = holdDaemonVm({ vm: fakeVm(), emergency: brake, prepare: async (r) => { reasons.push(r); }, reopen: () => opening.promise });
    const a = held.restart("operator");
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const b = held.restart("again");
    opening.resolve(fakeVm());
    await Promise.all([a, b]);
    expect(reasons).toEqual(["operator"]);
  });
});

describe("an emergency that overlaps a SUCCEEDING prepare never lets pre-emergency inputs reopen (Sol 3)", () => {
  const brake = (r: string) => r === "brake";
  const selecting = () => {
    const all = ["a", "x"];
    let shadowed = new Set<string>();
    const gate = deferred<void>();
    const calls: Array<{ reason: string; picked: string[] }> = [];
    return {
      shadow: (cid: string) => { shadowed = new Set([...shadowed, cid]); },
      release: () => gate.resolve(),
      calls,
      prepare: async (reason: string) => {
        const picked = all.filter((c) => !shadowed.has(c));      // the selection is captured at the prepare's start
        calls.push({ reason, picked });
        await gate.promise;                                        // ...and the board/CAS awaits that follow
        return picked;
      },
    };
  };

  test("the emergency lands before prepare returns: prepare runs again under the emergency and the replacement excludes the shadowed digest", async () => {
    const sel = selecting();
    const opened: string[][] = [];
    const held = holdDaemonVm({
      vm: fakeVm(), emergency: brake, prepare: sel.prepare,
      reopen: async (_r, picked: string[]) => { opened.push(picked); return fakeVm(); },
    });
    const ordinary = held.restart("operator");
    await Promise.resolve();
    sel.shadow("x");                                  // the raise lands: x is shadowed now
    const emergency = held.restart("brake");           // joins the restart standing in prepare
    sel.release();
    await ordinary; await emergency;
    expect(opened).toEqual([["a"]]);                   // never the pre-emergency selection ["a","x"]
    expect(sel.calls.map((c) => c.reason)).toEqual(["operator", "brake"]);
  });

  test("the re-prepare under the emergency refuses: the island closes and stands daemon-down, nothing reopens", async () => {
    const first = fakeVm();
    const gate = deferred<void>();
    let n = 0;
    let reopened = 0;
    const held = holdDaemonVm({
      vm: first, emergency: brake,
      prepare: async () => { n += 1; await gate.promise; if (n === 2) throw new Error("floor blob corrupt"); return ["a", "x"]; },
      reopen: async () => { reopened += 1; return fakeVm(); },
    });
    const ordinary = held.restart("operator").catch((e: Error) => e.message);
    await Promise.resolve();
    const emergency = held.restart("brake").catch((e: Error) => e.message);
    gate.resolve();
    expect(await ordinary).toMatch(/floor blob corrupt/);
    expect(await emergency).toMatch(/floor blob corrupt/);
    expect(first.downs).toBe(1);
    expect(reopened).toBe(0);
    expect(() => held.vm.placeVerb({ origin: "channel", verb: "x", args: {} } as never)).toThrow(/daemon-down/);
  });

  test("CONTROL: with no emergency the one prepare's selection reopens, prepared once", async () => {
    const sel = selecting();
    const opened: string[][] = [];
    const held = holdDaemonVm({ vm: fakeVm(), emergency: brake, prepare: sel.prepare, reopen: async (_r, picked: string[]) => { opened.push(picked); return fakeVm(); } });
    const restarting = held.restart("operator");
    await Promise.resolve();
    sel.release();
    await restarting;
    expect(opened).toEqual([["a", "x"]]);
    expect(sel.calls).toHaveLength(1);
  });
});
