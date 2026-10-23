import { describe, expect, it } from "vitest";
import { PresenceTracker, type PresenceMessage } from "../src/record-port-presence.js";

describe("clockless presence", () => {
  const a = { actorKey: "a", beat: 1, state: "here" };
  const b = { actorKey: "b", beat: 1, state: "here" };
  it("port-presence-expires on a single remaining peer's beat", () => {
    const tracker = new PresenceTracker(2);
    tracker.update("a-port", a); tracker.update("b-port", b);
    tracker.update("b-port", { ...b, beat: 2 });
    tracker.update("b-port", { ...b, beat: 3 });
    expect(tracker.snapshotFor("new").map(p => p.actorKey)).toEqual(["b"]);
  });
  it("port-presence-close", () => {
    const t = new PresenceTracker(); t.update("a-port", a); t.close("a-port");
    expect(t.snapshotFor("new")).toEqual([]);
  });
  it("port-presence-transport-gone", () => {
    const t = new PresenceTracker(); t.update("a-port", a); t.transportGone("a-port");
    expect(t.snapshotFor("new")).toEqual([]);
  });
  it("port-presence-supersede", () => {
    const t = new PresenceTracker(); t.update("old", a); t.supersede("a", "new");
    expect(t.snapshotFor("new")).toEqual([]);
    expect(t.update("new", { ...a, beat: 1 })).toBe(true);
    expect(t.update("old", { ...a, beat: 2 })).toBe(false);
  });
  it("port-presence-reconnect-full-set", () => {
    const t = new PresenceTracker(); t.update("a-port", a); t.update("b-port", b);
    expect(t.snapshotFor("new")).toEqual([a, b]);
    expect(t.update("a-port", { ...a, beat: 0 })).toBe(false);
  });
  it("port-presence-gone-fans-out", () => {
    const t = new PresenceTracker(); const x: PresenceMessage[] = []; const y: PresenceMessage[] = [];
    t.subscribe(message => x.push(message)); t.subscribe(message => y.push(message));
    t.update("a-port", a); t.close("a-port");
    expect(x.at(-1)).toEqual({ actorKey: "a", gone: true });
    expect(y.at(-1)).toEqual({ actorKey: "a", gone: true });
  });
  it("control: refresh inside window keeps entry", () => {
    const t = new PresenceTracker(2); t.update("a-port", a); t.update("a-port", { ...a, beat: 2 });
    t.update("b-port", b);
    expect(t.snapshotFor("new").map(p => p.actorKey)).toContain("a");
  });
  it("as of the last round: no spontaneous lapse", () => {
    const t = new PresenceTracker(1); t.update("a-port", a);
    expect(t.snapshotFor("new")).toEqual([a]);
    t.update("b-port", b);
    expect(t.snapshotFor("new")).toContainEqual(a);
    t.update("b-port", { ...b, beat: 2 });
    expect(t.snapshotFor("new")).not.toContainEqual(a);
  });
});
