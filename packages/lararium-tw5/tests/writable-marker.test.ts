import { afterEach, describe, expect, it, vi } from "vitest";
import { startup, name, after, synchronous } from "../src/modules/lararium-writable.js";

function instance(stand?: () => Promise<unknown>) {
  const rows = new Map<string, Record<string, unknown>>();
  class Tiddler { constructor(public fields: Record<string, unknown>) {} }
  const tw = { Tiddler, wiki: { addTiddler: (t: Tiddler) => rows.set(String(t.fields.title), t.fields) }, larariumWritableStand: stand };
  (globalThis as Record<string, unknown>).$tw = tw;
  return { tw, rows };
}
function run() { return new Promise<void>(resolve => startup(resolve)); }
afterEach(() => { delete (globalThis as Record<string, unknown>).$tw; });
describe("writable marker", () => {
  it("declares TW5 ordering and settles without a host", async () => {
    const { rows } = instance();
    await run();
    expect(name).toBe("lararium-writable");
    expect(after).toEqual(["load-modules", "lararium-nalu-engine", "startup"]);
    expect(synchronous).toBe(false);
    expect(rows.has("$:/temp/lares/writable"), "a host-less boot writes no outcome tiddler").toBe(false);
  });
  it("takes the host thunk before invoking it and records its outcome", async () => {
    let tw: ReturnType<typeof instance>["tw"];
    const stand = vi.fn(async () => { expect(tw.larariumWritableStand).toBeUndefined(); return { state: "no-route", reason: "missing route" }; });
    const fixture = instance(stand); tw = fixture.tw;
    await run();
    expect(stand).toHaveBeenCalledOnce();
    expect(fixture.rows.get("$:/temp/lares/writable")).toMatchObject({ text: "no-route", reason: "missing route" });
  });
  it("publishes faults before settling", async () => {
    const { tw, rows } = instance(async () => { throw new Error("shore broke"); });
    await run();
    expect(rows.get("$:/temp/lares/writable")).toMatchObject({ text: "fault", reason: "shore broke" });
    expect((tw as unknown as Record<string, unknown>).larariumWritableFault).toBeTruthy();
  });
});
