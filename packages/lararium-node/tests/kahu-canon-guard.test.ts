/**
 * kahu-canon-guard — THE KAHU CANON IS CLASSED BY DOCUMENT IDENTITY AND DECIDED LIVE, by one guard at the head of the share
 * verdict (road `P26`; controller design ruling 2026-10-31 after Sol's revision read).
 *
 * Classification rode present standing or a title, never the document's identity, so two lanes crossed past the live reach:
 *   (A) a catalog ALIAS: while admitted, a same-face session lands a catalog row pointing at the live canon; after a counted
 *       removal the bridge (`bridgeBooks`) still names that document by the alias's title, and the same-operator lane
 *       returns before the realm gate;
 *   (B) REMOVAL THEN REBOOT: the keel stands no canon for a removed group, the realm gate's consult names none, and the
 *       retained replica reads as an ordinary registered book that the Nexus lane opens to any admitted member.
 * The cure: the vessel derives the canon's ids durably (`kahuProtectedDocIds`: the founding's derivation under every held key,
 * and every document a kept registration names), and ONE guard (`protectedDocGuard`, mesh) withholds a classed document from
 * every wire peer whose class decider (here `kahuHandAtWire`, live) does not hold, ahead of every lane.
 *
 *   A0  MEASURE (Sol's path, on the parent and after): with a guard that classes nothing, the alias crosses the same-face
 *       lane. (A guard that has not stood withholds every wire ask, T22, so the measure seats the inert one.)
 *   A1  RED: after removal, a catalog alias of the live canon crosses the same-face lane no more.
 *   A2  CONTROL: a live Kahu hand still reads the canon through that lane.
 *   B1  RED: after a counted removal and a fresh read off disk (the reboot), the protected set still names both canon ids.
 *   B2  RED: an ordinary admitted peer, whom the Nexus lane opens, asks a retained canon id and draws denial.
 *   B3  CONTROL: an ordinary book still crosses to that peer; a live Kahu hand still reads the canon.
 * On the parent the guard and the protected set do not exist, so every case reads red at the missing name.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { interpretAsDocumentId, type DocumentId } from "@automerge/automerge-repo";
import * as mesh from "@lararium/mesh";
import { deterministicDocUrl, storedLarRecord, PERSONA_GROUP_ID_TIDDLER, type FederationGate, type LarDoc } from "@lararium/mesh";
import * as kahuRealm from "../src/kahu-realm.js";
import { standKahuCanon } from "../src/kahu-realm.js";
import { bridgeBooks } from "../src/face-fleet-view.js";
import { selfSlotShareDecision, NO_BANS, NOBODY_ASIDE, NOTHING_CLASSED } from "../src/self-slot-share.js";
import { runCabalAct } from "../src/commands/nexus-cabal.js";
import { loadVesselVerifyingKey } from "../src/node-vessel-identity.js";
import { ownedStore } from "../src/owned-store.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundHearthDirect } from "./found-route.js";

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });
type Guard = { withholds(peerId: string, documentId: string | undefined): Promise<boolean> };
type GuardFn = (opts: { ids: () => ReadonlyMap<string, "kahu-canon">; decide: { "kahu-canon": (peerId: string) => boolean | Promise<boolean> } }) => Guard;
const guardOf = (mesh as unknown as { protectedDocGuard?: GuardFn }).protectedDocGuard;
const protectedIds = (kahuRealm as unknown as { kahuProtectedDocIds?: (opts: { sealHome: string }) => Promise<ReadonlySet<string>> }).kahuProtectedDocIds;
const idOf = (url: string): string => String(interpretAsDocumentId(url as never));
const gateOver = (ids: ReadonlySet<string>): FederationGate => ({ mayFederate: async (documentId) => ids.has(String(documentId)) });
const open: FederationGate = { mayFederate: async () => true };

/** One verdict as the composer asks it, the guard seated where the composer seats it. */
const verdict = (o: { guard: Guard | null; sessionFace?: FederationGate; fed?: FederationGate; peerClass: "same-operator" | "contracted"; documentId: string }) =>
  selfSlotShareDecision({
    hasWsSocket: true, peerClass: o.peerClass, selfSlotFedGate: o.fed ?? null, antigenRing: NO_BANS, membership: null, planeSeal: null,
    peerId: "peer", documentId: o.documentId as DocumentId, sessionFace: o.sessionFace ?? null,
    ...({ protectedDocs: o.guard } as object),
    shadow: NOBODY_ASIDE,
  } as Parameters<typeof selfSlotShareDecision>[0]);

describe("the Kahu canon is classed by identity and decided live, by one guard", () => {
  const canonUrl = deterministicDocUrl("guard-live-lares");
  /** A catalog an admitted same-face session wrote while admitted: an ordinary title pointing at the live canon. */
  const aliasCatalog = { tiddlers: { "lar:///ha.ka.ba/bags/notes": storedLarRecord("lar:///ha.ka.ba/bags/notes", { text: canonUrl }, "alias") } } as unknown as LarDoc;

  test("A0 — MEASURE: with a guard that classes nothing, a catalog alias carries the canon across the same-face lane after removal", async () => {
    const sessionFace = gateOver(bridgeBooks(aliasCatalog, {}));
    expect(await verdict({ guard: NOTHING_CLASSED, sessionFace, peerClass: "same-operator", documentId: idOf(canonUrl) })).toBe(true);
  });

  test("A1/A2 — a catalog alias crosses the same-face lane only while the Kahu hand holds live", async () => {
    expect(typeof guardOf, "protectedDocGuard stands").toBe("function");
    const sessionFace = gateOver(bridgeBooks(aliasCatalog, {}));          // after removal: the canon argument reads empty
    expect(await sessionFace.mayFederate(idOf(canonUrl) as DocumentId), "the alias alone names the canon on the bridge").toBe(true);
    let held = false;
    const guard = guardOf!({ ids: () => new Map([[idOf(canonUrl), "kahu-canon"]]), decide: { "kahu-canon": () => held } });
    expect(await verdict({ guard, sessionFace, peerClass: "same-operator", documentId: idOf(canonUrl) }), "A1: removed").toBe(false);
    held = true;
    expect(await verdict({ guard, sessionFace, peerClass: "same-operator", documentId: idOf(canonUrl) }), "A2: a live Kahu hand").toBe(true);
  });

  const r = mkdtempSync(join(tmpdir(), "lar-kahu-guard-"));
  cpSync(join(import.meta.dirname, "..", "..", "..", "genesis"), join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  afterAll(() => { rmSync(r, { recursive: true, force: true }); });
  const groupPin = (): string => (JSON.parse((JSON.parse(readFileSync(larBootstrapPath(), "utf8")) as { text: string }).text) as { tiddlers: Record<string, { text: string }> }).tiddlers[PERSONA_GROUP_ID_TIDDLER]!.text;

  test("B1–B3 — removal then reboot: the retained canon stays classed, and an ordinary admitted peer draws denial", async () => {
    expect(typeof guardOf, "protectedDocGuard stands").toBe("function");
    expect(typeof protectedIds, "kahuProtectedDocIds stands").toBe("function");
    await withLarRoot(r, () => foundHearthDirect({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") }));
    await withLarRoot(r, async () => {
      const sealHome = larSealHome();
      const vesselKey = await loadVesselVerifyingKey();
      let canon: { lares?: string; lararium?: string } = {};
      await ownedStore(larDataDir(), async (repo) => {
        canon = await standKahuCanon({ repo, sealHome, vesselKey, personaGroupId: groupPin() });
        expect(canon.lares && canon.lararium, "the founding stands its canon").toBeTruthy();
        await runCabalAct({ repo, sealHome, group: groupPin().replace(/^0x/, ""), action: "remove" });
        expect(await standKahuCanon({ repo, sealHome, vesselKey, personaGroupId: groupPin() }), "the keel stands none after removal").toEqual({});
      });
      // THE REBOOT: the protected set read afresh off disk, with no standing and no keel canon to lean on.
      const ids = await protectedIds!({ sealHome });
      expect(ids.has(idOf(canon.lares!)) && ids.has(idOf(canon.lararium!)), "B1: both retained canon ids stay classed").toBe(true);
      let held = false;
      const guard = guardOf!({ ids: () => new Map([...ids].map((id) => [id, "kahu-canon" as const])), decide: { "kahu-canon": () => held } });
      for (const url of [canon.lares!, canon.lararium!]) {
        expect(await verdict({ guard, fed: open, peerClass: "contracted", documentId: idOf(url) }), `B2: ${url}`).toBe(false);
      }
      const ordinary = deterministicDocUrl("an-ordinary-book");
      expect(await verdict({ guard, fed: open, peerClass: "contracted", documentId: idOf(ordinary) }), "B3: an ordinary book crosses").toBe(true);
      held = true;
      expect(await verdict({ guard, fed: open, peerClass: "contracted", documentId: idOf(canon.lares!) }), "B3: a live Kahu hand reads").toBe(true);
    });
  });
});
