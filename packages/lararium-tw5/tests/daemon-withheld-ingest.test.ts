/**
 * THE DAEMON DOCUMENT TAKES NOTHING FROM DISK, at the island, whatever its caller scanned: placement decides.
 *
 * Every disk-to-store road rides one INGEST wave: `lares ingest`, `lares shore take-disk`, a canon mirror's ingest-back,
 * `lares import`. The island admits a wave only where the vessel grants a mirror for that destination and the source
 * rests under it. The daemon document (`bags/daemon`) carries no mirror and no canon role, so every wave into it refuses
 * by placement (`disk-wave-placement`); the face's daemon canon (`bags/daemon-<F>`) carries its own mirror and takes any
 * title as ordinary content, a cap-shaped or seal-shaped title included.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, daemonFaceCanonBag, isEffectRecordUri, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { registerActionReactors, makeTw5Deserializer } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
const ctx = (composite: CompositeStore, args: Record<string, unknown>): VerbContext => ({
  daemon: composite,
  invocation: { requestId: "req-withheld", title: "lar:///lararium.local.vm/verbs/req-withheld", action: "INGEST", args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-11-08T00:00:00Z" } as Verb,
  cap: allowCap,
});
const CAP = `${DAEMON_BAG_ID}/cap/0123456789abcdef01234567/deadbeef`;
const SEAL = "lar:///ha.ka.ba/bags/persona/group-secret/abc";
const CHECKPOINT = "lar:///ha.ka.ba/dreamnet/face-founding-checkpoint/c1";
const MEMORY = "lar:///ha.ka.ba/kahua/memory/heron";
const tid = (title: string): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\nwords\n`;
const carrier = (uri: string) => ({ uri, file: `/scratch/${uri.split("/").pop()}.tid`, text: tid(uri), diskHash: carrierHash(tid(uri)), syncedHash: null, ext: ".tid" });

describe.skipIf(wikiSkip)(`the island admits a disk wave by placement alone${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);

  function rig(bag: string, diskMirrors?: readonly { bagId: string; mirrorRoot: string; scope: string }[]) {
    const composite = new CompositeStore();
    const store = new MemoryTiddlerStore(bag);
    composite.addLayer({ bagId: bag, store, writable: true });
    const table = new VerbTable();
    registerActionReactors(table, { composite, tw5: makeTw5Deserializer(engine), ...(diskMirrors ? { diskMirrors } : {}) });
    return { composite, store, table, carriersIn: async () => (await store.listVisible()).filter((t) => !isEffectRecordUri(t)).sort() };
  }

  test("RED: an INGEST into bags/daemon refuses by placement, its mirror-shaped source notwithstanding; CONTROL: the face's daemon canon takes the same titles as ordinary content", async () => {
    const CANON = daemonFaceCanonBag("7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31");
    const mirrors = [{ bagId: CANON, mirrorRoot: "/scratch/daemon-canon", scope: "daemon-canon" }];
    const daemonRig = rig(DAEMON_BAG_ID, mirrors);
    const toDaemon = { "source-uri": "/scratch/daemon-canon", "to-bag": DAEMON_BAG_ID, "change-id": "chg-w", carriers: [CAP, SEAL, CHECKPOINT, MEMORY].map(carrier) };
    await expect(daemonRig.table.get("INGEST")!(toDaemon, ctx(daemonRig.composite, toDaemon))).rejects.toMatchObject({ code: "disk-wave-placement" });
    expect(await daemonRig.carriersIn()).toEqual([]);

    const canonRig = rig(CANON, mirrors);
    const toCanon = { ...toDaemon, "to-bag": CANON, "change-id": "chg-w-canon" };
    const rows = (await canonRig.table.get("INGEST")!(toCanon, ctx(canonRig.composite, toCanon)) as Record<string, unknown>)["carriers"] as Array<Record<string, unknown>>;
    for (const t of [CAP, SEAL, CHECKPOINT, MEMORY]) expect(rows.find((x) => x["uri"] === t)?.["decision"], t).toBe("ingest");
    expect(await canonRig.carriersIn()).toEqual([CAP, CHECKPOINT, SEAL, MEMORY].sort());
  });

  test("CONTROL: the same persona-namespace title into another bag answers by that bag's own law, never this refusal", async () => {
    const BAG = "lar:///ha.ka.ba/wikis/notes/working";
    const r = rig(BAG);
    const args = { "source-uri": "file:///scratch", "to-bag": BAG, "change-id": "chg-w2", carriers: [carrier(MEMORY)] };
    const rows = (await r.table.get("INGEST")!(args, ctx(r.composite, args)) as Record<string, unknown>)["carriers"] as Array<Record<string, unknown>>;
    expect(rows[0]!["decision"]).toBe("ingest");
  });

  test("placement grants reject cross-mirror waves and let an ordinary mirror ingest a receipt-fact title", async () => {
    const BAG_A = "lar:///ha.ka.ba/wikis/alpha/working";
    const BAG_B = "lar:///ha.ka.ba/wikis/beta/working";
    const r = rig(BAG_A, [{ bagId: BAG_A, mirrorRoot: "/scratch/mirror-a", scope: "alpha" }]);
    const receiptTitle = "lar:///ha.ka.ba/bags/daemon/receipts/looks-like-a-receipt";
    const receiptCarrier = carrier(receiptTitle);
    const valid = { "source-uri": "/scratch/mirror-a", "to-bag": BAG_A, "change-id": "chg-place-a", carriers: [receiptCarrier] };
    const rows = (await r.table.get("INGEST")!(valid, ctx(r.composite, valid)) as Record<string, unknown>)["carriers"] as Array<Record<string, unknown>>;
    expect(rows[0]?.["decision"]).toBe("ingest");
    expect(await r.store.get(receiptTitle)).not.toBeNull();

    const foreign = { ...valid, "to-bag": BAG_B, "change-id": "chg-place-b" };
    await expect(r.table.get("INGEST")!(foreign, ctx(r.composite, foreign))).rejects.toMatchObject({ code: "disk-wave-placement" });
    for (const [home, changeId] of [["lar:///ha.ka.ba/bags/control", "chg-place-control"], ["lar:///ha.ka.ba/bags/secret", "chg-place-secret"]] as const) {
      const privateHome = { ...valid, "to-bag": home, "change-id": changeId };
      await expect(r.table.get("INGEST")!(privateHome, ctx(r.composite, privateHome))).rejects.toMatchObject({ code: "disk-wave-placement" });
    }
  });
});
