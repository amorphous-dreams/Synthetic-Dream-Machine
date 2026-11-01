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
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uri.slice(7)}"\n${extra}\`\`\`\n\n${body}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

function rig() {
  const store = new MemoryTiddlerStore(BAG);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BAG, store, writable: true, defaultWritable: true });
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  const ingest = async (
    carriers: Array<{ uri: string; file: string; text: string; meta?: string; skinny?: { cid: string } }>,
    deletions: Array<{ uri: string; syncedHash: string }> = [],
  ): Promise<Array<Record<string, unknown>>> => {
    const args = {
      "source-uri": "file:///mirror", "to-bag": BAG, "change-id": "chg-never-projected",
      carriers: carriers.map((c) => ({
        uri: c.uri, file: c.file, diskHash: sha(c.text), syncedHash: null,
        ...(c.skinny ? { textCid: c.skinny.cid, skinny: true, size: c.text.length } : { text: c.text }),
        ...(c.meta !== undefined ? { meta: c.meta } : {}),
      })),
      ...(deletions.length > 0 ? { deletions } : {}),
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

  test("a renamed file never re-homes a record onto a never-projected address", async () => {
    const r = rig();
    const text = carrierText(ORDINARY, "! ordinary body");
    await r.ingest([{ uri: ORDINARY, file: "wikis/daemon/ha.ka.ba/lares/docs/an-ordinary-carrier.mem", text }]);
    expect((await r.store.get(ORDINARY))?.tiddler.title).toBe(ORDINARY);
    const forged = FORGED[0]!;
    // The same bytes vanish from the ordinary path and appear at the forged one: the wave reads as a rename.
    const rows = await r.ingest([{ uri: forged.uri, file: forged.file, text }], [{ uri: ORDINARY, syncedHash: sha(text) }]);
    expect(rows.find((row) => row["uri"] === forged.uri)).toMatchObject({ decision: "refuse", code: "never-projected-path" });
    expect(rows.some((row) => row["decision"] === "rename"), "no re-link ran").toBe(false);
    expect(await r.store.get(forged.uri), "no record stands at the forged address").toBeNull();
  });

  test("a pointer carrier whose sidecar declares disk-projection no refuses before its handle lands", async () => {
    const r = rig();
    const uri = "lar:///ha.ka.ba/lares/docs/a-large-shard";
    const rows = await r.ingest([{ uri, file: "wikis/daemon/ha.ka.ba/lares/docs/a-large-shard.bin", text: "x".repeat(64), meta: "title: a-large-shard\ndisk-projection: no\n", skinny: { cid: "bafkreitestcid" } }]);
    expect(rows[0]).toMatchObject({ decision: "refuse", code: "never-projected-path" });
    expect(await r.store.get(uri)).toBeNull();
  });

  test("a vanished file's deletion never tombstones a record no file ever stood for", async () => {
    const r = rig();
    const receipt = buildReceiptFact({ requestId: "kept", state: "committed", seq: 0, inputDigest: "d" });
    await r.composite.put(receipt, { kind: "lares-verb", requestId: "kept" });
    const parent = RECEIPT_FACT_URI_PREFIX.replace(/\/$/, "");
    await r.ingest([], [{ uri: parent, syncedHash: sha("gone") }]);
    const kept = await r.store.get(receipt.tiddler.title);
    expect(kept?.meta?.deleted, "the receipt fact stands live").not.toBe(true);
    expect(kept?.tiddler.title).toBe(receipt.tiddler.title);
  });

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
