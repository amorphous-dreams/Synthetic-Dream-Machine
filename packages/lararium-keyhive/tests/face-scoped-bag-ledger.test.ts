import { expect, test } from "vitest";
import { daemonBagDocLedger } from "../src/bag-doc-ledger.js";

test("one composite keeps each face's bag binding separate", async () => {
  const rows = new Map<string, any>();
  const composite = { get: async (title: string) => rows.get(title), put: async (record: any) => { rows.set(record.tiddler.title, record); } } as never;
  const a = daemonBagDocLedger(composite, "group-a");
  const b = daemonBagDocLedger(composite, "group-b");
  await a.put("lar:///bag", "doc-a");
  expect(await b.get("lar:///bag")).toBeNull();
  await b.put("lar:///bag", "doc-b");
  expect(await a.get("lar:///bag")).toBe("doc-a");
  expect(await b.get("lar:///bag")).toBe("doc-b");
});
