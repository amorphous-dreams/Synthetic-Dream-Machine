/** Chromium drives the production holder, its real Repo relay, and an observable island worker. */
import { describe, expect, test } from "vitest";
import { attachSharedHolder, holderWorkerHandle, type SharedWorkerHost } from "../src/shared-holder.js";
import { faceFixture } from "./holder-session-fixture.js";

const host: SharedWorkerHost = { SharedWorker: SharedWorker as unknown as SharedWorkerHost["SharedWorker"] };
async function lockHeld(name: string): Promise<boolean> {
  return (await navigator.locks.query()).held?.some((lock) => lock.name === name) ?? false;
}
async function houseStore(lockName: string, group: string, root: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${group}|${root}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `${lockName}:house:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function deleteOutcome(name: string): Promise<"deleted" | "blocked"> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onblocked = () => resolve("blocked");
    request.onsuccess = () => resolve("deleted");
    request.onerror = () => reject(request.error);
  });
}
async function rig() {
  const id = crypto.randomUUID();
  const lockName = `lares:vessel:production:${id}`;
  const islandLock = `island:${id}`;
  const islandUrl = new URL("./fixtures/stub-island.worker.ts", import.meta.url);
  islandUrl.searchParams.set("id", id);
  const holderUrl = new URL("../src/shared-holder.worker.ts", import.meta.url);
  holderUrl.searchParams.set("island", islandUrl.href);
  holderUrl.searchParams.set("lock", lockName);
  const face = await faceFixture(`face:production:${id}`);
  const attach = async () => {
    const opened = await attachSharedHolder({ holderUrl, host });
    expect(opened.kind, "Chromium opens the production module SharedWorker").toBe("attached");
    if (opened.kind !== "attached") throw new Error("production SharedWorker absent");
    const handle = holderWorkerHandle(opened.port, { personaGroup: face.group, edge: face.edge, atom: face.atom });
    return { opened, handle };
  };
  return { lockName, islandLock, face, attach };
}
async function admitFirst(r: Awaited<ReturnType<typeof rig>>) {
  const tab = await r.attach();
  // The signed session opens the house before its claimant sends the manifest.
  await expect.poll(() => lockHeld(r.islandLock), { timeout: 5_000 }).toBe(true);
  const admitted = new Promise<void>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { kind?: string }).kind !== "holder:admitted") return;
      tab.opened.port.removeEventListener("message", onMessage); resolve();
    };
    tab.opened.port.addEventListener("message", onMessage);
  });
  const channel = new MessageChannel();
  tab.handle.post({ type: "manifest", wikiUri: "lar:///test.holder.production/daemon", daemonAuth: { deviceEdge: r.face.edge }, syncPort: channel.port2 }, [channel.port2]);
  await admitted;
  await expect.poll(() => lockHeld(r.islandLock), { timeout: 5_000 }).toBe(true);
  return { ...tab, channel };
}

// MEASURED: Chromium's SharedWorkerGlobalScope exposes no Worker constructor, so the production holder cannot start a
// house's island there ("Worker is not defined"); the tab-death lifecycle below therefore stands as expected failures
// until the holder's island host is ruled (the operator's fork). The lifecycle itself is witnessed over fakes in
// shared-holder-liveness.test.ts. The probe records the measured refusal and turns red the day an island starts.
describe("the production shared holder lifetime", () => {
  test("PROBE: under Chromium the ?holder path refuses by name before any admission and the tab takes the dedicated-worker floor", async () => {
    const r = await rig();
    const holderUrl = new URL("../src/shared-holder.worker.ts", import.meta.url);
    holderUrl.searchParams.set("island", new URL("./fixtures/stub-island.worker.ts", import.meta.url).href);
    holderUrl.searchParams.set("lock", r.lockName);
    const attached = await attachSharedHolder({ holderUrl, host });
    expect(attached.kind, "Chromium's holder cannot spawn an island: the day this reads attached, remove the expected failures below").toBe("floor");
    if (attached.kind === "floor") expect(attached.why).toMatch(/holder-unavailable: no nested Worker in this engine/);
  }, 20_000);

  test.fails("closing the last tab port terminates the island and releases the house database", async () => {
    const r = await rig(); const tab = await admitFirst(r);
    const store = await houseStore(r.lockName, r.face.group, r.face.edge.personaRootDid);
    tab.handle.terminate(); tab.channel.port1.close();
    await expect.poll(() => lockHeld(r.islandLock), { timeout: 5_000 }).toBe(false);
    await expect(deleteOutcome(store), "the last tab's Repo shuts before database deletion").resolves.toBe("deleted");
  }, 20_000);

  test.fails("pagehide's session:close message ends the last tab's house", async () => {
    const r = await rig(); const tab = await admitFirst(r);
    const store = await houseStore(r.lockName, r.face.group, r.face.edge.personaRootDid);
    const { ownerEpoch, sessionId, generation } = tab.opened.hello;
    tab.opened.port.postMessage({ type: "session:close", ownerEpoch, sessionId, generation });
    await expect.poll(() => lockHeld(r.islandLock), { timeout: 5_000 }).toBe(false);
    await expect(deleteOutcome(store), "pagehide closes the house Repo").resolves.toBe("deleted");
    tab.opened.port.close(); tab.channel.port1.close();
  }, 20_000);

  test.fails("control: another admitted tab keeps the island and database after the first closes", async () => {
    const r = await rig(); const first = await admitFirst(r);
    const second = await r.attach();
    await new Promise<void>((resolve) => {
      const onMessage = (event: MessageEvent) => {
        if ((event.data as { kind?: string }).kind !== "holder:admitted") return;
        second.opened.port.removeEventListener("message", onMessage); resolve();
      };
      second.opened.port.addEventListener("message", onMessage);
    });
    first.handle.terminate(); first.channel.port1.close();
    expect(await lockHeld(r.islandLock), "the second tab keeps the island lock held").toBe(true);
    const store = await houseStore(r.lockName, r.face.group, r.face.edge.personaRootDid);
    expect(await deleteOutcome(store), "the second tab keeps the Repo database open").toBe("blocked");
    const { ownerEpoch, sessionId, generation } = second.opened.hello;
    second.opened.port.postMessage({ type: "session:close", ownerEpoch, sessionId, generation });
    second.opened.port.close();
  }, 20_000);
});
