/**
 * kahua-promoted-store — the device-local trust record at rest and the CAS door a promotion writes through.
 *
 * The ledger and the kāpae cache rest as sealed custody rows named by the PersonaGroup digest, in the face's own folder, and ride
 * no CRDT document and no face bundle. A locked vessel refuses a read and never reads empty. The CAS door writes only bytes that
 * hash to their digest, and pins them against the sweep. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, ledgerCommit, kahuaPromotionDigest, type PromoteWho } from "@lararium/mesh";
import { seatHostingCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { KAHUA_PROMOTED_FILE, KAHUA_KAPAE_FILE, kahuaPromotedFile, kahuaKapaeFile, nodeKahuaCas, nodeKahuaStores } from "../src/kahua-promoted-store.js";
import { readCasPins, readVerifiedCasBlobFromFs } from "../src/node-cas.js";

const HAND: PromoteWho = { kind: "hand", id: "hand-1" };
const RITE = { title: "rites/a", text: "exports.startup = function(){ /* SECRET-RITE-BODY */ }", fields: { "module-type": "startup" } };
const ledgerWith = () => ledgerCommit(EMPTY_LEDGER, { digest: kahuaPromotionDigest(RITE), item: RITE, revision: "a".repeat(64) }, HAND);
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

let seat: SeatedScratchCustody | null = null;
afterEach(async () => { await seat?.drop(); seat = null; });

describe("the ledger and the cache at rest", () => {
  test("RED: an unwritten group reads the empty ledger and the empty cache; a written one reads back whole; CONTROL: a second group stays separate", async () => {
    seat = await seatHostingCustody("promoted");
    const a = nodeKahuaStores("group-a"), b = nodeKahuaStores("group-b");
    expect(await a.ledger.read()).toEqual(EMPTY_LEDGER);
    expect(await a.local.read()).toEqual(EMPTY_KAPAE_LOCAL);
    await a.ledger.write(ledgerWith());
    await a.local.write({ shadowed: [kahuaPromotionDigest(RITE)], queue: [] });
    expect(await a.ledger.read()).toEqual(ledgerWith());
    expect((await a.local.read()).shadowed).toEqual([kahuaPromotionDigest(RITE)]);
    expect(await b.ledger.read()).toEqual(EMPTY_LEDGER);
    expect(kahuaPromotedFile("group-a")).toMatch(KAHUA_PROMOTED_FILE);
    expect(kahuaKapaeFile("group-a")).toMatch(KAHUA_KAPAE_FILE);
    expect(kahuaPromotedFile("group-a")).not.toBe(kahuaPromotedFile("group-b"));
  });

  test("RED: the ledger file rests sealed (no promoted body in the clear anywhere under the homes); CONTROL: the opened row holds the body", async () => {
    seat = await seatHostingCustody("promoted-rest");
    const stores = nodeKahuaStores("group-a");
    await stores.ledger.write(ledgerWith());
    const files = walk(seat.root).filter((f) => f.includes("kahua-promoted-g"));
    expect(files).toHaveLength(1);
    for (const f of walk(seat.root)) expect(readFileSync(f).includes("SECRET-RITE-BODY"), f).toBe(false);
    expect((await stores.ledger.read()).rows[0]!.bytes).toContain("SECRET-RITE-BODY");
  });

  test("RED: a locked vessel refuses the read and never reads empty; CONTROL: the unlocked vessel reads", async () => {
    seat = await seatHostingCustody("promoted-locked");
    const stores = nodeKahuaStores("group-a");
    await stores.ledger.write(ledgerWith());
    await expect(stores.ledger.read()).resolves.toBeTruthy();
    await seat.holder.lock();
    await expect(stores.ledger.read()).rejects.toThrow();
    await expect(stores.local.read()).rejects.toThrow();
  });
});

describe("the CAS door", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const casDir = () => { const d = mkdtempSync(join(tmpdir(), "lar-promote-cas-")); dirs.push(d); return join(d, "cas"); };

  test("RED: put writes the bytes under their digest and pin holds them against the sweep; CONTROL: bytes that hash elsewhere throw `cas-digest-mismatch` and write nothing", () => {
    const dir = casDir();
    const cas = nodeKahuaCas(dir, "vessel-key");
    const bytes = new TextEncoder().encode("{\"title\":\"rites/a\",\"text\":\"x\"}");
    const digest = createHash("sha256").update(bytes).digest("hex");
    cas.put(digest, bytes);
    cas.pin(digest);
    expect(readVerifiedCasBlobFromFs(digest, dir)).toEqual(bytes);
    expect(readCasPins(dir).map((p) => p.cid)).toEqual([digest]);
    expect(() => cas.put("0".repeat(64), bytes)).toThrow(/cas-digest-mismatch/);
    expect(existsSync(join(dir, "0".repeat(64)))).toBe(false);
    cas.put(digest, bytes);
    expect(readCasPins(dir)).toHaveLength(1);
  });
});
