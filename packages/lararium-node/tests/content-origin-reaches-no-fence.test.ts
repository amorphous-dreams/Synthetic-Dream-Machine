/**
 * content-origin-reaches-no-fence — K19 slice 4, R4: a synced dispatch-marked tiddler whose `listenable` names the
 * PUBLIC place key reaches no fenced daemon verb; the same verb as a person's surface act lands (house ruling
 * 2026-10-29). The chain is composed in process, link by link, over a real founded face and the wired daemon table:
 * the island's stamp → the bridge's ask (`islandEventAsk`) → the daemon's locality (`placedAskIsLocal`) → the
 * presenter (`presenterOf`) → the content fence. Each link is the production function, not a stand-in.
 *
 * RED today: the bridge carries no origin and every placed ask reads local, so the place key presents as the
 * mounted face and the fence admits a peer's synced document.
 */
import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { islandEventAsk } from "@lararium/mesh";
import { VerbTable, placedAskIsLocal } from "@lararium/tw5";
import { standFoundedIsland } from "./stand-founded-island.js";
import { nodeSealedStoreShore } from "../src/sealed-store-island.js";

vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

test("R4 RED: a content-born summon naming the place key reaches no fenced verb; CONTROL: the same summon as a surface act lands", async () => {
  const a = await standFoundedIsland(teardown);
  const root = mkdtempSync(join(tmpdir(), "content-origin-")); teardown.push(() => rmSync(root, { recursive: true, force: true }));
  const opts = operatorDaemonOptions({ daemonAuth: a.daemonAuth } as never,
    { dyadReading: () => "clear", sealedStore: nodeSealedStoreShore(join(root, "daemon")), persistArchive: () => {}, persistVeilArchive: () => {} });
  const kh = await opts.verifierFactory!(a.ctx) as { dispose?: () => Promise<void> };
  teardown.push(() => { void kh.dispose?.(); });
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, a.ctx);
  const place = `0x${a.daemonAuth.placeVerifyingKey}`;
  // A fenced verb that runs on the mounted face's mint: `pin` commands main's residency through `ctx.post`.
  const verb = "pin";
  expect(registry.fenced(verb), "the verb under test stands fenced").toBe(true);
  const run = async (stamp: "content" | "surface") => {
    const ask = islandEventAsk(place, { verb, uri: "lar:///synced/summon", ...(stamp === "surface" ? { origin: "surface" } : {}) });
    expect(ask).not.toBeNull();
    const local = placedAskIsLocal({ type: "daemon:place-verb", verb, args: ask!.args, requestedBy: ask!.requestedBy, origin: ask!.origin } as never);
    const invocation = { requestId: `r-${stamp}`, action: verb, args: ask!.args, requestedBy: ask!.requestedBy } as never;
    const presenter = opts.presenterOf!(invocation, local);
    return Promise.resolve()
      .then(() => registry.get(verb)!(ask!.args, { daemon: {} as never, invocation, presenter, local, cap: async () => ({ ok: true }) } as never))
      .then(() => null, (e: { reason?: string }) => e);
  };
  // The content-born summon presents as the claim it carried (the public place key), synced, and the fence refuses it.
  expect(await run("content")).toMatchObject({ reason: "content-mounted-only" });
  // CONTROL: a person's act over a surface leg reads local and presents as the mounted face.
  expect(await run("surface")).not.toMatchObject({ reason: "content-mounted-only" });
});
