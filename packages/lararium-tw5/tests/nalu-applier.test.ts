import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { IslandAdaptor, LandingDoorOccupiedError } from "../src/island-adaptor.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";

describe.skipIf(wikiSkip)(`nalu applier surface${skipNote}`, () => {
  test("400 shore landings leave no timer armed", async () => {
    const engine = await bootTestWiki();
    const wiki = engine.$tw.wiki as unknown as { getTiddler(title: string): unknown };
    const bag = "lar:///ha.ka.ba/wikis/nalu-applier/working";
    const memory = new MemoryTiddlerStore(bag);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: bag, store: memory, writable: true });
    const adaptor = new IslandAdaptor(engine, composite as never, "nalu-applier");
    // The shore's own yield is a microtask here, so every timer the process arms in this stretch is the applier's.
    adaptor.installLandingQueue(async () => {});
    adaptor.start();
    // The engine runs inside TiddlyWiki's module sandbox, which holds the host's real timer functions, so the
    // witness counts the timers the process itself holds armed. That sandbox holds no frame function under
    // Node (a frame request planted in the applier reaches no host stub), so a timer is the one way the
    // applier could defer work here.
    const armedTimers = (): number => process.getActiveResourcesInfo().filter((resource) => resource === "Timeout").length;
    const origin = { kind: "crdt-remote", edgeIsland: "nalu-applier-peer" } as const;
    const before = armedTimers();
    for (let i = 0; i < 400; i++) {
      const title = `nalu/applier/${i}`;
      await memory.put({ tiddler: { title, text: `value-${i}` } }, origin);
    }
    await adaptor.landingIdle();
    const after = armedTimers();
    expect(Array.from({ length: 400 }, (_, i) => wiki.getTiddler(`nalu/applier/${i}`) !== undefined).filter(Boolean), "control: all 400 stand in the wiki").toHaveLength(400);
    expect(after - before, "landing 400 records armed a timer").toBe(0);
    await adaptor.stop();
  });

  test("one change applies synchronously with a scoped echo guard", async () => {
    const engine = await bootTestWiki();
    const lares = (engine.$tw as unknown as { lares: Record<string, unknown> }).lares;
    const apply = lares.applyNalu as (change: { title: string; bag: string; record: { tiddler: Record<string, string>; meta?: { deleted?: boolean } } | null }) => void;
    const wiki = engine.$tw.wiki as unknown as { addTiddler(tiddler: unknown): void; deleteTiddler(title: string): void; getTiddler(title: string): { fields: Record<string, unknown> } | undefined };
    const originalAdd = wiki.addTiddler.bind(wiki);
    const samples: boolean[] = [];
    wiki.addTiddler = (tiddler) => { samples.push((lares.isApplyingNalu as () => boolean)()); originalAdd(tiddler); };
    expect((lares.isApplyingNalu as () => boolean)()).toBe(false);
    apply({ title: "nalu/live", bag: "bag/live", record: { tiddler: { text: "landed" } } });
    expect(samples).toEqual([true]);
    expect((lares.isApplyingNalu as () => boolean)()).toBe(false);
    expect(wiki.getTiddler("nalu/live")?.fields["$origin-bag"]).toBe("bag/live");
    apply({ title: "nalu/live", bag: "bag/live", record: null });
    expect(wiki.getTiddler("nalu/live")).toBeUndefined();
    apply({ title: "nalu/tombstone", bag: "bag/live", record: { tiddler: { text: "stands first" } } });
    expect(wiki.getTiddler("nalu/tombstone")?.fields.text).toBe("stands first");
    apply({ title: "nalu/tombstone", bag: "bag/live", record: { tiddler: { title: "nalu/tombstone" }, meta: { deleted: true } } });
    expect(wiki.getTiddler("nalu/tombstone")).toBeUndefined();
    let throws = true;
    wiki.addTiddler = (tiddler) => { if (throws) { throws = false; throw new Error("apply fault"); } originalAdd(tiddler); };
    expect(() => apply({ title: "nalu/fault", bag: "bag/live", record: { tiddler: { text: "fault" } } })).toThrow("apply fault");
    expect((lares.isApplyingNalu as () => boolean)()).toBe(false);
    wiki.addTiddler = originalAdd;
  });

  test("an apply begun inside another leaves the outer apply's guard raised", async () => {
    const engine = await bootTestWiki();
    const lares = (engine.$tw as unknown as { lares: { applyNalu(change: unknown): void; isApplyingNalu(): boolean } }).lares;
    const wiki = engine.$tw.wiki as unknown as { addTiddler(tiddler: unknown): void; getTiddler(title: string): unknown };
    const originalAdd = wiki.addTiddler.bind(wiki);
    const afterInner: boolean[] = [];
    let nested = false;
    wiki.addTiddler = (tiddler) => {
      if (!nested) {
        nested = true;
        lares.applyNalu({ title: "nalu/inner", record: { tiddler: { text: "inner" } }, origin: { kind: "crdt-remote", edgeIsland: "peer" } });
        afterInner.push(lares.isApplyingNalu());
      }
      originalAdd(tiddler);
    };
    lares.applyNalu({ title: "nalu/outer", record: { tiddler: { text: "outer" } }, origin: { kind: "crdt-remote", edgeIsland: "peer" } });
    wiki.addTiddler = originalAdd;
    expect(afterInner, "the outer apply still runs after the inner one ends").toEqual([true]);
    expect(lares.isApplyingNalu()).toBe(false);
    expect([wiki.getTiddler("nalu/inner"), wiki.getTiddler("nalu/outer")].every((t) => t !== undefined)).toBe(true);
  });

  test("the engine exposes only the applier and echo guard before shore installation", async () => {
    const engine = await bootTestWiki();
    const lares = (engine.$tw as unknown as { lares: Record<string, unknown> }).lares;
    for (const name of ["flushNalu", "naluPending", "beginHydration", "whenSeedDrained", "enqueueNalu"]) {
      expect(lares[name], `${name} must not be an engine surface`).toBeUndefined();
    }
    expect(typeof lares.applyNalu).toBe("function");
    expect(typeof lares.isApplyingNalu).toBe("function");
  });

  test("stopping the shore removes its queue door", async () => {
    const engine = await bootTestWiki();
    const adaptor = new IslandAdaptor(engine, new MemoryTiddlerStore() as never, "nalu-applier");
    const lares = (engine.$tw as unknown as { lares: Record<string, unknown> }).lares;
    adaptor.installLandingQueue();
    expect(typeof lares.enqueueNalu).toBe("function");
    (lares.enqueueNalu as (change: unknown) => void)({
      title: "nalu/door-control", record: { tiddler: { title: "nalu/door-control", text: "queued" } },
      origin: { kind: "crdt-remote", edgeIsland: "nalu-applier-peer" },
    });
    await adaptor.armSeedCheckpoint();
    expect((engine.$tw.wiki as unknown as { getTiddler(title: string): unknown }).getTiddler("nalu/door-control")).toBeTruthy();
    await adaptor.stop();
    expect(lares.enqueueNalu).toBeUndefined();
  });

  test("one shore owns an engine's door: a second refuses by name, a stop leaves another's door standing, and a stopped shore installs again", async () => {
    const engine = await bootTestWiki();
    const lares = (engine.$tw as unknown as { lares: Record<string, unknown> }).lares;
    const wiki = engine.$tw.wiki as unknown as { getTiddler(title: string): unknown };
    const first = new IslandAdaptor(engine, new MemoryTiddlerStore() as never, "nalu-applier-first");
    const second = new IslandAdaptor(engine, new MemoryTiddlerStore() as never, "nalu-applier-second");
    first.installLandingQueue();
    const firstDoor = lares.enqueueNalu;
    expect(() => second.installLandingQueue()).toThrow(LandingDoorOccupiedError);
    await second.stop();
    expect(lares.enqueueNalu, "a shore that never held the door removed another's").toBe(firstDoor);
    await first.stop();
    expect(lares.enqueueNalu).toBeUndefined();
    // The stopped shore starts again: a fresh queue and its door, and a wave lands.
    first.installLandingQueue();
    expect(typeof lares.enqueueNalu).toBe("function");
    (lares.enqueueNalu as (change: unknown) => void)({
      title: "nalu/after-restart", record: { tiddler: { title: "nalu/after-restart", text: "landed" } },
      origin: { kind: "crdt-remote", edgeIsland: "nalu-applier-peer" },
    });
    await first.landingIdle();
    expect(wiki.getTiddler("nalu/after-restart")).toBeTruthy();
    await first.stop();
  });
});
