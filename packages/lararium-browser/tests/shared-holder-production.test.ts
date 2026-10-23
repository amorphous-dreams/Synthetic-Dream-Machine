/** Real SharedWorker house lifecycle in Chromium and other supported engines. */
import { describe, expect, test } from "vitest";
import { attachSharedHolder, holderWorkerHandle, houseName } from "../src/shared-holder.js";
import { faceFixture } from "./holder-session-fixture.js";

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
  const holderUrl = new URL("../src/shared-holder.worker.ts", import.meta.url);
  holderUrl.searchParams.set("island-module", islandUrl.href);
  holderUrl.searchParams.set("lock", lockName);
  return { lockName, holderUrl };
}

// Attachment itself answers which engine can run the real peer path; no expected failure can pass before that path.
const probe = await attachSharedHolder({ holderUrl: urls(crypto.randomUUID()).holderUrl, houseName: await houseName("probe", crypto.randomUUID()), signal: AbortSignal.timeout(5_000) });
const canAttach = probe.kind === "attached";
if (probe.kind === "attached") probe.port.close();

async function rig(id = crypto.randomUUID(), faceTag = id) {
  const paths = urls(id);
  const face = await faceFixture(`face:web-production:${faceTag}`);
  const namedHouse = await houseName(face.group, face.edge.personaRootDid);
  const attach = async (name = namedHouse) => {
    const opened = await attachSharedHolder({ holderUrl: paths.holderUrl, houseName: name });
    expect(opened.kind, "this engine reached a production holder session").toBe("attached");
    if (opened.kind !== "attached") throw new Error(`holder attachment refused: ${opened.why}`);
    const handle = holderWorkerHandle(opened.port, { personaGroup: face.group, edge: face.edge, atom: face.atom });
    return { opened, handle };
  };
  return { ...paths, face, attach, namedHouse, islandLock: `island:${id}:${namedHouse}` };
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
  // A module graph that cannot greet reports its engine and cause through the floor witness.
  test.skipIf(canAttach)("Firefox module graph: floor engine names why the holder is unavailable before a peer session", () => {
    expect(probe.kind).toBe("floor");
    if (probe.kind === "floor") expect(probe.why, "the floor names its cause").toMatch(/^the shared holder worker raised an error or was cancelled before it greeted|^SharedWorker refused/);
  });

  test.skipIf(!canAttach)("Firefox module graph: closing the last tab port releases the island lock and house database", async () => {
    const r = await rig(); const tab = await admitFirst(r);
    const store = await houseStore(r.lockName, r.face.group, r.face.edge.personaRootDid);
    tab.handle.terminate(); tab.channel.port1.close();
    await expect.poll(() => lockHeld(r.islandLock), { timeout: 10_000 }).toBe(false);
    await expect(deleteOutcome(store), "the Repo closes with the last session").resolves.toBe("deleted");
  }, 30_000);

  test.skipIf(!canAttach)("Firefox module graph: pagehide's session:close releases the island lock and house database", async () => {
    const r = await rig(); const tab = await admitFirst(r);
    const store = await houseStore(r.lockName, r.face.group, r.face.edge.personaRootDid);
    // The attached tab's pagehide listener emits its port-bound session:close envelope.
    globalThis.dispatchEvent(new Event("pagehide"));
    await expect.poll(() => lockHeld(r.islandLock), { timeout: 10_000 }).toBe(false);
    await expect(deleteOutcome(store), "pagehide closes the house Repo").resolves.toBe("deleted");
    tab.opened.port.close(); tab.channel.port1.close();
  }, 30_000);

  test.skipIf(!canAttach)("Firefox module graph: CONTROL: a second admitted session keeps the island and Repo after the first closes", async () => {
    const r = await rig(); const first = await admitFirst(r);
    const second = await r.attach();
    expect(second.opened.hello.ownerEpoch).toBe(first.opened.hello.ownerEpoch);
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
  test.skipIf(!canAttach)("Firefox module graph: separate faces reach separate house workers", async () => {
    const id = crypto.randomUUID();
    const a = await rig(id, "a");
    const b = await rig(id, "b");
    const first = await admitFirst(a);
    const second = await admitFirst(b);
    expect(first.opened.hello.ownerEpoch).not.toBe(second.opened.hello.ownerEpoch);
    expect(await lockHeld(a.islandLock)).toBe(true);
    expect(await lockHeld(b.islandLock)).toBe(true);
    first.handle.terminate(); second.handle.terminate();
    first.channel.port1.close(); second.channel.port1.close();
  }, 30_000);

  test.skipIf(!canAttach)("Firefox module graph: wrong house name refuses before island boot", async () => {
    const r = await rig();
    const wrong = await r.attach(await houseName("other-face", r.face.edge.personaRootDid));
    const refusal = new Promise<string>((resolve) => wrong.opened.port.addEventListener("message", (event) => {
      const msg = event.data as { kind?: string; cause?: string };
      if (msg.kind === "holder:refused") resolve(msg.cause ?? "");
    }, { once: true }));
    expect(await refusal).toBe("wrong-house");
    wrong.handle.terminate();
  }, 30_000);
});
