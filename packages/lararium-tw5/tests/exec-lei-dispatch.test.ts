/**
 * exec-lei-dispatch — the vessel's exec-lei port reaches the write doors through the live dispatch (backlog-awakens "The
 * executable-record lei"). The daemon island holds no key, so its port (`islandExecLeiPort`) routes one internal verb
 * (`exec-lei-spend`) to the vessel's main thread, which spends under its own signer; the dispatcher hands the port to every local
 * reactor as `ctx.execLei`. A refusal crosses back as its message and reads back as the lei's own code; an unanswered route reads
 * `swarm-lei-port-unanswered`, so the door offers. The internal verb answers no ask from outside the island (hand-only). Every red
 * pairs with a CONTROL.
 */
import { memoryControlStore } from "./control-store-fixture.js";
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID, bagUri } from "@lararium/mesh/lar-uris";
import { EXEC_LEI_SPEND_VERB } from "@lararium/mesh/exec-lei";
import { SwarmRefused } from "@lararium/mesh/swarm-tiddlers";
import { type ExecLeiPort } from "@lararium/mesh/seat-startup-offer";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { VerbDispatcher, VerbTable } from "../src/verb-dispatcher.js";
import { DAEMON_HAND_ONLY_CODES, makeLocalAskBook } from "../src/daemon-behavior.js";
import { islandExecLeiPort } from "../src/exec-lei-route.js";
import { makeMemePutReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { TW5Engine } from "../src/tw5-vm.js";

type Fields = Record<string, unknown>;
type Listener = (changed: Record<string, { deleted?: boolean }>) => void;
class FakeTW5Engine {
  private readonly records = new Map<string, Fields>();
  private listeners: Listener[] = [];
  readonly wiki = {
    addTiddler: (t: { fields?: Fields } | Fields): void => {
      const fields = (t && typeof t === "object" && "fields" in t && t.fields) ? t.fields as Fields : t as Fields;
      const title = String(fields["title"]);
      this.records.set(title, { ...fields });
      for (const l of this.listeners) l({ [title]: {} });
    },
    getTiddler: (title: string) => { const f = this.records.get(title); return f ? { fields: { ...f } } : undefined; },
    deleteTiddler: (title: string): void => { if (this.records.delete(title)) for (const l of this.listeners) l({ [title]: { deleted: true } }); },
    addEventListener: (type: string, fn: Listener): void => { if (type === "change") this.listeners.push(fn); },
    removeEventListener: (type: string, fn: Listener): void => { if (type === "change") this.listeners = this.listeners.filter((l) => l !== fn); },
  };
  readonly $tw = { Tiddler: class { fields: Fields; constructor(fields: Fields) { this.fields = fields; } }, wiki: this.wiki };
}
const settle = async (turns = 40): Promise<void> => { for (let i = 0; i < turns; i++) await new Promise((r) => setTimeout(r, 0)); };

const URI = "lar:///t/exec/dispatch";
const meme = (tags: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  `\`\`\`toml meta\ntags = ${tags}\nuri-path = "${URI.slice("lar:///".length)}"\n\`\`\`\n\n` +
  `<$action-setfield $tiddler="$:/temp/x" text="ran"/>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

describe("exec-lei-dispatch — the port rides the live dispatch", () => {
  test("RED: a seat's executable meme put under a standing exec lei lands through the dispatcher, the island's port routing one spend to main; CONTROL: with the route refusing, the put offers and lands nothing", async () => {
    for (const answers of [true, false]) {
      const garden = new MemoryTiddlerStore(bagUri("garden"));
      const composite = new CompositeStore();
      composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
      composite.addLayer({ bagId: bagUri("garden"), store: garden, writable: true });
      const routed: Array<{ action: string; args: Record<string, unknown> }> = [];
      const route = async (inv: Verb): Promise<Record<string, unknown>> => {
        routed.push({ action: inv.action, args: inv.args as Record<string, unknown> });
        if (!answers) throw new Error("swarm-lei-absent: no exec lei stands for \"garden\"");
        return { lei: "c".repeat(64), n: 1 };
      };
      const registry = new VerbTable();
      registry.register("meme-put", makeMemePutReactor({ composite, tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } } as unknown as MemeVerbOptions));
      const book = makeLocalAskBook();
      const dispatcher = new VerbDispatcher({
        daemonVm: new FakeTW5Engine() as unknown as TW5Engine, daemon: composite, control: memoryControlStore(), registry,
        localOf: (inv) => book.has(inv), surfaceOf: (inv) => book.isSurface(inv), askerOf: (inv) => book.askerOf(inv),
        execLei: islandExecLeiPort(route, () => "spend-1"),
      });
      dispatcher.start();
      const args = { uri: URI, bag: "garden", text: meme(`["$:/tags/StartupAction"]`) };
      book.add({ requestId: "p1", action: "meme-put", args, requestedBy: "me", origin: "channel", asker: "seat" } as never);
      dispatcher.placeVerb({ verb: "meme-put", args, requestedBy: "me", requestId: "p1" });
      await settle();
      dispatcher.stop();
      expect(routed.map((r) => r.action)).toEqual([EXEC_LEI_SPEND_VERB]);
      expect(routed[0]!.args).toMatchObject({ wiki: "garden", title: URI, writer: "seat" });
      if (answers) expect(await garden.get(URI)).not.toBeNull();
      else expect(await garden.get(URI)).toBeNull();
    }
  });

  test("RED: the island's port reads a routed refusal back by its code, and an unanswered route as `swarm-lei-port-unanswered`; CONTROL: an answer returns the spent return", async () => {
    const land = { wiki: "w", title: "T", fields: { tags: "$:/tags/StartupAction" }, writer: "seat" };
    const refused = islandExecLeiPort(async () => { throw new Error("swarm-lei-returns-spent: this lei's returns ran out"); }, () => "a");
    await expect(refused.spend(land)).rejects.toMatchObject({ code: "swarm-lei-returns-spent" });
    await expect(refused.spend(land)).rejects.toBeInstanceOf(SwarmRefused);
    const dark = islandExecLeiPort(async () => { throw new Error("no handler registered for \"exec-lei-spend\""); }, () => "b");
    await expect(dark.spend(land)).rejects.toMatchObject({ code: "swarm-lei-port-unanswered" });
    const port: ExecLeiPort = islandExecLeiPort(async () => ({ lei: "d".repeat(64), n: 3 }), () => "c");
    await expect(port.spend(land)).resolves.toEqual({ lei: "d".repeat(64), n: 3 });
  });

  test("RED: the internal spend verb answers no ask from outside the island (hand-only); CONTROL: the swarm's hand rows stand beside it", () => {
    expect(DAEMON_HAND_ONLY_CODES[EXEC_LEI_SPEND_VERB]).toBe("exec-lei-spend-internal");
    expect(DAEMON_HAND_ONLY_CODES["swarm-lei-kui"]).toBe("swarm-needs-hand");
  });
});
