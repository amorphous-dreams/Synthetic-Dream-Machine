/**
 * THE BASE HOLDS TWO SIDES — the ingest leg's reading of an agreement pinned over a disk that stands in
 * another framing.
 *
 * Disk and records co-project one carrier. Where the disk's bytes say what the records render and wear
 * another framing, the last agreement names two hashes: the disk side (`syncedHash`) and the records
 * side (`syncedRecordsHash`). The gate's echo reads the disk side; "the records stand where the base
 * left them" reads the records side. Read against the disk side alone, a hand edit to such a file would
 * surface as a conflict nobody caused.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, parseResidencyAction, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";
import { decideIngest } from "../src/ingest-gate.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { registerActionReactors } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";
import { placeMeme, readMeme, type MemeSink } from "../src/place-meme.js";
import type { TiddlerFields } from "../src/deserializer.js";

const URI = "lar:///t.base.two-sides/one";
const BAG = "lar:///ha.ka.ba/wikis/two-sides/working";

/** One carrier in a framing the render normalizes: an unsorted meta block and a wide margin. */
const framed = (prose: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  "```toml meta\nzeta = \"last\"\nalpha = \"first\"\nuri-path = \"t.base.two-sides/one\"\n```\n\n\n\n" +
  `${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

function memorySink(): MemeSink & { store: Map<string, TiddlerFields> } {
  const store = new Map<string, TiddlerFields>();
  return {
    store,
    titles: () => [...store.keys()],
    read: (t) => store.get(t),
    land: (f) => { store.set(String(f.title), f); },
    tombstone: (t) => { store.delete(t); },
  };
}

describe("the ingest gate reads a two-sided base", () => {
  const D = framed("the first prose");
  const E = framed("the prose a hand edited on disk");

  test("the setup took: the disk's bytes differ from the render that says the same thing", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: D }, sink);
    const render = (await readMeme(URI, sink))!.text;
    expect(render).not.toBe(D);
    expect((await placeMeme({ uri: URI, text: D }, sink)).decision).toBe("noop");
  });

  test("a hand edit to a file standing in another framing INGESTS under its two-sided base", async () => {
    const sink = memorySink();
    const first = await placeMeme({ uri: URI, text: D }, sink);
    // The agreement the two legs pinned: the disk held D, the records rendered `first.canonicalHash`.
    const r = await placeMeme({ uri: URI, text: E, baseHash: carrierHash(D), baseRecordsHash: first.canonicalHash! }, sink);
    expect(r.decision).toBe("ingest");
    expect((await readMeme(URI, sink))!.text).toContain("the prose a hand edited on disk");
  });

  test("CONTROL: read against the disk side alone, the same edit surfaces as a conflict", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: D }, sink);
    const r = await placeMeme({ uri: URI, text: E, baseHash: carrierHash(D) }, sink);
    expect(r.decision).toBe("conflict");
    expect((await readMeme(URI, sink))!.text).toContain("the first prose");
  });

  test("the records moved past the base's records side: the edit CONFLICTS and nothing lands", async () => {
    const sink = memorySink();
    const first = await placeMeme({ uri: URI, text: D }, sink);
    await placeMeme({ uri: URI, text: framed("the prose a wiki hand wrote"), baseHash: first.canonicalHash! }, sink);
    const r = await placeMeme({ uri: URI, text: E, baseHash: carrierHash(D), baseRecordsHash: first.canonicalHash! }, sink);
    expect(r.decision).toBe("conflict");
    expect((await readMeme(URI, sink))!.text).toContain("the prose a wiki hand wrote");
  });

  test("the disk side still answers the echo: the bytes the base names read as a noop", () => {
    const decision = decideIngest({
      uri: URI, diskText: D, diskHash: carrierHash(D), syncedHash: carrierHash(D), syncedRecordsHash: carrierHash("another render"),
      currentRenderHash: carrierHash("yet another"), hash: carrierHash,
    });
    expect(decision).toEqual({ kind: "noop", reason: "disk-matches-synced" });
  });

  test("a records side beside no disk side names no base: the carrier adopts fresh", () => {
    const decision = decideIngest({
      uri: URI, diskText: D, diskHash: carrierHash(D), syncedHash: null, syncedRecordsHash: carrierHash("stale"),
      currentRenderHash: carrierHash(""), hash: carrierHash,
    });
    expect(decision.kind).toBe("ingest");
  });
});

// ---------------------------------------------------------------------------
// The INGEST reactor: the wire carries the records side, and each row answers the render it left
// ---------------------------------------------------------------------------

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
function ctx(composite: CompositeStore, args: Record<string, unknown>): VerbContext {
  const invocation: Verb = {
    requestId: "req-two-sides", title: "lar:///lararium.local.vm/verbs/req-two-sides",
    action: "INGEST", args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-10-13T00:00:00Z",
  };
  return { daemon: composite, invocation, cap: allowCap };
}

async function ingest(composite: CompositeStore, carrier: Record<string, unknown>): Promise<Record<string, unknown>> {
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  const args = { "source-uri": "file:///scratch", "to-bag": BAG, "change-id": "chg-two-sides", carriers: [carrier] };
  const result = await table.get("INGEST")!(args, ctx(composite, args)) as Record<string, unknown>;
  return (result["carriers"] as Array<Record<string, unknown>>)[0]!;
}

function bagOf(): CompositeStore {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BAG, store: new MemoryTiddlerStore(BAG), writable: true });
  return composite;
}

describe("INGEST carries the base's two sides", () => {
  const D = framed("the first prose");
  const E = framed("the prose a hand edited on disk");

  test("an ingest row answers the hash of the render the records hold; a noop row answers it too", async () => {
    const composite = bagOf();
    const first = await ingest(composite, { uri: URI, text: D, diskHash: carrierHash(D), syncedHash: null, ext: ".mem" });
    expect(first["decision"]).toBe("ingest");
    expect(typeof first["canonicalHash"]).toBe("string");
    expect(first["canonicalHash"]).not.toBe(carrierHash(D));
    // The same bytes under a stale base: the records already say this, and the row names their render.
    const again = await ingest(composite, { uri: URI, text: D, diskHash: carrierHash(D), syncedHash: carrierHash("an older file"), ext: ".mem" });
    expect(again["decision"]).toBe("noop");
    expect(again["canonicalHash"]).toBe(first["canonicalHash"]);
  });

  test("a hand edit rides its two-sided base through the wire and lands", async () => {
    const composite = bagOf();
    const first = await ingest(composite, { uri: URI, text: D, diskHash: carrierHash(D), syncedHash: null, ext: ".mem" });
    const edit = await ingest(composite, {
      uri: URI, text: E, diskHash: carrierHash(E), syncedHash: carrierHash(D), syncedRecordsHash: first["canonicalHash"], ext: ".mem",
    });
    expect(edit["decision"]).toBe("ingest");
    expect(edit["canonicalHash"]).not.toBe(first["canonicalHash"]);
  });

  test("CONTROL: the same edit with the records side left off the wire surfaces as a conflict", async () => {
    const composite = bagOf();
    await ingest(composite, { uri: URI, text: D, diskHash: carrierHash(D), syncedHash: null, ext: ".mem" });
    const edit = await ingest(composite, { uri: URI, text: E, diskHash: carrierHash(E), syncedHash: carrierHash(D), ext: ".mem" });
    expect(edit["decision"]).toBe("conflict");
    expect(edit["canonicalHash"]).toBeUndefined();
  });

  test("the wire refuses a records side that rides beside no disk side, and one that names nothing", () => {
    const wave = (carrier: Record<string, unknown>) => parseResidencyAction({
      requestId: "r", title: "t", action: "INGEST", targets: [], batchMode: "best-effort", status: "pending",
      requestedBy: "x", requestedAt: "2026-10-13T00:00:00Z",
      args: { "source-uri": "file:///s", "to-bag": BAG, "change-id": "c", carriers: [carrier] },
    } as unknown as Verb);
    const whole = wave({ uri: URI, text: D, diskHash: "sha256:aa", syncedHash: "sha256:bb", syncedRecordsHash: "sha256:cc" });
    expect((whole as { carriers: Array<Record<string, unknown>> }).carriers[0]!["syncedRecordsHash"]).toBe("sha256:cc");
    expect(wave({ uri: URI, text: D, diskHash: "sha256:aa", syncedHash: null, syncedRecordsHash: "sha256:cc" })).toBeNull();
    expect(wave({ uri: URI, text: D, diskHash: "sha256:aa", syncedHash: "sha256:bb", syncedRecordsHash: "" })).toBeNull();
    expect(wave({ uri: URI, text: D, diskHash: "sha256:aa", syncedHash: "sha256:bb", syncedRecordsHash: 7 })).toBeNull();
    // CONTROL: a wave with no records side parses, and carries none.
    const plain = wave({ uri: URI, text: D, diskHash: "sha256:aa", syncedHash: "sha256:bb" });
    expect("syncedRecordsHash" in (plain as { carriers: Array<Record<string, unknown>> }).carriers[0]!).toBe(false);
  });
});
