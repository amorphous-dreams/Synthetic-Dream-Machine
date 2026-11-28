/**
 * vessel-mailbox-row.test — the durable mailbox rests in ONE sealed custody row on this vessel, never in a document: a parked
 * verb survives the mailbox (a fresh one, as a restart builds) and reads back sealed; a drain delivers it and the row lets it
 * go; a failed delivery keeps it parked. Nothing parks while custody stays locked.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MAILBOX_FILE, makeDurableMailbox, type MailboxVerb } from "../src/vessel-mailbox.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("vessel-mailbox-row"); });
afterEach(async () => { await c.drop(); });

const alert: MailboxVerb = { verb: "alert", args: { text: "the-parked-secret" }, requestedBy: "vessel" };

describe("the mailbox row", () => {
  test("RED: a parked verb survives a fresh mailbox, rests sealed, and leaves the row once delivered", async () => {
    await makeDurableMailbox(async () => { throw new Error("cold"); }).park("w1", alert);
    const onDisk = readFileSync(join(larIdentityDir(), MAILBOX_FILE), "utf8");
    expect(onDisk).not.toContain("the-parked-secret");   // sealed: no parked byte reads on disk

    // A restart builds a fresh mailbox over the same row.
    const delivered: Array<[string, MailboxVerb]> = [];
    const after = makeDurableMailbox(async (wikiId, v) => { delivered.push([wikiId, v]); });
    expect((await after.parked()).map((p) => [p.wikiId, p.verb])).toEqual([["w1", "alert"]]);
    await after.drain("w2");
    expect(delivered).toEqual([]);                       // another island's breath delivers nothing of w1's
    await after.drain("w1");
    expect(delivered).toEqual([["w1", alert]]);
    expect(await after.parked()).toEqual([]);            // the delivered verb left the row
  });

  test("a failed delivery keeps the verb parked for the next breath", async () => {
    const box = makeDurableMailbox(async () => { throw new Error("island died mid-drain"); });
    await box.park("w1", alert);
    await box.drain("w1");
    expect((await box.parked()).length).toBe(1);
  });

  test("CONTROL: nothing rests in a control document — the row is a custody file", async () => {
    await makeDurableMailbox(async () => {}).park("w1", alert);
    expect(existsSync(join(larIdentityDir(), MAILBOX_FILE))).toBe(true);
  });
});
