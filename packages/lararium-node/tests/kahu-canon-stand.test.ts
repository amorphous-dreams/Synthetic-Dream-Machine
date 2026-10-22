/**
 * kahu-canon-stand — W26 slice 3: a vessel holds the live `lares` and `lararium` documents only where the Kahu cabal
 * admitted its group. The registrations rest on the hearth's realm doc (landed at the founding); the vessel NAMES them at
 * boot from the realm, folded and seal-verified, and from no catalog row.
 *
 * Proven on a REAL one-seat founding: the founded face's group stands its canon (the two documents the realm
 * registered); CONTROLS: a place with no face, a group the cabal never admitted, a group the cabal removed and a bare
 * place with no charter each stand none.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PERSONA_GROUP_ID_TIDDLER, foldRealmBags, kahuRealmGroup, materializeSharedLarDoc, realmDocUrl, LARES_DOC_URI, LARARIUM_DOC_URI } from "@lararium/mesh";
import { standKahuCanon } from "../src/kahu-realm.js";
import { runCabalAct } from "../src/commands/nexus-cabal.js";
import { loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundHearthDirect } from "./found-route.js";

vi.setConfig({ testTimeout: 240_000, hookTimeout: 240_000 });
const GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const roots: string[] = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

function freshRoot(tag: string): string {
  const r = mkdtempSync(join(tmpdir(), `lar-kahu-canon-${tag}-`));
  cpSync(GENESIS, join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  roots.push(r);
  return r;
}
const groupPin = (): string => (JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text: string }> }).tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text;

describe("a vessel stands its system canon from the Kahu realm", () => {
  const r = freshRoot("a");

  test("the founded face's group stands both documents the realm registered; a place with no face and a group never admitted stand none", async () => {
    await withLarRoot(r, () => foundHearthDirect({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") }));
    await withLarRoot(r, async () => {
      const vesselKey = await loadVesselVerifyingKey();
      const stood = await ownedStore(larDataDir(), async (repo) => {
        const canon = await standKahuCanon({ repo, sealHome: larSealHome(), vesselKey, personaGroupId: groupPin() });
        const aid = (await import("../src/nexus-doc.js")).readNexusDoc(larSealHome())!.sealLineage![0]!.epochCid;
        const folded = await foldRealmBags((await materializeSharedLarDoc(repo, realmDocUrl(aid), "realm")).doc(), aid);
        return { canon, registered: { lares: folded.get(LARES_DOC_URI)?.docUrl, lararium: folded.get(LARARIUM_DOC_URI)?.docUrl } };
      });
      expect(stood.canon.lares).toBeDefined();
      expect(stood.canon.lararium).toBeDefined();
      expect(stood.canon).toEqual(stood.registered);
      expect(stood.canon.lares).not.toBe(stood.canon.lararium);
      await ownedStore(larDataDir(), async (repo) => {
        // CONTROLS: no face; a group the cabal never admitted
        expect(await standKahuCanon({ repo, sealHome: larSealHome(), vesselKey, personaGroupId: null })).toEqual({});
        expect(await standKahuCanon({ repo, sealHome: larSealHome(), vesselKey, personaGroupId: `0x${"ab".repeat(32)}` })).toEqual({});
        expect(await standKahuCanon({ repo, sealHome: larSealHome(), vesselKey, personaGroupId: "not-a-group" })).toEqual({});
      });
    });
  });

  test("a group the cabal REMOVES stands none; a bare place with no charter stands none (CONTROLS)", async () => {
    await withLarRoot(r, async () => {
      const vesselKey = await loadVesselVerifyingKey();
      const group = kahuRealmGroup(groupPin());
      await ownedStore(larDataDir(), async (repo) => {
        expect((await runCabalAct({ repo, sealHome: larSealHome(), group, action: "remove" })).landed).toBe(true);
        expect(await standKahuCanon({ repo, sealHome: larSealHome(), vesselKey, personaGroupId: groupPin() })).toEqual({});
      });
    });
    const bare = freshRoot("bare");
    await withLarRoot(bare, async () => {
      await ownedStore(larDataDir(), async (repo) => {
        expect(await standKahuCanon({ repo, sealHome: larSealHome(), vesselKey: "ab".repeat(32), personaGroupId: `0x${"cd".repeat(32)}` })).toEqual({});
      });
    });
  });
});
