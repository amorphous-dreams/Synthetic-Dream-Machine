/**
 * A DEAD ENGINE NAMES ITSELF.
 *
 * On 2026-11-22 the daemon's shared Automerge wasm instance trapped (`RuntimeError: unreachable` out of `rust_oom`), the
 * binding marked itself terminated, and every later call threw `Module terminated`; upstream reports the same poisoned
 * instance as "recursive use of an object detected which would lead to unsafe aliasing in rust" (automerge #896). The watch
 * reads all three signatures as one fall, keeps the FIRST trap (a later error can mask it, automerge-repo #330), and names
 * the last wave that settled before it. Every error here comes injected: no wasm instance runs out of anything.
 */
import { describe, expect, test } from "vitest";
import { createEngineWatch, engineFatalCauseOf, engineTerminatedRefusal, ENGINE_HAND_ACT, ENGINE_TERMINATED, tapRepoLogs } from "../src/engine-watch.js";

/** A `WebAssembly.RuntimeError` as the trap raises it, without running any wasm. */
const trap = (): Error => new WebAssembly.RuntimeError("unreachable");

describe("engineFatalCauseOf — the three signatures of a dead engine", () => {
  test("Module terminated, a wasm unreachable trap, and the aliasing text each read fatal", () => {
    expect(engineFatalCauseOf(new Error("Module terminated"))).toBe("module-terminated");
    expect(engineFatalCauseOf(trap())).toBe("wasm-unreachable");
    expect(engineFatalCauseOf(new Error("recursive use of an object detected which would lead to unsafe aliasing in rust"))).toBe("unsafe-aliasing");
  });

  test("the signature reads through a wrapping error's cause", () => {
    expect(engineFatalCauseOf(new Error("flush failed", { cause: new Error("Module terminated") }))).toBe("module-terminated");
  });

  test("CONTROL: an ordinary fault, a plain Error that says unreachable, and a non-error read healthy", () => {
    expect(engineFatalCauseOf(new Error("ENOSPC: no space left on device"))).toBeNull();
    expect(engineFatalCauseOf(new Error("host unreachable"))).toBeNull();
    expect(engineFatalCauseOf("Module terminated, said nobody")).toBeNull();
    expect(engineFatalCauseOf(undefined)).toBeNull();
  });
});

describe("createEngineWatch — one fall, the first trap, the last settled wave", () => {
  const clock = (() => { let t = Date.parse("2026-11-22T10:00:00.000Z"); return () => new Date((t += 1_000)); })();

  test("stands until a fatal note; the fall keeps the first trap, its path and the last settled heads", () => {
    const watch = createEngineWatch(clock);
    const heard: string[] = [];
    watch.onFall((f) => heard.push(f.cause));
    expect(watch.note(new Error("ENOSPC"), "ledger")).toBe(false);
    expect(watch.fallen()).toBeNull();
    watch.settled(["h1"]);
    watch.settled(["h2", "h3"]);
    expect(watch.note(trap(), "repo")).toBe(true);
    expect(watch.note(new Error("Module terminated"), "ledger")).toBe(true);
    const fall = watch.fallen()!;
    expect(fall.cause).toBe("wasm-unreachable");
    expect(fall.path).toBe("repo");
    expect(fall.lastSettled?.heads).toEqual(["h2", "h3"]);
    expect(Date.parse(fall.lastSettled!.at)).toBeLessThan(Date.parse(fall.since));
    expect(heard).toEqual(["wasm-unreachable"]);
    watch.settled(["after"]);
    expect(watch.fallen()!.lastSettled?.heads).toEqual(["h2", "h3"]);
  });

  test("a fall before any settled wave names none", () => {
    const watch = createEngineWatch(clock);
    watch.note(new Error("Module terminated"), "ledger");
    expect(watch.fallen()!.lastSettled).toBeNull();
  });

  test("the refusal names the code, the cause, the last settled wave and the one hand act; no restart loop", () => {
    const watch = createEngineWatch(clock);
    watch.settled(["abc"]);
    watch.note(new Error("Module terminated"), "repo");
    const r = engineTerminatedRefusal(watch.fallen()!);
    expect(r.refusal).toBe(ENGINE_TERMINATED);
    expect(r.message).toMatch(/module-terminated/);
    expect(r.message).toMatch(/nothing ran/);
    expect(r.message).toContain(ENGINE_HAND_ACT);
    expect(ENGINE_HAND_ACT).toMatch(/restart the vessel once/);
    expect(ENGINE_HAND_ACT).toMatch(/restore from the keep onto a new house \(`lares import <keep checkout>\/house --apply`\)/);
  });
});

describe("tapRepoLogs — the repo's own inbound-message error reaches the watch", () => {
  test("an error logged through the repo logger factory flips the watch and still prints", () => {
    const watch = createEngineWatch(clock0());
    const printed: unknown[][] = [];
    const factory = tapRepoLogs(watch, (...a) => { printed.push(a); });
    factory("automerge-repo:repo").error("error handling inbound message", trap());
    expect(watch.fallen()?.cause).toBe("wasm-unreachable");
    expect(watch.fallen()?.path).toBe("repo");
    expect(printed).toHaveLength(1);
    expect(String(printed[0]![0])).toContain("[automerge-repo:repo]");
  });

  test("CONTROL: a warning or a non-fatal error leaves the engine standing", () => {
    const watch = createEngineWatch(clock0());
    const factory = tapRepoLogs(watch, () => {});
    factory("automerge-repo:repo").error("error handling inbound message", new Error("bad cbor"));
    factory("automerge-repo:repo").warn("Module terminated");
    expect(watch.fallen()).toBeNull();
  });
});

function clock0(): () => Date { return () => new Date("2026-11-22T10:00:00.000Z"); }
