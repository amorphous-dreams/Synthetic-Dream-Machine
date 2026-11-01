/**
 * A RENAME RE-HOMES RECORDS THAT STAND — a vanished source that holds no live record leaves nothing to
 * re-home.
 *
 * The delete gate pairs a vanished carrier with an arriving one that carries its bytes, and the island
 * re-links the source's records under the new address. Where the source holds no live record, a rename
 * answer would skip the target's own ingest and land nothing, while the gesture pinned a base for it: the
 * file would read `unchanged` forever and never reach the records. So such a pair reads as no rename.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { registerActionReactors } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";

const URI = "lar:///t.rename.rehomes/arrived";
const BAG = "lar:///ha.ka.ba/wikis/rename-rehomes/working";

const framed = (prose: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  "```toml meta\nuri-path = \"t.rename.rehomes/arrived\"\n```\n\n" +
  `${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
function ctx(composite: CompositeStore, args: Record<string, unknown>): VerbContext {
  const invocation: Verb = {
    requestId: "req-rename", title: "lar:///lararium.local.vm/verbs/req-rename",
    action: "INGEST", args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-10-13T00:00:00Z",
  };
  return { daemon: composite, invocation, cap: allowCap };
}
function bagOf(): CompositeStore {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BAG, store: new MemoryTiddlerStore(BAG), writable: true });
  return composite;
}

describe("a rename re-homes records that stand", () => {
  const D = framed("the first prose");
  const FROM = "lar:///t.rename.rehomes/gone";
  const wave = async (composite: CompositeStore): Promise<Record<string, unknown>> => {
    const table = new VerbTable();
    registerActionReactors(table, { composite });
    const args = {
      "source-uri": "file:///scratch", "to-bag": BAG, "change-id": "chg-rename",
      carriers: [{ uri: URI, text: D, diskHash: carrierHash(D), syncedHash: null, ext: ".mem" }],
      // The vanished source shares the arriving carrier's bytes: the gate pairs the two as a rename.
      deletions: [{ uri: FROM, syncedHash: carrierHash(D) }],
    };
    return table.get("INGEST")!(args, ctx(composite, args)) as Promise<Record<string, unknown>>;
  };

  test("a vanished source that holds no live record reads as no rename: the target lands as itself", async () => {
    const composite = bagOf();
    const result = await wave(composite);
    const rows = result["carriers"] as Array<Record<string, unknown>>;
    expect(rows.find((r) => r["uri"] === URI)?.["decision"]).toBe("ingest");
    expect(rows.some((r) => r["decision"] === "rename" || r["decision"] === "rename-target")).toBe(false);
    expect((result["deletions"] as { renames: unknown[] }).renames).toEqual([]);
    // The vanished source answers `absent`: the records hold nothing under it, and no row names a removal.
    expect((result["deletions"] as { absent: unknown[] }).absent).toEqual([FROM]);
    expect((result["deletions"] as { declined: unknown[] }).declined).toEqual([]);
    expect(rows.find((r) => r["uri"] === FROM)).toBeUndefined();
    expect(await composite.get(URI)).not.toBeNull();
  });

  test("CONTROL: a source that holds live records re-homes them, and the summary names the rename", async () => {
    const composite = bagOf();
    await composite.put({ tiddler: { title: FROM, type: "text/memetic-wikitext+tiddlywiki", text: "a standing root" }, meta: { changeId: "chg-old" } }, { kind: "lares-verb", requestId: "seed" }, { bag: BAG });
    const result = await wave(composite);
    const rows = result["carriers"] as Array<Record<string, unknown>>;
    expect(rows.find((r) => r["decision"] === "rename-target")?.["uri"]).toBe(URI);
    expect(rows.find((r) => r["decision"] === "rename")?.["relinked"]).toBe(1);
    expect((result["deletions"] as { renames: unknown[] }).renames).toEqual([{ fromUri: FROM, toUri: URI }]);
    expect((await composite.get(URI))?.tiddler["text"]).toBe("a standing root");
  });
});
