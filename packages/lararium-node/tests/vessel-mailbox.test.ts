import { expect, test } from "vitest";
import { makeDurableMailbox } from "../src/vessel-mailbox.js";
import { snapshotWork } from "./work-store-fixture.js";

test("a pending mailbox payload survives restart, retains its request identity after failed delivery and leaves only after acknowledgement", async () => {
  const rest = snapshotWork(), first = rest.open();
  const payload = { requestId: "mail-1", verb: "put", args: { text: "kept" }, requestedBy: "face-a" };
  await makeDurableMailbox(first.store, async () => {}).park("notes", payload);
  const restarted = rest.open(), attempts: unknown[] = [];
  const failing = makeDurableMailbox(restarted.store, async (_wiki, value) => { attempts.push(value); throw new Error("island left"); });
  await failing.drain("notes");
  expect((await restarted.store.get((await restarted.store.listVisible())[0]!))?.tiddler.status).toBe("delivering");
  const again = rest.open();
  await makeDurableMailbox(again.store, async (_wiki, value) => { attempts.push(value); }).drain("notes");
  expect(attempts).toEqual([payload, payload]);
  expect(await rest.open().store.listVisible()).toEqual([]);
});
