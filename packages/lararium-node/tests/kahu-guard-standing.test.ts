/**
 * kahu-guard-standing — THE GUARD SERVES THE COUNT THAT STANDS AFTER A WRITE, AND DECIDES EACH DOCUMENT ON ITS OWN HOME'S
 * STANDING (road `P26`; Sol's lanes read, SHOULDs 2 and 3).
 *
 *   T2  RED (recount before serve): a kept registration written a moment ago is withheld by the very next ask, with no
 *       caller waiting on the recount; the guard waits for the holder's recount before it classes.
 *   T3a RED (carried-home standing): the holder names the home Nexus each protected id was classed under: a carried home's
 *       kept registration names that home's Nexus, never the primary's.
 *   T3b RED: the guard hands the document to its class's decider, so a decider can read the standing of THAT document's
 *       home: primary admission live and carried-home admission closed withholds the carried document alone.
 *   T4  RED (Sol BLOCKER 3): a classification write queued AFTER an ask began, before that ask resumed, still classes the
 *       ask: the guard serves the count only once no recount queued before its read stays pending.
 *   T5  RED (Sol BLOCKER 4): a charter roll re-reads EVERY home's standing, the carried homes' with the primary's; each
 *       document reads its own home's watch.
 */
import { afterAll, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { interpretAsDocumentId, type AutomergeUrl } from "@automerge/automerge-repo";
import * as mesh from "@lararium/mesh";
import { LARES_DOC_URI, hex, protectedDocGuard, signRealmBagRegistration } from "@lararium/mesh";
import * as kahuRealm from "../src/kahu-realm.js";
import { kahuProtectedHolder, keepKahuRegistration } from "../src/kahu-realm.js";

const roots: string[] = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
const idOf = (url: string): string => String(interpretAsDocumentId(url as AutomergeUrl));
async function registration(nexus: string, docUrl: string, bag = LARES_DOC_URI) {
  const seed = new Uint8Array(32).fill(5);
  return signRealmBagRegistration({ realmId: nexus, bagUri: bag, docUrl, readTier: "contract" },
    [{ signer: hex(await ed.getPublicKeyAsync(seed)), sign: (b: Uint8Array) => ed.signAsync(b, seed).then(hex) }]);
}
type GuardOptions = Parameters<typeof protectedDocGuard>[0];

describe("the guard serves the standing count and each document's own home", () => {
  test("T2 — RED: a registration written a moment ago is withheld by the next ask, with no caller awaiting the recount", async () => {
    const sealHome = mkdtempSync(join(tmpdir(), "lar-kahu-timing-")); roots.push(sealHome);
    const holder = kahuProtectedHolder({ sealHome, canon: () => ({}) });
    try {
      await holder.recount();
      const guard = protectedDocGuard({ ids: () => holder.ids(), settled: () => holder.settled(), decide: { "kahu-canon": () => false } } as GuardOptions);
      const doc = mesh.deterministicDocUrl("a-just-kept-canon");
      keepKahuRegistration(sealHome, await registration("nexus-" + "a7".repeat(32), doc));
      expect(await guard.withholds("member", idOf(doc)), "T2: withheld at once").toBe(true);
    } finally { holder.close(); }
  });

  test("T3a — RED: the holder names a carried home's Nexus for the id its kept registration classes", async () => {
    const sealHome = mkdtempSync(join(tmpdir(), "lar-kahu-home-")); roots.push(sealHome);
    const carried = "nexus-" + "c3".repeat(32);
    const doc = mesh.deterministicDocUrl("a-carried-home-canon");
    const dir = join(sealHome, "carried", carried, "nexus", "kahu-realm", carried);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${encodeURIComponent(LARES_DOC_URI)}.json`), JSON.stringify(await registration(carried, doc)));
    const holder = kahuProtectedHolder({ sealHome, canon: () => ({}) }) as ReturnType<typeof kahuProtectedHolder> & { homeOf?: (id: string) => string | null };
    try {
      await holder.recount();
      expect(holder.ids().has(idOf(doc))).toBe(true);
      expect(typeof holder.homeOf, "homeOf stands").toBe("function");
      expect(holder.homeOf!(idOf(doc)), "T3a: the carried home's Nexus").toBe(carried);
    } finally { holder.close(); }
  });

  test("T3b — RED: the decider reads the document: the primary home's admission live, the carried home's closed", async () => {
    const primaryDoc = idOf(mesh.deterministicDocUrl("primary-canon"));
    const carriedDoc = idOf(mesh.deterministicDocUrl("carried-canon"));
    const home = new Map([[primaryDoc, "nexus-primary"], [carriedDoc, "nexus-carried"]]);
    const admitted = new Set(["nexus-primary"]);
    const guard = protectedDocGuard({
      ids: () => new Map([[primaryDoc, "kahu-canon" as const], [carriedDoc, "kahu-canon" as const]]),
      decide: { "kahu-canon": ((_peer: string, documentId: string) => admitted.has(home.get(documentId) ?? "")) as never },
    });
    expect(await guard.withholds("kahu-hand", primaryDoc), "T3b CONTROL: the primary canon crosses").toBe(false);
    expect(await guard.withholds("kahu-hand", carriedDoc), "T3b: the carried canon withholds").toBe(true);
  });

  test("T4 — RED: a write queued after the ask began, before it resumed, still classes that ask", async () => {
    const sealHome = mkdtempSync(join(tmpdir(), "lar-kahu-burst-")); roots.push(sealHome);
    const holder = kahuProtectedHolder({ sealHome, canon: () => ({}) }) as ReturnType<typeof kahuProtectedHolder> & { pending?: () => boolean };
    try {
      await holder.recount();
      const doc = mesh.deterministicDocUrl("a-burst-kept-canon");
      const rec = await registration("nexus-" + "b4".repeat(32), doc);
      const guard = protectedDocGuard({ ids: () => holder.ids(), settled: () => holder.settled(), ...(holder.pending ? { pending: () => holder.pending!() } : {}), decide: { "kahu-canon": () => false } } as GuardOptions);
      const asked = guard.withholds("member", idOf(doc));       // the ask begins and captures what stands
      keepKahuRegistration(sealHome, rec);                       // a classification write lands before the ask resumes
      expect(await asked, "T4: the ask waits for the later write's recount").toBe(true);
    } finally { holder.close(); }
  });

  test("T5 — RED: a roll refreshes every home's standing; each document reads its own home", () => {
    const book = (kahuRealm as unknown as { kahuStandingBook?: () => {
      setPrimary(w: object): void; addCarried(nexus: string, w: object): void; heldAt(nexus: string | null): boolean; refreshAll(): void;
    } }).kahuStandingBook;
    expect(typeof book, "kahuStandingBook stands").toBe("function");
    const watch = (nexus: string, initially: boolean) => {
      let held = initially, board = initially;
      return { nexus, held: () => held, refresh: () => { held = board; }, close: () => {}, roll: (to: boolean) => { board = to; } };
    };
    const primary = watch("nexus-primary", true), carried = watch("nexus-carried", true);
    const b = book!();
    b.setPrimary(primary); b.addCarried("nexus-carried", carried);
    expect(b.heldAt("nexus-carried"), "CONTROL: the carried home stands admitted").toBe(true);
    carried.roll(false);                                         // the carried charter rolls; no board event follows
    b.refreshAll();                                              // the roll hook
    expect(b.heldAt("nexus-carried"), "T5: the roll re-reads the carried home").toBe(false);
    expect(b.heldAt(null), "T5: the primary (keel canon) reads its own").toBe(true);
    expect(b.heldAt("nexus-primary"), "T5: the primary by name").toBe(true);
    expect(b.heldAt("nexus-unwatched"), "T5: an unwatched home reads not admitted").toBe(false);
  });
});
