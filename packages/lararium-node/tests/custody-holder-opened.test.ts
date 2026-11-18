/**
 * custody-holder-opened.test — the holder says when its key opens, so a reader that refused while the key rested
 * unopened asks again on that event, never on a timer.
 *
 * A save the daemon island refuses `wrap-failed` while this vessel's key rests unopened (its wrap rests the face's
 * Archive through custody) waits in memory; the vessel seals it again when the key opens (open-node-vessel's custody
 * open watch). The holder's `onOpened` carries that event.
 *
 *   O1  an unlock that opens tells each listener once; a miss tells none; an unsubscribed listener hears nothing more
 *   O0  CONTROL: a miss leaves the holder locked and tells no listener
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Credential } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder } from "../src/custody-holder.js";

vi.setConfig({ testTimeout: 180_000 });

const pass = (passphrase: string): Credential => ({ kind: "passphrase", passphrase });
const RIGHT = "opened-test-passphrase";
const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

async function found() {
  const dir = mkdtempSync(join(tmpdir(), "lar-opened-"));
  roots.push(dir);
  const homes = { identity: join(dir, "identity"), storage: join(dir, "vessel"), seal: join(dir, "nexus") };
  mkdirSync(homes.identity, { recursive: true });
  const io = new FsCustodyIo(homes);
  await foundCustody({ homes, io, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
  return makeCustodyHolder({ homes, io });
}

describe("the custody holder says when its key opens", () => {
  test("O0 CONTROL: a miss leaves the holder locked and tells no listener", async () => {
    const h = await found();
    let heard = 0;
    h.onOpened?.(() => { heard++; });
    expect((await h.unlock([pass("a-wrong-guess")])).reading).toBe("no-slot-opens");
    expect(h.isUnlocked()).toBe(false);
    expect(heard).toBe(0);
  });

  test("O1: an unlock that opens tells each listener once, and an unsubscribed listener hears nothing more", async () => {
    const h = await found();
    expect(h.onOpened, "the holder carries the open event").toBeTypeOf("function");
    let first = 0, second = 0;
    const stopFirst = h.onOpened!(() => { first++; });
    h.onOpened!(() => { second++; });
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
    expect([first, second]).toEqual([1, 1]);
    // AN UNLOCK OVER A HELD KEY OPENS NOTHING NEW, so it tells nobody.
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("already-unlocked");
    expect([first, second]).toEqual([1, 1]);
    stopFirst();
    await h.lock();
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
    expect([first, second]).toEqual([1, 2]);
  });
});
