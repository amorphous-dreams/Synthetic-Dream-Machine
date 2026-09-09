/**
 * handle-book.test.ts — the recogniser's local memory turns announced cards into recognition OVER TIME.
 *
 * The book claims: it learns a Handle on first sight (TOFU), accepts that Handle's newer face, refuses a
 * rollback and a fork against its held state, keeps a private petname off the wire, and survives a reboot
 * through its snapshot. Each is a test.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { signHandleCard, handleCardId, type HandleCard } from "../src/handle-card.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { HandleBook, HANDLE_BOOK_SNAPSHOT_VERSION, type HandleBookSnapshot } from "../src/handle-book.js";
import { hex } from "../src/crypto.js";

const FASTJACK_SEED = new Uint8Array(32).fill(9);
const DODGER_SEED   = new Uint8Array(32).fill(21);
const signer = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const rawPub = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const RECOVERY = "ab".repeat(32);
function chainOf(pub: string): HandleKelEvent[] { const d = `0x${pub}`; return [mintHandleInception(d, d, RECOVERY)]; }
/** The identity a recogniser keys on — the handle-KEL PREFIX (nym retired onto the chain), not the raw key. */
const pubOf  = async (seed: Uint8Array): Promise<string> => chainOf(await rawPub(seed))[0]!.prefix;

async function publish(seed: Uint8Array, glamour: string, over: Partial<HandleCard> = {}): Promise<HandleCard> {
  const chain = chainOf(await rawPub(seed));
  return signHandleCard({
    nym: chain[0]!.prefix, chain, glamour, version: 1, prev: null, expiry: 4_000_000_000_000, standing: null, ...over,
  }, signer(seed));
}

describe("the book learns a Handle and recognises it again", () => {
  test("first sighting is admitted on self-certification (TOFU) and becomes the known face", async () => {
    const book = new HandleBook();
    const nym  = await pubOf(FASTJACK_SEED);
    const v1   = await publish(FASTJACK_SEED, "FastJack");
    expect((await book.ingest(v1)).ok).toBe(true);
    expect(book.get(nym)?.card.glamour).toBe("FastJack");
    expect(book.nyms()).toEqual([nym]);
  });

  test("a newer card for the SAME Handle supersedes the held face", async () => {
    const book = new HandleBook();
    const nym  = await pubOf(FASTJACK_SEED);
    const v1   = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    await book.ingest(v1);
    const v2 = await publish(FASTJACK_SEED, "FastJack the Healer", { version: 2, prev: await handleCardId(v1) });
    expect((await book.ingest(v2)).ok).toBe(true);
    expect(book.get(nym)?.card.glamour).toBe("FastJack the Healer");
    expect(book.get(nym)?.highWaterVersion).toBe(2);
  });
});

describe("the book holds a Handle to its own lineage", () => {
  test("a rollback is refused and the held face is untouched", async () => {
    const book = new HandleBook();
    const nym  = await pubOf(FASTJACK_SEED);
    const v1   = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    const v2   = await publish(FASTJACK_SEED, "FastJack v2", { version: 2, prev: await handleCardId(v1) });
    await book.ingest(v1);
    await book.ingest(v2);
    // v1 re-arriving after v2 is a replay — refused, and the book still holds v2
    expect((await book.ingest(v1)).reject).toBe("rollback");
    expect(book.get(nym)?.highWaterVersion).toBe(2);
  });

  test("a forked lineage (prev links a stranger ancestor) is refused as a lineage break", async () => {
    const book = new HandleBook();
    const v1   = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    await book.ingest(v1);
    const fork = await publish(FASTJACK_SEED, "FastJack forked", { version: 2, prev: "0".repeat(64) });
    expect((await book.ingest(fork)).reject).toBe("lineage-break");
  });
});

describe("the petname lives in the book, never on the wire", () => {
  test("a petname attaches to a known key and refuses an unknown one", async () => {
    const book = new HandleBook();
    const nym  = await pubOf(FASTJACK_SEED);
    await book.ingest(await publish(FASTJACK_SEED, "FastJack"));
    expect(book.setPetname(nym, "the mover who healed Neo-Thracia")).toBe(true);
    expect(book.get(nym)?.petname).toBe("the mover who healed Neo-Thracia");
    // a stranger key the book never met cannot be named — you name what you know
    expect(book.setPetname(await pubOf(DODGER_SEED), "someone")).toBe(false);
  });

  test("a card update keeps the petname the recogniser already set", async () => {
    const book = new HandleBook();
    const nym  = await pubOf(FASTJACK_SEED);
    const v1   = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    await book.ingest(v1);
    book.setPetname(nym, "FJ");
    await book.ingest(await publish(FASTJACK_SEED, "FastJack v2", { version: 2, prev: await handleCardId(v1) }));
    expect(book.get(nym)?.petname).toBe("FJ");    // survives the update
  });
});

describe("recognition survives a reboot through the snapshot", () => {
  test("a book rehydrated from a snapshot still holds the lineage and refuses a rollback", async () => {
    const first = new HandleBook();
    const nym   = await pubOf(FASTJACK_SEED);
    const v1    = await publish(FASTJACK_SEED, "FastJack", { version: 1 });
    const v2    = await publish(FASTJACK_SEED, "FastJack v2", { version: 2, prev: await handleCardId(v1) });
    await first.ingest(v1);
    await first.ingest(v2);
    first.setPetname(nym, "FJ");

    // reboot: serialise, rebuild
    const rebooted = new HandleBook(first.snapshot());
    expect(rebooted.get(nym)?.card.glamour).toBe("FastJack v2");
    expect(rebooted.get(nym)?.petname).toBe("FJ");
    expect((await rebooted.ingest(v1)).reject).toBe("rollback");   // high-water survived the reboot
  });
});

describe("★ the on-disk snapshot is VERSIONED — a pre-KEL book drops, it never silently wipes wrong ★", () => {
  test("a same-era snapshot stamps the current version and rehydrates its records", async () => {
    const book = new HandleBook();
    await book.ingest(await publish(FASTJACK_SEED, "FastJack"));
    const snap = book.snapshot();
    expect(snap.version).toBe(HANDLE_BOOK_SNAPSHOT_VERSION);
    expect(new HandleBook(snap).nyms().length).toBe(1);
  });

  test("a PRE-KEL (versionless, bare-key) snapshot loads ZERO records — a deliberate versioned reset, not junk", async () => {
    // an era-1 record: a bare 64-hex nym and a chain-less card — the shape before the nym retired onto the KEL
    const legacy = {
      version: undefined,
      records: [{
        nym: "ab".repeat(32),
        card: { kind: "handle-card", nym: "ab".repeat(32), glamour: "Old", version: 1, prev: null, expiry: 4e12, standing: null } as never,
        cardId: "deadbeef", highWaterVersion: 1, petname: "legacy",
      }],
    } as unknown as HandleBookSnapshot;
    const book = new HandleBook(legacy);
    expect(book.nyms()).toEqual([]);   // dropped, not loaded as un-verifiable junk — recognition re-TOFUs
  });

  // DECLARED SKIPPED RED — a bare key is NOT a handle-KEL: there is no inception event, owner-set, or recovery
  // commitment to synthesise from it, so a pre-KEL record CANNOT be reconstructed into a valid card. Migration
  // is re-announcement (the peer re-publishes its KEL-bearing card, TOFU re-learns it), never an in-place lift.
  // This red stands as the record of that impossibility; do not "fix" it by fabricating a chain.
  test.skip("a pre-KEL record migrates in place into a KEL-bearing card (IMPOSSIBLE — a bare key is not a chain)", () => {});
});

