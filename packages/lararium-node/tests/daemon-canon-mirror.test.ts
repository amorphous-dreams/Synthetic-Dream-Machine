/**
 * daemon-canon-mirror — the daemon wiki's canon (`bags/daemon`) projects its non-control records to
 * `<projections>/bags/daemon/`, a two-way canon mirror like any other, so a promoted memory survives a re-founding.
 *
 * Reds: a promoted memory meme in `bags/daemon` lands under `projections/bags/daemon/`; the daemon VM's mirror list
 * carries the canon mirror beside the observe render. Controls: a `bags/daemon/outcomes/*` row, a cap event and a swarm
 * control never land; a file a hand wrote there with other words, with no agreement behind it, stands: the gate never
 * writes over it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, test, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DAEMON_BAG_ID, PROJECTION_FILTER_TEXT, projectionFilterTitle } from "@lararium/mesh";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { daemonCanonMirror, daemonDiskMirrors, daemonObserveRoot, isDaemonCanonWithheld } from "../src/bag-paths.js";

type Flushable = { flush: (b: string, u: string) => Promise<void> };
const MEMORY = "lar:///ha.ka.ba/kahua/memory/heron";
const OUTCOME = `${DAEMON_BAG_ID}/outcomes/req-1`;
const CAP = `${DAEMON_BAG_ID}/cap/0123456789abcdef01234567/deadbeef`;
const SWARM = "$:/lares/swarm/lanes/one";
/** The house's identity records the daemon doc carries beside its control plane (measured, ceremony-core.ts). */
const HOUSE = [
  "lar:///ha.ka.ba/bags/persona/group-secret/abc", "lar:///ha.ka.ba/bags/persona/binding/signer-did",
  "lar:///ha.ka.ba/dreamnet/face-founding-checkpoint/c1", "lar:///ha.ka.ba/dreamnet/dyad/d1", "lar:///ha.ka.ba/dreamnet/persona-act/g/1/x",
  "lar:///ha.ka.ba/kahua/../bags/persona/hearth/true-name",
];
let base = "";
afterEach(() => { if (base) { rmSync(base, { recursive: true, force: true }); base = ""; } });

const body = (uri: string): string => `<<^ code=\`&#x0001;\` to=\`${uri}\`>>\n\nthe words of ${uri}\n`;

function rig(): { projector: Flushable; projections: string; refusals: string[] } {
  base = mkdtempSync(join(tmpdir(), "lar-daemon-canon-"));
  const projections = join(base, "projections");
  const refusals: string[] = [];
  const projector = new LarDiskProjector({
    mirrors: [daemonCanonMirror(projections)],
    syncedTree: new SyncedTree(null),
    carrierFileFn: async (uri) => (uri.startsWith("lar:") ? { ext: ".mem", body: body(uri) } : { ext: ".tid", body: `title: ${uri}\n\ngo\n`, defaultRelPath: "swarm.tid" }),
    onRefusal: (r) => refusals.push(r.reason),
  } as never) as unknown as Flushable;
  return { projector, projections, refusals };
}

describe("the daemon wiki's canon projects", () => {
  test("RED: the canon mirror roots at <projections>/bags/daemon, and the daemon VM's list carries it", () => {
    expect(daemonCanonMirror("/house/projections")).toEqual({ bagId: DAEMON_BAG_ID, mirrorRoot: join("/house/projections", "bags", "daemon") });
    const list = daemonDiskMirrors({ projectionRoot: "/p", canonBags: "/absent", faceRelation: null, observeDaemon: true });
    expect(list.filter((m) => m.bagId === DAEMON_BAG_ID).map((m) => [m.scope, m.mirrorRoot, m.mirrorClass ?? "canon"])).toEqual([
      ["daemon-observe", daemonObserveRoot("/p"), "observe"],
      ["daemon-canon", join("/p", "bags", "daemon"), "canon"],
    ]);
  });

  test("RED: a promoted memory meme in bags/daemon lands under projections/bags/daemon", async () => {
    const { projector, projections } = rig();
    await projector.flush(DAEMON_BAG_ID, MEMORY);
    const at = join(projections, "bags", "daemon", "ha.ka.ba", "kahua", "memory", "heron.mem");
    expect(existsSync(at), `nothing at ${at}`).toBe(true);
    expect(readFileSync(at, "utf8")).toBe(body(MEMORY));
  });

  test("CONTROL: an outcome row, a cap event and a swarm control never land anywhere under projections", async () => {
    const { projector, projections } = rig();
    for (const t of [OUTCOME, CAP, SWARM]) await projector.flush(DAEMON_BAG_ID, t);
    const walk = (d: string): string[] => (existsSync(d) ? readdirSync(d, { recursive: true }) as string[] : []);
    expect(walk(projections).filter((p) => /outcomes|cap|swarm/.test(p))).toEqual([]);
  });

  test("CONTROL: the house's identity records (persona namespace, sealed checkpoints, dyads, persona acts) never land", async () => {
    const { projector, projections } = rig();
    for (const t of HOUSE) { expect(isDaemonCanonWithheld(t), t).toBe(true); await projector.flush(DAEMON_BAG_ID, t); }
    expect(isDaemonCanonWithheld(MEMORY)).toBe(false);
    expect(isDaemonCanonWithheld("A Plain Note")).toBe(false);
    const walk = (d: string): string[] => (existsSync(d) ? (readdirSync(d, { recursive: true }) as string[]).filter((p) => p.includes(".")) : []);
    expect(walk(projections)).toEqual([]);
  });

  test("RED: the projector reads the filter as its wiki holds it: an override adding the memory family stops it projecting", async () => {
    const { projector, projections } = rig();
    const override = `${PROJECTION_FILTER_TEXT.daemon}\n[prefix[lar:///ha.ka.ba/kahua/memory/]]`;
    const wiki = { getTiddlerText: (t: string) => (t === projectionFilterTitle("daemon") ? override : undefined), getTiddler: () => undefined };
    const stop = (projector as unknown as { start: (tw5: unknown) => () => Promise<void> }).start({ $tw: { wiki } });
    await projector.flush(DAEMON_BAG_ID, MEMORY);
    await stop();
    expect(existsSync(join(projections, "bags", "daemon", "ha.ka.ba", "kahua", "memory", "heron.mem"))).toBe(false);
  });

  test("CONTROL: a file a hand wrote with other words and no agreement stands; the gate never writes over it", async () => {
    const { projector, projections } = rig();
    const at = join(projections, "bags", "daemon", "ha.ka.ba", "kahua", "memory", "heron.mem");
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, "a hand's own words\n");
    await projector.flush(DAEMON_BAG_ID, MEMORY);
    expect(readFileSync(at, "utf8")).toBe("a hand's own words\n");
  });
});
