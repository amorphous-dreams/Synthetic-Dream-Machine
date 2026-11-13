/**
 * daemon-shore-verb — the daemon island answers the shore verb where its shore door stands.
 *
 * `lares shore` asks an island for what stands at its disk shore. The daemon island mounts a projector of its own
 * (the daemon wiki's working layer, crossroads), so a standoff or a pending removal it holds needs an answer from
 * that island. The node entry injects the door (`shore`), and the daemon registers the verb only where one stands:
 * a shore with no directory of its own (a browser vessel) registers none.
 *
 * The real `operatorDaemonOptions` boot runs over a real founding. Canon: lar:///ha.ka.ba/lararium/node/disk-projection
 */
import { afterEach, describe, expect, test } from "vitest";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { VerbTable } from "@lararium/tw5";
import { standFoundedIsland } from "./stand-founded-island.js";

const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) { try { teardown.pop()!(); } catch { /* best-effort */ } } });

async function stand(shore?: (args: Record<string, unknown>) => Promise<Record<string, unknown>>) {
  const st = await standFoundedIsland(teardown);
  const opts = operatorDaemonOptions({ daemonAuth: st.daemonAuth } as never, {
    dyadReading: () => "clear", persistArchive: () => {}, persistVeilArchive: () => {}, ...(shore ? { shore } : {}),
  });
  const kh = await opts.verifierFactory!(st.ctx) as { dispose?: () => Promise<void> };
  teardown.push(() => { void kh.dispose?.(); });
  const registry = new VerbTable();
  opts.wireWorkerVerbs!(registry, st.ctx);
  mounted = `0x${st.daemonAuth.atom.key}`;
  return registry;
}
// The shore reads the daemon wiki's working layer, the mounted face's own: the content fence admits its presenter alone.
let mounted = "";
const invoke = (registry: VerbTable, args: Record<string, unknown>) =>
  registry.get("shore")!(args, { daemon: {} as never, invocation: { requestId: "shore-1" } as never, presenter: mounted, local: true, cap: async () => ({ ok: true }) } as never) as Promise<Record<string, unknown>>;

describe("the daemon island's shore verb", () => {
  test("with a shore door injected, the daemon registers `shore` and answers through that door with the caller's own arguments", async () => {
    const heard: Record<string, unknown>[] = [];
    const registry = await stand(async (args) => { heard.push(args); return { ok: true, standing: [{ uri: "lar:///ha.ka.ba/@test/a-carrier" }] }; });
    expect(registry.get("shore")).toBeDefined();
    expect(await invoke(registry, { act: "list" })).toEqual({ ok: true, standing: [{ uri: "lar:///ha.ka.ba/@test/a-carrier" }] });
    expect(heard).toEqual([{ act: "list" }]);
  }, 120_000);

  test("CONTROL: with no shore door, no `shore` verb registers", async () => {
    const registry = await stand();
    expect(registry.get("shore")).toBeUndefined();
  }, 120_000);
});
