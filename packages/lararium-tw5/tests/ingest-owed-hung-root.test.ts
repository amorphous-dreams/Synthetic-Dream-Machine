/**
 * A HELD FAMILY TURN NEVER PARKS THE INGEST WAVE.
 *
 * One root's first write hangs (a vet or a sink that never settles). The syncer's sequential per-carrier loop meets that
 * root, hears `owed` at the pace and moves on, so every other family in the wave still lands. A clock paces the answer; the
 * held write stays queued behind its turn and lands when the turn settles.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import { makeActionReactorFor } from "../src/action-handler.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { placeMeme, type MemeSink } from "../src/place-meme.js";
import type { TiddlerFields } from "../src/deserializer.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const BAG = "lar:///ha.ka.ba/bags/ingest-owed";
const HUNG = "lar:///t.owed/hung";
const FREE = "lar:///t.owed/free";
const meme = (title: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${title}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  `\`\`\`toml meta\nuri-path = "${title.slice("lar:///".length)}"\n\`\`\`\n\nprose\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

function memorySink(): MemeSink {
  const store = new Map<string, TiddlerFields>();
  return { titles: () => [...store.keys()], read: (t) => store.get(t), land: (f) => { store.set(String(f.title), f); }, tombstone: (t) => { store.delete(t); } };
}

afterEach(() => { vi.useRealTimers(); });

describe("the ingest wave meets a hung root", () => {
  test("the hung carrier answers owed at the pace and the next carrier of another family still lands", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let release!: () => void;
    const hung = placeMeme({ uri: HUNG, text: meme(HUNG), holdAnswer: true, vet: () => new Promise<void>((resolve) => { release = resolve; }) }, memorySink());
    const composite = new CompositeStore();
    const store = new MemoryTiddlerStore();
    composite.addLayer({ bagId: BAG, store, writable: true, defaultWritable: true });
    const invocation = { requestId: "owed", title: "ingest", action: "INGEST", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-10-25" } as unknown as Verb;
    const ctx = { daemon: composite, invocation, cap: async () => ({ ok: true }) } as unknown as VerbContext;
    const wave = makeActionReactorFor("INGEST", { composite })(
      { "source-uri": "file:///staged/owed.mem", "to-bag": BAG, "change-id": "chg-owed", carriers: [
        { uri: HUNG, text: meme(HUNG), diskHash: "sha256:00", syncedHash: null },
        { uri: FREE, text: meme(FREE), diskHash: "sha256:01", syncedHash: null },
      ] }, ctx,
    ) as Promise<Record<string, unknown>>;
    await vi.advanceTimersByTimeAsync(31_000);
    const rows = (await wave)["carriers"] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ uri: HUNG, decision: "owed" });
    expect(rows[1]).toMatchObject({ uri: FREE, decision: "ingest" });
    expect(await store.get(FREE)).not.toBeNull();
    expect(await store.get(HUNG)).toBeFalsy();
    release();
    await hung;
  });
});
