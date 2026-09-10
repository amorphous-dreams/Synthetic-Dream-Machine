/**
 * handle-orchestration — the leased-projection core every handle verb (rotate/graft/burn/attest) rides.
 *
 * The board holds the authoritative chain; a vessel's local view is a projection. Before minting the next
 * event, the vessel LEASE-CHECKS: extend only if the board head still reads as the head the caller last
 * folded — a compare-and-swap (git force-with-lease · KERI accept-on-quorum). A stale head that tried to
 * extend anyway would fork the KEL — two heads, one identity, the equivocation the mesh exists to catch. The
 * lease is a write-side guard against the COMMON stale-view case; a truly-concurrent partition fork is still
 * caught sovereign at READ by the recogniser's HandleBook. This pins both: resolve reads the board, and a
 * moved head refuses the mint.
 *
 * Research rhyme: lar:///ha.ka.ba/lares/api/pono/field-collision (event-sourcing · git refs · KERI KERL)
 */
import { describe, test, expect } from "vitest";
import { resolveOwnHandleChain, boardHeadCid, extendOwnHandle } from "../src/handle-orchestration.js";
import { mintHandleInception, type HandleKelEvent, type HandleMintResult } from "../src/handle-kel.js";
import { HANDLE_CARD_DOMAIN } from "../src/handle-card.js";
import { writeHandleAnnounce } from "../src/handle-announce.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import type { LarDoc } from "../src/base-doc.js";
import type { HandleCard } from "../src/handle-card.js";

function makeFakeBoard(): { doc(): LarDoc; change(fn: (d: LarDoc) => void): void } {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  return { doc: () => d, change: (fn) => fn(d) };
}

function card(nym: string, chain: HandleKelEvent[], version: number): HandleCard {
  return {
    kind: HANDLE_CARD_DOMAIN, nym, chain, glamour: "Guru-Josh",
    version, prev: null, expiry: 0, standing: null, fleetProof: null, sig: "00",
  } as unknown as HandleCard;
}

const OWNER = "persona-" + "ab".repeat(32);

describe("handle-orchestration — the board is truth, the extend is leased", () => {
  test("resolveOwnHandleChain reads the board's chain; boardHeadCid returns its tail cid", () => {
    const inc = mintHandleInception("0x" + "11".repeat(32), OWNER, sealKeySetHash(["0x" + "11".repeat(32)], 1));
    const board = makeFakeBoard();
    board.change((d) => writeHandleAnnounce(d, card(inc.prefix, [inc], 1)));
    const chain = resolveOwnHandleChain(board.doc(), inc.prefix);
    expect(chain?.length).toBe(1);
    expect(boardHeadCid(board.doc(), inc.prefix)).toBe(inc.eventCid);
  });

  test("★ a stale head REFUSES the mint (lease violation) — the fork-prevention, with a matching-lease control ★", async () => {
    const inc = mintHandleInception("0x" + "22".repeat(32), OWNER, sealKeySetHash(["0x" + "22".repeat(32)], 1));
    const nym = inc.prefix;
    const board = makeFakeBoard();
    board.change((d) => writeHandleAnnounce(d, card(nym, [inc], 1)));

    // A synthetic next event stands in for any verb's real mint — the core is verb-agnostic.
    const nextEvent = { ...inc, seq: 1, eventCid: "handle1-" + "ff".repeat(32) } as HandleKelEvent;
    let mintCalls = 0;
    const mintNext = async (_chain: HandleKelEvent[]): Promise<HandleMintResult> => {
      mintCalls += 1;
      return { ok: true, event: nextEvent };
    };
    const buildCard = (_e: HandleKelEvent, newChain: HandleKelEvent[]) => card(nym, newChain, 2);

    // CONTROL: the lease matches the board head → the mint runs and the board advances.
    const first = await extendOwnHandle({ board: board as never, nym, expectedHeadCid: inc.eventCid, mintNext, buildCard });
    expect(first.ok, first.ok ? "" : first.reason).toBe(true);
    expect(mintCalls).toBe(1);
    expect(boardHeadCid(board.doc(), nym)).toBe(nextEvent.eventCid);

    // THE RED: the same stale lease (inc's cid) now trails the board (at nextEvent) → REFUSE, no mint.
    const stale = await extendOwnHandle({ board: board as never, nym, expectedHeadCid: inc.eventCid, mintNext, buildCard });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.reason).toMatch(/lease/i);
    expect(mintCalls, "a stale head never reaches the mint — it cannot fork the head").toBe(1);
  });
});
