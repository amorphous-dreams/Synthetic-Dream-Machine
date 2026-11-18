/**
 * seat-startup-offer — a seat-asked write carrying a `$:/tags/StartupAction*` tag offers and never lands
 * (state/decisions, "Native TW5 wikis, and the one wall a seat keeps"). A wiki-landed startup action runs in the tab alone,
 * so the one wall a seat keeps guards the operator's browser: at the tiddler door, the meme door and INGEST alike, the AI
 * seat's write naming a startup tag refuses `seat-startup-offer`, names the operator's own hand, and moves no byte.
 *
 * CONTROLS: the operator's CLI hand and a context naming no asker land the same write natively; a seat write with no
 * startup tag lands; a tag that only begins like one (`$:/tags/StartupActionX`) is no startup tag.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, isVerbRefusal, type Verb } from "@lararium/mesh";
import type { Hand } from "@lararium/mesh/session-contract";
import { makeMemePutReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import { makeActionReactorFor } from "../src/action-handler.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const GARDEN = bagUri("garden");
const WORKING = "lar:///ha.ka.ba/wikis/garden/working";
const SOURCE = "/lar/projections/wikis/garden";
const URI = "lar:///t/startup/offer";
const meme = (tags: string | null, title = URI): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${title}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  `\`\`\`toml meta\n${tags === null ? "" : `tags = ${tags}\n`}uri-path = "${title.slice("lar:///".length)}"\n\`\`\`\n\n` +
  `<$action-setfield $tiddler="$:/temp/offered" text="ran"/>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const ctxOf = (composite: CompositeStore, action: string, asker?: Hand): VerbContext => ({
  daemon: composite,
  invocation: { requestId: "r", title: "t", action, args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "" } as unknown as Verb,
  cap: async () => ({ ok: true }),
  ...(asker ? { asker } : {}),
} as VerbContext);

const reasonOf = async (go: () => Promise<unknown>): Promise<string | null> => {
  try { await go(); return null; } catch (e) { return isVerbRefusal(e) ? e.reason : `(${e instanceof Error ? e.message : String(e)})`; }
};

function rig() {
  const composite = new CompositeStore();
  const garden = new MemoryTiddlerStore(GARDEN);
  const working = new MemoryTiddlerStore(WORKING);
  composite.addLayer({ bagId: GARDEN, store: garden, writable: true });
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  const opts: MemeVerbOptions = { composite, tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"] };
  const put = (text: string, asker?: Hand) => makeMemePutReactor(opts)({ uri: URI, bag: "garden", text }, ctxOf(composite, "meme-put", asker));
  const ingest = (text: string, asker?: Hand) => makeActionReactorFor("INGEST", { composite, diskMirrors: [{ bagId: WORKING, mirrorRoot: SOURCE, scope: "garden" }] })({
    "source-uri": SOURCE, "to-bag": WORKING, "change-id": `chg-${asker ?? "none"}`,
    carriers: [{ uri: URI, text, diskHash: "sha256:0f", syncedHash: null, file: `${SOURCE}/offer.mem` }],
  }, ctxOf(composite, "INGEST", asker));
  return { garden, working, put, ingest };
}

describe("seat-startup-offer — a seat's startup action offers and never lands", () => {
  test("RED: a seat-asked meme put carrying a StartupAction tag refuses seat-startup-offer and lands nothing; CONTROL a seat put with no startup tag lands", async () => {
    const r = rig();
    for (const tags of [`["$:/tags/StartupAction"]`, `["memory", "$:/tags/StartupAction/Browser"]`]) {
      expect(await reasonOf(() => r.put(meme(tags), "seat")), tags).toBe("seat-startup-offer");
      expect(await r.garden.get(URI)).toBeNull();
    }
    expect((await r.put(meme(`["$:/tags/StartupActionX"]`), "seat"))["decision"]).toBe("ingest");
  });

  test("RED: a seat-asked INGEST carrying a StartupAction tag refuses seat-startup-offer and lands nothing", async () => {
    const r = rig();
    expect(await reasonOf(() => r.ingest(meme(`["$:/tags/StartupAction"]`), "seat"))).toBe("seat-startup-offer");
    expect(await r.working.get(URI)).toBeNull();
  });

  test("RED: the refusal names the operator's own hand and the tab", async () => {
    const r = rig();
    let message = "";
    try { await r.put(meme(`["$:/tags/StartupAction"]`), "seat"); } catch (e) { message = e instanceof Error ? e.message : String(e); }
    expect(message).toMatch(/operator's own hand/);
    expect(message).toMatch(/tab/);
  });

  test("CONTROL: the operator's CLI hand and a context naming no asker land the same startup action natively, through the meme door and INGEST", async () => {
    for (const asker of ["cli", undefined] as const) {
      const r = rig();
      expect((await r.put(meme(`["$:/tags/StartupAction"]`), asker))["decision"]).toBe("ingest");
      expect(await r.garden.get(URI)).not.toBeNull();
      const out = await r.ingest(meme(`["$:/tags/StartupAction"]`), asker) as Record<string, unknown>;
      expect((out["carriers"] as Array<Record<string, unknown>>)[0]).toMatchObject({ uri: URI, decision: "ingest" });
      expect(await r.working.get(URI)).not.toBeNull();
    }
  });
});
