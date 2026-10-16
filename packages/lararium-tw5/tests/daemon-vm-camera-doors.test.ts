/**
 * daemon-vm-camera-doors — the daemon VM's camera doors speak the `lar:` contract on both legs.
 *
 * Down, the VM forwards each `lar:frame` the island posts to `onFrame`, read fail-closed, and each
 * `lar:control-result` to `onControlResult`. Up, `sendControlEvent` posts the event whole and `resend` asks
 * the island to paint a camera whole. A scripted island stands in for the worker: it records what crosses its
 * boundary and posts what the vector tells it to, so each assertion reads what crossed, never a clock.
 */
import { createRequire } from "node:module";
import { afterEach, describe, expect, test } from "vitest";
import {
  emptyLarDoc, LAR_CAMERA_STORY, mkLarControlEvent, mkLarControlResult, mkLarFrame,
  type IslandMsg_Manifest, type LarDoc, type LarMsg_ControlResult, type LarMsg_Frame, type Repo as RepoType,
} from "@lararium/mesh";
import { openDaemonVmCore, type DaemonVmHost } from "../src/daemon-vm-core.js";

const Repo = createRequire(import.meta.resolve("@lararium/mesh"))("@automerge/automerge-repo").Repo as new (options: { sharePolicy?: () => Promise<boolean> }) => RepoType;

function scriptedIsland() {
  const listeners = new Set<(raw: unknown) => void>();
  const crossed: unknown[] = [];
  return {
    handle: {
      post: (msg: unknown) => { crossed.push(msg); },
      listen: (h: (raw: unknown) => void): (() => void) => { listeners.add(h); return () => { listeners.delete(h); }; },
      onError: (): (() => void) => () => {},
      terminate: () => {},
    },
    say: (msg: unknown): void => { for (const l of [...listeners]) l(msg); },
    crossed,
  };
}

describe("the daemon VM's camera doors", () => {
  const cleanups: Array<() => void | Promise<void>> = [];
  afterEach(async () => { for (const c of cleanups.splice(0)) await c(); });

  function open() {
    const repo = new Repo({ sharePolicy: async () => true });
    const daemonHandle = repo.create<LarDoc>(emptyLarDoc());
    const island = scriptedIsland();
    const ports: MessagePort[] = [];
    const host: DaemonVmHost = {
      spawnWorker: () => island.handle,
      newSyncChannel: () => {
        const { port1, port2 } = new MessageChannel();
        ports.push(port1, port2);
        return { mainPort: port1 as unknown as IslandMsg_Manifest["syncPort"], syncPort: port2 as unknown as IslandMsg_Manifest["syncPort"] };
      },
    };
    const core = openDaemonVmCore(host, {
      repo, daemonHandle,
      recipe: { wikiSlug: "daemon" }, grants: { islandUrl: daemonHandle.url }, coreHash: null,
      workerScriptUrl: new URL("file:///unused-scripted-island"),
      eaSilenceMs: 2 ** 30,
    });
    core.workerEa.catch(() => {});
    cleanups.push(() => core.dispose());
    cleanups.push(() => { for (const p of ports) p.close(); });
    cleanups.push(() => repo.shutdown().then(() => {}));
    return { core, island };
  }

  const frame = mkLarFrame({
    wikiUri: "lar:///daemon", cameraId: LAR_CAMERA_STORY, mountEpoch: 7,
    keys: [{ key: "lar:surface", rev: 3, html: "<p>daemon</p>" }, { key: "lar:membership", rev: 1, members: ["lar:surface", "lar:style"] }],
    sensedRevision: { "12": 4 },
  });

  test("RED: a lar:frame reaches onFrame whole — CONTROL: a malformed frame and the old scalar envelope reach nothing", () => {
    const { core, island } = open();
    const seen: LarMsg_Frame[] = [];
    core.onFrame((f) => seen.push(f));
    island.say(frame);
    expect(seen).toEqual([frame]);
    island.say({ ...frame, keys: [{ key: "lar:surface", rev: 4, html: "<p/>", css: "two payloads" }] });
    island.say({ type: "event", wikiUri: "lar:///daemon", listenable: "projection:frame", payload: { html: "<p/>", css: "", rev: 9 } });
    expect(seen, "neither a malformed frame nor the old envelope paints").toEqual([frame]);
  });

  test("RED: a lar:control-result reaches onControlResult — CONTROL: a result with no status reaches nothing", () => {
    const { core, island } = open();
    const seen: LarMsg_ControlResult[] = [];
    core.onControlResult((r) => seen.push(r));
    const result = mkLarControlResult({ eventId: "e-1", cameraId: LAR_CAMERA_STORY, mountEpoch: 7, renderId: "12", status: "refused", reason: "unclaimed" });
    island.say(result);
    island.say({ ...result, eventId: "e-2", status: "maybe" });
    expect(seen).toEqual([result]);
  });

  test("RED: sendControlEvent and resend post the contract's messages whole — CONTROL: the old door names stand absent", () => {
    const { core, island } = open();
    const ev = mkLarControlEvent({ eventId: "e-1", cameraId: LAR_CAMERA_STORY, mountEpoch: 7, kind: "lar:act", renderId: "12", action: "lar:click", seenFrameRev: 3 });
    const before = island.crossed.length;
    core.sendControlEvent(ev);
    core.resend(LAR_CAMERA_STORY);
    expect(island.crossed.slice(before)).toEqual([ev, { type: "lar:resend", cameraId: LAR_CAMERA_STORY }]);
    for (const old of ["sendDomEvent", "sendDomInput", "onProjection"]) expect(old in core, old).toBe(false);
  });
});
