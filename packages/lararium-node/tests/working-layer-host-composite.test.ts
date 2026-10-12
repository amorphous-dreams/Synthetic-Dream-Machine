/**
 * working-layer-host-composite — the host's composite writes into the SAME working document the worker attached.
 *
 * The worker attaches the daemon wiki's working layer through the real `operatorDaemonOptions` boot; the host
 * composite then mounts the document the worker's own binding resolver names. A receipt fact recorded through a
 * real FactLedger over the host composite lands in that document and in neither the daemon bag nor the persona
 * layer, with and without a persona layer on the host.
 */
import { afterEach, describe, expect, test } from "vitest";
import type { AutomergeUrl } from "@automerge/automerge-repo";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import {
  DAEMON_BAG_ID, RECEIPT_FACT_URI_PREFIX, emptyLarDoc, mkDaemonResolveBindingResult, mkEa, wikiSlotUri,
  type IslandMsg_Manifest, type LarDoc,
} from "@lararium/mesh";
import { openDaemonVmCore, type DaemonVmHost } from "@lararium/tw5";
import { standFoundedIsland } from "./stand-founded-island.js";
import { FactLedger } from "../src/uds-channel.js";

const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

describe("daemon VM host composite working binding", () => {
  test.each([false, true])("a receipt fact recorded on the host composite lands in the worker's working document (persona layer on the host: %s)", async (seated) => {
    const st = await standFoundedIsland(teardown);
    const opts = operatorDaemonOptions({ daemonAuth: st.daemonAuth } as never);
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
      repo: st.vesselRepo, daemonHandle: st.daemonHandle,
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
      requestId: ask.requestId!, personalUrl: answer.personalUrl, draftUrl: answer.draftUrl, workingUrl: answer.workingUrl,
    })));
    await mount;

    expect(core.composite.defaultWritableBagId()).toBe(working);
    expect(answer.workingUrl, "the host named a different document than the worker attached").toBe(workerHandle.url);

    const ledger = new FactLedger(core.composite, st.vesselRepo, 8, 1);
    const requestId = `host-fact-${seated}`;
    await ledger.arbitrate(requestId, "digest-1");
    const title = `${RECEIPT_FACT_URI_PREFIX}${requestId}`;
    const hostWorking = await st.vesselRepo.find<LarDoc>(answer.workingUrl as AutomergeUrl);
    expect(hostWorking.doc()?.tiddlers[title], "the receipt fact is absent from the working document").toBeDefined();
    expect(st.daemonHandle.doc()?.tiddlers[title]).toBeUndefined();
    expect(personaHandle?.doc()?.tiddlers[title]).toBeUndefined();
    expect(await ledger.get(requestId)).toMatchObject({ requestId });
  }, 60_000);
});
