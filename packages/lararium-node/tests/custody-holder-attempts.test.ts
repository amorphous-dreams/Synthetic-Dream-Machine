/**
 * custody-holder-attempts.test — each distinct passphrase offered counts as one attempt against the boot's limit.
 *
 * One unlock may carry many credentials. Charged once per call, three attempts carried any number of guesses. Now
 * every distinct passphrase (NFKC-equal spellings count once) spends one attempt, and the sheets of a paper route,
 * which make up ONE route, spend one together. Passphrases past the attempts left never reach a derivation: the
 * call reads `attempts-spent`. A route that opens spends nothing, as before.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { draftPaperPin, confirmPaperPin, type Credential, type SlotSpec } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder, seatFaceAutoFounder } from "../src/custody-holder.js";
import type { CustodyHomes } from "../src/vault-carriers.js";
import { personaGroupDigest } from "../src/persona-group-file.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

const pass = (passphrase: string): Credential => ({ kind: "passphrase", passphrase });
const RIGHT = "attempts-test-passphrase";
const roots: string[] = [];

function stage(): { homes: CustodyHomes; io: FsCustodyIo } {
  const dir = mkdtempSync(join(tmpdir(), "lar-attempts-"));
  roots.push(dir);
  const homes = { identity: join(dir, "identity"), storage: join(dir, "vessel"), seal: join(dir, "nexus") };
  mkdirSync(homes.identity, { recursive: true });
  return { homes, io: new FsCustodyIo(homes) };
}
async function found(slots: readonly SlotSpec[]) {
  const target = stage();
  await foundCustody({ ...target, slots });
  return makeCustodyHolder(target);
}
beforeEach(() => seatFaceAutoFounder(() => [{ t: 1, pins: [pass(RIGHT)] }]));
let seat: SeatedScratchCustody | null = null;
afterEach(async () => {
  await seat?.drop(); seat = null;
  seatFaceAutoFounder(null);
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("one attempt per distinct passphrase", () => {
  test("an unlock offering two wrong passphrases spends two attempts", async () => {
    const h = await found([{ t: 1, pins: [pass(RIGHT)] }]);
    expect(await h.unlock([pass("wrong-1"), pass("wrong-2")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 1 });
  });

  test("an unlock offering four passphrases spends the three left, and the fourth refuses unread", async () => {
    const h = await found([{ t: 1, pins: [pass(RIGHT)] }]);
    expect(await h.unlock([pass("wrong-1"), pass("wrong-2"), pass("wrong-3"), pass(RIGHT)])).toEqual({ reading: "attempts-spent" });
    expect(h.isUnlocked()).toBe(false);
    expect(h.attemptsLeft()).toBe(0);
    expect(await h.unlock([pass(RIGHT)])).toEqual({ reading: "attempts-spent" });
  });

  test("a proof offering two wrong passphrases spends two attempts", async () => {
    const h = await found([{ t: 1, pins: [pass(RIGHT)] }]);
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
    expect(await h.proves([pass("wrong-1"), pass("wrong-2")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 1 });
  });

  test("CONTROL: one wrong passphrase spends one attempt; NFKC-equal spellings count once", async () => {
    const h = await found([{ t: 1, pins: [pass(RIGHT)] }]);
    expect(await h.unlock([pass("wrong-1")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 2 });
    expect(await h.unlock([pass("ﬁne"), pass("fine")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 1 });
  });

  test("CONTROL: a right route beside a wrong one opens and spends nothing", async () => {
    const h = await found([{ t: 1, pins: [pass(RIGHT)] }]);
    expect((await h.unlock([pass("wrong-1"), pass(RIGHT)])).reading).toBe("opens");
    expect(h.attemptsLeft()).toBe(3);
  });

  test("CONTROL: a paper 2-of-3 offering that misses spends one attempt", async () => {
    const held = draftPaperPin({ threshold: 2, count: 3 });
    const other = draftPaperPin({ threshold: 2, count: 3 });
    const h = await found([{ t: 1, pins: [{ kind: "paper", confirmed: confirmPaperPin(held, held.sheets) }] }]);
    expect(await h.unlock([{ kind: "paper", sheets: other.sheets.slice(0, 2) }])).toEqual({ reading: "no-slot-opens", attemptsLeft: 2 });
  });

  test("a face unlock offering four passphrases spends the face's three, and the fourth refuses unread", async () => {
    seat = await seatScratchCustody("attempts-face");
    const { holder } = seat;
    const a = await holder.foundFace({ group: personaGroupDigest("group-attempts-a"), slots: [{ t: 1, pins: [pass("route-a")] }] });
    await holder.lockFace(a.fcid);
    const offered = [pass("wrong-1"), pass("wrong-2"), pass("wrong-3"), pass("route-a")];
    expect(await holder.unlockFace({ fcid: a.fcid }, offered)).toEqual({ reading: "attempts-spent", fcid: a.fcid });
    expect((await holder.unlockFace({ fcid: a.fcid }, [pass("route-a")])).reading).toBe("attempts-spent");
  });
});
