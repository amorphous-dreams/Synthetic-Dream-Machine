/**
 * kahu-canon-stewards — THE KAHU CANON'S STEWARD IS THE CHARTER'S OWN, NEVER A SELF-NAMED HAND (Sol's blocker on the
 * founding walk, 2026-10-30; canon: kahu.mem "sealed by persona zero's per-Nexus key as the steward … kept by that one
 * name"; the one-owner-per-registry law).
 *
 * `foldRealmBags` verifies each self-named steward's seal and never that the steward holds the hearth's Kahu canon, so
 * a peer with sync-write on the realm registry could sign its own registration for `@lares`: beside the genuine row it
 * made the bag equivocal (two docs under one name → absent), and in place of the genuine row it made its chosen document
 * stand; the seats then signed poisoned canon into every admit. The cure: the hearth's canon reads only registrations
 * kept by exactly its Kahu steward (persona zero's per-Nexus leaf at the hearth's Nexus), and the hearth keeps the
 * registrations it sealed and restores a row a hostile hand deleted.
 *
 *   S1  RED: a sibling-signed registration for `@lares` beside the genuine one leaves the canon the charter's own.
 *   S2  RED: the genuine row deleted and the sibling's in its place: the canon still reads the charter's own, and the
 *       realm doc holds the genuine row again (the steward restores its own seal).
 *   S3  CONTROL: untouched, `@lararium` reads the registered document; a bag the steward never sealed stands none.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LARARIUM_DOC_URI, LARES_DOC_URI, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc, foldRealmBags, materializeSharedLarDoc,
  realmBagKey, realmDocUrl, signRealmBagRegistration, writeRealmBagRegistration, type LarDoc, type StewardSigner,
} from "@lararium/mesh";
import { standKahuCanon } from "../src/kahu-realm.js";
import { readNexusDoc } from "../src/nexus-doc.js";
import { loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundHearthDirect } from "./found-route.js";
import { readFileSync } from "node:fs";
import { PERSONA_GROUP_ID_TIDDLER } from "@lararium/mesh";

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });
const GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const roots: string[] = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
const groupPin = (): string => (JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text: string }> }).tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text;

/** A hand that is NOT the hearth's Kahu steward: its own face-class key, sealing its own registration. */
async function sibling(seedByte: number): Promise<StewardSigner> {
  const seed = new Uint8Array(32).fill(seedByte);
  const sign = ed25519SignerFromSeed(seed);
  return { signer: (await ed25519VerifyingKeyFromSeed(seed)).toLowerCase(), sign: async (bytes) => { const sig = await sign(bytes); return typeof sig === "string" ? sig : Array.from(sig as Uint8Array, (b) => b.toString(16).padStart(2, "0")).join(""); } };
}

describe("the Kahu canon reads only its charter's steward", () => {
  const r = mkdtempSync(join(tmpdir(), "lar-kahu-stewards-"));
  cpSync(GENESIS, join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  roots.push(r);

  test("S1/S2/S3 on a real founding", async () => {
    await withLarRoot(r, () => foundHearthDirect({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") }));
    await withLarRoot(r, async () => {
      const vesselKey = await loadVesselVerifyingKey();
      const sealHome = larSealHome();
      const aid = readNexusDoc(sealHome)!.sealLineage![0]!.epochCid;
      const stand = (repo: Parameters<typeof standKahuCanon>[0]["repo"]) => standKahuCanon({ repo, sealHome, vesselKey, personaGroupId: groupPin() });
      await ownedStore(larDataDir(), async (repo) => {
        const realm = await materializeSharedLarDoc(repo, realmDocUrl(aid), "realm");
        const genuine = (await foldRealmBags(realm.doc(), aid)).get(LARES_DOC_URI)!;
        const lararium = (await foldRealmBags(realm.doc(), aid)).get(LARARIUM_DOC_URI)!;
        expect(genuine.keptBy).toHaveLength(1);
        const before = await stand(repo);
        expect(before).toEqual({ lares: genuine.docUrl, lararium: lararium.docUrl });   // CONTROL: the registered documents

        // S1: a sibling seals its own registration for @lares, naming another document, beside the genuine row.
        const hand = await sibling(77);
        const poison = repo.create<LarDoc>(emptyLarDoc());
        await poison.whenReady();
        const rec = await signRealmBagRegistration({ realmId: aid, bagUri: LARES_DOC_URI, docUrl: poison.url, readTier: "contract" }, [hand]);
        realm.change((d) => writeRealmBagRegistration(d, rec, hand.signer, true));
        expect((await foldRealmBags(realm.doc(), aid)).get(LARES_DOC_URI), "the plain fold reads two docs under one name as none").toBeUndefined();
        const beside = await stand(repo);
        expect(beside.lares, "S1: the canon stays the charter's own beside a sibling's row").toBe(genuine.docUrl);
        expect(beside.lararium).toBe(lararium.docUrl);

        // S2: the genuine row deleted; the sibling's stands alone on the registry.
        realm.change((d) => { delete d.tiddlers[realmBagKey(LARES_DOC_URI, genuine.keptBy[0]!)]; });
        expect((await foldRealmBags(realm.doc(), aid)).get(LARES_DOC_URI)?.docUrl, "the plain fold now reads the sibling's document").toBe(poison.url);
        const replaced = await stand(repo);
        expect(replaced.lares, "S2: the canon still reads the charter's own").toBe(genuine.docUrl);
        const restored = realm.doc()?.tiddlers?.[realmBagKey(LARES_DOC_URI, genuine.keptBy[0]!)];
        expect(restored, "S2: the steward restored its own row").toBeDefined();
        expect(JSON.parse((restored as { text?: string; tiddler?: { text?: string } })?.text ?? (restored as { tiddler?: { text?: string } })?.tiddler?.text ?? "{}") as { docUrl?: string }).toMatchObject({ docUrl: genuine.docUrl });

        // S3: a bag the steward never sealed stands none, whatever a sibling writes.
        const strayDoc = repo.create<LarDoc>(emptyLarDoc());
        await strayDoc.whenReady();
        const stray = await signRealmBagRegistration({ realmId: aid, bagUri: "lar:///ha.ka.ba/bags/stray", docUrl: strayDoc.url, readTier: "contract" }, [hand]);
        realm.change((d) => writeRealmBagRegistration(d, stray, hand.signer, true));
        expect(await stand(repo)).toEqual({ lares: genuine.docUrl, lararium: lararium.docUrl });
      });
    });
  });
});
