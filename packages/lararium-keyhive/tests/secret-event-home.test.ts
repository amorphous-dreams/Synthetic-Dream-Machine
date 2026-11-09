import { expect, test } from "vitest";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { DaemonEventStore } from "../src/daemon-event-store.js";

test("cap events land and replay through the explicitly held secret store", async () => {
  const secretStore = new MemoryTiddlerStore();
  const store = new DaemonEventStore({ secretStore, secretRest: { assertSealed: async () => true }, face: "face-a" });
  await store.put({ hash: "event-a", variant: "DELEGATED", bytes: new Uint8Array([1, 2, 3]) });
  expect((await secretStore.listVisible())).toHaveLength(1);
  expect((await store.list()).map((r) => [...r.bytes])).toEqual([[1, 2, 3]]);
});

test("cap event custody refuses by name when no secret store stands", async () => {
  const store = new DaemonEventStore({ face: "face-a" } as never);
  await expect(store.put({ hash: "event-a", variant: "DELEGATED", bytes: new Uint8Array([1]) }))
    .rejects.toThrow("secret-home-unavailable");
  await expect(store.list()).rejects.toThrow("secret-home-unavailable");
  const unproved = new DaemonEventStore({ secretStore: new MemoryTiddlerStore(), face: "face-a" });
  await expect(unproved.put({ hash: "event-a", variant: "DELEGATED", bytes: new Uint8Array([1]) }))
    .rejects.toThrow("secret-home-unavailable");
  const unsafeStore = new MemoryTiddlerStore();
  const refused = new DaemonEventStore({ secretStore: unsafeStore, secretRest: { assertSealed: async () => false }, face: "face-a" });
  await expect(refused.list()).rejects.toThrow("secret-home-unavailable");
  await expect(refused.put({ hash: "event-a", variant: "DELEGATED", bytes: new Uint8Array([1]) }))
    .rejects.toThrow("secret-home-unavailable");
  expect(await unsafeStore.listVisible()).toEqual([]);
});
