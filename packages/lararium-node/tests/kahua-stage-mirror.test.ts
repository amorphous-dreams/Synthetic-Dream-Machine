/**
 * kahua-stage-mirror — the face's kahua stage projects under the STATE root, items sited by title, a project as the
 * leading path segment; nothing private ever lands in the workspace's `bags/` or `wikis/`.
 *
 * THE LAYOUT (operator ruling, 2026-11-01): `<state>/faces/<pet name>/bags/kahua` holds the fleet-synced, lift-only bag; projects ride
 * inside as `$(project)$/**` tiddler paths. Workspace canon writes back to `/workspace/bags/<bag>`; private layers write
 * ONLY under state, even when the canon source (`LAR_BAGS`) points at the checkout and holds `kahua/` or `daemon/` dirs.
 *
 * Reds: a kahua item lands at `<state>/faces/<pet name>/bags/kahua/<project>/<path>`; a `lar:` item keeps its loci path. Controls: the
 * workspace bags/ and wikis/ stay empty though the canon source holds a `kahua/` dir; a title that climbs out refuses.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { kahuaStageMirror, projectionRoots, titleRelPath } from "../src/bag-paths.js";
import { KAHUA_BAG } from "@lararium/mesh/wiki-recipe";
import type { CarrierFile } from "@lararium/tw5";

type Flushable = { flush: (b: string, u: string) => Promise<void> };
/** The worn face: its pet name names its root (`faces/Heron/`); its relation names its bags alone. */
const TAG = "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31";
const SITE = { relation: TAG, segment: "Heron" };
let base = "";
afterEach(() => { if (base) { rmSync(base, { recursive: true, force: true }); base = ""; } });

const tid = (title: string): CarrierFile => ({ ext: ".tid", body: `title: ${title}\n\nbody of ${title}\n`, defaultRelPath: `${title.replace(/\/|\\/g, "_")}.tid` });

function rig(): { projector: Flushable; state: string; workspace: string; refusals: string[] } {
  base = mkdtempSync(join(tmpdir(), "lar-kahua-mirror-"));
  const state = join(base, "state"), workspace = join(base, "workspace");
  // The canon source holds every private plane's name as a dir, as a checkout that ever held one would.
  for (const d of ["lares", "kahua", "daemon"]) mkdirSync(join(workspace, "bags", d), { recursive: true });
  mkdirSync(join(workspace, "wikis"), { recursive: true });
  const refusals: string[] = [];
  const roots = projectionRoots({ projectionRoot: state, canonBags: join(workspace, "bags") });
  expect(roots.bagRoot("kahua"), "the canon source never claims the stage").toBe(join(state, "bags", "kahua"));
  const projector = new LarDiskProjector({
    mirrors: [kahuaStageMirror(state, SITE)],
    carrierFileFn: async (uri) => uri.startsWith("lar:") ? { ext: ".mem", body: "<<^ code=`&#x0001;`>>\n" } : tid(uri),
    onRefusal: (r) => refusals.push(r.reason),
  }) as unknown as Flushable;
  return { projector, state, workspace, refusals };
}

describe("the kahua stage projects under state", () => {
  test("RED: the mirror roots at <state>/faces/<pet name>/bags/kahua and sites by title", () => {
    expect(kahuaStageMirror("/house/state", SITE)).toEqual({ bagId: KAHUA_BAG, mirrorRoot: join("/house/state", "faces", "Heron", "bags", "kahua"), titlePaths: true });
    expect(titleRelPath("lares-dev/notes/stage")).toBe("lares-dev/notes/stage");
    expect(titleRelPath("Plain Note")).toBe("Plain Note");
  });

  test("RED: a kahua item lands at <state>/faces/<pet name>/bags/kahua/<project>/<path>; a lar: item keeps its loci path", async () => {
    const { projector, state } = rig();
    await projector.flush(KAHUA_BAG, "lares-dev/notes/stage");
    await projector.flush(KAHUA_BAG, "lar:///ha.ka.ba/kahua/item");
    const at = join(state, "faces", "Heron", "bags", "kahua", "lares-dev", "notes", "stage.tid");
    expect(existsSync(at), `nothing at ${at}`).toBe(true);
    expect(readFileSync(at, "utf8")).toContain("title: lares-dev/notes/stage");
    expect(existsSync(join(state, "faces", "Heron", "bags", "kahua", "ha.ka.ba", "kahua", "item.mem"))).toBe(true);
  });

  test("CONTROL: nothing private appears under the workspace bags/ or wikis/", async () => {
    const { projector, workspace } = rig();
    await projector.flush(KAHUA_BAG, "lares-dev/notes/stage");
    for (const d of ["lares", "kahua", "daemon"]) expect(readdirSync(join(workspace, "bags", d)), `workspace bags/${d}`).toEqual([]);
    expect(readdirSync(join(workspace, "wikis"))).toEqual([]);
  });

  test("CONTROL: a title that climbs out of the stage, or names no path, sites nowhere by this rule", async () => {
    expect(titleRelPath("../../escape")).toBeNull();
    expect(titleRelPath("a//b")).toBeNull();
    expect(titleRelPath("/abs")).toBeNull();
    expect(titleRelPath("$:/config/Foo")).toBeNull();
    expect(titleRelPath("lar:///ha.ka.ba/x")).toBeNull();
    const { projector, state, workspace } = rig();
    await projector.flush(KAHUA_BAG, "../../escape");
    expect(existsSync(join(state, "escape.tid"))).toBe(false);
    expect(existsSync(join(base, "escape.tid"))).toBe(false);
    expect(readdirSync(join(workspace, "bags", "kahua"))).toEqual([]);
  });
});
