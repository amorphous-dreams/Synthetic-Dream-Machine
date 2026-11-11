/**
 * ingest-face-named — THE FACE-NAMED WAVE (the lit set). One seed lays every open face's memory, each face's own working
 * and canon through an INGEST that names that face. The handler resolves the named face's document through the island's
 * face resolver and lands only where the device table names THAT face as the document's owner; it never falls back to the
 * worn face (operator ruling: no cross-face landing ever).
 *
 *   N1 — lit {h0,h1}: a wave naming h1 lands in h1's own document, and h0's layer takes nothing
 *   N2 — a forged wave naming face 1 over a document h0 owns refuses `ingest-face-foreign`, and nothing lands
 *   N3 — a wave naming no face whose target resolves to a document h1 owns refuses `ingest-face-foreign`
 *   N4 — a wave naming a face this island resolves no layer for (no resolver; a shut face) refuses `face-unresolved`,
 *        and never lands on the worn face's layer
 *   N5 — a face-named wave over a bag no face owns refuses `face-layer-unowned`
 *   N6 — the action parse refuses a face that reads as no whole handle index
 *   N7 — THE OPERATOR'S HAND: a call riding a session that wears h0 (an AI seat) naming h1 refuses `face-hand-refused`; the
 *        same session naming its own face lands, and the operator's gesture (no session) names h1 and lands
 *
 * Written beside the cure (written, unrun here; CI runs it).
 */
import { describe, expect, test } from "vitest";
import { CompositeStore, parseResidencyAction, type Verb } from "@lararium/mesh";
import { makeActionReactorFor, isFaceOwnedLayer, type FaceTargetResolver } from "../src/action-handler.js";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
const URI = "lar:///t.face.named/one";
const SOURCE = "/lar/projections/wikis/daemon-face";
const meme = (prose: string, title = URI): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${title}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  `\`\`\`toml meta\nuri-path = "${title.slice("lar:///".length)}"\n\`\`\`\n\n` +
  `${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const ctxOf = (composite: CompositeStore, worn?: { ordinal: number; presenter: string }): VerbContext => ({
  daemon: composite,
  ...(worn ? { worn } : {}),
  invocation: { requestId: "ingest-face", title: "ingest", action: "INGEST", args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-11-10" } as unknown as Verb,
  cap: async () => ({ ok: true }),
}) as unknown as VerbContext;

/** A vessel wearing h0 with h0 and h1 open: each face's own working document, filed under its owner. */
function litPair(opts: { owners?: Record<number, number | null>; worn?: number } = {}) {
  const composite = new CompositeStore();
  const own = { 0: new MemoryTiddlerStore(), 1: new MemoryTiddlerStore() } as Record<number, MemoryTiddlerStore>;
  // The worn face's working layer stands in the composite, as the daemon island mounts it.
  composite.addLayer({ bagId: WORKING, store: own[0]!, writable: true, defaultWritable: true });
  const worn = opts.worn ?? 0;
  const owners = opts.owners ?? { 0: 0, 1: 1 };
  const faceTarget: FaceTargetResolver = async (face, bag) => {
    if (bag !== WORKING) return null;
    const f = face ?? worn;
    const store = own[f];
    return store ? { store, owner: owners[f] ?? null, worn } : null;
  };
  const wave = (face?: number, worn?: { ordinal: number; presenter: string }) => makeActionReactorFor("INGEST", { composite, faceTarget, diskMirrors: [{ bagId: WORKING, mirrorRoot: SOURCE, scope: "daemon" }] })({
    "source-uri": SOURCE, "to-bag": WORKING, "change-id": `chg-face-${face ?? "none"}`,
    carriers: [{ uri: URI, text: meme(`landed for ${face ?? "the worn face"}`), diskHash: "sha256:0f", syncedHash: null, file: `${SOURCE}/one.mem` }],
    ...(face !== undefined ? { face } : {}),
  }, ctxOf(composite, worn));
  return { composite, own, wave };
}

describe("the face-named wave lands in its own face alone", () => {
  test("N1 — lit {h0,h1}: a wave naming h1 lands in h1's own document; h0's takes nothing", async () => {
    const v = litPair();
    const out = await v.wave(1) as Record<string, unknown>;
    expect((out["carriers"] as Array<Record<string, unknown>>)[0]).toMatchObject({ uri: URI, decision: "ingest" });
    expect(await v.own[1]!.get(URI)).not.toBeNull();
    expect(await v.own[0]!.get(URI)).toBeNull();
  });

  test("N2 — a forged wave naming face 1 over a document h0 owns refuses, and nothing lands", async () => {
    const v = litPair({ owners: { 0: 0, 1: 0 } });
    await expect(v.wave(1)).rejects.toMatchObject({ reason: "ingest-face-foreign" });
    expect(await v.own[1]!.get(URI)).toBeNull();
    expect(await v.own[0]!.get(URI)).toBeNull();
  });

  test("N3 — a wave naming no face whose target h1 owns refuses", async () => {
    const v = litPair({ owners: { 0: 1, 1: 1 } });
    await expect(v.wave()).rejects.toMatchObject({ reason: "ingest-face-foreign" });
    expect(await v.own[0]!.get(URI)).toBeNull();
  });

  test("CONTROL — a wave naming no face over the worn face's own document lands as before", async () => {
    const v = litPair();
    await v.wave();
    expect(await v.own[0]!.get(URI)).not.toBeNull();
  });

  test("N4 — a face this island resolves no layer for refuses face-unresolved, never landing on the worn face", async () => {
    const composite = new CompositeStore();
    const worn = new MemoryTiddlerStore();
    composite.addLayer({ bagId: WORKING, store: worn, writable: true, defaultWritable: true });
    const call = (faceTarget?: FaceTargetResolver) => makeActionReactorFor("INGEST", { composite, ...(faceTarget ? { faceTarget } : {}), diskMirrors: [{ bagId: WORKING, mirrorRoot: SOURCE, scope: "daemon" }] })({
      "source-uri": SOURCE, "to-bag": WORKING, "change-id": "chg-face-shut", face: 2,
      carriers: [{ uri: URI, text: meme("for a shut face"), diskHash: "sha256:0e", syncedHash: null, file: `${SOURCE}/one.mem` }],
    }, ctxOf(composite));
    await expect(call()).rejects.toMatchObject({ reason: "face-unresolved" });
    await expect(call(async () => null)).rejects.toMatchObject({ reason: "face-unresolved" });
    expect(await worn.get(URI)).toBeNull();
  });

  test("N5 — a face-named wave over a bag no face owns refuses", async () => {
    expect(isFaceOwnedLayer(WORKING)).toBe(true);
    expect(isFaceOwnedLayer("lar:///ha.ka.ba/bags/daemon-11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isFaceOwnedLayer("lar:///ha.ka.ba/bags/sdm")).toBe(false);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: "lar:///ha.ka.ba/bags/sdm", store: new MemoryTiddlerStore(), writable: true, defaultWritable: true });
    await expect(makeActionReactorFor("INGEST", { composite, faceTarget: async () => null, diskMirrors: [{ bagId: "lar:///ha.ka.ba/bags/sdm", mirrorRoot: "/lar/bags/sdm", scope: "sdm" }] })({
      "source-uri": "/lar/bags/sdm", "to-bag": "lar:///ha.ka.ba/bags/sdm", "change-id": "chg-face-canon", face: 1,
      carriers: [{ uri: URI, text: meme("canon"), diskHash: "sha256:0d", syncedHash: null, file: "/lar/bags/sdm/one.mem" }],
    }, ctxOf(composite))).rejects.toMatchObject({ reason: "face-layer-unowned" });
  });

  test("N6 — the parse refuses a face that reads as no whole handle index", () => {
    const base = { "source-uri": SOURCE, "to-bag": WORKING, "change-id": "c", carriers: [{ uri: URI, text: "x", diskHash: "sha256:00", syncedHash: null }] };
    const inv = (args: Record<string, unknown>) => ({ requestId: "r", title: "ingest", action: "INGEST", args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "t", requestedAt: "2026-11-10" }) as unknown as Verb;
    expect((parseResidencyAction(inv({ ...base, face: 1 })) as { face?: number } | null)?.face).toBe(1);
    expect(parseResidencyAction(inv({ ...base, face: -1 }))).toBeNull();
    expect(parseResidencyAction(inv({ ...base, face: "1" }))).toBeNull();
    expect(parseResidencyAction(inv({ ...base, face: 1.5 }))).toBeNull();
  });

  test("N7 — an AI seat wearing h0 naming h1 refuses face-hand-refused; its own face lands; the operator's hand names h1", async () => {
    const seat = { ordinal: 0, presenter: "did:key:z6MkSeatOfH0" };
    const v = litPair();
    await expect(v.wave(1, seat)).rejects.toMatchObject({ reason: "face-hand-refused" });
    expect(await v.own[1]!.get(URI)).toBeNull();
    await v.wave(0, seat);
    expect(await v.own[0]!.get(URI)).not.toBeNull();
    await v.wave(1);
    expect(await v.own[1]!.get(URI)).not.toBeNull();
  });
});
