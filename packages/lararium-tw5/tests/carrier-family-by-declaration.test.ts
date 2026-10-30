/**
 * A CARRIER'S DECLARATION DECIDES ITS FAMILY — and so its siting: a file that arrives as `.md` beside a
 * sidecar naming `text/markdown` lands as that markdown record with every sidecar field, whatever its
 * body shows.
 *
 * A document that teaches the frame shows a head inside its prose. A reader that sniffed the body for a
 * head sent such a document to the memetic shore, where a head inside a fence opens nothing: the bytes
 * read as bare data, the record landed as `text/plain`, the sidecar's fields fell away, and the
 * projector then sited the record as `.txt`.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { CompositeStore, isEffectRecordUri, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { registerActionReactors, makeTw5Deserializer } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";
import { exportCarrierFile } from "../src/meme-write.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

const BAG = "lar:///ha.ka.ba/wikis/family/working";
const URI = "lar:///ha.ka.ba/t/family/teaches-the-frame";

const HEAD = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/t/shown">>`;
/** Markdown that SHOWS a head inside a fence, and names one inline. */
const TEACHES_FENCED = `# The frame\n\nA carrier opens with a head:\n\n\`\`\`\n${HEAD}\n<<^ code="&#x0002;">>\n\`\`\`\n\nThen the body.\n`;
/** Markdown whose head stands LIVE, outside every fence (a rendered artifact quoting a carrier raw). */
const TEACHES_LIVE = `# The frame\n\nA carrier opens with a head:\n\n${HEAD}\n\nThen the body.\n`;
const SIDECAR = `title: ${URI}\ntype: text/markdown\nsource: lar:///ha.ka.ba/t/source\nsource-check: ni:///sha-256;AAAA\nvariant: kramdown-rfc2629\ntongue: en\n`;

const memetic = (uri: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${uri.slice("lar:///".length)}"\n\`\`\`\n\n<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
function ctx(composite: CompositeStore, action: "INGEST" | "LOAD", args: Record<string, unknown>): VerbContext {
  const invocation: Verb = {
    requestId: "req-family", title: "lar:///lararium.local.vm/verbs/req-family",
    action, args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-10-13T00:00:00Z",
  };
  return { daemon: composite, invocation, cap: allowCap };
}

describe.skipIf(wikiSkip)(`a carrier's declaration decides its family${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); }, 60_000);

  function rig(): { composite: CompositeStore; store: MemoryTiddlerStore; table: VerbTable } {
    const composite = new CompositeStore();
    const store = new MemoryTiddlerStore(BAG);
    composite.addLayer({ bagId: BAG, store, writable: true });
    const table = new VerbTable();
    registerActionReactors(table, { composite, tw5: makeTw5Deserializer(engine) });
    return { composite, store, table };
  }

  async function ingest(r: ReturnType<typeof rig>, carrier: { text: string; ext: string; meta?: string; uri?: string }): Promise<Record<string, unknown>> {
    const uri = carrier.uri ?? URI;
    const args = {
      "source-uri": "file:///scratch", "to-bag": BAG, "change-id": "chg-family",
      carriers: [{ uri, text: carrier.text, diskHash: carrierHash(carrier.text, carrier.meta), syncedHash: null, ext: carrier.ext, ...(carrier.meta !== undefined ? { meta: carrier.meta } : {}) }],
    };
    const result = await r.table.get("INGEST")!(args, ctx(r.composite, "INGEST", args)) as Record<string, unknown>;
    return (result["carriers"] as Array<Record<string, unknown>>)[0]!;
  }

  async function load(r: ReturnType<typeof rig>, carrier: { text: string; ext: string; meta?: string; title?: string }): Promise<Record<string, unknown>> {
    const args = {
      "source-uri": "file:///scratch", "to-bag": BAG, "change-id": "chg-family",
      carriers: [{ title: carrier.title ?? URI, text: carrier.text, ext: carrier.ext, ...(carrier.meta !== undefined ? { meta: carrier.meta } : {}) }],
    };
    return table(r).get("LOAD")!(args, ctx(r.composite, "LOAD", args)) as Promise<Record<string, unknown>>;
  }
  const table = (r: ReturnType<typeof rig>) => r.table;
  /** The carriers a bag holds: every wave also leaves an effect record in the bag's own ledger. */
  const carriersIn = async (r: ReturnType<typeof rig>) => (await r.store.listVisible()).filter((t) => !isEffectRecordUri(t)).sort();

  for (const [name, body] of [["shown inside a fence", TEACHES_FENCED], ["standing live in the prose", TEACHES_LIVE]] as const) {
    for (const door of ["INGEST", "LOAD"] as const) {
      test(`${door}: markdown beside its sidecar keeps its type and every sidecar field, a head ${name}`, async () => {
        const r = rig();
        if (door === "INGEST") expect((await ingest(r, { text: body, ext: ".md", meta: SIDECAR }))["decision"]).toBe("ingest");
        else await load(r, { text: body, ext: ".md", meta: SIDECAR });
        expect(await carriersIn(r)).toEqual([URI]);
        const fields = (await r.store.get(URI))!.tiddler as Record<string, unknown>;
        expect(fields["type"]).toBe("text/markdown");
        expect(fields["text"]).toBe(body);
        expect(fields["source"]).toBe("lar:///ha.ka.ba/t/source");
        expect(fields["source-check"]).toBe("ni:///sha-256;AAAA");
        expect(fields["variant"]).toBe("kramdown-rfc2629");
        expect(fields["tongue"]).toBe("en");
      });
    }
  }

  test("the record that arrived as `.md` leaves as `.md`, its sidecar whole", async () => {
    const r = rig();
    await ingest(r, { text: TEACHES_FENCED, ext: ".md", meta: SIDECAR });
    const fields = (await r.store.get(URI))!.tiddler as Record<string, unknown>;
    engine.setTiddler(fields as Record<string, string>);
    const file = exportCarrierFile(engine, URI)!;
    expect(file.ext).toBe(".md");
    expect(file.body).toBe(TEACHES_FENCED);
    for (const line of SIDECAR.split("\n").filter((l) => l !== "")) expect(file.metaBody).toContain(line);
  });

  test("markdown with no sidecar keeps its family when the head stands inside a fence", async () => {
    const r = rig();
    expect((await ingest(r, { text: TEACHES_FENCED, ext: ".md" }))["decision"]).toBe("ingest");
    const fields = (await r.store.get(URI))!.tiddler as Record<string, unknown>;
    expect(fields["type"]).toBe("text/x-markdown");
    expect(fields["text"]).toBe(TEACHES_FENCED);
  });

  test("CONTROL: a framed carrier decomposes at the memetic shore, whatever extension carried it", async () => {
    for (const ext of [".mem", ".md"]) {
      const r = rig();
      const uri = "lar:///ha.ka.ba/t/family/a-meme";
      expect((await ingest(r, { uri, text: memetic(uri), ext }))["decision"]).toBe("ingest");
      expect(await carriersIn(r)).toEqual([uri, `${uri}#/a`]);
      expect(((await r.store.get(uri))!.tiddler as Record<string, unknown>)["type"]).toBe(CARRIER_TYPE);
    }
  });

  test("CONTROL: a sidecar that names the carrier type sends the body to the memetic shore", async () => {
    const r = rig();
    const uri = "lar:///ha.ka.ba/t/family/a-meme";
    expect((await ingest(r, { uri, text: memetic(uri), ext: ".md", meta: `title: ${uri}\ntype: ${CARRIER_TYPE}\n` }))["decision"]).toBe("ingest");
    expect(await carriersIn(r)).toEqual([uri, `${uri}#/a`]);
  });
});
