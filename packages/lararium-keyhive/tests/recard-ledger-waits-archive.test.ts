/**
 * recard-ledger-waits-archive — A RECARD'S LEDGER ROWS WAIT FOR ITS ARCHIVE (course recard-ledger-trails-archive; Card-Reader's
 * custody read of #506, F5). The stale pass of a recard reminted Documents whose keys only the Archive after its card holds, and
 * `registerBagsDurably` put each reminted docId into the vessel-ground ledger before that Archive rested; an `archive-unrested`
 * refusal then left the ledger ahead of the Archive. A held registration puts nothing: it hands back the rows and a `commit` the
 * caller runs once the Archive rests, so a refused recard leaves the ledger as it stood.
 */
import { describe, expect, test } from "vitest";
import { registerBagsDurably, type BagDocLedger } from "../src/index.js";
import { landRecard, recardFloorThrew, recardRegistration } from "../src/boot-daemon-keyhive.js";
import { PrekeySecretAbsent } from "../src/keyhive-provider.js";
import type { CapabilityProvider } from "../src/capability-provider.js";

function ledgerOf(start: Record<string, string> = {}): BagDocLedger & { readonly rows: Map<string, string>; readonly puts: string[] } {
  const rows = new Map(Object.entries(start)), puts: string[] = [];
  return { rows, puts, get: async (bag) => rows.get(bag) ?? null, put: async (bag, docId) => { puts.push(bag); rows.set(bag, docId); } };
}

/** A provider whose recorded Documents hold no hand (each remints), and whose fresh bags register a new Document. */
function provider(): CapabilityProvider {
  let n = 0;
  return {
    adoptBag: () => {},
    holdsHand: async () => false,
    remintBag: async (bag: string) => ({ docId: `reminted-${bag}-${++n}` }),
    registerBag: async (bag: string) => ({ docId: `fresh-${bag}-${++n}` }),
  } as unknown as CapabilityProvider;
}

describe("a recard's ledger rows wait for its Archive", () => {
  test("RED: a held registration puts no row, reminted or fresh, and names each; commit puts them after", async () => {
    const ledger = ledgerOf({ "lar:///old": "doc-old" });
    const out = await registerBagsDurably({ provider: provider(), bags: ["lar:///old", "lar:///new"], ledger, hold: true });
    expect(out.reminted).toEqual(["lar:///old"]);
    expect(ledger.puts, "nothing rests before the Archive").toEqual([]);
    expect(ledger.rows.get("lar:///old")).toBe("doc-old");
    expect(ledger.rows.has("lar:///new")).toBe(false);
    await out.commit();
    expect(ledger.rows.get("lar:///old")).toMatch(/^reminted-lar:\/\/\/old-/);
    expect(ledger.rows.get("lar:///new")).toMatch(/^fresh-lar:\/\/\/new-/);
  });

  test("CONTROL: an ordinary registration puts each row as it registers, and its commit moves nothing more", async () => {
    const ledger = ledgerOf({ "lar:///old": "doc-old" });
    const out = await registerBagsDurably({ provider: provider(), bags: ["lar:///old", "lar:///new"], ledger });
    expect(ledger.puts).toEqual(["lar:///old", "lar:///new"]);
    await out.commit();
    expect(ledger.puts).toHaveLength(2);
  });

  test("RED: the recard's stale pass holds its rows (the card first, then a held registration) and a refused landing commits none; past the archive check they rest", async () => {
    const ledger = ledgerOf({ "lar:///old": "doc-old" });
    const p = provider();
    const passes: boolean[] = [];
    let carded = false;
    // The first pass meets the fault; after the card, the registration runs again under the hold it was handed.
    const register = async (hold: boolean) => {
      passes.push(hold);
      if (!carded) throw new PrekeySecretAbsent("lar:///old");
      return registerBagsDurably({ provider: p, bags: ["lar:///old"], ledger, hold });
    };
    const recard = await recardRegistration(register, async () => { carded = true; }, "f".repeat(64));
    expect(passes, "a held pass, then a held one after the card").toEqual([true, true]);
    expect(recard).toMatchObject({ stale: true, reminted: ["lar:///old"] });
    expect(ledger.puts, "the stale pass rested no row").toEqual([]);
    // The Archive rested nothing: the landing refuses archive-unrested and the ledger stands as it stood.
    await expect(landRecard(recard, { wrote: [], refusals: [], barred: true }, "h2", 2)).rejects.toThrow(/archive-unrested[\s\S]*lares vault recard --face 2/);
    await expect(landRecard(recard, { wrote: [{}] as never, refusals: [{ message: "a row refused" }] as never, barred: false }, "h2", 2)).rejects.toThrow(/archive-unrested/);
    expect(ledger.rows.get("lar:///old")).toBe("doc-old");
    // The Archive rested: the held rows land.
    await landRecard(recard, { wrote: [{}] as never, refusals: [], barred: false }, "h2", 2);
    expect(ledger.rows.get("lar:///old")).toMatch(/^reminted-lar:\/\/\/old-/);
  });

  test("RED: the ground rows a clean first pass held wait when the face's own bags then meet the fault, and a refused landing commits none; past the archive check they rest", async () => {
    const ledger = ledgerOf();
    const ground = await recardRegistration((hold) => registerBagsDurably({ provider: provider(), bags: ["lar:///ground"], ledger, hold }), async () => { throw new Error("no card mints on a clean pass"); }, "f".repeat(64));
    expect(ground.stale).toBe(false);
    expect(ledger.puts, "the ground pass rested no row before the Archive").toEqual([]);
    // The face's own bags met the fault after the ground pass: the light turns the recard stale over the ground's held rows.
    const stale = { stale: true, reminted: ground.reminted, commit: ground.commit };
    await expect(landRecard(stale, { wrote: [], refusals: [], barred: true }, "h3", 3)).rejects.toThrow(/archive-unrested/);
    expect(ledger.rows.has("lar:///ground")).toBe(false);
    await landRecard(stale, { wrote: [{}] as never, refusals: [], barred: false }, "h3", 3);
    expect(ledger.rows.get("lar:///ground")).toMatch(/^fresh-lar:\/\/\/ground-/);
  });

  test("CONTROL: a recard that never meets the fault registers once, holding its rows, and lands them whatever its floor reads; a second fault after the card refuses still-refuses", async () => {
    const ledger = ledgerOf();
    const passes: boolean[] = [];
    const clean = await recardRegistration(async (hold) => { passes.push(hold); return registerBagsDurably({ provider: provider(), bags: ["lar:///new"], ledger, hold }); }, async () => { throw new Error("no card mints on a clean pass"); }, "f".repeat(64));
    expect(passes).toEqual([true]);
    expect(clean.stale).toBe(false);
    expect(ledger.puts).toEqual([]);
    await landRecard(clean, { wrote: [], refusals: [], barred: true }, "h1", 1);
    expect(ledger.puts).toEqual(["lar:///new"]);
    await expect(recardRegistration(async () => { throw new PrekeySecretAbsent("lar:///x"); }, async () => {}, "f".repeat(64))).rejects.toThrow(/still-refuses/);
  });
  test("a floor that throws during a recard refuses archive-unrested and names each held row it drops; the ledger stands as it stood", async () => {
    const ledger = ledgerOf({ "lar:///old": "doc-old" });
    const held = await recardRegistration(async (hold) => registerBagsDurably({ provider: provider(), bags: ["lar:///ground", "lar:///face"], ledger, hold }), async () => {}, "f".repeat(64));
    const refusal = recardFloorThrew(held, "h2", new Error("the rest door shut"), 2);
    expect(refusal.reason).toBe("archive-unrested");
    expect(refusal.message).toContain("lar:///ground, lar:///face");
    expect(refusal.message).toContain("the rest door shut");
    expect(ledger.puts).toEqual([]);
  });
});
