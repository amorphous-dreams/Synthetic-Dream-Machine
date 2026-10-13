/**
 * Browser dyad door vectors:
 * B1 missing door reads aside; control: each standing passes through.
 * B2 throwing, unknown, and malformed asks read aside; control: a valid ask reaches its door.
 * B3 correlation, timeout, invalid standing, and duplicate replies fail closed; control: concurrent asks settle independently and asker ids stay unique.
 * B4 daemon asks reach their door; control: a stopped listener draws no reply.
 * B5 wiki asks refuse by name even beside a clear daemon door; control: another handle reaches that door.
 */
import { describe, expect, test, vi } from "vitest";
import { ISLAND_PROTOCOL_VERSION, type EdgeStanding } from "@lararium/mesh";
import {
  answerBrowserDyadAsk,
  attachBrowserDyadDoor,
  browserDyadAsker,
  refuseBrowserDyadAsks,
} from "../src/browser-dyad-door.js";

const standings: EdgeStanding[] = ["clear", "aside", "owing", "returned"];
const ask = (requestId: string, fleetRoot: unknown = "fleet", deviceKey: unknown = "device") => ({
  schema_version: ISLAND_PROTOCOL_VERSION, type: "dyad:ask", requestId, fleetRoot, deviceKey,
});

function fakeScope() {
  const listeners: Array<(event: { data: unknown }) => void> = [];
  const posted: unknown[] = [];
  return {
    posted,
    scope: {
      postMessage(message: unknown) { posted.push(message); },
      addEventListener(_type: "message", fn: (event: { data: unknown }) => void) { listeners.push(fn); },
    },
    reply(data: unknown) { for (const listener of listeners) listener({ data }); },
  };
}

function fakeHandle() {
  const listeners: Array<(raw: unknown) => void> = [];
  const posted: unknown[] = [];
  return {
    posted,
    handle: {
      post(message: unknown) { posted.push(message); },
      listen(fn: (raw: unknown) => void) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    },
    send(message: unknown) { for (const listener of [...listeners]) listener(message); },
  };
}

describe("the browser dyad door", () => {
  test("B1 — no door reads aside; each standing passes through", async () => {
    const request = { requestId: "none", fleetRoot: "fleet", deviceKey: "device" };
    await expect(answerBrowserDyadAsk(null, request)).resolves.toMatchObject({ standing: "aside" });
    for (const standing of standings) {
      await expect(answerBrowserDyadAsk(() => standing, { ...request, requestId: standing })).resolves.toMatchObject({ standing });
    }
  });

  test("B2 — faults and malformed readings fail closed; a valid ask reaches its door", async () => {
    const request = { requestId: "request", fleetRoot: "fleet", deviceKey: "device" };
    await expect(answerBrowserDyadAsk(() => { throw new Error("closed"); }, request)).resolves.toMatchObject({ standing: "aside" });
    await expect(answerBrowserDyadAsk(() => "fifth" as EdgeStanding, request)).resolves.toMatchObject({ standing: "aside" });
    await expect(answerBrowserDyadAsk(() => "clear", { ...request, fleetRoot: 5 } as never)).resolves.toMatchObject({ standing: "aside" });
    await expect(answerBrowserDyadAsk(() => "owing", request)).resolves.toMatchObject({ standing: "owing" });
  });

  test("B3 — only the matching first reply settles; controls cover silence, concurrency, and unique asker ids", async () => {
    const channel = fakeScope();
    const read = browserDyadAsker(channel.scope, 30);
    const one = read("fleet-a", "device-a");
    const two = read("fleet-b", "device-b");
    const firstId = (channel.posted[0] as { requestId: string }).requestId;
    const secondId = (channel.posted[1] as { requestId: string }).requestId;
    let settled = false;
    void one.then(() => { settled = true; });
    channel.reply({ type: "dyad:read", requestId: "other", standing: "returned" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    channel.reply({ type: "dyad:read", requestId: secondId, standing: "owing" });
    channel.reply({ type: "dyad:read", requestId: firstId, standing: "clear" });
    channel.reply({ type: "dyad:read", requestId: firstId, standing: "returned" });
    await expect(Promise.all([one, two])).resolves.toEqual(["clear", "owing"]);

    const silent = fakeScope();
    await expect(browserDyadAsker(silent.scope, 30)("fleet", "device")).resolves.toBe("aside");
    const broken = fakeScope();
    broken.scope.postMessage = () => { throw new Error("closed"); };
    await expect(browserDyadAsker(broken.scope, 30)("fleet", "device")).resolves.toBe("aside");
    const invalid = fakeScope();
    const invalidRead = browserDyadAsker(invalid.scope, 30)("fleet", "device");
    invalid.reply({ type: "dyad:read", requestId: (invalid.posted[0] as { requestId: string }).requestId, standing: "fifth" });
    await expect(invalidRead).resolves.toBe("aside");

    const shared = fakeScope();
    browserDyadAsker(shared.scope, 30)("fleet", "one");
    browserDyadAsker(shared.scope, 30)("fleet", "two");
    expect(new Set(shared.posted.map((message) => (message as { requestId: string }).requestId)).size).toBe(2);
  });

  test("B4 — daemon asks reach their door; a stopped handle draws no reply", async () => {
    const vessel = fakeHandle();
    const stop = attachBrowserDyadDoor(vessel.handle, () => () => "returned");
    vessel.send(ask("daemon"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vessel.posted.map((message) => (message as { standing: string }).standing)).toEqual(["returned"]);

    const missing = fakeHandle();
    attachBrowserDyadDoor(missing.handle, () => null);
    missing.send(ask("missing"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((missing.posted[0] as { standing: string }).standing).toBe("aside");

    stop();
    const before = vessel.posted.length;
    vessel.send(ask("stopped"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(vessel.posted).toHaveLength(before);
  });

  test("B5 — wiki asks refuse once beside a clear daemon door; a separate handle reaches it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const wiki = fakeHandle();
    refuseBrowserDyadAsks(wiki.handle);
    wiki.send(ask("wiki-one"));
    wiki.send(ask("wiki-two"));
    expect(wiki.posted.map((message) => (message as { standing: string }).standing)).toEqual(["aside", "aside"]);
    expect(warn.mock.calls.filter((call) => String(call[0]).includes("DyadDoorRefused"))).toHaveLength(1);
    expect(warn.mock.calls[0]?.[0]).toContain("DyadDoorRefused");

    const daemon = fakeHandle();
    attachBrowserDyadDoor(daemon.handle, () => () => "clear");
    daemon.send(ask("daemon-clear"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((daemon.posted[0] as { standing: string }).standing).toBe("clear");
    warn.mockRestore();
  });
});
