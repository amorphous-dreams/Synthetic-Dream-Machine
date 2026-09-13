/**
 * nexus-dial-reconnect — Socket A's RE-ARM, the counterpart Socket B already stands.
 *
 * The carriage serve-loop (Socket B) counts its dials and fires `onReconnect` on every attempt past the
 * first — re-folding membership, posture and the realm plane, then re-reading the Repo's cached share
 * verdicts (`carriage-serve-loop.ts:170-175` · `open-node-vessel.ts:694-702`). The Automerge `/ws` dial
 * (Socket A) had no counterpart: the inherited `WebSocketClientAdapter` re-dials on its own and NOTHING
 * above it hears, so after a partition heals the peer's doc is never re-asked and no verdict is re-read.
 *
 * The docker `meme` scenario measures exactly that as a GAP — "B's offline edit never reached A after the
 * return — the seam is the RECONNECT, not the write".
 *
 * ★ THE RED: `armDialReconnect` does not exist. Then: the FIRST `peer-candidate` is a connect and fires
 * nothing; the SECOND is a RE-connect and fires `onReconnect` + re-asks the named doc; a dial carrying no
 * doc url still re-folds. CONTROLS: one candidate never fires; a stopped arm never fires again; the
 * re-ask is skipped when no `docUrl` rides the config; `onReconnect` throwing never stops the re-ask.
 *
 * The seam is the ADAPTER'S OWN EVENT, so the test drives a stub emitter — the arm takes the adapter as
 * an injected shape and constructs nothing, which is what lets the red run without a socket.
 */
import { describe, test, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { armDialReconnect } from "../src/nexus-client-dial.js";

/** The adapter shape the arm reads: `on("peer-candidate", …)`, nothing more. */
function stubAdapter(): EventEmitter & { fire: () => void } {
  const e = new EventEmitter() as EventEmitter & { fire: () => void };
  e.fire = () => e.emit("peer-candidate", { peerId: "peer-x" });
  return e;
}

/** A Repo double that records every `find`. */
function stubRepo(): { find: (u: string) => Promise<unknown>; asked: string[] } {
  const asked: string[] = [];
  return { asked, find: async (u: string) => { asked.push(u); return {}; } };
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("nexus-dial-reconnect — Socket A re-arms the way Socket B already does", () => {
  test("★ the FIRST peer-candidate is a CONNECT — it fires no re-arm and re-asks nothing ★", async () => {
    const adapter = stubAdapter(), repo = stubRepo(), onReconnect = vi.fn(async () => { /* */ });
    armDialReconnect({ adapter, repo, docUrl: "automerge:abc", onReconnect });
    adapter.fire();
    await settle();
    expect(onReconnect).not.toHaveBeenCalled();
    expect(repo.asked).toEqual([]);
  });

  test("★ the SECOND peer-candidate is a RE-CONNECT — it fires onReconnect and re-asks the named doc ★", async () => {
    const adapter = stubAdapter(), repo = stubRepo(), onReconnect = vi.fn(async () => { /* */ });
    armDialReconnect({ adapter, repo, docUrl: "automerge:abc", onReconnect });
    adapter.fire();
    adapter.fire();
    await settle(); await settle();
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(repo.asked).toEqual(["automerge:abc"]);
  });

  test("a dial carrying NO doc url still re-folds on the return — the verdict is the point, not the doc", async () => {
    const adapter = stubAdapter(), repo = stubRepo(), onReconnect = vi.fn(async () => { /* */ });
    armDialReconnect({ adapter, repo, onReconnect });
    adapter.fire(); adapter.fire();
    await settle(); await settle();
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(repo.asked).toEqual([]);
  });

  test("CONTROL: a `stop()`ed arm hears nothing further — no re-fold, no re-ask", async () => {
    const adapter = stubAdapter(), repo = stubRepo(), onReconnect = vi.fn(async () => { /* */ });
    const arm = armDialReconnect({ adapter, repo, docUrl: "automerge:abc", onReconnect });
    adapter.fire();
    arm.stop();
    adapter.fire(); adapter.fire();
    await settle(); await settle();
    expect(onReconnect).not.toHaveBeenCalled();
    expect(repo.asked).toEqual([]);
  });

  test("CONTROL: an `onReconnect` that THROWS never stops the re-ask — a torn re-fold must not cost the doc", async () => {
    const adapter = stubAdapter(), repo = stubRepo();
    const onReconnect = vi.fn(async () => { throw new Error("the board would not fold"); });
    armDialReconnect({ adapter, repo, docUrl: "automerge:abc", onReconnect });
    adapter.fire(); adapter.fire();
    await settle(); await settle(); await settle();
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(repo.asked).toEqual(["automerge:abc"]);
  });

  test("CONTROL: a third candidate re-arms AGAIN — the count is per-return, never once-only", async () => {
    const adapter = stubAdapter(), repo = stubRepo(), onReconnect = vi.fn(async () => { /* */ });
    armDialReconnect({ adapter, repo, docUrl: "automerge:abc", onReconnect });
    adapter.fire(); adapter.fire(); adapter.fire();
    await settle(); await settle(); await settle();
    expect(onReconnect).toHaveBeenCalledTimes(2);
    expect(repo.asked).toEqual(["automerge:abc", "automerge:abc"]);
  });

  test("CONTROL: a rejected re-ask never throws out of the arm — a down peer costs the next return, not the process", async () => {
    const adapter = stubAdapter(), onReconnect = vi.fn(async () => { /* */ });
    const repo = { find: async (): Promise<unknown> => { throw new Error("unavailable"); } };
    armDialReconnect({ adapter, repo, docUrl: "automerge:abc", onReconnect });
    adapter.fire(); adapter.fire();
    await settle(); await settle(); await settle();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});
