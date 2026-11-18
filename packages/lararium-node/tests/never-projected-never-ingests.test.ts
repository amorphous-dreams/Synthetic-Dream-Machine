/** Placement governs whether a carrier reaches disk; its title and record flags do not. */
import { describe, expect, test } from "vitest";
import {
  CompositeStore, RECEIPT_FACT_URI_PREFIX, buildReceiptFact,
} from "@lararium/mesh";
import type { CapabilityAccess, CapabilityVerifyResult, Verb, VerbContext } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { VerbTable } from "../../lararium-tw5/src/verb-dispatcher.js";
import { registerActionReactors } from "../../lararium-tw5/src/action-handler.js";

const BAG = "lar:///ha.ka.ba/wikis/daemon/working";
const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
const carrierText = (uri: string) => `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uri.slice(7)}"\n\`\`\`\n\ncontent\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

function rig() {
  const store = new MemoryTiddlerStore(BAG);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BAG, store, writable: true, defaultWritable: true });
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  return { store, ingest: async (uri: string) => {
    const text = carrierText(uri);
    const args = { "source-uri": "/mirror", "to-bag": BAG, "change-id": "chg-placement", carriers: [{ uri, file: `/mirror/${uri.slice(7)}.mem`, diskHash: "sha256:x", syncedHash: null, text }] };
    const invocation: Verb = { requestId: "req-placement", title: "lar:///lararium.local.vm/verbs/placement", action: "INGEST", args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "operator-test", requestedAt: "t" };
    const ctx: VerbContext = { daemon: composite, invocation, cap: allowCap };
    return table.get("INGEST")!(args, ctx) as Promise<Record<string, unknown>>;
  } };
}

describe("INGEST admits content by selected store, not title", () => {
  test("a receipt-fact-shaped title lands as ordinary content in the selected bag", async () => {
    const { store, ingest } = rig();
    const title = `${RECEIPT_FACT_URI_PREFIX}foreign-file`;
    await ingest(title);
    expect((await store.get(title))?.tiddler.title).toBe(title);
  });

  test("a control-family record carries no residency field, and a content title ingests", async () => {
    const { store, ingest } = rig();
    const title = "lar:///ha.ka.ba/lares/docs/no-projection-flag";
    const receipt = buildReceiptFact({ requestId: "sample", state: "committed", seq: 0, inputDigest: "d" });
    expect(receipt.tiddler).not.toHaveProperty("disk-projection");
    await ingest(title);
    expect((await store.get(title))?.tiddler.title).toBe(title);
  });
});
