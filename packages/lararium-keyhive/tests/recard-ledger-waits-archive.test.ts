/**
 * recard-ledger-waits-archive — A RECARD'S LEDGER ROWS WAIT FOR ITS ARCHIVE (course recard-ledger-trails-archive; Card-Reader's
 * custody read of #506, F5). The stale pass of a recard reminted Documents whose keys only the Archive after its card holds, and
 * `registerBagsDurably` put each reminted docId into the vessel-ground ledger before that Archive rested; an `archive-unrested`
 * refusal then left the ledger ahead of the Archive. A held registration puts nothing: it hands back the rows and a `commit` the
 * caller runs once the Archive rests, so a refused recard leaves the ledger as it stood.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerBagsDurably, type BagDocLedger } from "../src/index.js";
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

  test("the wiring: the recard's stale pass holds its rows, and the light commits them only past the archive-unrested check", () => {
    const boot = readFileSync(join(import.meta.dirname, "..", "src", "boot-daemon-keyhive.ts"), "utf8");
    expect(boot).toMatch(/recard = \{ stale: true, \.\.\.\(await register\(true\)\) \}/);
    const light = readFileSync(join(import.meta.dirname, "..", "src", "operator-daemon-behavior.ts"), "utf8");
    const at = light.indexOf('new FaceRecardRefused("archive-unrested"');
    const commit = light.indexOf("await recard.commit()", at);
    expect(at, "the archive-unrested refusal stands").toBeGreaterThan(0);
    expect(commit, "the commit runs after the refusal check, never before").toBeGreaterThan(at);
  });
});
