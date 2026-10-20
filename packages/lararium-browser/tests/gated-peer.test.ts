/** A house gate releases held Repo frames on clearance and drops them when the house ends. */
import { describe, expect, test } from "vitest";

type AttachGatedPeer = (attachRepoSide: (port: MessagePort) => void, tab: MessagePort, serving: Promise<void>, closed: Promise<void>) => void;

async function relay(): Promise<AttachGatedPeer> {
  // The variable lets the absent extraction reach the named assertion instead of stopping Vite's transform.
  const modulePath: string = "../src/gated-peer.js";
  const module = await import(modulePath).catch(() => null) as { attachGatedPeer: AttachGatedPeer } | null;
  expect(module, "gated-peer module stands").not.toBeNull();
  expect(module?.attachGatedPeer, "gated-peer exports its relay").toBeTypeOf("function");
  return module!.attachGatedPeer;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function inbox(port: MessagePort) {
  const frames: string[] = [];
  const waiters: Array<{ count: number; done: () => void }> = [];
  port.onmessage = (event: MessageEvent<string>) => {
    frames.push(event.data);
    for (const waiter of [...waiters]) if (frames.length >= waiter.count) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.done();
    }
  };
  port.start();
  return {
    frames,
    through(count: number): Promise<void> {
      if (frames.length >= count) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const waiter = { count, done: () => { clearTimeout(timer); resolve(); } };
        const timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error(`only ${frames.length} of ${count} frames arrived`));
        }, 1_000);
        waiters.push(waiter);
      });
    },
  };
}

function harness(attach: AttachGatedPeer, serving: Promise<void>, closed: Promise<void> = new Promise<void>(() => {})) {
  const tab = new MessageChannel();
  let repoPort!: MessagePort;
  attach((port) => { repoPort = port; }, tab.port1, serving, closed);
  expect(repoPort, "the Repo side attaches at once").toBeDefined();
  const repo = inbox(repoPort);
  const received = inbox(tab.port2);
  return {
    repo,
    received,
    tab: tab.port2,
    fromRepo: (frame: string) => repoPort.postMessage(frame),
    close: () => { repoPort.close(); tab.port1.close(); tab.port2.close(); },
  };
}

const nextTurn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

describe("the gated peer relay", () => {
  test("tab frames reach the Repo before the house gate clears", async () => {
    const attach = await relay();
    const gate = deferred();
    const peer = harness(attach, gate.promise);
    try {
      peer.tab.postMessage("tab:one");
      await peer.repo.through(1);
      expect(peer.repo.frames).toEqual(["tab:one"]);
      expect(peer.received.frames).toEqual([]);
    } finally { gate.resolve(); peer.close(); }
  });

  test("Repo frames wait for clearance and reach the tab in order", async () => {
    const attach = await relay();
    const gate = deferred();
    const peer = harness(attach, gate.promise);
    try {
      peer.fromRepo("repo:one");
      peer.fromRepo("repo:two");
      await nextTurn();
      expect(peer.received.frames, "the uncleared gate withholds Repo frames").toEqual([]);
      gate.resolve();
      await peer.received.through(2);
      expect(peer.received.frames).toEqual(["repo:one", "repo:two"]);
    } finally { peer.close(); }
  });

  test("a house ending drops held frames and closes the relay against later frames", async () => {
    const attach = await relay();
    const gate = deferred();
    const peer = harness(attach, gate.promise);
    try {
      peer.fromRepo("held:one");
      peer.fromRepo("held:two");
      await nextTurn();
      expect(peer.received.frames).toEqual([]);
      gate.reject(new Error("house ended"));
      await nextTurn();
      peer.fromRepo("late:three");
      await nextTurn();
      expect(peer.received.frames, "the ended house releases no held or later Repo frame").toEqual([]);
    } finally { peer.close(); }
  });

  test("control: a house clearing the same held sequence releases it", async () => {
    const attach = await relay();
    const gate = deferred();
    const peer = harness(attach, gate.promise);
    try {
      peer.fromRepo("held:one");
      peer.fromRepo("held:two");
      await nextTurn();
      expect(peer.received.frames).toEqual([]);
      gate.resolve();
      await peer.received.through(2);
      peer.fromRepo("late:three");
      await peer.received.through(3);
      expect(peer.received.frames).toEqual(["held:one", "held:two", "late:three"]);
    } finally { peer.close(); }
  });

  test("a cleared house closes both relay directions when its house ends", async () => {
    const attach = await relay();
    const gate = deferred(); const closed = deferred();
    const peer = harness(attach, gate.promise, closed.promise);
    try {
      gate.resolve();
      peer.tab.postMessage("tab:before");
      peer.fromRepo("repo:before");
      await Promise.all([peer.repo.through(1), peer.received.through(1)]);
      expect(peer.repo.frames).toEqual(["tab:before"]);
      expect(peer.received.frames).toEqual(["repo:before"]);
      closed.resolve();
      await nextTurn();
      peer.tab.postMessage("tab:after");
      peer.fromRepo("repo:after");
      await nextTurn();
      expect(peer.repo.frames, "a closed house receives no tab frame").toEqual(["tab:before"]);
      expect(peer.received.frames, "a closed house sends no Repo frame").toEqual(["repo:before"]);
    } finally { peer.close(); }
  });
});
