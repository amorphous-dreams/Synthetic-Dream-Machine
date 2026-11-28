/**
 * lit-face-projection — EVERY LIT FACE PROJECTS ITS OWN WRITES (course item sibling-writes-wait-unprojected).
 *
 * After a vessel restart the worn face moved h1 → h0, and writes to h1 (lit, unworn) read back from the vessel but reached no
 * plaintext until h1 was worn again: the daemon island's mirror list named the worn face alone. The cure widens what stands: a
 * lit sibling carries its own mirror grants (`litFaceDiskMirrors`, under its own face root), and the island mounts one projector
 * over that face's own engine (`mountLitFaceProjection`) while the face stands lit.
 *
 *   F1 — a lit sibling's write projects into its own root while another face stands worn, and nothing of it reaches the worn root
 *   F2 — the worn face's projection stands unchanged: its write reaches its own root, and nothing of it reaches the sibling's
 *   F3 — two lit siblings each project only into their own root
 *   F4 — a shut sibling projects nothing: no folder makes no grant, and a grant with no root of its own mounts nothing
 *   F5 — the face boundary: a grant whose root meets the worn face's root drops, and a temp grant drops
 *   F6 — a face that drops stops its projection: a write after the stop reaches no disk
 *   F7 — SIBLING AGAINST SIBLING: two lit faces wearing one pet name (one folder): the second never mounts, a named alert
 *        rides the ward rail, and nothing of its reaches the first's root
 *   F8 — a hand-made link (`faces/h-alias -> faces/h-zero`) reads as the root it reaches: its grant drops, and the worn root
 *        takes nothing through it
 */
import { bootTestWiki, vendoredCore } from "../../lararium-tw5/tests/test-wiki.js";
import { createRequire } from "node:module";
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { wikiSlotUri, daemonFaceCanonBag } from "@lararium/mesh/wiki-recipe";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { type Repo as RepoType } from "@lararium/mesh/automerge";
import { faceEngines, type FaceEngineSource } from "../../lararium-tw5/src/face-engine.js";
import { makeTiddlerPutReactor } from "../../lararium-tw5/src/tiddler-verbs.js";
import { litFaceProjections } from "../../lararium-keyhive/src/lit-face-projections.js";
import { faceEngineReactor } from "../../lararium-keyhive/src/face-lane.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import { daemonDiskMirrors, faceRoot, litFaceDiskMirrors } from "../src/bag-paths.js";
import { litFaceProjector, litFaceProjectorFaces, mountDiskProjection, mountLitFaceProjection, mountedDiskProjector } from "../src/island-behaviors.js";
import type { LarDiskProjector } from "../src/disk-projector.js";

const WORKING = wikiSlotUri("daemon", "working");
const origin = { kind: "operator-import", sessionId: "lit-face-projection" } as const;
/** A face's founding relation, as its verified record names one (a v4 uuid), by handle index. */
const relationOf = (face: number): string => `0000000${face}-0000-4000-8000-00000000000${face}`;

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

/** One face's own engine: its own working document under the one daemon working bag id, as `face-engine` composes it. */
async function faceEngine() {
  const working = new MemoryTiddlerStore("working");
  const composite = new CompositeStore();
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  const tw5 = new TW5Engine();
  await tw5.boot(vendoredCore());
  const write = async (title: string, text: string): Promise<void> => {
    await working.put({ tiddler: { title, text } }, origin);
    tw5.$tw.wiki.addTiddler(new tw5.$tw.Tiddler({ title, text, "$origin-bag": WORKING }));
  };
  return { tw5, composite, write };
}

/** Every file's text under a folder, recursively; empty where the folder stands absent. */
function textsUnder(dir: string): string {
  if (!existsSync(dir)) return "";
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p); else out.push(readFileSync(p, "utf8"));
    }
  };
  walk(dir);
  return out.join("\n");
}

/** Every message the island posted (the ward rail's alerts among them). */
const posted: Array<{ listenable?: string; payload?: Record<string, unknown> }> = [];
const ctxOf = (engine: { tw5: TW5Engine; composite: CompositeStore }) => ({ tw5: engine.tw5, composite: engine.composite, post: (msg: never) => { posted.push(msg); }, wikiUri: "daemon" }) as never;

/** A vessel wearing h0, its island mounted over h0's engine with the worn list (`daemonDiskMirrors`). */
async function wornIsland() {
  root = mkdtempSync(join(tmpdir(), "lar-lit-face-"));
  const projections = join(root, "projections");
  const worn = await faceEngine();
  const manifest = { diskMirrors: daemonDiskMirrors({ projectionRoot: projections, canonBags: join(root, "bags"), face: { relation: relationOf(0), segment: "h-zero" } }) } as never;
  const stopWorn = mountDiskProjection(manifest, ctxOf(worn))!;
  const wornProjector = mountedDiskProjector()!;
  /** Light a sibling: its own engine, its own grants, its own projector. */
  const light = async (handleIndex: number, segment: string | null) => {
    const engine = await faceEngine();
    let projector: LarDiskProjector | null = null;
    const stop = mountLitFaceProjection(manifest, { handleIndex, diskMirrors: litFaceDiskMirrors(projections, segment === null ? null : { relation: relationOf(handleIndex), segment }) },
      engine, ctxOf(worn), { projectionsRoot: projections, projected: (p) => { projector = p; } });
    return { engine, stop, idle: async () => { await projector?.idle(); }, root: segment === null ? null : faceRoot(projections, segment) };
  };
  return { projections, worn, stopWorn, wornProjector, wornRoot: faceRoot(projections, "h-zero"), light };
}

describe("every lit face projects its own writes", () => {
  test("a face-lane put reaches disk after the lit sibling rebuilds for its arriving slot", async () => {
    const house = await wornIsland();
    const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { network: unknown[] }) => RepoType;
    const repo = new Repo({ network: [] });
    const canon = repo.create<LarDoc>(emptyLarDoc());
    const working = repo.create<LarDoc>(emptyLarDoc());
    const canonBag = daemonFaceCanonBag(relationOf(1));
    let slotted = false;
    const source = () => ({ boot: async (seedFor: Parameters<FaceEngineSource["boot"]>[0]) => bootTestWiki({ seed: await seedFor([]) }), recipe: { wikiSlug: "daemon", canonBag }, ready: [
      { slot: canonBag, handle: canon }, ...(slotted ? [{ slot: WORKING, handle: working }] : []),
    ] });
    const order: string[] = [];
    let projector: LarDiskProjector | undefined;
    const engines = faceEngines(async () => source(), {
      rebuilding: async (face) => { order.push("rebuilding"); await seats.rebuilding(face); },
      rebuilt: (face) => { order.push("rebuilt"); void seats.rebuilt(face); },
    });
    const seats = litFaceProjections({
      engine: (face) => engines.of(face),
      mount: (face, engine) => {
        order.push("mount");
        const stop = mountLitFaceProjection({ diskMirrors: [] }, face, engine as never, ctxOf(house.worn), {
          projectionsRoot: house.projections, projected: (p) => { projector = p; },
        });
        return stop && (async () => { await stop(); order.push("projector let go"); });
      },
    });
    try {
      await engines.of(1);
      await seats.light("k1", { handleIndex: 1, diskMirrors: litFaceDiskMirrors(house.projections, { relation: relationOf(1), segment: "h-one" }) });
      slotted = true;
      const put = faceEngineReactor("tiddler-put", async () => ({}), (engine) => makeTiddlerPutReactor(engine as never), {
        mountedKey: () => "worn", mountedOrdinal: () => 0, lit: (key) => key === "sibling" ? { handleIndex: 1 } : null,
        engine: (face) => engines.of(face),
      });
      await put({ recipe: "default", title: "After slot", text: "landed after rebuild" }, { presenter: "sibling", daemon: {} as never, invocation: { requestId: "face-chain" } as never, cap: async () => ({ ok: true }) } as never);
      const deadline = Date.now() + 5000;
      while (order.filter((s) => s === "mount").length < 2 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
      expect(order).toEqual(["mount", "rebuilding", "projector let go", "rebuilt", "mount"]);
      while (!textsUnder(faceRoot(house.projections, "h-one")).includes("landed after rebuild") && Date.now() < deadline) {
        await projector?.idle();
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(textsUnder(join(faceRoot(house.projections, "h-one"), "wikis", "daemon"))).toContain("landed after rebuild");
    } finally { await seats.drop("k1"); await engines.dropAll(); await repo.shutdown(); await house.stopWorn(); }
  }, 60_000);
  test("a pet named faces still owns its whole face root", async () => {
    const house = await wornIsland();
    const engine = await faceEngine();
    const petRoot = faceRoot(house.projections, "faces");
    const stop = mountLitFaceProjection(
      { diskMirrors: [{ bagId: WORKING, mirrorRoot: join(petRoot, "other"), scope: "daemon" }] },
      { handleIndex: 9, diskMirrors: [{ bagId: WORKING, mirrorRoot: join(petRoot, "wikis", "daemon"), scope: "daemon" }] },
      engine, ctxOf(house.worn), { projectionsRoot: house.projections },
    );
    try { expect(stop).toBeUndefined(); }
    finally { await stop?.(); await house.stopWorn(); }
  }, 60_000);
  test("F1 · F2 — a lit sibling projects into its own root while h0 stands worn; the worn projection stands unchanged", async () => {
    const house = await wornIsland();
    const h1 = await house.light(1, "h-one");
    try {
      expect(h1.stop).toBeTypeOf("function");
      await h1.engine.write("Sibling note", "written to h1 while h0 stands worn");
      await h1.idle();
      expect(textsUnder(join(h1.root!, "wikis", "daemon"))).toContain("written to h1 while h0 stands worn");
      expect(textsUnder(house.wornRoot)).not.toContain("written to h1");
      await house.worn.write("Worn note", "written to h0, the worn face");
      await house.wornProjector.idle();
      expect(textsUnder(join(house.wornRoot, "wikis", "daemon"))).toContain("written to h0, the worn face");
      expect(textsUnder(h1.root!)).not.toContain("written to h0");
    } finally { await h1.stop?.(); await house.stopWorn(); }
  }, 60_000);

  test("F3 — two lit siblings each project only into their own root", async () => {
    const house = await wornIsland();
    const h1 = await house.light(1, "h-one");
    const h2 = await house.light(2, "h-two");
    try {
      await h1.engine.write("One", "only h1 holds this");
      await h2.engine.write("Two", "only h2 holds this");
      await Promise.all([h1.idle(), h2.idle()]);
      expect(textsUnder(h1.root!)).toContain("only h1 holds this");
      expect(textsUnder(h1.root!)).not.toContain("only h2");
      expect(textsUnder(h2.root!)).toContain("only h2 holds this");
      expect(textsUnder(h2.root!)).not.toContain("only h1");
      expect(textsUnder(house.wornRoot)).not.toMatch(/only h[12]/);
    } finally { await h1.stop?.(); await h2.stop?.(); await house.stopWorn(); }
  }, 60_000);

  test("F4 — a face that makes no folder carries no grant and mounts no projector", async () => {
    expect(litFaceDiskMirrors("/lar/projections", null)).toEqual([]);
    const house = await wornIsland();
    const shut = await house.light(3, null);
    try {
      expect(shut.stop).toBeUndefined();
      await shut.engine.write("Shut", "never reaches disk");
      expect(textsUnder(house.projections)).not.toContain("never reaches disk");
    } finally { await house.stopWorn(); }
  }, 60_000);

  test("F5 — the face boundary: a grant meeting the worn root drops, and so does a temp grant", async () => {
    const house = await wornIsland();
    const intruder = await faceEngine();
    try {
      const stop = mountLitFaceProjection({ diskMirrors: daemonDiskMirrors({ projectionRoot: house.projections, canonBags: join(root, "bags"), face: { relation: relationOf(0), segment: "h-zero" } }) },
        { handleIndex: 4, diskMirrors: [
          { bagId: WORKING, mirrorRoot: join(house.wornRoot, "wikis", "daemon"), scope: "daemon" },
          { bagId: wikiSlotUri("daemon", "temp"), mirrorRoot: join(faceRoot(house.projections, "h-four"), "wikis", "daemon", "temp"), scope: "daemon-temp", tempLayer: true },
        ] }, intruder, ctxOf(house.worn));
      expect(stop).toBeUndefined();
      await intruder.write("Intruder", "h4 reaches for h0's root");
      await house.wornProjector.idle();
      expect(textsUnder(house.projections)).not.toContain("h4 reaches");
    } finally { await house.stopWorn(); }
  }, 60_000);

  test("RED F9 — a lit sibling's projector seats on the island's shore by its face while it stands, and leaves it at the drop: `lares shore face=N` reads it without a wear", async () => {
    const house = await wornIsland();
    const h1 = await house.light(1, "h-one");
    try {
      expect(litFaceProjector(1)).not.toBeNull();
      expect(litFaceProjectorFaces()).toEqual([1]);
      expect(litFaceProjector(0), "the worn face's projector stays the island's own").toBeNull();
      await h1.stop!();
      expect(litFaceProjector(1)).toBeNull();
      expect(litFaceProjectorFaces()).toEqual([]);
    } finally { await house.stopWorn(); }
  }, 60_000);

  test("F6 — a face that drops stops its projection", async () => {
    const house = await wornIsland();
    const h1 = await house.light(1, "h-one");
    try {
      await h1.engine.write("Before", "landed while lit");
      await h1.idle();
      await h1.stop!();
      await h1.engine.write("After", "written after the drop");
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(textsUnder(h1.root!)).toContain("landed while lit");
      expect(textsUnder(h1.root!)).not.toContain("written after the drop");
    } finally { await house.stopWorn(); }
  }, 60_000);

  test("F7 — two lit faces sharing one folder: the second never mounts, the alert names it, and its writes reach no root", async () => {
    const house = await wornIsland();
    posted.length = 0;
    const first = await house.light(1, "h-shared");
    const second = await house.light(2, "h-shared");
    try {
      expect(first.stop).toBeTypeOf("function");
      expect(second.stop, "the second face's projection never mounts over a root the first holds").toBeUndefined();
      const alert = posted.find((m) => m.listenable === "lit-face:root-shared");
      expect(alert?.payload).toMatchObject({ verb: "ward-alert", wardKind: "lit-face-root-shared" });
      expect(String(alert?.payload?.["reason"])).toContain("h1");
      await first.engine.write("First", "the first face holds this folder");
      await second.engine.write("Second", "the second face shares a name");
      await first.idle();
      expect(textsUnder(first.root!)).toContain("the first face holds this folder");
      expect(textsUnder(house.projections)).not.toContain("the second face shares a name");
    } finally { await first.stop?.(); await house.stopWorn(); }
  }, 60_000);

  test("F7b — once the first face drops, the folder frees: a later light of the second mounts", async () => {
    const house = await wornIsland();
    const first = await house.light(1, "h-shared");
    await first.stop!();
    const second = await house.light(2, "h-shared");
    try { expect(second.stop).toBeTypeOf("function"); }
    finally { await second.stop?.(); await house.stopWorn(); }
  }, 60_000);

  test("F8 — a link to the worn root reads as the worn root: its grant drops", async () => {
    const house = await wornIsland();
    mkdirSync(house.wornRoot, { recursive: true });
    symlinkSync(house.wornRoot, faceRoot(house.projections, "h-alias"));
    const alias = await house.light(5, "h-alias");
    try {
      expect(alias.stop, "a link into the worn root mounts nothing").toBeUndefined();
      await alias.engine.write("Alias", "through the link");
      await house.wornProjector.idle();
      expect(textsUnder(house.wornRoot)).not.toContain("through the link");
    } finally { await house.stopWorn(); }
  }, 60_000);
});
