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
 *   S4  RED: the steward's OWN seal over another document replayed into its row: the kept registration pins the canon,
 *       and the registry row reads the kept one again (a valid signature carries no freshness).
 *   S5  RED: a registration that stood before the hearth kept it is kept at the next standing read, so a later
 *       deletion of its row restores it.
 *   S6  RED: a kept file that does not verify (another document under the steward's name, or torn bytes) never lands
 *       on the registry and never throws the read.
 *   S7  each Kahu bag's document DERIVES from the steward's own per-Nexus leaf over the Nexus and the bag (`kahuBagDocUrl`),
 *       so every genuine steward seal names one document: an older seal over another document, alone on the registry with
 *       no kept copy, stands for nothing, and a founding retry registers the derived document again.
 *   S8  RED: no peer can compute that document before the steward publishes it: a document pre-seeded at the address a
 *       peer CAN compute from the Nexus and the bag never becomes the canon a founding retry registers.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LARARIUM_DOC_URI, LARES_DOC_URI, deterministicDocUrl, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, emptyLarDoc, foldRealmBags, materializeSharedLarDoc,
  realmBagKey, realmDocUrl, signRealmBagRegistration, writeRealmBagRegistration, type LarDoc, type RealmBagRegistration, type StewardSigner,
} from "@lararium/mesh";
import { kahuBagDocUrl, landKahuRealm, standKahuCanon } from "../src/kahu-realm.js";

/** The address any peer that knows the Nexus can compute for a bag (the realm doc's own seeding). */
const publicDocUrl = (nexus: string, bag: string): string => deterministicDocUrl(`${bag}#${nexus}`);
import { readNexusDoc } from "../src/nexus-doc.js";
import { mintNexusLeaf } from "../src/nexus-leaf.js";
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
  let founded: Promise<void> | null = null;

  type Scene = {
    repo: Parameters<typeof standKahuCanon>[0]["repo"]; aid: string; sealHome: string;
    realm: Awaited<ReturnType<typeof materializeSharedLarDoc>>;
    genuine: RealmBagRegistration; lararium: RealmBagRegistration;
    stand: () => ReturnType<typeof standKahuCanon>;
    rowOf: (bag: string, steward: string) => { docUrl?: string } | undefined;
    keptPath: (bag: string) => string;
  };
  /** One real founding for the file; each case opens the hearth's store on it and reads the genuine registrations off the kept files. */
  async function scene(fn: (s: Scene) => Promise<void>): Promise<void> {
    founded ??= withLarRoot(r, () => foundHearthDirect({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") })).then(() => undefined);
    await founded;
    await withLarRoot(r, async () => {
      const vesselKey = await loadVesselVerifyingKey();
      const sealHome = larSealHome();
      const aid = readNexusDoc(sealHome)!.sealLineage![0]!.epochCid;
      const keptPath = (bag: string) => join(sealHome, "nexus", "kahu-realm", aid, `${encodeURIComponent(bag)}.json`);
      await ownedStore(larDataDir(), async (repo) => {
        const realm = await materializeSharedLarDoc(repo, realmDocUrl(aid), "realm");
        // The founding's registration: the kept one where the hearth keeps it, else the registry's fold.
        const folded = await foldRealmBags(realm.doc(), aid);
        const founding = (bag: string): RealmBagRegistration =>
          existsSync(keptPath(bag)) ? JSON.parse(readFileSync(keptPath(bag), "utf8")) as RealmBagRegistration : folded.get(bag)!;
        const genuine = founding(LARES_DOC_URI), lararium = founding(LARARIUM_DOC_URI);
        const rowOf = (bag: string, steward: string) => {
          const row = realm.doc()?.tiddlers?.[realmBagKey(bag, steward)] as { text?: string; tiddler?: { text?: string } } | undefined;
          return row ? JSON.parse(row.text ?? row.tiddler?.text ?? "{}") as { docUrl?: string } : undefined;
        };
        await fn({ repo, aid, sealHome, realm, genuine, lararium, rowOf, keptPath,
          stand: () => standKahuCanon({ repo, sealHome, vesselKey, personaGroupId: groupPin() }) });
      });
    });
  }
  const freshDoc = async (repo: Scene["repo"]) => { const d = repo.create<LarDoc>(emptyLarDoc()); await d.whenReady(); return d.url; };

  test("S3 — CONTROL: the founding stands the registered documents; a bag the steward never sealed stands none", async () => {
    await scene(async ({ repo, aid, realm, genuine, lararium, stand }) => {
      expect(genuine.keptBy).toHaveLength(1);
      expect(await stand()).toEqual({ lares: genuine.docUrl, lararium: lararium.docUrl });
      const hand = await sibling(78);
      const stray = await signRealmBagRegistration({ realmId: aid, bagUri: "lar:///ha.ka.ba/bags/stray", docUrl: await freshDoc(repo), readTier: "contract" }, [hand]);
      realm.change((d) => writeRealmBagRegistration(d, stray, hand.signer, true));
      expect(await stand()).toEqual({ lares: genuine.docUrl, lararium: lararium.docUrl });
    });
  });

  test("S1 — a sibling-signed registration beside the genuine one leaves the canon the charter's own", async () => {
    await scene(async ({ repo, aid, realm, genuine, lararium, stand }) => {
      const hand = await sibling(77);
      const rec = await signRealmBagRegistration({ realmId: aid, bagUri: LARES_DOC_URI, docUrl: await freshDoc(repo), readTier: "contract" }, [hand]);
      realm.change((d) => writeRealmBagRegistration(d, rec, hand.signer, true));
      expect((await foldRealmBags(realm.doc(), aid)).get(LARES_DOC_URI), "the plain fold reads two docs under one name as none").toBeUndefined();
      expect(await stand()).toEqual({ lares: genuine.docUrl, lararium: lararium.docUrl });
    });
  });

  test("S2 — the genuine row deleted and a sibling's in its place: the canon reads the charter's own and the row stands again", async () => {
    await scene(async ({ repo, aid, realm, genuine, stand, rowOf }) => {
      const hand = await sibling(79);
      const rec = await signRealmBagRegistration({ realmId: aid, bagUri: LARES_DOC_URI, docUrl: await freshDoc(repo), readTier: "contract" }, [hand]);
      realm.change((d) => { writeRealmBagRegistration(d, rec, hand.signer, true); delete d.tiddlers[realmBagKey(LARES_DOC_URI, genuine.keptBy[0]!)]; });
      expect((await stand()).lares, "the canon still reads the charter's own").toBe(genuine.docUrl);
      expect(rowOf(LARES_DOC_URI, genuine.keptBy[0]!), "the steward restored its own row").toMatchObject({ docUrl: genuine.docUrl });
    });
  });

  test("S4 — the steward's own seal over another document, replayed into its row, never moves the canon", async () => {
    await scene(async ({ repo, aid, realm, genuine, stand, rowOf }) => {
      const leaf = await mintNexusLeaf(0, aid);
      const steward: StewardSigner = { signer: leaf.verifyingKey.toLowerCase(), sign: ed25519SignerFromSeed(leaf.seed) };
      expect(steward.signer).toBe(genuine.keptBy[0]!.toLowerCase());
      const older = await signRealmBagRegistration({ realmId: aid, bagUri: LARES_DOC_URI, docUrl: await freshDoc(repo), readTier: "contract" }, [steward]);
      realm.change((d) => writeRealmBagRegistration(d, older, steward.signer, true));
      expect((await stand()).lares, "the kept registration pins the canon").toBe(genuine.docUrl);
      expect(rowOf(LARES_DOC_URI, steward.signer), "the registry row reads the kept registration again").toMatchObject({ docUrl: genuine.docUrl });
    });
  });

  test("S5 — a registration that stood before the hearth kept it is kept at the next read, so a deleted row restores", async () => {
    await scene(async ({ realm, lararium, stand, rowOf, keptPath }) => {
      rmSync(keptPath(LARARIUM_DOC_URI));
      expect((await stand()).lararium).toBe(lararium.docUrl);
      expect(existsSync(keptPath(LARARIUM_DOC_URI)), "the standing read keeps the steward's registration").toBe(true);
      realm.change((d) => { delete d.tiddlers[realmBagKey(LARARIUM_DOC_URI, lararium.keptBy[0]!)]; });
      expect((await stand()).lararium, "the deleted row restores from the kept registration").toBe(lararium.docUrl);
      expect(rowOf(LARARIUM_DOC_URI, lararium.keptBy[0]!)).toMatchObject({ docUrl: lararium.docUrl });
    });
  });

  test("S6 — a kept file that does not verify never lands on the registry, and torn bytes never throw the read", async () => {
    await scene(async ({ repo, realm, genuine, stand, rowOf, keptPath }) => {
      const kept = readFileSync(keptPath(LARES_DOC_URI), "utf8");
      const forged = await freshDoc(repo);
      try {
        writeFileSync(keptPath(LARES_DOC_URI), JSON.stringify({ ...genuine, docUrl: forged }));
        realm.change((d) => { delete d.tiddlers[realmBagKey(LARES_DOC_URI, genuine.keptBy[0]!)]; });
        expect((await stand()).lares, "no forged document stands").toBeUndefined();
        expect(rowOf(LARES_DOC_URI, genuine.keptBy[0]!)?.docUrl, "the forged registration never reaches the registry").not.toBe(forged);
        writeFileSync(keptPath(LARES_DOC_URI), "{ torn");
        await expect(stand(), "torn kept bytes read as no kept registration").resolves.toBeDefined();
      } finally {
        writeFileSync(keptPath(LARES_DOC_URI), kept);
        expect((await stand()).lares, "the genuine kept registration restores the canon").toBe(genuine.docUrl);
      }
    });
  });

  test("S7 — the Kahu documents derive from the Nexus: a lone older seal names nothing, and a founding retry mints no replacement", async () => {
    await scene(async ({ repo, aid, sealHome, realm, genuine, stand, keptPath }) => {
      const derived = await kahuBagDocUrl(aid, LARES_DOC_URI);
      expect(genuine.docUrl, "the founding registered the derived document").toBe(derived);
      const leaf = await mintNexusLeaf(0, aid);
      const steward: StewardSigner = { signer: leaf.verifyingKey.toLowerCase(), sign: ed25519SignerFromSeed(leaf.seed) };
      const older = await signRealmBagRegistration({ realmId: aid, bagUri: LARES_DOC_URI, docUrl: await freshDoc(repo), readTier: "contract" }, [steward]);
      rmSync(keptPath(LARES_DOC_URI));
      realm.change((d) => writeRealmBagRegistration(d, older, steward.signer, true));
      expect((await stand()).lares, "a lone seal over another document stands for nothing").not.toBe(older.docUrl);
      const landed = await landKahuRealm({ repo, sealHome });
      expect(landed.docs.lares, "the retry registers the derived document").toBe(derived);
      expect((await stand()).lares).toBe(derived);
    });
  });

  test("S8 — a document pre-seeded at the address a peer can compute never becomes the canon", async () => {
    await scene(async ({ repo, aid, sealHome, realm, genuine, stand, keptPath }) => {
      const HOSTILE = "lar:///ha.ka.ba/lares/hostile";
      const squat = await materializeSharedLarDoc(repo, publicDocUrl(aid, LARES_DOC_URI) as never, "squat");
      squat.change((d) => { d.tiddlers[HOSTILE] = { tiddler: { title: HOSTILE, text: "placed by a peer" } } as never; });
      rmSync(keptPath(LARES_DOC_URI));
      realm.change((d) => { delete d.tiddlers[realmBagKey(LARES_DOC_URI, genuine.keptBy[0]!)]; });
      const landed = await landKahuRealm({ repo, sealHome });
      expect(landed.docs.lares, "the canon is not the peer-computable document").not.toBe(publicDocUrl(aid, LARES_DOC_URI));
      expect((await repo.find<LarDoc>(landed.docs.lares)).doc()?.tiddlers?.[HOSTILE], "no peer-placed record mounts as canon").toBeUndefined();
      expect((await stand()).lares).toBe(landed.docs.lares);
    });
  });
});

