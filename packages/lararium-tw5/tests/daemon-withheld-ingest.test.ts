/**
 * THE DAEMON BAG TAKES NO HOUSE RECORD FROM DISK, at the island, whatever its caller scanned.
 *
 * Every disk-to-store road into `bags/daemon` rides one INGEST wave: `lares ingest`, `lares shore take-disk`, the daemon
 * canon mirror's ingest-back, `lares import`. The island refuses, by name (`daemon-withheld-title`), a carrier, a kāpae or
 * a re-link naming a control or house title (`isDaemonCanonWithheld`: `bags/daemon/cap/**`, `bags/persona/**`,
 * `dreamnet/**`, `$:/`), and lands its authored sibling. The CLI scan guard stands beside it; this wave bypasses it.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, isEffectRecordUri, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
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

describe.skipIf(wikiSkip)(`the island holds the daemon bag's withheld titles${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);

  function rig(bag: string) {
    const composite = new CompositeStore();
    const store = new MemoryTiddlerStore(bag);
    composite.addLayer({ bagId: bag, store, writable: true });
    const table = new VerbTable();
    registerActionReactors(table, { composite, tw5: makeTw5Deserializer(engine) });
    return { composite, store, table, carriersIn: async () => (await store.listVisible()).filter((t) => !isEffectRecordUri(t)).sort() };
  }

  test("RED: an INGEST into bags/daemon naming a cap event, a group-secret seal or a checkpoint refuses each by name; the memory lands", async () => {
    const r = rig(DAEMON_BAG_ID);
    const args = { "source-uri": "file:///scratch", "to-bag": DAEMON_BAG_ID, "change-id": "chg-w", carriers: [CAP, SEAL, CHECKPOINT, MEMORY].map(carrier), kapae: [SEAL] };
    const out = await r.table.get("INGEST")!(args, ctx(r.composite, args)) as Record<string, unknown>;
    const rows = out["carriers"] as Array<Record<string, unknown>>;
    for (const t of [CAP, SEAL, CHECKPOINT]) {
      const row = rows.find((x) => x["uri"] === t)!;
      expect(row["decision"], t).toBe("refuse");
      expect(row["code"], t).toBe("daemon-withheld-title");
    }
    expect(rows.find((x) => x["uri"] === MEMORY)!["decision"]).toBe("ingest");
    expect((out["kapae"] as { refused: Array<{ code: string }> }).refused.map((k) => k.code)).toEqual(["daemon-withheld-title"]);
    expect(await r.carriersIn()).toEqual([MEMORY]);
  });

  test("CONTROL: the same persona-namespace title into another bag answers by that bag's own law, never this refusal", async () => {
    const BAG = "lar:///ha.ka.ba/wikis/notes/working";
    const r = rig(BAG);
    const args = { "source-uri": "file:///scratch", "to-bag": BAG, "change-id": "chg-w2", carriers: [carrier(MEMORY)] };
    const rows = (await r.table.get("INGEST")!(args, ctx(r.composite, args)) as Record<string, unknown>)["carriers"] as Array<Record<string, unknown>>;
    expect(rows[0]!["decision"]).toBe("ingest");
  });
});
