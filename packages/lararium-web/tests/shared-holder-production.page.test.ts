/** The production holder's house lifetime, measured in each web engine's real workers and IndexedDB. */
import { describe, expect, test } from "vitest";
import { attachSharedHolder, holderWorkerHandle } from "../../lararium-browser/src/shared-holder.js";
import { faceFixture } from "../../lararium-browser/tests/holder-session-fixture.js";

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
function urls(id: string) {
  const lockName = `lares:vessel:web-production:${id}`;
  const islandUrl = new URL("./fixtures/stub-island.worker.ts", import.meta.url);
  islandUrl.searchParams.set("id", id);
  const holderUrl = new URL("../../lararium-browser/src/shared-holder.worker.ts", import.meta.url);
  holderUrl.searchParams.set("island", islandUrl.href);
  holderUrl.searchParams.set("lock", lockName);
  return { lockName, islandLock: `island:${id}`, holderUrl };
}

// Attachment itself answers which engine can run the real peer path; no expected failure can pass before that path.
const probe = await attachSharedHolder({ holderUrl: urls(crypto.randomUUID()).holderUrl });
const canAttach = probe.kind === "attached";
if (probe.kind === "attached") probe.port.close();

async function rig() {
  const id = crypto.randomUUID();
  const paths = urls(id);
  const face = await faceFixture(`face:web-production:${id}`);
  const attach = async () => {
    const opened = await attachSharedHolder({ holderUrl: paths.holderUrl });
    expect(opened.kind, "this engine reached a production holder session").toBe("attached");
    if (opened.kind !== "attached") throw new Error(`holder attachment refused: ${opened.why}`);
    const handle = holderWorkerHandle(opened.port, { personaGroup: face.group, edge: face.edge, atom: face.atom });
    return { opened, handle };
  };
  return { ...paths, face, attach };
}
async function admitFirst(r: Awaited<ReturnType<typeof rig>>) {
  const tab = await r.attach();
  await expect.poll(() => lockHeld(r.islandLock), { timeout: 10_000 }).toBe(true);
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
  await expect.poll(() => lockHeld(r.islandLock), { timeout: 10_000 }).toBe(true);
  return { ...tab, channel };
}

describe("production shared holder lifecycle", () => {
  test.skipIf(canAttach)("floor engines name holder-unavailable before a peer session", () => {
    expect(probe.kind).toBe("floor");
    if (probe.kind === "floor") expect(probe.why, "the missing nested Worker names its floor cause").toMatch(/^holder-unavailable:/);
  });

  test.skipIf(!canAttach)("closing the last tab port releases the island lock and house database", async () => {
    const r = await rig(); const tab = await admitFirst(r);
    const store = await houseStore(r.lockName, r.face.group, r.face.edge.personaRootDid);
    tab.handle.terminate(); tab.channel.port1.close();
    await expect.poll(() => lockHeld(r.islandLock), { timeout: 10_000 }).toBe(false);
    await expect(deleteOutcome(store), "the Repo closes with the last session").resolves.toBe("deleted");
  }, 30_000);

  test.skipIf(!canAttach)("pagehide's session:close releases the island lock and house database", async () => {
    const r = await rig(); const tab = await admitFirst(r);
    const store = await houseStore(r.lockName, r.face.group, r.face.edge.personaRootDid);
    // The attached tab's pagehide listener emits its port-bound session:close envelope.
    globalThis.dispatchEvent(new Event("pagehide"));
    await expect.poll(() => lockHeld(r.islandLock), { timeout: 10_000 }).toBe(false);
    await expect(deleteOutcome(store), "pagehide closes the house Repo").resolves.toBe("deleted");
    tab.opened.port.close(); tab.channel.port1.close();
  }, 30_000);

  test.skipIf(!canAttach)("CONTROL: a second admitted session keeps the island and Repo after the first closes", async () => {
    const r = await rig(); const first = await admitFirst(r);
    const second = await r.attach();
    const admitted = new Promise<void>((resolve) => {
      const onMessage = (event: MessageEvent) => {
        if ((event.data as { kind?: string }).kind !== "holder:admitted") return;
        second.opened.port.removeEventListener("message", onMessage); resolve();
      };
      second.opened.port.addEventListener("message", onMessage);
    });
    await admitted;
    first.handle.terminate(); first.channel.port1.close();
    expect(await lockHeld(r.islandLock), "the second session keeps the island alive").toBe(true);
    const store = await houseStore(r.lockName, r.face.group, r.face.edge.personaRootDid);
    expect(await deleteOutcome(store), "the second session keeps the Repo database open").toBe("blocked");
    second.handle.terminate();
    await expect.poll(() => lockHeld(r.islandLock), { timeout: 10_000 }).toBe(false);
  }, 30_000);
});
