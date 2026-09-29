import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { signHandleCard, handleCardId, type HandleCard } from "../src/handle-card.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { HandleBook, HANDLE_BOOK_SNAPSHOT_ERA } from "../src/handle-book.js";
import { hex } from "../src/crypto.js";

const SEED = new Uint8Array(32).fill(9), signer = (b: Uint8Array) => ed.signAsync(b, SEED).then(hex);
async function publish(glamour: string, parents: readonly string[] = []): Promise<HandleCard> {
  const did = `0x${await ed.getPublicKeyAsync(SEED).then(hex)}`;
  const chain: HandleKelEvent[] = [mintHandleInception(did, did, "ab".repeat(32))];
  return signHandleCard({ nym: chain[0]!.prefix, chain, glamour, parents, standing: null, fleetProof: null }, signer);
}

describe("HandleBook causal closure", () => {
  test("holds a genesis and causal descendant", async () => {
    const book = new HandleBook();
    const root = await publish("root");
    expect((await book.ingest(root)).ok).toBe(true);
    const child = await publish("child", [await handleCardId(root)]);
    expect((await book.ingest(child)).ok).toBe(true);
    expect(book.get(root.nym)?.card?.glamour).toBe("child");
    expect(book.get(root.nym)?.heads).toEqual([child.actCid]);
  });

  test("missing ancestry is unavailable and does not mutate the book", async () => {
    const book = new HandleBook();
    const child = await publish("orphan", ["f".repeat(64)]);
    expect((await book.ingest(child)).reject).toBe("unavailable");
    expect(book.get(child.nym)).toBeUndefined();
  });

  test("concurrent admissible heads remain unsettled regardless of arrival order", async () => {
    const root = await publish("root"), id = await handleCardId(root);
    const a = await publish("a", [id]), b = await publish("b", [id]);
    const first = new HandleBook(); await first.ingest(root); await first.ingest(a);
    expect((await first.ingest(b)).reject).toBe("unsettled");
    const second = new HandleBook(); await second.ingest(root); await second.ingest(b);
    expect((await second.ingest(a)).reject).toBe("unsettled");
    expect(second.get(root.nym)?.card).toBeNull();
  });

  test("restore re-verifies and re-folds the closure; the synchronous constructor stays empty", async () => {
    const book = new HandleBook(), root = await publish("root");
    await book.ingest(root); book.setPetname(root.nym, "FJ");
    const rebooted = await HandleBook.restore(book.snapshot());
    expect(book.snapshot().era).toBe(HANDLE_BOOK_SNAPSHOT_ERA);
    expect(rebooted.get(root.nym)?.petname).toBe("FJ");
    expect(new HandleBook(book.snapshot()).get(root.nym)).toBeUndefined();
    expect((await new HandleBook({ records: book.snapshot().records } as never).ingest(root)).ok).toBe(true);
  });

  test("tampered accepted cards and descendant-only snapshots never mint recognition", async () => {
    const root = await publish("root");
    const child = await publish("child", [await handleCardId(root)]);
    const source = new HandleBook();
    await source.ingest(root); await source.ingest(child);
    const record = source.snapshot().records[0]!;

    const tampered = await HandleBook.restore({
      era: HANDLE_BOOK_SNAPSHOT_ERA,
      records: [{ ...record, accepted: [{ ...root, glamour: "forged" }] }],
    });
    expect(tampered.get(root.nym)).toBeUndefined();

    const descendantOnly = await HandleBook.restore({
      era: HANDLE_BOOK_SNAPSHOT_ERA,
      records: [{ ...record, accepted: [child] }],
    });
    expect(descendantOnly.get(root.nym)).toBeUndefined();
  });

  test("fabricated projection and heads are ignored; verified closure determines recognition", async () => {
    const root = await publish("root");
    const source = new HandleBook();
    await source.ingest(root);
    const record = source.snapshot().records[0]!;
    const restored = await HandleBook.restore({
      era: HANDLE_BOOK_SNAPSHOT_ERA,
      records: [{
        ...record,
        card: { ...root, glamour: "forged projection" },
        heads: ["f".repeat(64)],
      }],
    });
    expect(restored.get(root.nym)?.card?.actCid).toBe(root.actCid);
    expect(restored.get(root.nym)?.heads).toEqual([root.actCid]);
  });
});
