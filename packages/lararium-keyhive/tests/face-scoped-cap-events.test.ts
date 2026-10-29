import { expect, test } from "vitest";
import { DAEMON_BAG_ID, toLarTiddlerRecord } from "@lararium/mesh";
import { DaemonEventStore } from "../src/daemon-event-store.js";

test("cap events belong only to their face", async () => {
  const rows = new Map<string, any>();
  const daemon = {
    get: async (title: string) => rows.get(title),
    listVisible: async () => [...rows.keys()],
    put: async (record: any) => { rows.set(record.tiddler.title, record); },
  } as never;
  const a = new DaemonEventStore({ daemon, face: "group-a" });
  const b = new DaemonEventStore({ daemon, face: "group-b" });
  await a.put({ hash: "same", variant: "DELEGATED", bytes: new Uint8Array([1]) });
  await b.put({ hash: "same", variant: "DELEGATED", bytes: new Uint8Array([2]) });
  const title = `${DAEMON_BAG_ID}/cap/unscoped`;
  rows.set(title, toLarTiddlerRecord({ title, hash: "unscoped", variant: "DELEGATED", text: "Aw==" }, { authority: "test" }));
  expect((await a.list()).map(r => [...r.bytes])).toEqual([[1]]);
  expect((await b.list()).map(r => [...r.bytes])).toEqual([[2]]);
});
