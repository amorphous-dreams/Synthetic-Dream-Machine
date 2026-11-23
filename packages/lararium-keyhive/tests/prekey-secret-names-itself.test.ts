/**
 * prekey-secret-names-itself — a stand whose Archive lags its own cap-event log refuses by name.
 *
 * Every card a stand mints rotates one of its prekeys, and the rotation rests in the cap events; the new prekey's secret
 * rests only in an Archive taken AFTER that mint. A face that restores the same stale Archive light after light, minting
 * one card each time, walks its live prekeys out from under the secrets it holds; once none it holds stays live, keyhive's
 * `generateDocument` refuses (`OwnerHoldsNoPrekeySecret`) and a recorded bag that `holdsHand` lacks cannot remint.
 *
 *   NO ARCHIVE         a fresh stand mints prekeys of its own, so the recorded bag remints (a reading, no refusal).
 *   BEFORE THE CARD    a lineage of Archives each taken before its stand's card refuses within a bounded walk, by name.
 *   AFTER THE CARD     a lineage of `exportArchiveAfterTheCard` Archives opens every stand of the same walk.
 */
import { describe, expect, test } from "vitest";
import { KeyhiveProvider, InMemoryEventStore, PrekeySecretAbsent, registerBagsDurably, type BagDocLedger } from "../src/index.js";

/** The walk's bound: measured, the before-the-card lineage refused within 11..32 stands across fifteen seeds. */
const STANDS = 120;
const BAG = "lar:///probe.prekey.bag";

function ledgerOf(): BagDocLedger & { readonly rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, get: async (bag) => rows.get(bag) ?? null, put: async (bag, docId) => { rows.set(bag, docId); } };
}

/** One stand: restore (or stand fresh), replay, register the bags the ledger records plus one of its own, then card and Archive. */
async function stand(seed: Uint8Array, store: InMemoryEventStore, ledger: BagDocLedger, archive: Uint8Array | null, i: number,
  rest: "before-the-card" | "after-the-card"): Promise<Uint8Array> {
  const p = new KeyhiveProvider();
  await p.init({ seed, eventStore: store, ...(archive ? { archiveBytes: archive } : {}) });
  try {
    await p.hydrateFromEventStore();
    await registerBagsDurably({ provider: p, bags: [BAG, `lar:///probe.prekey.stand-${i}`], ledger });
    let next: Uint8Array;
    if (rest === "before-the-card") { next = await p.exportArchive(); await p.contactCard(); }
    else next = await p.exportArchiveAfterTheCard();
    await p.settleEvents();
    return next;
  } finally { await p.dispose(); }
}

describe("a stand whose Archive lags its own log", () => {
  test("NO ARCHIVE: the fresh stand's own prekeys answer, and the recorded bag remints without a refusal", async () => {
    const seed = new Uint8Array(32).fill(0x71);
    const store = new InMemoryEventStore();
    const ledger = ledgerOf();
    let archive: Uint8Array | null = null;
    // THE SETUP NEVER REFUSES BY CONSTRUCTION: an after-the-card lineage holds every prekey its log names, so its twelve
    // stands leave twelve cards of rotations in the log (a before-the-card walk could refuse inside the setup itself).
    for (let i = 0; i < 12; i++) archive = await stand(seed, store, ledger, archive, i, "after-the-card");
    const recorded = ledger.rows.get(BAG);
    expect(recorded).toBeTruthy();
    const p = new KeyhiveProvider();
    await p.init({ seed, eventStore: store });
    try {
      await p.hydrateFromEventStore();
      await registerBagsDurably({ provider: p, bags: [BAG], ledger });
      expect(ledger.rows.get(BAG)).not.toBe(recorded);   // the Document this stand holds no hand in leaves; a fresh one stands
    } finally { await p.dispose(); }
  });

  test("BEFORE THE CARD: the lineage refuses within the walk, as PrekeySecretAbsent naming the cause, never a raw GenerateDocError", async () => {
    const seed = new Uint8Array(32).fill(0x72);
    const store = new InMemoryEventStore();
    const ledger = ledgerOf();
    let archive: Uint8Array | null = null;
    let refusal: unknown = null;
    for (let i = 0; i < STANDS && refusal === null; i++) {
      try { archive = await stand(seed, store, ledger, archive, i, "before-the-card"); }
      catch (error) { refusal = error; }
    }
    expect(refusal).toBeInstanceOf(PrekeySecretAbsent);
    const message = (refusal as Error).message;
    expect(message).toContain("holds no prekey secret: its Archive was absent or older than its latest card");
    expect(message).not.toMatch(/GenerateDocError/);
    expect(message).not.toMatch(/[0-9a-f]{40}/);   // no key material and no identity hex rides the line
    // KEYHIVE'S OWN WORDS, pinned: the rename keys on this text (document.rs `OwnerHoldsNoPrekeySecret`); a wasm bump that
    // rewords it reads red here instead of passing the raw fault through unnamed.
    expect(String((refusal as Error).cause)).toContain("no secret key for the prekey the document's owner is added with");
  });

  test("AFTER THE CARD: every stand of the same walk opens, and the recorded bag keeps its Document", async () => {
    const seed = new Uint8Array(32).fill(0x72);
    const store = new InMemoryEventStore();
    const ledger = ledgerOf();
    let archive: Uint8Array | null = null;
    archive = await stand(seed, store, ledger, archive, 0, "after-the-card");
    const first = ledger.rows.get(BAG);
    for (let i = 1; i < 40; i++) archive = await stand(seed, store, ledger, archive, i, "after-the-card");
    expect(ledger.rows.get(BAG)).toBe(first);
  });
});
