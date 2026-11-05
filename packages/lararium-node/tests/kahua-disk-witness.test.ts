/**
 * kahua-disk-witness — the ruled disk layout of the daemon VM's projections, read over the real projector and the
 * very mirror list the daemon VM hands its island (`daemonDiskMirrors`).
 *
 * THE LAYOUT (operator ruling, 2026-11-01, revised): the kahua wiki's working top (`wikis/daemon/working`) writes flat
 * files to `<state>/wikis/kahua-<F>`, as every wiki writes its working layer; a lift lands in `bags/kahua`, projected at
 * `<state>/bags/kahua-<F>/<title path>`; the daemon bag (`bags/daemon`) stays the CRDT-only control plane, so no control
 * record (checkpoint, persona act, cap event, group-secret seal, binding) and no `bags/daemon` dir ever reaches disk,
 * under the state root or the workspace, even with the canon source (`LAR_BAGS`) at a checkout-like tree.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, basename, dirname } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { daemonDiskMirrors, daemonWorkingMirror, kahuaStageMirror, kahuaFaceFolder } from "../src/bag-paths.js";
import {
  CROSSROADS_DOC_URI, DAEMON_BAG_ID, KAHUA_BAG, OUTCOME_URI_PREFIX, PERSONAL_BINDINGS_PREFIX, PERSONA_ACT_ENTRY_PREFIX,
  groupSecretSealTitle, wikiSlotUri,
} from "@lararium/mesh";
import type { CarrierFile } from "@lararium/tw5";

type Flushable = { flush: (b: string, u: string) => Promise<void> };
const WORKING = wikiSlotUri("daemon", "working");
/** The worn face: its relation names the folders (`kahua-<F>`). */
const TAG = "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31";
const FACE = kahuaFaceFolder(TAG);

/** One record of each control kind, titled as its writer titles it, every one resting in the daemon bag. */
const CONTROL_RECORDS: readonly string[] = [
  "lar:///ha.ka.ba/dreamnet/face-founding-checkpoint/c0ffee",          // a sealed checkpoint (ceremony-core)
  `${PERSONA_ACT_ENTRY_PREFIX}act-0001`,                               // a persona act
  `${DAEMON_BAG_ID}/cap/abc123/deadbeef`,                              // a cap event (`capEventTitle`)
  groupSecretSealTitle("lar:///ha.ka.ba/bags/persona-group/abc"),      // a group-secret seal
  `${PERSONAL_BINDINGS_PREFIX}/f1ng3rpr1nt`,                           // a binding
];

let base = "";
afterEach(() => { if (base) { rmSync(base, { recursive: true, force: true }); base = ""; } });

const carrier = async (uri: string): Promise<CarrierFile> => uri.startsWith("lar:")
  ? { ext: ".mem", body: "<<^ code=`&#x0001;`>>\n" }
  : { ext: ".tid", body: `title: ${uri}\n\nbody of ${uri}\n`, defaultRelPath: `${uri.replace(/\/|\\/g, "_")}.tid` };

/** A house: the canon source stands checkout-like (`<workspace>/bags/{lares,lararium,crossroads}` beside `wikis/`). */
function rig(canonDirs: readonly string[] = ["lares", "lararium", "crossroads"]): { projector: Flushable; state: string; workspace: string } {
  base = mkdtempSync(join(tmpdir(), "lar-kahua-disk-"));
  const state = join(base, "state"), workspace = join(base, "workspace");
  for (const d of canonDirs) mkdirSync(join(workspace, "bags", d), { recursive: true });
  mkdirSync(join(workspace, "wikis"), { recursive: true });
  const projector = new LarDiskProjector({
    mirrors: daemonDiskMirrors({ rootDir: state, canonBags: join(workspace, "bags"), faceRelation: TAG }),
    carrierFileFn: carrier,
  }) as unknown as Flushable;
  return { projector, state, workspace };
}

/** Every path under `dir` (files and dirs), relative; an absent dir walks empty. */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const step = (d: string): void => {
    for (const name of readdirSync(d)) {
      const at = join(d, name);
      out.push(relative(dir, at));
      if (statSync(at).isDirectory()) step(at);
    }
  };
  step(dir);
  return out;
}

/** Every `bags/daemon` dir under `dir`. */
const daemonBagDirs = (dir: string): string[] =>
  walk(dir).filter((p) => basename(p) === "daemon" && basename(dirname(join(dir, p))) === "bags");

describe("the daemon VM's mirror list names the ruled layout", () => {
  test("RED: the working top, the kahua stage and crossroads; never the daemon bag", () => {
    const state = "/house/state";
    const mirrors = daemonDiskMirrors({ rootDir: state, canonBags: "/house/workspace/bags-absent", faceRelation: TAG });
    expect(mirrors.map((m) => [m.bagId, m.mirrorRoot])).toEqual([
      [WORKING, join(state, "wikis", FACE)],
      [KAHUA_BAG, join(state, "bags", FACE)],
      [CROSSROADS_DOC_URI, join(state, "bags", "crossroads")],
    ]);
    expect(mirrors.some((m) => m.bagId === DAEMON_BAG_ID), "the control plane holds a mirror").toBe(false);
    expect(mirrors.some((m) => m.mirrorRoot.endsWith(join("bags", "daemon"))), "a mirror roots at bags/daemon").toBe(false);
    // The crossroads guard defaults ON; only a proven charter lifts it.
    expect(mirrors.find((m) => m.bagId === CROSSROADS_DOC_URI)?.guardNexusHandles).toBe(true);
    expect(daemonDiskMirrors({ rootDir: state, canonBags: "/x", faceRelation: TAG, guardCrossroadsNexusHandles: false })
      .find((m) => m.bagId === CROSSROADS_DOC_URI)?.guardNexusHandles).toBe(false);
  });

  test("CONTROL: the working top and the stage mirror by their own minters", () => {
    expect(daemonWorkingMirror("/s", TAG)).toEqual({ bagId: WORKING, mirrorRoot: join("/s", "wikis", FACE) });
    expect(kahuaStageMirror("/s", TAG)).toEqual({ bagId: KAHUA_BAG, mirrorRoot: join("/s", "bags", FACE), titlePaths: true });
  });
});

describe("the kahua disk witnesses", () => {
  test("(a) a write in the kahua wiki lands as a flat file under <state>/wikis/kahua-<F>", async () => {
    const { projector, state, workspace } = rig();
    await projector.flush(WORKING, "Plain Note");
    await projector.flush(WORKING, "lar:///ha.ka.ba/t/kahua/note");
    expect(readFileSync(join(state, "wikis", FACE, "Plain Note.tid"), "utf8")).toContain("title: Plain Note");
    expect(existsSync(join(state, "wikis", FACE, "ha.ka.ba", "t", "kahua", "note.mem"))).toBe(true);
    expect(walk(join(workspace, "wikis")), "the private working top reached the workspace wikis/").toEqual([]);
  });

  test("(b) a lift lands under <state>/bags/kahua-<F>/<title path>", async () => {
    const { projector, state, workspace } = rig();
    await projector.flush(KAHUA_BAG, "lares-dev/notes/stage");
    expect(readFileSync(join(state, "bags", FACE, "lares-dev", "notes", "stage.tid"), "utf8")).toContain("title: lares-dev/notes/stage");
    expect(existsSync(join(workspace, "bags", FACE)), "the stage reached the workspace bags/").toBe(false);
    expect(existsSync(join(state, "bags", "kahua")), "an untagged stage folder").toBe(false);
  });

  test("(c) no control record and no bags/daemon dir reaches disk, under state or the checkout-like workspace", async () => {
    const { projector, state, workspace } = rig();
    for (const title of CONTROL_RECORDS) await projector.flush(DAEMON_BAG_ID, title);
    // The live layers beside it still write, so the silence above reads against projections that run.
    await projector.flush(WORKING, "Plain Note");
    await projector.flush(KAHUA_BAG, "lares-dev/notes/stage");
    expect(walk(state).length, "the positive writes never landed: the zero below proves nothing").toBeGreaterThan(0);
    expect(daemonBagDirs(state), "a bags/daemon dir under state").toEqual([]);
    expect(daemonBagDirs(workspace), "a bags/daemon dir under the workspace").toEqual([]);
    const everything = [...walk(state), ...walk(workspace)];
    for (const leaf of ["face-founding-checkpoint", "persona-act", "cap", "group-secret", "personal-bindings"]) {
      expect(everything.filter((p) => p.split("/").includes(leaf)), `a control record (${leaf}) on disk`).toEqual([]);
    }
  });

  test("(d) a daemon title the working top holds (a verb outcome, any bags/daemon/** record) never projects under <state>/wikis/kahua-<F>", async () => {
    // The daemon stays the control plane, never projected (operator, 2026-11-01). A verb outcome or a daemon flow record
    // that reaches the working top by any road still writes no file: the projector reads the title, never the layer.
    const { projector, state } = rig();
    await projector.flush(WORKING, `${OUTCOME_URI_PREFIX}req-0001`);
    await projector.flush(WORKING, `${DAEMON_BAG_ID}/flows/couple`);
    await projector.flush(WORKING, "Plain Note");
    const kahua = walk(join(state, "wikis", FACE));
    expect(kahua, "the ordinary write landed: the absence below proves something").toContain("Plain Note.tid");
    expect(kahua.filter((p) => p.split("/").includes("outcomes")), "an outcomes/ path under <state>/wikis/kahua-<F>").toEqual([]);
    expect(kahua.filter((p) => p.split("/").includes("daemon")), "a bags/daemon record under <state>/wikis/kahua-<F>").toEqual([]);
  });

  test("CONTROL (c): a canon source holding stale daemon/ and kahua/ dirs receives nothing into them", async () => {
    const { projector, state, workspace } = rig(["lares", "crossroads", "daemon", "kahua"]);
    for (const title of CONTROL_RECORDS) await projector.flush(DAEMON_BAG_ID, title);
    await projector.flush(WORKING, "Plain Note");
    await projector.flush(KAHUA_BAG, "lares-dev/notes/stage");
    expect(readdirSync(join(workspace, "bags", "daemon"))).toEqual([]);
    expect(readdirSync(join(workspace, "bags", "kahua"))).toEqual([]);
    expect(daemonBagDirs(state)).toEqual([]);
    expect(existsSync(join(state, "bags", FACE, "lares-dev", "notes", "stage.tid"))).toBe(true);
  });
});
