import { describe, expect, test } from "vitest";
import { Repo } from "./wiki-shore-rig.js";
import { AutomergeDocStore, emptyLarDoc, type LarDoc } from "@lararium/mesh";
import { ofType, open, realPort } from "./record-port-real-rig.js";

describe("real store commit boundary", () => {
  test("port-real-write-boundary-drift: a real Automerge handle fault after first commit resumes only pending family; CONTROL: healthy transaction applies", async () => {
    const repo = new Repo({ network: [] });
    const handle = repo.create<LarDoc>(emptyLarDoc());
    let fault = false;
    const handleWithFault = new Proxy(handle, { get(target, key) {
      if (key === "change" && fault) return () => { throw new Error("handle-unavailable"); };
      const value = Reflect.get(target, key, target) as unknown;
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    } });
    const second = new AutomergeDocStore(handleWithFault, "second");
    const r = await realPort();
    r.composite.addLayer({ bagId: "second", store: second, writable: true, defaultWritable: false });
    try {
      await r.send(open);
      let firstFires = 0;
      r.composite.subscribe((change) => { if (change.title === "First") { firstFires++; fault = true; } });
      const tx = { type: "port:write", portId: "p", txId: "real-drift", records: [
        { title: "First", fields: { text: "one" } }, { title: "Second", fields: { text: "two" }, bag: "second" },
      ] };
      await r.send(tx);
      expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "partial", applied: ["(default)"], failed: ["second"] });
      expect(firstFires).toBe(1);
      expect(await second.get("Second")).toBeNull();
      fault = false;
      await r.send(tx);
      expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", applied: ["(default)", "second"] });
      expect(firstFires).toBe(1);
      expect((await second.get("Second"))?.tiddler.text).toBe("two");
      await r.send({ ...tx, txId: "healthy", records: [{ title: "Healthy", fields: { text: "fine" }, bag: "second" }] });
      expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", applied: ["second"] });
    } finally { await r.close(); }
  });
});
