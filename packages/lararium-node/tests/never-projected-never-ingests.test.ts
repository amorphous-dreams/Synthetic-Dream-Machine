/**
 * never-projected-never-ingests: a path whose records never project out never ingests in.
 *
 * A receipt fact, a verb summons and a ward audit carry `disk-projection: "no"`, so the projector writes
 * no file for them. A file standing at such an address therefore came from somewhere else, and its ingest
 * refuses by name: nothing gets created, the refusal names the file and the title, and the other carriers
 * of the same wave still land. `working-layer-records-off-disk.test.ts` pins the outbound half.
 */
import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import {
  CompositeStore, NeverProjectedPathRefusal, RECEIPT_FACT_URI_PREFIX, SUMMONS_URI_PREFIX, WARD_AUDIT_URI_PREFIX,
  buildReceiptFact, neverProjects, summon,
} from "@lararium/mesh";
import type { CapabilityAccess, CapabilityVerifyResult, Verb, VerbContext } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { VerbTable } from "../../lararium-tw5/src/verb-dispatcher.js";
import { registerActionReactors } from "../../lararium-tw5/src/action-handler.js";

const BAG = "lar:///ha.ka.ba/wikis/daemon/working";
const sha = (s: string) => `sha256:${createHash("sha256").update(s, "utf8").digest("hex")}`;
const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });

/** A minimal memetic carrier at `uri`, its meta carrying `extra` lines. */
const carrierText = (uri: string, body: string, extra = ""): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${uri.slice(7)}"\n${extra}\`\`\`\n\n${body}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

function rig() {
  const store = new MemoryTiddlerStore(BAG);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BAG, store, writable: true, defaultWritable: true });
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  const ingest = async (carriers: Array<{ uri: string; file: string; text: string }>): Promise<Array<Record<string, unknown>>> => {
    const args = {
      "source-uri": "file:///mirror", "to-bag": BAG, "change-id": "chg-never-projected",
      carriers: carriers.map((c) => ({ uri: c.uri, file: c.file, text: c.text, diskHash: sha(c.text), syncedHash: null })),
    };
    const invocation: Verb = {
      requestId: "req-never-projected", title: "lar:///lararium.local.vm/verbs/req-never-projected",
      action: "INGEST", args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "operator-test", requestedAt: "t",
    };
    const ctx: VerbContext = { daemon: composite, invocation, cap: allowCap };
    const result = await table.get("INGEST")!(args, ctx) as Record<string, unknown>;
    return result["carriers"] as Array<Record<string, unknown>>;
  };
  return { store, composite, ingest };
}

const ORDINARY = "lar:///ha.ka.ba/lares/docs/an-ordinary-carrier";
const FORGED = [
  { kind: "receipt fact", uri: `${RECEIPT_FACT_URI_PREFIX}forged-request`, file: "wikis/daemon/ha.ka.ba/bags/daemon/receipts/forged-request.mem" },
  { kind: "ward audit", uri: `${WARD_AUDIT_URI_PREFIX}forged-audit`, file: "wikis/daemon/ha.ka.ba/bags/daemon/ledger/ward/forged-audit.mem" },
  { kind: "verb summons", uri: `${SUMMONS_URI_PREFIX}forged-summons`, file: "wikis/daemon/ha.ka.ba/bags/daemon/summons/forged-summons.mem" },
];

describe("a path whose records never project out never ingests in", () => {
  test("the predicate names exactly the three control-plane record kinds the makers stamp", () => {
    const receipt = buildReceiptFact({ requestId: "r1", state: "committed", seq: 0, inputDigest: "d" });
    const summons = summon({ verb: "v", args: {}, requestedBy: "did:key:z", requestId: "s1" });
    for (const record of [receipt, summons]) {
      expect(record.tiddler["disk-projection"]).toBe("no");
      expect(neverProjects(record.tiddler.title)).toBe(true);
    }
    expect(neverProjects(`${WARD_AUDIT_URI_PREFIX}x`)).toBe(true);
    expect(neverProjects(ORDINARY)).toBe(false);
  });

  for (const forged of FORGED) {
    test(`a file dropped at a ${forged.kind} address refuses by name, creates nothing, and the ordinary carrier beside it still lands`, async () => {
      const r = rig();
      const rows = await r.ingest([
        { uri: forged.uri, file: forged.file, text: carrierText(forged.uri, "! forged") },
        { uri: ORDINARY, file: "wikis/daemon/ha.ka.ba/lares/docs/an-ordinary-carrier.mem", text: carrierText(ORDINARY, "! ordinary body") },
      ]);
      const refused = rows.find((row) => row["uri"] === forged.uri)!;
      expect(refused["decision"]).toBe("refuse");
      expect(refused["code"]).toBe(new NeverProjectedPathRefusal("p", "t").code);
      expect(String(refused["reason"])).toContain(forged.file);
      expect(String(refused["reason"])).toContain(forged.uri);
      expect(String(refused["reason"])).toContain("records at this address never project to disk, so a file here never ingests; remove the file");
      expect(await r.store.get(forged.uri), "no record stands at the forged address").toBeNull();
      // CONTROL: the ordinary carrier of the same wave ingests and its record stands.
      expect(rows.find((row) => row["uri"] === ORDINARY)!["decision"]).toBe("ingest");
      expect((await r.store.get(ORDINARY))?.tiddler.title).toBe(ORDINARY);
      expect((await r.store.listVisible()).filter((title) => neverProjects(title))).toEqual([]);
    });
  }

  test("a file at an ordinary address whose own fields declare disk-projection no refuses the same way", async () => {
    const r = rig();
    const uri = "lar:///ha.ka.ba/lares/docs/declares-no-projection";
    const rows = await r.ingest([{ uri, file: "wikis/daemon/ha.ka.ba/lares/docs/declares-no-projection.mem", text: carrierText(uri, "! body", "disk-projection = \"no\"\n") }]);
    expect(rows[0]!["decision"]).toBe("refuse");
    expect(rows[0]!["code"]).toBe("never-projected-path");
    expect(await r.store.get(uri)).toBeNull();
    // The bag's own effect ledger records the wave; no content record stands.
    expect((await r.store.listVisible()).filter((title) => !title.includes("/ledger/residency/"))).toEqual([]);
  });
});
