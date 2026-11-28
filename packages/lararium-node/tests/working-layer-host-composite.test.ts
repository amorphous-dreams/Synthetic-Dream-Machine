/**
 * working-layer-host-composite — the host's composite mounts the SAME working document the worker attached, and the
 * outcome ledger (a write's verdict row) rests in neither.
 *
 * The worker attaches the daemon wiki's working layer through the real `operatorDaemonOptions` boot; the host
 * composite then mounts the document the worker's own binding resolver names. A verdict row written through the
 * host's CONTROL store lands in the control document and in neither that working document,
 * the daemon bag nor the persona layer, with and without a persona layer on the host.
 */
import { afterEach, describe, expect, test } from "vitest";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { OUTCOME_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { mkDaemonResolveBindingResult, mkEa, type IslandMsg_Manifest } from "@lararium/mesh/island-protocol";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { openDaemonVmCore, type DaemonVmHost } from "@lararium/tw5";
import { standFoundedIsland } from "./stand-founded-island.js";

const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

describe("daemon VM host composite working binding", () => {
  test.each([false, true])("a verdict row written on the host's control store lands in the control document, never the worker's working document (persona layer on the host: %s)", async (seated) => {
    const st = await standFoundedIsland(teardown);
    const opts = operatorDaemonOptions({ daemonAuth: st.daemonAuth } as never, { dyadReading: () => "clear" });
    const kh = await opts.verifierFactory!(st.ctx);
    teardown.push(() => { void (kh as { dispose?: () => Promise<void> }).dispose?.(); });
    const working = wikiSlotUri("daemon", "working");
    const workerHandle = (st.ctx as unknown as { handles: Map<string, { url: string }> }).handles.get(working)!;
    expect(workerHandle, "the worker attached no working layer").toBeDefined();

    const personaHandle = seated ? st.vesselRepo.create<LarDoc>(emptyLarDoc()) : undefined;
    const listeners: Array<(message: unknown) => void> = [];
    const posted: Array<{ type?: string; requestId?: string; fingerprint?: string; recipeTrace?: never; wikiSlug?: string }> = [];
    const worker = {
      post: (message: unknown) => { posted.push(message as never); },
      listen: (listener: (message: unknown) => void) => { listeners.push(listener); return () => {}; },
      onError: () => () => {},
      terminate: () => {},
    };
    const ports: MessagePort[] = [];
    const host: DaemonVmHost = {
      spawnWorker: () => worker,
      newSyncChannel: () => {
        const { port1, port2 } = new MessageChannel();
        ports.push(port1, port2);
        return { mainPort: port1 as unknown as IslandMsg_Manifest["syncPort"], syncPort: port2 as unknown as IslandMsg_Manifest["syncPort"] };
      },
    };
    const core = openDaemonVmCore(host, {
      repo: st.vesselRepo, daemonHandle: st.daemonHandle, controlHandle: st.vesselRepo.create<LarDoc>(emptyLarDoc()),
      ...(personaHandle ? { personaHandle, personaBagId: "lar:///ha.ka.ba/personas/test" } : {}),
      recipe: { wikiSlug: "daemon" }, grants: { islandUrl: st.daemonHandle.url }, coreHash: null,
      workerScriptUrl: new URL("file:///unused-fake-worker"),
    });
    teardown.push(() => { core.dispose(); for (const port of ports) port.close(); });

    listeners.forEach((listener) => listener(mkEa(DAEMON_BAG_ID)));
    const mount = core.mountHostWorkingLayer();
    for (let turn = 0; turn < 20 && !posted.some((m) => m.type === "daemon:resolve-binding-request"); turn++) await new Promise((r) => setTimeout(r, 0));
    const ask = posted.find((m) => m.type === "daemon:resolve-binding-request")!;
    // The worker's side of the ask is its real resolver, over the ctx whose boot just ran.
    const answer = await opts.resolveBinding!(st.ctx, ask.fingerprint!, ask.recipeTrace!, ask.wikiSlug!);
    listeners.forEach((listener) => listener(mkDaemonResolveBindingResult({
      requestId: ask.requestId!, personalUrl: answer.personalUrl, draftUrl: answer.draftUrl, ...(answer.workingUrl ? { workingUrl: answer.workingUrl } : {}),
    })));
    await mount;

    expect(core.composite.defaultWritableBagId()).toBe(working);
    expect(answer.workingUrl, "the host named a different document than the worker attached").toBe(workerHandle.url);

    const requestId = `host-row-${seated}`;
    const title = `${OUTCOME_URI_PREFIX}${requestId}`;
    await core.control.put({ tiddler: { title, "request-id": requestId, verb: "nexus-kapae", status: "done", "input-digest": "digest-1" } }, { kind: "lares-verb", requestId });
    const hostWorking = await st.vesselRepo.find<LarDoc>(answer.workingUrl as AutomergeUrl);
    expect(core.controlHandle.doc()?.tiddlers[title], "the verdict row rests in the control document").toBeDefined();
    expect(hostWorking.doc()?.tiddlers[title], "the verdict row reached the mirrored working document").toBeUndefined();
    expect(st.daemonHandle.doc()?.tiddlers[title]).toBeUndefined();
    expect(personaHandle?.doc()?.tiddlers[title]).toBeUndefined();
    expect((await core.control.get(title))?.tiddler).toMatchObject({ "request-id": requestId });
  }, 60_000);
});
