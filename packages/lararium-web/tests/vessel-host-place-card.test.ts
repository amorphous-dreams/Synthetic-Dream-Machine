/**
 * vessel-host-place-card — A BROWSER'S FOUNDING ARMS ITS PLACE KEL THROUGH THE COLD CARD, read back through the ceremony
 * (the node's `found` ceremony, ported: the card prints once, the person writes it on paper and types it back, and the
 * founding writes no key until it reads back true).
 *
 *   PC1 RED     the card's lines reach the ceremony document on its brokered port alone: the page hears the ask's kind,
 *               act and words, never a code row; the ask says what the card serves. A true read-back resolves the founding's
 *               read-back.
 *   PC2 RED     a mis-typed card asks again and names the fault (checksum, length); a third miss refuses by name and the
 *               founding writes nothing. CONTROL: a code with spaces and capitals reads back true.
 *   PC3         a declined card refuses by name (`card-declined`): no founding writes a key without its card.
 */
import { expect, test } from "vitest";
import { coldKeyCode } from "@lararium/mesh";
import { standCeremonyDoor, type DoorToPage } from "../src/workers/ceremony-door.js";
import { ceremonyPlaceCard, PlaceCardRefused } from "../src/workers/place-card.js";
import type { CeremonyAsk, CeremonyToVessel, VesselToCeremony } from "../src/ceremony-protocol.js";

const SEED = new Uint8Array(32).map((_, i) => (i * 7 + 3) & 0xff);
const CODE = coldKeyCode(SEED);
const CODE_ROW = /^[0-9a-f]{4}(?:-[0-9a-f]{4}){5}$/;

/** A door whose page answers each ask through a fresh ceremony channel with `typed` (null declines). Answers what each side heard. */
function ceremony(typed: Array<string | null>) {
  const toPage: DoorToPage[] = [];
  const asks: CeremonyAsk[] = [];
  const door = standCeremonyDoor((m) => {
    toPage.push(m);
    if (m.t !== "ask") return;
    const channel = new MessageChannel();
    channel.port2.onmessage = (e) => {
      const msg = e.data as VesselToCeremony;
      if (msg.t !== "ask") return;
      asks.push(msg);
      const text = typed.shift();
      if (text === null || text === undefined) { channel.port2.postMessage({ t: "answer", askId: msg.askId, answer: null } satisfies CeremonyToVessel); return; }
      const bytes = new TextEncoder().encode(text).buffer;
      channel.port2.postMessage({ t: "answer", askId: msg.askId, answer: { kind: "passphrase", bytes } } satisfies CeremonyToVessel, [bytes]);
    };
    door.port(m.askId, channel.port1);
  });
  return { door, toPage, asks };
}

const readBackOf = (door: ReturnType<typeof standCeremonyDoor>, seed = SEED) =>
  ceremonyPlaceCard(door).readBack({ seed: Uint8Array.from(seed), digest: "d".repeat(64), verifyingKey: "e".repeat(64) }, "fingerprint00001", 0);

test("PC1 RED — the card reaches the ceremony alone, says what it serves, and a true read-back resolves", async () => {
  const c = ceremony([CODE]);
  await readBackOf(c.door);
  expect(c.asks).toHaveLength(1);
  const ask = c.asks[0]!;
  expect(ask).toMatchObject({ kind: "card", face: null, routes: ["passphrase"] });
  expect((ask.card ?? []).filter((line) => CODE_ROW.test(line)).join("-")).toBe(CODE);
  expect(ask.words).toMatch(/place/);
  expect(ask.words).toMatch(/paper/);
  // THE PAGE HEARS PUBLIC WORDS ALONE: no code row, no card field.
  const said = JSON.stringify(c.toPage);
  for (const group of CODE.split("-").slice(0, 6)) expect(said).not.toContain(group);
  expect(c.toPage.every((m) => !("card" in m))).toBe(true);
});

test("PC2 RED — a mis-typed card asks again by its fault; three misses refuse and nothing writes; CONTROL: spacing and case never matter", async () => {
  const typo = CODE.slice(0, -1) + (CODE.endsWith("0") ? "1" : "0");
  const c = ceremony([typo, CODE.slice(0, 20), CODE.toUpperCase().replace(/-/g, " ")]);
  await readBackOf(c.door);
  expect(c.asks).toHaveLength(3);
  expect(c.asks[1]!.words).toMatch(/checksum/);
  expect(c.asks[2]!.words).toMatch(/characters/);

  const miss = ceremony([typo, typo, typo]);
  const refused = await readBackOf(miss.door).catch((e: unknown) => e);
  expect(refused).toBeInstanceOf(PlaceCardRefused);
  expect((refused as PlaceCardRefused).message).toMatch(/nothing was written/);
  expect(miss.asks).toHaveLength(3);
});

test("PC3 — a declined card refuses by name", async () => {
  const c = ceremony([null]);
  const refused = await readBackOf(c.door).catch((e: unknown) => e);
  expect(refused).toBeInstanceOf(PlaceCardRefused);
  expect((refused as PlaceCardRefused).refusal).toBe("card-declined");
});
